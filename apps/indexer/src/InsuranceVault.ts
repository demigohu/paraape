import { ponder } from "ponder:registry";
import { lpPosition, market, policy } from "ponder:schema";
import { cellBacksPolicy, cellKey, lpPositionId } from "./lib/cell-keys";
import { syncVaultCell } from "./lib/vault-cell-sync";
import { logActivity } from "./lib/log-activity";
import { eq } from "ponder";

import { InsuranceVaultAbi } from "../abis/InsuranceVault";

async function tokenForVault(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  vault: `0x${string}`,
): Promise<`0x${string}`> {
  const row = await context.db.sql
    .select({ id: market.id })
    .from(market)
    .where(eq(market.vault, vault))
    .limit(1);

  if (row[0]?.id) return row[0].id;

  return context.client.readContract({
    address: vault,
    abi: InsuranceVaultAbi,
    functionName: "insuredToken",
  });
}

function policyKey(vault: `0x${string}`, policyId: bigint): string {
  return `${vault.toLowerCase()}-${policyId}`;
}

ponder.on("InsuranceVault:PolicyPurchased", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId, buyer, severityIdx, durationIdx, coverageUsdg, premiumUsdg } =
    event.args;
  const token = await tokenForVault(context, vault);
  const now = event.block.timestamp;

  await context.db.insert(policy).values({
    id: policyKey(vault, policyId),
    vault,
    token,
    policyId,
    buyer,
    severityIdx,
    durationIdx,
    coverageUsdg,
    premiumUsdg,
    status: "Active",
    purchasedAt: now,
    purchasedBlock: event.block.number,
    updatedAt: now,
  });

  for (let sev = 0; sev < 6; sev++) {
    if (!cellBacksPolicy(sev, severityIdx)) continue;
    await syncVaultCell(context, vault, token, cellKey(sev), now, event.block.number);
  }

  await logActivity(context, event, {
    kind: "policy_purchased",
    vault,
    token,
    actor: buyer,
    policyId,
    amountUsdg: premiumUsdg,
  });
});

ponder.on("InsuranceVault:CellDeposit", async ({ event, context }) => {
  const vault = event.log.address;
  const { lp, cellKey: key, assets, shares } = event.args;
  const token = await tokenForVault(context, vault);
  const now = event.block.timestamp;
  const posId = lpPositionId(vault, key, lp);

  const existing = await context.db.find(lpPosition, { id: posId });
  const nextShares = (existing?.shares ?? 0n) + shares;

  if (nextShares === 0n) {
    await context.db.delete(lpPosition, { id: posId });
  } else {
    await context.db
      .insert(lpPosition)
      .values({
        id: posId,
        vault,
        token,
        lp,
        cellKey: key,
        shares: nextShares,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        shares: nextShares,
        updatedAt: now,
      });
  }

  await syncVaultCell(context, vault, token, key, now, event.block.number);

  await logActivity(context, event, {
    kind: "cell_deposit",
    vault,
    token,
    actor: lp,
    cellKey: key,
    amountUsdg: assets,
  });
});

ponder.on("InsuranceVault:CellWithdraw", async ({ event, context }) => {
  const vault = event.log.address;
  const { lp, cellKey: key, assets, shares } = event.args;
  const token = await tokenForVault(context, vault);
  const now = event.block.timestamp;
  const posId = lpPositionId(vault, key, lp);

  const existing = await context.db.find(lpPosition, { id: posId });
  const nextShares = (existing?.shares ?? 0n) - shares;

  if (nextShares <= 0n) {
    await context.db.delete(lpPosition, { id: posId });
  } else {
    await context.db
      .insert(lpPosition)
      .values({
        id: posId,
        vault,
        token,
        lp,
        cellKey: key,
        shares: nextShares,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        shares: nextShares,
        updatedAt: now,
      });
  }

  await syncVaultCell(context, vault, token, key, now, event.block.number);

  await logActivity(context, event, {
    kind: "cell_withdraw",
    vault,
    token,
    actor: lp,
    cellKey: key,
    amountUsdg: assets,
  });
});

ponder.on("InsuranceVault:PolicySettled", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId, payout, challengeDeadline } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({
      status: "PendingPayout",
      payout,
      challengeDeadline,
      updatedAt: event.block.timestamp,
    });

  const row = await context.db.find(policy, { id: policyKey(vault, policyId) });
  await logActivity(context, event, {
    kind: "policy_settled",
    vault,
    token: row?.token ?? (await tokenForVault(context, vault)),
    actor: row?.buyer,
    policyId,
    amountUsdg: payout,
  });
});

ponder.on("InsuranceVault:ChallengeRejected", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId, challenger, fee } = event.args;
  const row = await context.db.find(policy, { id: policyKey(vault, policyId) });
  await logActivity(context, event, {
    kind: "policy_challenged",
    vault,
    token: row?.token ?? (await tokenForVault(context, vault)),
    actor: challenger,
    policyId,
    amountUsdg: fee,
  });
});

ponder.on("InsuranceVault:PolicyChallenged", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId, challenger } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Challenged", updatedAt: event.block.timestamp });

  const row = await context.db.find(policy, { id: policyKey(vault, policyId) });
  await logActivity(context, event, {
    kind: "policy_challenged",
    vault,
    token: row?.token ?? (await tokenForVault(context, vault)),
    actor: challenger,
    policyId,
  });
});

ponder.on("InsuranceVault:PolicyReleased", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId, payout } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Paid", payout, updatedAt: event.block.timestamp });

  const row = await context.db.find(policy, { id: policyKey(vault, policyId) });
  await logActivity(context, event, {
    kind: "policy_released",
    vault,
    token: row?.token ?? (await tokenForVault(context, vault)),
    policyId,
    amountUsdg: payout,
  });
});

ponder.on("InsuranceVault:PolicyVoided", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Void", updatedAt: event.block.timestamp });

  const row = await context.db.find(policy, { id: policyKey(vault, policyId) });
  await logActivity(context, event, {
    kind: "policy_voided",
    vault,
    token: row?.token ?? (await tokenForVault(context, vault)),
    policyId,
  });
});

ponder.on("InsuranceVault:PolicyExpired", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Expired", updatedAt: event.block.timestamp });

  const row = await context.db.find(policy, { id: policyKey(vault, policyId) });
  await logActivity(context, event, {
    kind: "policy_expired",
    vault,
    token: row?.token ?? (await tokenForVault(context, vault)),
    policyId,
  });
});

ponder.on("InsuranceVault:RecordBountyPaid", async ({ event, context }) => {
  const vault = event.log.address;
  const { recorder, amount } = event.args;
  const token = await tokenForVault(context, vault);
  await logActivity(context, event, {
    kind: "record_bounty",
    vault,
    token,
    actor: recorder,
    amountUsdg: amount,
  });
});
