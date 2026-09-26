/**
 * Frontend-only protocol model. Every value here is sample data until the
 * MarketFactory / InsuranceVault / PolicyRegistry contracts are wired in.
 */

export type Token = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  /** Rolling daily volatility, as a fraction (0.42 = 42%). */
  volatility: number;
  /** USD liquidity in the token's Uniswap V4 pool. */
  poolTvl: number;
  /** USDG currently deposited by LPs into this token's isolated vault. */
  vaultTvl: number;
  /** USDG already locked backing active policies. */
  lockedTvl: number;
  /** Amount of the token held by the connected wallet. */
  walletBalance: number;
  priceUsd: number;
};

export const MIN_POOL_TVL = 25_000;

export const SEVERITY = { min: 50, max: 95, step: 5, default: 85 } as const;
export const WINDOW = { min: 5, max: 60, step: 5, default: 10 } as const;
export const DURATIONS = [7, 14, 30] as const;

export const TOKENS: Token[] = [
  {
    symbol: "HOODRAT",
    name: "Hood Rat",
    address: "0x7a3f91c2e04b5d18a6f2c9e3b1d07f4a5c8e2b61",
    volatility: 0.46,
    poolTvl: 812_430,
    vaultTvl: 148_920,
    lockedTvl: 61_300,
    walletBalance: 1_284_000,
    priceUsd: 0.00412,
  },
  {
    symbol: "STONKAPE",
    name: "Stonk Ape",
    address: "0x19be4c7d2a0f83e56b1d94c0a7e2f5b38c6d0e17",
    volatility: 0.63,
    poolTvl: 391_870,
    vaultTvl: 52_410,
    lockedTvl: 38_950,
    walletBalance: 58_200,
    priceUsd: 0.0871,
  },
  {
    symbol: "TENDIE",
    name: "Tendie Coin",
    address: "0xc4e20b9f7163a8d5e2f0b17c93a64d8e5f21b0a9",
    volatility: 0.38,
    poolTvl: 1_204_110,
    vaultTvl: 0,
    lockedTvl: 0,
    walletBalance: 0,
    priceUsd: 0.0213,
  },
  {
    symbol: "GMEOW",
    name: "Game Meow",
    address: "0x5d81f3a0c6b2e947d1a08f5c3e7b29d4a6f0c812",
    volatility: 0.81,
    poolTvl: 14_620,
    vaultTvl: 0,
    lockedTvl: 0,
    walletBalance: 902_000,
    priceUsd: 0.00031,
  },
];

export function findToken(query: string): Token | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return TOKENS.find(
    (t) => t.address.toLowerCase() === q || t.symbol.toLowerCase() === q,
  );
}

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Relative chance (per 30 days) that a crash of `severity`% within
 * `windowMin` minutes happens. Illustrative only: PRD section 10 notes the
 * trigger values are not yet calibrated against historical data.
 */
export function triggerProbability(
  volatility: number,
  severity: number,
  windowMin: number,
): number {
  const depth = Math.pow((100 - severity) / 50, 1.6);
  const speed = Math.sqrt(windowMin / 10);
  return Math.min(0.6, 0.045 * (volatility / 0.4) * depth * speed + 0.004);
}

/** Estimated LP APY for a given parameter pair, in percent. */
export function estimateApy(
  token: Token,
  severity: number,
  windowMin: number,
): number {
  const p = triggerProbability(token.volatility, severity, windowMin);
  const utilization =
    token.vaultTvl > 0 ? Math.min(0.9, token.lockedTvl / token.vaultTvl) : 0.35;
  return p * 12 * 100 * (0.55 + utilization);
}

/** Premium in USDG to cover `coverage` USDG for `days`. */
export function quotePremium(
  token: Token,
  severity: number,
  windowMin: number,
  coverage: number,
  days: number,
): number {
  const p = triggerProbability(token.volatility, severity, windowMin);
  return coverage * p * (days / 30) * 1.18;
}

/**
 * Payout cap (PRD safeguard 2): kept below the estimated cost of pushing the
 * pool price down by `severity`%.
 */
export function payoutCap(token: Token, severity: number): number {
  return Math.round(token.poolTvl * (severity / 100) * 0.08);
}

export function availableCapacity(token: Token): number {
  return Math.max(0, token.vaultTvl - token.lockedTvl);
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

export type Policy = {
  id: string;
  token: string;
  severity: number;
  windowMin: number;
  coverage: number;
  premium: number;
  expiresInDays: number;
  status: "active" | "paid" | "expired";
};

export type Position = {
  id: string;
  token: string;
  severity: number;
  windowMin: number;
  deposited: number;
  earned: number;
  locked: number;
  apy: number;
};

export const POLICIES: Policy[] = [
  {
    id: "pol-2291",
    token: "HOODRAT",
    severity: 85,
    windowMin: 10,
    coverage: 2_500,
    premium: 41.37,
    expiresInDays: 11,
    status: "active",
  },
  {
    id: "pol-2178",
    token: "STONKAPE",
    severity: 80,
    windowMin: 15,
    coverage: 1_200,
    premium: 36.82,
    expiresInDays: 3,
    status: "active",
  },
  {
    id: "pol-1904",
    token: "PEPEHOOD",
    severity: 85,
    windowMin: 10,
    coverage: 900,
    premium: 17.4,
    expiresInDays: 0,
    status: "paid",
  },
  {
    id: "pol-1733",
    token: "HOODRAT",
    severity: 90,
    windowMin: 5,
    coverage: 600,
    premium: 4.91,
    expiresInDays: 0,
    status: "expired",
  },
];

export const POSITIONS: Position[] = [
  {
    id: "pos-0412",
    token: "HOODRAT",
    severity: 85,
    windowMin: 10,
    deposited: 12_000,
    earned: 684.21,
    locked: 4_870,
    apy: 21.4,
  },
  {
    id: "pos-0388",
    token: "STONKAPE",
    severity: 90,
    windowMin: 5,
    deposited: 5_000,
    earned: 118.63,
    locked: 3_240,
    apy: 12.7,
  },
];

export type ActivityItem = {
  id: string;
  kind: "premium" | "payout" | "deposit" | "withdraw";
  token: string;
  amount: number;
  minutesAgo: number;
};

export const ACTIVITY: ActivityItem[] = [
  { id: "a1", kind: "premium", token: "HOODRAT", amount: 12.84, minutesAgo: 7 },
  { id: "a2", kind: "deposit", token: "STONKAPE", amount: 5_000, minutesAgo: 52 },
  { id: "a3", kind: "premium", token: "STONKAPE", amount: 3.17, minutesAgo: 138 },
  { id: "a4", kind: "payout", token: "PEPEHOOD", amount: 900, minutesAgo: 1_430 },
  { id: "a5", kind: "withdraw", token: "HOODRAT", amount: 1_750, minutesAgo: 2_910 },
];
