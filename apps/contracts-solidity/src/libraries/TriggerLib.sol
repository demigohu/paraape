// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title TriggerLib — PRD §6 entry and claim TWAP
library TriggerLib {
    /// @dev Both the entry price and the claim price use this TWAP length.
    uint32 internal constant ENTRY_TWAP = 5 minutes;

    /// @dev (1 - s) with s in bps, scaled 1e18
    function severityPriceRatio(uint16 severityBps) internal pure returns (uint256) {
        return 1e18 - (uint256(severityBps) * 1e18) / 10_000;
    }
}
