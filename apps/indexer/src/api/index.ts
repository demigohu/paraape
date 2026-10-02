import { db } from "ponder:api";
import schema, { market, oraclePool, policy } from "ponder:schema";
import { eq } from "ponder";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

/** All insured markets — web list + keeper sync */
app.get("/markets", async (c) => {
  const rows = await db.select().from(market).orderBy(market.createdAt);
  return c.json({
    chainId: 46630,
    markets: rows.map((m) => ({
      token: m.id,
      vault: m.vault,
      poolRef: m.poolRef,
      tokenDeployer: m.tokenDeployer,
      launchpadCreator: m.launchpadCreator,
      createdAt: m.createdAt.toString(),
      createdBlock: m.createdBlock.toString(),
    })),
  });
});

/** Paste-CA lookup */
app.get("/markets/token/:address", async (c) => {
  const raw = c.req.param("address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return c.json({ error: "invalid token address" }, 400);
  }
  const id = raw.toLowerCase() as `0x${string}`;
  const rows = await db.select().from(market).where(eq(market.id, id)).limit(1);
  const m = rows[0];
  if (!m) return c.json({ error: "market not found" }, 404);

  const policies = await db.select().from(policy).where(eq(policy.token, m.id));

  const pool = await db.select().from(oraclePool).where(eq(oraclePool.id, m.poolRef)).limit(1);

  return c.json({
    market: {
      token: m.id,
      vault: m.vault,
      poolRef: m.poolRef,
      tokenDeployer: m.tokenDeployer,
      launchpadCreator: m.launchpadCreator,
      createdAt: m.createdAt.toString(),
      createdBlock: m.createdBlock.toString(),
    },
    policies: policies.map((p) => ({
      id: p.id,
      policyId: p.policyId.toString(),
      buyer: p.buyer,
      status: p.status,
      coverageUsdg: p.coverageUsdg.toString(),
      premiumUsdg: p.premiumUsdg.toString(),
    })),
    oracle: pool[0]
      ? {
          poolRef: pool[0].id,
          cardinality: pool[0].lastIndex + 1,
          lastTick: pool[0].lastTick,
          lastTimestamp: pool[0].lastTimestamp.toString(),
        }
      : null,
  });
});

/** Keeper-friendly: unique pool refs + vault addresses */
app.get("/keeper/targets", async (c) => {
  const rows = await db.select().from(market);
  const oracleRows = await db.select({ id: oraclePool.id }).from(oraclePool);
  const envExtra = process.env.KEEPER_EXTRA_POOL_REFS?.split(",").map((s) => s.trim()) ?? [];
  const pools = [
    ...new Set([
      ...rows.map((m) => m.poolRef),
      ...oracleRows.map((o) => o.id),
      ...envExtra.filter((s) => /^0x[0-9a-fA-F]{64}$/.test(s)),
    ]),
  ];
  const vaults = rows.map((m) => m.vault);
  return c.json({
    chainId: 46630,
    poolRefs: pools,
    vaultAddresses: vaults,
    markets: rows.map((m) => ({
      token: m.id,
      vault: m.vault,
      poolRef: m.poolRef,
    })),
  });
});

export default app;
