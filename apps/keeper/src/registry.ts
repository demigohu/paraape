import type { Address, Hex } from "viem";

export type MarketRegistry = {
  /** All pool IDs that need oracle samples (insured + quote pools) */
  pools: Set<Hex>;
  vaults: Set<Address>;
  /** Insured poolRef per vault — vault.recordPool already calls observer.record */
  vaultLinkedPools: Set<Hex>;
};

export function createRegistry(initialPools: Hex[], initialVaults: Address[]): MarketRegistry {
  return {
    pools: new Set(initialPools),
    vaults: new Set(initialVaults),
    vaultLinkedPools: new Set(),
  };
}

export function subscribeMarket(reg: MarketRegistry, poolRef: Hex, vault: Address): boolean {
  const newPool = !reg.pools.has(poolRef);
  reg.pools.add(poolRef);
  reg.vaults.add(vault);
  reg.vaultLinkedPools.add(poolRef);
  return newPool;
}

export function subscribePool(reg: MarketRegistry, poolRef: Hex): boolean {
  if (reg.pools.has(poolRef)) return false;
  reg.pools.add(poolRef);
  return true;
}

/** Direct observer.record targets (excludes pools already covered by vault.recordPool) */
export function observerRecordPools(reg: MarketRegistry): Hex[] {
  return [...reg.pools].filter((p) => !reg.vaultLinkedPools.has(p));
}
