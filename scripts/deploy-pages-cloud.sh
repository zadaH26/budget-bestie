#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-budget-bestie}"
ENV_FILE="${2:-.env.cloud}"

echo "==> Budget Bestie cloud deploy (Supabase account sync mode)"
echo "Project: ${PROJECT_NAME}"

if [[ -f "${ENV_FILE}" ]]; then
  echo "Loading ${ENV_FILE}"
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
fi

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Missing Supabase env vars."
  echo "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in shell or ${ENV_FILE})."
  exit 1
fi

export VITE_ENABLE_CLOUD_SYNC=true
export VITE_STATE_ENDPOINT=

npm run build
npx wrangler pages deploy dist --project-name "${PROJECT_NAME}" --commit-dirty=true

echo ""
echo "Deploy complete."
echo "Mode: cloud accounts via Supabase."
echo "To return to strict free-safe local mode:"
echo "npm run deploy:pages:free -- ${PROJECT_NAME}"
