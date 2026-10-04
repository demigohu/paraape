import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type WriteContractParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deploySwapRouter } from "./deploy-router.ts";
import {
  demoPoolKey,
  MAX_SQRT_PRICE,
  memeIsCurrency0,
  MIN_SQRT_PRICE,
  poolRefFromKey,
  type DemoPoolKey,
} from "./pool-key.ts";
import { erc20Abi, priceObserverAbi, v4SwapRouterAbi } from "./abi.ts";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function envOr(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fresh nonce — required when keeper / another bot shares the same wallet. */
async function pendingNonce(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address,
): Promise<number> {
  return publicClient.getTransactionCount({ address, blockTag: "pending" });
}

function isNonceTooLow(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /nonce too low|Nonce provided for the transaction is lower/i.test(msg);
}

/** Retry when keeper (same wallet) lands a tx between nonce read and broadcast. */
async function writeContractRetry(
  client: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  sender: Address,
  params: WriteContractParameters,
): Promise<Hex> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Wallet client already has a chain. Passing `chain` back in widens the overload to Chain | null.
      return await client.writeContract({
        ...params,
        chain: null,
        nonce: await pendingNonce(publicClient, sender),
      });
    } catch (err) {
      lastErr = err;
      if (!isNonceTooLow(err) || attempt === 4) throw err;
      await sleep(400 + attempt * 200);
    }
  }
  throw lastErr;
}

function memeAmountForUsdgNotional(usdgAmount: bigint): bigint {
  return usdgAmount * 1_000_000_000_000n;
}

