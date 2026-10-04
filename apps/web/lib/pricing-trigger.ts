import { severityBps } from "@/lib/grid";
import { getSqrtPriceX96AtTick, mulDiv } from "@/lib/tick-math";

const Q192 = 2n ** 192n;

/** Mirrors `Pricing.quotePerTokenWad` + `meetsSeverityDrop` (spot tick prefilter). */
export function meetsSeverityDropSpot(
  tickStart: number,
  tickEnd: number,
  severityIdx: number,
  tokenIsCurrency0: boolean,
): boolean {
  const sev = severityBps(severityIdx);
  const p0 = quotePerTokenWad(tickStart, tokenIsCurrency0);
  const p1 = quotePerTokenWad(tickEnd, tokenIsCurrency0);
  if (p0 === 0n) return false;
  const threshold = (p0 * BigInt(10_000 - sev)) / 10_000n;
  return p1 <= threshold;
}

function quotePerTokenWad(tick: number, tokenIsCurrency0: boolean): bigint {
  const sqrtP = getSqrtPriceX96AtTick(tick);
  const p2 = sqrtP * sqrtP;
  if (tokenIsCurrency0) {
    return mulDiv(1n * 10n ** 18n, p2, Q192);
  }
  return mulDiv(1n * 10n ** 18n, Q192, p2);
}
