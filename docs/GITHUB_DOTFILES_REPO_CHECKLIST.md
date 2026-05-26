# `.github` Repo Setup Checklist

> Build checklist for the user-level **`suyashbhatia/.github`** repo — the central home for
> reusable workflows (the modular pipeline modules from `PIPELINE_PLAYBOOK.md` §17) plus optional
> default community-health files shared across all your repos.
>
> This is the artifact referenced by the open item in `SAMPLE_SETUP_LOG.md`. Do this once; every
> project then references the modules by tag (`uses: suyashbhatia/.github/...@v1`).

---

## A. Repo creation & basics

- [ ] Create the repo named exactly **`.github`** under your account: `gh repo create suyashbhatia/.github --public`
  - Name must be literally `.github` for the profile-README + default-health-file behavior.
  - **Public** is simplest for reusable-workflow sharing. Private works but requires the access toggle in §F.
- [ ] Add a top-level `README.md` describing the repo's purpose (this is _not_ the profile README).
- [ ] Initialize `main` as the default branch.

## B. Directory structure

```
.github/                         (the repo)
├── .github/
│   └── workflows/               # reusable workflow MODULES (workflow_call)
│       ├── lint.yml
│       ├── typecheck.yml
│       ├── test.yml
│       ├── build.yml
│       ├── prisma-validate.yml
│       ├── bundle-size.yml
│       ├── claude-pr-review.yml
│       ├── claude-security-scan.yml
│       ├── claude-regression-check.yml
│       ├── claude-migration-safety.yml
│       ├── claude-sanity-check.yml
│       ├── dependency-audit.yml
│       ├── stale-pr-check.yml
│       ├── update-knowledge-graph.yml
│       ├── weekly-digest.yml
│       └── aws-deploy.yml
├── workflow-templates/          # (optional) starter workflows shown in the GH "New workflow" UI
│   ├── pipeline.yml
│   └── pipeline.properties.json
├── profile/
│   └── README.md                # (optional) shown on your GitHub profile
├── CODEOWNERS                    # default owners (overridden by a repo's own CODEOWNERS)
├── PULL_REQUEST_TEMPLATE.md      # default PR template
├── ISSUE_TEMPLATE/               # default issue templates
├── SECURITY.md                   # default security policy
└── README.md
```

## C. Reusable workflow modules to author

Each is a `on: { workflow_call: { inputs/secrets } }` module lifted from the existing template
workflows. Author and verify each:

- [ ] `lint.yml` — ESLint. Inputs: `enabled`(bool).
- [ ] `typecheck.yml` — `tsc --noEmit`. Inputs: `enabled`.
- [ ] `test.yml` — Vitest + coverage. Inputs: `enabled`, `coverage_min`(number).
- [ ] `build.yml` — `next build`. Inputs: `enabled`.
- [ ] `prisma-validate.yml` — `prisma validate`. Inputs: `enabled`.
- [ ] `bundle-size.yml` — bundle delta vs base. Inputs: `enabled`, `threshold_kb`.
- [ ] `claude-pr-review.yml` — Claude quality review (Sonnet). Secrets: `ANTHROPIC_API_KEY`. Inputs: `model`.
- [ ] `claude-security-scan.yml` — security scan (Sonnet) + Slack-on-CRITICAL. Secrets: `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`.
- [ ] `claude-regression-check.yml` — regression analysis (Sonnet). Inputs: `enabled`.
- [ ] `claude-migration-safety.yml` — schema-change safety (Opus). Inputs: `enabled`.
- [ ] `claude-sanity-check.yml` — post-deploy curl checks (+Slack). Inputs: `prod_url`.
- [ ] `dependency-audit.yml` — `npm audit` + opens issue. Inputs: `schedule`(handled by caller).
- [ ] `stale-pr-check.yml` — flag PRs > N days. Inputs: `days`.
- [ ] `update-knowledge-graph.yml` — `/graphify --update` on merge. Secrets: `ANTHROPIC_API_KEY`.
- [ ] `weekly-digest.yml` — Sunday sprint digest → Slack. Secrets: `SLACK_WEBHOOK_URL`.
- [ ] `aws-deploy.yml` — OIDC + Amplify/Fargate deploy + migrate (see `AWS_INFRA_SETUP.md` §11). Inputs: `environment`, `compute_mode`.

