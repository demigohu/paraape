"use client";

import { useCallback, useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, insuranceVaultAbi } from "@/lib/abi";
import { USDG_ADDRESS } from "@/lib/env";
import type { TxRef } from "@/lib/tx";

export function usePolicyActions(vault: Address | undefined) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const approve = useWriteContract();
  const [hash, setHash] = useState<Hash | undefined>();
  const [txs, setTxs] = useState<TxRef[]>([]);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const run = useCallback(
    async (fn: "challenge" | "release" | "expirePolicy", policyId: bigint) => {
      if (!vault || !publicClient) throw new Error("Vault not ready");
      const sent: TxRef[] = [];
      if (fn === "challenge" && address && USDG_ADDRESS !== "0x") {
        const cfg = await publicClient.readContract({
          address: vault,
          abi: insuranceVaultAbi,
          functionName: "config",
        });
        const fee = cfg[13];
        if (fee > 0n) {
          const allowance = await publicClient.readContract({
            address: USDG_ADDRESS,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, vault],
          });
          if (allowance < fee) {
            const approveHash = await approve.writeContractAsync({
              address: USDG_ADDRESS,
              abi: erc20Abi,
              functionName: "approve",
              args: [vault, fee],
            });
            sent.push({ label: "Approve USDG", hash: approveHash });
            setTxs(sent);
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }
      }
      const label = fn === "expirePolicy" ? "Close policy" : fn === "release" ? "Payout" : "Challenge";
      const txHash = await write.writeContractAsync({
        address: vault,
        abi: insuranceVaultAbi,
        functionName: fn,
        args: [policyId],
      });
      sent.push({ label, hash: txHash });
      setTxs(sent);
      setHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    },
    [vault, publicClient, write, approve, address],
  );

  const settle = useCallback(
    async (policyId: bigint) => {
      if (!vault || !publicClient) throw new Error("Vault not ready");
      const txHash = await write.writeContractAsync({
        address: vault,
        abi: insuranceVaultAbi,
        functionName: "settle",
        args: [policyId],
      });
      setTxs([{ label: "Settle", hash: txHash }]);
      setHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    },
    [vault, publicClient, write],
  );

  return {
    challenge: (policyId: bigint) => run("challenge", policyId),
    release: (policyId: bigint) => run("release", policyId),
    expire: (policyId: bigint) => run("expirePolicy", policyId),
    settle,
    hash,
    txs,
    isPending: write.isPending || approve.isPending,
    isConfirming,
    isSuccess,
    error: (write.error ?? approve.error) as Error | null,
  };
}
