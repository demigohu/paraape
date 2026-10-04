import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Address, Hex, PublicClient, WalletClient } from "viem";

type ForgeArtifact = {
  abi: unknown;
  bytecode: { object: Hex };
};

/** Deploy `V4SwapRouter` using Foundry artifact (run `forge build` in contracts-solidity first). */
export async function deploySwapRouter(
  publicClient: PublicClient,
  walletClient: WalletClient,
  poolManager: Address,
): Promise<Address> {
  const artifactPath = resolve(
    import.meta.dirname,
    "../../contracts-solidity/out/V4SwapRouter.sol/V4SwapRouter.json",
  );
  const raw = readFileSync(artifactPath, "utf8");
  const artifact = JSON.parse(raw) as ForgeArtifact;
  const hash = await walletClient.deployContract({
    abi: artifact.abi as [],
    bytecode: artifact.bytecode.object,
    args: [poolManager],
    chain: walletClient.chain,
    account: walletClient.account!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("Swap router deploy failed — no contract address");
  }
  return receipt.contractAddress;
}
