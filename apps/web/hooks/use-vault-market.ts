"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { fetchVaultMarketSnapshot, type VaultMarketSnapshot } from "@/lib/vault-market";

export function useVaultMarket(vault: Address | undefined) {
  const client = usePublicClient();
  const query = useQuery({
    queryKey: ["vault-market", vault],
    queryFn: () => fetchVaultMarketSnapshot(client!, vault!),
    enabled: !!vault && !!client,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    snapshot: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export type { VaultMarketSnapshot };
