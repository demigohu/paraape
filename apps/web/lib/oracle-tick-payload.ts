import type { Hex } from "viem";
import { bytesToBigInt, hexToBytes } from "viem";

export type OracleSpotObservation = {
  tick: number;
  timestamp: number;
};

/** Parses `PriceObserver.exportTickPayload` (64 bytes per obs: tick, timestamp). */
export function parseExportTickPayload(payload: Hex): OracleSpotObservation[] {
  const bytes = hexToBytes(payload);
  const stride = 64;
  if (bytes.length < stride || bytes.length % stride !== 0) return [];

  const out: OracleSpotObservation[] = [];
  for (let c = 0; c < bytes.length / stride; c++) {
    const off = c * stride;
    const tick = Number(bytesToBigInt(bytes.slice(off, off + 32), { signed: true }));
    const timestamp = Number(bytesToBigInt(bytes.slice(off + 32, off + 64)));
    if (timestamp === 0) continue;
    out.push({ tick, timestamp });
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}
