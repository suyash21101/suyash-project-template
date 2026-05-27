# Sample Setup Log

> Running log of our pipeline build-out. We brainstorm and nail down decisions here
> before bootstrapping a real repo from the template. Append-only; newest section at bottom.

**Started:** 2026-05-26
**Status:** Brainstorming / design — no GitHub mutations yet.

---

## How this works

This file tracks (a) decisions we've locked, (b) open questions, and (c) the actual
setup steps once we run them. The pipeline reference itself lives in
`docs/PIPELINE_PLAYBOOK.md` — this log is the working scratchpad on top of it.

---

## Decisions locked

- **PM tool: GitHub Projects** (2026-05-26). Native `gh` CLI access for agents, auto PR/issue/branch linking, built-in board automation, zero extra cost. Setup script already exists (`scripts/setup-sprint-board.sh`).
- **Reviewers: Claude only for now** (2026-05-26). Single Claude PR Reviewer as in the playbook. Codex (`@codex review`, P0/P1) documented as a future toggle if Claude misses correctness bugs.
- **Local hooks: small high-value set** (2026-05-26). Template ships `settings.json` hooks: (1) require issue ID in branch name, (2) block edits to generated files (`graphify-out/`, lockfiles), (3) lint+typecheck on session stop. Deterministic, zero token cost, mirrors CI gates locally.
- **Packaging: loose template files** (2026-05-26). Keep `.github/`, `scripts/`, hooks, `CLAUDE.md` as copied-on-clone files. Revisit plugin packaging after 2+ projects.
- **Local dev = agent team** (2026-05-26). `claude "Implement #N"` runs as an orchestrator dispatching implementer + test-writer + self-reviewer subagents, each own context. Story Acceptance Criteria fed in as **Outcomes** so the team iterates to self-verified "done". Runs in worktree+sandbox; dev server as background task; Checkpoints/Rewind as undo net.
- **`/ultrareview` gate: before `staging → main` only** (2026-05-26). One deep multi-agent cloud review per release, as the final pre-prod gate. Per-PR `claude-pr-review.yml` still covers every develop PR. Manual (user-triggered, billed).
- **Codex computer-use QA: manual, on UAT, for now** (2026-05-26). After deploying to UAT (`staging`), a Codex background browser agent smoke-tests critical flows + writes an issue summary, before opening `staging → main`. Documented promotion-checklist step; automate via `codex-action` later if it proves out.
- **Model split (two axes)** (2026-05-26). Axis A (billing): CI = API key, interactive local = Max plan. Axis B (tier): Opus 4.7 = local dev/migration-safety/ultrareview; Sonnet 4.6 = PR review/security/regression; Haiku 4.5 = sanity/stale-PR/dep-triage.
- **Dreaming = end-of-sprint memory maintenance** (2026-05-26). Periodic consolidation pass on the local memory store (merge dupes, drop stale/contradicted, surface patterns). Review output before trusting. Partially covers Archon semantic memory → pushes Archon adoption further out.
- **Modular stage control** (2026-05-26). Control plane = reusable workflows (`workflow_call`) + repo/Org variable feature flags (`if: vars.ENABLE_X`), with path filters and per-PR skip labels. Each check becomes a versioned, independently-toggled module. **Documented in playbook §17 (2026-05-26)** — design only; module files not yet authored.
- **Infra: full AWS-native** (2026-05-26). Aurora PostgreSQL + Cognito + S3, replacing Supabase. Documented in `docs/AWS_INFRA_SETUP.md`. Both compute options written (Amplify Hosting + ECS Fargate); pick one per project.
- **Repo strategy: reusable workflows in user-level `.github` repo** (2026-05-26). Shared CI logic referenced by tag (`uses: suyash21101/.github/...@v1`); IaC lives in each project's `infra/` dir. No separate pipeline repo for now.
- **Control plane: GitHub Variables + deployed UI, runtime-fetched** (2026-05-26, supersedes the earlier static-HTML/`pipeline.config.json` idea). Source of truth = a single GitHub Actions Variable `PIPELINE_CONFIG` (JSON), org-level default + repo override. A deployed thin SPA (Amplify/Pages + GitHub App auth) edits it via the REST API. Orchestrator `pipeline.yml` reads `vars.PIPELINE_CONFIG` **at runtime** (change toggles without a commit) and gates each stage on its `enabled` flag; a `record` job echoes the resolved config to the run summary for auditability. Single always-run `gate` job = only required branch-protection check. Full phased build guide: **`docs/BUILD_ROADMAP.md`**.

## Open questions

