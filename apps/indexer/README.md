# Paraape indexer

[Ponder](https://ponder.sh) index of the Paraape contracts on Robinhood Chain testnet (chain ID **46630**). The web app reads markets, policies, LP positions, and the activity feed from here. The [keeper](../keeper/README.md) reads `GET /keeper/targets`.

## Setup

From the repo root, `pnpm install` once. Then:

```bash
cd apps/indexer
cp .env.example .env
pnpm dev
```

`pnpm dev` syncs and serves `http://localhost:42069`. It does not need `DATABASE_SCHEMA`. `pnpm start` does. On a VPS, set `DATABASE_SCHEMA` and `DATABASE_URL` (Postgres). Dev uses embedded PGlite.

`.env.local` overrides `.env` when both exist.

Point it at the factory from `DeployParaape`:

```bash
set -a && source ../contracts-solidity/.env && set +a
export PONDER_RPC_URL_46630="$ROBINHOOD_TESTNET_RPC_URL"
export MARKET_FACTORY_ADDRESS="$FACTORY_ADDRESS"
export MARKET_FACTORY_START_BLOCK=<factory creation block>
export PRICE_OBSERVER_ADDRESS="$PRICE_OBSERVER_ADDRESS"
pnpm dev
```

`MARKET_FACTORY_START_BLOCK` has to be the block that created this factory. An earlier block replays old factories. A later block misses markets.

Restart the process after changing the factory or the start block.

## HTTP

| Route | Returns |
| --- | --- |
| `GET /markets` | Every `MarketCreated` row |
| `GET /markets/token/:address` | One token: vault, policies, oracle, cells |
| `GET /policies/buyer/:address` | Policies bought by a wallet |
| `GET /lp/:address` | LP shares and USDG notionals |
| `GET /activity/wallet/:address` | Purchases, deposits, settle, challenge, release |
| `GET /keeper/targets` | `{ poolRefs, vaultAddresses }` for the keeper |
| `GET /graphql` | Schema GraphQL |
| `GET /ready` | `503` until backfill finishes |

`/keeper/targets` is each insured `poolRef`, plus pools seen in `PriceObserver.Recorded`, plus optional `KEEPER_EXTRA_POOL_REFS`.

## What it stores

- **market** — one row per `createMarket`
- **policy** — vault policy lifecycle
- **activity** — wallet feed
- **lp position** and **vault cell** — deposits behind a drop
- **oracle pool** — latest `PriceObserver.Recorded` per pool

Vaults are picked up from `MarketCreated`. A new factory needs the new address and start block. This process does not upgrade old rows in place.

## Production

1. Set `DATABASE_SCHEMA` (max 45 characters) and `DATABASE_URL`.
2. Run `pnpm start` with the working directory at `apps/indexer`.
3. Point the keeper at `KEEPER_INDEXER_URL=http://127.0.0.1:42069` and `KEEPER_INDEXER_WAIT_READY=1`.

## Scripts

| Command | |
| --- | --- |
| `pnpm dev` | Sync and reload |
| `pnpm start` | Production. Requires `DATABASE_SCHEMA` |
| `pnpm codegen` | Regenerate Ponder types |
