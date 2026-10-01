# PRD: Paraape — On-Chain Rug-Pull Insurance

**Product:** Paraape
**Chain:** Robinhood Chain Testnet (chain ID 46630) for the hackathon; Robinhood Chain mainnet (4663) after audit
**Settlement asset:** Paxos USDG only
**Hackathon:** Arbitrum Open House Singapore — Online Buildathon
**Status:** Draft v2 (supersedes v1; decisions in this version are fixed for the smart-contract build)

---

## 1. Problem Statement

Memecoin trading dominates Robinhood Chain activity (~79% of DEX volume). Memecoins launch through Pons and pools.trade and trade on Uniswap V4 pools on the shared PoolManager. Rug pulls — sudden, catastrophic crashes driven by insiders — are a well-documented, industrialized threat in this market.

Both major launchpads permanently lock pool liquidity, so the classic "pull the LP" rug is largely gone. What remains is the **insider dump**: the creator or a cluster of bundled wallets sells a large supply into the pool and the price collapses in minutes.

Existing tools (RugCheck, Veritas Protocol, Elliptic, ScanHood, GeckoTerminal Rug Checker) only **detect and warn** before the fact. None of them **compensate** a trader who gets rugged anyway. Existing crypto insurance protocols (Nexus Mutual, InsurAce, Cork Protocol) explicitly exclude market losses.

**Gap:** no live protocol offers purchasable, automatically settled protection against rug-style crashes, isolated per token, on a permissionless basis.

---

## 2. Positioning

Paraape insures against **rug events**, not against a token trading below the buyer's entry price.

- A policy pays when the token suffers a crash that is both **deep** (severity) and **fast** (window), measured from the price just before the crash.
- It is not a put option or a stop-loss. A token that bleeds slowly, or that ends below the buyer's entry after a normal pump-and-dump, does not pay.
- The payout never exceeds the loss the buyer actually suffered in the rug event (Section 7).

---

## 3. Target Users

| User | Who they are | What they want |
| --- | --- | --- |
| **Buyer (trader)** | Retail memecoin trader on Robinhood Chain who holds a specific token | Cheap, automatic protection against being rugged, with no claim form and no trusted claims desk |
| **LP (underwriter)** | Holder of idle USDG, comfortable with defined, isolated risk | Yield above passive lending, with full control over which token and which risk profile they underwrite |

---

## 4. Core Design Decisions

Each decision exists because a simpler version was considered and broke.

### 4.1 Trigger: severity + window, measured from the pre-crash price

- **Rejected:** "price drops X% in 24h" — fires on normal memecoin pump-and-dump cycles and drains LPs in days.
- **Rejected:** "malicious on-chain event detected" — duplicates free scanners and is easy to evade.
- **Rejected:** "price falls X% below the buyer's purchase price" — this is a put option, not rug insurance, and it misses the most common rug shape (pump first, then dump).
- **Chosen:** a policy triggers when the price falls by at least the **severity** within at most the **window**, measured from the highest price inside that window. Formal definition in Section 6.

### 4.2 Price source: Paraape's own sampled TWAP, behind a price-source adapter

- Uniswap V4 has no built-in price history. Price history in V4 only exists if the pool was created with an oracle hook.
- Pons pools use `PonsV2MemeHook` (fee collection only) and pools.trade pools use no hook. A pool's hook is fixed at creation, so neither can be given an oracle afterwards.
- Paraape therefore runs its own **`PriceObserver`**. It reads each pool's current price from the PoolManager (`StateLibrary.getSlot0`, via `extsload`) and stores observations in the same format as the Uniswap V3 oracle (`tickCumulative`, ring buffer, `observe(secondsAgos)`).
- Market logic depends only on an `IPriceSource` interface. Two concerns are separated:
  - **Insured-token price (rug trigger):** always from `PriceObserver` TWAP on the meme pool (Sections 6, 9.1). Not Chainlink, not off-chain indexers (GMGN/Dexscreener).
  - **Quote → USDG conversion:** when the pool quote asset is WETH, convert to settlement USDG via **`V4ChainlinkPriceSource`** and a Chainlink **ETH/USD** feed (`AggregatorV3Interface`). Testnet uses Chainlink's **`MockV3Aggregator`**; mainnet uses the official Robinhood feed proxy from [Chainlink price feeds](https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood) — same adapter, different address, no logic change.
