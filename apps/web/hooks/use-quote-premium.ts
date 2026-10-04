"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { quotePolicyPremium, USDG_DECIMALS } from "@/lib/risk-quote";

export function useQuotePremium(
  vault: Address | undefined,
  params: {
    severityIdx: number;
    durationIdx: number;
    coverageUsdg: number;
    enabled?: boolean;
  },
) {
  const client = usePublicClient();
  const enabled =
    (params.enabled ?? true) &&
    !!vault &&
    !!client &&
    Number.isFinite(params.coverageUsdg) &&
    params.coverageUsdg > 0;

  const query = useQuery({
    queryKey: [
      "quote-premium",
      vault,
      params.severityIdx,
      params.durationIdx,
      params.coverageUsdg,
    ],
    queryFn: async () => {
      if (!vault || !client) throw new Error("Not ready");
      return quotePolicyPremium(client, vault, {
        severityIdx: params.severityIdx,
        durationIdx: params.durationIdx,
        coverageUsdg: params.coverageUsdg,
      });
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const premiumUsdg = query.data?.premiumUsdg ?? 0n;
  const filledUsdg = query.data?.filledUsdg ?? 0n;
  const premium =
    premiumUsdg > 0n ? Number(formatUnits(premiumUsdg, USDG_DECIMALS)) : 0;
  const filled =
    filledUsdg > 0n ? Number(formatUnits(filledUsdg, USDG_DECIMALS)) : 0;
  const sigma =
    query.data?.sigma1e18 != null ? Number(query.data.sigma1e18) / 1e18 : null;

  return {
    premium,
    premiumUsdg,
    filled,
    filledUsdg,
    sigma,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
