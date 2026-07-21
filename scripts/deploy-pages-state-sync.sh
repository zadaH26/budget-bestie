#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-budget-bestie-app}"
STATE_CONFIG="${2:-cloudflare/wrangler.state.toml}"
PAGES_BRANCH="${3:-main}"

echo "==> Budget Bestie free deploy (cross-browser state sync mode)"
echo "Pages project: ${PROJECT_NAME}"
echo "State worker config: ${STATE_CONFIG}"
echo "Pages branch: ${PAGES_BRANCH}"

STATE_DEPLOY_OUTPUT="$(npx wrangler deploy --config "${STATE_CONFIG}" 2>&1)"
echo "${STATE_DEPLOY_OUTPUT}"

STATE_URL="$(printf '%s\n' "${STATE_DEPLOY_OUTPUT}" | sed -n 's#.*\(https://[^ ]*workers.dev\).*#\1#p' | tail -n 1)"
if [[ -z "${STATE_URL}" ]]; then
  echo "Could not detect deployed worker URL from wrangler output."
  echo "Deploy output above should include the workers.dev URL."
  exit 1
fi

STATE_ENDPOINT="${STATE_URL%/}/state"
ACCOUNT_SYNC_ENDPOINT="${STATE_URL%/}/account"

export VITE_ENABLE_CLOUD_SYNC=false
export VITE_SUPABASE_URL=
export VITE_SUPABASE_ANON_KEY=
export VITE_STATE_ENDPOINT="${STATE_ENDPOINT}"
export VITE_ACCOUNT_SYNC_ENDPOINT="${ACCOUNT_SYNC_ENDPOINT}"

echo "Using state endpoint: ${STATE_ENDPOINT}"
echo "Using account sync endpoint: ${ACCOUNT_SYNC_ENDPOINT}"
npm run build
npx wrangler pages deploy dist --project-name "${PROJECT_NAME}" --branch "${PAGES_BRANCH}" --commit-dirty=true

echo ""
echo "Deploy complete."
echo "Site URL: https://${PROJECT_NAME}.pages.dev"
echo "State sync API: ${STATE_ENDPOINT}"
echo "Account sync API: ${ACCOUNT_SYNC_ENDPOINT}"
echo "Mode: free account-scoped sync + username/password app accounts."
