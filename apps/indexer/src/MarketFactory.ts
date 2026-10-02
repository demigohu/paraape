import { ponder } from "ponder:registry";
import { market } from "ponder:schema";

ponder.on("MarketFactory:MarketCreated", async ({ event, context }) => {
  const { token, vault, poolRef, tokenDeployer, launchpadCreator } = event.args;

  const tokenId = token.toLowerCase() as typeof token;

  await context.db.insert(market).values({
    id: tokenId,
    vault,
    poolRef,
    tokenDeployer,
    launchpadCreator,
    factory: event.log.address,
    createdAt: event.block.timestamp,
    createdBlock: event.block.number,
    txHash: event.transaction.hash,
  });
});
