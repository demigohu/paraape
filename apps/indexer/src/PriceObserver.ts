import { ponder } from "ponder:registry";
import { oraclePool } from "ponder:schema";

ponder.on("PriceObserver:Recorded", async ({ event, context }) => {
  const { poolRef, index, tick, timestamp, blockNumber } = event.args;

  await context.db
    .insert(oraclePool)
    .values({
      id: poolRef,
      lastIndex: index,
      lastTick: tick,
      lastTimestamp: BigInt(timestamp),
      lastBlockNumber: BigInt(blockNumber),
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      lastIndex: index,
      lastTick: tick,
      lastTimestamp: BigInt(timestamp),
      lastBlockNumber: BigInt(blockNumber),
      updatedAt: event.block.timestamp,
    }));
});
