// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPriceSource} from "../interfaces/IPriceSource.sol";
import {PriceObserver} from "./PriceObserver.sol";
import {OracleLib} from "../libraries/OracleLib.sol";
import {Pricing} from "../libraries/Pricing.sol";

/// @title V4PriceSource — IPriceSource backed by PriceObserver (PRD §9)
contract V4PriceSource is IPriceSource {
    PriceObserver public immutable observer;
    bytes32 public immutable wethUsdgPoolRef;
    bool public immutable wethIsCurrency0;

    constructor(PriceObserver _observer, bytes32 _wethUsdgPoolRef, bool _wethIsCurrency0) {
        observer = _observer;
        wethUsdgPoolRef = _wethUsdgPoolRef;
        wethIsCurrency0 = _wethIsCurrency0;
    }

    function observe(bytes32 poolRef, uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = observer.observe(poolRef, secondsAgos);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
    }

    function consultTwapTick(bytes32 poolRef, uint32 twapLength) external view returns (int24) {
        uint32[] memory agos = new uint32[](2);
        agos[0] = twapLength;
        agos[1] = 0;
        int56[] memory cum = observer.observe(poolRef, agos);
        return OracleLib.twapTick(cum[1], cum[0], twapLength);
    }

    function quoteToUsdg(bytes32) external view returns (uint256) {
        if (wethUsdgPoolRef == bytes32(0)) return 1e18;
        int24 tick = this.consultTwapTick(wethUsdgPoolRef, 5 minutes);
        uint256 usdgPerWeth = Pricing.wethToUsdg(1e18, tick, wethIsCurrency0);
        return usdgPerWeth * 1e18 / 1e6;
    }
}
