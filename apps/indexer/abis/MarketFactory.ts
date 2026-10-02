import { parseAbi } from "viem";

export const MarketFactoryAbi = parseAbi([
  "event MarketCreated(address indexed token, address indexed vault, bytes32 poolRef, address tokenDeployer, address launchpadCreator)",
  "event LockAdapterSet(address indexed adapter, bool allowed)",
  "event GuardianUpdated(address indexed guardian)",
  "event ConfigUpdated()",
  "function vaultByToken(address token) view returns (address vault)",
]);
