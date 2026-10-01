// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPriceSource} from "../interfaces/IPriceSource.sol";
import {OracleLib} from "../libraries/OracleLib.sol";
import {Pricing} from "../libraries/Pricing.sol";

interface IUniswapV3PoolObserve {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}

/// @title V3PriceSource — adapter when a V3 pool exists on the target chain
contract V3PriceSource is IPriceSource {
    address public immutable pool;
    address public immutable quoteToUsdgPool;
    bool public immutable wethIsCurrency0;

    constructor(address _pool, address _quoteToUsdgPool, bool _wethIsCurrency0) {
        require(_pool != address(0), "V3PriceSource: pool");
        pool = _pool;
        quoteToUsdgPool = _quoteToUsdgPool;
        wethIsCurrency0 = _wethIsCurrency0;
    }

    function observe(bytes32 poolRef, uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        require(bytes32(uint256(uint160(pool))) == poolRef, "V3PriceSource: pool");
        return IUniswapV3PoolObserve(pool).observe(secondsAgos);
    }

    function consultTwapTick(bytes32 poolRef, uint32 twapLength) external view returns (int24) {
        uint32[] memory agos = new uint32[](2);
        agos[0] = twapLength;
        agos[1] = 0;
        (int56[] memory cum,) = this.observe(poolRef, agos);
        return OracleLib.twapTick(cum[1], cum[0], twapLength);
    }

    function quoteToUsdg(bytes32) external view returns (uint256) {
        if (quoteToUsdgPool == address(0)) return 1e18;
        bytes32 ref = bytes32(uint256(uint160(quoteToUsdgPool)));
        int24 tick = this.consultTwapTick(ref, 5 minutes);
        uint256 usdgPerWeth = Pricing.wethToUsdg(1e18, tick, wethIsCurrency0);
        return usdgPerWeth * 1e18 / 1e6;
    }
}
