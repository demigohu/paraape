import { parseAbi } from "viem";

export const marketFactoryAbi = parseAbi([
  "function vaultByToken(address token) view returns (address vault)",
  "function config() view returns (uint16 payoutCapAlphaBps, uint16 holderConcentrationBps, uint16 entryGuardDropBps, uint32 activationDelay, uint8 persistenceK, int24 maxTickMove, uint32 minRecordInterval, uint32 challengePeriod, uint16 protocolFeeBps, uint256 minDepthUsdg, uint256 minPremiumUsdg, uint16 minPremiumBps, uint256 maxPremiumBps, uint256 challengeSpamFeeUsdg, uint256 recordBountyUsdg)",
  "function createMarket((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, address token, address lockAdapter, address tokenDeployer, address launchpadCreator) returns (address vault)",
]);

export const lockerAbi = parseAbi([
  "function isLiquidityLocked(bytes32 poolRef) view returns (bool)",
  "function lockedQuoteDepth(bytes32 poolRef) view returns (uint256)",
]);

export const poolManagerAbi = parseAbi([
  "function extsload(bytes32 slot) view returns (bytes32)",
]);

export const demoMintAbi = parseAbi([
  "function mint(address to, uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

export const insuranceVaultAbi = parseAbi([
  "function purchasePolicy(uint8 severityIdx, uint8 durationIdx, uint256 coverageUsdg, uint256 minCoverageUsdg) returns (uint256 policyId)",
  "function deposit(uint8 severityIdx, uint256 assets) returns (uint256 shares)",
  "function withdraw(uint8 severityIdx, uint256 shares) returns (uint256 assets)",
  "function settle(uint256 policyId)",
  "function challenge(uint256 policyId)",
  "function release(uint256 policyId)",
  "function expirePolicy(uint256 policyId)",
  "function getPolicy(uint256 policyId) view returns ((address buyer, uint8 severityIdx, uint8 durationIdx, uint256 coverageUsdg, uint256 premiumUsdg, uint256 lpPremiumTotal, uint256 lpPremiumAccrued, uint256 coveredTokens, uint256 purchasedAt, uint256 activeFrom, uint256 expiry, uint8 status, uint256 pendingPayout, uint256 challengeDeadline, address challenger, uint256 challengeBond))",
  "function insuredToken() view returns (address)",
  "function poolRef() view returns (bytes32)",
  "function observer() view returns (address)",
  "function riskEngine() view returns (address)",
  "function priceSource() view returns (address)",
  "function quoteToUsdgPoolRef() view returns (bytes32)",
  "function lockedQuoteDepth() view returns (uint256)",
  "function tokenIsCurrency0() view returns (bool)",
  "function quoteIsUsdg() view returns (bool)",
  "function tokenDecimals() view returns (uint8)",
  "function quoteDecimals() view returns (uint8)",
  "function coverageBySeverityFloor(uint8 severityIdx) view returns (uint256)",
  "function cells(bytes32 key) view returns (uint256 totalAssets, uint256 lockedAssets, uint256 totalShares)",
  "function config() view returns (uint16 payoutCapAlphaBps, uint16 holderConcentrationBps, uint16 entryGuardDropBps, uint32 activationDelay, uint8 persistenceK, int24 maxTickMove, uint32 minRecordInterval, uint32 challengePeriod, uint16 protocolFeeBps, uint256 minDepthUsdg, uint256 minPremiumUsdg, uint16 minPremiumBps, uint256 maxPremiumBps, uint256 challengeSpamFeeUsdg, uint256 recordBountyUsdg)",
]);

export const priceSourceAbi = parseAbi([
  "function consultTwapTick(bytes32 poolRef, uint32 twapLength) view returns (int24 tick)",
  "function quoteToUsdg(bytes32 quotePoolRef) view returns (uint256 rate1e18)",
]);

export const priceObserverAbi = parseAbi([
  "function exportTickPayload(bytes32 poolRef) view returns (bytes payload)",
]);

export const riskEngineAbi = parseAbi([
  "function realizedVol(bytes observerPayload) view returns (uint256 sigma1e18)",
  "function quotePremium(bytes32 poolRef, uint256 sigma1e18, uint16 severityBps, uint32 windowSec, uint32 durationSec, uint256 coverageUsdg, uint256 cellUtilization1e18) view returns (uint256 premiumUsdg)",
  "function estimateApy(uint16 severityBps, uint32 windowSec, uint256 utilization1e18, uint256 sigma1e18) view returns (uint256 apyBps)",
  "function depthFullRange(uint256 quoteReserve, uint16 severityBps) view returns (uint256)",
]);
