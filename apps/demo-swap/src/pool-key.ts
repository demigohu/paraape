import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

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
