import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export const poolManagerAbi = parseAbi([
  "function extsload(bytes32 slot) view returns (bytes32)",
]);

export const v4SwapRouterAbi = parseAbi([
  "function manager() view returns (address)",
  "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params) payable returns (int128 amount0, int128 amount1)",
]);

export const priceObserverAbi = parseAbi([
  "function record(bytes32 poolRef) external returns (uint16 idx, int24 tick)",
]);
