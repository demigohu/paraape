# Paraape Stylus risk engine

Rust twin of the Solidity premium and depth math ([PRD §10](../../docs/PRD.md)). It holds no funds.

Robinhood testnet runs `ParaapeRiskEngine` in Solidity. New Stylus activations are paused on that chain, so leave `STYLUS_RISK_ENGINE` empty. `BoundedRiskEngine` calls this program only after that variable is set and `DeployParaape` is run again.

## What to redeploy

| Change | Stylus | Solidity |
| --- | --- | --- |
| `src/lib.rs` or `src/math.rs` | Deploy, then set `STYLUS_RISK_ENGINE` | Redeploy `DeployParaape` so the wrapper points at the new program |
| Protocol contracts only | Leave it | Redeploy `DeployParaape` |
| New factory, same engine address | Leave it | Redeploy `DeployParaape` |

`DeployParaape` uses the address exported in the shell. Unset an old `STYLUS_RISK_ENGINE` before a Solidity deploy that should use the Solidity engine.

## Prerequisites

- [rustup](https://rustup.rs/). This crate pins Rust **1.91** in `rust-toolchain.toml`.
- `rustup target add wasm32-unknown-unknown`
- [cargo-stylus](https://github.com/OffchainLabs/stylus-sdk-rs) **0.10.x**, matching `stylus-sdk = "0.10.7"` (`cargo install cargo-stylus --force`)
- The same RPC and deployer key as [contracts-solidity](../contracts-solidity/README.md)
- Docker Desktop with the daemon running (`docker ps`). `cargo stylus deploy` builds inside the official image when you omit `--no-verify`. Fallback: `STYLUS_NO_VERIFY=1 ./scripts/deploy-testnet.sh`.

Check the program on a local Nitro devnode or Arbitrum Sepolia before Robinhood testnet.

## Setup

`cargo-stylus` does not load `.env`. Export the variables yourself.

```bash
cd apps/contracts-stylus
cp .env.example .env
set -a && source ../contracts-solidity/.env && set +a
```

## Check and deploy

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown

# Optional shrink (brew install binaryen)
./scripts/stylus-size.sh

cargo stylus check --endpoint "$ROBINHOOD_TESTNET_RPC_URL"

cargo stylus deploy --endpoint "$ROBINHOOD_TESTNET_RPC_URL" \
  --private-key "$PRIVATE_KEY" --no-verify

cargo stylus export-abi
```

Or `./scripts/deploy-testnet.sh`.

The release profile uses `opt-level = "z"` and LTO to stay near the ~24 KB compressed chunk size. A log line that says two fragments is one size variable to reduce. It is not, by itself, proof the activation will revert.

### Wire it into the protocol

After activations work, put the new address in `apps/contracts-solidity/.env` as `STYLUS_RISK_ENGINE`, unset any older value in the shell, then rerun `DeployParaape` and `DeployDemoMarket`. Vaults from the previous factory keep the old engine.

```bash
cd ../contracts-solidity
unset FACTORY_ADDRESS LOCKER_ADDRESS V4_ROUTER_ADDRESS V4_SWAP_ROUTER_ADDRESS
set -a && source .env && set +a

cast call "$STYLUS_RISK_ENGINE" "realizedVol(bytes)(uint256)" 0x \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"

forge script script/DeployParaape.s.sol:DeployParaape \
  --rpc-url robinhood_testnet --broadcast -vv
```

### `cargo stylus check` reverts on Robinhood and Sepolia

`ArbWasm.activationGas()` on those chains is `2^64 − 1`. That is the [Stylus activation pause](https://docs.arbitrum.io/notices/stylus-activation-pause-notice): `activateProgram` cannot finish, so `check` and `deploy` never broadcast. The same WASM activates on a local Nitro devnode. Programs that were activated earlier keep running.

## Tests

Host tests do not need Docker or a chain:

```bash
cargo test --lib
```

Keep them aligned with `apps/contracts-solidity/test/RiskEngine.t.sol`.

## Layout

```
apps/contracts-stylus/
├── src/lib.rs          # #[entrypoint] RiskEngine
├── src/math.rs         # WAD math twin
├── Cargo.toml          # lib + cdylib (cdylib is required to deploy)
├── Stylus.toml
├── rust-toolchain.toml
└── scripts/
```

`Stylus.toml` is the cargo-stylus workspace file. Pass the RPC with `--endpoint`. `crate-type = ["lib", "cdylib"]` lets `cargo test --lib` run on the host while deploy builds WASM.

Commit `Cargo.lock`. Do not commit `.env`, `target/`, or local WASM artifacts.