> Each module declares its own `inputs:` and `secrets:`. Consumers pass `secrets: inherit` to forward
> org-level secrets without re-declaring them.

## D. Versioning & release strategy

- [ ] Tag releases with semver: `v1.0.0`, `v1.1.0`, …
- [ ] Maintain a **moving major tag** `v1` that always points at the latest `v1.x` (consumers pin `@v1`).
  - Update it on each release: `git tag -f v1 && git push -f origin v1`.
- [ ] Document breaking changes; bump to `@v2` only when a module's inputs/behavior change incompatibly.
- [ ] (Optional) `CHANGELOG.md` so consumers know what a tag bump brings.

## E. Org/user-level secrets & variables

Set once here (or at account level) so modules and consumers inherit them:

- [ ] `ANTHROPIC_API_KEY` — funds all CI Claude agents (API-rate, per the §4 billing note).
- [ ] `SLACK_WEBHOOK_URL` — `#pipeline` channel notifications.
- [ ] Account **variables** for default flags: `ENABLE_TESTS`, `ENABLE_SECURITY_SCAN`, `ENABLE_REGRESSION`, `ENABLE_E2E` — consumers can override per-repo.
- [ ] AWS deploy is keyless via **OIDC** (no AWS secret here) — roles defined per env in `AWS_INFRA_SETUP.md` §9.

## F. Cross-repo access & permissions

- [ ] If the `.github` repo is **private**: Settings → Actions → General → "Accessible from repositories owned by the user account" → enable, so other repos can `uses:` its workflows. (Public repos need no toggle.)
- [ ] In each **consumer** repo: Settings → Actions → General → Workflow permissions set appropriately (read/write as the jobs need; `pull-requests: write` for review-comment agents).
- [ ] Confirm `secrets: inherit` resolves — consumers must have access to the same account-level secrets.

## G. Default community-health files (optional, nice-to-have)

These apply to any of your repos that _lack_ their own copy:

- [ ] `profile/README.md` — your GitHub profile landing page.
- [ ] `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/` — defaults (the project template overrides these).
- [ ] `CODEOWNERS`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`.
- [ ] `workflow-templates/` — so "New workflow" in any repo offers your `pipeline.yml` starter.

## H. Documentation

- [ ] `README.md` table: each module, its inputs, its required secrets, and a copy-paste `uses:` snippet.
- [ ] A worked example of the consumer `pipeline.yml` orchestrator (mirror §17.2 of the playbook).

## I. Protect the `.github` repo itself

It's now load-bearing for every project — protect it:

- [ ] Branch protection / ruleset on `main`: require PR, require status checks, no force-push.
- [ ] (Optional) a self-test workflow that lint-validates the module YAML on PR.

## J. Validation / smoke test

- [ ] From a throwaway test repo, reference one module (`uses: suyashbhatia/.github/.github/workflows/lint.yml@v1`) and confirm it runs.
- [ ] Verify `secrets: inherit` forwards `ANTHROPIC_API_KEY` to a Claude module.
- [ ] Verify a variable flag (`ENABLE_TESTS=false`) actually skips the test job.
- [ ] Verify the moving `@v1` tag picks up a new release without consumers changing their ref.

## K. Wire a consumer project

- [ ] Replace the project's standalone workflows with a single `pipeline.yml` orchestrator that `uses:` the modules (playbook §17.4).
- [ ] Set per-repo `ENABLE_*` variable overrides where defaults don't fit.
- [ ] Reconcile branch-protection **required check names** with the orchestrator's job names (§7).
- [ ] Open a test PR; confirm the expected modules run, skip, and block correctly.

---

> **Dependencies:** this checklist assumes the per-stage module bodies are lifted from the current
> template workflows (`.github/workflows/*.yml`). Do this when standing up the first real project,
> not before — the required-check names need a live repo to reconcile against.
