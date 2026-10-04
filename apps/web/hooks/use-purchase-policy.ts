"use client";

import { useCallback, useState } from "react";
import { parseUnits, type Address, type Hash } from "viem";
import { usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, insuranceVaultAbi } from "@/lib/abi";
import { USDG_ADDRESS } from "@/lib/env";
import { USDG_DECIMALS } from "@/hooks/use-market-token";
import type { TxRef } from "@/lib/tx";

type PurchaseHook = {
  buy: (params: {
    severityIdx: number;
    durationIdx: number;
    coverageUsdg: number;
    premiumEstimate: number;
    premiumUsdg?: bigint;
    owner: Address;
  }) => Promise<void>;
  hash: Hash | undefined;
  txs: TxRef[];
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
};

export function usePurchasePolicy(vault: Address | undefined): PurchaseHook {
  const publicClient = usePublicClient();
  const approve = useWriteContract();
  const purchase = useWriteContract();
  const [hash, setHash] = useState<Hash | undefined>();
  const [txs, setTxs] = useState<TxRef[]>([]);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buy = useCallback(
    async (params: {
      severityIdx: number;
      durationIdx: number;
      coverageUsdg: number;
      premiumEstimate: number;
      premiumUsdg?: bigint;
      owner: Address;
    }) => {
      if (!vault || !publicClient) {
        throw new Error("Wallet or vault not ready");
      }
      if (USDG_ADDRESS === "0x") {
        throw new Error("Set NEXT_PUBLIC_USDG_ADDRESS in apps/web/.env.local");
      }

      setTxs([]);
      const coverage = parseUnits(String(params.coverageUsdg), USDG_DECIMALS);
      const minCoverage = (coverage * 95n) / 100n;
      const premiumNeeded =
        params.premiumUsdg && params.premiumUsdg > 0n
          ? params.premiumUsdg
          : parseUnits(String(Math.max(params.premiumEstimate, 0.01)), USDG_DECIMALS);

      const currentAllowance = await publicClient.readContract({
        address: USDG_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [params.owner, vault],
      });

      if (currentAllowance < premiumNeeded) {
        const approveHash = await approve.writeContractAsync({
          address: USDG_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, premiumNeeded],
        });
        setTxs((prev) => [...prev, { label: "Approve USDG", hash: approveHash }]);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const txHash = await purchase.writeContractAsync({
        address: vault,
        abi: insuranceVaultAbi,
        functionName: "purchasePolicy",
        args: [params.severityIdx, params.durationIdx, coverage, minCoverage],
      });
      setTxs((prev) => [...prev, { label: "Buy policy", hash: txHash }]);
      setHash(txHash);
    },
    [vault, publicClient, approve, purchase],
  );

  return {
    buy,
    hash,
    txs,
    isPending: approve.isPending || purchase.isPending,
    isConfirming,
    isSuccess,
    error: (approve.error ?? purchase.error) as Error | null,
  };
}
