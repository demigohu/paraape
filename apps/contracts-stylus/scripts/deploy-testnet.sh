#!/usr/bin/env bash
# Deploy Paraape RiskEngine (Stylus) on Robinhood testnet (46630).
# Usage: from repo root or this dir, with ../contracts-solidity/.env filled.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

set -a
# shellcheck source=/dev/null
source "${STYLUS_ENV:-$ROOT/../contracts-solidity/.env}"
set +a

: "${ROBINHOOD_TESTNET_RPC_URL:?ROBINHOOD_TESTNET_RPC_URL}"
: "${PRIVATE_KEY:?PRIVATE_KEY}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but the daemon is not running."
  echo "Start Docker Desktop, wait until Ready, then re-run this script."
  echo "Or set STYLUS_NO_VERIFY=1 to build locally (not recommended for Arbiscan verification)."
  if [[ "${STYLUS_NO_VERIFY:-}" != "1" ]]; then
    exit 1
  fi
fi

echo "==> RPC: $ROBINHOOD_TESTNET_RPC_URL"
echo "==> Host tests"
cargo test --lib

echo "==> cargo stylus check (must pass before deploy)"
RUST_LOG="${RUST_LOG:-info}" cargo stylus check \
  --endpoint "$ROBINHOOD_TESTNET_RPC_URL" \
  --verbose

echo "==> Deploy + activate (Docker reproducible build unless STYLUS_NO_VERIFY=1)"
DEPLOY_ARGS=(
  --endpoint "$ROBINHOOD_TESTNET_RPC_URL"
  --private-key "$PRIVATE_KEY"
  --data-fee-bump-percent "${STYLUS_DATA_FEE_BUMP:-30}"
)
if [[ "${STYLUS_NO_VERIFY:-}" == "1" ]]; then
  DEPLOY_ARGS+=(--no-verify)
fi
cargo stylus deploy "${DEPLOY_ARGS[@]}"

echo ""
echo "Copy the deployed address into apps/contracts-solidity/.env as STYLUS_RISK_ENGINE="
echo "Then: forge script script/DeployParaape.s.sol:DeployParaape --rpc-url \"\$ROBINHOOD_TESTNET_RPC_URL\" --broadcast -vv"
