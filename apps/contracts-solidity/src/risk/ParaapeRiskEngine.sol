// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IRiskEngine} from "../interfaces/IRiskEngine.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {WadMath} from "../libraries/WadMath.sol";
import {Pricing} from "../libraries/Pricing.sol";
import {DepthSnapshot, LiquiditySegment} from "../MarketTypes.sol";

/// @title ParaapeRiskEngine — PRD §10 (Solidity twin of the Stylus engine)
contract ParaapeRiskEngine is IRiskEngine {
    uint256 internal constant WAD = 1e18;
    /// 15% expense load on top of expected-hit rate
    uint256 internal constant LOAD_WAD = 15e16;
    uint256 internal constant UTIL_KINK = 8e17;
    /// Reference jump rate (WAD) at 50% severity / 5m window before severity & window scaling
    uint256 internal constant BASE_JUMP_WAD = 80e14; // 0.8%

    function realizedVol(bytes calldata observerPayload) external pure returns (uint256 sigma1e18) {
        return _realizedVol(observerPayload);
    }

    function quotePremium(
        bytes32,
        uint256 sigma1e18,
        uint16 severityBps,
        uint32 windowSec,
        uint32 durationSec,
        uint256 coverageUsdg,
        uint256 cellUtilization1e18
    ) external pure returns (uint256 premiumUsdg) {
        uint256 p = _pDrawdown(sigma1e18, severityBps, windowSec);
        uint256 jump = _jumpFloor(severityBps, windowSec);
        uint256 unionBound = _unionHitRateWad(p, durationSec, windowSec);
        uint256 rate = WadMath.max(jump, unionBound);
        uint256 load = WAD + LOAD_WAD + cellUtilization1e18 / 2;
        rate = WadMath.wMul(rate, load);
        rate = WadMath.wMul(rate, _utilizationMultiplier(cellUtilization1e18));
        premiumUsdg = FullMath.mulDiv(coverageUsdg, rate, WAD);
        if (premiumUsdg == 0) premiumUsdg = 1;
    }

    function estimateApy(
        uint16 severityBps,
        uint32 windowSec,
        uint256 utilization1e18,
        uint256 sigma1e18
    ) external pure returns (uint256 apyBps) {
        uint256 p = _pDrawdown(sigma1e18, severityBps, windowSec);
        uint256 jump = _jumpFloor(severityBps, windowSec);
        uint256 unionYear = _unionHitRateWad(p, uint32(365 days), windowSec);
        uint256 rateYear = WadMath.max(jump, unionYear);
        rateYear = WadMath.wMul(rateYear, WAD + LOAD_WAD + utilization1e18 / 2);
        rateYear = WadMath.wMul(rateYear, _utilizationMultiplier(utilization1e18));
        apyBps = rateYear * 10_000 / WAD;
    }

    function depthFullRange(uint256 quoteReserve, uint16 severityBps) external pure returns (uint256) {
        return _depthFullRange(quoteReserve, severityBps);
    }

    function depthConcentrated(uint16 severityBps, bytes calldata liquidityState)
        external
        pure
        returns (uint256 depth)
    {
        if (liquidityState.length == 0) return 0;
        DepthSnapshot memory snap = abi.decode(liquidityState, (DepthSnapshot));
        uint160 crashSqrt = Pricing.crashSqrtPrice(snap.sqrtPriceX96, severityBps, snap.tokenIsCurrency0);
        bool quoteIsToken1 = snap.tokenIsCurrency0;
        if (snap.segments.length == 0) {
            if (snap.activeLiquidity == 0) return 0;
            return Pricing.quoteDelta(snap.sqrtPriceX96, crashSqrt, snap.activeLiquidity, quoteIsToken1);
        }
        for (uint256 i = 0; i < snap.segments.length; i++) {
            LiquiditySegment memory seg = snap.segments[i];
            if (seg.liquidity == 0) continue;
            uint160 lo = seg.sqrtLower;
            uint160 hi = seg.sqrtUpper;
            (uint160 a, uint160 b) = _intersect(lo, hi, snap.sqrtPriceX96, crashSqrt);
            if (a == b) continue;
            depth += Pricing.quoteDelta(a, b, seg.liquidity, quoteIsToken1);
        }
    }

    function _depthFullRange(uint256 quoteReserve, uint16 severityBps) internal pure returns (uint256) {
        uint256 remainWad = uint256(10_000 - severityBps) * WAD / 10_000;
        uint256 root = WadMath.sqrtWad(remainWad);
        return FullMath.mulDiv(quoteReserve, WAD - root, WAD);
    }

    /// @dev Payload: repeating 32-byte words [int24 tick | uint32 dt ignored], or pairs (tick, timestamp).
    /// Preferred: 64 bytes per observation — tick then timestamp.
    function _realizedVol(bytes calldata payload) internal pure returns (uint256) {
        // ~40% annualised → per-second log-vol ≈ 0.40 / sqrt(365.25*86400) ≈ 7.1e-5
        if (payload.length < 128) return 7e13;
        bool paired = payload.length % 64 == 0;
        uint256 n = paired ? payload.length / 64 : payload.length / 32;
        if (n < 2) return 7e13;

        uint256 sumVar;
        uint256 count;
        int24 prevTick = int24(int256(uint256(bytes32(payload[0:32]))));
        uint32 prevTs = paired ? uint32(uint256(bytes32(payload[32:64]))) : 0;

        for (uint256 i = 1; i < n; i++) {
            uint256 off = paired ? i * 64 : i * 32;
            int24 tick = int24(int256(uint256(bytes32(payload[off:off + 32]))));
            uint32 dt;
            if (paired) {
                uint32 ts = uint32(uint256(bytes32(payload[off + 32:off + 64])));
                dt = ts > prevTs ? ts - prevTs : 0;
                prevTs = ts;
            } else {
                dt = 30;
            }
            int256 dTick = int256(tick) - int256(prevTick);
            prevTick = tick;
            if (dt == 0) continue;
            uint256 d2 = uint256(dTick >= 0 ? dTick : -dTick);
            d2 = d2 * d2;
            // var_wad contribution: Δtick² * 1e10 / dt  (see review notes)
            sumVar += (d2 * 1e10) / dt;
            count++;
        }
        if (count == 0) return 7e13;
        uint256 meanVar = sumVar / count;
        uint256 sigmaSec = WadMath.sqrtWad(meanVar);
        if (sigmaSec < 1e10) sigmaSec = 1e10;
        if (sigmaSec > 1e16) sigmaSec = 1e16;
        return sigmaSec;
    }

    /// @dev P(drawdown ≥ s in window w) ≈ 2 Φ(-s / (σ √w)) with σ per-second log-vol.
    function _pDrawdown(uint256 sigmaSecWad, uint16 severityBps, uint32 windowSec) internal pure returns (uint256) {
        uint256 sWad = uint256(severityBps) * WAD / 10_000;
        uint256 sigmaW = WadMath.wMul(sigmaSecWad, WadMath.sqrtWad(uint256(windowSec) * WAD));
        if (sigmaW == 0) return 1e12;
        uint256 x = WadMath.wDiv(sWad, sigmaW);
        uint256 tail = WadMath.normTailWad(x);
        uint256 p = tail * 2;
        return p > WAD ? WAD : p;
    }

    /// @dev P(≥1 trigger in policy duration) ≈ 1 − (1−p)^k, k = ⌈duration / window⌉ (B3).
    function _unionHitRateWad(uint256 pWad, uint32 durationSec, uint32 windowSec) internal pure returns (uint256) {
        if (pWad == 0) return 0;
        if (pWad >= WAD) return WAD;
        if (windowSec == 0 || durationSec <= windowSec) return pWad;
        uint256 k = (uint256(durationSec) + windowSec - 1) / windowSec;
        if (k > 4096) k = 4096;
        uint256 survive = _wadPow(WAD - pWad, k);
        return WAD - survive;
    }

    /// @dev (base/WAD)^exp × WAD via binary exponentiation; base, result in WAD.
    function _wadPow(uint256 baseWad, uint256 exp) internal pure returns (uint256) {
        if (exp == 0) return WAD;
        uint256 result = WAD;
        while (exp > 0) {
            if (exp & 1 != 0) result = WadMath.wMul(result, baseWad);
            baseWad = WadMath.wMul(baseWad, baseWad);
            exp >>= 1;
        }
        return result;
    }

    /// @dev Memecoin jump floor: higher severity & shorter windows → higher minimum rate (PRD §10 v2).
    function _jumpFloor(uint16 severityBps, uint32 windowSec) internal pure returns (uint256) {
        uint256 sWad = uint256(severityBps) * WAD / 10_000;
        uint256 severityFactor = WAD + sWad; // 1.5 @ 50%, 1.9 @ 90%
        uint256 windowFactor =
            WadMath.wDiv(WAD, WadMath.sqrtWad(uint256(windowSec) * WAD / 5 minutes));
        if (windowFactor < WAD / 10) windowFactor = WAD / 10;
        return WadMath.wMul(BASE_JUMP_WAD, WadMath.wMul(severityFactor, windowFactor));
    }

    function _utilizationMultiplier(uint256 uWad) internal pure returns (uint256) {
        if (uWad >= WAD) return 3 * WAD;
        if (uWad <= UTIL_KINK) return WAD + uWad;
        uint256 excess = uWad - UTIL_KINK;
        return WAD + uWad + WadMath.wMul(excess, excess) * 2 / (WAD - UTIL_KINK);
    }

    function _intersect(uint160 a0, uint160 a1, uint160 b0, uint160 b1) internal pure returns (uint160, uint160) {
        uint160 lo0 = a0 < a1 ? a0 : a1;
        uint160 hi0 = a0 < a1 ? a1 : a0;
        uint160 lo1 = b0 < b1 ? b0 : b1;
        uint160 hi1 = b0 < b1 ? b1 : b0;
        uint160 lo = lo0 > lo1 ? lo0 : lo1;
        uint160 hi = hi0 < hi1 ? hi0 : hi1;
        if (lo >= hi) return (lo, lo);
        return (lo, hi);
    }
}
