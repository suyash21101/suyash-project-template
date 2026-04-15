# CollegeOra Pipeline Playbook

> The definitive guide to setting up an industry-grade development pipeline with Claude AI agents.
> This playbook is designed to be replicable across any project.

---

## Table of Contents

1. [Repository Architecture](#1-repository-architecture)
2. [Branching Strategy & Environments](#2-branching-strategy--environments)
3. [CI/CD Pipeline](#3-cicd-pipeline)
4. [Claude Agent Fleet — All Agent Types](#4-claude-agent-fleet--all-agent-types)
5. [Sprint Board Configuration](#5-sprint-board-configuration)
6. [Story Writing Guide for Agent Compatibility](#6-story-writing-guide-for-agent-compatibility)
7. [Branch Protection Rules](#7-branch-protection-rules)
8. [Environment Setup (Supabase + Vercel)](#8-environment-setup-supabase--vercel)
9. [Knowledge Layer — Graphify](#9-knowledge-layer--graphify)
10. [Stateful Agent Layer — Archon (Future)](#10-stateful-agent-layer--archon-future)
11. [Template Repository Setup](#11-template-repository-setup)
12. [New Project Bootstrap (From Template)](#12-new-project-bootstrap-from-template)
13. [Cost Breakdown](#13-cost-breakdown)
14. [Effectiveness Assessment](#14-effectiveness-assessment)

---

## 1. Repository Architecture

### Repos You Will Have

| Repo | Purpose | Template? |
|---|---|---|
| `suyash-project-template` | The reusable template. Contains all CI/CD workflows, issue templates, PR templates, setup scripts, base CLAUDE.md. You never deploy this — you clone from it. | Yes (GitHub Template) |
| `CollegeOra-frontend` | The Next.js application. All product code, tests, Prisma schema, Supabase config. This is your deployable project. | Created from template |
| Future projects | Any new project you start. Created from the template in one click. Inherits all pipeline config. | Created from template |

### Why Not More Repos?

You might think you need separate repos for infrastructure, shared configs, or a "platform" repo. You don't — not at this scale. Next.js with API routes is a monolith, and monoliths are the right choice until you have a reason to split. The template repo handles the reusability concern.

### Template Repo Structure

```
suyash-project-template/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                         # Core CI: lint, typecheck, test, build
│   │   ├── claude-pr-review.yml           # Claude PR Reviewer agent
│   │   ├── claude-security-scan.yml       # Claude Security Engineer agent
│   │   ├── claude-regression-check.yml    # Claude Regression Tester agent
│   │   ├── claude-sanity-check.yml        # Post-deploy sanity check
│   │   ├── dependency-audit.yml           # Weekly dependency vulnerability scan
│   │   └── stale-pr-check.yml             # Flag PRs open > 3 days
│   ├── ISSUE_TEMPLATE/
│   │   ├── feature.yml                    # Feature story template
│   │   ├── bug.yml                        # Bug report template
│   │   ├── chore.yml                      # Tech debt / infra task
│   │   ├── spike.yml                      # Research / investigation task
│   │   └── config.yml                     # Template chooser configuration
│   ├── PULL_REQUEST_TEMPLATE.md           # PR checklist (auto-populated)
│   └── CODEOWNERS                         # Review assignment rules
├── scripts/
│   ├── setup-project.sh                   # One-shot project bootstrap
│   ├── setup-sprint-board.sh              # Creates GitHub Projects board
│   ├── setup-branch-protection.sh         # Applies branch protection rules
│   └── seed-labels.sh                     # Creates all issue/PR labels
├── docs/
│   └── PIPELINE_PLAYBOOK.md              # This file
├── CLAUDE.md                              # Base agent instructions (customize per project)
├── AGENTS.md                              # Agent-specific overrides
├── .env.example                           # Documents all required env vars
├── .husky/
│   ├── pre-commit                         # Runs lint-staged
│   └── commit-msg                         # Validates commit message format
├── .lintstagedrc.json                     # What lint-staged checks
├── vitest.config.ts                       # Test framework config
├── playwright.config.ts                   # E2E test config
└── ... (framework files — Next.js, package.json, tsconfig, etc.)
```

---

## 2. Branching Strategy & Environments

### Branches

```
main              ← Production. Always deployable. Never commit directly.
  ├── staging     ← UAT. Mirrors what's about to go to prod.
  ├── develop     ← Integration. Where feature branches merge first.
  └── feature/*   ← Individual work. Created per story/issue.
      fix/*
      chore/*
      spike/*
```

### Flow

```
feature/42-google-oauth
    │
    ▼ PR (triggers: CI + Claude PR Review + Claude Security Scan)
develop
    │
    ▼ PR (triggers: CI + Regression Tests + Integration Tests)
staging
    │
    ▼ PR (triggers: CI + Full Regression + E2E Tests)
main
    │
    ▼ Auto-deploy (triggers: Sanity Check post-deploy)
Production
```

### Three Environments

| Environment | Branch | Vercel Deployment | Database | Purpose |
|---|---|---|---|---|
| **INT** | `develop` | Auto preview deploy | Supabase Project: `collegeora-int` | Integration. Features land here first. Unstable is OK. |
| **UAT** | `staging` | Auto preview deploy | Supabase Project: `collegeora-uat` | User acceptance testing. Stable. Mirrors prod schema. |
| **PROD** | `main` | Production deploy | Supabase Project: `collegeora-prod` | Live. Only tested, reviewed code reaches here. |

### Database Parity

All three Supabase projects must have identical schemas. Enforce this by:

1. All schema changes go through `sql/` migration files (numbered: `001-`, `002-`, etc.)
2. CI validates that the Prisma schema matches the SQL migrations
3. The same migration scripts run against all three databases (INT first, then UAT, then PROD)
4. Never make manual schema changes in the Supabase dashboard — always through migration files

---

## 3. CI/CD Pipeline

### Pipeline Stages by Trigger

#### On Every PR (to any protected branch)

```yaml
ci.yml:
  ├── Lint (ESLint)
  ├── Type Check (tsc --noEmit)
  ├── Unit Tests (Vitest)
  ├── Build Check (next build)
  ├── Prisma Validate (prisma validate)
  └── Bundle Size Check (report delta vs base branch)

claude-pr-review.yml:
  └── Claude PR Reviewer (code quality, patterns, conventions)

claude-security-scan.yml:
  └── Claude Security Engineer (OWASP, injection, auth bypass, secrets)
```

#### On PR to `develop`

All of the above, plus:

```yaml
claude-regression-check.yml:
  └── Claude Regression Tester (analyzes what changed, identifies
      what existing functionality could break, runs targeted tests)
```

#### On PR to `staging`

All of the above, plus:

```yaml
  ├── Integration Tests (Vitest, hitting INT database)
  └── E2E Tests (Playwright, against UAT preview deploy)
```

#### On PR to `main`

All of the above, plus:

```yaml
  ├── Full E2E Suite (Playwright, against staging URL)
  └── Manual approval gate (GitHub Environment protection rule)
```

#### Post-Deploy to Production

```yaml
claude-sanity-check.yml:
  └── Claude Sanity Agent (hits production URL, verifies critical
      user paths are working, reports pass/fail to Slack or GitHub)
```

#### Scheduled (Cron)

```yaml
dependency-audit.yml (weekly):
  └── npm audit + Snyk/Socket scan, opens issue if vulnerabilities found

stale-pr-check.yml (daily):
  └── Flags PRs open > 3 days, pings author
```

---

## 4. Claude Agent Fleet — All Agent Types

### Overview

| # | Agent | Trigger | What It Does | Estimated Cost/Run |
|---|---|---|---|---|
| 1 | PR Reviewer | Every PR | Reviews code quality | $0.05–0.30 |
| 2 | Security Engineer | Every PR | Scans for vulnerabilities | $0.05–0.20 |
| 3 | Regression Tester | PR to develop+ | Identifies regression risk | $0.10–0.40 |
| 4 | Sanity Checker | Post-deploy to prod | Verifies critical paths | $0.05–0.15 |
| 5 | Dependency Auditor | Weekly cron | Scans for CVEs | $0.02–0.10 |
| 6 | Developer Agent | Manual / label trigger | Implements stories | $0.50–5.00 |
| 7 | Test Writer | Manual / scheduled | Writes missing tests | $0.20–1.00 |
| 8 | Documentation Agent | Manual | Updates docs from code changes | $0.10–0.30 |
| 9 | Stale Work Monitor | Daily cron | Flags stuck PRs, overdue issues | $0.02–0.05 |
| 10 | Migration Safety Agent | PR with schema changes | Reviews DB migration safety | $0.10–0.30 |

### Agent 1: PR Reviewer

**Trigger:** `pull_request` opened/synchronized
**Action:** Reviews the diff for:
- Code quality and readability
- Adherence to project conventions (from CLAUDE.md)
- Component structure consistency
- Proper error handling at system boundaries
- Unnecessary complexity or premature abstraction
- Missing edge cases

**Output:** Comments directly on the PR with inline suggestions.

**GitHub Action config:**
```yaml
name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          model: sonnet
          prompt: |
            Review this PR for code quality. Focus on:
            1. Does the code follow the conventions in CLAUDE.md?
            2. Are there any logic errors or missed edge cases?
            3. Is the code unnecessarily complex?
            4. Are there any performance concerns?
            
            Be concise. Only comment on things that matter.
            Do NOT nitpick style — the linter handles that.
            Do NOT suggest adding comments or docstrings unless
            the logic is genuinely non-obvious.
```

### Agent 2: Security Engineer

**Trigger:** `pull_request` opened/synchronized
**Action:** Scans for:
- SQL injection (especially raw Supabase queries)
- XSS in React components (dangerouslySetInnerHTML, unescaped user input)
- Auth bypass (missing middleware checks, exposed API routes)
- CSRF vulnerabilities
- Secrets in code (API keys, tokens, passwords)
- Insecure dependencies
- RLS policy gaps (Supabase Row Level Security)
- SSRF in server components
- Open redirect vulnerabilities

**Output:** Security review comment. Blocks merge if severity = critical.

**Prompt focus:**
```
You are a security engineer reviewing a PR for a Next.js + Supabase app.
The app uses Supabase Auth with RLS policies. Check:
1. Are there any API routes missing auth checks?
2. Are Supabase queries using the correct client (server vs anon)?
3. Is user input sanitized before database operations?
4. Are there any secrets or tokens in the code?
5. Do new database operations have corresponding RLS policies?

Rate findings: CRITICAL (blocks merge), HIGH, MEDIUM, LOW, INFO.
```

### Agent 3: Regression Tester

**Trigger:** PR to `develop`, `staging`, or `main`
**Action:**
1. Reads the diff to understand what changed
2. Maps changes to affected features (e.g., "auth callback route changed" → "login flow may be affected")
3. Identifies existing tests that cover the affected areas
4. Flags areas with NO test coverage that are at regression risk
5. If test infrastructure exists, suggests specific test cases to add
6. Runs existing test suite and reports results

**This is different from the CI test run.** The CI runs all tests blindly. The regression agent *thinks* about what could break and whether the test suite actually covers it.

**Prompt focus:**
```
You are a QA engineer performing regression analysis.
Given this PR diff, identify:
1. What existing functionality could this change break?
2. Which existing tests cover the affected areas?
3. What is NOT covered by tests but is at risk?
4. Recommend specific test cases that should be added.

Think about: auth flows, data persistence, navigation,
form validation, API contracts, and state management.
Be specific — name the files and user flows at risk.
```

### Agent 4: Sanity Checker (Post-Deploy)

**Trigger:** After successful deployment to production
**Action:**
1. Hits the production URL
2. Verifies critical user paths:
   - Home page loads (200 status)
   - Auth endpoints respond
   - Onboarding flow is accessible
   - API routes return expected shapes
   - Static assets load (fonts, images)
3. Reports pass/fail

**This is NOT a full test suite.** It's a quick "did we break prod?" check — 30 seconds, 5-10 checks.

**Implementation:** Can be a simple GitHub Action that runs `curl` checks, or a Claude agent that navigates the live site.

```yaml
name: Post-Deploy Sanity
on:
  deployment_status:
    types: [success]

jobs:
  sanity:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Check critical paths
        run: |
          PROD_URL="${{ vars.PRODUCTION_URL }}"
          
          # Homepage
          curl -sf "$PROD_URL" > /dev/null || echo "FAIL: Homepage"
          
          # Auth callback route exists
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/auth/callback")
          [ "$STATUS" -lt "500" ] || echo "FAIL: Auth callback returning 5xx"
          
          # Onboarding accessible
          curl -sf "$PROD_URL/onboarding/welcome" > /dev/null || echo "FAIL: Onboarding"
```

### Agent 5: Dependency Auditor

**Trigger:** Weekly cron (Sunday night)
**Action:**
1. Runs `npm audit`
2. Checks for known CVEs in dependencies
3. Identifies outdated major versions with security implications
4. Opens a GitHub issue with findings (if any)
5. Can optionally create a PR with `npm audit fix` for auto-fixable issues

### Agent 6: Developer Agent

**Trigger:** Manual (you run `claude "Implement #42"`) or GitHub Action on `claude-ready` label
**Action:**
1. Reads the issue for context, acceptance criteria, design references
2. Reads CLAUDE.md for project conventions
3. Creates a feature branch
4. Implements the feature/fix
5. Writes tests for the new code
6. Opens a PR referencing the issue
7. If anything is unclear, comments on the issue asking for clarification BEFORE implementing

**This is your primary "developer."** It picks up groomed stories from the board.

**Label-triggered automation:**
```yaml
name: Claude Developer Agent
on:
  issues:
    types: [labeled]

jobs:
  implement:
    if: github.event.label.name == 'claude-ready'
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Read issue #${{ github.event.issue.number }}.
            Implement it following the conventions in CLAUDE.md.
            Create a feature branch named feature/${{ github.event.issue.number }}-<short-description>.
            Write tests. Open a PR. If anything is unclear, comment
            on the issue asking for clarification and stop.
```

### Agent 7: Test Writer

**Trigger:** Manual or scheduled (weekly)
**Action:**
1. Scans the codebase for files with no corresponding test
2. Prioritizes by risk (auth, data mutations, API routes)
3. Writes unit tests for uncovered components and utilities
4. Opens a PR with the new tests

### Agent 8: Documentation Agent

**Trigger:** Manual
**Action:**
1. Reads recent git history
2. Identifies API changes, new components, changed behavior
3. Updates relevant documentation (API docs, component catalog)
4. Opens a PR with doc updates

### Agent 9: Stale Work Monitor

**Trigger:** Daily cron
**Action:**
1. Lists PRs open > 3 days
2. Lists issues in "In Progress" for > 5 days
3. Lists issues with `claude-ready` label that have no linked PR
4. Comments on stale items or opens a summary issue

### Agent 10: Migration Safety Agent

**Trigger:** PR that modifies `prisma/schema.prisma` or `sql/*.sql`
**Action:**
1. Analyzes the migration for safety:
   - Will it lock tables? (ALTER on large tables)
   - Is it backwards-compatible? (Can the old code run against the new schema?)
   - Does it have a rollback path?
   - Are there data loss risks? (dropping columns, changing types)
2. Checks that RLS policies exist for new tables
3. Verifies indexes are added for foreign keys
4. Posts a migration safety report on the PR

### Are All These Agents Effective?

**High value (implement immediately):**
- PR Reviewer — catches real bugs, enforces consistency
- Security Engineer — catches vulnerabilities humans miss
- Developer Agent — does actual implementation work
- Sanity Checker — catches broken deploys in minutes

**Medium value (implement after core pipeline is stable):**
- Regression Tester — valuable once you have meaningful test coverage
- Migration Safety — valuable once your schema is evolving regularly
- Dependency Auditor — set-and-forget, low cost

**Lower priority (nice to have):**
- Test Writer — helpful for building initial coverage, less useful ongoing
- Documentation Agent — depends on your documentation needs
- Stale Work Monitor — useful when you have multiple contributors/agents

---

## 5. Sprint Board Configuration

### Platform: GitHub Projects (Free)

GitHub Projects is the right choice because:
- Claude agents access it natively via `gh` CLI (no API tokens, no MCP setup)
- Issues, PRs, and branches are linked automatically
- Free for all repo types
- Automation built in (auto-move items when PR merges, etc.)

### Board Columns (Status Field)

| Column | Meaning | Who Moves Items Here |
|---|---|---|
| **Backlog** | Ideas, unrefined work. Not ready for implementation. | You (manual) |
| **Grooming** | Being refined — needs acceptance criteria, design refs, technical notes. | You (manual) |
| **Ready** | Groomed and estimated. A human could pick this up. | You (after grooming) |
| **Claude Ready** | Groomed + has `claude-ready` label. An agent can pick this up independently. | You (after adding enough context for an agent) |
| **In Progress** | Someone (human or agent) is actively working on it. | Auto (when branch is created or PR is opened) |
| **In Review** | PR is open, awaiting review. | Auto (when PR is opened) |
| **QA / UAT** | Merged to develop or staging, awaiting verification. | Auto (when PR merges to develop/staging) |
| **Done** | Merged to main and deployed to production. | Auto (when PR merges to main) |

### Custom Fields

| Field | Type | Values | Purpose |
|---|---|---|---|
| **Size** | Single select | XS, S, M, L, XL | Effort estimate for sprint planning |
| **Type** | Single select | Feature, Bug, Chore, Spike | Categorization |
| **Sprint** | Iteration | 2-week iterations | Sprint assignment |
| **Priority** | Single select | P0-Critical, P1-High, P2-Medium, P3-Low | Urgency |
| **Agent Compatible** | Single select | Yes, Needs Clarification, No | Can a Claude agent do this? |
| **Risk** | Single select | Low, Medium, High | Regression risk assessment |

### Labels (on Issues)

```
# Type
feature          (green)
bug              (red)
chore            (grey)
spike            (purple)

# Agent
claude-ready     (blue)       — Agent can pick this up
claude-blocked   (orange)     — Agent tried, got stuck, needs human input

# Priority
priority/p0      (red)
priority/p1      (orange)
priority/p2      (yellow)
priority/p3      (grey)

# Size
size/xs          (light blue)
size/s           (light blue)
size/m           (blue)
size/l           (dark blue)
size/xl          (navy)

# Area
area/auth        (teal)
area/onboarding  (teal)
area/ui          (teal)
area/api         (teal)
area/database    (teal)
area/infra       (teal)

# Status
needs-design     (pink)
needs-grooming   (yellow)
blocked          (red)
```

### How the Template Configures the Sprint Board

GitHub Projects boards cannot be included in a template repository (they're org/user-level, not repo-level). Instead, the template includes a **setup script** that creates the board programmatically:

**`scripts/setup-sprint-board.sh`:**
```bash
#!/bin/bash
set -euo pipefail

REPO="$1"  # e.g., "suyashbhatia/CollegeOra-frontend"
OWNER=$(echo "$REPO" | cut -d'/' -f1)
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)

echo "Creating GitHub Project for $REPO..."

# Create the project
PROJECT_ID=$(gh project create \
  --owner "$OWNER" \
  --title "$REPO_NAME Sprint Board" \
  --format json | jq -r '.id')

echo "Project created: $PROJECT_ID"

# Add custom fields
echo "Adding custom fields..."
gh project field-create "$PROJECT_ID" \
  --owner "$OWNER" \
  --name "Size" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "XS,S,M,L,XL"

gh project field-create "$PROJECT_ID" \
  --owner "$OWNER" \
  --name "Type" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Feature,Bug,Chore,Spike"

gh project field-create "$PROJECT_ID" \
  --owner "$OWNER" \
  --name "Priority" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "P0-Critical,P1-High,P2-Medium,P3-Low"

gh project field-create "$PROJECT_ID" \
  --owner "$OWNER" \
  --name "Agent Compatible" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Yes,Needs Clarification,No"

gh project field-create "$PROJECT_ID" \
  --owner "$OWNER" \
  --name "Risk" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Low,Medium,High"

echo "Sprint board setup complete."
echo "Link: https://github.com/users/$OWNER/projects/$(gh project list --owner "$OWNER" --format json | jq -r '.projects[-1].number')"
```

**`scripts/seed-labels.sh`:**
```bash
#!/bin/bash
set -euo pipefail

REPO="$1"

LABELS=(
  "feature:22c55e:Feature story"
  "bug:ef4444:Bug report"
  "chore:6b7280:Tech debt or infra"
  "spike:8b5cf6:Research or investigation"
  "claude-ready:3b82f6:Agent can pick this up"
  "claude-blocked:f97316:Agent needs human input"
  "priority/p0:dc2626:Critical"
  "priority/p1:ea580c:High"
  "priority/p2:eab308:Medium"
  "priority/p3:9ca3af:Low"
  "size/xs:bfdbfe:Extra small"
  "size/s:93c5fd:Small"
  "size/m:3b82f6:Medium"
  "size/l:1d4ed8:Large"
  "size/xl:1e3a5f:Extra large"
  "area/auth:14b8a6:Authentication"
  "area/onboarding:14b8a6:Onboarding flow"
  "area/ui:14b8a6:UI components"
  "area/api:14b8a6:API routes"
  "area/database:14b8a6:Database & migrations"
  "area/infra:14b8a6:Infrastructure & CI/CD"
  "needs-design:ec4899:Needs design work"
  "needs-grooming:eab308:Needs grooming"
  "blocked:ef4444:Blocked by external dependency"
)

for label_def in "${LABELS[@]}"; do
  IFS=':' read -r name color description <<< "$label_def"
  gh label create "$name" \
    --repo "$REPO" \
    --color "$color" \
    --description "$description" \
    --force
  echo "Created label: $name"
done

echo "All labels created."
```

### Sprint Workflow

```
Monday (Sprint Planning):
  1. Move items from Backlog → Ready (groom them)
  2. For items with enough context, add `claude-ready` label → moves to Claude Ready
  3. Assign sprint iteration
  4. Set priorities

During Sprint:
  - Pick up stories: `claude "Implement issue #42"`
  - Or label-triggered: add `claude-ready` → agent auto-starts
  - Agent opens PR → CI runs → Claude PR Review runs → Claude Security runs
  - You review the PR (human approval still required for merge)
  - Merge to develop → auto-moves to QA column
  - Test on INT environment
  - PR from develop → staging → test on UAT
  - PR from staging → main → deploys to prod → sanity check runs

Friday (Sprint Review):
  - Review what's in Done
  - Retrospect on agent effectiveness
  - Groom backlog for next sprint
```

---

## 6. Story Writing Guide for Agent Compatibility

### What Makes a Story Agent-Compatible?

An agent needs the same things a new developer on day one would need, but written more explicitly:

| Element | Why the Agent Needs It |
|---|---|
| **Context** — which part of the app, which files | Agent won't know where to start without this |
| **Acceptance criteria** — testable checkboxes | Agent needs a definition of "done" |
| **Technical notes** — patterns to follow, libs to use | Agent might pick a different approach without guidance |
| **Out of scope** — what NOT to do | Agent will over-build without explicit boundaries |
| **Design reference** — screenshot, Figma link, or description | Agent can't guess what it should look like |

### Feature Story Template

```markdown
## Title
[Verb] [thing] [where]
Example: Add Google OAuth button to login page

## Context
[Which part of the app does this touch? Name specific files or directories.]

The onboarding flow lives in `src/app/onboarding/`. The login page is 
`src/app/page.tsx`. Supabase Auth is configured in `src/lib/supabase/`.
The design mockup is at `Screens for onboarding/login.png`.

## Acceptance Criteria
- [ ] Google OAuth button renders on the login page
- [ ] Clicking initiates Supabase `signInWithOAuth({ provider: 'google' })`
- [ ] Successful auth redirects to `/onboarding/welcome`
- [ ] Failed auth shows error state (not a crash)
- [ ] Button follows the design in the referenced screenshot
- [ ] Works on mobile (375px viewport)

## Technical Notes
- Use `@supabase/ssr` `createClient` for server-side auth
- Follow component patterns in `src/components/` (see `primary-button.tsx`)
- Use Material Design 3 color tokens from `globals.css`
- The auth callback route already exists at `src/app/auth/callback/route.ts`

## Out of Scope
- Apple OAuth (separate story: #XX)
- First/last name fields on signup form (deferred)
- Account linking if user already exists with email/password

## Design Reference
`Screens for onboarding/login.png` — Google button should be below the 
email/password form, full-width, with Google logo icon.

## Size
M (Medium)

## Agent Compatible?
Yes — fully specified
```

### Bug Report Template

```markdown
## Title
[Thing] [is broken / does wrong thing] [when condition]
Example: Login redirect loops when session cookie is expired

## Steps to Reproduce
1. Log in successfully
2. Wait for session to expire (or clear the `sb-` cookies manually)
3. Navigate to `/dashboard`
4. Observe: page redirects to `/` which redirects back to `/dashboard` infinitely

## Expected Behavior
User should be redirected to `/` (login page) and stay there.

## Actual Behavior
Infinite redirect loop between `/` and `/dashboard`.

## Context
- Middleware: `src/middleware.ts`
- Auth check: `src/lib/supabase/middleware.ts`
- Session utility: `src/lib/session.ts`

## Acceptance Criteria
- [ ] Expired session redirects to `/` without looping
- [ ] No redirect loop under any auth state
- [ ] Add a test that verifies redirect behavior

## Agent Compatible?
Yes — fully specified
```

---

## 7. Branch Protection Rules

### Rules for `main`

```json
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ci / lint",
      "ci / typecheck",
      "ci / test",
      "ci / build",
      "claude-security-scan",
      "claude-pr-review"
    ]
  },
  "enforce_admins": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

### Rules for `staging`

Same as `main`, but without the manual approval gate.

### Rules for `develop`

```json
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "ci / lint",
      "ci / typecheck",
      "ci / build"
    ]
  },
  "required_linear_history": true,
  "allow_force_pushes": false
}
```

`develop` is intentionally looser — it's the integration branch where things can be messy.

### Setup Script (`scripts/setup-branch-protection.sh`)

```bash
#!/bin/bash
set -euo pipefail

REPO="$1"

# Create branches if they don't exist
git checkout -b develop 2>/dev/null || git checkout develop
git push -u origin develop
git checkout -b staging 2>/dev/null || git checkout staging
git push -u origin staging
git checkout main

# Apply branch protection via GitHub API
for BRANCH in main staging develop; do
  echo "Setting protection for $BRANCH..."
  
  if [ "$BRANCH" = "main" ]; then
    REQUIRED_REVIEWS=1
    STRICT=true
    CHECKS='["ci / lint","ci / typecheck","ci / test","ci / build","claude-security-scan"]'
  elif [ "$BRANCH" = "staging" ]; then
    REQUIRED_REVIEWS=1
    STRICT=true
    CHECKS='["ci / lint","ci / typecheck","ci / test","ci / build"]'
  else
    REQUIRED_REVIEWS=0
    STRICT=false
    CHECKS='["ci / lint","ci / typecheck","ci / build"]'
  fi

  gh api repos/$REPO/branches/$BRANCH/protection \
    --method PUT \
    --input - <<EOF
{
  "required_pull_request_reviews": {
    "required_approving_review_count": $REQUIRED_REVIEWS,
    "dismiss_stale_reviews": true
  },
  "required_status_checks": {
    "strict": $STRICT,
    "contexts": $CHECKS
  },
  "enforce_admins": true,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

  echo "$BRANCH protected."
done
```

---

## 8. Environment Setup (Supabase + Vercel)

### Supabase — Three Projects

| Project | Name | Plan | Cost |
|---|---|---|---|
| INT | `projectname-int` | Free | $0 |
| UAT | `projectname-uat` | Free | $0 |
| PROD | `projectname-prod` | Pro | $25/mo |

**Setup steps:**

1. Go to `app.supabase.com` → New Project for each environment
2. Name them consistently: `collegeora-int`, `collegeora-uat`, `collegeora-prod`
3. Use the same region for all three (minimize latency differences)
4. Run `sql/001-full-schema.sql` in each project's SQL editor
5. Configure auth providers (Google, Apple) in each project
   - INT/UAT: Use test OAuth credentials
   - PROD: Use production OAuth credentials
6. Note down the project URL and anon key for each

### Vercel — Environment Variables Per Branch

In Vercel project settings → Environment Variables:

| Variable | Production (`main`) | Preview (`staging`) | Preview (`develop`) |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` (PROD) | `https://yyy.supabase.co` (UAT) | `https://zzz.supabase.co` (INT) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PROD anon key | UAT anon key | INT anon key |
| `DATABASE_URL` | PROD connection string | UAT connection string | INT connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | PROD service key | UAT service key | INT service key |

**Vercel branch mapping:**
- Production domain → `main` branch
- `staging.projectname.vercel.app` → `staging` branch (configure in Vercel)
- Preview deploys → all other branches (auto)

To make Vercel use different env vars for `staging` vs other preview branches, use Vercel's "Git Branch" env var scoping:

1. Add the variable
2. Uncheck "Production"
3. Check "Preview"
4. Set "Git Branch" to `staging`
5. Repeat for `develop`

### `.env.example` (Included in Template)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Prisma)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 9. Knowledge Layer — Graphify

### The Problem: Claude's Context Window Is Expensive

Every Claude Code session starts fresh. Each agent run (PR review, developer agent, regression tester) re-reads the same files, re-discovers the same architecture, re-learns the same conventions. This burns tokens, costs money, and limits how much an agent can do in a single run.

**Graphify solves this** by extracting a persistent, queryable knowledge graph from your codebase. Instead of agents reading 50 files to understand how auth works, they query the graph: "What depends on the auth middleware?" and get a precise answer in a fraction of the tokens.

### What Graphify Is

Graphify is a Claude Code skill that transforms any input (code, docs, papers, images) into a navigable knowledge graph.

**Outputs:**
| File | Purpose |
|---|---|
| `graphify-out/graph.html` | Interactive browser visualization — explore nodes, clusters, connections |
| `graphify-out/GRAPH_REPORT.md` | Audit trail with insights, god nodes, surprising connections |
| `graphify-out/graph.json` | Machine-readable graph (GraphRAG-ready) |

### How To Use It

#### Initial Graph Generation (Run Once Per Project)

```bash
# From your project root
claude "/graphify . --mode deep"
```

This reads your entire codebase and builds the knowledge graph. Takes a few minutes depending on project size.

#### Incremental Updates (Run After Merges)

```bash
# After merging a PR or significant changes
claude "/graphify . --update"
```

Only processes changed files. Fast and cheap.

#### Querying the Graph (Use Instead of Reading Files)

```bash
# Ask a question about architecture
claude "/graphify query 'What components depend on Supabase auth?'"

# Find the shortest path between two concepts
claude "/graphify path 'LoginPage' 'SupabaseClient'"

# BFS/DFS exploration
claude "/graphify query 'What does the onboarding flow touch?' --mode bfs"
```

### Integration With the Pipeline

#### Where Graphify Fits

```
PR merges to develop
    │
    ▼
CI passes
    │
    ▼
graphify --update          ← Rebuild graph with new code
    │
    ▼
graph.json updated         ← Agents use this on next run
```

#### How Agents Use the Graph

Instead of giving agents free rein to explore the codebase (expensive, slow, often wrong), point them at the graph:

**In agent prompts, add:**
```
Before implementing, check the knowledge graph at graphify-out/GRAPH_REPORT.md
for architecture context. Query graphify-out/graph.json for dependency relationships.
```

**Concrete savings:**
| Without Graphify | With Graphify |
|---|---|
| Developer agent reads 30-50 files to understand context (~15k-40k tokens) | Agent reads graph report + targeted query (~3k-5k tokens) |
| PR reviewer re-discovers architecture every run | Reviewer knows the dependency map from the graph |
| Regression tester guesses what might break | Tester queries the graph for downstream dependencies |

#### Automated Graph Updates (GitHub Action)

Add to your CI pipeline to keep the graph fresh:

```yaml
# .github/workflows/update-knowledge-graph.yml
name: Update Knowledge Graph
on:
  push:
    branches: [develop]

jobs:
  update-graph:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Run /graphify . --update to refresh the knowledge graph
            with the latest code changes. Commit the updated graph
            files if there are changes.
```

#### Add to CLAUDE.md

Add this block to your project's CLAUDE.md so all agents know about the graph:

```markdown
## Knowledge Graph
A Graphify knowledge graph is maintained at `graphify-out/`.
- For architecture questions, read `graphify-out/GRAPH_REPORT.md` first
- For dependency lookups, query `graphify-out/graph.json`
- Do NOT re-read entire directories when the graph can answer your question
```

### What to Commit

```
graphify-out/
  ├── graph.json          ✅ Commit (agents need this)
  ├── GRAPH_REPORT.md     ✅ Commit (agents and humans need this)
  └── graph.html          ⚠️ Optional (useful for manual exploration, ~1-3MB)
```

### Template Repo Changes

Add to the template so every new project gets Graphify wired in:

1. Add `graphify-out/` to the repo structure
2. Add the `update-knowledge-graph.yml` workflow
3. Add the Knowledge Graph section to CLAUDE.md template
4. Add `/graphify . --mode deep` to the setup script's post-bootstrap steps

---

## 10. Stateful Agent Layer — Archon (Future)

> **Status: Planned — do NOT implement until the basic pipeline is validated and you hit real limitations of stateless agents.**

### What Archon Is

[Archon](https://github.com/coleam00/archon) by Cole Medin is an open-source AI agent framework that provides:

- **Persistent memory** via Supabase vector storage
- **Multi-agent orchestration** with handoffs between agents
- **MCP integration** for tool access
- **Self-hosted agent runtime** — agents run on your infrastructure, not limited to GitHub Actions' 6-hour ceiling

### Why Not Now

| Concern | Detail |
|---|---|
| **Complexity** | Adds hosting (Docker/VPS), Supabase vector config, agent runtime management |
| **Cost** | VPS hosting ($5-20/mo) + same LLM costs + engineering time to set up |
| **Diminishing returns early on** | Your current pipeline is stateless and that's fine for <50 stories |
| **Dependency risk** | Archon is evolving rapidly; locking in now means churn later |

### When to Adopt Archon

Trigger any **two** of these conditions:

- [ ] Agents repeatedly fail because they lack context from previous runs (same bug patterns, same architectural misunderstandings)
- [ ] You need agents that work longer than 6 hours (GitHub Actions limit)
- [ ] You want agents to autonomously pick up stories from the board without manual triggering
- [ ] You have multiple projects where agents need shared knowledge (cross-repo memory)
- [ ] You need agent-to-agent handoffs (e.g., developer agent hands off to test writer agent within a single workflow)

### How It Will Integrate

#### Architecture: Graphify + Archon = Two Memory Layers

```
┌─────────────────────────────────────────────────┐
│                  Agent Request                   │
│         "Implement story #42"                    │
└────────────────────┬────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌─────────────────┐   ┌─────────────────────┐
│   Graphify       │   │   Archon Memory      │
│   (Structural)   │   │   (Semantic)          │
│                  │   │                       │
│ • What calls     │   │ • Past decisions      │
│   what           │   │ • Resolved bugs       │
│ • Dependencies   │   │ • Design rationale    │
│ • File map       │   │ • Sprint context      │
│ • Component      │   │ • "We tried X, it     │
│   relationships  │   │    failed because Y"  │
└─────────────────┘   └─────────────────────┘
          │                     │
          └──────────┬──────────┘
                     ▼
          ┌─────────────────────┐
          │  Agent has full     │
          │  context without    │
          │  re-reading the     │
          │  entire codebase    │
          └─────────────────────┘
```

- **Graphify** = structural memory (what calls what, file dependencies, component relationships). Extracted from code. Updated after merges.
- **Archon's Supabase vectors** = semantic memory (past decisions, resolved bugs, design rationale, sprint context). Accumulated over time from agent runs.

#### Phased Rollout

**Phase A — Validate the pipeline (NOW):**
- Use stateless GHA agents + Graphify for structural context
- Manually run `/graphify --update` after significant merges
- Automate graph updates via the CI workflow above
- This gives you ~80% of the memory benefit with zero extra infrastructure

**Phase B — Add Archon when triggered (FUTURE):**

1. **Set up Archon runtime:**
   ```
   # Self-hosted on a VPS or Docker
   archon/
     ├── docker-compose.yml
     ├── agents/
     │   ├── developer.py
     │   ├── reviewer.py
     │   └── orchestrator.py
     └── .env  # Supabase + Anthropic credentials
   ```

2. **Migrate agents one at a time:**
   - Start with the Developer Agent (highest value from persistent memory)
   - Keep PR Reviewer and Security Scanner on stateless GHA (they don't need memory)
   - Move Regression Tester to Archon (benefits from knowing past regressions)

3. **Wire up the memory layer:**
   - Archon agents read `graphify-out/graph.json` for structural context (replaces file exploration)
   - Archon stores semantic memories in Supabase vectors (decisions, past bugs, rationale)
   - Each agent run starts by querying both layers before doing any work

4. **Enable autonomous story pickup:**
   - Archon agent polls the sprint board for `claude-ready` issues
   - Picks up stories, implements them, opens PRs
   - No more manual `claude "Implement #42"` — the agent does it on its own schedule

### Cost Impact

| Item | Current (Stateless) | With Archon |
|---|---|---|
| Agent LLM costs | Same | Same |
| VPS for Archon runtime | $0 | $5-20/mo |
| Supabase vector storage | $0 (included in Pro plan) | $0 |
| Setup time | 0 | ~1-2 days |
| **Net benefit** | — | Agents make fewer mistakes, work autonomously, remember past context |

### What NOT to Do

- **Don't run Archon and GHA agents in parallel for the same task.** Pick one runtime per agent type.
- **Don't store code in Archon's vector memory.** That's what Graphify and git are for. Archon stores *decisions and context*, not *code*.
- **Don't skip Graphify.** Archon's semantic memory complements Graphify's structural memory — they're not interchangeable. You need both when you adopt Archon.

---

## 11. Template Repository Setup

### One-Time Setup (Do This Once)

1. **Create the template repo on GitHub:**
   ```bash
   gh repo create suyash-project-template --public --description "Project template with CI/CD, Claude agents, and sprint board"
   ```

2. **Populate it** with the `.github/`, `scripts/`, `docs/` directories from this playbook

3. **Mark as template:**
   - GitHub repo → Settings → General → check "Template repository"

4. **Test it** by creating a new repo from the template:
   - GitHub → `suyash-project-template` → "Use this template" → "Create a new repository"

### What the Template Includes vs What the Setup Script Does

| Included in template (copied on clone) | Created by setup script (run once after clone) |
|---|---|
| `.github/workflows/*.yml` | GitHub Projects board + columns + fields |
| `.github/ISSUE_TEMPLATE/*.yml` | Issue labels |
| `.github/PULL_REQUEST_TEMPLATE.md` | Branch protection rules |
| `.github/CODEOWNERS` | `develop` and `staging` branches |
| `scripts/*.sh` | — |
| `CLAUDE.md` (base) | — |
| `AGENTS.md` | — |
| `.env.example` | — |
| `.husky/` config | — |
| `vitest.config.ts` | — |
| `playwright.config.ts` | — |
| `docs/PIPELINE_PLAYBOOK.md` | — |

### Master Setup Script (`scripts/setup-project.sh`)

```bash
#!/bin/bash
set -euo pipefail

echo "=== Project Setup ==="
echo ""

# Get repo info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
echo "Repository: $REPO"
echo ""

# Step 1: Install dependencies
echo "[1/5] Installing dependencies..."
npm install

# Step 2: Create branches
echo "[2/5] Creating branches..."
git checkout -b develop
git push -u origin develop
git checkout -b staging
git push -u origin staging
git checkout main

# Step 3: Set up branch protection
echo "[3/5] Setting branch protection rules..."
bash scripts/setup-branch-protection.sh "$REPO"

# Step 4: Create labels
echo "[4/5] Creating issue labels..."
bash scripts/seed-labels.sh "$REPO"

# Step 5: Create sprint board
echo "[5/5] Creating sprint board..."
bash scripts/setup-sprint-board.sh "$REPO"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Remaining manual steps:"
echo "  1. Create 3 Supabase projects (int, uat, prod)"
echo "  2. Run your SQL migrations on each"
echo "  3. Configure Vercel environment variables per branch"
echo "  4. Add ANTHROPIC_API_KEY to GitHub repo secrets"
echo "  5. Update CLAUDE.md with project-specific details"
echo "  6. Run: claude '/graphify . --mode deep' to generate initial knowledge graph"
echo "  7. Create your first sprint stories"
```

---

## 12. New Project Bootstrap (From Template)

### Step-by-Step for Every New Project

```bash
# 1. Create repo from template (via GitHub UI or CLI)
gh repo create my-new-project \
  --template suyash-project-template \
  --public \
  --clone

# 2. Enter the repo
cd my-new-project

# 3. Run the master setup
bash scripts/setup-project.sh

# 4. Add your Anthropic API key to GitHub secrets
gh secret set ANTHROPIC_API_KEY

# 5. Update CLAUDE.md with project-specific info
#    (tech stack, conventions, design system, etc.)

# 6. Create Supabase projects and configure Vercel env vars
#    (follow Section 8 of this playbook)

# 7. Start writing stories and building
```

**Time from zero to full pipeline: ~30 minutes.**

---

## 13. Cost Breakdown

### Monthly Costs (Active Development)

| Item | Cost | Notes |
|---|---|---|
| **Supabase** | $25 | 2 free projects (INT, UAT) + 1 Pro (PROD) |
| **Vercel Pro** | $20 | Needed for team features + preview deploy controls |
| **GitHub** | $0–4 | Free for public, $4/user/mo for private Teams |
| **Claude Max Plan** | $100–200 | Your interactive development sessions |
| **Claude API (PR Review)** | $15–25 | ~50 PRs/mo × $0.30–0.50 avg |
| **Claude API (Security Scan)** | $10–20 | ~50 PRs/mo × $0.20–0.40 avg |
| **Claude API (Regression)** | $10–20 | ~30 PRs/mo × $0.30–0.60 avg |
| **Claude API (Sanity + Cron agents)** | $5–15 | Low frequency, small prompts |
| **Claude API (Developer Agent)** | $20–50 | Depends on how many stories you delegate |
| **Graphify graph updates** | $2–5 | ~$0.05–0.10 per incremental update, runs on merge to develop |
| **Archon VPS (future)** | $0 (now) / $5–20 (later) | Only when you adopt Archon for stateful agents |
| **Domain + DNS** | $12–15 | Annual, amortized |
| **Total (now)** | **$222–375/mo** | |
| **Total (with Archon, future)** | **$227–395/mo** | |

### Comparison

| Setup | Monthly Cost | Output |
|---|---|---|
| This pipeline (you + Claude agents) | $220–370 | Full CI/CD, automated review, security, testing |
| Junior developer (part-time) | $2,000–4,000 | No automated pipeline, manual reviews |
| Small dev team (2 devs + DevOps) | $15,000–30,000 | Full pipeline but 50-100x the cost |

---

## 14. Effectiveness Assessment

### What Works Well Today

| Capability | Maturity | Notes |
|---|---|---|
| **PR code review** | Production-ready | Claude catches real bugs, style issues, logic errors |
| **Security scanning** | Production-ready | Finds injection, auth gaps, secrets in code |
| **Story implementation** | Good, needs oversight | Agent implements ~80% of well-groomed stories correctly. Remaining 20% needs human revision |
| **Test writing** | Good | Generates reasonable unit tests. Integration tests need more guidance |
| **CI/CD pipeline** | Industry standard | GitHub Actions is battle-tested, nothing experimental here |
| **Graphify knowledge graph** | Use now | Reduces agent token burn by 60-80% on architecture queries. Run `--update` after merges |
| **Archon stateful agents** | Planned (future) | Adopt when stateless agents hit real memory/autonomy limits |

### What Requires Human Judgment

| Area | Why |
|---|---|
| **Architecture decisions** | Agent builds what you tell it to — it won't question whether you should build it |
| **Product direction** | Agent implements specs, doesn't decide what to build |
| **Final PR approval** | Always have a human merge. Agent reviews inform, not decide |
| **Production incidents** | Agent can help debug but shouldn't have prod access to run fixes autonomously |
| **Story grooming** | The quality of agent output = quality of story input. Garbage in, garbage out |

### Key Principle

> **Agents are junior developers with perfect memory and no judgment.**
> They follow instructions precisely, write decent code, and never get tired.
> But they need clear specs, guardrails, and a human to say "ship it."

The pipeline this playbook describes doesn't replace engineering judgment — it amplifies your output by automating the repetitive 80% (writing code, reviewing PRs, running checks, flagging issues) so you can focus on the creative 20% (architecture, product decisions, user experience).

---

## Appendix: Quick Reference Card

```
Start a new project:     gh repo create X --template suyash-project-template --clone
                         cd X && bash scripts/setup-project.sh

Write a story:           gh issue create (use the feature template)
Mark agent-ready:        gh issue edit 42 --add-label "claude-ready"
Start agent on story:    claude "Implement issue #42"
Check pipeline status:   gh pr checks <PR-number>
View sprint board:       gh project view --owner <you>
Deploy to staging:       Open PR: develop → staging
Deploy to prod:          Open PR: staging → main
Post-deploy check:       Automatic (sanity check workflow)

Knowledge graph:
  Initial build:         claude "/graphify . --mode deep"
  Update after merge:    claude "/graphify . --update"
  Query architecture:    claude "/graphify query 'What depends on auth?'"
  Find connections:      claude "/graphify path 'ComponentA' 'ComponentB'"
  View graph:            open graphify-out/graph.html
```
