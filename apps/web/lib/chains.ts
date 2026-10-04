import { defineChain } from "@reown/appkit/networks";

/** Same-origin proxy. `ROBINHOOD_TESTNET_RPC_URL` is read only by `app/api/rpc`. */
export function robinhoodRpcUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc`;
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000/api/rpc";
  }
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://paraape.xyz";
  return `${app}/api/rpc`;
}

const rpc = robinhoodRpcUrl();

/** Robinhood Chain testnet — chain ID 46630 (Reown AppKit + wagmi). */
export const robinhoodAppKitNetwork = defineChain({
  id: 46630,
  caipNetworkId: "eip155:46630",
  chainNamespace: "eip155",
  name: "Robinhood Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

export const robinhoodRpc = rpc;

/** @deprecated use robinhoodAppKitNetwork.id */
export const robinhoodTestnet = robinhoodAppKitNetwork;
