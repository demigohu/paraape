// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

struct LiquiditySegment {
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
}
