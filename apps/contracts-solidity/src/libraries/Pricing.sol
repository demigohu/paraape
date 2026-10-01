// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {WadMath} from "./WadMath.sol";

/// @dev Token prices and USDG conversion from Uniswap ticks (PRD §6–§7)
library Pricing {
    uint256 internal constant Q96 = 2 ** 96;
    uint256 internal constant Q192 = 2 ** 192;
    uint8 internal constant USDG_DECIMALS = 6;

    function sqrtPriceX96AtTick(int24 tick) internal pure returns (uint160) {
        return TickMath.getSqrtPriceAtTick(tick);
    }

    /// @dev token1 per token0 in raw units, 1e18 scaled: (sqrtP^2 / 2^192) * 1e18
    function rawPrice1e18(int24 tick) internal pure returns (uint256) {
        uint160 sqrtP = sqrtPriceX96AtTick(tick);
        return FullMath.mulDiv(uint256(sqrtP), uint256(sqrtP) * 1e18, Q192);
    }

    /// @dev Quote-token amount for `tokenAmount` of insured token at `tick`.
    function tokenAmountToQuote(uint256 tokenAmount, int24 tick, bool tokenIsCurrency0)
        internal
        pure
        returns (uint256)
    {
        uint160 sqrtP = sqrtPriceX96AtTick(tick);
        if (tokenIsCurrency0) {
            return FullMath.mulDiv(tokenAmount, uint256(sqrtP) * uint256(sqrtP), Q192);
        }
        return FullMath.mulDiv(tokenAmount, Q192, uint256(sqrtP) * uint256(sqrtP));
    }

    /// @dev Quote per 1e18 token units, in quote native decimals, 1e18-scaled numerator.
    function quotePerTokenWad(int24 tick, bool tokenIsCurrency0) internal pure returns (uint256) {
        return tokenAmountToQuote(1e18, tick, tokenIsCurrency0);
    }

    function meetsSeverityDrop(int24 tickStart, int24 tickEnd, uint16 severityBps, bool tokenIsCurrency0)
        internal
        pure
        returns (bool)
    {
        uint256 p0 = quotePerTokenWad(tickStart, tokenIsCurrency0);
        uint256 p1 = quotePerTokenWad(tickEnd, tokenIsCurrency0);
        if (p0 == 0) return false;
        uint256 threshold = p0 * (10_000 - severityBps) / 10_000;
        return p1 <= threshold;
    }

    function dropBps(int24 tickBefore, int24 tickNow, bool tokenIsCurrency0) internal pure returns (uint256) {
        uint256 p0 = quotePerTokenWad(tickBefore, tokenIsCurrency0);
        uint256 p1 = quotePerTokenWad(tickNow, tokenIsCurrency0);
        if (p1 >= p0 || p0 == 0) return 0;
        return (p0 - p1) * 10_000 / p0;
    }

    /// @dev Convert quote native amount to USDG (6 decimals).
    function quoteToUsdgAmount(
        uint256 quoteAmount,
        bool quoteIsUsdg,
        int24 wethUsdgTick,
        bool wethIsCurrency0
    ) internal pure returns (uint256) {
        if (quoteIsUsdg) return quoteAmount;
        return wethToUsdg(quoteAmount, wethUsdgTick, wethIsCurrency0);
    }

    /// @dev `wethAmount` is 18-decimal WETH; result is 6-decimal USDG.
    function wethToUsdg(uint256 wethAmount, int24 tick, bool wethIsCurrency0) internal pure returns (uint256) {
        uint160 sqrtP = sqrtPriceX96AtTick(tick);
        uint256 p2 = uint256(sqrtP) * uint256(sqrtP);
        if (wethIsCurrency0) {
            return FullMath.mulDiv(wethAmount, p2, Q192);
        }
        return FullMath.mulDiv(wethAmount, Q192, p2);
    }

    /// @dev Crash sqrt price for a drop of `severityBps` in quote-per-token.
    function crashSqrtPrice(uint160 currentSqrt, uint16 severityBps, bool tokenIsCurrency0)
        internal
        pure
        returns (uint160)
    {
        uint256 remainWad = uint256(10_000 - severityBps) * 1e18 / 10_000;
        uint256 sqrtRemain = WadMath.sqrtWad(remainWad);
        if (tokenIsCurrency0) {
            uint256 next = FullMath.mulDiv(currentSqrt, sqrtRemain, 1e18);
            if (next < TickMath.MIN_SQRT_PRICE) return TickMath.MIN_SQRT_PRICE;
            return uint160(next);
        }
        uint256 up = FullMath.mulDiv(currentSqrt, 1e18, sqrtRemain);
        if (up > TickMath.MAX_SQRT_PRICE) return TickMath.MAX_SQRT_PRICE - 1;
        return uint160(up);
    }

    function quoteDelta(uint160 sqrtA, uint160 sqrtB, uint128 liquidity, bool quoteIsToken1)
        internal
        pure
        returns (uint256)
    {
        if (quoteIsToken1) {
            return SqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, liquidity, false);
        }
        return SqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, liquidity, false);
    }
}
