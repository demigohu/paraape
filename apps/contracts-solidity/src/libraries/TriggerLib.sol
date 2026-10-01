// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {GridLib} from "./GridLib.sol";

/// @title TriggerLib — PRD §6 trigger math (TWAP length, price ratio)
library TriggerLib {
    uint32 internal constant MIN_TWAP = 1 minutes;
    uint32 internal constant MAX_TWAP = 30 minutes;

    /// @dev L = clamp(w / 5, 1 minute, 30 minutes)
    function measurementTwapLength(uint8 windowIdx) internal pure returns (uint32) {
        uint32 w = GridLib.windowSeconds(windowIdx);
        uint32 len = w / 5;
        if (len < MIN_TWAP) return MIN_TWAP;
        if (len > MAX_TWAP) return MAX_TWAP;
        return len;
    }

    /// @dev Compare TWAP ticks: P(t1) <= (1 - s) * P(t0)  <=>  tick1 - tick0 <= log(1-s) in tick space.
    /// We use sqrtPriceX96 derived from ticks for verification in the vault.
    function severityPriceRatio(uint16 severityBps) internal pure returns (uint256) {
        // (1 - s) with s in bps, scaled 1e18
        return 1e18 - (uint256(severityBps) * 1e18) / 10_000;
    }

    function withinWindow(uint256 t0, uint256 t1, uint32 windowSec) internal pure returns (bool) {
        return t1 > t0 && t1 - t0 <= windowSec;
    }
}
