# Project Name

> This is the template CLAUDE.md. Copy this to CLAUDE.md and fill in project-specific details.
> Delete this notice and the `.template` file after customizing.

## Tech Stack

- **Framework:** <!-- e.g., Next.js 16 (App Router, TypeScript) -->
- **Styling:** <!-- e.g., Tailwind CSS v4 -->
- **Database:** <!-- e.g., Aurora PostgreSQL (Serverless v2) + Prisma ORM -->
- **Auth:** <!-- e.g., Amazon Cognito (Google, Apple via IdP) -->
- **Hosting:** <!-- e.g., AWS Amplify Hosting (or ECS Fargate) -->

## Commands

```sh
npm run dev    # Start dev server
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
npm test       # Run tests (Vitest)
```

## Project Structure

```
src/
  app/          # App Router pages & layouts
  components/   # Shared components
  lib/          # Utilities & helpers
```

## Conventions

- Components use PascalCase filenames: `MyComponent.tsx`
- Utilities use kebab-case: `my-helper.ts`
- Every new module under `src/lib/` ships with unit tests; coverage thresholds are enforced (see `vitest.config.ts`) and PRs that drop below them fail CI
- Test files live beside their source: `my-helper.ts` → `my-helper.test.ts`
- All database changes go through `sql/` migration files (numbered: 001-, 002-, etc.)
- Never make manual schema changes in the AWS console or directly against the database — migrations only
- Reach the database (Aurora via Prisma) only from server code (Server Components, API routes, Server Actions); never from Client Components
- On each request, validate the Cognito JWT server-side and scope the DB session to the user (`SET LOCAL app.user_id = '<cognito-sub>'`) so Postgres RLS applies — see `docs/AWS_INFRA_SETUP.md` §5

## Environments

| Env  | Branch    | Database              |
| ---- | --------- | --------------------- |
| INT  | `develop` | <!-- project-int -->  |
| UAT  | `staging` | <!-- project-uat -->  |
| PROD | `main`    | <!-- project-prod --> |

## Design Reference

<!-- Link to Figma, screenshot directories, or design system docs -->

## Knowledge Graph

A Graphify knowledge graph is maintained at `graphify-out/`.

- For architecture questions, read `graphify-out/GRAPH_REPORT.md` first
- For dependency lookups, query `graphify-out/graph.json`
- Do NOT re-read entire directories when the graph can answer your question
- The graph is auto-updated on merge to develop via CI

## Git Workflow

- Never commit directly to `main`, `staging`, or `develop`
- Create feature branches: `feature/<issue-number>-<short-description>`
- PRs are reviewed by Claude PR Reviewer and Claude Security Scanner
- Flow: feature branch → develop → staging → main
