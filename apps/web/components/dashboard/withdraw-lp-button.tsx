"use client";

import { useState } from "react";
import type { IndexerLpPosition } from "@/lib/indexer";
import { useWithdrawLp } from "@/hooks/use-withdraw-lp";
import { TxLinks } from "@/components/app/tx-links";
import { useToast } from "@/components/app/toaster";
import { num } from "@/lib/protocol";
import { formatUnits } from "viem";

export function WithdrawLpButton({ position }: { position: IndexerLpPosition }) {
  const { withdraw, txs, isPending, isConfirming } = useWithdrawLp(position.vault);
  const { push } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const free = Number(formatUnits(BigInt(position.freeUsdg), 6));
  const shares = BigInt(position.shares);

  if (free <= 0 || shares <= 0n) {
    return <span className="text-xs text-fg-muted">Locked</span>;
  }
  if (position.severityIdx == null) {
    return <span className="text-xs text-fg-muted">—</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending || isConfirming}
        className="btn btn-ghost h-8 px-2 text-xs"
        onClick={() => {
          setErr(null);
          void withdraw({
            severityIdx: position.severityIdx!,
            shares,
          })
            .then(() => push({ title: "Withdrawal confirmed", tone: "ok" }))
            .catch((e) => {
              const message = e instanceof Error ? e.message.slice(0, 140) : "Withdraw failed";
              setErr(message);
              push({ title: "Could not withdraw", body: message, tone: "danger" });
            });
        }}
      >
        {isPending || isConfirming ? "Withdrawing…" : `Withdraw ${num(free)}`}
      </button>
      <TxLinks txs={txs} tone="surface" />
      {err ? <p className="text-xs text-danger">{err}</p> : null}
    </div>
  );
}
