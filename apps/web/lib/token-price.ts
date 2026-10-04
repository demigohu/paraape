import { formatUnits } from "viem";
import { USDG_DECIMALS } from "@/hooks/use-market-token";
import { mulDiv, tokenAmountToQuote } from "@/lib/tick-math";

/** Reject TWAP-implied prices above $1,000 / token (6-dec USDG raw). */
const MAX_USDG_PER_TOKEN_RAW = 10n ** 9n;

export function toInt24Tick(t: number | bigint): number {
  let n = typeof t === "bigint" ? Number(t) : t;
  if (!Number.isFinite(n)) return 0;
  if (n > 0x7fffff) n -= 0x1000000;
  return Math.trunc(n);
}

/** USDG (6 dec) for `amount` whole tokens at TWAP tick — mirrors vault `_maxCoverageUsdg` math. */
export function usdgPerTokenRawAtTick(
  tick: number | bigint,
  tokenIsCurrency0: boolean,
  tokenDecimals: number,
  quoteIsUsdg: boolean,
  rate1e18: bigint,
): bigint {
  const tickNum = toInt24Tick(tick);
  const oneToken = 10n ** BigInt(tokenDecimals);
  const quotePerToken = tokenAmountToQuote(oneToken, tickNum, tokenIsCurrency0);
  const usdgRaw = quoteIsUsdg ? quotePerToken : mulDiv(quotePerToken, rate1e18, 10n ** 18n);
  if (usdgRaw <= 0n || usdgRaw > MAX_USDG_PER_TOKEN_RAW) return 0n;
  return usdgRaw;
}

export function usdgHumanFromRaw(raw: bigint): number {
  if (raw <= 0n) return 0;
  return Number(formatUnits(raw, USDG_DECIMALS));
}

/** Wallet holdings in USDG (6-dec human). */
export function holdingsUsdgHuman(
  balanceRaw: bigint,
  usdgPerTokenRaw: bigint,
  tokenDecimals: number,
): number {
  if (balanceRaw <= 0n || usdgPerTokenRaw <= 0n) return 0;
  const valueRaw = mulDiv(balanceRaw, usdgPerTokenRaw, 10n ** BigInt(tokenDecimals));
  return Number(formatUnits(valueRaw, USDG_DECIMALS));
}

export function maxCoverageFromHoldingsRaw(
  balanceRaw: bigint,
  usdgPerTokenRaw: bigint,
  tokenDecimals: number,
  severityPctOnChain: number,
): number {
  const value = holdingsUsdgHuman(balanceRaw, usdgPerTokenRaw, tokenDecimals);
  if (value <= 0) return 0;
  return Math.floor((value * severityPctOnChain) / 100);
}
