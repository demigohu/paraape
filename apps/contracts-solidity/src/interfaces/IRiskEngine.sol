// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Stylus / Solidity risk engine (PRD §10)
interface IRiskEngine {
    function realizedVol(bytes calldata observerPayload) external view returns (uint256 sigma1e18);

    function quotePremium(
        bytes32 poolRef,
        uint256 sigma1e18,
        uint16 severityBps,
        uint32 windowSec,
        uint32 durationSec,
        uint256 coverageUsdg,
        uint256 cellUtilization1e18
    ) external view returns (uint256 premiumUsdg);

    function estimateApy(
        uint16 severityBps,
        uint32 windowSec,
        uint256 utilization1e18,
        uint256 sigma1e18
    ) external view returns (uint256 apyBps);

    /// @dev Full-range D(s) = y * (1 - sqrt(1-s)) with quote reserve y
    function depthFullRange(uint256 quoteReserve, uint16 severityBps) external view returns (uint256);

    /// @dev Concentrated D(s) from ABI-encoded `DepthSnapshot` (sqrt-range segments).
    function depthConcentrated(uint16 severityBps, bytes calldata liquidityState) external view returns (uint256);
}
