import { INDEXER_URL } from "@/lib/env";

export type IndexerMarket = {
  token: `0x${string}`;
  vault: `0x${string}`;
  poolRef: `0x${string}`;
  tokenDeployer: `0x${string}`;
  launchpadCreator: `0x${string}`;
  createdAt: string;
  createdBlock: string;
};

export type IndexerPolicy = {
  id: string;
  policyId: string;
  buyer: `0x${string}`;
  vault: `0x${string}`;
  token: `0x${string}`;
  severityIdx: number;
  durationIdx: number | null;
  windowIdx: number | null;
  coverageUsdg: string;
  premiumUsdg: string;
  status: string;
  payout?: string;
  challengeDeadline?: string;
  purchasedAt: string;
};

export type IndexerActivity = {
  id: string;
  kind: string;
  vault: `0x${string}`;
  token: `0x${string}`;
  policyId?: string;
  cellKey?: `0x${string}`;
  amountUsdg?: string;
  timestamp: string;
  txHash: `0x${string}`;
};

export type IndexerVaultCell = {
  cellKey: `0x${string}`;
  severityIdx: number | null;
  windowIdx: number | null;
  totalAssets: string;
  lockedAssets: string;
  totalShares: string;
  freeAssets: string;
};

export type TokenMarketResponse = {
  market: IndexerMarket;
  policies: Array<{
    id: string;
    policyId: string;
    buyer: `0x${string}`;
    status: string;
    coverageUsdg: string;
    premiumUsdg: string;
  }>;
  oracle: {
    poolRef: string;
    cardinality: number;
    lastTick: number;
    lastTimestamp: string;
  } | null;
  vaultTvl?: string;
  lockedTvl?: string;
  cells?: IndexerVaultCell[];
};

export type IndexerLpPosition = {
  id: string;
  vault: `0x${string}`;
  token: `0x${string}`;
  cellKey: `0x${string}`;
  severityIdx: number | null;
  windowIdx: number | null;
  shares: string;
  depositedUsdg: string;
  lockedUsdg: string;
  freeUsdg: string;
  updatedAt: string;
};

async function indexerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${INDEXER_URL}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Indexer ${res.status} ${path}${body ? `: ${body.slice(0, 120)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export function fetchMarkets() {
  return indexerFetch<{ chainId: number; markets: IndexerMarket[] }>("/markets");
}

export function fetchMarketByToken(address: string) {
  return indexerFetch<TokenMarketResponse>(`/markets/token/${address}`);
}

export function fetchPoliciesForBuyer(address: string) {
  return indexerFetch<{ chainId: number; policies: IndexerPolicy[] }>(
    `/policies/buyer/${address}`,
  );
}

export function fetchLpPositions(address: string) {
  return indexerFetch<{ chainId: number; positions: IndexerLpPosition[] }>(
    `/lp/${address}`,
  );
}

export function fetchWalletActivity(address: string) {
  return indexerFetch<{ chainId: number; activities: IndexerActivity[] }>(
    `/activity/wallet/${address}`,
  );
}
