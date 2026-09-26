"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { MIN_POOL_TVL, TOKENS, findToken, isAddress, shortAddress, usd, type Token } from "@/lib/protocol";

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
  const reduce = useReducedMotion();

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult({ status: "idle" });
      return;
    }
    setResult({ status: "loading" });
    const timer = window.setTimeout(() => {
      const token = findToken(q);
      if (token) setResult({ status: "found", token });
      else if (isAddress(q)) setResult({ status: "new-market", address: q });
      else setResult({ status: "invalid" });
    }, 550);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  const invalid = result.status === "invalid";

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
          placeholder="0x... or symbol"
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
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-fg-muted">
            Try a sample market:
            {TOKENS.map((t) => (
              <button
                key={t.symbol}
                type="button"
                onClick={() => setQuery(t.address)}
                className="border border-line-strong px-2 py-0.5 text-xs text-fg hover:border-fg"
              >
                {t.symbol}
              </button>
            ))}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {result.status === "loading" && (
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
            key={result.token.symbol}
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
            <Meta label="Volatility (24h)">{Math.round(result.token.volatility * 100)}%</Meta>
            <Meta label="V4 pool liquidity">
              <span className={result.token.poolTvl < MIN_POOL_TVL ? "text-danger" : ""}>
                {usd(result.token.poolTvl)}
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
            No market exists for <span className="text-fg">{shortAddress(result.address)}</span> yet.
            The factory can deploy one once its Uniswap V4 pool is indexed.
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
