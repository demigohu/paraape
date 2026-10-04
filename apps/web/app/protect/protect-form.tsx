"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle, Parachute } from "@phosphor-icons/react";
import { AsideStat, AsideStatList, CheckoutAside } from "@/components/app/checkout-aside";
import { TxLinks } from "@/components/app/tx-links";
import { useToast } from "@/components/app/toaster";
import { AnimatedNumber, InfoPopover, Notice, Section } from "@/components/app/ui";
import { TriggerPicker } from "@/components/app/trigger-picker";
import { TokenLookup, type LookupResult } from "@/components/app/token-lookup";
import { useWallet } from "@/components/wallet";
import { useCoverageLimits } from "@/hooks/use-coverage-limits";
import { usePurchasePolicy } from "@/hooks/use-purchase-policy";
import { useQuotePremium } from "@/hooks/use-quote-premium";
import { useVaultMarket } from "@/hooks/use-vault-market";
import {
  DURATION_DAYS,
  durationIdxFromDays,
  policyTriggerError,
  severityIdxFromPct,
  severityPct,
  TRIGGER_PLANS,
  type TriggerPlanId,
} from "@/lib/grid";
import {
  marketMeetsDepthFloor,
  num,
  usd,
  vaultLpCapacityUsdg,
  type Token,
} from "@/lib/protocol";
import { useAccount, useChainId } from "wagmi";
import { robinhoodTestnet } from "@/lib/chains";
import { walletValueUsdLabel } from "@/lib/wallet-value-label";

export function ProtectForm() {
  const params = useSearchParams();
  const [lookup, setLookup] = useState<LookupResult>({ status: "idle" });
  const handleLookup = useCallback((r: LookupResult) => setLookup(r), []);
  const token = lookup.status === "found" ? lookup.token : null;

  return (
    <div>
      <Section title="Token">
        <TokenLookup initial={params.get("token") ?? ""} onResult={handleLookup} />
      </Section>
      {lookup.status === "new-market" && (
        <div className="flex flex-col items-start gap-6 border border-dashed border-line-strong p-8 md:my-10 md:p-12">
          <Parachute size={40} aria-hidden className="text-signal" />
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl">No protection for this token yet</h2>
            <p className="max-w-[56ch] leading-relaxed text-fg-muted">
              Nobody has backed this token yet. A USDG deposit on Underwrite opens the market when the
              pair is locked.
            </p>
          </div>
          <Link href={`/underwrite?token=${lookup.address}`} className="btn btn-ghost">
            Underwrite this token
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </div>
      )}
      {token && <Eligibility key={token.symbol} token={token} />}
    </div>
  );
}

function Eligibility({ token }: { token: Token }) {
  const { address, connect, status } = useWallet();

  if (!marketMeetsDepthFloor(token)) {
    return (
      <div className="py-10">
        <Notice tone="danger">
          Pool depth for ${token.symbol} is {usd(token.poolDepthUsdg)}, under the {usd(token.minDepthUsdg)}{" "}
          floor. Thin pools are too easy to move, so this market cannot be covered.
        </Notice>
      </div>
    );
  }

  if (vaultLpCapacityUsdg(token) === 0) {
    return (
      <div className="flex flex-col items-start gap-6 border border-dashed border-line-strong p-8 md:my-10 md:p-12">
        <Parachute size={40} aria-hidden className="text-signal" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl">No cover for ${token.symbol} yet</h2>
          <p className="max-w-[56ch] leading-relaxed text-fg-muted">
            No one has deposited USDG for this token. A deposit on Underwrite opens capacity.
          </p>
        </div>
        <Link href={`/underwrite?token=${token.address}`} className="btn btn-ghost">
          Underwrite ${token.symbol}
          <ArrowRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="flex flex-col items-start gap-5 py-10">
        <Notice tone="info">
          Cover only applies to tokens you hold. Connect a wallet to read your ${token.symbol} balance.
        </Notice>
        <button
          type="button"
          onClick={connect}
          disabled={status === "connecting"}
          aria-busy={status === "connecting"}
          className="btn btn-inverse"
        >
          {status === "connecting" ? "Connecting" : "Connect wallet"}
        </button>
      </div>
    );
  }

  if (token.walletBalance === 0) {
    return (
      <div className="py-10">
        <Notice tone="danger">
          This wallet holds 0 ${token.symbol}. Cover only applies to tokens you hold.
        </Notice>
      </div>
    );
  }

  return <Quote token={token} />;
}

