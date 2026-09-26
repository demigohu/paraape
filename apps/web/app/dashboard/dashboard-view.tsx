"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, Coins, Parachute, Wallet } from "@phosphor-icons/react";
import { Stat } from "@/components/app/ui";
import { useWallet } from "@/components/wallet";
import {
  ACTIVITY,
  MIN_POOL_TVL,
  POLICIES,
  POSITIONS,
  TOKENS,
  availableCapacity,
  num,
  shortAddress,
  usd,
  type ActivityItem,
  type Policy,
} from "@/lib/protocol";

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

  if (!address) {
    return (
      <div className="flex flex-col items-start gap-6 py-16">
        <Wallet size={40} aria-hidden className="text-signal" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl">Connect a wallet to see your activity</h2>
          <p className="max-w-[52ch] leading-relaxed text-fg-muted">
            Policies and LP positions are read from the connected address.
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

  const activeCover = POLICIES.filter((p) => p.status === "active").reduce((s, p) => s + p.coverage, 0);
  const premiumsPaid = POLICIES.reduce((s, p) => s + p.premium, 0);
  const deposited = POSITIONS.reduce((s, p) => s + p.deposited, 0);
  const earned = POSITIONS.reduce((s, p) => s + p.earned, 0);

  return (
    <div className="flex flex-col gap-12 pt-10">
      <div className="grid grid-cols-2 gap-8 border-b border-line pb-10 md:grid-cols-4">
        <Stat label="Active cover">{num(activeCover)} USDG</Stat>
        <Stat label="Premiums paid">{num(premiumsPaid, 2)} USDG</Stat>
        <Stat label="Underwritten">{num(deposited)} USDG</Stat>
        <Stat label="LP earnings" tone="signal">
          +{num(earned, 2)} USDG
        </Stat>
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
              {tab === "policies" && <PoliciesTable />}
              {tab === "positions" && <PositionsTable />}
              {tab === "markets" && <MarketsTable />}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside aria-labelledby="activity-title">
          <h2 id="activity-title" className="border-b border-line pb-3 pt-3 text-sm uppercase tracking-wide">
            Recent activity
          </h2>
          <ul className="flex flex-col">
            {ACTIVITY.map((a) => (
              <ActivityRow key={a.id} item={a} />
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

const th = "py-4 pr-6 text-left text-xs font-normal uppercase tracking-[0.08em] text-fg-muted";
const td = "py-5 pr-6 tabular-nums";

function PoliciesTable() {
  return (
    <table className="w-full min-w-[680px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Token</th>
          <th className={th}>Trigger</th>
          <th className={th}>Payout</th>
          <th className={th}>Premium</th>
          <th className={th}>Expires</th>
          <th className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {POLICIES.map((p) => (
          <tr key={p.id} className="border-b border-line last:border-b-0">
            <td className={td}>${p.token}</td>
            <td className={td}>
              -{p.severity}% / {p.windowMin} min
            </td>
            <td className={td}>{num(p.coverage)} USDG</td>
            <td className={td}>{num(p.premium, 2)} USDG</td>
            <td className={td}>{p.status === "active" ? `in ${p.expiresInDays} days` : "-"}</td>
            <td className={td}>
              <StatusBadge status={p.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({ status }: { status: Policy["status"] }) {
  const styles = {
    active: "border-signal bg-signal text-fg",
    paid: "border-safe text-safe",
    expired: "border-line-strong text-fg-muted",
  } as const;
  const label = { active: "Active", paid: "Paid out", expired: "Expired" } as const;
  return (
    <span className={`inline-block border px-2 py-1 text-xs uppercase tracking-wide ${styles[status]}`}>
      {label[status]}
    </span>
  );
}

function PositionsTable() {
  const [pending, setPending] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState<Record<string, boolean>>({});

  const withdraw = (id: string) => {
    setPending(id);
    window.setTimeout(() => {
      setWithdrawn((w) => ({ ...w, [id]: true }));
      setPending(null);
    }, 1200);
  };

  return (
    <table className="w-full min-w-[760px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Market</th>
          <th className={th}>Trigger</th>
          <th className={th}>Deposited</th>
          <th className={th}>Locked</th>
          <th className={th}>Earned</th>
          <th className={th}>APY</th>
          <th className={th}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {POSITIONS.map((p) => {
          const free = p.deposited - p.locked;
          const done = withdrawn[p.id];
          return (
            <tr key={p.id} className="border-b border-line last:border-b-0">
              <td className={td}>${p.token}</td>
              <td className={td}>
                -{p.severity}% / {p.windowMin} min
              </td>
              <td className={td}>{num(p.deposited)}</td>
              <td className={td}>{num(p.locked)}</td>
              <td className={`${td} text-safe`}>+{num(p.earned, 2)}</td>
              <td className={td}>{p.apy.toFixed(1)}%</td>
              <td className="py-3 text-right">
                <button
                  type="button"
                  onClick={() => withdraw(p.id)}
                  disabled={done || pending === p.id}
                  aria-busy={pending === p.id}
                  aria-label={`Withdraw ${num(free)} free USDG from ${p.token}`}
                  className="btn btn-ghost h-9 px-3 text-xs"
                >
                  {done ? "Withdrawn" : pending === p.id ? "Withdrawing" : `Withdraw ${num(free)}`}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MarketsTable() {
  return (
    <table className="w-full min-w-[820px] text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>Token</th>
          <th className={th}>Volatility</th>
          <th className={th}>Pool liquidity</th>
          <th className={th}>Vault TVL</th>
          <th className={th}>Open capacity</th>
          <th className={th}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {TOKENS.map((t) => {
          const insurable = t.poolTvl >= MIN_POOL_TVL;
          return (
            <tr key={t.symbol} className="border-b border-line last:border-b-0">
              <td className={td}>
                ${t.symbol}
                <span className="block text-xs text-fg-muted">{shortAddress(t.address)}</span>
              </td>
              <td className={td}>{Math.round(t.volatility * 100)}%</td>
              <td className={`${td} ${insurable ? "" : "text-danger"}`}>
                {usd(t.poolTvl)}
                {!insurable && <span className="block text-xs">Below floor</span>}
              </td>
              <td className={td}>{t.vaultTvl ? usd(t.vaultTvl) : "-"}</td>
              <td className={td}>{t.vaultTvl ? usd(availableCapacity(t)) : "-"}</td>
              <td className="py-3 text-right">
                {insurable ? (
                  <div className="flex justify-end gap-2">
                    <Link href="/protect" className="btn btn-ghost h-9 px-3 text-xs">
                      Protect
                    </Link>
                    <Link href={`/underwrite?token=${t.address}`} className="btn btn-ghost h-9 px-3 text-xs">
                      Underwrite
                    </Link>
                  </div>
                ) : (
                  <span className="text-xs text-fg-muted">Not insurable</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = {
    premium: { icon: Coins, text: "Premium earned", sign: "+" },
    payout: { icon: Parachute, text: "Payout received", sign: "+" },
    deposit: { icon: ArrowDownLeft, text: "Deposited", sign: "" },
    withdraw: { icon: ArrowUpRight, text: "Withdrew", sign: "" },
  }[item.kind];
  const Icon = meta.icon;
  const ago =
    item.minutesAgo < 60
      ? `${item.minutesAgo}m ago`
      : item.minutesAgo < 1440
        ? `${Math.floor(item.minutesAgo / 60)}h ago`
        : `${Math.floor(item.minutesAgo / 1440)}d ago`;

  return (
    <li className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center border border-line-strong">
        <Icon size={16} aria-hidden className={item.kind === "payout" ? "text-signal" : ""} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {meta.text} <span className="text-fg-muted">${item.token}</span>
        </p>
        <p className="text-xs text-fg-muted">{ago}</p>
      </div>
      <span className={`text-sm tabular-nums ${meta.sign ? "text-safe" : ""}`}>
        {meta.sign}
        {num(item.amount, item.amount < 100 ? 2 : 0)}
      </span>
    </li>
  );
}