- [x] Fold these design changes into `PIPELINE_PLAYBOOK.md` → **Done** (2026-05-26): added §16 "Recent Capabilities & How We Use Them", a billing-split note in §4, and updated the quick-reference card.
- [ ] **AWS account model:** multi-account (INT/UAT/PROD under Organizations, recommended for PROD isolation) vs single-account-multi-stack (cheaper, less isolation). See `AWS_INFRA_SETUP.md` §2.
- [ ] **IaC tool:** CDK (TypeScript, recommended — matches stack) vs Terraform (portable). See `AWS_INFRA_SETUP.md` §10.
- [ ] **RLS migration:** rewrite all Supabase `auth.uid()` policies to Postgres `current_setting('app.user_id')` — main porting cost from Supabase. See §5.
- [ ] Agent-team subagent definitions: exact roles/tools/models (defer until we author them).
- [ ] Author the actual `settings.json` hooks (branch-name, protected-path, stop) — not yet written, only specified.
- [x] Stand up the `suyash21101/.github` repo with reusable workflows. **Phase 2 thin slice done (2026-05-27):** repo created (private), 4 modules live at `@v1`, pipeline.yml rewired. Remaining ~12 modules + `aws-deploy.yml` deferred. **Checklist: `docs/GITHUB_DOTFILES_REPO_CHECKLIST.md`**.
- [ ] First real bootstrap: create a repo from the template + run `setup-project.sh` (deferred, "in some time").
- [ ] **Integrations & access** documented in `BUILD_ROADMAP.md` (2026-05-26): GitHub App for the control UI, OIDC for CI→AWS, AWS SSO + optional AWS MCP for local agents, GitHub Environments with prod reviewer, MCP servers, Budgets/alarms, Dependabot. Agent AWS rule: read-all + write-INT-only, never autonomous prod write.
- [ ] Conversation summary + full question list captured in `docs/CONVERSATION_SUMMARY.md` (2026-05-26).

---

## Feature scan — what shipped since our last design pass (Feb–May 2026)

### Anthropic / Claude

| Feature                                                                                              | What it is                                                                                                                                               | Pipeline relevance                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Opus 4.7**                                                                                         | Successor to 4.6; better long-running multi-step tasks, stronger system-prompt adherence, higher-res vision                                              | Default model for local dev + heavier CI agents                                                                                       |
| **Agent SDK billing split**                                                                          | `claude -p`, Claude Code GitHub Actions, and 3rd-party frameworks now draw from a **separate API credit pool at standard API rates** — NOT Pro/Max quota | Confirms CI agents must use an API key; Max plan only covers interactive local work                                                   |
| **Agent teams / subagents**                                                                          | `--agents` JSON: per-subagent prompt, tools, model, hooks, memory, isolation, effort, background                                                         | Could model each CI reviewer + local dev as a defined subagent                                                                        |
| **Hooks**                                                                                            | Run around tool calls, session start, stop, subagent completion                                                                                          | Local guardrails: tests-before-stop, block edits to generated files, require issue ID in branch name, security scan after dep changes |
| **Plugins**                                                                                          | Versioned bundle of skills + subagents + commands + hooks + MCP defs                                                                                     | Package the whole pipeline as one installable unit in the template                                                                    |
| **Managed Agents: dreaming, outcomes, multiagent orchestration; MCP tunnels; self-hosted sandboxes** | Hosted agent runtime additions                                                                                                                           | Possible alternative to the planned Archon layer for autonomous story pickup                                                          |

### Anthropic / Claude — second pass (more releases)

| Feature                                                       | What it is                                                                   | Pipeline relevance                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Multi-agent orchestration / agent teams** (public beta)     | Orchestrator dispatches a fleet of bounded subagents, each own context/tools | Local dev: orchestrator → implementer + test-writer + self-reviewer subagents on one story |
| **Outcomes** (public beta)                                    | Define what "success" looks like; agent iterates until met                   | Feed a story's Acceptance Criteria in as Outcomes so the dev agent self-checks to done     |
| **Checkpoints / Rewind** (`/rewind`, Esc-Esc)                 | Auto-snapshot before each edit; instant rewind                               | Local safety net during iteration — undo bad edits without git gymnastics                  |
| **Native sandbox** (`/sandbox`, OS-level isolation)           | Filesystem + network isolation (Seatbelt/bubblewrap)                         | Run autonomous local agents more safely                                                    |
| **Worktree isolation + background tasks** (`--bg`, `/resume`) | Isolated workspace per task; long processes don't block                      | Parallel story work; dev server in background during E2E                                   |
| **Dreaming** (research preview)                               | Reorganizes a memory store: merges dupes, replaces stale entries             | Possible lightweight stand-in for part of the Archon semantic-memory layer                 |

### OpenAI / ChatGPT

| Feature                                              | What it is                                                                                                   | Pipeline relevance                                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GPT-5.5 / 5.5 Pro** (Apr 24 2026)                  | Agentic-first retrained base model; parallel sandboxes                                                       | Candidate for a second-opinion agent                                                                                                                            |
| **Codex on GPT-5.5**                                 | Background computer use, in-app browser, **GitHub PR reviews**, parallel sandboxes, `codex-action`           | `@codex review` reads `AGENTS.md` review guidelines (we already have AGENTS.md), flags only P0/P1 — future toggle alongside Claude PR Reviewer                  |
| **Codex Computer Use + in-app browser / Chrome ext** | Background agent clicks through a live site, fills forms, inspects DOM, screenshots, writes an issue summary | **End-of-cycle QA**: smoke-test the UAT deploy (login, onboarding, critical flows) before prod promotion — complements Playwright with human-style verification |
| **GPT-5.5 Instant**                                  | New ChatGPT default; 52% fewer hallucinations                                                                | General assistant, not pipeline-critical                                                                                                                        |
| File Library, Shopping, Images 2.0                   | Consumer features                                                                                            | Not relevant                                                                                                                                                    |

