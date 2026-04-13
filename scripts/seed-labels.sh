#!/bin/bash
set -euo pipefail

REPO="${1:?Usage: ./seed-labels.sh owner/repo}"

echo "Seeding labels for $REPO..."

LABELS=(
  # Type
  "feature:22c55e:Feature story"
  "bug:ef4444:Bug report"
  "chore:6b7280:Tech debt or infrastructure"
  "spike:8b5cf6:Research or investigation"

  # Agent
  "claude-ready:3b82f6:Agent can pick this up"
  "claude-blocked:f97316:Agent tried and needs human input"
  "claude-in-progress:a855f7:Agent is actively working on this"

  # Priority
  "priority/p0:dc2626:Critical — app broken or data loss"
  "priority/p1:ea580c:High — major feature broken"
  "priority/p2:eab308:Medium — broken with workaround"
  "priority/p3:9ca3af:Low — minor or cosmetic"

  # Size
  "size/xs:bfdbfe:Trivial, under 30 min"
  "size/s:93c5fd:Small, 1-2 hours"
  "size/m:3b82f6:Medium, half day"
  "size/l:1d4ed8:Large, full day"
  "size/xl:1e3a5f:Extra large, multi-day"

  # Area
  "area/auth:14b8a6:Authentication and sessions"
  "area/onboarding:14b8a6:Onboarding flow"
  "area/ui:14b8a6:UI components and styling"
  "area/api:14b8a6:API routes and server actions"
  "area/database:14b8a6:Database schema and migrations"
  "area/infra:14b8a6:Infrastructure and CI/CD"
  "area/testing:14b8a6:Tests and test infrastructure"

  # Status
  "needs-design:ec4899:Needs design work before implementation"
  "needs-grooming:eab308:Needs acceptance criteria and context"
  "blocked:ef4444:Blocked by external dependency"
  "duplicate:cfd3d7:Duplicate of another issue"
  "wontfix:cfd3d7:Will not be addressed"
)

for label_def in "${LABELS[@]}"; do
  IFS=':' read -r name color description <<< "$label_def"
  if gh label create "$name" \
    --repo "$REPO" \
    --color "$color" \
    --description "$description" \
    --force 2>/dev/null; then
    echo "  + $name"
  else
    echo "  ~ $name (already exists, updated)"
  fi
done

echo ""
echo "Done. $(echo "${LABELS[@]}" | wc -w) labels seeded."
