import type { Hash } from "viem";
import { robinhoodAppKitNetwork } from "@/lib/chains";

export type TxRef = {
  label: string;
  hash: Hash;
};

export function txExplorerUrl(hash: string): string {
  const base = robinhoodAppKitNetwork.blockExplorers.default.url.replace(/\/$/, "");
  return `${base}/tx/${hash}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}
