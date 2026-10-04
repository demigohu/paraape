# Paraape keeper

Posts oracle samples so a policy can settle. For each insured vault it calls `InsuranceVault.recordPool()`, which records that vault's pool. For any other pool in the indexer target list it calls `PriceObserver.record()`.

It does not call `settle` or `release`. Someone still has to settle a policy, and the buyer calls `release` after the 2-hour window.

Markets come from the [indexer](../indexer/README.md) (`GET /keeper/targets`). This process does not scan `MarketFactory` logs itself.

## Setup

Start the indexer first and wait until `/ready` is up.

```bash
cd apps/indexer && cp .env.example .env && pnpm dev

cd apps/keeper && cp .env.example .env
# fill RPC, PRIVATE_KEY, PRICE_OBSERVER_ADDRESS, KEEPER_INDEXER_URL
pnpm start
```

Or reuse the Solidity env:

```bash
cd apps/keeper
set -a && source ../contracts-solidity/.env && set +a
export KEEPER_INDEXER_URL=http://127.0.0.1:42069
export KEEPER_INDEXER_WAIT_READY=1
pnpm start
```

`PRICE_OBSERVER_ADDRESS` has to be the `observer` log from the same `DeployParaape` as the factory the indexer follows.

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `ROBINHOOD_TESTNET_RPC_URL` | yes | Chain **46630** |
| `PRIVATE_KEY` | yes | Pays gas for `record` |
| `PRICE_OBSERVER_ADDRESS` | yes | `observer` from `DeployParaape` |
| `KEEPER_INDEXER_URL` | one of these | Base URL. Polls `/keeper/targets` and `/ready` |
| `KEEPER_MARKETS_URL` | one of these | Full targets URL, if you do not set the base URL |
| `KEEPER_INDEXER_SYNC_MS` | no | Default `120000`. Below `10000` turns the poll off |
| `KEEPER_INDEXER_WAIT_READY` | no | `1` waits for `/ready` before the first sync |
| `KEEPER_INDEXER_STARTUP_TIMEOUT_MS` | no | Default `600000` |
| `KEEPER_INDEXER_REQUIRE_READY` | no | `1` refuses targets while the indexer is still backfilling |
| `KEEPER_INDEXER_TIMEOUT_MS` | no | HTTP timeout. Default `15000` |
| `POOL_REFS`, `VAULT_ADDRESSES` | no | Extra targets merged with the indexer list |
| `RECORD_INTERVAL_MS` | no | Default `35000`. The contract rejects samples inside **30 seconds** |
| `CHAIN_ID` | no | Default `46630` |

## What a tick does

- The first sync loads markets. Later polls add new ones. A failed poll keeps the last good list.
- An insured pool is recorded with `vault.recordPool()` only. A second `observer.record` on that same pool in the same tick is skipped.
- `rate limited` after `vault.recordPool ok` means the 30-second window is still open. The next interval retries.
- A fresh market needs on the order of an hour of successful records before the entry guard allows `purchasePolicy`.
- Use a different key from [demo-swap](../demo-swap/README.md) if both broadcast. Sharing one key races nonces.

## Production

Run the indexer and the keeper as separate processes. Start the keeper after the indexer, or set `KEEPER_INDEXER_WAIT_READY=1`.
