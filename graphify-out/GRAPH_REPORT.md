# Graph Report - . (2026-05-27)

## Corpus Check

- Corpus is ~25,095 words - fits in a single context window. You may not need a graph.

## Summary

- 131 nodes · 229 edges · 17 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_AWS Infrastructure Design|AWS Infrastructure Design]]
- [[_COMMUNITY_Pipeline Control & Deploy|Pipeline Control & Deploy]]
- [[_COMMUNITY_CI Agents & Review Rules|CI Agents & Review Rules]]
- [[_COMMUNITY_Coverage Report Sorter JS|Coverage Report: Sorter JS]]
- [[_COMMUNITY_Project Conventions & Agent Setup|Project Conventions & Agent Setup]]
- [[_COMMUNITY_Coverage Report Prettify JS|Coverage Report: Prettify JS]]
- [[_COMMUNITY_Pipeline Config Module & Control UI|Pipeline Config Module & Control UI]]
- [[_COMMUNITY_Coverage Report Block Navigation|Coverage Report: Block Navigation]]
- [[_COMMUNITY_App Layout|App Layout]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Prisma Config|Prisma Config]]
- [[_COMMUNITY_Next Env Types|Next Env Types]]
- [[_COMMUNITY_Playwright Config|Playwright Config]]
- [[_COMMUNITY_Vitest Config|Vitest Config]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_E2E Smoke Spec|E2E Smoke Spec]]
- [[_COMMUNITY_Unit Smoke Test|Unit Smoke Test]]

## God Nodes (most connected - your core abstractions)

1. `CollegeOra Pipeline Playbook` - 17 edges
2. `AWS Infrastructure Setup (Full AWS-Native)` - 17 edges
3. `Sample Setup Log — Decision Log` - 14 edges
4. `.github Repo Setup Checklist` - 12 edges
5. `Build Roadmap — Bringing the Pipeline to Life` - 11 edges
6. `§4 Claude Agent Fleet (10 agent types)` - 10 edges
7. `PIPELINE_CONFIG GitHub Actions Variable (JSON)` - 10 edges
8. `Conversation Summary — Pipeline Design Session` - 7 edges
9. `§9 Knowledge Layer — Graphify` - 7 edges
10. `gate aggregator job (single required check)` - 7 edges

## Surprising Connections (you probably didn't know these)

- `Project Conventions (naming, per-module tests, migrations)` --conceptually_related_to--> `Phase 1 — Control Plane Built (TDD config module)` [INFERRED]
  CLAUDE.md → docs/SAMPLE_SETUP_LOG.md
- `Git Workflow (feature → develop → staging → main)` --conceptually_related_to--> `§2 Branching Strategy & Three Environments (INT/UAT/PROD)` [INFERRED]
  CLAUDE.md → docs/PIPELINE_PLAYBOOK.md
- `Developer Agent Rules (implement stories)` --conceptually_related_to--> `Agent: Developer (local, Max plan)` [INFERRED]
  AGENTS.md → docs/PIPELINE_PLAYBOOK.md
- `PR Review Agent Rules (correctness over style)` --conceptually_related_to--> `Agent: PR Reviewer (Sonnet, every PR)` [INFERRED]
  AGENTS.md → docs/PIPELINE_PLAYBOOK.md
- `Security Agent Rules (OWASP, severity ratings)` --conceptually_related_to--> `Agent: Security Engineer (OWASP, RLS, Cognito)` [INFERRED]
  AGENTS.md → docs/PIPELINE_PLAYBOOK.md

## Hyperedges (group relationships)

- **Modular pipeline control plane (UI → PIPELINE_CONFIG → orchestrator → gate)** — control_ui, pipeline_config, gate_aggregator, dotfiles_repo, roadmap_control_plane_model [EXTRACTED 0.90]
- **CI Claude agent fleet on PRs/deploys** — agent_pr_reviewer, agent_security_engineer, agent_regression_tester, agent_sanity_checker, agent_migration_safety [EXTRACTED 0.85]
- **AWS-native stack (Aurora + Cognito + S3 + Amplify/Fargate via OIDC)** — aws_aurora, aws_cognito_rls, aws_s3, aws_amplify, aws_oidc [EXTRACTED 0.90]

## Communities

### Community 0 - "AWS Infrastructure Design"

Cohesion: 0.11
Nodes (24): §2 Account & Environment Model (multi-account vs single), §7 Compute Option A — Amplify Hosting, §4 Aurora PostgreSQL (Serverless v2), §10 Infrastructure as Code (CDK, infra/ dir), §8 Compute Option B — ECS Fargate + ALB, AWS Infrastructure Setup (Full AWS-Native), §6 Storage — S3 (CloudFront OAC, presigned URLs), §1 Service Mapping: Supabase/Vercel → AWS (+16 more)

