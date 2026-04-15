# Pipeline Template Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every gap in `suyash-project-template` so that running `scripts/setup-project.sh` on a freshly cloned repo produces a fully wired pipeline with CI/CD, Claude agents, Graphify knowledge graph, commit message enforcement, E2E testing, and correct ownership.

**Architecture:** The template repo already has 7 GitHub Action workflows, 4 issue templates, 4 setup scripts, and a full dev-tooling stack (Next.js 16, Vitest, ESLint, Husky). This plan fills the remaining gaps: add Playwright E2E config, commit-msg hook, Graphify CI workflow, fix CODEOWNERS placeholder, update setup-project.sh to include Graphify bootstrap, and add a commitlint config for conventional commits.

**Tech Stack:** GitHub Actions, Playwright, Husky, commitlint, Graphify (Claude Code skill), shell scripts

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `playwright.config.ts` | E2E test configuration (Chromium, base URL, webServer) |
| Create | `.husky/commit-msg` | Runs commitlint on commit messages |
| Create | `commitlint.config.js` | Conventional commit rules |
| Create | `.github/workflows/update-knowledge-graph.yml` | Rebuilds Graphify graph on merge to develop |
| Create | `e2e/smoke.spec.ts` | Minimal E2E smoke test (homepage loads) |
| Modify | `.github/CODEOWNERS` | Replace `YOUR_GITHUB_USERNAME` → `suyashbhatia` |
| Modify | `scripts/setup-project.sh` | Add Graphify bootstrap step |
| Modify | `package.json` | Add Playwright + commitlint devDependencies and scripts |
| Modify | `CLAUDE.md` | Add Knowledge Graph section |
| Modify | `AGENTS.md` | Add Graphify instructions for agents |

---

### Task 1: Add Playwright E2E Configuration

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Playwright and E2E scripts to package.json**

Add `@playwright/test` to devDependencies and add the E2E scripts:

```json
// In devDependencies, add:
"@playwright/test": "^1.52.0"

// In scripts, add:
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
      },
});
```

- [ ] **Step 3: Create `e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.*/);
  expect(page.url()).toContain("/");
});
```

- [ ] **Step 4: Run the E2E test locally to verify**

Run: `npx playwright install chromium && npx playwright test`
Expected: 1 test passes (homepage loads)

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts package.json
git commit -m "feat: add Playwright E2E config and smoke test"
```

---

### Task 2: Add Commit Message Validation (commitlint + Husky)

**Files:**
- Create: `commitlint.config.js`
- Create: `.husky/commit-msg`
- Modify: `package.json`

- [ ] **Step 1: Add commitlint dependencies to package.json**

```json
// In devDependencies, add:
"@commitlint/cli": "^19.8.1",
"@commitlint/config-conventional": "^19.8.1"
```

- [ ] **Step 2: Create `commitlint.config.js`**

```js
export default { extends: ["@commitlint/config-conventional"] };
```

- [ ] **Step 3: Create `.husky/commit-msg`**

```bash
npx --no -- commitlint --edit $1
```

- [ ] **Step 4: Make the hook executable**

Run: `chmod +x .husky/commit-msg`

- [ ] **Step 5: Test that a bad commit message is rejected**

Run: `echo "bad message" | npx commitlint`
Expected: Error — subject must not be empty, type must not be empty

- [ ] **Step 6: Test that a good commit message passes**

Run: `echo "feat: add commitlint" | npx commitlint`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add commitlint.config.js .husky/commit-msg package.json
git commit -m "feat: add commitlint with conventional commit enforcement"
```

---

### Task 3: Add Knowledge Graph CI Workflow

**Files:**
- Create: `.github/workflows/update-knowledge-graph.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Update Knowledge Graph
on:
  push:
    branches: [develop]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-graph:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          model: sonnet
          prompt: |
            Run /graphify . --update to refresh the knowledge graph
            with the latest code changes.

      - name: Commit graph updates
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if git diff --quiet graphify-out/ 2>/dev/null; then
            echo "No graph changes to commit"
          else
            git add graphify-out/
            git commit -m "chore: update knowledge graph [skip ci]"
            git push
          fi
```

- [ ] **Step 2: Verify the YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/update-knowledge-graph.yml'))"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/update-knowledge-graph.yml
git commit -m "feat: add knowledge graph auto-update workflow on merge to develop"
```

---

### Task 4: Fix CODEOWNERS Placeholder

**Files:**
- Modify: `.github/CODEOWNERS`

- [ ] **Step 1: Replace the placeholder username**

Replace every instance of `@YOUR_GITHUB_USERNAME` with `@suyashbhatia` in `.github/CODEOWNERS`.

The file should become:

```
# Default owner for everything
* @suyashbhatia

# Auth and security-sensitive code — always require review
src/middleware.ts @suyashbhatia
src/lib/supabase/ @suyashbhatia
src/app/auth/ @suyashbhatia
src/lib/session.ts @suyashbhatia

