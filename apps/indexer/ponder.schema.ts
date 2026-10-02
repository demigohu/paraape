import { index, onchainTable } from "ponder";

export const market = onchainTable(
  "market",
  (t) => ({
    /** Insured meme / token contract (paste-CA key) */
    id: t.hex().primaryKey(),
    vault: t.hex().notNull(),
    poolRef: t.hex().notNull(),
    tokenDeployer: t.hex().notNull(),
    launchpadCreator: t.hex().notNull(),
    factory: t.hex().notNull(),
    createdAt: t.bigint().notNull(),
    createdBlock: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    vaultIdx: index().on(table.vault),
    poolIdx: index().on(table.poolRef),
  }),
);

export const policy = onchainTable(
  "policy",
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    token: t.hex().notNull(),
    policyId: t.bigint().notNull(),
    buyer: t.hex().notNull(),
    severityIdx: t.integer().notNull(),
    windowIdx: t.integer().notNull(),
    coverageUsdg: t.bigint().notNull(),
    premiumUsdg: t.bigint().notNull(),
    status: t.text().notNull(),
    payout: t.bigint(),
    challengeDeadline: t.bigint(),
    purchasedAt: t.bigint().notNull(),
    purchasedBlock: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    vaultIdx: index().on(table.vault),
    tokenIdx: index().on(table.token),
    buyerIdx: index().on(table.buyer),
  }),
);

export const oraclePool = onchainTable("oracle_pool", (t) => ({
  id: t.hex().primaryKey(),
  lastIndex: t.integer().notNull(),
  lastTick: t.integer().notNull(),
  lastTimestamp: t.bigint().notNull(),
  lastBlockNumber: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
}));
