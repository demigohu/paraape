"use client";

import { createAppKit } from "@reown/appkit/react";
import { reownProjectId, wagmiAdapter } from "@/config/reown-wagmi";
import { robinhoodAppKitNetwork, robinhoodRpc } from "@/lib/chains";
import { APP_URL } from "@/lib/env";

createAppKit({
  adapters: [wagmiAdapter],
  projectId: reownProjectId,
  networks: [robinhoodAppKitNetwork],
  defaultNetwork: robinhoodAppKitNetwork,
  metadata: {
    name: "Paraape",
    description: "Rug-pull protection on Robinhood Chain memecoins",
    url: APP_URL,
    icons: [`${APP_URL}/paraape_logo.png`],
  },
  customRpcUrls: {
    "eip155:46630": [{ url: robinhoodRpc }],
  },
  themeVariables: {
    "--w3m-accent": "#ff641c",
    "--w3m-border-radius-master": "0px",
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
  enableCoinbase: false,
  enableBaseAccount: false,
});
