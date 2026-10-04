"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle } from "@phosphor-icons/react";
import { AsideStat, AsideStatList, CheckoutAside } from "@/components/app/checkout-aside";
import { TxLinks } from "@/components/app/tx-links";
import { useToast } from "@/components/app/toaster";
import { AnimatedNumber, InfoPopover, Notice, Section } from "@/components/app/ui";
import { TriggerPicker } from "@/components/app/trigger-picker";
import { TokenLookup, type LookupResult } from "@/components/app/token-lookup";
import { useDepositLp } from "@/hooks/use-deposit-lp";
import { useEstimateApy } from "@/hooks/use-estimate-apy";
import { useLpCell } from "@/hooks/use-lp-cell";
import { useUnlistedPool } from "@/hooks/use-unlisted-pool";
import { USDG_DECIMALS } from "@/hooks/use-market-token";
import { useWallet } from "@/components/wallet";
import { robinhoodTestnet } from "@/lib/chains";
import {
  lpCellError,
  severityIdxFromPct,
  severityPct,
  TRIGGER_PLANS,
  type TriggerPlanId,
} from "@/lib/grid";
import { USDG_ADDRESS } from "@/lib/env";
import { erc20Abi } from "@/lib/abi";
import { marketMeetsDepthFloor, num, usd } from "@/lib/protocol";
import { formatUnits, getAddress, isAddress } from "viem";
import { useAccount, useChainId, useReadContract } from "wagmi";

const MIN_DEPOSIT = 100;

