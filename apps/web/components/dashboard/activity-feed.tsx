"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchWalletActivity, type IndexerActivity } from "@/lib/indexer";
import { shortHash, txExplorerUrl } from "@/lib/tx";
import { num, shortAddress } from "@/lib/protocol";
import { formatUnits } from "viem";

const KIND_LABEL: Record<string, string> = {
  policy_purchased: "Premium paid",
  cell_deposit: "LP deposit",
  cell_withdraw: "LP withdraw",
  policy_settled: "Policy settled",
  policy_challenged: "Challenge filed",
  policy_released: "Payout released",
  policy_voided: "Policy voided",
  policy_expired: "Policy expired",
  record_bounty: "Oracle record bounty",
};

function formatActivity(a: IndexerActivity): string {
  const amt =
    a.amountUsdg != null ? Number(formatUnits(BigInt(a.amountUsdg), 6)) : null;
  const base = KIND_LABEL[a.kind] ?? a.kind;
  if (amt != null && amt > 0) return `${base} · ${num(amt, 2)} USDG`;
  if (a.policyId) return `${base} · #${a.policyId}`;
  return base;
}

function timeAgo(tsSec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - tsSec);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ActivityFeed({ address }: { address: string }) {
  const q = useQuery({
    queryKey: ["activity", address],
    queryFn: () => fetchWalletActivity(address),
    refetchInterval: 30_000,
  });

  if (q.isLoading) {
    return <p className="py-4 text-sm text-fg-muted">Loading activity…</p>;
  }
  if (q.isError) {
    return (
      <p className="py-4 text-sm text-fg-muted">
        Activity feed unavailable — restart indexer after schema update.
      </p>
    );
  }

  const items = q.data?.activities ?? [];
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm leading-relaxed text-fg-muted">
        No indexed events for this wallet yet. Buys, LP deposits, and policy lifecycle steps appear
        here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex flex-col gap-1 py-3 first:pt-0">
          <span className="text-fg">{formatActivity(a)}</span>
          <span className="text-xs text-fg-muted">
            ${shortAddress(a.token)} · {timeAgo(Number(a.timestamp))}
            {a.txHash ? (
              <>
                {" · "}
                <a
                  href={txExplorerUrl(a.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  title={a.txHash}
                  className="underline-offset-2 hover:text-fg hover:underline"
                >
                  {shortHash(a.txHash)}
                </a>
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
