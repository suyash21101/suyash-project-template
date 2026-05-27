# Build Roadmap — Bringing the Pipeline to Life

> A phased, step-by-step guide to building everything designed across `PIPELINE_PLAYBOOK.md`,
> `AWS_INFRA_SETUP.md`, and `GITHUB_DOTFILES_REPO_CHECKLIST.md` — with **modularity at every stage**
> as the organizing principle. Progress is tracked in `SAMPLE_SETUP_LOG.md`.

**Centerpiece:** a deployed control panel that flips pipeline stages on/off **from anywhere**, with
toggles stored as **GitHub Actions Variables** and read by CI **at runtime** — so a change takes
effect on the next run with no commit, and org-level variables steer every repo from one place.

---

## The control-plane model (read this first)

```
 deployed control UI  ──GitHub REST API──▶  PIPELINE_CONFIG variable  ──vars at runtime──▶  pipeline.yml
  (hosted SPA + auth)                       (org default + repo override)                   (orchestrator)
                                                                                                  │
                                                            gates each stage on its enabled flag
                                                                                                  │
                                            lint · test · security · e2e · deploy (reusable modules)
                                                                                                  │
                                                            gate job (single required check)
```

- **`PIPELINE_CONFIG`** — a single GitHub Actions **Variable** whose value is the JSON config below.
  Set it at **org level** for the default across all repos; a **repo-level** variable of the same
  name overrides per project. This is the source of truth — no file in the repo.
- **Deployed control UI** — a hosted page that GETs/PUTs that variable via the GitHub REST API.
- **`pipeline.yml`** — reads `vars.PIPELINE_CONFIG` when it runs; runs only enabled stages.
- **`gate`** — one always-runs aggregator job; the _only_ branch-protection required check.

### Why GitHub Variables + runtime fetch

- **Change without commit:** edit a toggle in the UI → it lands on the next workflow run. No PR, no push.
- **Org-wide control:** one org variable steers every repo; repos override only what they need.
- **Near-zero infra:** the store is GitHub itself. The only thing you host is a thin editor UI.
- **Native read:** `vars` is available directly in `if:` — no checkout, no config job needed.

> **Reproducibility caveat (by design):** because config is read at runtime, re-running an old
> commit may behave differently than it did originally. Mitigation we bake in: the orchestrator
> **echoes the resolved config into each run's job summary**, so every run records exactly what it
> used — without coupling config back to git.

### `PIPELINE_CONFIG` value (JSON schema)

```json
{
  "stages": {
    "lint": { "enabled": true },
    "typecheck": { "enabled": true },
    "test": { "enabled": true, "coverage_min": 80 },
    "build": { "enabled": true },
    "prisma_validate": { "enabled": true },
    "bundle_size": { "enabled": true, "threshold_kb": 50 },
    "security_scan": { "enabled": true, "block_on": "critical" },
    "regression": { "enabled": false },
    "migration_safety": { "enabled": true },
    "e2e": { "enabled": true, "run_on": ["staging", "main"] },
    "a11y": { "enabled": false },
    "lighthouse": { "enabled": false, "min_score": 90 },
    "pr_review": { "enabled": true, "model": "sonnet" },
    "sanity_check": { "enabled": true },
    "knowledge_graph": { "enabled": true }
  },
  "deploy": { "mode": "amplify", "migrate_before_traffic": true }
}
```

A GitHub Variable holds up to ~48KB, so the full nested JSON fits comfortably as the variable value.

> "I don't need testing of some kind" → flip `"test"` (or `"e2e"`, `"a11y"`, …) to `enabled:false`
> in the UI. It takes effect on the **next run** — no commit. The `gate` still passes.

### The orchestrator pattern (`pipeline.yml`)

```yaml
on: { pull_request: { types: [opened, synchronize] }, push: {} }
jobs:
  record: # audit what this run used
    runs-on: ubuntu-latest
    steps:
      - run: echo '${{ vars.PIPELINE_CONFIG }}' | jq . >> "$GITHUB_STEP_SUMMARY"

  test:
    if: ${{ fromJSON(vars.PIPELINE_CONFIG).stages.test.enabled }}
    uses: suyash21101/.github/.github/workflows/test.yml@v1
    with:
      coverage_min: ${{ fromJSON(vars.PIPELINE_CONFIG).stages.test.coverage_min }}

  # ...one job per stage, each gated on fromJSON(vars.PIPELINE_CONFIG).stages.<name>.enabled...

  gate: # the ONLY required status check
    needs: [test, lint, typecheck, build, security_scan]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo '${{ toJSON(needs) }}' | jq -e '
            to_entries | map(select(.value.result == "failure")) | length == 0
          ' > /dev/null || { echo "A required stage failed"; exit 1; }
```

