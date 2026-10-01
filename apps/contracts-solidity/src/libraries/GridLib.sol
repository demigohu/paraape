// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title GridLib — PRD §5 severity / window / duration grid validation
library GridLib {
    uint8 internal constant SEVERITY_COUNT = 6;
    uint8 internal constant WINDOW_COUNT = 10;
    uint8 internal constant DURATION_COUNT = 5;

    /// @dev {50, 60, 70, 80, 90, 95}% in bps
    function severityBps(uint8 severityIdx) internal pure returns (uint16) {
        require(severityIdx < SEVERITY_COUNT, "GridLib: bad severity");
        uint16[6] memory levels = [uint16(5000), 6000, 7000, 8000, 9000, 9500];
        return levels[severityIdx];
    }

    function windowSeconds(uint8 windowIdx) internal pure returns (uint32) {
        require(windowIdx < WINDOW_COUNT, "GridLib: bad window");
        uint32[10] memory windows = [
            uint32(5 minutes),
            uint32(15 minutes),
            uint32(30 minutes),
            uint32(1 hours),
            uint32(4 hours),
            uint32(12 hours),
            uint32(1 days),
            uint32(3 days),
            uint32(7 days),
            uint32(30 days)
        ];
        return windows[windowIdx];
    }

    function durationSeconds(uint8 durationIdx) internal pure returns (uint32) {
        require(durationIdx < DURATION_COUNT, "GridLib: bad duration");
        uint32[5] memory durations =
            [uint32(1 days), uint32(3 days), uint32(7 days), uint32(14 days), uint32(30 days)];
        return durations[durationIdx];
    }

    /// @dev PRD §5.3. >1d asks for 85%; first on-grid point ≥ 85% is 90% (index 4).
    function minSeverityIdx(uint8 windowIdx) internal pure returns (uint8) {
        uint32 w = windowSeconds(windowIdx);
        if (w <= 1 hours) return 0;
        if (w <= 1 days) return 2;
        return 4;
    }

    function validateCell(uint8 severityIdx, uint8 windowIdx) internal pure {
        require(severityIdx < SEVERITY_COUNT && windowIdx < WINDOW_COUNT, "GridLib: bad cell");
        require(severityIdx >= minSeverityIdx(windowIdx), "GridLib: severity/window");
    }

    function validatePolicy(uint8 severityIdx, uint8 windowIdx, uint8 durationIdx) internal pure {
        validateCell(severityIdx, windowIdx);
        require(durationIdx < DURATION_COUNT, "GridLib: bad duration");
        require(windowSeconds(windowIdx) <= durationSeconds(durationIdx), "GridLib: window>duration");
    }

    function cellBacksPolicy(uint8 cellSeverityIdx, uint8 cellWindowIdx, uint8 policySeverityIdx, uint8 policyWindowIdx)
        internal
        pure
        returns (bool)
    {
        return policySeverityIdx >= cellSeverityIdx && policyWindowIdx <= cellWindowIdx;
    }

    function cellKey(uint8 severityIdx, uint8 windowIdx) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(severityIdx, windowIdx));
    }
}
