"use client";

import { useCallback, useState } from "react";
import { parseUnits, type Address, type Hash } from "viem";
import { usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, insuranceVaultAbi, marketFactoryAbi } from "@/lib/abi";
import { FACTORY_ADDRESS, LOCKER_ADDRESS, USDG_ADDRESS } from "@/lib/env";
import type { UsdPoolKey } from "@/lib/pool-key";
import { USDG_DECIMALS } from "@/hooks/use-market-token";
import type { TxRef } from "@/lib/tx";

type DepositHook = {
  submit: (params: {
    severityIdx: number;
    amountUsdg: number;
    owner: Address;
    /** Vault already deployed. Omit when `open` should create it first. */
    vault?: Address;
    open?: { token: Address; poolKey: UsdPoolKey };
  }) => Promise<void>;
  hash: Hash | undefined;
  txs: TxRef[];
  phase: "create" | "approve" | "deposit" | null;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
};

export function useDepositLp(vault: Address | undefined): DepositHook {
  const publicClient = usePublicClient();
  const openMarket = useWriteContract();
  const approve = useWriteContract();
  const deposit = useWriteContract();
  const [hash, setHash] = useState<Hash | undefined>();
  const [txs, setTxs] = useState<TxRef[]>([]);
  const [phase, setPhase] = useState<"create" | "approve" | "deposit" | null>(null);

  const note = (label: string, txHash: Hash) => {
    setTxs((prev) => [...prev, { label, hash: txHash }]);
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = useCallback(
    async (params: {
      severityIdx: number;
      amountUsdg: number;
      owner: Address;
      vault?: Address;
      open?: { token: Address; poolKey: UsdPoolKey };
    }) => {
      if (!publicClient) throw new Error("Wallet or vault not ready");
      if (USDG_ADDRESS === "0x") throw new Error("Set NEXT_PUBLIC_USDG_ADDRESS");

      let target = params.vault ?? vault;
      const assets = parseUnits(String(params.amountUsdg), USDG_DECIMALS);
      setTxs([]);

      try {
        if (!target && params.open) {
          if (FACTORY_ADDRESS === "0x" || LOCKER_ADDRESS === "0x") {
            throw new Error("Set NEXT_PUBLIC_FACTORY_ADDRESS and NEXT_PUBLIC_LOCKER_ADDRESS");
          }
          setPhase("create");
          const createHash = await openMarket.writeContractAsync({
            address: FACTORY_ADDRESS,
            abi: marketFactoryAbi,
            functionName: "createMarket",
            args: [
              params.open.poolKey,
              params.open.token,
              LOCKER_ADDRESS,
              "0x0000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000",
            ],
          });
          note("Open market", createHash);
          await publicClient.waitForTransactionReceipt({ hash: createHash });
          target = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: marketFactoryAbi,
            functionName: "vaultByToken",
            args: [params.open.token],
          });
        }

        if (!target || target === "0x0000000000000000000000000000000000000000") {
          throw new Error("Vault not ready");
        }

        const allowance = await publicClient.readContract({
          address: USDG_ADDRESS,
          abi: erc20Abi,
          functionName: "allowance",
          args: [params.owner, target],
        });

        if (allowance < assets) {
          setPhase("approve");
          const approveHash = await approve.writeContractAsync({
            address: USDG_ADDRESS,
            abi: erc20Abi,
            functionName: "approve",
            args: [target, assets],
          });
          note("Approve USDG", approveHash);
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        setPhase("deposit");
        const txHash = await deposit.writeContractAsync({
          address: target,
          abi: insuranceVaultAbi,
          functionName: "deposit",
          args: [params.severityIdx, assets],
        });
        note("Deposit", txHash);
        setHash(txHash);
      } finally {
        setPhase(null);
      }
    },
    [vault, publicClient, openMarket, approve, deposit],
  );

  return {
    submit,
    hash,
    txs,
    phase,
    isPending: phase != null || openMarket.isPending || approve.isPending || deposit.isPending,
    isConfirming,
    isSuccess,
    error: (openMarket.error ?? approve.error ?? deposit.error) as Error | null,
  };
}