# Database schema changes — always require review
prisma/ @suyashbhatia
sql/ @suyashbhatia

# CI/CD pipeline changes — always require review
.github/ @suyashbhatia
```

- [ ] **Step 2: Commit**

```bash
git add .github/CODEOWNERS
git commit -m "chore: set CODEOWNERS to suyashbhatia"
```

---

### Task 5: Update Setup Script With Graphify Bootstrap

**Files:**
- Modify: `scripts/setup-project.sh`

- [ ] **Step 1: Add Graphify step to setup-project.sh**

After the existing `[6/6] Verifying setup...` block, change the step counter from 6 to 7 throughout and add a new step 7 before the verify step (which becomes step 7, and verify becomes step... actually, simpler approach):

Update the script to change `[6/6]` → `[7/7]` for the verify step, and insert a new `[6/7]` step before it:

Insert this block before the `[6/6] Verifying setup...` line (and renumber the verify step to `[7/7]`):

```bash
# Step 6: Graphify initial graph
echo "[6/7] Generating initial knowledge graph..."
echo "  (This requires the Graphify Claude Code skill)"
echo "  Run manually: claude '/graphify . --mode deep'"
echo "  The graph will be committed to graphify-out/"
echo ""
```

Also update all previous step numbers: `[1/6]` → `[1/7]`, `[2/6]` → `[2/7]`, etc.

And update the verify step from `[6/6]` → `[7/7]`.

Update the "Remaining manual steps" to include:

```bash
echo "  6. Generate initial knowledge graph:"
echo "     claude '/graphify . --mode deep'"
echo ""
echo "  7. Start writing stories!"
```

- [ ] **Step 2: Test the script parses correctly**

Run: `bash -n scripts/setup-project.sh`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-project.sh
git commit -m "feat: add Graphify bootstrap step to setup-project.sh"
```

---

### Task 6: Add Knowledge Graph Section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Knowledge Graph section to CLAUDE.md**

Append this section before the `## Git Workflow` section:

```markdown
## Knowledge Graph
A Graphify knowledge graph is maintained at `graphify-out/`.
- For architecture questions, read `graphify-out/GRAPH_REPORT.md` first
- For dependency lookups, query `graphify-out/graph.json`
- Do NOT re-read entire directories when the graph can answer your question
- The graph is auto-updated on merge to develop via CI
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Knowledge Graph section to CLAUDE.md template"
```

---

### Task 7: Add Graphify Instructions to AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add Graphify section to AGENTS.md**

Append this section at the end of AGENTS.md:

```markdown

## Using the Knowledge Graph (All Agents)
- Before exploring the codebase, check `graphify-out/GRAPH_REPORT.md` for architecture context
- Query `graphify-out/graph.json` for dependency relationships instead of reading dozens of files
- This saves tokens and gives you a more accurate picture of the codebase structure
- If the graph is outdated (check the commit date), fall back to reading files directly
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add Graphify usage instructions for agents"
```

---

### Task 8: Install Dependencies and Verify Everything Works

**Files:**
- None new — this is a verification task

- [ ] **Step 1: Install all dependencies**

Run: `cd /Users/suyashbhatia/Github/suyash-project-template && npm install`
Expected: Clean install with no errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: Smoke test passes

- [ ] **Step 4: Run commitlint on a sample message**

Run: `echo "feat: test message" | npx commitlint`
Expected: No errors

- [ ] **Step 5: Verify all workflow files parse correctly**

Run: `for f in .github/workflows/*.yml; do python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "OK: $f"; done`
Expected: All 8 workflows parse successfully (7 existing + 1 new)

- [ ] **Step 6: Verify Playwright is installed**

Run: `npx playwright --version`
Expected: Prints version number (1.52.x)

- [ ] **Step 7: Final commit if any lockfile changes**

```bash
git add package-lock.json
git commit -m "chore: update lockfile after dependency installation"
```

---

## Task Summary

| Task | What | Files |
|------|------|-------|
| 1 | Playwright E2E config + smoke test | `playwright.config.ts`, `e2e/smoke.spec.ts`, `package.json` |
| 2 | Commitlint + commit-msg hook | `commitlint.config.js`, `.husky/commit-msg`, `package.json` |
| 3 | Knowledge graph CI workflow | `.github/workflows/update-knowledge-graph.yml` |
| 4 | Fix CODEOWNERS placeholder | `.github/CODEOWNERS` |
| 5 | Add Graphify to setup script | `scripts/setup-project.sh` |
| 6 | Add Knowledge Graph to CLAUDE.md | `CLAUDE.md` |
| 7 | Add Graphify instructions to AGENTS.md | `AGENTS.md` |
| 8 | Install deps + verify everything works | (verification only) |

**Dependencies:** Tasks 1 and 2 both modify `package.json` — run them sequentially. Tasks 3-7 are independent of each other and of 1-2. Task 8 must run last.
