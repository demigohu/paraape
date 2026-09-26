"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle } from "@phosphor-icons/react";
import { AnimatedNumber, Notice, RangeField, Section } from "@/components/app/ui";
import { TokenLookup, type LookupResult } from "@/components/app/token-lookup";
import { useWallet } from "@/components/wallet";
import {
  MIN_POOL_TVL,
  SEVERITY,
  WINDOW,
  availableCapacity,
  estimateApy,
  num,
  payoutCap,
  triggerProbability,
  usd,
} from "@/lib/protocol";

const USDG_BALANCE = 25_000;
const MIN_DEPOSIT = 100;

export function UnderwriteForm() {
  const params = useSearchParams();
  const { address, connect, status: walletStatus } = useWallet();
  const reduce = useReducedMotion();
  const amountId = useId();

  const [lookup, setLookup] = useState<LookupResult>({ status: "idle" });
  const [severity, setSeverity] = useState<number>(SEVERITY.default);
  const [windowMin, setWindowMin] = useState<number>(WINDOW.default);
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState<"idle" | "pending" | "done">("idle");

  const handleLookup = useCallback((r: LookupResult) => {
    setLookup(r);
    setTx("idle");
  }, []);

  const token = lookup.status === "found" ? lookup.token : null;
  const belowFloor = token ? token.poolTvl < MIN_POOL_TVL : false;
  const apy = token ? estimateApy(token, severity, windowMin) : 0;
  const risk = token ? triggerProbability(token.volatility, severity, windowMin) : 0;

  const value = Number(amount.replace(/,/g, ""));
  const amountError =
    amount === ""
      ? null
      : !Number.isFinite(value) || value <= 0
        ? "Enter a positive number."
        : value < MIN_DEPOSIT
          ? `Minimum deposit is ${MIN_DEPOSIT} USDG.`
          : address && value > USDG_BALANCE
            ? "Exceeds your USDG balance."
            : null;

  const canDeposit = !!token && !belowFloor && !!address && amount !== "" && !amountError && tx === "idle";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return connect();
    if (!canDeposit) return;
    setTx("pending");
    window.setTimeout(() => setTx("done"), 1400);
  };

  let cta = "Choose a market";
  if (token && belowFloor) cta = "Market not insurable";
  else if (token && !address) cta = walletStatus === "connecting" ? "Connecting" : "Connect wallet";
  else if (token && tx === "pending") cta = "Depositing";
  else if (token && amount === "") cta = "Enter an amount";
  else if (token) cta = `Deposit ${value ? num(value) : ""} USDG`;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
      <div>
        <Section title="Market">
          <TokenLookup initial={params.get("token") ?? ""} onResult={handleLookup} />
          {token && belowFloor && (
            <Notice tone="danger">
              ${token.symbol}&apos;s pool holds {usd(token.poolTvl)}, below the {usd(MIN_POOL_TVL)} floor.
              Thin pools are too easy to move, so this market cannot be underwritten.
            </Notice>
          )}
          {token && !belowFloor && token.vaultTvl === 0 && (
            <Notice tone="info">
              No LPs in this market yet. Your deposit creates the vault and sets its first capacity.
            </Notice>
          )}
        </Section>

        <fieldset disabled={!token || belowFloor} className="disabled:opacity-40">
          <Section title="Risk parameters">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <RangeField
                label="Severity"
                value={severity}
                min={SEVERITY.min}
                max={SEVERITY.max}
                step={SEVERITY.step}
                unit="% drop"
                onChange={setSeverity}
                minLabel="More payouts"
                maxLabel="Rarer payouts"
                hint="How far the price must fall before your capital pays out."
              />
              <RangeField
                label="Time window"
                value={windowMin}
                min={WINDOW.min}
                max={WINDOW.max}
                step={WINDOW.step}
                unit="min"
                onChange={setWindowMin}
                minLabel="Only flash crashes"
                maxLabel="Slower crashes too"
                hint="How fast that fall must happen. Shorter windows only cover sudden rugs."
              />
            </div>
          </Section>

          <Section title="Deposit">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor={amountId} className="label">
                  Amount (USDG)
                </label>
                {address && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(USDG_BALANCE))}
                    className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    Balance: {num(USDG_BALANCE)} USDG
                  </button>
                )}
              </div>
              <input
                id={amountId}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="1,000"
                aria-invalid={!!amountError}
                aria-describedby={`${amountId}-err`}
                className="field text-lg"
              />
              <p id={`${amountId}-err`} className="min-h-5 text-sm text-danger" aria-live="polite">
                {amountError}
              </p>
            </div>
          </Section>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-8 bg-inverse p-8 text-on-inverse">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">Estimated APY</span>
            <span className="text-4xl leading-none tracking-tight">
              {token && !belowFloor ? <AnimatedNumber value={apy} format={(n) => `${n.toFixed(1)}%`} /> : "-"}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <Row label="Trigger">
              {severity}% in {windowMin} min
            </Row>
            <Row label="30-day trigger odds">{token ? `${(risk * 100).toFixed(1)}%` : "-"}</Row>
            <Row label="Open capacity">{token ? usd(availableCapacity(token)) : "-"}</Row>
            <Row label="Payout cap / policy">{token ? usd(payoutCap(token, severity)) : "-"}</Row>
          </dl>

          <p className="text-xs leading-relaxed text-on-inverse-muted">
            Estimates come from the token&apos;s rolling volatility. Trigger odds are illustrative until
            thresholds are calibrated against historical crashes.
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
                  Position live in ${token?.symbol}
                </p>
                <Link href="/dashboard" className="btn btn-primary">
                  View in dashboard
                </Link>
              </motion.div>
            ) : (
              <motion.button
                key="cta"
                type="submit"
                disabled={!token || belowFloor || tx === "pending" || walletStatus === "connecting" || (!!address && !canDeposit)}
                aria-busy={tx === "pending"}
                className="btn btn-primary"
              >
                {cta}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}