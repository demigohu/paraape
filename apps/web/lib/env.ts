import type { Address } from "viem";

/** Browser uses same-origin proxy; override with NEXT_PUBLIC_INDEXER_URL if needed. */
export const INDEXER_URL = (
  process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/$/, "") || "/api/indexer"
).replace(/\/$/, "");

export const USDG_ADDRESS = (process.env.NEXT_PUBLIC_USDG_ADDRESS ?? "0x") as Address;

/** Current testnet demo tokens. Override after a new DeployDemoMarket / DeployMemePool. */
export const PAPE_ADDRESS = (process.env.NEXT_PUBLIC_PAPE_ADDRESS ??
  "0x1a01888A1E8a5483EbdA9a5bc0A853d9F1DD7C0b") as Address;

export const FRESH_ADDRESS = (process.env.NEXT_PUBLIC_FRESH_ADDRESS ??
  "0x2cEf7707f0e87BA1010259AEe3A12FD0c88E35C1") as Address;

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x") as Address;

export const LOCKER_ADDRESS = (process.env.NEXT_PUBLIC_LOCKER_ADDRESS ?? "0x") as Address;

export const POOL_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_POOL_MANAGER_ADDRESS ?? "0x") as Address;

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/** Reown / WalletConnect Cloud project id — https://dashboard.reown.com */
export const REOWN_PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
  "";

/** @deprecated use REOWN_PROJECT_ID */
export const WALLETCONNECT_PROJECT_ID = REOWN_PROJECT_ID;
