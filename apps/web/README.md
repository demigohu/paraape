# Paraape web

Next.js app for Paraape on Robinhood Chain testnet. The landing page sells the product. **Protect** buys cover. **Underwrite** deposits USDG behind one token and can open a market for a locked pool that does not have one yet. **Dashboard** shows policies, deposits, and settle / payout actions.

Cover is per token. The buyer picks the drop (50% to 95%) and the term (1, 3, 7, 14, or 30 days), pays USDG, and keeps the coins. If the 5-minute average is still down by that drop, anyone can settle. USDG is paid to the buyer after a 2-hour window. A backing LP can challenge during that window. The contract rechecks the drop.

## Run

From the repo root:

```bash
pnpm install
pnpm web
```

Or `cd apps/web && pnpm dev`. Open [http://localhost:3000](http://localhost:3000). Use `localhost`, not `127.0.0.1`, so hot reload can connect.

```bash
pnpm --filter web build
pnpm --filter web start
```

## Setup

```bash
cd apps/web
cp .env.example .env
```

Next loads `.env`. Restart `pnpm dev` after you change it.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL` | RPC the browser uses. Empty falls back to the public testnet RPC |
| `NEXT_PUBLIC_USDG_ADDRESS` | Same USDG as `apps/contracts-solidity/.env` |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | `factory` from `DeployParaape` |
| `NEXT_PUBLIC_LOCKER_ADDRESS` | `locker` from `DeployParaape` |
| `NEXT_PUBLIC_POOL_MANAGER_ADDRESS` | v4 PoolManager. Underwrite reads pool state from it |
| `NEXT_PUBLIC_PAPE_ADDRESS` | Listed demo token, for the wallet faucet |
| `NEXT_PUBLIC_FRESH_ADDRESS` | Unlisted demo token, for the wallet faucet |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Project id from [dashboard.reown.com](https://dashboard.reown.com) |
| `NEXT_PUBLIC_APP_URL` | Optional. WalletConnect metadata. Default `http://localhost:3000` |
| `NEXT_PUBLIC_INDEXER_URL` | Optional. Default `/api/indexer` |
| `INDEXER_PROXY_URL` | Where that proxy forwards. Default `http://127.0.0.1:42069` |

The market list, policies, and activity come from the [indexer](../indexer/README.md). Start it before expecting those screens to fill. Quotes, balances, and transactions are read from the chain.

A connected wallet on Robinhood testnet can mint testnet USDG, PAPE, and FRESH from the wallet menu when those token addresses are set. `DemoToken.mint` is public. The amounts are for the demo pools, not a crash.

## Pages

| Route | What you do |
| --- | --- |
| `/` | Landing |
| `/protect` | Paste a token, pick the drop, term, and payout, pay the premium |
| `/underwrite` | Deposit USDG on a drop. A deposit on a locked unlisted pool calls `createMarket` |
| `/dashboard` | Your cover, your deposits, settle, challenge, and payout |

Buy cover from a wallet that is not the LP. Settle only works while that buyer still holds the tokens, and only after the drop is still there on the 5-minute average. The keeper has to be recording that pool. See [contracts](../contracts-solidity/README.md) and [keeper](../keeper/README.md).

## Scripts

| Command | |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the build |
| `pnpm check-types` | `next typegen` and `tsc` |
