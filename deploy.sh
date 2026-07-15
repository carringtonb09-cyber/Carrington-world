#!/usr/bin/env bash
#
# deploy.sh — commit, push, and publish carringtonbrown.com in one step.
#
#   Usage:  ./deploy.sh "what you changed"
#           ./deploy.sh                 # redeploy current commit, no changes
#
# Why this exists: Render's auto-deploy-on-push webhook is unreliable for this
# site, so this script triggers the deploy directly through the Render API and
# waits until it is actually live. No dashboard needed.

set -euo pipefail

# --- config (not secret) ---
SID="srv-d6rs9f7fte5s73esq5m0"          # Render static site: carrington-world
SITE="https://carringtonbrown.com"
API="https://api.render.com/v1/services/${SID}"

cd "$(dirname "$0")"

# --- preflight ---
if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "ERROR: RENDER_API_KEY is not set." >&2
  echo "It lives in ~/.zshrc — open a new terminal, or run:  source ~/.zshrc" >&2
  exit 1
fi
AUTH="Authorization: Bearer ${RENDER_API_KEY}"
MSG="${1:-Update site}"

# --- 1. commit local changes (if any) ---
if [ -n "$(git status --porcelain)" ]; then
  echo "→ committing changes: $MSG"
  git add -A
  git commit -m "$MSG" >/dev/null
else
  echo "→ no local changes; redeploying current commit"
fi

# --- 2. push to GitHub ---
echo "→ pushing to GitHub..."
git push origin main

# --- 3. trigger Render deploy (clears cache so changes show immediately) ---
echo "→ triggering Render deploy..."
DID=$(curl -s --http1.1 -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"clearCache":"clear"}' "${API}/deploys" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  deploy id: $DID"

# --- 4. wait until live ---
echo "→ building (usually ~1-2 min)..."
for i in $(seq 1 40); do
  ST=$(curl -s --http1.1 -H "$AUTH" "${API}/deploys/${DID}" \
       | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
  echo "  [$i] $ST"
  case "$ST" in
    live)            echo "✅ LIVE — ${SITE}"; exit 0 ;;
    build_failed|update_failed|canceled|deactivated)
                     echo "❌ deploy $ST — see https://dashboard.render.com/static/${SID}" >&2; exit 1 ;;
  esac
  sleep 6
done

echo "⏱  Still building after a few minutes — check the dashboard." >&2
exit 1
