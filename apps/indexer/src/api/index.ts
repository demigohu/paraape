import { db } from "ponder:api";
import schema, { activity, lpPosition, market, oraclePool, policy, vaultCell } from "ponder:schema";
import { desc, eq, inArray, or } from "ponder";
import { indicesForCellKey } from "../lib/cell-keys";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/*", cors());

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

  const cellRows = await db.select().from(vaultCell).where(eq(vaultCell.vault, m.vault));
  const cells = cellRows.map((c) => {
    const idx = indicesForCellKey(c.cellKey);
    return {
      cellKey: c.cellKey,
      severityIdx: idx?.severityIdx ?? null,
      windowIdx: null,
      totalAssets: c.totalAssets.toString(),
      lockedAssets: c.lockedAssets.toString(),
      totalShares: c.totalShares.toString(),
      freeAssets: (c.totalAssets - c.lockedAssets).toString(),
    };
  });

  const vaultTvl = cellRows.reduce((s, c) => s + c.totalAssets, 0n);
  const lockedTvl = cellRows.reduce((s, c) => s + c.lockedAssets, 0n);

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
    vaultTvl: vaultTvl.toString(),
    lockedTvl: lockedTvl.toString(),
    cells,
  });
});

/** LP positions for a wallet (dashboard). */
app.get("/lp/:address", async (c) => {
  const raw = c.req.param("address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return c.json({ error: "invalid address" }, 400);
  }
  const lp = raw.toLowerCase() as `0x${string}`;
  const rows = await db.select().from(lpPosition).where(eq(lpPosition.lp, lp));

  const positions = await Promise.all(
    rows.map(async (row) => {
      const idx = indicesForCellKey(row.cellKey);
      const cell = await db
        .select()
        .from(vaultCell)
        .where(eq(vaultCell.id, `${row.vault.toLowerCase()}-${row.cellKey.toLowerCase()}`))
        .limit(1);
      const snap = cell[0];
      const totalShares = snap?.totalShares ?? 0n;
      const totalAssets = snap?.totalAssets ?? 0n;
      const lockedAssets = snap?.lockedAssets ?? 0n;
      const assetShare =
        totalShares > 0n ? (row.shares * totalAssets) / totalShares : 0n;
      const lockedShare =
        totalShares > 0n ? (row.shares * lockedAssets) / totalShares : 0n;

      return {
        id: row.id,
        vault: row.vault,
        token: row.token,
        cellKey: row.cellKey,
        severityIdx: idx?.severityIdx ?? null,
        windowIdx: null,
        shares: row.shares.toString(),
        depositedUsdg: assetShare.toString(),
        lockedUsdg: lockedShare.toString(),
        freeUsdg: (assetShare - lockedShare).toString(),
        updatedAt: row.updatedAt.toString(),
      };
    }),
  );

  return c.json({ chainId: 46630, positions });
});

/** Policies for a buyer wallet (dashboard) */
app.get("/policies/buyer/:address", async (c) => {
  const raw = c.req.param("address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return c.json({ error: "invalid address" }, 400);
  }
  const buyer = raw.toLowerCase() as `0x${string}`;
  const rows = await db.select().from(policy).where(eq(policy.buyer, buyer));
  return c.json({
    chainId: 46630,
    policies: rows.map((p) => ({
      id: p.id,
      vault: p.vault,
      token: p.token,
      buyer: p.buyer,
      policyId: p.policyId.toString(),
      severityIdx: p.severityIdx,
      durationIdx: p.durationIdx,
      windowIdx: null,
      coverageUsdg: p.coverageUsdg.toString(),
      premiumUsdg: p.premiumUsdg.toString(),
      status: p.status,
      payout: p.payout?.toString(),
      challengeDeadline: p.challengeDeadline?.toString(),
      purchasedAt: p.purchasedAt.toString(),
    })),
  });
});

/** Recent vault activity for a wallet (buyer, LP, challenger, recorder). */
app.get("/activity/wallet/:address", async (c) => {
  const raw = c.req.param("address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return c.json({ error: "invalid address" }, 400);
  }
  const wallet = raw.toLowerCase() as `0x${string}`;
  const owned = await db.select({ policyId: policy.policyId }).from(policy).where(eq(policy.buyer, wallet));
  const policyIds = owned.map((p) => p.policyId);

  const rows = await db
    .select()
    .from(activity)
    .where(
      policyIds.length > 0
        ? or(eq(activity.actor, wallet), inArray(activity.policyId, policyIds))
        : eq(activity.actor, wallet),
    )
    .orderBy(desc(activity.timestamp))
    .limit(40);

  return c.json({
    chainId: 46630,
    activities: rows.map((a) => ({
      id: a.id,
      kind: a.kind,
      vault: a.vault,
      token: a.token,
      policyId: a.policyId?.toString(),
      cellKey: a.cellKey,
      amountUsdg: a.amountUsdg?.toString(),
      timestamp: a.timestamp.toString(),
      txHash: a.txHash,
    })),
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
