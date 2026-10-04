"use client";

import { useCallback, useState } from "react";
import type { IndexerPolicy } from "@/lib/indexer";
import { usePolicyActions } from "@/hooks/use-policy-actions";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { severityPct } from "@/lib/grid";
import { insuranceVaultAbi } from "@/lib/abi";
import { TxLinks } from "@/components/app/tx-links";
import { useToast } from "@/components/app/toaster";
import { InfoPopover } from "@/components/app/ui";

export function PolicyActions({ policy }: { policy: IndexerPolicy }) {
  const vault = policy.vault;
  const publicClient = usePublicClient();
  const { challenge, release, expire, settle, txs, isPending } = usePolicyActions(vault);
  const { push } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const policyId = BigInt(policy.policyId);
  const status = policy.status.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const challengeDeadline = policy.challengeDeadline
    ? Number(policy.challengeDeadline)
    : null;

  const { address } = useAccount();
  const isBuyer = address != null && address.toLowerCase() === policy.buyer.toLowerCase();
  const { data: onChainPolicy } = useReadContract({
    address: vault,
    abi: insuranceVaultAbi,
    functionName: "getPolicy",
    args: [policyId],
    query: { enabled: Boolean(vault) && status === "active" },
  });
  const expiryTs =
    onChainPolicy?.expiry != null ? Number(onChainPolicy.expiry) : null;
  const pastExpiry = expiryTs != null && now > expiryTs;

  const act = async (fn: () => Promise<void>, ok: string) => {
    setErr(null);
    try {
      await fn();
      push({ title: ok, tone: "ok" });
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 160) : "Transaction failed";
      setErr(message);
      push({ title: "Transaction failed", body: message, tone: "danger" });
    }
  };

  const checkAndClaim = useCallback(async () => {
    if (!publicClient || !vault) {
      setErr("Wallet RPC not ready");
      return;
    }
    setErr(null);
    setScanHint(null);
    try {
      await settle(policyId);
      setScanHint("Settle submitted. Status should move to pending payout.");
      push({ title: "Settle submitted", tone: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Settle failed";
      if (/trigger|persistence|inactive|holding/i.test(msg)) {
        const hint = `Not payable yet. Price still has to be −${severityPct(policy.severityIdx)}% from your entry, and you still have to hold the tokens.`;
        setScanHint(hint);
        push({ title: "Not payable yet", body: hint, tone: "danger" });
        return;
      }
      setErr(msg.slice(0, 160));
      push({ title: "Settle failed", body: msg.slice(0, 140), tone: "danger" });
    }
  }, [publicClient, vault, policyId, policy.severityIdx, settle, push]);

  if (status === "active") {
    return (
      <div className="flex max-w-[14rem] flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            className="btn btn-primary h-8 px-2 text-xs"
            onClick={() => void checkAndClaim()}
          >
            {isPending ? "Settling…" : "Settle"}
          </button>
          <InfoPopover label="How settle works" align="end" placement="above">
            <p>
              Pays if the 5-minute average is still −{severityPct(policy.severityIdx)}% from your
              entry and you still hold the tokens.
            </p>
          </InfoPopover>
        </div>
        {pastExpiry ? (
          <button
            type="button"
            disabled={isPending}
            className="btn btn-ghost h-8 px-2 text-xs"
            onClick={() => void act(() => expire(policyId), "Policy closed")}
          >
            Close policy
          </button>
        ) : null}
        {scanHint ? <p className="text-xs text-fg-muted">{scanHint}</p> : null}
        <TxLinks txs={txs} tone="surface" />
        {err ? <p className="text-xs text-danger">{err}</p> : null}
      </div>
    );
  }

  if (status === "pendingpayout") {
    const remaining =
      challengeDeadline != null ? Math.max(0, challengeDeadline - now) : null;
    const waitLabel =
      remaining == null
        ? null
        : remaining >= 3600
          ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`
          : `${Math.max(1, Math.ceil(remaining / 60))}m`;
    return (
      <div className="flex max-w-[14rem] flex-col gap-2">
        {remaining != null && remaining > 0 ? (
          <p className="text-xs text-fg-muted">Unlocks in {waitLabel}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {remaining != null && remaining > 0 && !isBuyer && (
            <button
              type="button"
              disabled={isPending}
              className="btn btn-ghost h-8 px-2 text-xs"
              onClick={() => void act(() => challenge(policyId), "Challenge submitted")}
            >
              Challenge
            </button>
          )}
          {remaining != null && remaining <= 0 && (
            <button
              type="button"
              disabled={isPending}
              className="btn btn-primary h-8 px-2 text-xs"
              onClick={() => void act(() => release(policyId), "Payout sent")}
            >
              Receive payout
            </button>
          )}
          <InfoPopover label="About this payout" align="end" placement="above">
            <p>
              {remaining != null && remaining > 0
                ? "An LP who backs this policy can recheck the drop until the window ends. After that, receive payout sends the USDG."
                : "The review window is over. Receive payout sends the USDG."}
            </p>
          </InfoPopover>
        </div>
        <TxLinks txs={txs} tone="surface" />
        {err ? <p className="text-xs text-danger">{err}</p> : null}
      </div>
    );
  }

  return <span className="text-xs text-fg-muted">—</span>;
}
