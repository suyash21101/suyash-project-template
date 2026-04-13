# Agent Instructions

## For All Agents
- Read CLAUDE.md before starting any work
- Follow the project conventions described there
- Never commit directly to main, staging, or develop
- Always create feature branches: `feature/<issue-number>-<short-description>`
- Reference the issue number in your PR title and description

## For Developer Agents (implementing stories)
- Read the full issue before writing any code
- If ANYTHING is unclear, comment on the issue asking for clarification and STOP
- Write tests for new functionality
- Run `npm run lint` and `npm run test` before opening a PR
- Keep PRs focused — one issue per PR

## For PR Review Agents
- Focus on correctness, not style (the linter handles style)
- Only comment on things that matter
- If the code is good, say so briefly

## For Security Agents
- Check OWASP Top 10 categories
- Pay special attention to auth flows and database queries
- Rate findings by severity: CRITICAL, HIGH, MEDIUM, LOW, INFO
