#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-budget-bestie}"

echo "==> Budget Bestie free deploy (Cloudflare Pages static mode)"
echo "Project: ${PROJECT_NAME}"

# Force strict local-only mode at build time (no cloud auth/sync).
export VITE_ENABLE_CLOUD_SYNC=false
export VITE_SUPABASE_URL=
export VITE_SUPABASE_ANON_KEY=
export VITE_STATE_ENDPOINT=

npm run build
npx wrangler pages deploy dist --project-name "${PROJECT_NAME}" --commit-dirty=true

echo ""
echo "Deploy complete."
echo "Mode: local-only (free-safe)."
echo "If you need to stop public usage later, delete the Pages project in Cloudflare dashboard."
