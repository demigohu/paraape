# Demo swap

Node script that trades the demo meme/USDG pool on Robinhood Chain testnet. Use it to move the tick so `PriceObserver` has a price path. Swaps go through [`V4SwapRouter`](../contracts-solidity/src/testnet/V4SwapRouter.sol).

`V4_ROUTER_ADDRESS` is the liquidity router from `DeployParaape`. This app does not use it.

## Setup

From the repo root:

```bash
pnpm install
cd apps/demo-swap
cp .env.example .env
```

Fill `.env` from the Solidity deploy logs: RPC, `PRIVATE_KEY`, `USDG_ADDRESS`, `DEMO_MEME_ADDRESS`, `POOL_MANAGER_ADDRESS`, and `V4_SWAP_ROUTER_ADDRESS` (the `swapRouter` line). `PRICE_OBSERVER_ADDRESS` is only needed when this script records prices itself.

`DeployParaape` already deploys the swap router. Deploy another one only if that log line is missing:

```bash
cd apps/contracts-solidity
unset V4_SWAP_ROUTER_ADDRESS
set -a && source .env && set +a
forge script script/DeployV4SwapRouter.s.sol:DeployV4SwapRouter \
  --rpc-url robinhood_testnet --broadcast -vv
```

Copy `V4_SWAP_ROUTER_ADDRESS` into `apps/demo-swap/.env`. Setting `DEPLOY_SWAP_ROUTER=1` deploys one from this package on startup instead. That path also needs `POOL_MANAGER_ADDRESS`.

## Run

```bash
pnpm --filter @paraape/demo-swap start
```

`SIM_SWAP_COUNT=0` (or `SIM_CONTINUOUS=1`) keeps swapping until Ctrl+C. The script does not call `PriceObserver.record` unless `SIM_RECORD_AFTER_SWAP=1`. Leave that at `0` and run the [keeper](../keeper/README.md) so samples stay on the 30-second cadence.

`SIM_USDG_PER_SWAP` is a 6-decimal USDG notional (`100000000` is 100 USDG). A buy spends that USDG. A sell spends the meme amount that is worth the same USDG at the current pool price. The old `× 1e12` conversion treated 1 meme token as 1 USDG, so a 100 USDG buy was paired with a 100-token sell.

## Move price on purpose

Run the indexer and keeper first. See [keeper](../keeper/README.md).

**Vol, without a crash.** Alternate small buys, or buys only:

```bash
cd apps/demo-swap
SIM_BUY_ONLY=1 SIM_SWAP_COUNT=20 SIM_USDG_PER_SWAP=500000 SIM_SLEEP_MS=4000 pnpm start
```

Leave the keeper running. Realized vol is whatever the risk engine reads from `PriceObserver` after enough samples land on different ticks. The Protect page shows that as annualized vol.

**A drop that can settle.** Sell a large meme amount from the **deployer** wallet, after the policy is active (about 30 minutes after purchase). The entry average is the price when cover turns on. A dump before that becomes the entry, and `settle` reverts.

Do not sell from the buyer. Cover pays only if that wallet still holds the balance recorded at purchase.

`SIM_SELL_ONLY=1` sells the meme amount worth `SIM_USDG_PER_SWAP` at the spot price. The wallet has to hold that many tokens. `DemoToken.mint` is public on the testnet tokens.

One large sell is a settle test. Many small buys are a vol test. Mixing them on a thin pool moves the USD price the Protect page shows, because that label is balance times the 5-minute average.

## Record from this script

`SIM_RECORD_AFTER_SWAP=1` calls `record` after each swap. The observer rejects a second sample inside about 30 seconds. Do not run the keeper on the same pools at the same time.

Use a different `PRIVATE_KEY` from the keeper when both broadcast. This script refreshes the pending nonce after `nonce too low`, and two bots on one key still race.

## Environment

| Variable | Notes |
| --- | --- |
| `CHAIN_ID` | `46630` |
| `ROBINHOOD_TESTNET_RPC_URL` | HTTP RPC |
| `PRIVATE_KEY` | Wallet for `DEMO_MEME_ADDRESS`. Not the keeper key |
| `PRIVATE_KEY_2` | Wallet for `DEMO_MEME_ADDRESS_2`. If empty, both markets share `PRIVATE_KEY` |
| `DEMO_MEME_ADDRESS` | First meme/USDG pool |
| `DEMO_MEME_ADDRESS_2` | Second meme/USDG pool. Leave empty to trade one market |
| `USDG_ADDRESS` | Same USDG as the pool |
| `V4_SWAP_ROUTER_ADDRESS` | `swapRouter` from `DeployParaape` |
| `POOL_MANAGER_ADDRESS` | Required for `DEPLOY_SWAP_ROUTER=1` |
| `SIM_SWAP_COUNT` | Stop after this many swaps. `0` runs until Ctrl+C |
| `SIM_CONTINUOUS` | `1` ignores `SIM_SWAP_COUNT` and runs until Ctrl+C |
| `SIM_USDG_PER_SWAP` | 6-decimal USDG notional. Buys spend it. Sells size the meme from the spot price |
| `SIM_SLEEP_MS` | Pause between swaps |
| `SIM_LEG_MS` | How long one market buys, or sells, before flipping. Default 120000. Shorter than the keeper interval (~35s) round-trips inside one sample and the premium stays on the floor |
| `SIM_BUY_ONLY` | `1` keeps the sell leg off |
| `SIM_SELL_ONLY` | `1` keeps the buy leg off |
| `SIM_RECORD_AFTER_SWAP` | `1` only while the keeper is off |
| `PRICE_OBSERVER_ADDRESS` | Only for that record flag |
