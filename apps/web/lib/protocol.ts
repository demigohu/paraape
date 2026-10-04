import type { IndexerVaultCell } from "@/lib/indexer";

/** Live market view (indexer + on-chain reads). */
export type Token = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  vault?: `0x${string}`;
  /** Realized vol from risk engine (fraction); null if RPC failed. */
  volatility: number | null;
  /** Locked quote reserve in USDG (MarketFactory min-depth gate). */
  poolDepthUsdg: number;
  poolDepthUsdgRaw: string;
  /** Factory/vault minimum depth floor in USDG. */
  minDepthUsdg: number;
  minDepthUsdgRaw: string;
  vaultTvl: number;
  lockedTvl: number;
  walletBalance: number;
  walletBalanceRaw: string;
  /** TWAP token price in USDG (6-decimal human); 0 if oracle tick unusable. */
  priceUsdg: number;
  /** USDG raw (6 dec) per 1 whole token; 0n string when sanity check fails. */
  usdgPerTokenRaw: string;
  tokenDecimals: number;
  activationDelaySec: number;
  /** Indexer cell rows for fillable-liquidity without RPC fan-out. */
  indexerCells?: IndexerVaultCell[];
  /** Latest tick from PriceObserver (indexer); TWAP uses history of these. */
  oracleLastTick?: number | null;
  oracleCardinality?: number;
};

/** @deprecated Use `token.minDepthUsdg` from vault config. */
export const MIN_POOL_TVL = 25_000;

export const SEVERITY = { min: 50, max: 95, step: 5, default: 85 } as const;
export const WINDOW = { min: 5, max: 60, step: 5, default: 10 } as const;
/** Matches on-chain `GridLib.durationSeconds` indices. */
export const DURATIONS = [1, 3, 7, 14, 30] as const;

export function vaultLpCapacityUsdg(token: Token): number {
  return Math.max(0, token.vaultTvl - token.lockedTvl);
}

export function marketMeetsDepthFloor(token: Token): boolean {
  try {
    return BigInt(token.poolDepthUsdgRaw) >= BigInt(token.minDepthUsdgRaw);
  } catch {
    return token.poolDepthUsdg >= token.minDepthUsdg;
  }
}

/** @deprecated Renamed to `vaultLpCapacityUsdg` — kept for stale HMR bundles. */
export const availableCapacity = vaultLpCapacityUsdg;

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}


export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

export const num = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

