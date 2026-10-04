import { vaultCell } from "ponder:schema";

import { InsuranceVaultAbi } from "../../abis/InsuranceVault";
import { vaultCellId } from "./cell-keys";

/** Refresh vault_cell from chain after LP or policy liquidity changes. */
export async function syncVaultCell(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  vault: `0x${string}`,
  token: `0x${string}`,
  cellKey: `0x${string}`,
  timestamp: bigint,
  blockNumber: bigint,
): Promise<void> {
  const cell = await context.client.readContract({
    address: vault,
    abi: InsuranceVaultAbi,
    functionName: "cells",
    args: [cellKey],
  });

  const id = vaultCellId(vault, cellKey);
  const totalAssets = cell[0];
  const lockedAssets = cell[1];
  const totalShares = cell[2];

  if (totalAssets === 0n && totalShares === 0n) {
    await context.db.delete(vaultCell, { id }).catch(() => undefined);
    return;
  }

  await context.db
    .insert(vaultCell)
    .values({
      id,
      vault,
      token,
      cellKey,
      totalAssets,
      lockedAssets,
      totalShares,
      updatedAt: timestamp,
      updatedBlock: blockNumber,
    })
    .onConflictDoUpdate({
      totalAssets,
      lockedAssets,
      totalShares,
      updatedAt: timestamp,
      updatedBlock: blockNumber,
    });
}
