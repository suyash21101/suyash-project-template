#!/bin/bash
set -euo pipefail

REPO="${1:?Usage: ./setup-branch-protection.sh owner/repo}"

echo "Setting up branches for $REPO..."

# Ensure develop and staging branches exist
CURRENT=$(git branch --show-current)

for BRANCH in develop staging; do
  if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    echo "  Branch $BRANCH already exists locally"
  else
    echo "  Creating branch $BRANCH..."
    git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
  fi
  git push -u origin "$BRANCH" 2>/dev/null || echo "  $BRANCH already pushed"
done

git checkout "$CURRENT"

echo ""
echo "Applying branch protection rules..."

# main — strictest
echo "  Protecting main..."
gh api "repos/$REPO/branches/main/protection" \
  --method PUT \
  --silent \
  --input - <<'EOF'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint",
      "Type Check",
      "Unit Tests",
      "Build",
      "Prisma Validate",
      "Claude Security Scan"
    ]
  },
  "enforce_admins": false,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
echo "    main protected."

# staging — requires CI but less strict
echo "  Protecting staging..."
gh api "repos/$REPO/branches/staging/protection" \
  --method PUT \
  --silent \
  --input - <<'EOF'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint",
      "Type Check",
      "Build"
    ]
  },
  "enforce_admins": false,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
echo "    staging protected."

# develop — loosest, just basic CI
echo "  Protecting develop..."
gh api "repos/$REPO/branches/develop/protection" \
  --method PUT \
  --silent \
  --input - <<'EOF'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false
  },
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "Lint",
      "Type Check",
      "Build"
    ]
  },
  "enforce_admins": false,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
echo "    develop protected."

echo ""
echo "Branch protection setup complete."
