#!/usr/bin/env python3
"""Sync the GitHub Project (v2) board Status from PR + pipeline events.

Maps the dev/CI lifecycle onto the board's Status column:

    PR opened / reopened ............ In Progress
    PR ready for review ............. In Review
    Pipeline `gate` job fails ....... Blocked
    Pipeline `gate` job passes ...... In Review   (only if currently Blocked — i.e. un-block)

PR merged / issue closed -> Done is handled by the project's built-in workflows, not here.

Requires a PAT with `repo` + `project` scope in GH_TOKEN (the default GITHUB_TOKEN cannot
write a user-owned Project). Safe no-op when nothing matches or the token is absent.
"""
import json, os, subprocess, sys

OWNER = os.environ["PROJECT_OWNER"]
NUMBER = int(os.environ["PROJECT_NUMBER"])
EVENT_NAME = os.environ.get("GITHUB_EVENT_NAME", "")
EVENT_PATH = os.environ.get("GITHUB_EVENT_PATH", "")
REPO = os.environ.get("GITHUB_REPOSITORY", "")


def gql(query, **vars):
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for k, v in vars.items():
        cmd += (["-F", f"{k}={v}"] if isinstance(v, int) else ["-f", f"{k}={v}"])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"::warning::GraphQL error: {r.stderr.strip()[:200]}")
        return None
    return json.loads(r.stdout)


def rest(path):
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"::warning::REST error {path}: {r.stderr.strip()[:160]}")
        return None
    return json.loads(r.stdout)


def main():
    ev = json.load(open(EVENT_PATH))
    owner, repo = REPO.split("/")

    # --- decide target status + which PRs are involved -------------------------------
    status, prs = None, []
    if EVENT_NAME == "pull_request":
        action = ev.get("action")
        num = ev["pull_request"]["number"]
        if action == "ready_for_review":
            status = "In Review"
        elif action in ("opened", "reopened", "converted_to_draft"):
            status = "In Progress"
        prs = [(owner, repo, num)]
    elif EVENT_NAME == "workflow_run":
        run = ev["workflow_run"]
        jobs = rest(f"repos/{owner}/{repo}/actions/runs/{run['id']}/jobs")
        gate = next((j for j in (jobs or {}).get("jobs", []) if j["name"] == "gate"), None)
        if not gate or gate.get("conclusion") not in ("failure", "success"):
            print("gate job not conclusive — nothing to do."); return
        status = "Blocked" if gate["conclusion"] == "failure" else "In Review"
        prs = [(owner, repo, p["number"]) for p in run.get("pull_requests", [])]
        if not prs and run.get("head_branch"):  # fork/edge case: resolve by head branch
            found = rest(f"repos/{owner}/{repo}/pulls?state=open&head={owner}:{run['head_branch']}")
            prs = [(owner, repo, p["number"]) for p in (found or [])]
    if not status:
        print(f"event {EVENT_NAME}/{ev.get('action')} maps to no status — skip."); return

    # --- resolve project id + Status field/options ----------------------------------
    proj = gql('''query($o:String!,$n:Int!){ user(login:$o){ projectV2(number:$n){
      id field(name:"Status"){ ... on ProjectV2SingleSelectField{ id options{ id name } } } } } }''',
               o=OWNER, n=NUMBER)
    pdata = (proj or {}).get("data", {}).get("user", {}).get("projectV2")
    if not pdata:
        print("::warning::could not resolve project — is GH_TOKEN scoped for projects?"); return
    project_id = pdata["id"]
    field_id = pdata["field"]["id"]
    opt = {o["name"]: o["id"] for o in pdata["field"]["options"]}
    if status not in opt:
        print(f"::warning::status '{status}' missing from board — skip."); return
    target = opt[status]

    # --- collect board items for the PR(s) + their closing issues -------------------
    def items_for(o, r, n):
        q = '''query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){
          pullRequest(number:$n){
            projectItems(first:50){ nodes{ id project{ number owner{ login } }
              status:fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } } } }
            closingIssuesReferences(first:50){ nodes{ projectItems(first:50){ nodes{ id
              project{ number owner{ login } }
              status:fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } } } } } } } } }'''
        d = gql(q, o=o, r=r, n=n)
        pr = (d or {}).get("data", {}).get("repository", {}).get("pullRequest")
        if not pr:
            return []
        raw = list(pr["projectItems"]["nodes"])
        for iss in pr["closingIssuesReferences"]["nodes"]:
            raw += iss["projectItems"]["nodes"]
        out = []
        for nd in raw:
            if nd["project"]["number"] == NUMBER and nd["project"]["owner"]["login"] == OWNER:
                cur = (nd.get("status") or {}).get("name")
                out.append((nd["id"], cur))
        return out

    seen, changed = set(), 0
    for (o, r, n) in prs:
        for item_id, cur in items_for(o, r, n):
            if item_id in seen:
                continue
            seen.add(item_id)
            # gate-pass only un-blocks; never drags an in-progress card backwards
            if EVENT_NAME == "workflow_run" and status == "In Review" and cur != "Blocked":
                continue
            if cur == status:
                continue
            gql('''mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(
                  input:{ projectId:$p, itemId:$i, fieldId:$f, value:{ singleSelectOptionId:$o } }
                ){ clientMutationId } }''', p=project_id, i=item_id, f=field_id, o=target)
            print(f"  {item_id}: {cur} -> {status}")
            changed += 1
    print(f"done — {changed} item(s) updated to '{status}'.")


if __name__ == "__main__":
    main()
