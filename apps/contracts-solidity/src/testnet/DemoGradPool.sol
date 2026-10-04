// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @dev Pons-style graduate pool: init price from LP deposit ratio (token1/token0 raw).
library DemoGradPool {
    /// @notice `sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96` (Uniswap spot definition).
    function sqrtPriceX96FromAmounts(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "DemoGradPool: amounts");
        uint256 ratioX192 = FullMath.mulDiv(amount1, uint256(1) << 192, amount0);
        return uint160(_sqrt(ratioX192));
    }

    /// @notice Snap tick to pool spacing (toward zero, matches deploy script convention).
    function snapTick(int24 tick, int24 spacing) internal pure returns (int24) {
        require(spacing > 0, "DemoGradPool: spacing");
        return (tick / spacing) * spacing;
    }

    /// @dev USDG (human) per 1 whole meme token, 1e18-fixed: (usdgRaw/1e6) / (memeRaw/1e18).
    function impliedUsdgPerToken1e18(uint256 memeRaw, uint256 usdgRaw) internal pure returns (uint256) {
        if (memeRaw == 0) return 0;
        return FullMath.mulDiv(usdgRaw, 1e36, FullMath.mulDiv(memeRaw, 1e6, 1));
    }

    /// @dev FDV when circulating == total supply (memecoin 100% float): price * supply in human units.
    function fdvUsdg6(uint256 memeRaw, uint256 usdgRaw, uint256 totalSupplyRaw) internal pure returns (uint256) {
        if (memeRaw == 0) return 0;
        return FullMath.mulDiv(usdgRaw, totalSupplyRaw, memeRaw);
    }

    function _sqrt(uint256 x) private pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (x + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }
}
