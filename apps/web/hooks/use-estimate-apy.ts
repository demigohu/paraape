"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { usePublicClient } from "wagmi";
import { estimateLpApyBps } from "@/lib/risk-apy";

export function useEstimateApy(
  vault: Address | undefined,
  severityIdx: number,
  enabled = true,
) {
  const client = usePublicClient();
  const query = useQuery({
    queryKey: ["estimate-apy", vault, severityIdx],
    queryFn: () => estimateLpApyBps(client!, vault!, severityIdx),
    enabled: enabled && !!vault && !!client,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const apyPct = query.data ? Number(query.data.apyBps) / 100 : null;

  return {
    apyPct,
    apyBps: query.data?.apyBps,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
