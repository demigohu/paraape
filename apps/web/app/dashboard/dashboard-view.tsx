"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Parachute, Wallet } from "@phosphor-icons/react";
import { InfoPopover, Stat } from "@/components/app/ui";
import { useWallet } from "@/components/wallet";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PolicyActions } from "@/components/dashboard/policy-actions";
import { WithdrawLpButton } from "@/components/dashboard/withdraw-lp-button";
import { fetchLpPositions, fetchMarkets, fetchPoliciesForBuyer } from "@/lib/indexer";
import { durationDays, severityPct } from "@/lib/grid";
import {
  num,
  shortAddress,
  usd,
} from "@/lib/protocol";
import { formatUnits } from "viem";

const TABS = [
  { id: "policies", label: "Policies" },
  { id: "positions", label: "Positions" },
  { id: "markets", label: "Markets" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DashboardView() {
  const { address, connect, status } = useWallet();
  const [tab, setTab] = useState<TabId>("policies");
  const reduce = useReducedMotion();
  const policiesQuery = useQuery({
    queryKey: ["policies", address],
    queryFn: () => fetchPoliciesForBuyer(address!),
    enabled: !!address,
  });
  const lpQuery = useQuery({
    queryKey: ["lp-positions", address],
    queryFn: () => fetchLpPositions(address!),
    enabled: !!address,
  });

  if (!address) {
    return (
      <div className="flex flex-col items-start gap-6 py-16">
        <Wallet size={40} aria-hidden className="text-signal" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl">Connect a wallet to see your activity</h2>
          <p className="max-w-[52ch] leading-relaxed text-fg-muted">
            Policies and deposits are read from the connected address.
          </p>
        </div>
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

  const policies = policiesQuery.data?.policies ?? [];
  const lpPositions = lpQuery.data?.positions ?? [];
  const activeCover = policies
    .filter((p) => p.status === "Active")
    .reduce((s, p) => s + Number(formatUnits(BigInt(p.coverageUsdg), 6)), 0);
  const premiumsPaid = policies.reduce(
    (s, p) => s + Number(formatUnits(BigInt(p.premiumUsdg), 6)),
    0,
  );
  const deposited = lpPositions.reduce(
    (s, p) => s + Number(formatUnits(BigInt(p.depositedUsdg), 6)),
    0,
  );
  const lockedLp = lpPositions.reduce(
    (s, p) => s + Number(formatUnits(BigInt(p.lockedUsdg), 6)),
    0,
  );

  return (
    <div className="flex flex-col gap-12 pt-10">
      <div className="grid grid-cols-2 gap-8 border-b border-line pb-10 md:grid-cols-4">
        <Stat label="Active cover">{num(activeCover)} USDG</Stat>
        <Stat label="Premiums paid">{num(premiumsPaid, 2)} USDG</Stat>
        <Stat label="Underwritten">{num(deposited)} USDG</Stat>
        <Stat label="Locked in cells">{num(lockedLp)} USDG</Stat>
      </div>

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  const i = TABS.findIndex((x) => x.id === tab);
                  if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length]!.id);
                  if (e.key === "ArrowLeft") setTab(TABS[(i - 1 + TABS.length) % TABS.length]!.id);
                }}
                tabIndex={tab === t.id ? 0 : -1}
                className={`relative px-4 py-3 text-sm uppercase tracking-wide ${
                  tab === t.id ? "text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-signal"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-x-auto pt-2"
            >
              {tab === "policies" && (
                <PoliciesTable loading={policiesQuery.isLoading} policies={policies} />
              )}
              {tab === "positions" && (
                <PositionsTable loading={lpQuery.isLoading} positions={lpPositions} />
              )}
              {tab === "markets" && <MarketsTable />}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside aria-labelledby="activity-title" className="text-sm">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3 pt-3">
            <h2 id="activity-title" className="text-sm uppercase tracking-wide text-fg">
              Activity
            </h2>
            <InfoPopover label="How deposits earn" align="end" placement="above">
              <p>
                Premiums accrue into your deposit while policies run. USDG you can withdraw is on the
                Positions tab.
              </p>
            </InfoPopover>
          </div>
          <div className="pt-4">
            <ActivityFeed address={address} />
          </div>
        </aside>
      </div>
    </div>
  );
}

const th = "py-4 pr-6 text-left text-xs font-normal uppercase tracking-[0.08em] text-fg-muted";
const td = "py-5 pr-6 tabular-nums";

function PoliciesTable({
  policies,
  loading,
}: {
  policies: Awaited<ReturnType<typeof fetchPoliciesForBuyer>>["policies"];
  loading: boolean;
}) {
  if (loading) {
    return <p className="py-8 text-sm text-fg-muted">Loading policies from indexer…</p>;
  }
  if (policies.length === 0) {
    return (
      <p className="py-8 text-sm text-fg-muted">
        No policies for this wallet yet.{" "}
        <Link href="/protect" className="underline underline-offset-4">
          Buy cover
        </Link>
      </p>
    );
  }

  return (
    <table className="w-full min-w-[680px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Token</th>
          <th className={th}>Trigger</th>
          <th className={th}>Payout</th>
          <th className={th}>Premium</th>
          <th className={th}>Status</th>
          <th className={th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((p) => {
          const coverage = Number(formatUnits(BigInt(p.coverageUsdg), 6));
          const premium = Number(formatUnits(BigInt(p.premiumUsdg), 6));
          const sev = severityPct(p.severityIdx);
          const dur =
            p.durationIdx != null ? durationDays(p.durationIdx) : null;
          return (
            <tr key={p.id} className="border-b border-line last:border-b-0">
              <td className={td}>{shortAddress(p.token)}</td>
              <td className={td}>
                -{sev}%{dur != null ? ` / ${dur}d` : ""}
              </td>
              <td className={td}>{num(coverage)} USDG</td>
              <td className={td}>{num(premium, 2)} USDG</td>
              <td className={td}>
                <IndexerPolicyBadge status={p.status} />
              </td>
              <td className={td}>
                <PolicyActions policy={p} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function IndexerPolicyBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "active"
      ? "border-signal bg-signal text-fg"
      : normalized === "paid"
        ? "border-safe text-safe"
        : "border-line-strong text-fg-muted";
  return (
    <span className={`inline-block border px-2 py-1 text-xs uppercase tracking-wide ${styles}`}>
      {status}
    </span>
  );
}

function PositionsTable({
  positions,
  loading,
}: {
  positions: Awaited<ReturnType<typeof fetchLpPositions>>["positions"];
  loading: boolean;
}) {
  if (loading) {
    return <p className="py-8 text-sm text-fg-muted">Loading LP positions from indexer…</p>;
  }
  if (positions.length === 0) {
    return (
      <p className="py-8 text-sm text-fg-muted">
        No deposits for this wallet yet.{" "}
        <Link href="/underwrite" className="underline underline-offset-4">
          Underwrite a market
        </Link>
      </p>
    );
  }

  return (
    <table className="w-full min-w-[760px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Token</th>
          <th className={th}>Trigger</th>
          <th className={th}>Deposited</th>
          <th className={th}>Locked</th>
          <th className={th}>Free</th>
          <th className={th}>Shares</th>
          <th className={th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const deposited = Number(formatUnits(BigInt(p.depositedUsdg), 6));
          const locked = Number(formatUnits(BigInt(p.lockedUsdg), 6));
          const free = Number(formatUnits(BigInt(p.freeUsdg), 6));
          const sev =
            p.severityIdx != null ? severityPct(p.severityIdx) : "—";
          return (
            <tr key={p.id} className="border-b border-line last:border-b-0">
              <td className={td}>{shortAddress(p.token)}</td>
              <td className={td}>{typeof sev === "number" ? `-${sev}%` : sev}</td>
              <td className={td}>{num(deposited)} USDG</td>
              <td className={td}>{num(locked)} USDG</td>
              <td className={td}>{num(free)} USDG</td>
              <td className={`${td} font-mono text-xs`}>{p.shares}</td>
              <td className={td}>
                <WithdrawLpButton position={p} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MarketsTable() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
  });

  if (isLoading) {
    return <p className="py-8 text-sm text-fg-muted">Loading markets from indexer…</p>;
  }
  if (isError || !data?.markets.length) {
    return (
      <p className="py-8 text-sm text-fg-muted">
        No markets yet.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[820px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Token</th>
          <th className={th}>Vault</th>
          <th className={th}>Pool ref</th>
          <th className={th}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {data.markets.map((m) => (
          <tr key={m.token} className="border-b border-line last:border-b-0">
            <td className={td}>{shortAddress(m.token)}</td>
            <td className={td}>{shortAddress(m.vault)}</td>
            <td className={`${td} font-mono text-xs`}>{shortAddress(m.poolRef)}</td>
            <td className="py-3 text-right">
              <div className="flex justify-end gap-2">
                <Link href={`/protect?token=${m.token}`} className="btn btn-ghost h-9 px-3 text-xs">
                  Protect
                </Link>
                <Link href={`/underwrite?token=${m.token}`} className="btn btn-ghost h-9 px-3 text-xs">
                  Underwrite
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

