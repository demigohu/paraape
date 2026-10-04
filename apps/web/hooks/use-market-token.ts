"use client";

import { useMemo } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/abi";
import type { IndexerMarket, IndexerVaultCell, TokenMarketResponse } from "@/lib/indexer";
import { fetchRealizedVol } from "@/lib/risk-quote";
import { type Token } from "@/lib/protocol";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { fetchVaultMarketSnapshot } from "@/lib/vault-market";

export const USDG_DECIMALS = 6;

export type IndexerVaultStats = {
  vaultTvl?: string;
  lockedTvl?: string;
  cells?: IndexerVaultCell[];
  oracle?: TokenMarketResponse["oracle"];
};

export function useMarketToken(
  market: IndexerMarket | null,
  vaultStats?: IndexerVaultStats | null,
): {
  token: Token | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { address: wallet } = useAccount();
  const tokenAddr = market?.token;
  const publicClient = usePublicClient();

  const symbolQ = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!tokenAddr },
  });
  const nameQ = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "name",
    query: { enabled: !!tokenAddr },
  });
  const decimalsQ = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!tokenAddr },
  });
  const balanceQ = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: wallet ? [wallet as Address] : undefined,
    query: { enabled: !!tokenAddr && !!wallet },
  });
  const volQ = useQuery({
    queryKey: ["realized-vol", market?.vault],
    queryFn: () => fetchRealizedVol(publicClient!, market!.vault),
    enabled: !!market?.vault && !!publicClient,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const marketQ = useQuery({
    queryKey: ["vault-market-token", market?.vault],
    queryFn: () => fetchVaultMarketSnapshot(publicClient!, market!.vault),
    enabled: !!market?.vault && !!publicClient,
    staleTime: 30_000,
  });

  const isLoading =
    !!market &&
    (symbolQ.isLoading ||
      nameQ.isLoading ||
      decimalsQ.isLoading ||
      balanceQ.isFetching ||
      volQ.isLoading ||
      marketQ.isLoading);

  const refetch = () => {
    void symbolQ.refetch();
    void nameQ.refetch();
    void decimalsQ.refetch();
    void balanceQ.refetch();
    void volQ.refetch();
    void marketQ.refetch();
  };

  const token = useMemo((): Token | null => {
    if (!market || !symbolQ.data || !marketQ.data) return null;

    const symbol = symbolQ.data;
    const name = nameQ.data ?? symbol;
    const decimals = Number(decimalsQ.data ?? 18);
    const rawBal = balanceQ.data;
    const walletBalance = rawBal ? Number(formatUnits(rawBal, decimals)) : 0;
    const vaultTvl = vaultStats?.vaultTvl
      ? Number(formatUnits(BigInt(vaultStats.vaultTvl), USDG_DECIMALS))
      : 0;
    const lockedTvl = vaultStats?.lockedTvl
      ? Number(formatUnits(BigInt(vaultStats.lockedTvl), USDG_DECIMALS))
      : 0;

    const snap = marketQ.data;

    return {
      symbol,
      name,
      address: market.token,
      vault: market.vault,
      volatility: volQ.data ?? null,
      poolDepthUsdg: snap.poolDepthUsdg,
      poolDepthUsdgRaw: snap.poolDepthUsdgRaw.toString(),
      minDepthUsdg: snap.minDepthUsdg,
      minDepthUsdgRaw: snap.minDepthUsdgRaw.toString(),
      vaultTvl,
      lockedTvl,
      walletBalance,
      walletBalanceRaw: rawBal?.toString() ?? "0",
      priceUsdg: snap.tokenPriceUsdg,
      usdgPerTokenRaw: snap.usdgPerTokenRaw.toString(),
      tokenDecimals: snap.tokenDecimals,
      activationDelaySec: snap.config.activationDelaySec,
      indexerCells: vaultStats?.cells,
      oracleLastTick: vaultStats?.oracle?.lastTick ?? null,
      oracleCardinality: vaultStats?.oracle?.cardinality,
    };
  }, [
    market,
    symbolQ.data,
    nameQ.data,
    decimalsQ.data,
    balanceQ.data,
    vaultStats?.vaultTvl,
    vaultStats?.lockedTvl,
    vaultStats?.cells,
    vaultStats?.oracle?.lastTick,
    vaultStats?.oracle?.cardinality,
    volQ.data,
    marketQ.data,
  ]);

  return { token, isLoading, refetch };
}