export function UnderwriteForm() {
  const params = useSearchParams();
  const { address, connect, status: walletStatus } = useWallet();
  const reduce = useReducedMotion();
  const amountId = useId();

  const standardPlan = TRIGGER_PLANS.find((p) => p.id === "standard")!;
  const [lookup, setLookup] = useState<LookupResult>({ status: "idle" });
  const [activePreset, setActivePreset] = useState<TriggerPlanId | "custom">("standard");
  const [showTriggerSliders, setShowTriggerSliders] = useState(false);
  const [severity, setSeverity] = useState<number>(standardPlan.severity);
  const [amount, setAmount] = useState("");
  const token = lookup.status === "found" ? lookup.token : null;
  const unlisted = useUnlistedPool(
    lookup.status === "new-market" ? lookup.address : undefined,
    lookup.status === "new-market",
  );
  const opening = unlisted.status === "ready" || unlisted.status === "has-vault";
  const { address: wagmiAddr } = useAccount();
  const chainIdNum = useChainId();
  const { submit: depositLp, hash, txs, phase, isPending, isConfirming, isSuccess, error: txErr } = useDepositLp(
    token?.vault ?? (unlisted.status === "has-vault" ? unlisted.vault : undefined),
  );
  const [txError, setTxError] = useState<string | null>(null);
  const { push } = useToast();
  const toasted = useRef<string | null>(null);

  const presetPlan =
    activePreset === "custom"
      ? null
      : (TRIGGER_PLANS.find((p) => p.id === activePreset) ?? standardPlan);
  const useSliderGrid = showTriggerSliders || activePreset === "custom";
  const severityIdx = useSliderGrid
    ? severityIdxFromPct(severity)
    : (presetPlan ?? standardPlan).severityIdx;
  const onChainSeverity = severityPct(severityIdx);
  const cellError = lpCellError(severityIdx);

  useEffect(() => {
    if (!isSuccess || !hash || toasted.current === hash) return;
    toasted.current = hash;
    push({ title: "Deposit confirmed", tone: "ok" });
  }, [isSuccess, hash, push]);

  const { data: usdgRaw } = useReadContract({
    address: USDG_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: wagmiAddr ? [wagmiAddr] : undefined,
    query: { enabled: !!wagmiAddr && USDG_ADDRESS !== "0x" },
  });
  const usdgBalance = usdgRaw ? Number(formatUnits(usdgRaw, USDG_DECIMALS)) : 0;

  const cell = useLpCell(token?.vault, severityIdx, token?.indexerCells);
  const apy = useEstimateApy(token?.vault, severityIdx, !!token?.vault && !cellError);

  const handleLookup = useCallback((r: LookupResult) => {
    setLookup(r);
    setTxError(null);
  }, []);

  const belowFloor = token ? !marketMeetsDepthFloor(token) : false;

  const value = Number(amount.replace(/,/g, ""));
  const amountError =
    amount === ""
      ? null
      : !Number.isFinite(value) || value <= 0
        ? "Enter a positive number."
        : value < MIN_DEPOSIT
          ? `Minimum deposit is ${MIN_DEPOSIT} USDG.`
          : address && value > usdgBalance
            ? "Exceeds your USDG balance."
            : null;

  const txBusy = isPending || isConfirming;
  const canDeposit =
    (!!token?.vault || opening) &&
    !belowFloor &&
    !cellError &&
    !!address &&
    amount !== "" &&
    !amountError &&
    !txBusy;

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

  const snapNote =
    useSliderGrid && severity !== onChainSeverity
      ? `Snaps on-chain to −${onChainSeverity}% (from ${severity}%).`
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return connect();
    const listedVault = token?.vault ?? (unlisted.status === "has-vault" ? unlisted.vault : undefined);
    const open =
      !listedVault && unlisted.status === "ready" && lookup.status === "new-market" && isAddress(lookup.address)
        ? { token: getAddress(lookup.address), poolKey: unlisted.poolKey }
        : undefined;
    if (!canDeposit || (!listedVault && !open)) return;
    if (chainIdNum !== robinhoodTestnet.id) {
      setTxError("Switch wallet to Robinhood testnet (46630).");
      return;
    }
    setTxError(null);
    try {
      await depositLp({
        severityIdx,
        amountUsdg: value,
        owner: address as `0x${string}`,
        vault: listedVault,
        open,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Deposit failed";
      setTxError(message);
      push({ title: "Could not deposit", body: message.slice(0, 140), tone: "danger" });
    }
  };

  const active = !!token || lookup.status === "new-market";
  let cta = "Choose a market";
  if (unlisted.status === "loading") cta = "Checking pair";
  else if (unlisted.status === "no-pair") cta = "No USDG pair";
  else if (unlisted.status === "unlocked") cta = "LP is not locked";
  else if (unlisted.status === "thin") cta = "Pool too thin";
  else if (unlisted.status === "unconfigured") cta = "Protocol addresses missing";
  else if (unlisted.status === "error") cta = "Could not read the pair";
  else if (token && belowFloor) cta = "Market not insurable";
  else if ((token || opening) && cellError) cta = "Fix risk cell";
  else if (active && !address) cta = walletStatus === "connecting" ? "Connecting" : "Connect wallet";
  else if (phase === "create") cta = "Opening market";
  else if (phase === "approve") cta = "Approving USDG";
  else if (txBusy) cta = "Depositing";
  else if (active && amount === "") cta = "Enter an amount";
  else if (token || opening) cta = `Deposit ${value ? num(value) : ""} USDG`;

  const apyDisplay = useMemo(() => {
    if (!token || belowFloor || cellError) return null;
    if (apy.isLoading && apy.apyPct == null) return null;
    return apy.apyPct ?? 0;
  }, [token, belowFloor, cellError, apy.isLoading, apy.apyPct]);

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
      <div>
        <Section title="Market">
          <TokenLookup initial={params.get("token") ?? ""} onResult={handleLookup} />
          {token && belowFloor && (
            <Notice tone="danger">
              Pool depth for ${token.symbol} is {usd(token.poolDepthUsdg)}, under the {usd(token.minDepthUsdg)}{" "}
              floor. Thin pools are too easy to move, so this market cannot be underwritten.
            </Notice>
          )}
          {token && !belowFloor && token.vaultTvl === 0 && (
            <Notice tone="info">
              No deposits in this market yet. Yours opens capacity at the drop you pick.
            </Notice>
          )}
          {lookup.status === "new-market" && unlisted.status === "ready" && (
            <Notice tone="info">
              No market yet. This deposit opens it, then your USDG backs the drop you pick.
            </Notice>
          )}
          {lookup.status === "new-market" && unlisted.status === "has-vault" && (
            <Notice tone="info">
              The market is on chain. The index has not caught up yet. This deposit still lands in it.
            </Notice>
          )}
          {lookup.status === "new-market" && unlisted.status === "no-pair" && (
            <Notice tone="danger">This token has no USDG pair, so it cannot be underwritten.</Notice>
          )}
          {lookup.status === "new-market" && unlisted.status === "unlocked" && (
            <Notice tone="danger">The USDG pair exists, but its liquidity is not locked.</Notice>
          )}
          {lookup.status === "new-market" && unlisted.status === "error" && (
            <Notice tone="danger">Could not read this token&apos;s USDG pair. Check the RPC and try again.</Notice>
          )}
          {lookup.status === "new-market" && unlisted.status === "thin" && (
            <Notice tone="danger">
              Locked depth is {usd(unlisted.depthUsdg)}, below the {usd(unlisted.minDepthUsdg)} floor.
            </Notice>
          )}
        </Section>

        <fieldset disabled={(!token && !opening) || belowFloor} className="disabled:opacity-40">
          <Section
            title="Risk cell"
            info={
              <p>
                You pay if price falls at least this far from the buyer&apos;s entry. A milder tier can
                also cover a deeper policy.
              </p>
            }
          >
            <TriggerPicker
              layoutId="underwrite-trigger-preset"
              reduce={reduce ?? false}
              activePreset={activePreset}
              showSliders={showTriggerSliders}
              severity={severity}
              onPreset={applyPreset}
              onCustom={openCustom}
              onSeverity={handleSeverity}
              snapNote={snapNote}
            />
            {cellError && (
              <p className="text-sm text-danger" role="alert">
                {cellError}
              </p>
            )}
          </Section>

          <Section
            title="Deposit"
            info={
              <p>
                This USDG backs policies at the drop you picked. Locked amounts stay until those
                policies end or settle. The rest can be withdrawn.
              </p>
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor={amountId} className="label">
                  Amount (USDG)
                </label>
                {address && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.floor(usdgBalance)))}
                    className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    Balance: {num(usdgBalance, 2)} USDG
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

      <CheckoutAside>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">
              Estimated APY
            </span>
            <span className="text-4xl leading-none tracking-tight">
              {apyDisplay != null ? (
                apy.isFetching && apy.apyPct == null ? (
                  <span className="text-on-inverse-muted">…</span>
                ) : (
                  <AnimatedNumber value={apyDisplay} format={(n) => `${n.toFixed(1)}%`} />
                )
              ) : (
                "—"
              )}
            </span>
          </div>
          <InfoPopover align="end" placement="above" label="APY methodology">
            <p>
              Estimated from recent volatility and how full this tier is. You earn premiums written
              against your deposit.
            </p>
          </InfoPopover>
        </div>

        {apy.error && (
          <p className="text-xs text-danger">APY quote failed — check RPC and vault.</p>
        )}

        <AsideStatList>
          <AsideStat label="Tier">−{onChainSeverity}%</AsideStat>
          <AsideStat label="Cell TVL">{token ? usd(cell.totalUsdg) : "—"}</AsideStat>
          <AsideStat label="Locked">{token ? usd(cell.lockedUsdg) : "—"}</AsideStat>
          <AsideStat label="Utilization">
            {token ? `${Math.round(cell.utilization * 100)}%` : "—"}
          </AsideStat>
        </AsideStatList>

        {txError && (
          <p className="text-sm text-danger" role="alert">
            {txError.slice(0, 180)}
          </p>
        )}
        {txErr && (
          <p className="text-sm text-danger" role="alert">
            {(txErr as Error).message.slice(0, 180)}
          </p>
        )}

        <TxLinks txs={txs} />

        <AnimatePresence mode="wait" initial={false}>
          {isSuccess ? (
            <motion.div
              key="done"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4 border-t border-on-inverse/20 pt-6"
              role="status"
            >
              <p className="flex items-center gap-2">
                <CheckCircle size={20} weight="fill" aria-hidden />
                Position live{token ? ` in $${token.symbol}` : ""}
              </p>
              <Link href="/dashboard" className="btn btn-primary">
                View in dashboard
              </Link>
            </motion.div>
          ) : (
            <motion.button
              key="cta"
              type="submit"
              disabled={
                (!token && !opening) ||
                belowFloor ||
                !!cellError ||
                txBusy ||
                walletStatus === "connecting" ||
                unlisted.status === "loading" ||
                unlisted.status === "no-pair" ||
                unlisted.status === "unlocked" ||
                unlisted.status === "thin" ||
                unlisted.status === "unconfigured" ||
                unlisted.status === "error" ||
                (!!address && !canDeposit)
              }
              aria-busy={txBusy}
              className="btn btn-primary"
            >
              {cta}
            </motion.button>
          )}
        </AnimatePresence>
      </CheckoutAside>
    </form>
  );
}
