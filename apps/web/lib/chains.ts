import { defineChain } from "@reown/appkit/networks";

const rpc =
  process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL?.trim() ||
  "https://rpc.testnet.robinhood.com";

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
