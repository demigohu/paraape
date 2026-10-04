"use client";

import { useCallback, useState } from "react";
import type { Address, Hash } from "viem";
import { usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { insuranceVaultAbi } from "@/lib/abi";
import type { TxRef } from "@/lib/tx";

export function useWithdrawLp(vault: Address | undefined) {
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const [hash, setHash] = useState<Hash | undefined>();
  const [txs, setTxs] = useState<TxRef[]>([]);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdraw = useCallback(
    async (params: { severityIdx: number; shares: bigint }) => {
      if (!vault || !publicClient) throw new Error("Wallet or vault not ready");
      const txHash = await write.writeContractAsync({
        address: vault,
        abi: insuranceVaultAbi,
        functionName: "withdraw",
        args: [params.severityIdx, params.shares],
      });
      setTxs([{ label: "Withdraw", hash: txHash }]);
      setHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    },
    [vault, publicClient, write],
  );

  return {
    withdraw,
    hash,
    txs,
    isPending: write.isPending,
    isConfirming,
    isSuccess,
    error: write.error as Error | null,
  };
}
