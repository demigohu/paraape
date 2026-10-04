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
    durationIdx: t.integer().notNull(),
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

/** Latest on-chain RiskCell snapshot per vault + cellKey (synced on LP events). */
export const vaultCell = onchainTable(
  "vault_cell",
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    token: t.hex().notNull(),
    cellKey: t.hex().notNull(),
    totalAssets: t.bigint().notNull(),
    lockedAssets: t.bigint().notNull(),
    totalShares: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    vaultIdx: index().on(table.vault),
    tokenIdx: index().on(table.token),
  }),
);

/** Net LP shares per vault cell (deposit − withdraw). */
/** Wallet-scoped activity feed (vault events). */
export const activity = onchainTable(
  "activity",
  (t) => ({
    id: t.text().primaryKey(),
    kind: t.text().notNull(),
    vault: t.hex().notNull(),
    token: t.hex().notNull(),
    actor: t.hex(),
    policyId: t.bigint(),
    cellKey: t.hex(),
    amountUsdg: t.bigint(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    actorIdx: index().on(table.actor),
    vaultIdx: index().on(table.vault),
    timeIdx: index().on(table.timestamp),
  }),
);

export const lpPosition = onchainTable(
  "lp_position",
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    token: t.hex().notNull(),
    lp: t.hex().notNull(),
    cellKey: t.hex().notNull(),
    shares: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    lpIdx: index().on(table.lp),
    vaultIdx: index().on(table.vault),
    tokenIdx: index().on(table.token),
  }),
);
