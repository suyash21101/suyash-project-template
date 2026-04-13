#!/bin/bash
set -euo pipefail

OWNER="${1:?Usage: ./setup-sprint-board.sh <github-username> <project-title>}"
TITLE="${2:-Sprint Board}"

echo "Creating GitHub Project: $TITLE for @$OWNER..."

# Create the project
PROJECT_NUM=$(gh project create \
  --owner "$OWNER" \
  --title "$TITLE" \
  --format json 2>/dev/null | jq -r '.number' 2>/dev/null)

if [ -z "$PROJECT_NUM" ] || [ "$PROJECT_NUM" = "null" ]; then
  echo "Error: Could not create project. Make sure you have the right permissions."
  echo "You may need to run: gh auth refresh -s project"
  exit 1
fi

echo "  Project #$PROJECT_NUM created."

# Add custom fields
echo "Adding custom fields..."

gh project field-create "$PROJECT_NUM" \
  --owner "$OWNER" \
  --name "Size" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "XS,S,M,L,XL" 2>/dev/null && echo "  + Size" || echo "  ~ Size (may already exist)"

gh project field-create "$PROJECT_NUM" \
  --owner "$OWNER" \
  --name "Type" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Feature,Bug,Chore,Spike" 2>/dev/null && echo "  + Type" || echo "  ~ Type (may already exist)"

gh project field-create "$PROJECT_NUM" \
  --owner "$OWNER" \
  --name "Priority" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "P0-Critical,P1-High,P2-Medium,P3-Low" 2>/dev/null && echo "  + Priority" || echo "  ~ Priority (may already exist)"

gh project field-create "$PROJECT_NUM" \
  --owner "$OWNER" \
  --name "Agent Compatible" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Yes,Needs Clarification,No" 2>/dev/null && echo "  + Agent Compatible" || echo "  ~ Agent Compatible (may already exist)"

gh project field-create "$PROJECT_NUM" \
  --owner "$OWNER" \
  --name "Risk" \
  --data-type "SINGLE_SELECT" \
  --single-select-options "Low,Medium,High" 2>/dev/null && echo "  + Risk" || echo "  ~ Risk (may already exist)"

echo ""
echo "Sprint board setup complete."
echo "View it at: https://github.com/users/$OWNER/projects/$PROJECT_NUM"
echo ""
echo "Next steps:"
echo "  1. Open the project in GitHub"
echo "  2. Switch to Board view"
echo "  3. The Status field columns will be: Backlog, Ready, In Progress, Done"
echo "     (Customize to add: Grooming, Claude Ready, In Review, QA/UAT)"
echo "  4. Link the project to your repo: Settings > Projects > Add project"
