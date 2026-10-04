const SECONDS_PER_YEAR = 365.25 * 86_400;
const YEAR_SQRT = Math.sqrt(SECONDS_PER_YEAR);

/** Risk engine σ: per-second log-vol (human fraction = sigma1e18 / 1e18). */
export function annualizedVolPct(sigmaFraction: number): number {
  if (!Number.isFinite(sigmaFraction) || sigmaFraction <= 0) return 0;
  return sigmaFraction * YEAR_SQRT * 100;
}

/**
 * Display helper — annualized implied vol from recent pool TWAP samples.
 * Thin pools + big swaps can spike this (not a spot “5618% daily return”).
 */
export function formatRealizedVolAnnualized(sigmaFraction: number): string {
  const pct = annualizedVolPct(sigmaFraction);
  if (pct <= 0) return "—";
  if (pct >= 500) return "≥500% ann. (elevated)";
  if (pct < 0.1) return `${pct.toFixed(2)}% ann.`;
  if (pct < 10) return `${pct.toFixed(1)}% ann.`;
  return `${Math.round(pct)}% ann.`;
}
