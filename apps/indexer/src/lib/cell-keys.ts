import { encodePacked, keccak256 } from "viem";

const SEVERITY_COUNT = 6;

export function cellKey(severityIdx: number): `0x${string}` {
  return keccak256(encodePacked(["uint8"], [severityIdx]));
}

/** Decode a severity-only cell key. Returns null if it is not on the grid. */
export function indicesForCellKey(key: `0x${string}`): { severityIdx: number } | null {
  const normalized = key.toLowerCase();
  for (let severityIdx = 0; severityIdx < SEVERITY_COUNT; severityIdx++) {
    if (cellKey(severityIdx).toLowerCase() === normalized) {
      return { severityIdx };
    }
  }
  return null;
}

export function lpPositionId(
  vault: `0x${string}`,
  cellKey: `0x${string}`,
  lp: `0x${string}`,
): string {
  return `${vault.toLowerCase()}-${cellKey.toLowerCase()}-${lp.toLowerCase()}`;
}

export function vaultCellId(vault: `0x${string}`, cellKey: `0x${string}`): string {
  return `${vault.toLowerCase()}-${cellKey.toLowerCase()}`;
}

/** A milder cell can back a deeper policy. Same rule as `GridLib.cellBacksPolicy`. */
export function cellBacksPolicy(cellSeverityIdx: number, policySeverityIdx: number): boolean {
  return policySeverityIdx >= cellSeverityIdx;
}