Disabled stages report `result: skipped`, which `gate` treats as pass — so turning a stage off
never blocks a merge. **Only `gate` is a required check** in branch protection (playbook §7).

### The deployed control UI

- **Hosting:** a static SPA on **AWS Amplify** (matches the AWS-native direction) or GitHub Pages.
  No datastore of its own — GitHub Variables _is_ the store.
- **Auth (pick one):**
  - **GitHub App (recommended)** — scoped `Variables: read/write` permission, a tiny serverless
    backend (Amplify function / Lambda) holds the app key and brokers the REST calls. Cleanest,
    multi-repo, no user-pasted tokens.
  - **OAuth web flow** — user signs in with GitHub; the page acts with their permissions. Good for solo.
  - **Fine-grained PAT** — simplest to prototype, least secure (token lives client-side); fine for a
    private personal tool, not for anything shared.
- **What it does:** GET the current `PIPELINE_CONFIG` (org or repo) via
  `GET /repos/{owner}/{repo}/actions/variables/PIPELINE_CONFIG` (or the org variables endpoint),
  render a toggle per stage + numeric fields, PUT the updated JSON back. A repo picker lets you
  manage many projects; an "edit org default" mode steers all of them.
- **Validation:** the UI validates against the JSON schema before PUT, so a malformed config can't
  be written.

---

## Integrations & access (set these up so agents can act)

### Credentials & integrations to provision

| Integration                       | Used by                                      | Where it lives                                                     | Scope                                   |
| --------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `ANTHROPIC_API_KEY`               | All CI Claude agents                         | Account/org GitHub **secret**                                      | API-rate (separate credit pool, §4)     |
| `OPENAI_API_KEY` _(when enabled)_ | Codex PR review + computer-use QA            | GitHub secret                                                      | Only if Codex toggles on                |
| `SLACK_WEBHOOK_URL`               | Notifications → `#pipeline`                  | GitHub secret                                                      | Incoming webhook                        |
| **GitHub App** (control UI)       | The deployed toggle UI                       | App private key in the UI's serverless backend (Lambda/Amplify fn) | `Variables: read/write` only            |
| **GitHub OIDC → IAM role**        | GitHub Actions AWS deploys                   | Per-account IAM role, trust-scoped to repo+branch                  | Least-privilege deploy (no static keys) |
| `gh` CLI auth                     | Local agents (issues, PRs, board, variables) | Local keychain                                                     | Your account                            |
| **AWS IAM Identity Center (SSO)** | Local agent AWS access                       | `aws sso login` → temp creds                                       | Per permission set                      |

### Where to set up AWS interaction for agents

Two separate paths — keep them distinct:

- **CI agents (GitHub Actions):** GitHub **OIDC → assume a per-env IAM role**. No long-lived keys.
  Defined in `AWS_INFRA_SETUP.md` §9. This is how deploy/migrate steps touch AWS.
- **Local agents (Claude Code in your terminal):** run `aws sso login` to get temporary credentials,
  then the agent uses the `aws` CLI via Bash — or wire an **AWS MCP server** so the agent gets
  scoped, typed AWS tools instead of raw shell. The MCP route is cleaner and easier to constrain.

**Blast-radius rules for agent AWS access (non-negotiable):**

- Give agents a **read-only role across all envs** + **write only in INT**.
- **Never grant an autonomous agent prod write.** PROD/UAT deploys go through **GitHub Environment
  protection with a required human reviewer** (playbook principle: agents inform, humans ship).
- Secrets live in **Secrets Manager / SSM**; agents see the _names_, never the values.
- Use a dedicated `agent-*` IAM role, separate from your human SSO permission set.

### What else to set up

- [ ] **GitHub Environments** (`int`/`uat`/`prod`) with protection rules + required reviewer on `prod`.
- [ ] **MCP servers for local agents:** GitHub MCP (issues/PRs/variables), AWS MCP (infra/observability), plus any already-connected ones you use (Notion/TickTick).
- [ ] **Graphify**: initial `--mode deep` build + the `update-knowledge-graph` workflow on merge.
- [ ] **Cost guardrails:** AWS Budgets + CloudWatch alarms → Slack.
- [ ] **Dependency automation:** Dependabot/Renovate (complements the dependency-audit agent).
- [ ] **Domain & TLS:** Route 53 + ACM (+ SES if the app sends email).
- [ ] **Observability read access** for agents (CloudWatch Logs/Metrics read) so they can help debug.

---

## Phase 0 — Lock the design (now)

