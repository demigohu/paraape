# Paraape Stylus RiskEngine

Arbitrum Stylus contract that mirrors Solidity premium / depth math ([PRD §10](../../docs/PRD.md)). **No custody** — `BoundedRiskEngine` on Solidity delegates view/pure calls here when `STYLUS_RISK_ENGINE` is set in [DeployParaape](../contracts-solidity/README.md).

## When to redeploy

| Change | Redeploy Stylus? | Redeploy Solidity stack? |
| --- | --- | --- |
| Rust math in `src/lib.rs` / `src/math.rs` | **Yes** | Update `STYLUS_RISK_ENGINE`, redeploy `DeployParaape` (new `BoundedRiskEngine` wrapper) |
| Solidity-only protocol changes | No | Yes |
| Same engine address, new factory/vault | No | Yes |

You can keep an existing engine address if bytecode is unchanged (e.g. `0x1121…` on testnet).

## Prerequisites

- [rustup](https://rustup.rs/) — this crate pins **Rust 1.91** via `rust-toolchain.toml`
- Target: `rustup target add wasm32-unknown-unknown`
- [cargo-stylus](https://github.com/OffchainLabs/cargo-stylus) (e.g. 0.10.x matching `stylus-sdk` in `Cargo.toml`)
- Same `ROBINHOOD_TESTNET_RPC_URL` and `PRIVATE_KEY` as Solidity (chain ID **46630**)

Docker is optional. If you do not use Docker for verification:

```bash
cargo stylus deploy --endpoint "$ROBINHOOD_TESTNET_RPC_URL" \
  --private-key "$PRIVATE_KEY" --no-verify
```

## Setup

```bash
cd apps/contracts-stylus
cp .env.example .env
```

`cargo-stylus` does **not** load `.env` automatically (unlike `forge`). Either export vars or source a shared file:

```bash
set -a && source ../contracts-solidity/.env && set +a
```

## Check, deploy, export ABI

```bash
rustup target add wasm32-unknown-unknown

cargo stylus check --endpoint "$ROBINHOOD_TESTNET_RPC_URL"

cargo stylus deploy --endpoint "$ROBINHOOD_TESTNET_RPC_URL" \
  --private-key "$PRIVATE_KEY" --no-verify

cargo stylus export-abi
```

Copy the deployed contract address into `STYLUS_RISK_ENGINE` in `apps/contracts-solidity/.env`, then run `DeployParaape`.

## Host tests (no WASM chain)

Stylus SDK host tests run on macOS/Linux without Docker:

```bash
cargo test --lib
```

Keep these aligned with `apps/contracts-solidity/test/RiskEngine.t.sol` expectations.

## Layout

```
apps/contracts-stylus/
├── src/
│   ├── lib.rs      # #[entrypoint] RiskEngine
│   └── math.rs     # WAD math twin
├── Cargo.toml      # lib + cdylib (cdylib required for deploy)
├── Stylus.toml     # cargo-stylus workspace config
├── rust-toolchain.toml
└── .env.example
```

## Config files

- **`Stylus.toml`**: workspace / contract section for `cargo-stylus` (network endpoints are passed via CLI `--endpoint`).
- **`Cargo.toml`**: `crate-type = ["lib", "cdylib"]` so `cargo test --lib` works on the host while deploy builds WASM.

## Git / GitHub

- Commit `Cargo.lock`, source, and toolchain files.
- Do **not** commit `.env`, `target/`, or local WASM artifacts (see `.gitignore`).
