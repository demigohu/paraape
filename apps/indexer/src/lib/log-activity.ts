import { activity } from "ponder:schema";

type ActivityKind =
  | "policy_purchased"
  | "cell_deposit"
  | "cell_withdraw"
  | "policy_settled"
  | "policy_challenged"
  | "policy_released"
  | "policy_voided"
  | "policy_expired"
  | "record_bounty";

export async function logActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  event: {
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}` };
    log: { logIndex: number };
  },
  row: {
    kind: ActivityKind;
    vault: `0x${string}`;
    token: `0x${string}`;
    actor?: `0x${string}`;
    policyId?: bigint;
    cellKey?: `0x${string}`;
    amountUsdg?: bigint;
  },
) {
  const id = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(activity).values({
    id,
    kind: row.kind,
    vault: row.vault,
    token: row.token,
    actor: row.actor ?? null,
    policyId: row.policyId ?? null,
    cellKey: row.cellKey ?? null,
    amountUsdg: row.amountUsdg ?? null,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
}
