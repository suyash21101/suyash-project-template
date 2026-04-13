# Project Name

> This is the template CLAUDE.md. Copy this to CLAUDE.md and fill in project-specific details.
> Delete this notice and the `.template` file after customizing.

## Tech Stack
- **Framework:** <!-- e.g., Next.js 16 (App Router, TypeScript) -->
- **Styling:** <!-- e.g., Tailwind CSS v4 -->
- **Database:** <!-- e.g., Supabase (PostgreSQL) + Prisma ORM -->
- **Auth:** <!-- e.g., Supabase Auth (Google, Apple OAuth) -->
- **Hosting:** <!-- e.g., Vercel -->

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
- All database changes go through `sql/` migration files (numbered: 001-, 002-, etc.)
- Never make manual schema changes in Supabase dashboard
- Use the Supabase server client (`src/lib/supabase/server.ts`) in Server Components and API routes
- Use the Supabase browser client (`src/lib/supabase/client.ts`) only in Client Components

## Environments
| Env | Branch | Database |
|---|---|---|
| INT | `develop` | <!-- project-int --> |
| UAT | `staging` | <!-- project-uat --> |
| PROD | `main` | <!-- project-prod --> |

## Design Reference
<!-- Link to Figma, screenshot directories, or design system docs -->

## Git Workflow
- Never commit directly to `main`, `staging`, or `develop`
- Create feature branches: `feature/<issue-number>-<short-description>`
- PRs are reviewed by Claude PR Reviewer and Claude Security Scanner
- Flow: feature branch → develop → staging → main