async function ensureAllowance(
  client: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  token: Address,
  spender: Address,
  account: Address,
) {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
  }).catch(() => 0n);
  if (allowance > 2n ** 200n) return;
  const hash = await writeContractRetry(client, publicClient, account, {
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, 2n ** 256n - 1n],
    chain: client.chain,
    account: client.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function swapExactUsdgForMeme(
  client: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  router: Address,
  key: DemoPoolKey,
  memeIsC0: boolean,
  usdgAmount: bigint,
  sender: Address,
) {
  const zeroForOne = !memeIsC0;
  const limit = zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n;
  const hash = await writeContractRetry(client, publicClient, sender, {
    address: router,
    abi: v4SwapRouterAbi,
    functionName: "swap",
    args: [
      key,
      { zeroForOne, amountSpecified: -usdgAmount, sqrtPriceLimitX96: limit },
    ],
    chain: client.chain,
    account: client.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function swapExactMemeForUsdg(
  client: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  router: Address,
  key: DemoPoolKey,
  memeIsC0: boolean,
  meme: Address,
  holder: Address,
  usdgNotional: bigint,
) {
  const zeroForOne = memeIsC0;
  let amountIn = memeAmountForUsdgNotional(usdgNotional);
  const bal = await publicClient.readContract({
    address: meme,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [holder],
  });
  if (amountIn > bal) amountIn = bal / 4n;
  if (amountIn === 0n) amountIn = bal > 0n ? bal / 100n : 10n ** 15n;

  const limit = zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n;
  const hash = await writeContractRetry(client, publicClient, holder, {
    address: router,
    abi: v4SwapRouterAbi,
    functionName: "swap",
    args: [
      key,
      { zeroForOne, amountSpecified: -amountIn, sqrtPriceLimitX96: limit },
    ],
    chain: client.chain,
    account: client.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function tryRecord(
  client: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  observer: Address,
  poolRef: Hex,
  sender: Address,
) {
  try {
    const hash = await writeContractRetry(client, publicClient, sender, {
      address: observer,
      abi: priceObserverAbi,
      functionName: "record",
      args: [poolRef],
      chain: client.chain,
      account: client.account!,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[demo-swap] record ok tx=${hash} block=${receipt.blockNumber}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[demo-swap] record skipped: ${msg.slice(0, 120)}`);
  }
}

async function main() {
  const rpcUrl = requireEnv("ROBINHOOD_TESTNET_RPC_URL");
  const pk = requireEnv("PRIVATE_KEY") as Hex;
  const usdg = requireEnv("USDG_ADDRESS") as Address;
  const meme = requireEnv("DEMO_MEME_ADDRESS") as Address;
  const chainId = Number(envOr("CHAIN_ID", "46630"));
  const swapCount = Number(envOr("SIM_SWAP_COUNT", "12"));
  const usdgPerSwap = BigInt(envOr("SIM_USDG_PER_SWAP", "500000"));
  const recordAfter = envOr("SIM_RECORD_AFTER_SWAP", "0") !== "0";
  const buyOnly = envOr("SIM_BUY_ONLY", "0") !== "0";
  const sellOnly = envOr("SIM_SELL_ONLY", "0") !== "0";
  if (buyOnly && sellOnly) throw new Error("Set only one of SIM_BUY_ONLY or SIM_SELL_ONLY");
  const sleepMs = Number(envOr("SIM_SLEEP_MS", "5000"));
  const observer = process.env.PRICE_OBSERVER_ADDRESS?.trim() as Address | undefined;

  let router = process.env.V4_SWAP_ROUTER_ADDRESS?.trim() as Address | undefined;
  const deployFlag = envOr("DEPLOY_SWAP_ROUTER", "0") === "1";

  const chain = {
    id: chainId,
    name: "Robinhood Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  if (!router) {
    if (!deployFlag) {
      throw new Error(
        "Set V4_SWAP_ROUTER_ADDRESS or DEPLOY_SWAP_ROUTER=1 + POOL_MANAGER_ADDRESS",
      );
    }
    const poolManager = requireEnv("POOL_MANAGER_ADDRESS") as Address;
    console.log("[demo-swap] deploying V4SwapRouter…");
    router = await deploySwapRouter(publicClient, walletClient, poolManager);
    console.log(`[demo-swap] V4_SWAP_ROUTER_ADDRESS=${router}`);
  }

  const key = demoPoolKey(meme, usdg);
  const poolRef = poolRefFromKey(key);
  const memeIsC0 = memeIsCurrency0(meme, key);

  console.log(`[demo-swap] poolRef=${poolRef}`);
  console.log(
    `[demo-swap] memeIsCurrency0=${memeIsC0} swaps=${swapCount} usdgPerSwap=${usdgPerSwap} buyOnly=${buyOnly} sellOnly=${sellOnly}`,
  );
  if (sellOnly) {
    console.warn(
      "[demo-swap] sell-only dumps the meme. Use the deployer key, not the policy buyer — settle reverts if the buyer sells the bag.",
    );
  } else if (!buyOnly) {
    console.warn(
      "[demo-swap] PAPE→USDG legs crash thin demo LP — Protect USD labels will drop. Use SIM_BUY_ONLY=1 for vol without nuking price.",
    );
  }

  await ensureAllowance(walletClient, publicClient, usdg, router, account.address);
  await ensureAllowance(walletClient, publicClient, meme, router, account.address);

  for (let i = 0; i < swapCount; i++) {
    const dumpPape = sellOnly ? false : buyOnly || i % 2 === 0;
    const hash = dumpPape
      ? await swapExactUsdgForMeme(
          walletClient,
          publicClient,
          router,
          key,
          memeIsC0,
          usdgPerSwap,
          account.address,
        )
      : await swapExactMemeForUsdg(
          walletClient,
          publicClient,
          router,
          key,
          memeIsC0,
          meme,
          account.address,
          usdgPerSwap,
        );

    console.log(`[demo-swap] swap ${i} ${dumpPape ? "USDG→PAPE" : "PAPE→USDG"} tx=${hash}`);

    if (recordAfter && observer) {
      if (sleepMs > 0) {
        console.log(
          `[demo-swap] sleep ${sleepMs}ms before record (PriceObserver minRecordInterval ~30s)…`,
        );
        await sleep(sleepMs);
      }
      await tryRecord(walletClient, publicClient, observer, poolRef, account.address);
    } else if (sleepMs > 0 && i + 1 < swapCount) {
      console.log(`[demo-swap] sleep ${sleepMs}ms before next swap…`);
      await sleep(sleepMs);
    }
  }

  console.log(
    "[demo-swap] done — keeper handles PriceObserver.record; refresh Protect when TWAP updates",
  );
}

main().catch((e) => {
  console.error("[demo-swap] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
