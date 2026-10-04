import { encodePacked, keccak256 } from "viem";

/** Mirrors `GridLib.sol` on-chain grid indices. */

export function cellKey(severityIdx: number): `0x${string}` {
  return keccak256(encodePacked(["uint8"], [severityIdx]));
}

export const SEVERITY_BPS = [5000, 6000, 7000, 8000, 9000, 9500] as const;

export const WINDOW_MINUTES = [5, 15, 30, 60, 240, 720, 1440, 4320, 10080, 43200] as const;

export const DURATION_DAYS = [1, 3, 7, 14, 30] as const;

export const SEVERITY_COUNT = 6;
export const WINDOW_COUNT = 10;

const WINDOW_SECONDS = [
  5 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  4 * 60 * 60,
  12 * 60 * 60,
  24 * 60 * 60,
  3 * 24 * 60 * 60,
  7 * 24 * 60 * 60,
  30 * 24 * 60 * 60,
] as const;

const DURATION_SECONDS = [
  24 * 60 * 60,
  3 * 24 * 60 * 60,
  7 * 24 * 60 * 60,
  14 * 24 * 60 * 60,
  30 * 24 * 60 * 60,
] as const;

export function severityBps(severityIdx: number): number {
  return SEVERITY_BPS[severityIdx] ?? SEVERITY_BPS[0]!;
}

export function windowSeconds(windowIdx: number): number {
  return WINDOW_SECONDS[windowIdx] ?? WINDOW_SECONDS[0]!;
}

export function durationSeconds(durationIdx: number): number {
  return DURATION_SECONDS[durationIdx] ?? DURATION_SECONDS[2]!;
}

/** A milder cell can back a deeper policy. Mirrors `GridLib.cellBacksPolicy`. */
export function cellBacksPolicy(cellSeverityIdx: number, policySeverityIdx: number): boolean {
  return policySeverityIdx >= cellSeverityIdx;
}

export function severityPct(severityIdx: number): number {
  return (SEVERITY_BPS[severityIdx] ?? 0) / 100;
}

export function windowMinutes(windowIdx: number): number {
  return WINDOW_MINUTES[windowIdx] ?? 5;
}

/** Human label for on-chain window index (PRD grid). */
export function formatWindowLabel(windowIdx: number): string {
  const min = WINDOW_MINUTES[windowIdx];
  if (min == null) return "—";
  if (min < 60) return `${min} minutes`;
  if (min < 1440) {
    const hr = min / 60;
    return hr === 1 ? "1 hour" : `${hr} hours`;
  }
  const days = min / 1440;
  return days === 1 ? "1 day" : `${days} days`;
}

/** Mirrors `GridLib.minSeverityIdx`. */
export function minSeverityIdx(windowIdx: number): number {
  const w = windowSeconds(windowIdx);
  if (w <= 60 * 60) return 0;
  if (w <= 24 * 60 * 60) return 2;
  return 4;
}

export function isValidPolicyTrigger(severityIdx: number, durationIdx: number): boolean {
  if (severityIdx < 0 || severityIdx >= SEVERITY_COUNT) return false;
  if (durationIdx < 0 || durationIdx >= DURATION_DAYS.length) return false;
  return true;
}

/** LP deposit / risk cell. */
export function lpCellError(severityIdx: number): string | null {
  if (severityIdx < 0 || severityIdx >= SEVERITY_COUNT) return "Invalid severity.";
  return null;
}

export function policyTriggerError(severityIdx: number, durationIdx: number): string | null {
  if (!isValidPolicyTrigger(severityIdx, durationIdx)) return "Invalid trigger for this market grid.";
  return null;
}

/** Default vault `activationDelay` (PRD) — show in UI until we read `config` on-chain. */
export const POLICY_ACTIVATION_DELAY_MINUTES = 30;

export const SEVERITY_OPTIONS = SEVERITY_BPS.map((bps, severityIdx) => ({
  severityIdx,
  pct: bps / 100,
  label: `${bps / 100}% price drop`,
}));

export const WINDOW_OPTIONS = Array.from({ length: WINDOW_COUNT }, (_, windowIdx) => ({
  windowIdx,
  label: formatWindowLabel(windowIdx),
  minutes: windowMinutes(windowIdx),
}));

export function durationDays(durationIdx: number): number {
  return DURATION_DAYS[durationIdx] ?? 7;
}

export function durationIdxFromDays(days: number): number {
  const i = DURATION_DAYS.indexOf(days as (typeof DURATION_DAYS)[number]);
  return i >= 0 ? i : 2;
}

/** Snap UI day count to allowed policy durations (on-chain: 1/3/7/14/30 only). */
export function nearestDurationDays(days: number): (typeof DURATION_DAYS)[number] {
  let best: (typeof DURATION_DAYS)[number] = DURATION_DAYS[0]!;
  let bestDist = Infinity;
  for (const d of DURATION_DAYS) {
    const dist = Math.abs(d - days);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

export const DURATION_PRESETS = [
  { id: "1d", days: 1 as const, label: "1 day" },
  { id: "3d", days: 3 as const, label: "3 days" },
  { id: "7d", days: 7 as const, label: "1 week" },
  { id: "14d", days: 14 as const, label: "2 weeks" },
  { id: "30d", days: 30 as const, label: "30 days" },
] as const;

/** Map UI severity slider (50–95) to on-chain index. */
export function severityIdxFromPct(pct: number): number {
  const idx = Math.round((pct - 50) / 10);
  return Math.min(SEVERITY_BPS.length - 1, Math.max(0, idx));
}

/** Map UI window minutes to nearest on-chain window index. */
export function windowIdxFromMinutes(minutes: number): number {
  return nearestWindowIdxFromMinutes(minutes);
}

/** Snap UI minutes to closest PRD grid window. */
export function nearestWindowIdxFromMinutes(minutes: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < WINDOW_COUNT; i++) {
    const m = WINDOW_MINUTES[i]!;
    const dist = Math.abs(m - minutes);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Severity tiers. Duration is chosen separately and does not slice LP cells. */
export const TRIGGER_PLANS = [
  {
    id: "broad",
    name: "Broad",
    severityIdx: 2,
    severity: 70,
  },
  {
    id: "standard",
    name: "Standard",
    severityIdx: 3,
    severity: 80,
  },
  {
    id: "deep",
    name: "Deep",
    severityIdx: 4,
    severity: 90,
  },
] as const;

export type TriggerPlanId = (typeof TRIGGER_PLANS)[number]["id"];
