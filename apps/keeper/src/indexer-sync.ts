import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import type { MarketRegistry } from "./registry.ts";
import { subscribeMarket, subscribePool } from "./registry.ts";

export type KeeperTargetsResponse = {
  chainId: number;
  poolRefs: string[];
  vaultAddresses: string[];
  markets?: Array<{ token: string; vault: string; poolRef: string }>;
};

export type IndexerSyncOptions = {
  chainId: number;
  /** Full URL to GET /keeper/targets */
  targetsUrl: string;
  /** Base URL for GET /ready (defaults to origin of targetsUrl) */
  readyUrl?: string;
  fetchTimeoutMs: number;
  requireReady: boolean;
};

export type IndexerSyncResult =
  | { ok: true; newMarkets: number; newPools: number; totalMarkets: number }
  | { ok: false; reason: string };

const POOL_REF = /^0x[0-9a-fA-F]{64}$/;

export function resolveIndexerUrls(): {
  targetsUrl: string;
  readyUrl: string;
} | null {
  const direct = process.env.KEEPER_MARKETS_URL?.trim();
  if (direct) {
    const u = new URL(direct);
    return { targetsUrl: direct, readyUrl: `${u.origin}/ready` };
  }
  const base = process.env.KEEPER_INDEXER_URL?.trim();
  if (!base) return null;
  const normalized = base.replace(/\/$/, "");
  return {
    targetsUrl: `${normalized}/keeper/targets`,
    readyUrl: `${normalized}/ready`,
  };
}

export function parseIndexerSyncOptions(chainId: number): IndexerSyncOptions | null {
  const urls = resolveIndexerUrls();
  if (!urls) return null;

  const fetchTimeoutMs = Number(process.env.KEEPER_INDEXER_TIMEOUT_MS ?? "15000");
  const requireReady = process.env.KEEPER_INDEXER_REQUIRE_READY === "1";

  return {
    chainId,
    targetsUrl: urls.targetsUrl,
    readyUrl: urls.readyUrl,
    fetchTimeoutMs: Number.isFinite(fetchTimeoutMs) ? fetchTimeoutMs : 15_000,
    requireReady,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ac.signal,
      headers: { accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForIndexerReady(
  readyUrl: string,
  timeoutMs: number,
  pollMs: number = 3000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(readyUrl, Math.min(10_000, pollMs + 5000));
      if (res.status === 200) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

function parsePoolRef(raw: string): Hex | null {
  if (!POOL_REF.test(raw)) return null;
  return raw as Hex;
}

function parseAddr(raw: string): Address | null {
  if (!isAddress(raw)) return null;
  return raw as Address;
}

export function applyKeeperTargets(
  reg: MarketRegistry,
  body: KeeperTargetsResponse,
  expectedChainId: number,
): { newMarkets: number; newPools: number } {
  if (body.chainId !== expectedChainId) {
    throw new Error(`indexer chainId ${body.chainId} != keeper CHAIN_ID ${expectedChainId}`);
  }

  let newMarkets = 0;
  let newPools = 0;

  if (body.markets?.length) {
    for (const m of body.markets) {
      const poolRef = parsePoolRef(m.poolRef);
      const vault = parseAddr(m.vault);
      if (!poolRef || !vault) {
        console.warn("[keeper] indexer: skip invalid market row", m);
        continue;
      }
      if (subscribeMarket(reg, poolRef, vault)) newMarkets++;
    }
  }

  for (const raw of body.poolRefs ?? []) {
    const poolRef = parsePoolRef(raw);
    if (!poolRef) continue;
    if (subscribePool(reg, poolRef)) newPools++;
  }

  return { newMarkets, newPools };
}

export async function syncFromIndexer(
  reg: MarketRegistry,
  options: IndexerSyncOptions,
): Promise<IndexerSyncResult> {
  if (options.requireReady && options.readyUrl) {
    const ready = await fetchWithTimeout(options.readyUrl, options.fetchTimeoutMs).catch(
      () => null,
    );
    if (!ready || !ready.ok || ready.status !== 200) {
      return { ok: false, reason: `indexer not ready (${ready?.status ?? "unreachable"})` };
    }
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(options.targetsUrl, options.fetchTimeoutMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `fetch failed: ${msg}` };
  }

  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
  }

  let body: KeeperTargetsResponse;
  try {
    body = (await res.json()) as KeeperTargetsResponse;
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }

  try {
    const { newMarkets, newPools } = applyKeeperTargets(reg, body, options.chainId);
    const totalMarkets = body.markets?.length ?? body.vaultAddresses.length;
    return { ok: true, newMarkets, newPools, totalMarkets };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

export function startIndexerSyncLoop(
  reg: MarketRegistry,
  options: IndexerSyncOptions,
  intervalMs: number,
  isStopping: () => boolean,
): () => void {
  const tick = async () => {
    if (isStopping()) return;
    const result = await syncFromIndexer(reg, options);
    if (result.ok) {
      if (result.newMarkets > 0 || result.newPools > 0) {
        console.log(
          `[keeper] indexer sync: +${result.newMarkets} market(s), +${result.newPools} pool(s) ` +
            `(indexer markets=${result.totalMarkets}, local pools=${reg.pools.size} vaults=${reg.vaults.size})`,
        );
      }
    } else {
      console.warn(`[keeper] indexer sync skipped: ${result.reason}`);
    }
  };

  void tick();
  const handle = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(handle);
}
