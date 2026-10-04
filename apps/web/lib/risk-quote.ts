import { type Address, type PublicClient, parseUnits } from "viem";
import { insuranceVaultAbi, priceObserverAbi, riskEngineAbi } from "@/lib/abi";
import {
  SEVERITY_COUNT,
  cellBacksPolicy,
  cellKey,
  durationSeconds,
  severityBps,
} from "@/lib/grid";

export const USDG_DECIMALS = 6;

export type QuotePremiumInput = {
  severityIdx: number;
  durationIdx: number;
  /** Human USDG amount (6 decimals). */
  coverageUsdg: number;
};

/** Mirrors vault `_fillPolicy` + `_boundPremium` for UI estimates. */
export async function quotePolicyPremium(
  client: PublicClient,
  vault: Address,
  input: QuotePremiumInput,
): Promise<{ premiumUsdg: bigint; filledUsdg: bigint; sigma1e18: bigint }> {
  const coverageUsdg = parseUnits(String(input.coverageUsdg), USDG_DECIMALS);
  if (coverageUsdg <= 0n) {
    return { premiumUsdg: 0n, filledUsdg: 0n, sigma1e18: 0n };
  }

  const [poolRef, riskEngineAddr, observerAddr, vaultConfig] = await Promise.all([
    client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "poolRef",
    }),
    client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "riskEngine",
    }),
    client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "observer",
    }),
    client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "config",
    }),
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

  const policySeverityBps = severityBps(input.severityIdx);
  const policyDurationSec = durationSeconds(input.durationIdx);

  const cellReads: Array<{ sev: number; key: `0x${string}` }> = [];
  for (let s = SEVERITY_COUNT; s > 0; s--) {
    const sev = s - 1;
    if (!cellBacksPolicy(sev, input.severityIdx)) continue;
    cellReads.push({ sev, key: cellKey(sev) });
  }

  // Robinhood testnet has no Multicall3 in viem chain metadata — read cells in parallel.
  const cellResults = await Promise.all(
    cellReads.map(async ({ key }) => {
      try {
        const result = await client.readContract({
          address: vault,
          abi: insuranceVaultAbi,
          functionName: "cells",
          args: [key],
        });
        return { ok: true as const, result };
      } catch {
        return { ok: false as const };
      }
    }),
  );

  let remaining = coverageUsdg;
  let premium = 0n;
  let filled = 0n;

  for (let i = 0; i < cellReads.length && remaining > 0n; i++) {
    const cellRes = cellResults[i];
    if (!cellRes?.ok) continue;
    const [totalAssets, lockedAssets] = cellRes.result;
    const free = totalAssets - lockedAssets;
    if (free <= 0n) continue;

    const take = remaining < free ? remaining : free;
    const util =
      totalAssets === 0n ? 0n : (lockedAssets * 10n ** 18n) / totalAssets;

    const slicePremium = await client.readContract({
      address: riskEngineAddr,
      abi: riskEngineAbi,
      functionName: "quotePremium",
      args: [
        poolRef,
        sigma1e18,
        policySeverityBps,
        policyDurationSec,
        policyDurationSec,
        take,
        util,
      ],
    });

    premium += slicePremium;
    filled += take;
    remaining -= take;
  }

  if (filled === 0n) {
    return { premiumUsdg: 0n, filledUsdg: 0n, sigma1e18 };
  }

  // viem decodes uint16 as number; the rest of this math is bigint.
  const minPremiumUsdg = BigInt(vaultConfig[10]);
  const minPremiumBps = BigInt(vaultConfig[11]);
  const maxPremiumBps = BigInt(vaultConfig[12]);
  let bounded = premium;
  const maxPrem = (filled * maxPremiumBps) / 10_000n;
  const minFromBps = (filled * minPremiumBps) / 10_000n;
  const minPrem = minPremiumUsdg > minFromBps ? minPremiumUsdg : minFromBps;
  if (bounded < minPrem) bounded = minPrem;
  if (bounded > maxPrem) bounded = maxPrem;

  return { premiumUsdg: bounded, filledUsdg: filled, sigma1e18 };
}

/** Read-only realized vol for display (fraction, e.g. 0.07). */
export async function fetchRealizedVol(
  client: PublicClient,
  vault: Address,
): Promise<number | null> {
  try {
    const [poolRef, riskEngineAddr, observerAddr] = await Promise.all([
      client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "poolRef" }),
      client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "riskEngine" }),
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
    return Number(sigma1e18) / 1e18;
  } catch {
    return null;
  }
}