- MVP `IPriceSource` implementations:
  - **`V4ChainlinkPriceSource`** (recommended): meme TWAP + Chainlink ETH/USD for WETH quotes.
  - **`V4PriceSource`**: meme TWAP + optional WETH/USDG **pool** TWAP fallback when no Chainlink feed is configured.
  - **V3 adapter**: pool native `observe()`, only if Uniswap V3 is available on the target chain.

Details in Section 9.

### 4.3 Single-sided USDG, isolated per token

- LPs deposit **only USDG**, never the insured token.
- Every token has its **own isolated market**. A rug on Token A never touches LPs underwriting Token B.
- Market creation is permissionless (Section 9.4).

### 4.4 LP risk cells on a fixed grid (DLMM-style)

- LPs choose their own **severity** and **window**, like choosing a bin in a DLMM. The parameters are not fixed tiers.
- Choices are restricted to fixed grid points (Section 5), like tick spacing in Uniswap. This keeps liquidity concentrated so buyers can find capacity, keeps quotes comparable, and lets keepers check triggers per cell instead of per position.
- All LPs who choose the same grid point share one **risk cell**: a USDG pool with share-based (ERC-4626-style) accounting.
- An LP's `(severity, window)` is their **maximum risk appetite**: "I agree to pay for any crash at least this deep and at most this fast."

### 4.5 Matching and aggregation: dominance rule, best-fit fill

A risk cell may back a policy only if the policy's trigger is **equally strict or stricter** than the cell's appetite:

```
cell can back policy  <=>  policy.severity >= cell.severity  AND  policy.window <= cell.window
```

Whenever such a policy pays, the cell's own condition is also met, so an LP never pays for a crash they did not agree to cover.

- A policy may be filled from **several eligible cells** (aggregation). Cells that are not eligible are never used, even if the buyer's request cannot otherwise be filled.
- Fill order is **best-fit**: eligible cells with the highest severity are used first, then the shortest window. LPs with a wide appetite stay available for buyers who need wide protection.
- The buyer sets a `minCoverage`. If eligible cells cannot supply at least that much, the purchase reverts.
- Stricter triggers are cheaper. Buyers trade off breadth of protection against price.

Example with cell A = 85%/10m and cell B = 70%/30m:

| Buyer request | A eligible | B eligible | Result |
| --- | --- | --- | --- |
| 90% / 10m | Yes | Yes | Filled from A, then B |
| 80% / 15m | No | Yes | Filled from B |
| 60% / 10m | No | No | No coverage |
| 90% / 1h | No | No | No coverage |

### 4.6 Full collateralization

All policies on one token trigger together in a rug; the risk is perfectly correlated. Every USDG of coverage is therefore locked 1:1 from LP capital for the life of the policy. There is no leverage and no fractional reserve. LP yield equals premiums divided by locked capital.

### 4.7 Pricing in Stylus

Premiums and LP APY estimates are computed by the **Stylus risk engine** from realized volatility, the policy parameters, and cell utilization (Section 10). LP-set markups are deferred to V2; the cell ID leaves room for a `rateTier` dimension so this can be added without migration.

### 4.8 Continuous insurable interest

A buyer can only insure a token they hold, and must keep holding it. The balance is checked at purchase and again at settlement; a balance below the covered amount at settlement voids the policy (Section 8, layer 1). This keeps the product on the insurance side of the line, compensating a real position rather than enabling a directional bet.

### 4.9 USDG only

All premiums, deposits, and payouts are denominated in Paxos USDG (6 decimals). Other stablecoins are out of scope.

