#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-budget-bestie}"

echo "This will remove the public Cloudflare Pages site for project: ${PROJECT_NAME}"
read -r -p "Type DELETE to confirm: " CONFIRM

if [[ "${CONFIRM}" != "DELETE" ]]; then
  echo "Canceled."
  exit 1
fi

npx wrangler pages project delete "${PROJECT_NAME}"
echo "Public site deleted. Your local copy is still available with npm run dev."