### Heavy review (Claude Code, this environment)

| Feature            | What it is                                                                         | Pipeline relevance                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/ultrareview`** | User-triggered multi-agent **cloud** review of the current branch or a PR (billed) | Deep pre-prod review gate — the heavyweight counterpart to the lightweight per-PR `claude-pr-review.yml`. Cannot be auto-launched; you run it. |

**Sources:** Anthropic & Claude Code release notes (releasebot.io), Anthropic May roundup (claudeapi.com), 9to5Mac Managed Agents, OpenAI GPT-5.5 announcement, OpenAI Codex GitHub code-review docs (developers.openai.com/codex).

---

## Setup steps executed

### Phase 1 — control plane (2026-05-26, in this template repo)

Built (verified locally):

- `pipeline.config.default.json` — canonical default config (CI fallback before the variable is seeded).
- `pipeline.schema.json` — JSON Schema for the config.
- `src/lib/pipeline-config.ts` + `.test.ts` — TDD'd parse/validate/isStageEnabled contract. **15 tests, 100% coverage.**
- `vitest.config.ts` — coverage thresholds (lines/funcs/stmts 80, branches 70), scoped to `src/lib/**`.
- `CLAUDE.md` — testing convention (every `src/lib` module tested; thresholds enforced).
- `.github/workflows/pipeline.yml` — orchestrator: `config` (resolves `vars.PIPELINE_CONFIG` → default file), per-stage gating via `fromJSON`, single `gate` aggregator. jq logic verified locally.
- `src/app/pipeline-control/page.tsx` — control UI (Next.js client route, PAT prototype) importing the tested module. Build verified: route prerenders.

Verified: `tsc --noEmit` clean, `vitest run --coverage` green (100%), `npm run build` succeeds.

Known issues / not done:

- ~~`npm run lint` broken~~ **FIXED (2026-05-26):** rewrote `eslint.config.mjs` to use `eslint-config-next` v16 native flat configs (`core-web-vitals` + `typescript`) instead of the `FlatCompat` bridge that crashed on ESLint 9. Also de-anonymized `commitlint.config.mjs`. `npm run lint` now exits 0 with no warnings.
- UI auth is a PAT prototype — production needs the GitHub App + serverless backend.
- Org-level `PIPELINE_CONFIG` variable not seeded (outward GitHub mutation — left for the user): `gh variable set PIPELINE_CONFIG --org <org> --body "$(cat pipeline.config.default.json)"`.
- `tsconfig.json` auto-modified by `next build` (added `.next` types, jsx=react-jsx) — expected Next behavior.

### Phase 2 — reusable workflow modules (2026-05-27)

Decisions (confirmed): owner **`suyash21101`** (same account as consumer repos — required for `uses:`/`secrets: inherit`); repo **private**; **thin-slice-first** sequencing.

Done:

- Created `suyash21101/.github` (private). Enabled cross-repo Actions access (`actions/permissions/access` = `user`) so consumer repos can reference the private modules.
- Authored 4 `workflow_call` modules in `suyash21101/.github/.github/workflows/`: `lint.yml`, `typecheck.yml`, `test.yml` (takes `coverage_min`, overrides the consumer's vitest thresholds so `PIPELINE_CONFIG` governs the gate), `build.yml`. Pushed `main` + tags `v1.0.0` and moving `v1`.
- Rewired this repo's `.github/workflows/pipeline.yml`: the 4 stage jobs now `uses:` the modules `@v1`; `config` + `gate` jobs unchanged (skip-is-pass / fail-is-block contract preserved at the job level).
- Cleanup: corrected `suyashbhatia/.github` → `suyash21101/.github` across docs; `pipeline.schema.json` `$id`; CODEOWNERS handle `@suyashbhatia` → `@suyash21101`.

Notes / not done:

- Personal accounts have no org-level secrets — `secrets: inherit` forwards the **consumer** repo's secrets. The Claude modules (Stage F) will need `ANTHROPIC_API_KEY` set on each consumer repo (or via an environment).
- CODEOWNERS still references Supabase paths — valid for the current template; revisit at the AWS migration (Phase 4), not now.
- Remaining ~12 modules (prisma-validate, bundle-size, claude-\*, dependency-audit, stale-pr-check, knowledge-graph, weekly-digest, aws-deploy) deferred until the slice is verified green on a real PR.
- Smoke test (Stage E) pending: needs a PR run to confirm the modules resolve via `@v1` and `gate` behaves.
