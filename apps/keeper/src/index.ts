import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRegistry, observerRecordPools } from "./registry.ts";
import {
  parseIndexerSyncOptions,
  startIndexerSyncLoop,
  syncFromIndexer,
  waitForIndexerReady,
} from "./indexer-sync.ts";

const observerAbi = parseAbi([
  "function record(bytes32 poolRef) external returns (uint16 idx, int24 tick)",
  "function cardinality(bytes32 poolRef) external view returns (uint16)",
  "function lastRecordTime(bytes32 poolRef) external view returns (uint32)",
  "function minRecordInterval() external view returns (uint32)",
  "event Recorded(bytes32 indexed poolRef, uint16 index, int24 tick, uint32 timestamp, uint32 blockNumber)",
]);

const vaultAbi = parseAbi(["function recordPool() external"]);

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parsePoolRefs(raw: string | undefined): Hex[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!/^0x[0-9a-fA-F]{64}$/.test(s)) {
        throw new Error(`Invalid bytes32 pool ref: ${s}`);
      }
      return s as Hex;
    });
}

function parseOptionalAddresses(raw: string | undefined): Address[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!/^0x[0-9a-fA-F]{40}$/.test(s)) {
        throw new Error(`Invalid address: ${s}`);
      }
      return s as Address;
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("rate limit") || msg.includes("PriceObserver: rate limit");
}

async function main() {
  const rpcUrl = requireEnv("ROBINHOOD_TESTNET_RPC_URL");
  const pk = requireEnv("PRIVATE_KEY") as Hex;
  const observer = requireEnv("PRICE_OBSERVER_ADDRESS") as Address;
  const staticPools = parsePoolRefs(process.env.POOL_REFS);
  const staticVaults = parseOptionalAddresses(process.env.VAULT_ADDRESSES);
  const chainId = Number(process.env.CHAIN_ID ?? "46630");
  const intervalMs = Number(process.env.RECORD_INTERVAL_MS ?? "35000");
  const indexerSyncMs = Number(process.env.KEEPER_INDEXER_SYNC_MS ?? "120000");

  const indexerOptions = parseIndexerSyncOptions(chainId);
  if (!indexerOptions) {
    throw new Error(
      "KEEPER_INDEXER_URL or KEEPER_MARKETS_URL is required — markets come from Ponder only",
    );
  }
  if (!Number.isFinite(intervalMs) || intervalMs < 5000) {
    throw new Error("RECORD_INTERVAL_MS must be >= 5000");
  }

  const chain = {
    id: chainId,
    name: "Robinhood Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const onChainId = await publicClient.getChainId();
  if (onChainId !== chainId) {
    throw new Error(`RPC chainId ${onChainId} != CHAIN_ID ${chainId}`);
  }

  const registry = createRegistry(staticPools, staticVaults);

  console.log(`[keeper] indexer targets=${indexerOptions.targetsUrl}`);

  if (process.env.KEEPER_INDEXER_WAIT_READY === "1" && indexerOptions.readyUrl) {
    const waitMs = Number(process.env.KEEPER_INDEXER_STARTUP_TIMEOUT_MS ?? "600000");
    console.log(`[keeper] waiting for indexer /ready (timeout ${waitMs}ms)…`);
    const ready = await waitForIndexerReady(indexerOptions.readyUrl, waitMs);
    if (!ready) {
      throw new Error("Indexer did not become ready before timeout");
    }
  }

  const boot = await syncFromIndexer(registry, indexerOptions);
  if (boot.ok) {
    console.log(
      `[keeper] indexer bootstrap: markets=${boot.totalMarkets} ` +
        `pools=${registry.pools.size} vaults=${registry.vaults.size}`,
    );
  } else if (registry.pools.size === 0 && registry.vaults.size === 0) {
    throw new Error(`Indexer bootstrap failed and registry empty: ${boot.reason}`);
  } else {
    console.warn(`[keeper] indexer bootstrap failed (using static POOL_REFS/VAULTS): ${boot.reason}`);
  }

  const minInterval = await publicClient.readContract({
    address: observer,
    abi: observerAbi,
    functionName: "minRecordInterval",
  });

  console.log(
    `[keeper] observer=${observer} pools=${registry.pools.size} vaults=${registry.vaults.size} ` +
      `minRecordInterval=${minInterval}s loop=${intervalMs}ms wallet=${account.address}`,
  );

  if (intervalMs < minInterval * 1000) {
    console.warn(
      `[keeper] WARN: RECORD_INTERVAL_MS (${intervalMs}) < minRecordInterval (${minInterval}s) — expect rate-limit skips`,
    );
  }

  let stopping = false;
  let stopIndexerSync: (() => void) | undefined;
  if (Number.isFinite(indexerSyncMs) && indexerSyncMs >= 10_000) {
    stopIndexerSync = startIndexerSyncLoop(
      registry,
      indexerOptions,
      indexerSyncMs,
      () => stopping,
    );
    console.log(`[keeper] indexer poll every ${indexerSyncMs}ms`);
  } else {
    console.warn("[keeper] KEEPER_INDEXER_SYNC_MS < 10000 — periodic indexer sync disabled");
  }

  const stop = () => {
    stopping = true;
    stopIndexerSync?.();
    console.log("\n[keeper] shutting down…");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    const tickStart = Date.now();
    const vaults = [...registry.vaults];
    const poolRefs = observerRecordPools(registry);

    for (const vault of vaults) {
      try {
        const hash = await walletClient.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "recordPool",
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(
          `[keeper] vault.recordPool ${vault} ok block=${receipt.blockNumber} tx=${hash}`,
        );
      } catch (err) {
        if (isRateLimit(err)) {
          console.log(`[keeper] vault ${vault} rate limited (ok)`);
        } else {
          console.error(`[keeper] vault ${vault} error:`, err instanceof Error ? err.message : err);
        }
      }
    }

    for (const poolRef of poolRefs) {
      try {
        const hash = await walletClient.writeContract({
          address: observer,
          abi: observerAbi,
          functionName: "record",
          args: [poolRef],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const card = await publicClient.readContract({
          address: observer,
          abi: observerAbi,
          functionName: "cardinality",
          args: [poolRef],
        });
        console.log(
          `[keeper] record pool=${poolRef.slice(0, 10)}… card=${card} block=${receipt.blockNumber} tx=${hash}`,
        );
      } catch (err) {
        if (isRateLimit(err)) {
          const last = await publicClient.readContract({
            address: observer,
            abi: observerAbi,
            functionName: "lastRecordTime",
            args: [poolRef],
          });
          console.log(`[keeper] pool ${poolRef.slice(0, 10)}… rate limited (last=${last})`);
        } else {
          console.error(
            `[keeper] pool ${poolRef.slice(0, 10)}… error:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    const elapsed = Date.now() - tickStart;
    const wait = Math.max(0, intervalMs - elapsed);
    if (wait > 0 && !stopping) await sleep(wait);
  }
}

main().catch((e) => {
  console.error("[keeper] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
