// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ILiquidityLockAdapter {
    /// @dev Returns true when pool liquidity is permanently locked per launchpad rules
    function isLiquidityLocked(bytes32 poolRef) external view returns (bool);

    /// @dev Quote-side reserve depth in quote token native decimals (WETH 18, USDG 6)
    function lockedQuoteDepth(bytes32 poolRef) external view returns (uint256);

    /// @dev ABI-encoded `DepthSnapshot` (sqrt-range segments) for concentrated D(s)
    function liquidityState(bytes32 poolRef) external view returns (bytes memory);
}
