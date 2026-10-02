import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";

const configDir = dirname(fileURLToPath(import.meta.url));
for (const name of [".env", ".env.local"] as const) {
  const path = resolve(configDir, name);
  if (existsSync(path)) loadEnv({ path, override: name === ".env.local" });
}

import { InsuranceVaultAbi } from "./abis/InsuranceVault";
import { MarketFactoryAbi } from "./abis/MarketFactory";
import { PriceObserverAbi } from "./abis/PriceObserver";

const factoryAddress = (process.env.MARKET_FACTORY_ADDRESS ??
  process.env.FACTORY_ADDRESS) as `0x${string}` | undefined;
const observerAddress = process.env.PRICE_OBSERVER_ADDRESS as `0x${string}` | undefined;
const startBlockRaw =
  process.env.MARKET_FACTORY_START_BLOCK ?? process.env.MARKET_FACTORY_FROM_BLOCK;

if (!factoryAddress) {
  throw new Error(
    "MARKET_FACTORY_ADDRESS or FACTORY_ADDRESS is required (see .env.example)",
  );
}
if (!observerAddress) {
  throw new Error("PRICE_OBSERVER_ADDRESS is required (see .env.example)");
}
if (!startBlockRaw?.trim()) {
  throw new Error(
    "MARKET_FACTORY_START_BLOCK (or MARKET_FACTORY_FROM_BLOCK) is required — factory deploy block, decimal",
  );
}

const startBlock = Number(startBlockRaw.trim());
if (!Number.isFinite(startBlock) || startBlock < 0) {
  throw new Error(`Invalid MARKET_FACTORY_START_BLOCK: ${startBlockRaw}`);
}

const rpc =
  process.env.PONDER_RPC_URL_46630 ??
  process.env.ROBINHOOD_TESTNET_RPC_URL ??
  process.env.PONDER_RPC_URL;

if (!rpc) {
  throw new Error(
    "Set PONDER_RPC_URL_46630 or ROBINHOOD_TESTNET_RPC_URL for chain 46630",
  );
}

export default createConfig({
  chains: {
    robinhood: {
      id: 46630,
      rpc,
    },
  },
  contracts: {
    MarketFactory: {
      chain: "robinhood",
      abi: MarketFactoryAbi,
      address: factoryAddress,
      startBlock,
    },
    InsuranceVault: {
      chain: "robinhood",
      abi: InsuranceVaultAbi,
      address: factory({
        address: factoryAddress,
        event: parseAbiItem(
          "event MarketCreated(address indexed token, address indexed vault, bytes32 poolRef, address tokenDeployer, address launchpadCreator)",
        ),
        parameter: "vault",
      }),
      startBlock,
    },
    PriceObserver: {
      chain: "robinhood",
      abi: PriceObserverAbi,
      address: observerAddress,
      startBlock,
    },
  },
});
