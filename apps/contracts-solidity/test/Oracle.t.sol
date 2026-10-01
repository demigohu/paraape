// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ParaapeFixture} from "./helpers/ParaapeFixture.sol";
import {PriceObserver} from "../src/oracle/PriceObserver.sol";
import {OracleLib} from "../src/libraries/OracleLib.sol";

contract OracleTest is ParaapeFixture {
    function test_RecordRateLimit() public {
        vm.expectRevert("PriceObserver: rate limit");
        observer.record(POOL);
    }

    function test_ClampMaxTickMove() public {
        tickSource.setTick(POOL, 50_000);
        vm.warp(block.timestamp + 31);
        (, int24 recorded) = observer.record(POOL);
        assertEq(recorded, 9116);
    }

    function test_TwapStaysAtTickWhenUnchanged() public view {
        int24 tick = priceSource.consultTwapTick(POOL, 30 minutes);
        assertEq(tick, 0);
    }

    function test_ObserveStaleReverts() public {
        uint32[] memory agos = new uint32[](1);
        agos[0] = uint32(90 days);
        vm.expectRevert("PriceObserver: stale");
        observer.observe(POOL, agos);
    }

    function test_TwapFollowsCrashAfterDwell() public {
        _record(-9116);
        _record(-18232);
        _record(-27348);
        _record(-27348);
        _record(-27348);
        int24 twap = priceSource.consultTwapTick(POOL, 60);
        assertLt(twap, -20_000);
        assertTrue(twap > -28_000);
    }

    function test_ExportPayloadPairs() public view {
        bytes memory payload = observer.exportTickPayload(POOL);
        assertEq(payload.length % 64, 0);
        assertGe(payload.length, 64);
    }

    function test_MaxDownTickDelta90pct() public pure {
        int24 crashTick = OracleLib.maxDownTickDelta(9000);
        assertLt(crashTick, -20_000);
        assertGt(crashTick, -25_000);
    }
}
