import { shortHash, txExplorerUrl, type TxRef } from "@/lib/tx";

export function TxLinks({
  txs,
  tone = "inverse",
}: {
  txs: TxRef[];
  tone?: "inverse" | "surface";
}) {
  if (txs.length === 0) return null;
  const color =
    tone === "inverse"
      ? "text-on-inverse-muted hover:text-on-inverse"
      : "text-fg-muted hover:text-fg";
  return (
    <ul className="flex flex-col gap-1.5">
      {txs.map((tx) => (
        <li key={tx.hash}>
          <a
            href={txExplorerUrl(tx.hash)}
            target="_blank"
            rel="noreferrer"
            title={tx.hash}
            className={`inline-flex max-w-full items-baseline gap-2 text-xs underline-offset-2 hover:underline ${color}`}
          >
            <span className="shrink-0">{tx.label}</span>
            <span className="truncate tabular-nums">{shortHash(tx.hash)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