- [ ] Commit the design docs to a branch (`PIPELINE_PLAYBOOK`, `AWS_INFRA_SETUP`, `GITHUB_DOTFILES_REPO_CHECKLIST`, `BUILD_ROADMAP`, `SAMPLE_SETUP_LOG`).
- [ ] Resolve open decisions in the log: AWS account model, IaC tool (CDK vs Terraform), coverage thresholds.

## Phase 1 — Control plane

- [ ] Define the `PIPELINE_CONFIG` JSON schema (`pipeline.schema.json`) — used by the UI to validate.
- [ ] Seed the **org-level** `PIPELINE_CONFIG` variable with sensible Next.js defaults (`gh variable set --org`).
- [ ] Build the deployed control UI (SPA + GitHub App auth) — toggles + numeric fields + repo picker.
- [ ] Add the `record` + `gate` jobs and the per-stage `if: fromJSON(vars.PIPELINE_CONFIG)...` gating to `pipeline.yml`.
- [ ] Add the convention + coverage rule: `CLAUDE.md` Conventions line + `vitest.config.ts` `coverage.thresholds`.

## Phase 2 — Reusable modules in `suyash21101/.github`

Follow `GITHUB_DOTFILES_REPO_CHECKLIST.md` end to end:

- [ ] Create the `.github` repo; author one `workflow_call` module per stage.
- [ ] Tag `v1` (moving major tag).
- [ ] Set account-level secrets (`ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`).
- [ ] Point the template's `pipeline.yml` jobs to `uses: suyash21101/.github/...@v1`.
- [ ] Smoke-test from a throwaway repo: secrets inherit, a disabled stage skips, `gate` passes, the UI flips a toggle and the next run honors it.

## Phase 3 — First real project bootstrap

- [ ] `gh repo create <project> --template suyash-project-template --clone`.
- [ ] `bash scripts/setup-project.sh` (branches, labels, sprint board, branch protection).
- [ ] Set branch protection's single required check to `gate`.
- [ ] (Optional) set a repo-level `PIPELINE_CONFIG` override where the org default doesn't fit.
- [ ] Customize `CLAUDE.md`; `claude "/graphify . --mode deep"` for the initial knowledge graph.

## Phase 4 — AWS infrastructure

Follow `AWS_INFRA_SETUP.md` §16 checklist:

- [ ] Accounts/SSO/OIDC → CDK bootstrap → network → data (Aurora) → auth (Cognito + RLS rewrite) → storage → compute (Amplify or Fargate) → DNS/TLS/WAF.
- [ ] Wire `aws-deploy.yml` with `compute_mode` from `fromJSON(vars.PIPELINE_CONFIG).deploy.mode`.
- [ ] Promote schema INT → UAT → PROD.

## Phase 5 — Agents online

- [ ] CI agents (pr-review, security, regression, migration-safety, sanity, dependency-audit, stale-pr) live via the modules, each toggleable in `PIPELINE_CONFIG`.
- [ ] Local agent-team workflow (orchestrator → implementer + test-writer + self-reviewer, Outcomes-driven; playbook §16.1).
- [ ] `/ultrareview <PR#>` on staging→main; Codex computer-use QA on UAT.

## Phase 6 — Observability & polish

- [ ] CloudWatch alarms + AWS Budgets → Slack `#pipeline`.
- [ ] Weekly digest workflow.
- [ ] End-of-sprint Dreaming pass on the local memory store.
- [ ] Retro: which stages stayed off, which agents earned their cost.

---

## Decisions baked into this roadmap (overridable)

| Decision                | Chosen                                           | Why                                                 | Override if…                                                                             |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Config store            | GitHub Actions **Variables** (`PIPELINE_CONFIG`) | native, free, org-wide, no infra                    | want validation/rollout → AWS AppConfig; want rich history/multi-repo matrix → custom DB |
| Config timing           | **runtime-fetched**                              | change toggles without a commit, instant            | need strict reproducibility → git-tracked file + UI commits                              |
| Control UI hosting      | static SPA on Amplify (or Pages) + GitHub App    | matches AWS direction, scoped auth, no token sprawl | solo prototype → OAuth flow or fine-grained PAT                                          |
| Required check strategy | single `gate` aggregator job                     | disable any stage without blocking merges           | prefer each check individually required                                                  |
| Module hosting          | `suyash21101/.github` reusable workflows         | central, versioned, idiomatic                       | multi-project shared infra → dedicated pipeline repo                                     |

---

> **Status:** roadmap + control-plane design only. No code written yet. Phase 1 (the `PIPELINE_CONFIG`
> schema, the orchestrator gating, and the deployed control UI) is the natural first build — say the
> word and that becomes the implementation task, with a spec + plan ahead of it.
