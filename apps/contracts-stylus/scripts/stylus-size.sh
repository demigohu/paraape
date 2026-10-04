#!/usr/bin/env bash
# Build WASM and report size (Arbitrum: compressed limit ~24 KB before fragmentation).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
cargo build --release --target wasm32-unknown-unknown
WASM="$ROOT/target/wasm32-unknown-unknown/release/paraape_risk_engine.wasm"
BYTES=$(wc -c < "$WASM" | tr -d ' ')
echo "Release WASM: $WASM ($BYTES bytes raw)"

if command -v wasm-opt >/dev/null 2>&1; then
  OPT="$ROOT/target/wasm32-unknown-unknown/release/paraape_risk_engine.opt.wasm"
  wasm-opt -Oz "$WASM" -o "$OPT"
  OPT_BYTES=$(wc -c < "$OPT" | tr -d ' ')
  echo "wasm-opt -Oz: $OPT ($OPT_BYTES bytes)"
else
  echo "Tip: brew install binaryen → wasm-opt -Oz … (see README)"
fi

echo ""
echo "Next: cargo stylus check --endpoint \"\$ROBINHOOD_TESTNET_RPC_URL\""
echo "Bisect: cargo stylus check --endpoint https://sepolia-rollup.arbitrum.io/rpc"