function Quote({ token }: { token: Token }) {
  const reduce = useReducedMotion();
  const coverageId = useId();
  const { address } = useAccount();
  const chainId = useChainId();
  const { buy, hash, txs, isPending, isConfirming, isSuccess, error } = usePurchasePolicy(token.vault);
  const { push } = useToast();
  const toasted = useRef<string | null>(null);
  const standardPlan = TRIGGER_PLANS.find((p) => p.id === "standard")!;
  const [activePreset, setActivePreset] = useState<TriggerPlanId | "custom">("standard");
  const [showTriggerSliders, setShowTriggerSliders] = useState(false);
  const [severity, setSeverity] = useState<number>(standardPlan.severity);
  const [days, setDays] = useState<(typeof DURATION_DAYS)[number]>(7);
  const [txError, setTxError] = useState<string | null>(null);

  const presetPlan =
    activePreset === "custom"
      ? null
      : (TRIGGER_PLANS.find((p) => p.id === activePreset) ?? standardPlan);
  const useSliderGrid = showTriggerSliders || activePreset === "custom";
  const severityIdx = useSliderGrid
    ? severityIdxFromPct(severity)
    : (presetPlan ?? standardPlan).severityIdx;
  const onChainSeverity = severityPct(severityIdx);
  const durationIdx = durationIdxFromDays(days);
  const triggerError = policyTriggerError(severityIdx, durationIdx);

  useEffect(() => {
    if (!isSuccess || !hash || toasted.current === hash) return;
    toasted.current = hash;
    push({ title: "Cover confirmed", tone: "ok" });
  }, [isSuccess, hash, push]);

  const txDone = isSuccess;
  const txBusy = isPending || isConfirming;
  const { snapshot } = useVaultMarket(token.vault);
  const limits = useCoverageLimits(token, severityIdx, onChainSeverity, snapshot);
  const maxCoverage = limits.maxCoverage;
  const activationDelayMin = Math.max(1, Math.round(token.activationDelaySec / 60));
  const [coverageInput, setCoverageInput] = useState("");
  const coverage = Number(coverageInput.replace(/,/g, ""));

  useEffect(() => {
    if (limits.isLoading || maxCoverage <= 0) return;
    setCoverageInput((prev) => {
      if (prev === "" || Number(prev.replace(/,/g, "")) > maxCoverage) {
        return String(maxCoverage);
      }
      return prev;
    });
  }, [limits.isLoading, maxCoverage, severityIdx]);

  const coverageError = limits.isLoading
    ? null
    : maxCoverage <= 0
      ? limits.fillableUsdg <= 0
        ? "No LP has funded a tier that can back this drop."
        : limits.holdingsCapUsdg <= 0
          ? `Your $${token.symbol} bag is too small to insure at −${onChainSeverity}%.`
          : "Pool depth caps this coverage at zero."
      : !Number.isFinite(coverage) || coverage <= 0
        ? "Enter a coverage amount."
        : coverage > maxCoverage
          ? `Max coverage is ${num(maxCoverage)} USDG.`
          : null;

  const quoteEnabled = !coverageError && !triggerError && !!token.vault;
  const quote = useQuotePremium(token.vault, {
    severityIdx,
    durationIdx,
    coverageUsdg: quoteEnabled ? coverage : 0,
    enabled: quoteEnabled,
  });

  const premium = coverageError || triggerError ? 0 : quote.premium;
  const premiumLoading = quote.isFetching && quoteEnabled;
  const premiumRatePct =
    coverage > 0 && premium > 0 ? (premium / coverage) * 100 : null;

  const expiry = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [days]);

  const matchPresetId = (sev: number): TriggerPlanId | "custom" => {
    const sevIdx = severityIdxFromPct(sev);
    const match = TRIGGER_PLANS.find((p) => p.severityIdx === sevIdx);
    return match?.id ?? "custom";
  };

  const applyPreset = (preset: (typeof TRIGGER_PLANS)[number]) => {
    setActivePreset(preset.id);
    setSeverity(preset.severity);
    setShowTriggerSliders(true);
  };

  const openCustom = () => {
    setActivePreset("custom");
    setShowTriggerSliders(true);
  };

  const handleSeverity = (v: number) => {
    setSeverity(v);
    setActivePreset(matchPresetId(v));
  };

  const applyDuration = (d: (typeof DURATION_DAYS)[number]) => {
    setDays(d);
  };

  const pay = async () => {
    if (coverageError || triggerError || txBusy || !address || !token.vault) return;
    if (chainId !== robinhoodTestnet.id) {
      setTxError("Switch wallet to Robinhood testnet (46630).");
      return;
    }
    setTxError(null);
    try {
      await buy({
        severityIdx,
        durationIdx,
        coverageUsdg: coverage,
        premiumEstimate: premium,
        premiumUsdg: quote.premiumUsdg,
        owner: address,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Transaction failed";
      setTxError(message);
      push({ title: "Could not buy cover", body: message.slice(0, 140), tone: "danger" });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
      <div>
        <Section
          title="Trigger"
          aside={
            <span className="text-sm text-fg-muted">
              {num(token.walletBalance)} ${token.symbol} ({walletValueUsdLabel(token)})
            </span>
          }
          info={
            <p>
              Pays if price is down this far from the price when cover starts, any time before expiry.
            </p>
          }
        >
          <TriggerPicker
            layoutId="protect-trigger-preset"
            reduce={reduce ?? false}
            activePreset={activePreset}
            showSliders={showTriggerSliders}
            severity={severity}
            onPreset={applyPreset}
            onCustom={openCustom}
            onSeverity={handleSeverity}
            snapNote={
              severity !== onChainSeverity
                ? `Snaps on-chain to −${onChainSeverity}% (from ${severity}%).`
                : null
            }
          />

          {triggerError && (
            <p className="text-sm text-danger" role="alert">
              {triggerError}
            </p>
          )}
        </Section>

        <Section
          title="Coverage"
          info={
            <>
              <p>
                Payout is the most you can receive if the drop is still there when someone settles.
                That amount stays locked until the policy ends.
              </p>
              <p className="mt-2">
                Term is 1, 3, 7, 14, or 30 days. Cover starts about {activationDelayMin} minutes after
                you pay.
              </p>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor={coverageId} className="label">
                  Payout (USDG)
                </label>
                <button
                  type="button"
                  onClick={() => setCoverageInput(String(maxCoverage))}
                  className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  Max {num(maxCoverage)}
                </button>
              </div>
              <input
                id={coverageId}
                inputMode="decimal"
                value={coverageInput}
                onChange={(e) => setCoverageInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                aria-invalid={!!coverageError}
                aria-describedby={`${coverageId}-msg`}
                className="field text-lg"
              />
              <p id={`${coverageId}-msg`} className="min-h-5 text-sm text-danger" aria-live="polite">
                {coverageError}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span id="duration-label" className="label">
                Coverage period
              </span>
              <div
                role="radiogroup"
                aria-labelledby="duration-label"
                className="grid h-12 grid-cols-5 border border-line-strong"
              >
                {DURATION_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={d === days}
                    onClick={() => applyDuration(d)}
                    className="relative text-sm"
                  >
                    {d === days && (
                      <motion.span
                        layoutId="protect-duration"
                        className="absolute inset-0 bg-fg"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
                      />
                    )}
                    <span className={`relative ${d === days ? "text-surface" : "text-fg-muted"}`}>
                      {d}d
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-fg-muted">Until {expiry}</p>
            </div>
          </div>
        </Section>
      </div>

      <CheckoutAside>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">Premium</span>
              <span className="text-4xl leading-none tracking-tight">
                {premiumLoading ? (
                  <span className="text-on-inverse-muted">Quoting…</span>
                ) : (
                  <>
                    <AnimatedNumber value={premium} format={(n) => `${n.toFixed(2)}`} />
                    <span className="ml-2 text-lg">USDG</span>
                  </>
                )}
              </span>
            </div>
            <InfoPopover align="end" placement="above" label="Premium vs payout">
              <p>What you pay now. A deeper drop costs less because it pays less often.</p>
              <p className="mt-2">
                Cover starts about {activationDelayMin} minutes after you pay. Settle pays only if you
                still hold the tokens and the drop is still there.
              </p>
            </InfoPopover>
          </div>
          {premiumRatePct != null && coverage > 0 && !coverageError && (
            <p className="text-sm text-on-inverse-muted">
              {premiumRatePct < 0.01 ? premiumRatePct.toFixed(3) : premiumRatePct.toFixed(2)}% of the
              payout, for {days} {days === 1 ? "day" : "days"}
            </p>
          )}

          {quote.error && (
            <p className="text-xs text-danger">Risk engine quote failed — check RPC and vault.</p>
          )}
          {triggerError && <p className="text-xs text-danger">{triggerError}</p>}
          {!limits.isLoading && limits.fillableUsdg === 0 && !triggerError && (
            <p className="text-xs text-on-inverse-muted">
              No USDG backs this drop yet. A deeper drop can use a milder tier.
            </p>
          )}
          {quote.filled > 0 && quote.filled < coverage && !coverageError && (
            <p className="text-xs text-on-inverse-muted">
              Liquidity covers {num(quote.filled)} of {num(coverage)} USDG.
            </p>
          )}
          {premium <= 0 && limits.fillableUsdg > 0 && !premiumLoading && quoteEnabled && (
            <p className="text-xs text-on-inverse-muted">
              Premium rounds to zero at this size. Raise the payout or the term.
            </p>
          )}

          <AsideStatList>
            <AsideStat label="Token">${token.symbol}</AsideStat>
            <AsideStat label="Drop from entry">−{onChainSeverity}%</AsideStat>
            <AsideStat label="LP fillable">
              {limits.isLoading ? "…" : `${num(limits.fillableUsdg)} USDG`}
            </AsideStat>
            <AsideStat label="Payout">{coverageError ? "—" : `${num(coverage)} USDG`}</AsideStat>
            <AsideStat label="Until">{expiry}</AsideStat>
          </AsideStatList>

          {txError && (
            <p className="text-sm text-danger" role="alert">
              {txError.slice(0, 200)}
            </p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {(error as Error).message.slice(0, 200)}
            </p>
          )}

          <TxLinks txs={txs} />

          <AnimatePresence mode="wait" initial={false}>
            {txDone ? (
              <motion.div
                key="done"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4 border-t border-on-inverse/20 pt-6"
                role="status"
              >
                <p className="flex items-center gap-2">
                  <CheckCircle size={20} weight="fill" aria-hidden />
                  Covered until {expiry}
                </p>
                <Link href="/dashboard" className="btn btn-primary">
                  View in dashboard
                </Link>
              </motion.div>
            ) : (
              <motion.button
                key="pay"
                type="button"
                onClick={() => void pay()}
                disabled={
                  !!coverageError ||
                  !!triggerError ||
                  txBusy ||
                  !token.vault ||
                  premiumLoading ||
                  premium <= 0 ||
                  limits.fillableUsdg === 0 ||
                  limits.isLoading
                }
                aria-busy={txBusy}
                className="btn btn-primary"
              >
                {!token.vault
                  ? "Vault missing"
                  : isPending
                    ? "Confirm in wallet"
                    : isConfirming
                      ? "Confirming"
                      : `Pay ${premium.toFixed(2)} USDG`}
              </motion.button>
            )}
          </AnimatePresence>
      </CheckoutAside>
    </div>
  );
}
