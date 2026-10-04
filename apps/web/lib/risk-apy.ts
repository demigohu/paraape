import { type Address, type PublicClient } from "viem";
import { cellKey, durationSeconds, severityBps } from "@/lib/grid";
import { insuranceVaultAbi, priceObserverAbi, riskEngineAbi } from "@/lib/abi";

export async function estimateLpApyBps(
  client: PublicClient,
  vault: Address,
  severityIdx: number,
): Promise<{ apyBps: bigint; sigma1e18: bigint; utilization1e18: bigint }> {
  const key = cellKey(severityIdx);
  // LP cells are not sliced by duration. Quote the engine on a 7-day horizon.
  const horizonSec = durationSeconds(2);
  const [riskEngineAddr, cell] = await Promise.all([
    client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "riskEngine",
    }),
    client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "cells",
      args: [key],
    }),
  ]);

  const [poolRef, observerAddr] = await Promise.all([
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "poolRef" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "observer" }),
  ]);
  const payload = await client.readContract({
    address: observerAddr,
    abi: priceObserverAbi,
    functionName: "exportTickPayload",
    args: [poolRef],
  });
  const sigma1e18 = await client.readContract({
    address: riskEngineAddr,
    abi: riskEngineAbi,
    functionName: "realizedVol",
    args: [payload],
  });
  const util =
    cell[0] === 0n ? 0n : (cell[1] * 10n ** 18n) / cell[0];

  const apyBps = await client.readContract({
    address: riskEngineAddr,
    abi: riskEngineAbi,
    functionName: "estimateApy",
    args: [severityBps(severityIdx), horizonSec, util, sigma1e18],
  });

  return { apyBps, sigma1e18, utilization1e18: util };
}
