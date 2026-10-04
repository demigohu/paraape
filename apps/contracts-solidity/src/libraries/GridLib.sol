// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title GridLib — PRD §5 severity / duration grid
library GridLib {
    uint8 internal constant SEVERITY_COUNT = 6;
    uint8 internal constant DURATION_COUNT = 5;

    /// @dev {50, 60, 70, 80, 90, 95}% in bps
    function severityBps(uint8 severityIdx) internal pure returns (uint16) {
        require(severityIdx < SEVERITY_COUNT, "GridLib: bad severity");
        uint16[6] memory levels = [uint16(5000), 6000, 7000, 8000, 9000, 9500];
        return levels[severityIdx];
    }

    function durationSeconds(uint8 durationIdx) internal pure returns (uint32) {
        require(durationIdx < DURATION_COUNT, "GridLib: bad duration");
        uint32[5] memory durations =
            [uint32(1 days), uint32(3 days), uint32(7 days), uint32(14 days), uint32(30 days)];
        return durations[durationIdx];
    }

    function validateCell(uint8 severityIdx) internal pure {
        require(severityIdx < SEVERITY_COUNT, "GridLib: bad cell");
    }

    function validatePolicy(uint8 severityIdx, uint8 durationIdx) internal pure {
        validateCell(severityIdx);
        require(durationIdx < DURATION_COUNT, "GridLib: bad duration");
    }

    /// @dev A milder cell (smaller drop) can back a deeper policy. The reverse cannot.
    function cellBacksPolicy(uint8 cellSeverityIdx, uint8 policySeverityIdx) internal pure returns (bool) {
        return policySeverityIdx >= cellSeverityIdx;
    }

    function cellKey(uint8 severityIdx) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(severityIdx));
    }
}