---

## 5. Parameter Grid

### 5.1 Severity levels

`{50, 60, 70, 80, 90, 95}%`. The maximum is 95%, because a TWAP almost never reaches exactly zero and a 100% trigger would never pay.

### 5.2 Window levels

`{5m, 15m, 30m, 1h, 4h, 12h, 1d, 3d, 7d, 30d}`. Spacing widens with length, so the grid covers minutes to a month with only 10 points.

### 5.3 Minimum severity per window

Long windows require deeper crashes, so a long-window policy still describes a rug and not a slow decline. This applies to both cells and policies.

| Window | Minimum severity |
| --- | --- |
| ≤ 1h | 50% |
| > 1h and ≤ 1d | 70% |
| > 1d | 85% |

### 5.4 Policy duration

`{1d, 3d, 7d, 14d, 30d}`. A policy's window must not exceed its duration.

---

## 6. Trigger Definition

Let:

- `s` = policy severity, `w` = policy window.
- `L` = measurement TWAP length = `clamp(w / 5, 1 minute, 30 minutes)`.
- `P(t)` = TWAP over `[t - L, t]` from the market's price source, in quote-asset terms.
- `activeFrom` = purchase time + activation delay.

A policy is **triggered** if there exist timestamps `t0 < t1` such that:

1. `activeFrom <= t0 - L` and `t1 <= expiry`
2. `t1 - t0 <= w`
3. `P(t1) <= (1 - s) × P(t0)`
4. **Persistence:** the condition in (3) still holds at the next `K` recorded observations after `t1`, each in a different block.

The caller of `settle` supplies `t0` and `t1`; the contract verifies them against recorded observations and never searches history itself.

**Example.** Policy 85% / 10m. The buyer entered at 1.0. The token pumps to 3.0, is at 3.0 at 14:00, and falls to 0.4 at 14:08. That is -87% in 8 minutes, so the policy triggers, even though the drop from the entry price is only -60%.

---

## 7. Coverage and Payout

### 7.1 Coverage cap at purchase (no over-insurance)

```
C <= V × s
```

- `C` = coverage purchased (USDG).
- `V` = USDG value of the buyer's holdings at purchase = balance × `P(now)` × quote-to-USDG rate.

### 7.2 Payout at settlement (indemnity cap)

```
payout = min(C, balance × (P(t0) - P(t1)) × quoteToUsdg)
```

The payout never exceeds the loss suffered in the rug event itself.

### 7.3 Quote-asset conversion

Most memecoin pools are quoted in WETH, not USDG. Premiums, coverage caps, depth caps, and indemnity payouts are denominated in **USDG** (Section 4.9), so WETH-denominated quote amounts must be converted.

**MVP assumptions (explicit):**

- **WETH ≡ ETH** (1:1 wrap).
- **USDG ≡ USD** for conversion (1 USDG ≈ $1). Stablecoin depeg risk is out of scope for the hackathon MVP.
- The Chainlink **ETH/USD** feed therefore acts as the **WETH/USDG** rate: one feed, standard DeFi pattern.

**Implementation:**

- **Preferred:** `V4ChainlinkPriceSource.quoteToUsdg()` reads `latestRoundData()` from the ETH/USD feed. For a typical 8-decimal USD feed and 18-decimal WETH, 6-decimal USDG:

  `usdgAmount = (wethAmount * uint256(answer)) / 10**20`

  equivalently `rate1e18 = answer * 1e18 / 10**(feedDecimals + 12)` so `usdgAmount = wethAmount * rate1e18 / 1e18`.

- **Fallback:** if no Chainlink feed is configured, conversion may use a designated **WETH/USDG V4 pool** TWAP via `V4PriceSource` (same `IPriceSource` surface).

- **USDG-quoted pools** (e.g. meme/USDG demo): no conversion step; quote amounts are already USDG.

Each market stores its quote asset and the immutable price source used for conversion for the life of the market.

