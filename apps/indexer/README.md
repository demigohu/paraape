# Paraape indexer (Ponder)

Indexes **Robinhood testnet (46630)** Paraape contracts for read APIs: markets (paste-CA), policies, oracle sample metadata. Deploy on a VPS beside the [record keeper](../keeper/README.md).

## Setup

```bash
cd apps/indexer
cp .env.example .env
# fill RPC, MARKET_FACTORY_ADDRESS, MARKET_FACTORY_START_BLOCK, PRICE_OBSERVER_ADDRESS
# Optional overrides: .env.local (loaded after .env)

pnpm install   # from repo root once
pnpm dev       # local: sync + API on http://localhost:42069 (no DATABASE_SCHEMA)
pnpm start     # production: requires DATABASE_SCHEMA (+ DATABASE_URL on VPS)
```

Reuse contract env:

```bash
set -a && source ../contracts-solidity/.env && set +a
export PONDER_RPC_URL_46630="$ROBINHOOD_TESTNET_RPC_URL"
export MARKET_FACTORY_ADDRESS="$FACTORY_ADDRESS"
export MARKET_FACTORY_START_BLOCK=…   # factory deploy block (decimal)
export PRICE_OBSERVER_ADDRESS=0x…
pnpm dev
```

## HTTP routes (custom)

| Route | Description |
| --- | --- |
| `GET /markets` | All `MarketCreated` markets |
| `GET /markets/token/:address` | Lookup by insured token CA + policies + oracle snapshot |
| `GET /keeper/targets` | `{ poolRefs, vaultAddresses }` for keeper sync |
| `GET /graphql` | Auto GraphQL from schema |
| `GET /ready` | `503` until backfill done |

## Schema

- **market** — one row per `createMarket` (token, vault, `poolRef`, deployer metadata)
- **policy** — vault policy lifecycle from `InsuranceVault` events
- **oracle_pool** — latest `PriceObserver.Recorded` per `poolRef`

Vault contracts are discovered via Ponder **factory** pattern on `MarketCreated.vault`.

## VPS (production)

1. **`DATABASE_SCHEMA`** — required for `ponder start` (e.g. `paraape`; max 45 chars). Set in `.env` or pass `--schema`.
2. **Postgres** — set `DATABASE_URL` (recommended for `ponder start`).
2. **systemd** — `WorkingDirectory=…/apps/indexer`, `EnvironmentFile=.env`, `ExecStart=pnpm start`.
3. **Keeper** — `KEEPER_INDEXER_URL=http://127.0.0.1:42069` and `KEEPER_INDEXER_WAIT_READY=1` (see [keeper README](../keeper/README.md#indexer-sync-recommended-on-vps)).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev sync + hot reload |
| `pnpm start` | Production server |
| `pnpm codegen` | Regenerate ponder types |

See [keeper vs Ponder](../keeper/README.md#keeper-vs-ponder-indexer).
