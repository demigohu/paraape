import { formatUnits, type Address, type PublicClient } from "viem";
import { insuranceVaultAbi, priceSourceAbi } from "@/lib/abi";
import { SEVERITY_COUNT, severityBps } from "@/lib/grid";
import { depthFullRangeQuote, mulDiv } from "@/lib/tick-math";
import { usdgHumanFromRaw, usdgPerTokenRawAtTick } from "@/lib/token-price";
import { USDG_DECIMALS } from "@/hooks/use-market-token";

const TWAP_SECONDS = 5 * 60;
const WAD = 10n ** 18n;

export type VaultConfigView = {
  payoutCapAlphaBps: number;
  holderConcentrationBps: number;
  activationDelaySec: number;
  minDepthUsdg: bigint;
  minPremiumUsdg: bigint;
  minPremiumBps: bigint;
  maxPremiumBps: bigint;
};

export type VaultMarketSnapshot = {
  config: VaultConfigView;
  /** Full locked quote reserve in USDG (matches MarketFactory min-depth check). */
  poolDepthUsdg: number;
  poolDepthUsdgRaw: bigint;
  minDepthUsdg: number;
  minDepthUsdgRaw: bigint;
  tokenPriceUsdg: number;
  usdgPerTokenRaw: bigint;
  lockedQuoteDepth: bigint;
  quoteIsUsdg: boolean;
  tokenDecimals: number;
};

function quoteAmountToUsdg(quoteAmount: bigint, quoteIsUsdg: boolean, rate1e18: bigint): bigint {
  if (quoteIsUsdg) return quoteAmount;
  return mulDiv(quoteAmount, rate1e18, WAD);
}

export async function fetchVaultMarketSnapshot(
  client: PublicClient,
  vault: Address,
): Promise<VaultMarketSnapshot> {
  const [
    rawConfig,
    priceSourceAddr,
    poolRef,
    quoteToUsdgPoolRef,
    lockedQuoteDepth,
    tokenIsCurrency0,
    quoteIsUsdg,
    tokenDecimals,
  ] = await Promise.all([
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "config" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "priceSource" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "poolRef" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "quoteToUsdgPoolRef" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "lockedQuoteDepth" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "tokenIsCurrency0" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "quoteIsUsdg" }),
    client.readContract({ address: vault, abi: insuranceVaultAbi, functionName: "tokenDecimals" }),
  ]);

  const config: VaultConfigView = {
    payoutCapAlphaBps: rawConfig[0],
    holderConcentrationBps: rawConfig[1],
    activationDelaySec: rawConfig[3],
    minDepthUsdg: rawConfig[9],
    minPremiumUsdg: rawConfig[10],
    minPremiumBps: BigInt(rawConfig[11] as number),
    maxPremiumBps: rawConfig[12],
  };

  const tick = await client.readContract({
    address: priceSourceAddr,
    abi: priceSourceAbi,
    functionName: "consultTwapTick",
    args: [poolRef, TWAP_SECONDS],
  });

  let rate1e18 = WAD;
  if (!quoteIsUsdg && quoteToUsdgPoolRef !== `0x${"0".repeat(64)}`) {
    rate1e18 = await client.readContract({
      address: priceSourceAddr,
      abi: priceSourceAbi,
      functionName: "quoteToUsdg",
      args: [quoteToUsdgPoolRef],
    });
  }

  const usdgPerTokenRaw = usdgPerTokenRawAtTick(
    tick,
    tokenIsCurrency0,
    Number(tokenDecimals),
    quoteIsUsdg,
    rate1e18,
  );
  const tokenPriceUsdg = usdgHumanFromRaw(usdgPerTokenRaw);

  const poolDepthUsdgRaw = quoteAmountToUsdg(lockedQuoteDepth, quoteIsUsdg, rate1e18);
  const poolDepthUsdg = Number(formatUnits(poolDepthUsdgRaw, USDG_DECIMALS));
  const minDepthUsdgRaw = config.minDepthUsdg;
  const minDepthUsdg = Number(formatUnits(minDepthUsdgRaw, USDG_DECIMALS));

  return {
    config,
    poolDepthUsdg,
    poolDepthUsdgRaw,
    minDepthUsdg,
    minDepthUsdgRaw,
    tokenPriceUsdg,
    usdgPerTokenRaw,
    lockedQuoteDepth,
    quoteIsUsdg,
    tokenDecimals: Number(tokenDecimals),
  };
}

/** Tightest depth-cap headroom for buckets at/above policy severity. */
export async function fetchDepthCapHeadroomUsdg(
  client: PublicClient,
  vault: Address,
  policySeverityIdx: number,
  snapshot: VaultMarketSnapshot,
): Promise<number> {
  const { lockedQuoteDepth, quoteIsUsdg, config } = snapshot;
  let rate1e18 = WAD;
  if (!quoteIsUsdg) {
    const priceSourceAddr = await client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "priceSource",
    });
    const quoteToUsdgPoolRef = await client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "quoteToUsdgPoolRef",
    });
    if (quoteToUsdgPoolRef !== `0x${"0".repeat(64)}`) {
      rate1e18 = await client.readContract({
        address: priceSourceAddr,
        abi: priceSourceAbi,
        functionName: "quoteToUsdg",
        args: [quoteToUsdgPoolRef],
      });
    }
  }

  let minHeadroom = Infinity;
  for (let s = policySeverityIdx; s < SEVERITY_COUNT; s++) {
    const depthQuote = depthFullRangeQuote(lockedQuoteDepth, severityBps(s));
    const depthUsdgRaw = quoteAmountToUsdg(depthQuote, quoteIsUsdg, rate1e18);
    const depthUsdg = Number(formatUnits(depthUsdgRaw, USDG_DECIMALS));
    const cap = (depthUsdg * config.payoutCapAlphaBps) / 10_000;
    const active = await client.readContract({
      address: vault,
      abi: insuranceVaultAbi,
      functionName: "coverageBySeverityFloor",
      args: [s],
    });
    const activeNum = Number(formatUnits(active, USDG_DECIMALS));
    minHeadroom = Math.min(minHeadroom, Math.max(0, cap - activeNum));
  }
  return minHeadroom === Infinity ? 0 : Math.floor(minHeadroom);
}