### 7.4 Payout timing

A proven trigger moves the payout to **pending** for the challenge period (Section 8, layer 6). If it is not challenged, the payout is released automatically. The buyer never files a claim.

---

## 8. Anti-Manipulation Safeguards (defense in depth)

Perfect self-dealing prevention is impossible on-chain, because one person can control many wallets. Each layer below closes a different gap.

| # | Layer | Mechanism | Stops |
| --- | --- | --- | --- |
| 1 | Continuous holding | The buyer's balance is recorded at purchase; at settlement it must still be ≥ the covered amount. | A buyer dumping their own insured tokens to trigger a payout |
| 2 | Holder concentration limit | A wallet holding more than `H`% of circulating supply cannot buy coverage on that token. | Large holders ("bundlers") who can crash the price alone |
| 3 | Known-insider exclusion | The token deployer and the launchpad creator address (for example, from Pons `TokenLaunched`) are recorded at market creation and cannot buy coverage. | The creator insuring their own rug |
| 4 | Activation delay and entry guard | Policies activate after a delay. Purchases revert if the price has already fallen more than `G`% over the last hour. | Buying protection after a crash has already started |
| 5 | Payout cap vs pool depth | Total coverage per severity level is capped by the pool's locked depth (Section 8.1). | Manipulation that costs less than it pays |
| 6 | Challenge period | Pending payouts can be challenged with evidence that the buyer is linked to the dumping wallets, for example bundled wallets funded from a common source or bought in the same block at launch. Challengers post a bond. MVP resolution is by a guardian multisig. | Sybil and bundled-wallet self-dealing that splits holdings to avoid layers 1–3 |
| 7 | Oracle hardening | Tick movement per observation is capped, triggers compare TWAPs rather than spot prices, and the persistence rule requires the price to stay down across blocks. | Single-transaction price manipulation |

### 8.1 Payout cap formula

`D(s)` = the amount of quote asset the pool holds, counting **locked liquidity only**, between the current price `P` and the crash price `P × (1 - s)`. To push the price down by `s`, a seller must absorb all of it.

- Full-range liquidity: `D(s) = y × (1 - sqrt(1 - s))`, where `y` is the pool's quote-side reserve.
- Concentrated liquidity: `D(s) = Σ L_i × (sqrt(P_upper_i) - sqrt(P_lower_i))` over the ticks in the range, computed in Stylus.

A crash of depth `s` triggers every policy with severity ≤ `s`, so for every severity level `s_j` on the grid:

```
Σ C  over active policies with severity <= s_j   <=   α × D(s_j) × quoteToUsdg
```

The constraint is checked at purchase for every `s_j >= policy.severity`.

Illustration: full-range pool, quote side worth 100,000 USDG, `α = 0.5`.

| Severity | `D(s)` | Max total coverage | Tokens a seller must dump (at pre-crash value) |
| --- | --- | --- | --- |
| 50% | 29,300 | 14,600 | ~41,000 |
| 70% | 45,200 | 22,600 | ~83,000 |
| 85% | 61,300 | 30,600 | ~158,000 |
| 95% | 77,600 | 38,800 | ~347,000 |

Two properties follow:

- Deeper triggers get more capacity, because they are harder to fake.
- Only an insider holds that much supply, and insiders are the target of layers 1–3 and 6.

### 8.2 Locked liquidity

Liquidity that can be withdrawn does not count toward `D(s)`. Otherwise an insider could remove liquidity and crash the price with a small sell. In the MVP, a pool is insurable only if its liquidity is attested as permanently locked by an allowlisted **liquidity-lock adapter**: Pons, pools.trade, and Paraape's testnet locker. Market creation remains permissionless for any token whose pool passes this check.

---

## 9. Price Oracle

### 9.1 `PriceObserver`

