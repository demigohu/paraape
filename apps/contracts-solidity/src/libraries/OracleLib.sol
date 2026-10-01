// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {WadMath} from "./WadMath.sol";

library OracleLib {
    int24 internal constant MIN_TICK = TickMath.MIN_TICK;
    int24 internal constant MAX_TICK = TickMath.MAX_TICK;

    function clampTick(int24 tick) internal pure returns (int24) {
        if (tick < MIN_TICK) return MIN_TICK;
        if (tick > MAX_TICK) return MAX_TICK;
        return tick;
    }

    /// @dev Tick move for a price ratio of (1 - s), via TickMath (not a 2-term ln).
    function maxDownTickDelta(uint16 severityBps) internal pure returns (int24) {
        uint256 remainWad = uint256(10_000 - severityBps) * 1e18 / 10_000;
        uint256 sqrtRemain = WadMath.sqrtWad(remainWad);
        uint256 sqrtP = TickMath.getSqrtPriceAtTick(0);
        uint256 crashSqrt = sqrtP * sqrtRemain / 1e18;
        if (crashSqrt < TickMath.MIN_SQRT_PRICE) crashSqrt = TickMath.MIN_SQRT_PRICE;
        return TickMath.getTickAtSqrtPrice(uint160(crashSqrt));
    }

    function twapTick(int56 tickCumulativeEnd, int56 tickCumulativeStart, uint32 secondsAgo)
        internal
        pure
        returns (int24)
    {
        require(secondsAgo > 0, "OracleLib: twap");
        int56 delta = tickCumulativeEnd - tickCumulativeStart;
        return int24(delta / int56(uint56(secondsAgo)));
    }
}
