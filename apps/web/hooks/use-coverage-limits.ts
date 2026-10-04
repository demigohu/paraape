"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import {
  fetchFillableUsdgOnChain,
  fillableUsdgFromIndexerCells,
} from "@/lib/fillable-liquidity";
import type { Token } from "@/lib/protocol";
import { fetchDepthCapHeadroomUsdg, type VaultMarketSnapshot } from "@/lib/vault-market";
import { maxCoverageFromHoldingsRaw } from "@/lib/token-price";

export function useCoverageLimits(
  token: Token | null,
  severityIdx: number,
  severityPctOnChain: number,
  snapshot: VaultMarketSnapshot | null,
) {
  const client = usePublicClient();
  const vault = token?.vault;

  const fillableQ = useQuery({
    queryKey: ["fillable-usdg", vault, severityIdx, token?.indexerCells?.length],
    queryFn: async () => {
      if (!vault || !client) return 0;
      if (token?.indexerCells?.length) {
        return fillableUsdgFromIndexerCells(token.indexerCells, severityIdx);
      }
      return fetchFillableUsdgOnChain(client, vault, severityIdx);
    },
    enabled: !!vault && !!client && !!token,
    staleTime: 20_000,
  });

  const depthCapQ = useQuery({
    queryKey: ["depth-cap", vault, severityIdx, snapshot?.poolDepthUsdg],
    queryFn: () => fetchDepthCapHeadroomUsdg(client!, vault!, severityIdx, snapshot!),
    enabled: !!vault && !!client && !!snapshot,
    staleTime: 30_000,
  });

  const balanceRaw = token?.walletBalanceRaw ? BigInt(token.walletBalanceRaw) : 0n;
  const fromHoldings =
    token && balanceRaw > 0n && token.usdgPerTokenRaw !== "0"
      ? maxCoverageFromHoldingsRaw(
          balanceRaw,
          BigInt(token.usdgPerTokenRaw),
          token.tokenDecimals,
          severityPctOnChain,
        )
      : 0;

  const fillable = fillableQ.data ?? 0;
  const depthCap = depthCapQ.data ?? Infinity;
  const lpGross = token ? Math.max(0, token.vaultTvl - token.lockedTvl) : 0;

  const maxCoverage = token
    ? Math.floor(Math.min(fromHoldings, depthCap, fillable, lpGross))
    : 0;

  return {
    maxCoverage,
    fillableUsdg: fillable,
    depthCapHeadroomUsdg: depthCap === Infinity ? null : depthCap,
    holdingsCapUsdg: fromHoldings,
    isLoading: fillableQ.isLoading || depthCapQ.isLoading,
    error: (fillableQ.error ?? depthCapQ.error) as Error | null,
  };
}
