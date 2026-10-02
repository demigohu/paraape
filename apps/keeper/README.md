# Paraape record keeper

Sends **`InsuranceVault.recordPool()`** and **`PriceObserver.record()`** on an interval so TWAP / entry guard / `settle` have on-chain history.

**Market list comes only from [Ponder](../indexer/README.md)** (`GET /keeper/targets`). The keeper does not talk to `MarketFactory` or `eth_getLogs`.

## Setup

```bash
# Terminal 1 — indexer first
cd apps/indexer && cp .env.example .env && pnpm dev

# Terminal 2 — keeper
cd apps/keeper && cp .env.example .env
pnpm start
```

```bash
set -a && source ../contracts-solidity/.env && set +a
export KEEPER_INDEXER_URL=http://127.0.0.1:42069
export KEEPER_INDEXER_WAIT_READY=1
export PRICE_OBSERVER_ADDRESS=0x…
pnpm start
```

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `ROBINHOOD_TESTNET_RPC_URL` | yes | HTTP RPC (chain **46630**) |
| `PRIVATE_KEY` | yes | Wallet paying gas |
| `PRICE_OBSERVER_ADDRESS` | yes | `PriceObserver` from deploy |
| `KEEPER_INDEXER_URL` | yes* | Ponder base URL → polls `/keeper/targets` |
| `KEEPER_MARKETS_URL` | yes* | Full targets URL (instead of `KEEPER_INDEXER_URL`) |
| `KEEPER_INDEXER_SYNC_MS` | no | Default `120000` (min `10000`) |
| `KEEPER_INDEXER_WAIT_READY` | no | Wait for indexer `/ready` before first sync |
| `POOL_REFS` / `VAULT_ADDRESSES` | no | Optional extras merged with indexer |
| `RECORD_INTERVAL_MS` | no | Default `35000` (on-chain min **30s**) |
| `CHAIN_ID` | no | Default `46630` |

\* One of `KEEPER_INDEXER_URL` or `KEEPER_MARKETS_URL` is required.

### Behaviour

- **Bootstrap + poll** — loads markets from indexer; poll adds new markets (indexer also indexes live `MarketCreated`).
- **Failed poll** — registry is **not** cleared; last good targets + static env stay active.
- **Insured pools** — only **`vault.recordPool()`** (no duplicate `observer.record` for the same `poolRef`).
- **Extra pools** — `/keeper/targets` = insured `poolRef` per market + any pool seen in `PriceObserver.Recorded` (+ optional `KEEPER_EXTRA_POOL_REFS` on indexer).

## VPS

Run **indexer** and **keeper** as separate systemd units. Keeper `After=` indexer or use `KEEPER_INDEXER_WAIT_READY=1`.

## Notes

- **~1 hour** of successful records before `purchasePolicy` entry guard on a fresh market.
- Does **not** call `settle` / `release`.
- `rate limited` on pool line after `vault.recordPool ok` is normal (same 30s on-chain window).

See [indexer README](../indexer/README.md) and [contracts-solidity README](../contracts-solidity/README.md).
