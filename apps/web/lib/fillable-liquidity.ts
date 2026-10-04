import { formatUnits, type Address, type PublicClient } from "viem";
import { insuranceVaultAbi } from "@/lib/abi";
import { SEVERITY_COUNT, cellBacksPolicy, cellKey } from "@/lib/grid";
import type { IndexerVaultCell } from "@/lib/indexer";
import { USDG_DECIMALS } from "@/hooks/use-market-token";

/** Sum free USDG in LP cells that can back a buyer severity (on-chain reads). */
export async function fetchFillableUsdgOnChain(
  client: PublicClient,
  vault: Address,
  severityIdx: number,
): Promise<number> {
  let total = 0n;
  for (let sev = 0; sev < SEVERITY_COUNT; sev++) {
    if (!cellBacksPolicy(sev, severityIdx)) continue;
    const key = cellKey(sev);
    const [totalAssets, lockedAssets] = await client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "cells",
      args: [key],
    });
    const free = totalAssets > lockedAssets ? totalAssets - lockedAssets : 0n;
    total += free;
  }
  return Number(formatUnits(total, USDG_DECIMALS));
}

/** Same sum from indexer cell rows (no RPC fan-out). */
export function fillableUsdgFromIndexerCells(
  cells: IndexerVaultCell[] | undefined,
  severityIdx: number,
): number {
  if (!cells?.length) return 0;
  let total = 0n;
  for (const c of cells) {
    if (c.severityIdx == null) continue;
    if (!cellBacksPolicy(c.severityIdx, severityIdx)) continue;
    total += BigInt(c.freeAssets);
  }
  return Number(formatUnits(total, USDG_DECIMALS));
}
