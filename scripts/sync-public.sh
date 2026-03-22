#!/usr/bin/env bash
# sync-public.sh — Sync private repo content to public repo (undes)
#
# Usage:
#   ./scripts/sync-public.sh                    # sync + commit + push
#   ./scripts/sync-public.sh --dry-run          # preview what would change
#   ./scripts/sync-public.sh --no-push          # sync + commit, skip push
#   ./scripts/sync-public.sh --message "feat: ..." # custom commit message
#
# Prerequisites:
#   - PUBLIC_REPO_PATH env var or ../undes-public as default
#   - Both repos on the same machine

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRIVATE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXCLUDE_FILE="$SCRIPT_DIR/public-exclude.txt"

# Defaults
PUBLIC_ROOT="${PUBLIC_REPO_PATH:-$(cd "$PRIVATE_ROOT/../undes-public" 2>/dev/null && pwd || echo "")}"
DRY_RUN=false
NO_PUSH=false
COMMIT_MSG=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --no-push) NO_PUSH=true; shift ;;
    --message) COMMIT_MSG="$2"; shift 2 ;;
    --public-path) PUBLIC_ROOT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$PUBLIC_ROOT" ]]; then
  echo "ERROR: Public repo path not found."
  echo "Set PUBLIC_REPO_PATH env var or place public repo at ../undes-public"
  exit 1
fi

if [[ ! -d "$PUBLIC_ROOT/.git" ]]; then
  echo "ERROR: $PUBLIC_ROOT is not a git repository"
  exit 1
fi

if [[ ! -f "$EXCLUDE_FILE" ]]; then
  echo "ERROR: Exclude file not found: $EXCLUDE_FILE"
  exit 1
fi

echo "=== sync-public ==="
echo "Private: $PRIVATE_ROOT"
echo "Public:  $PUBLIC_ROOT"
echo "Exclude: $EXCLUDE_FILE"
echo ""

# Build rsync command
RSYNC_ARGS=(
  -av
  --delete
  --exclude-from="$EXCLUDE_FILE"
  # Always exclude git internals and .gitignore-d files
  --exclude=".git/"
  --exclude="node_modules/"
  --exclude=".env"
  --exclude=".ai.env"
  --exclude=".ai/"
  --exclude="coverage/"
  --exclude=".tmp-test-work/"
  --exclude=".context_bundle.md"
  --exclude=".context_cache.json"
  --exclude=".gemini/"
  --exclude="commercial-addons-local/"
)

if $DRY_RUN; then
  RSYNC_ARGS+=(--dry-run)
  echo "[DRY RUN] Would sync:"
fi

rsync "${RSYNC_ARGS[@]}" "$PRIVATE_ROOT/" "$PUBLIC_ROOT/"

if $DRY_RUN; then
  echo ""
  echo "[DRY RUN] No changes made."
  exit 0
fi

# Sanitize: replace any remaining absolute paths in synced files
echo ""
echo "Sanitizing absolute paths..."
find "$PUBLIC_ROOT" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.json" \) \
  ! -path "$PUBLIC_ROOT/.git/*" \
  ! -path "$PUBLIC_ROOT/node_modules/*" \
  -exec grep -l "/home/kair/" {} \; 2>/dev/null | while read -r file; do
  echo "  WARNING: $file still contains /home/kair/ paths — review manually"
done

# Commit and push
cd "$PUBLIC_ROOT"

if [[ -z "$(git status --porcelain)" ]]; then
  echo ""
  echo "No changes to commit in public repo."
  exit 0
fi

echo ""
echo "Changes in public repo:"
git status -s

git add -A

if [[ -z "$COMMIT_MSG" ]]; then
  # Use latest private commit message as default
  COMMIT_MSG="$(cd "$PRIVATE_ROOT" && git log -1 --format="%s")"
fi

git commit -m "$COMMIT_MSG"

if $NO_PUSH; then
  echo ""
  echo "Committed. Skipping push (--no-push)."
else
  git push origin main
  echo ""
  echo "Pushed to public repo."
fi

echo ""
echo "=== sync-public done ==="