- `record(poolId)` reads `getSlot0` from the PoolManager and appends `(timestamp, tick, tickCumulative)` to a ring buffer.
- `record` is permissionless and rate-limited by a minimum interval per pool.
- Each new tick is clamped to at most `MAX_TICK_MOVE` from the previous observation, the truncated-oracle technique.
- `observe(poolId, secondsAgos)` returns cumulative ticks with the same semantics as Uniswap V3, so V3 and V4 adapters are interchangeable.
- Buffer capacity must cover the longest active window plus `L` at the configured recording interval.
- The implementation reuses an audited oracle library (for example, OpenZeppelin's Uniswap hooks oracle libraries). It is not written from scratch.

This is a **sampled** TWAP: prices between two recordings are assumed constant. It is less precise than the V3 oracle, which records inside every block that has a swap.

### 9.2 Why recording must be triggered externally

Smart contracts only run when a transaction calls them. The V3 oracle and V4 oracle hooks record inside `swap()`, so traders pay for recording as a side effect. Paraape cannot install a hook on existing pools, so swaps on those pools never call Paraape, and recording has to be triggered from outside.

### 9.3 Liveness

A missing recording during a rug can make a legitimate trigger unprovable. That is the main operational risk. It is mitigated four ways:

1. Every Paraape transaction (purchase, deposit, withdrawal, settlement) also records the market's pool.
2. `record` pays a small bounty from protocol fees while the market has active policies.
3. Paraape runs a keeper bot, and the keeper code is open source.
4. The buyer's frontend records while it is open, and buyers can call `settle` themselves.

The recording interval adapts to the shortest active window in each market: for example, every 30s when a 5-minute policy is active, and every few minutes when the shortest active window is a day.

The keeper is not a trusted role. Anyone can record and anyone can settle.

### 9.4 Market creation and pool binding

`createMarket(token, poolRef)`:

- `poolRef` identifies a V4 `PoolKey` or, when available, a V3 pool.
- The factory validates that:
  - the pool exists and one side is `token`;
  - the quote asset is WETH or USDG;
  - the liquidity-lock adapter attests locked liquidity;
  - locked depth meets `MIN_DEPTH`.
- It records the token deployer and launchpad creator for layer 3.
- The price source is fixed for the life of the market so LPs know exactly which price they underwrite.
- Only one market per token.

### 9.5 WETH → USDG via Chainlink (testnet mock, mainnet feed)

Robinhood Chain documents onchain [Chainlink price feeds](https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood) using the standard `AggregatorV3Interface`. Paraape uses the **ETH/USD** feed only for **WETH quote conversion**, not for meme rug triggers.

| Environment | ETH/USD source | Settlement token |
| --- | --- | --- |
| Testnet (faucet-limited) | Deploy **`MockV3Aggregator`** (8 decimals); set price with `updateAnswer()` for demos | Optional **`pUSDG`** mock (6 decimals, mintable) via `DeployTestnetMocks` |
| Mainnet | Chainlink ETH/USD feed proxy from Chainlink docs | Paxos **USDG** (6 decimals) |

**Production hardening (mainnet, not required for hackathon MVP):** reject non-positive `answer`; check `updatedAt` against the feed heartbeat (staleness); on L2, consider Chainlink **sequencer uptime** before trusting prices. MVP `V4ChainlinkPriceSource` validates `answer > 0` and reads `decimals()` dynamically.

**Demo note:** simulating a **meme rug** is done by moving the **meme pool** price and keeping `PriceObserver` recordings — not by crashing the ETH/USD mock feed (unless testing WETH-quoted markets specifically).

---

## 10. Risk Engine (Stylus)

The Stylus contract is pure computation. It holds no funds and has no admin power over them.

| Function | Inputs | Output |
| --- | --- | --- |
| `realizedVol` | Observations from `PriceObserver` | Volatility per interval |
| `quotePremium` | Volatility, `s`, `w`, duration, coverage, cell utilization | Premium in USDG |
| `estimateApy` | Cell parameters, current demand, utilization | Indicative LP APY |
| `depth` | Pool liquidity by tick, `s` | `D(s)` for the payout cap |

Premium model (initial, to be calibrated):

```
rate    = max(jumpFloor(s, w), windowsPerDuration × pDrawdown(σ, s, w)) × (1 + load)
premium = C × rate × utilizationMultiplier(u)
```

- `pDrawdown` = estimated probability of a drawdown of at least `s` within `w`, from realized volatility `σ`.
- `jumpFloor` = minimum rate per `(s, w)`. Rugs are jumps, and a pure volatility model underprices them.
- `utilizationMultiplier` rises as a cell's free capital runs out, like a lending-rate curve.

Solidity enforces bounds on every Stylus output (minimum and maximum rate, overflow checks). The engine is referenced by an immutable versioned address per market.

---

## 11. Lifecycles

### 11.1 LP

1. Choose a token market, or create it (Section 9.4).
2. Pick a grid cell `(severity, window)` and see live APY and utilization.
3. Deposit USDG and receive cell shares.
4. Premiums accrue **linearly** to the cell over each backed policy's duration.
5. Withdraw any time, limited to the cell's unlocked capital. Locked capital is released at policy expiry or settlement.
6. Payouts reduce the cell's assets, and the loss is shared pro rata by share holders.

### 11.2 Buyer

1. Paste the token address. The UI shows a grid heatmap of available capacity and price per cell, plus presets (for example, "Rug Shield 80% / 15m").
2. Choose severity, window, duration, and coverage `C` (≤ `V × s`).
3. Eligibility checks run: holding, concentration limit, insider exclusion, entry guard, and payout cap.
4. Pay the premium in USDG. The policy is filled best-fit from eligible cells and becomes active after the activation delay.
5. If a trigger is proven, the payout goes pending, then is released after the challenge period.
6. If nothing triggers by expiry, the policy lapses and the premium stays with the LPs.

### 11.3 Settlement

1. Anyone calls `settle(policyId, t0, t1)`.
2. The vault verifies the trigger (Section 6), the holding (layer 1), and computes the payout (Section 7.2).
3. The payout amount is reserved from the backing cells and marked pending.
4. During the challenge period, a challenger may post a bond with evidence.
   - Upheld: the policy is voided, the reserved amount returns to the cells, and the challenger is rewarded and gets the bond back.
   - Rejected: the bond goes to the buyer.
5. After the period, anyone can call `release(policyId)` to pay the buyer.

---

## 12. Protocol Roles

![Protocol roles](./protocol-roles.svg)

- **LP (underwriter):** deposits USDG into a risk cell of a token market and earns premiums; bears payouts.
- **Buyer (trader):** holds the token, pays a premium, and receives a payout if a rug trigger is proven.
- **Recorder / keeper:** permissionless. Calls `record` and `settle`, and earns recording bounties.
- **Challenger:** permissionless. Disputes pending payouts with bonded evidence.
- **Guardian multisig (MVP only):** resolves challenges and sets protocol parameters behind a timelock. It cannot move LP funds.
- **Uniswap pools:** external, read-only price sources. Paraape never deposits into them.

---

## 13. Architecture

```mermaid
flowchart TB
  Buyer --> Vault
  LP --> Vault
  Keeper -->|record, settle| Observer
  Keeper -->|settle, release| Vault
  Challenger -->|challenge| Vault
  Guardian -->|resolve, params| Vault
  Factory -->|deploys| Vault
  Vault --> Adapter[IPriceSource adapter]
  Adapter --> Observer[PriceObserver]
  Adapter --> V3[Uniswap V3 pool observe]
  Observer -->|getSlot0 via extsload| PM[Uniswap V4 PoolManager]
  Vault --> Engine[Stylus RiskEngine]
  Factory --> Lock[Liquidity-lock adapters]
```

**Contracts (Solidity):**

- `MarketFactory.sol`: permissionless market creation, pool validation, insider recording.
- `InsuranceVault.sol`: one per token. It holds:
  - risk cells with share accounting;
  - policies, matching and filling, and premium streaming;
  - settlement, the challenge flow, and safeguard checks.
- `PriceObserver.sol`: sampled TWAP for V4 pools.
- `V4PriceSource.sol`, `V3PriceSource.sol`: `IPriceSource` adapters.
- `LockAdapter` contracts: one per launchpad, plus a testnet locker.

**Contracts (Stylus, Rust):**

- `RiskEngine`: volatility, premium, APY, and depth `D(s)`.

A standalone `PolicyRegistry` from v1 is merged into `InsuranceVault` to reduce deployment and audit surface.

---

## 14. Initial Parameters

Parameters below are starting values set behind a timelock and calibrated later. They are not claims of correctness.

| Parameter | Initial value |
| --- | --- |
| `α` (payout cap vs depth) | 0.5 |
| `H` (holder concentration limit) | 1% of circulating supply |
| `G` (entry guard drop over last hour) | 20% |
| Activation delay | 30 minutes |
| Persistence `K` | 3 observations |
| `MAX_TICK_MOVE` per observation | 9,116 ticks |
| Minimum recording interval | 30 seconds |
| Challenge period | 2 hours |
| Protocol fee | 5% of premiums (funds recording bounties) |
| `MIN_DEPTH` | 25,000 USDG equivalent of locked quote liquidity |

---

## 15. Testnet Deployment (Robinhood Chain Testnet, 46630)

Verified on the testnet explorer:

| Contract | Address |
| --- | --- |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| USDG (proxy, 6 decimals) — **production reference** | `0x7E955252E15c84f5768B83c41a71F9eba181802F` |
| WETH | `0x7943e237c7F95DA44E0301572D358911207852Fa` |

- Pons and pools.trade are not deployed on testnet. The demo deploys:
  - its own test memecoins;
  - hookless V4 pools (mirroring pools.trade) with liquidity held by the Paraape testnet locker;
  - optional **mock pUSDG** (6 decimals, mintable) when the Paxos testnet faucet is insufficient;
  - **Chainlink `MockV3Aggregator`** for ETH/USD when live Chainlink feeds are not on Robinhood testnet yet.
- **WETH/USDG reference pool** is optional. When `CHAINLINK_ETH_USD_FEED` is set, `V4ChainlinkPriceSource` converts WETH-denominated quotes via Chainlink; mainnet uses the same adapter with the real feed address and no code changes.
- Insured-token **rug triggers** still use Paraape's sampled TWAP (`PriceObserver`) on the meme pool — not Chainlink and not GMGN.
- The contracts are pool-agnostic, so the same code runs against Pons and pools.trade pools on mainnet.
- Uniswap V3 availability on testnet is not yet verified. The V3 adapter ships only if it is.

### 15.1 Testnet deploy sequence (mock USDG + mock Chainlink)

Run from `apps/contracts-solidity` with `.env` loaded (`ROBINHOOD_TESTNET_RPC_URL`, `PRIVATE_KEY`). **Stylus risk engine does not need redeploy** if `STYLUS_RISK_ENGINE` still points at the existing activated contract and the Rust code was not changed — only redeploy Solidity.

```bash
# 0) Optional: Stylus (only if not deployed yet or engine code changed)
cd apps/contracts-stylus
cargo stylus deploy --endpoint "$ROBINHOOD_TESTNET_RPC_URL" --private-key "$PRIVATE_KEY" --no-verify

# 1) Mock pUSDG + MockV3Aggregator ETH/USD
cd ../contracts-solidity
forge script script/DeployTestnetMocks.s.sol:DeployTestnetMocks \
  --rpc-url robinhood_testnet --broadcast -vv

# 2) Paste mockUsdg → USDG_ADDRESS, ethUsdFeed → CHAINLINK_ETH_USD_FEED in .env
#    STYLUS_RISK_ENGINE=0x... (existing Stylus address)
#    WETH_USDG_POOL_ID=0x000...000

forge script script/DeployParaape.s.sol:DeployParaape \
  --rpc-url robinhood_testnet --broadcast -vv

# 3) Paste factory, locker, router from logs into .env

forge script script/DeployDemoMarket.s.sol:DeployDemoMarket \
  --rpc-url robinhood_testnet --broadcast -vv
```

Optional: change mock ETH/USD for WETH-quoted market tests — `forge script script/SetMockEthUsd.s.sol:SetMockEthUsd --rpc-url robinhood_testnet --broadcast` with `MOCK_ETH_USD_8DEC` set (e.g. `270000000000` for $2700 at 8 decimals).

---

## 16. Judging Criteria Alignment

| Criterion | How Paraape addresses it |
| --- | --- |
| Smart contract quality | Isolated per-token vaults, full collateralization, checks-effects-interactions, invariant: payouts never exceed a cell's assets |
| Product-market fit | Serves the ~79% of Robinhood Chain DEX volume that is memecoin trading; compensates after the fact instead of only warning |
| Innovation | DLMM-style risk cells for insurance, a sampled TWAP oracle for hookless V4 pools, and a depth-based payout cap |
| Real problem solving | Insider dumps are the dominant rug on locked-liquidity launchpads; Paraape pays when they happen |
| Arbitrum / Stylus | Stylus risk engine for volatility, premium pricing, and tick-walking depth computation |
| USDG bonus | Every value flow is in USDG |
| Robinhood Chain slot | Built for Robinhood Chain's V4 memecoin infrastructure |

---

## 17. MVP Scope (Hackathon)

**In scope:**

- Permissionless market creation with pool validation and lock attestation.
- Risk cells on the grid, share accounting, and LP deposit and withdrawal.
- Policy purchase with best-fit aggregation and all eligibility checks.
- `PriceObserver`, the V4 adapter, the keeper bot, and recording bounties.
- Settlement, indemnity-capped payout, the challenge flow, and the guardian multisig.
- Stylus risk engine: volatility, premium, APY, and depth.
- Frontend rebuilt against the final contracts (the current frontend is a mock).
- Deployment and demo on Robinhood Chain Testnet, including a simulated rug.

**Out of scope (roadmap):**

- LP-set rate markups (`rateTier`).
- Decentralized challenge resolution (UMA or Kleros).
- Storage-proof settlement to remove the recording dependency.
- Median across multiple pools.
- Historical calibration of parameters.
- Mainnet launch and formal audit.

---

## 18. Known Open Risks

1. **Recording liveness.** If no one records during a rug, a legitimate trigger may be unprovable. Mitigations are in Section 9.3, but the risk is not eliminated until storage-proof settlement exists.
2. **Sampled TWAP precision.** Prices between recordings are assumed constant. This is less precise than an in-swap oracle.
3. **Sybil and bundled wallets.** Holdings split across unlinked wallets evade layers 1–3. The challenge layer depends on off-chain cluster analysis and, in the MVP, on a guardian multisig. This is a stated centralization.
4. **Parameter calibration.** Severity floors, `α`, `H`, `G`, and the premium model are initial values pending historical Robinhood Chain data.
5. **Pricing model risk.** Volatility-based pricing underestimates jump risk; `jumpFloor` is a stopgap.
6. **Cold-start liquidity.** It is unproven that LPs will provide capital at scale before usage data exists.
7. **Scope.** The MVP is large for a hackathon build; the in-scope list above is the cut.

---

## 19. Milestones

- **M1 (hackathon submission):** MVP as scoped in Section 17 on Robinhood Chain Testnet, with a demo video of a simulated rug and payout.
- **M2 (+1 month):** calibration from historical Robinhood Chain data, LP rate markups, and hardened keeper infrastructure.
- **M3 (mainnet):** security review, decentralized challenge resolution, mainnet launch on Robinhood Chain, and an LP bootstrapping program.
