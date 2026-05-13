#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-budget-bestie-app}"
STATE_CONFIG="${2:-cloudflare/wrangler.state.toml}"

echo "==> Budget Bestie free deploy (cross-browser state sync mode)"
echo "Pages project: ${PROJECT_NAME}"
echo "State worker config: ${STATE_CONFIG}"

STATE_DEPLOY_OUTPUT="$(npx wrangler deploy --config "${STATE_CONFIG}" 2>&1)"
echo "${STATE_DEPLOY_OUTPUT}"

STATE_URL="$(printf '%s\n' "${STATE_DEPLOY_OUTPUT}" | sed -n 's#.*\(https://[^ ]*workers.dev\).*#\1#p' | tail -n 1)"
if [[ -z "${STATE_URL}" ]]; then
  echo "Could not detect deployed worker URL from wrangler output."
  echo "Deploy output above should include the workers.dev URL."
  exit 1
fi

STATE_ENDPOINT="${STATE_URL%/}/state"

export VITE_ENABLE_CLOUD_SYNC=false
export VITE_SUPABASE_URL=
export VITE_SUPABASE_ANON_KEY=
export VITE_STATE_ENDPOINT="${STATE_ENDPOINT}"

echo "Using state endpoint: ${STATE_ENDPOINT}"
npm run build
npx wrangler pages deploy dist --project-name "${PROJECT_NAME}" --commit-dirty=true

echo ""
echo "Deploy complete."
echo "Site URL: https://${PROJECT_NAME}.pages.dev"
echo "State sync API: ${STATE_ENDPOINT}"
echo "Mode: free shared sync + username/password app accounts."
