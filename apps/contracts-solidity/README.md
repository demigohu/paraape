# Paraape contracts

Solidity for memecoin cover on Robinhood Chain testnet (chain ID **46630**). A holder pays USDG against one token. If price is still down by the drop they bought, the policy can pay out in USDG. Product spec: [docs/PRD.md](../../docs/PRD.md).

## How a policy works

- **Drop:** 50%, 60%, 70%, 80%, 90%, or 95% from the entry price.
- **Term:** 1, 3, 7, 14, or 30 days.
- **Entry:** the 5-minute average when cover turns on, about 30 minutes after purchase.
- **Settle:** anyone can call it once that average is still down by the bought drop, the last samples agree, and the buyer still holds the tokens.
- **After settle:** payout waits 2 hours. A backing LP can challenge. The contract rechecks the drop. A failed recheck voids the policy. A recheck that still holds charges the spam fee (10 USDG) and leaves the payout in place. `release` pays the buyer after the window.
- **No drop:** the premium stays with the LPs who backed that token.

The price is the pool's own sampled TWAP (`PriceObserver`). Chainlink is only the WETH to USDG rate for WETH-quoted pools.

## What lives here

| Area | Path | Role |
| --- | --- | --- |
| Core | `src/MarketFactory.sol`, `src/InsuranceVault.sol` | One isolated vault per token, policies, LP cells |
| Oracle | `src/oracle/PriceObserver.sol`, `V4PoolTickSource.sol`, `V4ChainlinkPriceSource.sol` | Sampled TWAP. Anyone may `record` |
| Risk | `src/risk/ParaapeRiskEngine.sol`, `BoundedRiskEngine.sol` | Premium and payout cap. The wrapper is what vaults call |
| Locks | `src/adapters/ParaapeTestnetLocker.sol` | Testnet attestation that liquidity is locked |
| Testnet | `src/testnet/`, `script/Deploy*.s.sol` | Mocks, a listed demo market, an unlisted pool, a swap router |
| Tests | `test/` | Factory, vault lifecycle, oracle, risk |

The Stylus twin is [apps/contracts-stylus](../contracts-stylus/README.md). Leave `STYLUS_RISK_ENGINE` empty on this testnet. `DeployParaape` then deploys `ParaapeRiskEngine` and wraps it in `BoundedRiskEngine`.

Existing vaults keep the bytecode they were deployed with. A new factory does not upgrade them.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`). Add `~/.foundry/bin` to `PATH` if needed.
- Git submodules for `lib/`.
- A Robinhood Chain testnet RPC and a testnet deployer key.

## Setup

```bash
cd apps/contracts-solidity
git submodule update --init --recursive
cp .env.example .env
```

Fill `.env`. Do not commit it. Forge also writes sensitive metadata under `cache/` and `broadcast/`.

Shell exports override the file. Before a script, unset any older addresses still sitting in the shell:

```bash
unset FACTORY_ADDRESS LOCKER_ADDRESS V4_ROUTER_ADDRESS V4_SWAP_ROUTER_ADDRESS DEMO_MEME_ADDRESS
set -a && source .env && set +a
```

## Build and test

```bash
forge build
forge test
```

From the repo root: `pnpm --filter @paraape/contracts-solidity test`.

## Environment

| Variable | Required when | Notes |
| --- | --- | --- |
| `ROBINHOOD_TESTNET_RPC_URL` | Deploy | `foundry.toml` name: `robinhood_testnet` |
| `PRIVATE_KEY` | Deploy | Testnet deployer |
| `USDG_ADDRESS` | `DeployParaape` and demo scripts | Mock from `DeployTestnetMocks`, or the testnet USDG |
| `WETH_ADDRESS` | `DeployParaape` | WETH on this chain |
| `POOL_MANAGER_ADDRESS` | `DeployParaape` | Uniswap v4 PoolManager |
| `WETH_USDG_POOL_ID` | `DeployParaape` | 32 zero bytes when WETH converts through Chainlink |
| `CHAINLINK_ETH_USD_FEED` | WETH-quoted markets | Mock feed from `DeployTestnetMocks`. Empty skips that path |
| `WETH_IS_CURRENCY0` | Chainlink path | Defaults to `true` in the script |
| `STYLUS_RISK_ENGINE` | Omit | Empty deploys the Solidity engine |
| `GUARDIAN_ADDRESS` | Optional | Defaults to the deployer |
| `FACTORY_ADDRESS`, `LOCKER_ADDRESS`, `V4_ROUTER_ADDRESS` | Demo scripts | From `DeployParaape` logs |
| `DEMO_LP_PAPE` | Optional | 18 decimals. Script default is 1B tokens |
| `DEMO_POOL_USDG` | Optional | 6 decimals. Script default is 10,000 USDG |
| `MEME_NAME`, `MEME_SYMBOL` | Optional | `DeployMemePool` only. Default name `FRESH MEME`, symbol `FRESH` |
| `MOCK_USDG_MINT`, `MOCK_ETH_USD_8DEC` | Mocks | Script defaults: 10M USDG units, $3000 with 8 decimals |

## Deploy

Use one deployer wallet. Paste each log line into `.env` before the next script. Add `--verify` only after the explorer is accepting the API. A failed verify does not mean the deploy failed.

**1. Mocks (optional).** Skip this if `USDG_ADDRESS` and the Chainlink feed are already set.

```bash
forge script script/DeployTestnetMocks.s.sol:DeployTestnetMocks \
  --rpc-url robinhood_testnet --broadcast
