import { ponder } from "ponder:registry";
import { market, policy } from "ponder:schema";
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
  const { policyId, buyer, severityIdx, windowIdx, coverageUsdg, premiumUsdg } =
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
    windowIdx,
    coverageUsdg,
    premiumUsdg,
    status: "Active",
    purchasedAt: now,
    purchasedBlock: event.block.number,
    updatedAt: now,
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
});

ponder.on("InsuranceVault:PolicyChallenged", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Challenged", updatedAt: event.block.timestamp });
});

ponder.on("InsuranceVault:PolicyReleased", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId, payout } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Paid", payout, updatedAt: event.block.timestamp });
});

ponder.on("InsuranceVault:PolicyVoided", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Void", updatedAt: event.block.timestamp });
});

ponder.on("InsuranceVault:PolicyExpired", async ({ event, context }) => {
  const vault = event.log.address;
  const { policyId } = event.args;

  await context.db
    .update(policy, { id: policyKey(vault, policyId) })
    .set({ status: "Expired", updatedAt: event.block.timestamp });
});
