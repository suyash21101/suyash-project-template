# Conversation Summary — Pipeline Design Session

**Date:** 2026-05-26
**Outcome:** Designed (not yet built) a modular, agent-driven CI/CD pipeline on an AWS-native stack,
controllable from a deployed UI. All work is documentation + decisions; nothing committed to git yet.

---

## What we did

Reviewed the existing `PIPELINE_PLAYBOOK.md`, then brainstormed and extended it across several rounds:
chose project-management tooling, folded in 2026 Claude/ChatGPT features, defined the checks/tests
strategy and model split, designed a modular control plane, switched it from a static local file to a
deployed GitHub-Variables-backed UI, wrote an AWS-native infra reference, and produced a phased build
roadmap with an integrations/access map.

## Artifacts produced

| File                                | What it is                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PIPELINE_PLAYBOOK.md`              | Updated: §16 (2026 capabilities — agent teams, hooks, ultrareview, Codex QA, Dreaming), §17 (Modular Pipeline Control), §4 billing note |
| `AWS_INFRA_SETUP.md`                | New: full AWS-native infra (Aurora + Cognito + S3, Amplify _and_ Fargate), CDK, OIDC, 16-step checklist                                 |
| `GITHUB_DOTFILES_REPO_CHECKLIST.md` | New: build checklist for the `suyash21101/.github` reusable-workflows repo                                                              |
| `BUILD_ROADMAP.md`                  | New: 6-phase build guide + control-plane design + integrations/access map                                                               |
| `SAMPLE_SETUP_LOG.md`               | Running decision log (all locked decisions + open questions)                                                                            |
| `CONVERSATION_SUMMARY.md`           | This file                                                                                                                               |

## Key decisions (full detail in `SAMPLE_SETUP_LOG.md`)

- **PM:** GitHub Projects.
- **Review:** Claude-only per-PR now; Codex a future toggle.
- **Local dev:** agent team (implementer + test-writer + self-reviewer), Outcomes-driven.
- **Deep review:** `/ultrareview` before `staging → main`. **End QA:** Codex computer-use on UAT.
- **Modularity:** reusable `workflow_call` modules + a `gate` aggregator as the single required check.
- **Control plane:** `PIPELINE_CONFIG` GitHub Variable (runtime-fetched) + a deployed thin UI.
- **Infra:** full AWS-native. **Repo strategy:** reusable workflows in user-level `.github` repo.

## Open / next

- Resolve: AWS account model, IaC tool (CDK vs Terraform), coverage thresholds.
- Commit the doc set to a branch (nothing committed yet).
- Build Phase 1: `PIPELINE_CONFIG` schema + orchestrator gating + deployed control UI.

---

## Questions / requests I asked (in order)

1. Does this folder have a pipeline playbook?
2. Explain the functioning of the entire pipeline with reference — I want to set up and record progress on the side.
3. (Set up a progress file.) Give a more detailed view of the pipeline; what service for project management; walk through starting a story; brainstorm; list new Claude/ChatGPT features released since we last spoke.
4. Add to the plan: usage of `/ultrareview`, agent teams, ChatGPT computer use for testing at the end. Find more newly-released features I haven't discussed and how to use them.
5. Give a detailed review of the checks/tests we require; how to use Dreaming and the model-use split; how to modularly control pipeline stages; create a detailed AWS infra setup doc; do I need a separate build-pipeline repo or keep it here?
6. Do we have something about GitHub rules setup documented in this?
7. What did you do/discuss to make the pipeline in `PIPELINE_PLAYBOOK.md` modular?
8. Go ahead and add that to the playbook now. When will you make the `workflow_call` reusable modules?
9. Can you make a detailed checklist of the `.github` repo?
10. Where do I add the basic rules, i.e. each piece of code should be unit tested?
11. Does something like Maven remain constant across software dev projects of various languages?
12. Give a full step-by-step guide to bring this idea to life — I want modularity at every stage (e.g. turn off some testing); maybe a cute deployed/static HTML UI that saves controls and is pulled at commit/push.
13. Instead of a static UI, can I have a deployed UI to toggle/customize from elsewhere — what are my options?
14. How do I begin implementing this sample project — give me the full roadmap again.
15. Add to the plan the integrations I'll need and where to set up AWS interaction so agents can act easily; what else to set up. Summarize this conversation in a small file and list all the questions I asked.