```

**2. Protocol.**

```bash
forge script script/DeployParaape.s.sol:DeployParaape \
  --rpc-url robinhood_testnet --broadcast -vv
```

Save `riskEngine`, `observer`, `priceSource`, `locker`, `factory`, `router` (liquidity), and `swapRouter`. Copy them to this `.env`, then to the indexer, keeper, demo-swap, and web env files. `MARKET_FACTORY_START_BLOCK` is the factory creation block.

**3. Listed demo market.** Deploys a meme, adds full-range liquidity, attests the lock, and calls `createMarket`.

```bash
forge script script/DeployDemoMarket.s.sol:DeployDemoMarket \
  --rpc-url robinhood_testnet --broadcast -vv
```

Logs `meme`, `poolRef`, and `vault`. The deployer needs at least `DEMO_POOL_USDG` of USDG. The script mints the LP tokens.

**4. Unlisted pool.** Same liquidity and lock. The script leaves `vault` at the zero address. The Underwrite page calls `createMarket` when someone deposits USDG.

```bash
forge script script/DeployMemePool.s.sol:DeployMemePool \
  --rpc-url robinhood_testnet --broadcast -vv
```

The log `vault` is the zero address until that deposit.

**5. Swap router, only if step 2 did not log one.**

```bash
forge script script/DeployV4SwapRouter.s.sol:DeployV4SwapRouter \
  --rpc-url robinhood_testnet --broadcast -vv
```

That address is `V4_SWAP_ROUTER_ADDRESS` for [demo-swap](../demo-swap/README.md). It is not `V4_ROUTER_ADDRESS`.

**Move the mock ETH/USD price** (WETH-quoted markets only):

```bash
forge script script/SetMockEthUsd.s.sol:SetMockEthUsd \
  --rpc-url robinhood_testnet --broadcast
```

## After deploy

- Run the [indexer](../indexer/README.md), then the [keeper](../keeper/README.md). A fresh market needs about an hour of records before the entry guard lets someone buy cover.
- Buy cover from a second wallet. The LP or token deployer cannot buy on their own market.
- A price dump for a settle test has to come from the deployer, after cover is active. If the buyer sells below the balance recorded at purchase, `settle` reverts.
- The keeper records prices. It does not call `settle` or `release`.

Transactions: `https://explorer.testnet.chain.robinhood.com/tx/<hash>`.

## Layout

```
apps/contracts-solidity/
├── src/           # Protocol
├── script/        # Deploy scripts
├── test/
├── lib/           # forge-std, OpenZeppelin, v4-core
├── foundry.toml
└── .env.example
```

The web app keeps its own human-readable ABI in `apps/web/lib/abi.ts`. Update that file when an interface changes. `forge inspect <Contract> abi` prints the full JSON if you need it.

## Security

Testnet demo code. Before mainnet, review oracle liveness, the lock adapter, `ProtocolConfig`, and the audit scope in the PRD.
