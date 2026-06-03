# QuantLab Pipeline — User Manual

> Day-to-day guide to the CI/CD pipeline: how to use it, what runs, how to toggle
> stages, and how deployment to AWS works. Status figures reflect the live state as
> of 2026-06-03. See also `docs/PIPELINE_PLAYBOOK.md` (deep reference) and
> `docs/BUILD_ROADMAP.md` (build-out history).

## TL;DR (the one honest headline)

The pipeline has **two halves**: **CI** (checks every PR) and **CD** (builds + deploys to
AWS). The CI half is **live and running** on this repo. The CD half is **fully built but
has never fired** — **nothing is deployed in AWS yet.** What exists in AWS today is only
the _plumbing_ (an IAM identity, an OIDC trust, a deploy role, a budget). Zero containers,
zero ECS, zero ECR images. That is by design — deploying is gated on E3 (containerization)
and Part A (AWS infra).

---

## 1. The mental model: two repos + one gate

```
┌─────────────────────────────────────┐         ┌──────────────────────────────────┐
│  suyash21101/.github                │  uses:  │  APP REPO (caller)               │
│  "the engine room"                  │ ◄────── │  - suyash-project-template (live)│
│                                     │  @v1.3.0│  - quantlab-wealth (not wired)   │
│  Reusable workflow MODULES:         │         │                                  │
│   lint, typecheck, test, build,     │         │  .github/workflows/pipeline.yml  │
│   security-scan, migration-safety,  │         │   = thin orchestrator that calls │
│   docker-build-push, aws-deploy …   │         │     the modules + a `gate` job   │
│  Versioned & released (v1.3.0)      │         │  pipeline.config.default.json    │
└─────────────────────────────────────┘         └──────────────────────────────────┘
```

**Why two repos?** The modules are written once, versioned, and _reused_ by every app
repo. The app repo only says "run `lint@v1.3.0`" — it does not carry the logic. Upgrade
the engine room once, every caller benefits.

**The golden rule — one required check: `gate`.** Branch protection requires _only_
`gate`. Every stage reports into it. A disabled or skipped stage counts as a **pass**, so
turning stages on/off never breaks the merge button. Merge when `gate` is green.

---

## 2. PART ONE — CI: the day-to-day developer manual

### The loop

```
1. git checkout -b feature/<issue#>-<slug>     ← never commit to develop/staging/main
2. ...write code, commit...
3. git push  →  open PR into develop
4. Pipeline fires automatically. Watch the `gate` check.
5. gate green  →  merge.   gate red  →  open the failing stage, read log, fix, push.
6. Flow: feature → develop → staging → main
```

### What runs on every PR

| Stage                | Type     | Status | What it does                                                                                     |
| -------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------ |
| **lint**             | gated    | on     | ESLint / formatting                                                                              |
| **typecheck**        | gated    | on     | TypeScript types                                                                                 |
| **test**             | gated    | on     | Vitest, **coverage floor 80%** (frontend only — Python has no CI tests yet, known gap)           |
| **build**            | gated    | on     | Production build must succeed                                                                    |
| **security_scan**    | gated    | off†   | Claude scans the diff for vulns; blocks on `critical`. **Temporarily disabled** — see note below |
| **migration_safety** | gated    | on\*†  | Claude reviews DB migrations — only runs if `sql/**` or `**/migrations/**` changed               |
| **prisma_validate**  | gated    | off    | Disabled (wrong stack — we are Django, not Prisma)                                               |
| **pr_review**        | advisory | off    | Claude code review (comments, never blocks)                                                      |
| **regression**       | advisory | off    | Claude regression hunt                                                                           |
| **bundle_size**      | advisory | off    | Frontend bundle budget                                                                           |

`*` The Claude stages need Claude auth to run. It is configured via a `CLAUDE_CODE_OAUTH_TOKEN`
secret (Claude subscription, no per-API bill). If the token is absent, those stages skip
cleanly instead of failing.

`†` **Known issue (2026-06-03):** `claude-code-action@v1` needs `id-token: write` permission
(or a passed `github_token`), which the Claude module jobs don't currently grant — so once
Claude auth is configured, these stages fail with _"Could not fetch an OIDC token."_ Because
`security_scan` is gated and runs on every PR, that failure blocks the gate. It is therefore
**disabled** until the modules are patched (add `id-token: write` + `github_token`, release
`v1.3.1`, re-enable). `migration_safety` has the same bug but is path-filtered, so it only
bites on migration PRs.

**Gated vs advisory:** gated stages can _block_ a merge (they feed `gate`). Advisory stages
run and leave comments but **never block** — they are deliberately excluded from `gate`.

### How to turn stages on/off (no code change needed)

Two layers, checked in this order:

1. **`PIPELINE_CONFIG`** — a GitHub Actions _variable_ on the repo. If set, it wins.
2. **`pipeline.config.default.json`** — committed fallback. This drives the pipeline today.

To flip a stage, edit the JSON:

```jsonc
"pr_review": { "enabled": true, "model": "sonnet" }   // turn the Claude reviewer on
"test":      { "enabled": true, "coverage_min": 80 }  // raise/lower the coverage floor
```

…or set the `PIPELINE_CONFIG` variable for a runtime override without a commit.

### Secrets & variables (the control panel)

