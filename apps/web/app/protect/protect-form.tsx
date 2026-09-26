"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle, Parachute } from "@phosphor-icons/react";
import { AnimatedNumber, Notice, Section } from "@/components/app/ui";
import { TokenLookup, type LookupResult } from "@/components/app/token-lookup";
import { useWallet } from "@/components/wallet";
import {
  DURATIONS,
  MIN_POOL_TVL,
  availableCapacity,
  num,
  payoutCap,
  quotePremium,
  usd,
  type Token,
} from "@/lib/protocol";

const PLANS = [
  { id: "flash", name: "Flash rug", severity: 90, windowMin: 5 },
  { id: "standard", name: "Standard", severity: 85, windowMin: 10 },
  { id: "broad", name: "Broad", severity: 75, windowMin: 30 },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

export function ProtectForm() {
  const [lookup, setLookup] = useState<LookupResult>({ status: "idle" });
  const handleLookup = useCallback((r: LookupResult) => setLookup(r), []);
  const token = lookup.status === "found" ? lookup.token : null;

  return (
    <div>
      <Section title="Token">
        <TokenLookup onResult={handleLookup} />
      </Section>
      {token && <Eligibility key={token.symbol} token={token} />}
    </div>
  );
}

function Eligibility({ token }: { token: Token }) {
  const { address, connect, status } = useWallet();

  if (token.poolTvl < MIN_POOL_TVL) {
    return (
      <div className="py-10">
        <Notice tone="danger">
          ${token.symbol}&apos;s pool holds {usd(token.poolTvl)}, below the {usd(MIN_POOL_TVL)} liquidity
          floor. Pools this thin are too easy to manipulate, so they cannot be insured.
        </Notice>
      </div>
    );
  }

  if (availableCapacity(token) === 0) {
    return (
      <div className="flex flex-col items-start gap-6 border border-dashed border-line-strong p-8 md:my-10 md:p-12">
        <Parachute size={40} aria-hidden className="text-signal" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl">No protection available for ${token.symbol} yet</h2>
          <p className="max-w-[56ch] leading-relaxed text-fg-muted">
            No LP has underwritten this market. Anyone can open it by depositing USDG and setting a
            trigger.
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
          Protection only covers tokens you hold. Connect your wallet so we can check your ${token.symbol}{" "}
          balance.
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
          Your wallet holds 0 ${token.symbol}. Paraape only protects positions you actually own, so this
          purchase is blocked.
        </Notice>
      </div>
    );
  }

  return <Quote token={token} />;
}

function Quote({ token }: { token: Token }) {
  const reduce = useReducedMotion();
  const coverageId = useId();
  const [plan, setPlan] = useState<PlanId>("standard");
  const [days, setDays] = useState<(typeof DURATIONS)[number]>(14);
  const [tx, setTx] = useState<"idle" | "pending" | "done">("idle");

  const selected = PLANS.find((p) => p.id === plan)!;
  const positionValue = token.walletBalance * token.priceUsd;
  const maxCoverage = Math.floor(
    Math.min(positionValue, payoutCap(token, selected.severity), availableCapacity(token)),
  );
  const [coverageInput, setCoverageInput] = useState(String(maxCoverage));
  const coverage = Number(coverageInput.replace(/,/g, ""));

  const coverageError =
    !Number.isFinite(coverage) || coverage <= 0
      ? "Enter a coverage amount."
      : coverage > maxCoverage
        ? `Max coverage for this plan is ${num(maxCoverage)} USDG.`
        : null;

  const premium = coverageError ? 0 : quotePremium(token, selected.severity, selected.windowMin, coverage, days);

  const expiry = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [days]);

  const pay = () => {
    if (coverageError || tx !== "idle") return;
    setTx("pending");
    window.setTimeout(() => setTx("done"), 1400);
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
      <div>
        <Section
          title="Choose a trigger"
          aside={
            <span className="text-sm text-fg-muted">
              You hold {num(token.walletBalance)} ${token.symbol} ({usd(positionValue)})
            </span>
          }
        >
          <div role="radiogroup" aria-label="Trigger plan" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLANS.map((p) => {
              const active = p.id === plan;
              const per1k = quotePremium(token, p.severity, p.windowMin, 1000, days);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPlan(p.id)}
                  className={`relative flex flex-col items-start gap-4 border p-5 text-left transition-colors duration-[var(--duration-fast)] ${
                    active ? "border-fg" : "border-line-strong hover:border-fg"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="plan-active"
                      className="absolute inset-0 bg-surface-raised"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  <span className="relative text-sm uppercase tracking-wide">{p.name}</span>
                  <span className="relative text-2xl tabular-nums">
                    -{p.severity}%<span className="text-sm text-fg-muted"> / {p.windowMin} min</span>
                  </span>
                  <span className="relative text-xs text-fg-muted">{usd(per1k, 2)} per 1,000 USDG cover</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Coverage">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor={coverageId} className="label">
                  Payout if triggered (USDG)
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
                Duration
              </span>
              <div role="radiogroup" aria-labelledby="duration-label" className="grid h-12 grid-cols-3 border border-line-strong">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={d === days}
                    onClick={() => setDays(d)}
                    className="relative text-sm"
                  >
                    {d === days && (
                      <motion.span
                        layoutId="duration-active"
                        className="absolute inset-0 bg-fg"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
                      />
                    )}
                    <span className={`relative ${d === days ? "text-surface" : "text-fg-muted"}`}>{d} days</span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-fg-muted">Coverage ends {expiry}.</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-fg-muted">
            Max coverage is the lowest of your position value, the pool-depth payout cap and the
            market&apos;s open LP capacity.
          </p>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-8 bg-inverse p-8 text-on-inverse">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">Premium</span>
            <span className="text-4xl leading-none tracking-tight">
              <AnimatedNumber value={premium} format={(n) => `${n.toFixed(2)}`} />
              <span className="ml-2 text-lg">USDG</span>
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <SummaryRow label="Token">${token.symbol}</SummaryRow>
            <SummaryRow label="Trigger">
              -{selected.severity}% in {selected.windowMin} min
            </SummaryRow>
            <SummaryRow label="Payout">{coverageError ? "-" : `${num(coverage)} USDG`}</SummaryRow>
            <SummaryRow label="Expires">{expiry}</SummaryRow>
          </dl>

          <p className="text-xs leading-relaxed text-on-inverse-muted">
            Settlement is automatic once the pool&apos;s TWAP confirms the trigger. Claims from wallets that
            sold heavily during the crash window are rejected.
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {tx === "done" ? (
              <motion.div
                key="done"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4 border-t border-on-inverse/20 pt-6"
                role="status"
              >
                <p className="flex items-center gap-2">
                  <CheckCircle size={20} weight="fill" aria-hidden />
                  ${token.symbol} is protected until {expiry}
                </p>
                <Link href="/dashboard" className="btn btn-primary">
                  View in dashboard
                </Link>
              </motion.div>
            ) : (
              <motion.button
                key="pay"
                type="button"
                onClick={pay}
                disabled={!!coverageError || tx === "pending"}
                aria-busy={tx === "pending"}
                className="btn btn-primary"
              >
                {tx === "pending" ? "Confirming" : `Pay ${premium.toFixed(2)} USDG`}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
