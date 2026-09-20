#!/usr/bin/env bash
# Deploy modal_morena.py using the mothertongue Modal account.
# Credentials are read from .env.local (MODAL_TOKEN_ID_MORENA / MODAL_TOKEN_SECRET_MORENA)
# so the global ~/.modal.toml (your other account) is never touched.
#
# Usage: bash scripts/deploy_morena.sh

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env.local not found at $ENV_FILE" >&2
  exit 1
fi

# Read only the two morena-specific token vars from .env.local
TOKEN_ID=$(grep -E '^MODAL_TOKEN_ID_MORENA=' "$ENV_FILE" | cut -d= -f2-)
TOKEN_SECRET=$(grep -E '^MODAL_TOKEN_SECRET_MORENA=' "$ENV_FILE" | cut -d= -f2-)
ENDPOINT_SECRET=$(grep -E '^MORENA_ENDPOINT_SECRET=' "$ENV_FILE" | cut -d= -f2-)

if [[ -z "$TOKEN_ID" || -z "$TOKEN_SECRET" ]]; then
  echo "Error: MODAL_TOKEN_ID_MORENA and MODAL_TOKEN_SECRET_MORENA must be set in .env.local" >&2
  exit 1
fi

echo "Deploying modal_morena.py with mothertongue account..."
MODAL_TOKEN_ID="$TOKEN_ID" MODAL_TOKEN_SECRET="$TOKEN_SECRET" MORENA_ENDPOINT_SECRET="$ENDPOINT_SECRET" \
  modal deploy "$(dirname "$0")/../modal_morena.py"
