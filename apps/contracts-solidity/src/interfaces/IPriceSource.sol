// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Uniswap V3-compatible cumulative tick oracle surface (PRD §9)
interface IPriceSource {
    /// @param poolRef V4 pool id or V3 pool address cast to bytes32
    function observe(bytes32 poolRef, uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);

    /// @dev TWAP tick over `[now - twapLength, now]` for quote-token pricing
    function consultTwapTick(bytes32 poolRef, uint32 twapLength) external view returns (int24 tick);

    /// @dev 1 quote token = `rate` USDG (6 decimals) scaled by 1e18
    function quoteToUsdg(bytes32 quotePoolRef) external view returns (uint256 rate1e18);
}
