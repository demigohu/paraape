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
  memeRawForUsdgRaw,
  MIN_SQRT_PRICE,
  poolRefFromKey,
  poolStateSlot,
  sqrtPriceX96FromSlot0,
  type DemoPoolKey,
} from "./pool-key.ts";
import { erc20Abi, poolManagerAbi, priceObserverAbi, v4SwapRouterAbi } from "./abi.ts";

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

function formatUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = (amount % base).toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${frac}`;
}

async function readSqrtPriceX96(
  publicClient: ReturnType<typeof createPublicClient>,
  poolManager: Address,
  poolRef: Hex,
): Promise<bigint> {
  const data = await publicClient.readContract({
    address: poolManager,
    abi: poolManagerAbi,
    functionName: "extsload",
    args: [poolStateSlot(poolRef)],
  });
  return sqrtPriceX96FromSlot0(data);
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
  holder: Address,
  memeAmount: bigint,
) {
  const zeroForOne = memeIsC0;
  const amountIn = memeAmount;
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

type Trader = {
  label: string;
  meme: Address;
  memeDecimals: number;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
  key: DemoPoolKey;
  poolRef: Hex;
  memeIsC0: boolean;
  buying: boolean;
  legUntil: number;
};

async function main() {
  const rpcUrl = requireEnv("ROBINHOOD_TESTNET_RPC_URL");
  const usdg = requireEnv("USDG_ADDRESS") as Address;
  const chainId = Number(envOr("CHAIN_ID", "46630"));
  const swapCount = Number(envOr("SIM_SWAP_COUNT", "0"));
  const continuous = envOr("SIM_CONTINUOUS", swapCount === 0 ? "1" : "0") === "1";
  const usdgPerSwap = BigInt(envOr("SIM_USDG_PER_SWAP", "500000"));
  const recordAfter = envOr("SIM_RECORD_AFTER_SWAP", "0") !== "0";
  const buyOnly = envOr("SIM_BUY_ONLY", "0") !== "0";
  const sellOnly = envOr("SIM_SELL_ONLY", "0") !== "0";
  if (buyOnly && sellOnly) throw new Error("Set only one of SIM_BUY_ONLY or SIM_SELL_ONLY");
  const sleepMs = Number(envOr("SIM_SLEEP_MS", "5000"));
  // Keeper samples about every 35s. A round trip faster than that lands flat, so vol stays low and premium sits on the floor.
  const legMs = Number(envOr("SIM_LEG_MS", "120000"));
  const observer = process.env.PRICE_OBSERVER_ADDRESS?.trim() as Address | undefined;
  const poolManager = requireEnv("POOL_MANAGER_ADDRESS") as Address;

  let router = process.env.V4_SWAP_ROUTER_ADDRESS?.trim() as Address | undefined;
  const deployFlag = envOr("DEPLOY_SWAP_ROUTER", "0") === "1";

  const chain = {
    id: chainId,
    name: "Robinhood Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const specs: { label: string; memeEnv: string; keyEnv: string }[] = [
    { label: "market-1", memeEnv: "DEMO_MEME_ADDRESS", keyEnv: "PRIVATE_KEY" },
  ];
  if (process.env.DEMO_MEME_ADDRESS_2?.trim()) {
    specs.push({
      label: "market-2",
      memeEnv: "DEMO_MEME_ADDRESS_2",
      keyEnv: process.env.PRIVATE_KEY_2?.trim() ? "PRIVATE_KEY_2" : "PRIVATE_KEY",
    });
    if (!process.env.PRIVATE_KEY_2?.trim()) {
      console.warn(
        "[demo-swap] PRIVATE_KEY_2 is empty, so both markets share PRIVATE_KEY. Put a second key in PRIVATE_KEY_2.",
      );
    }
  }

  const usdgDecimals = Number(
    await publicClient.readContract({
      address: usdg,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  );

  const traders: Trader[] = [];
  let deployWallet: ReturnType<typeof createWalletClient> | undefined;

  for (const spec of specs) {
    const meme = requireEnv(spec.memeEnv) as Address;
    const account = privateKeyToAccount(requireEnv(spec.keyEnv) as Hex);
    const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
    deployWallet ??= wallet;
    const key = demoPoolKey(meme, usdg);
    const symbol = await publicClient
      .readContract({ address: meme, abi: erc20Abi, functionName: "symbol" })
      .catch(() => spec.label);
    const memeDecimals = Number(
      await publicClient.readContract({
        address: meme,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    );
    const staggeredSell = traders.length % 2 === 1;
    traders.push({
      label: symbol,
      meme,
      memeDecimals,
      account,
      wallet,
      key,
      poolRef: poolRefFromKey(key),
      memeIsC0: memeIsCurrency0(meme, key),
      buying: sellOnly ? false : buyOnly ? true : !staggeredSell,
      legUntil: Date.now() + legMs,
    });
  }

  if (!router) {
    if (!deployFlag || !deployWallet) {
      throw new Error(
        "Set V4_SWAP_ROUTER_ADDRESS or DEPLOY_SWAP_ROUTER=1 + POOL_MANAGER_ADDRESS",
      );
    }
    console.log("[demo-swap] deploying V4SwapRouter…");
    router = await deploySwapRouter(publicClient, deployWallet, poolManager);
    console.log(`[demo-swap] V4_SWAP_ROUTER_ADDRESS=${router}`);
  }

  console.log(
    `[demo-swap] markets=${traders.map((t) => t.label).join(",")} usdgPerSwap=${formatUnits(usdgPerSwap, usdgDecimals)} USDG continuous=${continuous} legMs=${legMs} buyOnly=${buyOnly} sellOnly=${sellOnly}`,
  );
  if (sellOnly) {
    console.warn(
      "[demo-swap] sell-only walks the price down. Do not sell from a wallet that holds an active policy.",
    );
  }

  for (const trader of traders) {
    console.log(
      `[demo-swap] ${trader.label} wallet=${trader.account.address} poolRef=${trader.poolRef}`,
    );
    await ensureAllowance(
      trader.wallet,
      publicClient,
      usdg,
      router,
      trader.account.address,
    );
    await ensureAllowance(
      trader.wallet,
      publicClient,
      trader.meme,
      router,
      trader.account.address,
    );
  }

  let stop = false;
  process.on("SIGINT", () => {
    stop = true;
    console.log("[demo-swap] stopping after the current swap");
  });

  for (let i = 0; continuous ? !stop : i < swapCount && !stop; i++) {
    const trader = traders[i % traders.length]!;
    if (!buyOnly && !sellOnly && Date.now() >= trader.legUntil) {
      trader.buying = !trader.buying;
      trader.legUntil = Date.now() + legMs;
      console.log(
        `[demo-swap] ${trader.label} ${trader.buying ? "buy" : "sell"} leg for ${legMs}ms`,
      );
    }
    const buy = sellOnly ? false : buyOnly || trader.buying;

    try {
      if (buy) {
        const hash = await swapExactUsdgForMeme(
          trader.wallet,
          publicClient,
          router,
          trader.key,
          trader.memeIsC0,
          usdgPerSwap,
          trader.account.address,
        );
        console.log(
          `[demo-swap] ${trader.label} buy ${formatUnits(usdgPerSwap, usdgDecimals)} USDG tx=${hash}`,
        );
      } else {
        const sqrtPriceX96 = await readSqrtPriceX96(
          publicClient,
          poolManager,
          trader.poolRef,
        );
        const memeIn = memeRawForUsdgRaw(usdgPerSwap, sqrtPriceX96, trader.memeIsC0);
        const bal = await publicClient.readContract({
          address: trader.meme,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [trader.account.address],
        });
        const amountIn = bal < memeIn ? bal : memeIn;
        if (amountIn === 0n) {
          trader.buying = true;
          trader.legUntil = Date.now() + legMs;
          console.log(
            `[demo-swap] ${trader.label} no tokens to sell, switching to a buy leg`,
          );
        } else {
          const hash = await swapExactMemeForUsdg(
            trader.wallet,
            publicClient,
            router,
            trader.key,
            trader.memeIsC0,
            trader.account.address,
            amountIn,
          );
          const note = amountIn < memeIn ? "partial, wallet was short" : `~${formatUnits(usdgPerSwap, usdgDecimals)} USDG`;
          console.log(
            `[demo-swap] ${trader.label} sell ${formatUnits(amountIn, trader.memeDecimals)} ${trader.label} (${note}) tx=${hash}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[demo-swap] ${trader.label} swap failed: ${msg.slice(0, 180)}`);
    }

    if (recordAfter && observer) {
      if (sleepMs > 0) await sleep(sleepMs);
      await tryRecord(
        trader.wallet,
        publicClient,
        observer,
        trader.poolRef,
        trader.account.address,
      );
    } else if (sleepMs > 0 && !stop) {
      await sleep(sleepMs);
    }
  }

  console.log("[demo-swap] stopped. The keeper still records. Refresh Protect after the TWAP moves.");
}

main().catch((e) => {
  console.error("[demo-swap] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
