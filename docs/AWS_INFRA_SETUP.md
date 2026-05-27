# AWS Infrastructure Setup (Full AWS-Native)

> Reference for standing up a new project's infrastructure on AWS, replacing the
> Supabase + Vercel stack from `PIPELINE_PLAYBOOK.md` with AWS-native services.
> Covers **two compute options** (Amplify Hosting and ECS Fargate) — pick one per project.
> Decisions and rationale are tracked in `SAMPLE_SETUP_LOG.md`.

**Stack target:** Aurora PostgreSQL + Amazon Cognito + S3 + (Amplify Hosting _or_ ECS Fargate),
fronted by CloudFront + Route 53, deployed via GitHub Actions using OIDC (no long-lived keys).

---

## Table of Contents

1. [Service Mapping: Supabase/Vercel → AWS](#1-service-mapping)
2. [Account & Environment Model](#2-account--environment-model)
3. [Networking (VPC)](#3-networking-vpc)
4. [Data Layer — Aurora PostgreSQL](#4-data-layer--aurora-postgresql)
5. [Auth — Amazon Cognito (and the RLS question)](#5-auth--amazon-cognito)
6. [Storage — S3](#6-storage--s3)
7. [Compute Option A — Amplify Hosting](#7-compute-option-a--amplify-hosting)
8. [Compute Option B — ECS Fargate + ALB](#8-compute-option-b--ecs-fargate--alb)
9. [Secrets & GitHub OIDC](#9-secrets--github-oidc)
10. [Infrastructure as Code (CDK)](#10-infrastructure-as-code-cdk)
11. [CI/CD Integration](#11-cicd-integration)
12. [DNS, TLS & CDN](#12-dns-tls--cdn)
13. [Observability](#13-observability)
14. [Database Migrations & Env Parity](#14-database-migrations--env-parity)
15. [Cost Estimate](#15-cost-estimate)
16. [Setup Checklist (Order of Operations)](#16-setup-checklist)

---

## 1. Service Mapping

| Concern         | Supabase/Vercel (playbook) | AWS-native (this doc)                           |
| --------------- | -------------------------- | ----------------------------------------------- |
| App hosting     | Vercel                     | Amplify Hosting **or** ECS Fargate + ALB        |
| Postgres DB     | Supabase Postgres          | Aurora PostgreSQL (Serverless v2)               |
| Auth            | Supabase Auth + RLS        | Amazon Cognito + Postgres RLS (JWT-claim wired) |
| Object storage  | Supabase Storage           | Amazon S3                                       |
| Secrets         | Vercel env vars            | Secrets Manager / SSM Parameter Store           |
| CDN             | Vercel edge                | CloudFront                                      |
| DNS             | Vercel domains             | Route 53 + ACM                                  |
| Preview deploys | Vercel per-branch          | Amplify branches **or** per-env Fargate service |
| Cron jobs       | —                          | EventBridge Scheduler → Lambda                  |
| Logs/metrics    | Vercel + Supabase logs     | CloudWatch Logs + Metrics + Alarms              |

---

## 2. Account & Environment Model

The playbook's three environments (INT/UAT/PROD) map to **three isolated AWS accounts** under
AWS Organizations. Account-level isolation is the strongest blast-radius boundary — a mistake in
INT cannot touch PROD data or billing.

```
AWS Organization (management account — billing, SSO, SCPs only)
├── project-int   (account)   ← develop branch
├── project-uat   (account)   ← staging branch
└── project-prod  (account)   ← main branch
```

- Use **AWS IAM Identity Center (SSO)** for human access across accounts.
- Apply **Service Control Policies** (e.g. deny region except `us-east-1`, deny root usage).
- **Lighter alternative (solo, cost-sensitive):** one account, three CDK stacks
  (`AppStack-int|uat|prod`) with resources tagged + named per env. Loses account isolation but
  zero Organizations overhead. Start here if multi-account SSO is too much; graduate to
  multi-account before real users hit PROD.

> **Decision to confirm:** multi-account (recommended for PROD isolation) vs single-account-multi-stack.

---

## 3. Networking (VPC)

One VPC per environment (per account, or per stack in single-account mode):

```
VPC (10.0.0.0/16)
├── Public subnets   (2 AZs)  → ALB / NAT Gateway / CloudFront origin
├── Private subnets  (2 AZs)  → Fargate tasks / Lambda
└── Isolated subnets (2 AZs)  → Aurora (no internet route)
```

- Aurora lives in **isolated subnets** — reachable only from the app security group.
- Security groups: ALB SG (443 from internet) → App SG (app port from ALB SG) → DB SG (5432 from App SG).
- One **NAT Gateway** per env for outbound (package installs, OAuth callbacks). NAT is a notable
  cost line — in single-account dev mode, a single NAT can be shared.
- Amplify Hosting (Option A) is managed and does not require you to run the app inside the VPC; if
  the app needs private DB access from Amplify, use Amplify's VPC connector or front the DB with
  RDS Proxy + an authenticated data API.

---

## 4. Data Layer — Aurora PostgreSQL

**Aurora PostgreSQL Serverless v2** — scales ACU up/down with load, scales near-zero when idle
(good for INT/UAT), and gives you standard Postgres (so the playbook's numbered `sql/` migrations
and Prisma schema port over almost unchanged).

- **Engine:** PostgreSQL-compatible Aurora, same major version across all three envs (parity).
- **Capacity:** INT/UAT min 0.5 ACU; PROD min 1–2 ACU with auto-scaling, Multi-AZ.
- **Connection pooling:** serverless/Lambda compute exhausts Postgres connections fast — put
  **RDS Proxy** in front. For Fargate with a long-lived process, Prisma's pool is usually enough,
  but RDS Proxy still helps on failover.
- **Backups:** automated snapshots (7-day INT/UAT, 30-day PROD), enable PITR on PROD.
- **Migrations:** `sql/001-*.sql` etc. run via a migration job (see §14). Never edit schema by hand.

`DATABASE_URL` per env points at the Aurora writer endpoint (or the RDS Proxy endpoint).

---

## 5. Auth — Amazon Cognito

This is the biggest departure from Supabase. **Supabase Auth + RLS** becomes **Cognito + Postgres RLS**.

**Cognito User Pool (one per env):**

- Hosted UI or custom screens; OAuth providers (Google, Apple) as **federated identity providers**
  — INT/UAT use test OAuth credentials, PROD uses production credentials (mirrors the playbook).
- App client issues JWTs (ID + access tokens). Callback URL = your app's `/auth/callback` route.
- Map Google/Apple to Cognito IdP; Cognito becomes the single token issuer your app trusts.

**RLS still works — but you must wire the claims yourself.** Supabase auto-injected the user's
JWT into Postgres so `auth.uid()` worked in RLS policies. Plain Aurora Postgres has no `auth.uid()`.
Two options:

1. **App-set session claims (recommended):** on each request, the server validates the Cognito JWT,
   opens a DB transaction, and runs `SET LOCAL app.user_id = '<cognito-sub>'`. RLS policies reference
   `current_setting('app.user_id')` instead of `auth.uid()`. Rewrite policies accordingly.
2. **App-layer authorization:** enforce access in the API layer, keep RLS as defense-in-depth only.

> **Migration note:** every RLS policy that used `auth.uid()` / `auth.role()` must be rewritten to
> `current_setting('app.*')`. Budget for this — it's the main porting cost from Supabase.

---

## 6. Storage — S3

- One bucket per env (`project-int-assets`, etc.), Block Public Access ON.
- Serve via **CloudFront** with Origin Access Control — never public-read buckets.
- Uploads: presigned PUT URLs minted by an authenticated API route (replaces Supabase Storage SDK).
- Lifecycle rules to expire temp/upload prefixes.

---

## 7. Compute Option A — Amplify Hosting

Closest to the Vercel developer experience; least ops. Best default unless you need container control.

- **Branch mapping** (mirrors the playbook's env model):
  | Amplify branch | Environment | Domain |
  |---|---|---|
  | `main` | PROD | apex / `www` |
  | `staging` | UAT | `staging.<domain>` |
  | `develop` | INT | `dev.<domain>` (or auto preview) |
- **Per-branch env vars** scoped in Amplify console (or `amplify.yml`): `DATABASE_URL`,
  `COGNITO_*`, `S3_BUCKET`, `NEXT_PUBLIC_*`. Same pattern as the playbook's Vercel section, just
  in Amplify.
- **SSR:** Amplify Hosting supports Next.js App Router SSR/ISR natively.
- **Build:** `amplify.yml` runs `npm ci && npm run build`. Connect the GitHub repo; Amplify deploys
  on push to mapped branches.
- **DB access:** if the app must reach Aurora privately, use the Amplify VPC connector; otherwise
  expose Aurora via RDS Proxy with TLS and tight SGs.

When to pick A: solo/small team, want managed previews, don't need custom runtime/sidecars.

---

## 8. Compute Option B — ECS Fargate + ALB

Full control, standard for scaling and custom runtimes. More to own.

- **Container:** `Dockerfile` building the Next.js standalone output (`output: 'standalone'` in
  `next.config.ts`), pushed to **ECR** (one repo, tags per env or per commit SHA).
- **Service:** ECS Fargate service per env, behind an **Application Load Balancer** (HTTPS via ACM).
- **Task def:** CPU/mem per env (INT 0.25vCPU/0.5GB; PROD 1vCPU/2GB+, desired count ≥2 for HA).
- **Autoscaling:** target-tracking on CPU/requests; scale-in to 1 task on INT/UAT off-hours.
- **Secrets:** injected from Secrets Manager into the task definition (not baked into the image).
- **Deploy:** GitHub Actions builds + pushes to ECR, then `aws ecs update-service` (or CodeDeploy
  blue/green for PROD). See §11.
- **DB access:** tasks run in private subnets, reach Aurora in isolated subnets via the DB SG.

When to pick B: need containers/sidecars, custom system deps, fine-grained scaling, or
multi-service architecture later.

> **Per-project choice:** A and B are mutually exclusive for a given app. Document the pick in that
> project's CLAUDE.md and `infra/`.

---

## 9. Secrets & GitHub OIDC

**No long-lived AWS keys in GitHub.** Use GitHub OIDC → assume an IAM role:

1. Add GitHub's OIDC provider to each AWS account.
2. Create a deploy role per env with a trust policy scoped to `repo:OWNER/REPO:ref:refs/heads/<branch>`
   and least-privilege permissions (ECR push, ECS update, Amplify start-deployment, etc.).
3. In workflows: `aws-actions/configure-aws-credentials@v4` with `role-to-assume`. No `aws_access_key_id`.

**App secrets** live in **Secrets Manager** (rotatable: DB creds, Cognito client secret) and
**SSM Parameter Store** (cheap config: bucket names, URLs). Compute reads them at runtime/deploy —
never commit them. `.env.example` documents the names only.

---

## 10. Infrastructure as Code (CDK)

**Tool: AWS CDK (TypeScript)** — keeps one language across app + infra, type-safe, AWS-native.
(Terraform is the portable alternative if you expect multi-cloud; pick one per the log.)

Per the repo decision, **IaC lives in each project's `infra/` directory** (shared CI reusable
workflows live in the user-level `.github` repo — see §11).

```
infra/
├── bin/app.ts                # entrypoint: instantiates one stack per env
├── lib/
│   ├── network-stack.ts      # VPC, subnets, SGs
│   ├── data-stack.ts         # Aurora, RDS Proxy
│   ├── auth-stack.ts         # Cognito user pool + IdPs
│   ├── storage-stack.ts      # S3 + CloudFront
│   ├── compute-stack.ts      # Amplify app OR Fargate service (flag-driven)
│   └── pipeline-roles.ts     # GitHub OIDC role + policies
├── cdk.json
└── package.json
```

- One stack instance per env, parameterized by an `env` context (`cdk deploy -c env=int`).
- Compute stack takes a `computeMode: 'amplify' | 'fargate'` prop so the same IaC serves both options.
- `cdk diff` runs in CI on infra PRs; `cdk deploy` runs only from the env's deploy role.

---

## 11. CI/CD Integration

Shared logic lives as **reusable workflows in `suyash21101/.github`**, referenced by tag:

```yaml
# in a project repo: .github/workflows/deploy.yml
jobs:
  deploy:
    uses: suyash21101/.github/.github/workflows/aws-deploy.yml@v1
    with:
      environment: ${{ github.ref_name }} # develop|staging|main
      compute_mode: fargate # or amplify
    secrets: inherit
```

The reusable `aws-deploy.yml`:

1. `configure-aws-credentials` via OIDC (role per env).
2. **Amplify mode:** `aws amplify start-job --branch <branch>` (or rely on Amplify's auto-build).
3. **Fargate mode:** build → push to ECR → `aws ecs update-service` (blue/green via CodeDeploy on PROD).
4. Run DB migrations (§14) before traffic shift.
5. Post-deploy: trigger the existing `claude-sanity-check` + Slack notify.

Branch → env → account is driven entirely by the calling workflow's `environment` input, so the
same reusable workflow serves all three environments.

---

## 12. DNS, TLS & CDN

- **Route 53** hosted zone for the apex domain (in the PROD account; delegate subdomains to env accounts or use one zone with env subdomains).
- **ACM** certs (us-east-1 for CloudFront). Auto-renew.
- **CloudFront** in front of Amplify/ALB for caching, WAF attach point, and a single edge.
- **AWS WAF** on CloudFront for PROD (rate limiting, managed rule sets) — defense layer the
  Supabase/Vercel setup got implicitly.

---

## 13. Observability

- **CloudWatch Logs**: app logs (Fargate via awslogs driver; Amplify built-in), Aurora logs.
- **CloudWatch Metrics + Alarms**: 5xx rate, ALB target health, Aurora CPU/connections, Fargate
  CPU/mem. Alarms → SNS → the same Slack `#pipeline` channel from the playbook.
- **X-Ray** (optional) for request tracing once there are multiple services.
- **Budgets**: AWS Budgets alert at thresholds per account — catches runaway cost early.

---

## 14. Database Migrations & Env Parity

Same discipline as the playbook (§2 Database Parity), AWS mechanics:

1. Numbered `sql/0NN-*.sql` migrations are the source of truth; Prisma schema validated against them in CI.
2. A **migration job** (one-off ECS task, or a Lambda, or a CI step that connects via the deploy
   role through a bastion/SSM tunnel) applies pending migrations to that env's Aurora.
3. Order: **INT → UAT → PROD**, each gated behind its branch promotion.
4. The `claude-migration-safety` agent reviews lock risk / rollback / data-loss before merge — unchanged.

---

## 15. Cost Estimate

Rough monthly, AWS-native, low-traffic solo project (USD):

| Item                  | INT   | UAT   | PROD    | Notes                                      |
| --------------------- | ----- | ----- | ------- | ------------------------------------------ |
| Aurora Serverless v2  | ~$5   | ~$5   | ~$45    | PROD min ACU + Multi-AZ                    |
| Compute (Amplify)     | ~$0–5 | ~$0–5 | ~$15–30 | build minutes + hosting                    |
| Compute (Fargate alt) | ~$10  | ~$10  | ~$40+   | always-on tasks + ALB                      |
| NAT Gateway           | ~$32  | ~$32  | ~$32    | per env; biggest fixed cost — share in dev |
| S3 + CloudFront       | ~$1   | ~$1   | ~$5     | traffic-dependent                          |
| Cognito               | $0    | $0    | $0–ε    | free tier covers low MAU                   |
| Route 53 + ACM        | —     | —     | ~$1     | ACM free; zone $0.50                       |
| **Approx total**      |       |       |         | **~$120–220/mo** before app traffic        |

> NAT Gateways dominate fixed cost. In single-account dev mode, collapse to one NAT to cut ~$64/mo.
> This is meaningfully higher than the Supabase+Vercel baseline (~$45 infra) — the trade is full
> control + isolation. Revisit Amplify-only + shared NAT to keep INT/UAT cheap.

---

## 16. Setup Checklist

Order of operations for a new project on AWS:

1. [ ] Create AWS Organization + INT/UAT/PROD accounts (or decide single-account mode).
2. [ ] Enable IAM Identity Center (SSO); create permission sets.
3. [ ] Add GitHub OIDC provider + deploy roles per account (§9).
4. [ ] Scaffold `infra/` CDK app; bootstrap CDK in each account (`cdk bootstrap`).
5. [ ] Deploy network stack (VPC) per env.
6. [ ] Deploy data stack (Aurora + RDS Proxy); run `sql/001-*.sql` on INT.
7. [ ] Deploy auth stack (Cognito + Google/Apple IdPs); rewrite RLS policies to `current_setting` (§5).
8. [ ] Deploy storage stack (S3 + CloudFront).
9. [ ] Deploy compute stack — Amplify (§7) **or** Fargate (§8).
10. [ ] Configure Route 53 + ACM + CloudFront + WAF (§12).
11. [ ] Wire CI: reference `suyash21101/.github` reusable `aws-deploy.yml`; set `compute_mode`.
12. [ ] Set secrets in Secrets Manager / SSM; populate per-branch config.
13. [ ] Promote schema INT → UAT → PROD (§14).
14. [ ] Set CloudWatch alarms + AWS Budgets → Slack.
15. [ ] Smoke test each env; run the playbook's sanity check against PROD.

---

> **Cross-reference:** this doc replaces §8 (Supabase + Vercel) of `PIPELINE_PLAYBOOK.md` for
> AWS-native projects. The branch model, agent fleet, checks/tests, and Slack integration from the
> playbook are unchanged — only the hosting/data/auth substrate differs.
