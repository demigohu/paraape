"use client";

import { formatUnits, getAddress, hexToBigInt, isAddress, type Address, type PublicClient } from "viem";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { lockerAbi, marketFactoryAbi, poolManagerAbi } from "@/lib/abi";
import {
  FACTORY_ADDRESS,
  LOCKER_ADDRESS,
  POOL_MANAGER_ADDRESS,
  USDG_ADDRESS,
} from "@/lib/env";
import { poolRefFromKey, poolStateSlot, usdgPoolKey, type UsdPoolKey } from "@/lib/pool-key";
import { USDG_DECIMALS } from "@/hooks/use-market-token";

const ZERO = "0x0000000000000000000000000000000000000000";

export type UnlistedPool =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error" }
  | { status: "no-pair" }
  | { status: "unlocked" }
  | { status: "thin"; depthUsdg: number; minDepthUsdg: number }
  | { status: "has-vault"; vault: Address }
  | {
      status: "ready";
      poolKey: UsdPoolKey;
      depthUsdg: number;
      minDepthUsdg: number;
    };

async function inspectPool(client: PublicClient, token: Address): Promise<UnlistedPool> {
  if (
    FACTORY_ADDRESS === "0x" ||
    LOCKER_ADDRESS === "0x" ||
    POOL_MANAGER_ADDRESS === "0x" ||
    USDG_ADDRESS === "0x"
  ) {
    return { status: "unconfigured" };
  }

  const existing = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: marketFactoryAbi,
    functionName: "vaultByToken",
    args: [token],
  });
  if (existing !== ZERO) return { status: "has-vault", vault: existing };

  const poolKey = usdgPoolKey(token, USDG_ADDRESS);
  const poolRef = poolRefFromKey(poolKey);
  const slot = poolStateSlot(poolRef);
  const packed = await client.readContract({
    address: POOL_MANAGER_ADDRESS,
    abi: poolManagerAbi,
    functionName: "extsload",
    args: [slot],
  });
  const sqrtPrice = hexToBigInt(packed) & ((1n << 160n) - 1n);
  if (sqrtPrice === 0n) return { status: "no-pair" };

  const [locked, depthRaw, config] = await Promise.all([
    client.readContract({
      address: LOCKER_ADDRESS,
      abi: lockerAbi,
      functionName: "isLiquidityLocked",
      args: [poolRef],
    }),
    client.readContract({
      address: LOCKER_ADDRESS,
      abi: lockerAbi,
      functionName: "lockedQuoteDepth",
      args: [poolRef],
    }),
    client.readContract({
      address: FACTORY_ADDRESS,
      abi: marketFactoryAbi,
      functionName: "config",
    }),
  ]);

  const minDepthRaw = config[9];
  const depthUsdg = Number(formatUnits(depthRaw, USDG_DECIMALS));
  const minDepthUsdg = Number(formatUnits(minDepthRaw, USDG_DECIMALS));
  if (!locked) return { status: "unlocked" };
  if (depthRaw < minDepthRaw) return { status: "thin", depthUsdg, minDepthUsdg };
  return { status: "ready", poolKey, depthUsdg, minDepthUsdg };
}

export function useUnlistedPool(raw: string | undefined, enabled: boolean): UnlistedPool {
  const client = usePublicClient();
  const token = raw && isAddress(raw) ? getAddress(raw) : undefined;

  const query = useQuery({
    queryKey: ["unlisted-pool", token],
    queryFn: () => inspectPool(client!, token!),
    enabled: enabled && !!client && !!token,
    staleTime: 15_000,
  });

  if (!enabled || !token) return { status: "idle" };
  if (query.isError) return { status: "error" };
  if (!client || query.isLoading || !query.data) return { status: "loading" };
  return query.data;
}
