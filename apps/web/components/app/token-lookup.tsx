"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { useMarketToken } from "@/hooks/use-market-token";
import {
  fetchMarketByToken,
  fetchMarkets,
  type IndexerMarket,
  type TokenMarketResponse,
} from "@/lib/indexer";
import { formatRealizedVolAnnualized } from "@/lib/format-vol";
import { isAddress, marketMeetsDepthFloor, shortAddress, usd, type Token } from "@/lib/protocol";

export type LookupResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "new-market"; address: string }
  | { status: "found"; token: Token };

export function TokenLookup({
  initial = "",
  onResult,
}: {
  initial?: string;
  onResult: (r: LookupResult) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(initial);
  const [result, setResult] = useState<LookupResult>({ status: "idle" });
  const [market, setMarket] = useState<IndexerMarket | null>(null);
  const [vaultStats, setVaultStats] = useState<Pick<
    TokenMarketResponse,
    "vaultTvl" | "lockedTvl" | "cells" | "oracle"
  > | null>(null);
  const [samples, setSamples] = useState<IndexerMarket[]>([]);
  const [marketsState, setMarketsState] = useState<"loading" | "ready" | "error">("loading");
  const reduce = useReducedMotion();

  useEffect(() => {
    fetchMarkets()
      .then((r) => {
        setSamples(r.markets);
        setMarketsState("ready");
      })
      .catch(() => {
        setSamples([]);
        setMarketsState("error");
      });
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMarket(null);
      setVaultStats(null);
      setResult({ status: "idle" });
      return;
    }

    setResult({ status: "loading" });
    setMarket(null);
    setVaultStats(null);

    const timer = window.setTimeout(async () => {
      const addr = isAddress(q) ? q : null;

      if (!addr) {
        setResult({ status: "invalid" });
        return;
      }

      try {
        const detail = await fetchMarketByToken(addr);
        setMarket(detail.market);
        setVaultStats({
          vaultTvl: detail.vaultTvl,
          lockedTvl: detail.lockedTvl,
          cells: detail.cells,
          oracle: detail.oracle,
        });
      } catch {
        setResult({ status: "new-market", address: addr });
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  const { token, isLoading: enriching } = useMarketToken(market, vaultStats);

  useEffect(() => {
    if (result.status === "loading" && market && token && !enriching) {
      setResult({ status: "found", token });
    }
  }, [market, token, enriching, result.status]);

  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  const invalid = result.status === "invalid";
  const chipMarkets = samples.length > 0 ? samples : [];

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="label">
        Token contract address
      </label>
      <div className="relative">
        <MagnifyingGlass
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted"
        />
        <input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="0x..."
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          className="field pl-11"
        />
      </div>

      <div id={`${id}-help`} aria-live="polite" className="min-h-6 text-sm">
        {invalid ? (
          <span className="flex items-center gap-2 text-danger">
            <WarningCircle size={16} weight="bold" aria-hidden />
            Not a valid address. Paste a 0x address with 40 hex characters.
          </span>
        ) : chipMarkets.length > 0 ? (
          <span className="flex flex-wrap items-center gap-2 text-fg-muted">
            Indexed markets:
            {chipMarkets.map((m) => (
              <button
                key={m.token}
                type="button"
                onClick={() => setQuery(m.token)}
                className="border border-line-strong px-2 py-0.5 font-mono text-xs text-fg hover:border-fg"
              >
                {shortAddress(m.token)}
              </button>
            ))}
          </span>
        ) : marketsState === "error" ? (
          <span className="text-fg-muted">
            Market list is unavailable right now.
          </span>
        ) : marketsState === "loading" ? (
          <span className="text-fg-muted">Loading markets…</span>
        ) : result.status === "new-market" ? null : (
          <span className="text-fg-muted">No markets on this factory yet.</span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {(result.status === "loading" || enriching) && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-4 border border-line p-5 md:grid-cols-4"
            aria-label="Loading market"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-6 w-24" />
              </div>
            ))}
          </motion.div>
        )}

        {result.status === "found" && (
          <motion.div
            key={result.token.address}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 gap-5 border border-line p-5 md:grid-cols-4"
          >
            <Meta label="Token">
              <span className="bg-signal px-1">${result.token.symbol}</span>
              <span className="block text-xs text-fg-muted">{shortAddress(result.token.address)}</span>
            </Meta>
            <Meta label="Realized vol">
              {result.token.volatility != null
                ? formatRealizedVolAnnualized(result.token.volatility)
                : "—"}
            </Meta>
            <Meta label="Locked pool depth (USDG)">
              <span className={!marketMeetsDepthFloor(result.token) ? "text-danger" : ""}>
                {usd(result.token.poolDepthUsdg)}
                {!marketMeetsDepthFloor(result.token) ? (
                  <span className="block text-xs">Below {usd(result.token.minDepthUsdg)} floor</span>
                ) : null}
              </span>
            </Meta>
            <Meta label="Vault TVL">{result.token.vaultTvl ? usd(result.token.vaultTvl) : "No LPs yet"}</Meta>
          </motion.div>
        )}

        {result.status === "new-market" && (
          <motion.div
            key="new"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-dashed border-line-strong p-5 text-sm leading-relaxed text-fg-muted"
          >
            No vault yet for <span className="text-fg">{shortAddress(result.address)}</span>.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <span className="text-lg tabular-nums">{children}</span>
    </div>
  );
}