| Name                      | Kind     | Purpose                                          |
| ------------------------- | -------- | ------------------------------------------------ |
| `CLAUDE_CODE_OAUTH_TOKEN` | secret   | Powers Claude stages via the Claude subscription |
| `SLACK_WEBHOOK_URL`       | secret   | Weekly digest → Slack                            |
| `PIPELINE_CONFIG`         | variable | Optional runtime stage overrides                 |
| `DEPLOY_ENABLED`          | variable | **The master switch for CD (off → no deploys)**  |
| `AWS_DEPLOY_ROLE_ARN`     | variable | Which AWS role GitHub assumes (for CD)           |

### Background jobs (cron)

These only fire from the **default branch (`main`)** — a GitHub constraint, which is why
the pipeline is promoted to `main`:

- **weekly-digest** — Sun 18:00 UTC → Slack
- **dependency-audit** — Sun 00:00 UTC
- **stale-pr-check** — weekdays 09:00 UTC
- **knowledge-graph** — refreshes `graphify-out/` on every push to `develop`

---

## 3. PART TWO — CD & AWS: where it deploys, and how it works

### Current state: nothing is deployed yet

AWS account `953693831977`, region `ap-south-1`:

```
ECR repositories : []          ← no container images
ECS clusters     : []          ← nothing running
```

**What IS in AWS today (plumbing only):**

| Resource       | Value                                 | Purpose                                                  |
| -------------- | ------------------------------------- | -------------------------------------------------------- |
| IAM admin user | `suyash-admin`                        | Day-to-day identity (root retired)                       |
| OIDC provider  | `token.actions.githubusercontent.com` | Lets GitHub Actions log into AWS **without stored keys** |
| Deploy role    | `quantlab-gha-deploy`                 | The role GitHub _assumes_ to push images + deploy        |
| Budget         | `quantlab-monthly-cost` = **$30/mo**  | Email alerts at 50/80/100%                               |

The account is _ready to receive_ a deploy, but no deploy has happened.

### How deployment works (once switched on) — keyless OIDC

There are **no AWS access keys stored in GitHub.** Instead:

```
GitHub Action starts
   │  1. GitHub mints a short-lived OIDC token ("I am the deploy job
   │     for repo quantlab-wealth, branch main")
   ▼
AWS STS  ── checks the token against the trust policy on quantlab-gha-deploy ──►  OK
   │       (trust is scoped to ONLY the two known repos; nobody else can assume it)
   ▼
AWS returns temporary credentials (valid ~1 hour, then gone)
   │
   ▼
The job uses them to:  push image → ECR   then   deploy → ECS
```

No long-lived secret to leak; the credential evaporates after each run.

### The deploy DAG (`deploy.yml`, when enabled)

```
        ┌─────────────┐
        │ guard       │  ← checks DEPLOY_ENABLED == "true". If not → everything skips.
        └─────┬───────┘     Maps branch → env:  develop→int, staging→uat, main→prod
              │
      ┌───────┴────────┐
      ▼                ▼
 build_web        build_scalping        (docker build → push to ECR: quantlab/web, quantlab/scalping)
      │                │
      ▼                │
 deploy_web (fargate)  │   ← runs `manage.py migrate` ONCE, then rolling deploy of Django web
      │                │
      ├──────┐         │
      ▼      ▼         ▼
 deploy_worker   deploy_scalping (fargate-leader)
 (celery, NO     ← rolls under an S3 leader-lease, NEVER migrates
  migrate)          (a killable trading engine must not double-fire orders)
```

Three deploy modes in the `aws-deploy` module:

- **`fargate`** — Django web: migrate-once → rolling deploy → wait until stable.
- **`fargate-leader`** — scalping engine: only one leader runs at a time (S3 lease), never
  migrates. The safety-critical mode for real-money order flow.
- **`amplify`** — legacy static-hosting mode (not used here).

### Why CD is deliberately OFF right now

`deploy.yml` opens with a `guard` job: unless repo variable **`DEPLOY_ENABLED=true`**, every
deploy job short-circuits. It is loaded but safetied. Actually deploying needs four things
that do not exist yet:

1. **Dockerfiles** for web + engine → **E3** (containerization)
2. **ECR repos** `quantlab/web`, `quantlab/scalping` → E3
3. **ECS cluster + services + networking** (VPC, subnets, security groups) → **Part A**
4. Set `DEPLOY_ENABLED=true` + the `AWS_*` variables → the final flip

---

## 4. Current status & what's next

| Layer                                                | State                                 |
| ---------------------------------------------------- | ------------------------------------- |
| CI (lint/type/test/build/security/migration)         | **Live** on `suyash-project-template` |
| Claude stages (subscription token)                   | Configured                            |
| Slack digest                                         | Live                                  |
| AWS plumbing (IAM / OIDC / role / budget)            | Provisioned                           |
| CD plane (build-push + deploy modules)               | Authored & wired, **inert**           |
| Actual AWS deployment                                | **None — nothing running**            |
| Pipeline wired into the real app (`quantlab-wealth`) | Not yet → **E3.0**                    |

**Next step (E3):** containerize → create ECR repos → first images build on merge (still no
deploy). Then **Part A** stands up ECS, and the final `DEPLOY_ENABLED=true` lights it up.

---

## Quick reference

```
Merge rule ............ gate green = mergeable. Only `gate` is required.
Start work ............ git checkout -b feature/<issue#>-<slug>
Toggle a CI stage ..... edit pipeline.config.default.json  (or set PIPELINE_CONFIG var)
Turn on deploys ....... set repo var DEPLOY_ENABLED=true (needs E3 + Part A first)
AWS identity .......... user/suyash-admin   acct 953693831977   ap-south-1
Deploy auth ........... OIDC → assume role quantlab-gha-deploy (no stored keys)
Budget guard .......... $30/mo, alerts at 50/80/100%
```
