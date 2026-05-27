#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  Project Pipeline Setup"
echo "========================================"
echo ""

# Detect repo
if ! REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null); then
  echo "Error: Not a GitHub repo or gh CLI not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

OWNER=$(echo "$REPO" | cut -d'/' -f1)
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)

echo "Repository: $REPO"
echo "Owner:      $OWNER"
echo ""

# Step 1: Install dependencies
echo "[1/7] Installing dependencies..."
if [ -f "package.json" ]; then
  npm install
  echo "  Done."
else
  echo "  No package.json found, skipping."
fi
echo ""

# Step 2: Create branches
echo "[2/7] Creating develop and staging branches..."
CURRENT=$(git branch --show-current)

for BRANCH in develop staging; do
  if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH" 2>/dev/null; then
    echo "  $BRANCH already exists on remote"
  elif git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    echo "  $BRANCH exists locally, pushing..."
    git push -u origin "$BRANCH"
  else
    echo "  Creating $BRANCH..."
    git checkout -b "$BRANCH"
    git push -u origin "$BRANCH"
  fi
done

git checkout "$CURRENT" 2>/dev/null
echo ""

# Step 3: Seed labels
echo "[3/7] Creating issue labels..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/seed-labels.sh" "$REPO"
echo ""

# Step 4: Branch protection
echo "[4/7] Applying branch protection rules..."
bash "$SCRIPT_DIR/setup-branch-protection.sh" "$REPO"
echo ""

# Step 5: Sprint board
echo "[5/7] Creating sprint board..."
bash "$SCRIPT_DIR/setup-sprint-board.sh" "$OWNER" "$REPO_NAME Sprint Board"
echo ""

# Step 6: Graphify knowledge graph
echo "[6/7] Knowledge graph setup..."
echo "  Run this manually after setup:"
echo "  claude '/graphify . --mode deep'"
echo "  The graph will be committed to graphify-out/"
echo ""

# Step 7: Verify
echo "[7/7] Verifying setup..."
echo ""
echo "  Branches:"
git branch -a | grep -E "(develop|staging|main)" | sed 's/^/    /'
echo ""
echo "  Workflows:"
ls -1 .github/workflows/ 2>/dev/null | sed 's/^/    /' || echo "    (none found)"
echo ""

echo "========================================"
echo "  Setup Complete"
echo "========================================"
echo ""
echo "Remaining manual steps:"
echo ""
echo "  1. Add ANTHROPIC_API_KEY to GitHub secrets (funds the CI Claude agents):"
echo "     gh secret set ANTHROPIC_API_KEY"
echo ""
echo "  2. (Optional) Set the PIPELINE_CONFIG variable to override stage toggles."
echo "     Org default steers every repo; a repo-level var overrides per project:"
echo "     gh variable set PIPELINE_CONFIG --repo $REPO --body \"\$(cat pipeline.config.default.json)\""
echo "     If unset, the pipeline falls back to the committed pipeline.config.default.json."
echo ""
echo "  3. Provision AWS infrastructure per environment (strictly AWS — no Vercel/Supabase):"
echo "     Aurora PostgreSQL + Cognito + S3 + Amplify Hosting or ECS Fargate."
echo "     Follow docs/AWS_INFRA_SETUP.md (accounts/SSO/OIDC -> network -> data -> auth -> compute)."
echo "     Set per-env app config (DATABASE_URL, COGNITO_*, S3_BUCKET, NEXT_PUBLIC_*) there."
echo ""
echo "  4. Update CLAUDE.md with project-specific details."
echo ""
echo "  5. Customize the sprint board columns in GitHub Projects UI:"
echo "     Add: Grooming, Claude Ready, In Review, QA/UAT"
echo ""
echo "  6. Generate initial knowledge graph:"
echo "     claude '/graphify . --mode deep'"
echo ""
echo "  7. Confirm branch protection requires the single 'gate' check, then start writing stories!"
echo ""
