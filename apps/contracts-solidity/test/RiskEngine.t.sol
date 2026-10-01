// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ParaapeRiskEngine} from "../src/risk/ParaapeRiskEngine.sol";
import {BoundedRiskEngine} from "../src/risk/BoundedRiskEngine.sol";
import {DepthSnapshot, LiquiditySegment} from "../src/MarketTypes.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Pricing} from "../src/libraries/Pricing.sol";

contract RiskEngineTest is Test {
    ParaapeRiskEngine engine;

    function setUp() public {
        engine = new ParaapeRiskEngine();
    }

    function test_Depth70And85MatchPRDTable() public view {
        uint256 y = 100_000e6;
        uint256 d70 = engine.depthFullRange(y, 7000);
        uint256 d85 = engine.depthFullRange(y, 8500);
        assertApproxEqRel(d70, 45_228e6, 0.02e18);
        assertApproxEqRel(d85, 61_270e6, 0.02e18);
    }

    function test_BoundedRiskEngineClampsMinPremium() public {
        BoundedRiskEngine bounded = new BoundedRiskEngine(engine, 10e6, 5000);
        uint256 p = bounded.quotePremium(bytes32(0), 1e10, 9500, 5 minutes, 1 days, 100e6, 0);
        assertEq(p, 10e6);
    }

    function test_ConcentratedMatchesQuoteDelta() public view {
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(0);
        LiquiditySegment[] memory segs = new LiquiditySegment[](0);
        bytes memory packed = abi.encode(
            DepthSnapshot({
                currentTick: 0,
                tokenIsCurrency0: true,
                sqrtPriceX96: sqrtP,
                activeLiquidity: 1e18,
                segments: segs
            })
        );
        uint256 depth = engine.depthConcentrated(5000, packed);
        uint160 crash = Pricing.crashSqrtPrice(sqrtP, 5000, true);
        uint256 expected = Pricing.quoteDelta(sqrtP, crash, 1e18, true);
        assertEq(depth, expected);
        assertGt(depth, 0);
    }

    function test_RealizedVolFallbackOnShortPayload() public view {
        assertEq(engine.realizedVol(""), 7e13);
        bytes memory one = new bytes(64);
        assertEq(engine.realizedVol(one), 7e13);
    }

    function test_RealizedVolFromPairedObservations() public view {
        bytes memory payload = new bytes(256);
        _storeWord(payload, 0, 0);
        _storeWord(payload, 32, 1_000);
        _storeWord(payload, 64, 10);
        _storeWord(payload, 96, 1_030);
        _storeWord(payload, 128, 20);
        _storeWord(payload, 160, 1_060);
        _storeWord(payload, 192, 25);
        _storeWord(payload, 224, 1_090);
        uint256 sigma = engine.realizedVol(payload);
        assertGe(sigma, 1e10);
        assertLe(sigma, 1e16);
    }

    function _storeWord(bytes memory data, uint256 off, uint256 word) internal pure {
        assembly {
            mstore(add(add(data, 32), off), word)
        }
    }
}
