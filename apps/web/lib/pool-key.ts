import { encodeAbiParameters, encodePacked, keccak256, type Address, type Hex } from "viem";

export type UsdPoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/** Demo and testnet markets use fee 3000 / tick spacing 60 / no hooks, quote = USDG. */
export function usdgPoolKey(token: Address, usdg: Address): UsdPoolKey {
  const tokenIs0 = token.toLowerCase() < usdg.toLowerCase();
  return {
    currency0: tokenIs0 ? token : usdg,
    currency1: tokenIs0 ? usdg : token,
    fee: 3000,
    tickSpacing: 60,
    hooks: ZERO,
  };
}

export function poolRefFromKey(key: UsdPoolKey): Hex {
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

/** `StateLibrary._getPoolStateSlot`: keccak256(abi.encodePacked(poolId, POOLS_SLOT)). */
export function poolStateSlot(poolRef: Hex): Hex {
  const poolsSlot = `0x${(6).toString(16).padStart(64, "0")}` as Hex;
  return keccak256(encodePacked(["bytes32", "bytes32"], [poolRef, poolsSlot]));
}
