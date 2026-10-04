import { encodeAbiParameters, encodePacked, keccak256, type Address, type Hex } from "viem";

export type DemoPoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

/** Same as demo `DeployDemoMarket` + `PoolIdLibrary.toId`. */
export function demoPoolKey(meme: Address, usdg: Address): DemoPoolKey {
  const c0 = meme.toLowerCase() < usdg.toLowerCase() ? meme : usdg;
  const c1 = meme.toLowerCase() < usdg.toLowerCase() ? usdg : meme;
  return {
    currency0: c0,
    currency1: c1,
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000",
  };
}

export function poolRefFromKey(key: DemoPoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

export function memeIsCurrency0(meme: Address, key: DemoPoolKey): boolean {
  return key.currency0.toLowerCase() === meme.toLowerCase();
}

/** Uniswap v4 TickMath bounds (exact-input swaps). */
export const MIN_SQRT_PRICE = 4295128739n;
export const MAX_SQRT_PRICE =
  1461446703485210103287273052203988822378723970342n;

const Q192 = 1n << 192n;

/** `pools[poolId]` slot. Matches StateLibrary.POOLS_SLOT = 6. */
export function poolStateSlot(poolRef: Hex): Hex {
  const poolsSlot = `0x${(6n).toString(16).padStart(64, "0")}` as Hex;
  return keccak256(encodePacked(["bytes32", "bytes32"], [poolRef, poolsSlot]));
}

/** Lower 160 bits of PoolManager slot0. */
export function sqrtPriceX96FromSlot0(data: Hex): bigint {
  return BigInt(data) & ((1n << 160n) - 1n);
}

/**
 * Meme raw in that is worth `usdgRaw` at the spot price.
 * Price is token1/token0 in raw units, `(sqrtPriceX96 / 2^96)^2`.
 */
export function memeRawForUsdgRaw(
  usdgRaw: bigint,
  sqrtPriceX96: bigint,
  memeIsC0: boolean,
): bigint {
  if (sqrtPriceX96 <= 0n) throw new Error("pool price is zero");
  const p2 = sqrtPriceX96 * sqrtPriceX96;
  if (p2 === 0n) throw new Error("pool price is zero");
  if (memeIsC0) return (usdgRaw * Q192) / p2;
  return (usdgRaw * p2) / Q192;
}
