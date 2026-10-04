import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cookieStorage, createStorage, type Config } from "@wagmi/core";
import { robinhoodAppKitNetwork } from "@/lib/chains";
import { REOWN_PROJECT_ID } from "@/lib/env";

export const networks = [robinhoodAppKitNetwork];

/** Reown requires a project id from https://dashboard.reown.com */
export const reownProjectId =
  REOWN_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: reownProjectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig as Config;
