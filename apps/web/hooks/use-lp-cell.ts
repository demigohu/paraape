"use client";

import { formatUnits } from "viem";
import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { insuranceVaultAbi } from "@/lib/abi";
import { cellKey } from "@/lib/grid";
import type { IndexerVaultCell } from "@/lib/indexer";
import { USDG_DECIMALS } from "@/hooks/use-market-token";

function cellFromIndexer(cells: IndexerVaultCell[] | undefined, severityIdx: number) {
  if (!cells?.length) return null;
  const row = cells.find((c) => c.severityIdx === severityIdx);
  if (!row) {
    return {
      totalUsdg: 0,
      lockedUsdg: 0,
      freeUsdg: 0,
      utilization: 0,
    };
  }
  const total = BigInt(row.totalAssets);
  const locked = BigInt(row.lockedAssets);
  const free = BigInt(row.freeAssets);
  return {
    totalUsdg: Number(formatUnits(total, USDG_DECIMALS)),
    lockedUsdg: Number(formatUnits(locked, USDG_DECIMALS)),
    freeUsdg: Number(formatUnits(free, USDG_DECIMALS)),
    utilization: total === 0n ? 0 : Number(locked) / Number(total),
  };
}

export function useLpCell(
  vault: `0x${string}` | undefined,
  severityIdx: number,
  indexerCells?: IndexerVaultCell[],
) {
  const key = cellKey(severityIdx);
  const indexed = useMemo(
    () => cellFromIndexer(indexerCells, severityIdx),
    [indexerCells, severityIdx],
  );

  const q = useReadContract({
    address: vault,
    abi: insuranceVaultAbi,
    functionName: "cells",
    args: [key],
    query: { enabled: !!vault && !indexerCells?.length },
  });

  if (indexed) {
    return {
      ...indexed,
      isLoading: false,
      refetch: q.refetch,
    };
  }

  const total = q.data?.[0] ?? 0n;
  const locked = q.data?.[1] ?? 0n;
  const free = total > locked ? total - locked : 0n;

  return {
    totalUsdg: Number(formatUnits(total, USDG_DECIMALS)),
    lockedUsdg: Number(formatUnits(locked, USDG_DECIMALS)),
    freeUsdg: Number(formatUnits(free, USDG_DECIMALS)),
    utilization: total === 0n ? 0 : Number(locked) / Number(total),
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}