### Community 1 - "Pipeline Control & Deploy"

Cohesion: 0.13
Nodes (23): Agent: Sanity Checker (post-deploy curl), §16 Setup Checklist (order of operations), §11 CI/CD Integration (aws-deploy.yml reusable workflow), §9 Secrets & GitHub OIDC (keyless deploy), Deployed Control UI (SPA + GitHub App auth), Conversation Summary — Pipeline Design Session, .github Repo Setup Checklist, suyash21101/.github reusable-workflows repo (+15 more)

### Community 2 - "CI Agents & Review Rules"

Cohesion: 0.12
Nodes (16): Agent: Dependency Auditor (weekly cron), Agent: Migration Safety (Opus, schema changes), Agent: PR Reviewer (Sonnet, every PR), Agent: Regression Tester (PR to develop+), Agent: Security Engineer (OWASP, RLS, Cognito), Agent: Test Writer (local), PR Review Agent Rules (correctness over style), Security Agent Rules (OWASP, severity ratings) (+8 more)

### Community 3 - "Coverage Report: Sorter JS"

Cohesion: 0.36
Nodes (13): addSearchBox(), addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns() (+5 more)

### Community 4 - "Project Conventions & Agent Setup"

Cohesion: 0.2
Nodes (14): Agent: Developer (local, Max plan), Developer Agent Rules (implement stories), AGENTS.md — Agent Instructions, CLAUDE.md — Project Instructions, Project Conventions (naming, per-module tests, migrations), Git Workflow (feature → develop → staging → main), Graphify (Claude Code skill, knowledge graph), Pipeline Template Completion — Implementation Plan (+6 more)

### Community 5 - "Coverage Report: Prettify JS"

Cohesion: 0.44
Nodes (10): a(), B(), c(), D(), g(), i(), k(), o() (+2 more)

### Community 6 - "Pipeline Config Module & Control UI"

Cohesion: 0.33
Nodes (5): ghHeaders(), load(), save(), parsePipelineConfig(), validatePipelineConfig()

### Community 7 - "Coverage Report: Block Navigation"

Cohesion: 0.73
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 8 - "App Layout"

Cohesion: 1.0
Nodes (0):

### Community 9 - "Home Page"

Cohesion: 1.0
Nodes (0):

### Community 10 - "Prisma Config"

Cohesion: 1.0
Nodes (0):

### Community 11 - "Next Env Types"

Cohesion: 1.0
Nodes (0):

### Community 12 - "Playwright Config"

Cohesion: 1.0
Nodes (0):

### Community 13 - "Vitest Config"

Cohesion: 1.0
Nodes (0):

### Community 14 - "Next Config"

Cohesion: 1.0
Nodes (0):

### Community 15 - "E2E Smoke Spec"

Cohesion: 1.0
Nodes (0):

### Community 16 - "Unit Smoke Test"

Cohesion: 1.0
Nodes (0):

## Knowledge Gaps

- **19 isolated node(s):** `Decision: Claude-only reviewers (Codex future toggle)`, `Decision: Local dev = agent team (Outcomes-driven)`, `Rationale: .github repo flipped public (public consumer can't use private modules)`, `Versioning: moving major tag @v1`, `secrets: inherit forwarding pattern` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Layout`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Page`** (2 nodes): `Home()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Prisma Config`** (1 nodes): `prisma.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Playwright Config`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vitest Config`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `E2E Smoke Spec`** (1 nodes): `smoke.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Unit Smoke Test`** (1 nodes): `smoke.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `CollegeOra Pipeline Playbook` connect `AWS Infrastructure Design` to `Pipeline Control & Deploy`, `CI Agents & Review Rules`, `Project Conventions & Agent Setup`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `PIPELINE_CONFIG GitHub Actions Variable (JSON)` connect `Pipeline Control & Deploy` to `Project Conventions & Agent Setup`, `Pipeline Config Module & Control UI`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `AWS Infrastructure Setup (Full AWS-Native)` connect `AWS Infrastructure Design` to `Pipeline Control & Deploy`, `CI Agents & Review Rules`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `Decision: Claude-only reviewers (Codex future toggle)`, `Decision: Local dev = agent team (Outcomes-driven)`, `Rationale: .github repo flipped public (public consumer can't use private modules)` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AWS Infrastructure Design` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Pipeline Control & Deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `CI Agents & Review Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
