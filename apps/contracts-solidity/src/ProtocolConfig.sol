// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ProtocolConfig — PRD §14 initial parameters (guardian-updatable via factory)
struct ProtocolConfig {
    uint16 payoutCapAlphaBps; // α = 0.5 → 5000
    uint16 holderConcentrationBps; // H = 1% → 100
    uint16 entryGuardDropBps; // G = 20% → 2000
    uint32 activationDelay;
    uint8 persistenceK;
    int24 maxTickMove;
    uint32 minRecordInterval;
    uint32 challengePeriod;
    uint16 protocolFeeBps; // 5% → 500
    uint256 minDepthUsdg;
    uint256 minPremiumUsdg;
    uint256 maxPremiumBps; // max rate per duration cap
    uint256 challengeBondUsdg;
    uint256 recordBountyUsdg;
}

library ProtocolConfigLib {
    function defaults() internal pure returns (ProtocolConfig memory c) {
        c.payoutCapAlphaBps = 5000;
        c.holderConcentrationBps = 100;
        c.entryGuardDropBps = 2000;
        c.activationDelay = 30 minutes;
        c.persistenceK = 3;
        c.maxTickMove = 9116;
        c.minRecordInterval = 30;
        c.challengePeriod = 2 hours;
        c.protocolFeeBps = 500;
        c.minDepthUsdg = 25_000e6;
        c.minPremiumUsdg = 1e6;
        c.maxPremiumBps = 5000; // 50% of coverage max per policy (sanity bound)
        c.challengeBondUsdg = 500e6;
        c.recordBountyUsdg = 1e6;
    }
}
