// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IRiskEngine} from "../interfaces/IRiskEngine.sol";

/// @dev Wraps Stylus (or remote) engine; enforces PRD §10 Solidity bounds
contract BoundedRiskEngine is IRiskEngine {
    IRiskEngine public immutable impl;
    uint256 public immutable maxPremiumBps;

    constructor(IRiskEngine _impl, uint256 _maxPremiumBps) {
        impl = _impl;
        maxPremiumBps = _maxPremiumBps;
    }

    function realizedVol(bytes calldata observerPayload) external view returns (uint256) {
        return impl.realizedVol(observerPayload);
    }

    function quotePremium(
        bytes32 poolRef,
        uint256 sigma1e18,
        uint16 severityBps,
        uint32 windowSec,
        uint32 durationSec,
        uint256 coverageUsdg,
        uint256 cellUtilization1e18
    ) external view returns (uint256 premiumUsdg) {
        premiumUsdg = impl.quotePremium(
            poolRef, sigma1e18, severityBps, windowSec, durationSec, coverageUsdg, cellUtilization1e18
        );
        uint256 maxPrem = coverageUsdg * maxPremiumBps / 10_000;
        if (premiumUsdg > maxPrem) premiumUsdg = maxPrem;
    }

    function estimateApy(
        uint16 severityBps,
        uint32 windowSec,
        uint256 utilization1e18,
        uint256 sigma1e18
    ) external view returns (uint256) {
        return impl.estimateApy(severityBps, windowSec, utilization1e18, sigma1e18);
    }

    function depthFullRange(uint256 quoteReserve, uint16 severityBps) external view returns (uint256) {
        return impl.depthFullRange(quoteReserve, severityBps);
    }

    function depthConcentrated(uint16 severityBps, bytes calldata liquidityState)
        external
        view
        returns (uint256)
    {
        return impl.depthConcentrated(severityBps, liquidityState);
    }
}
