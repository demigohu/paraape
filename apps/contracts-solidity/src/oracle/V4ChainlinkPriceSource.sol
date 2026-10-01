// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPriceSource} from "../interfaces/IPriceSource.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";
import {PriceObserver} from "./PriceObserver.sol";
import {OracleLib} from "../libraries/OracleLib.sol";
import {Pricing} from "../libraries/Pricing.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title V4ChainlinkPriceSource — meme pool TWAP + ETH/USD via Chainlink (or pool fallback)
/// @dev Insured-token triggers use `PriceObserver`. WETH→USDG uses Chainlink when `ethUsdFeed` is set.
contract V4ChainlinkPriceSource is IPriceSource {
    PriceObserver public immutable observer;
    bytes32 public immutable wethUsdgPoolRef;
    bool public immutable wethIsCurrency0;
    AggregatorV3Interface public immutable ethUsdFeed;

    constructor(
        PriceObserver _observer,
        bytes32 _wethUsdgPoolRef,
        bool _wethIsCurrency0,
        AggregatorV3Interface _ethUsdFeed
    ) {
        observer = _observer;
        wethUsdgPoolRef = _wethUsdgPoolRef;
        wethIsCurrency0 = _wethIsCurrency0;
        ethUsdFeed = _ethUsdFeed;
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

    /// @inheritdoc IPriceSource
    /// @dev Rate such that `quoteAmount * rate / 1e18` yields USDG (6 decimals) for 18-decimal WETH.
    function quoteToUsdg(bytes32) external view returns (uint256 rate1e18) {
        if (address(ethUsdFeed) != address(0)) {
            (, int256 answer,,,) = ethUsdFeed.latestRoundData();
            require(answer > 0, "V4Chainlink: feed");
            uint8 dec = ethUsdFeed.decimals();
            return FullMath.mulDiv(uint256(answer), 1e18, 10 ** (uint256(dec) + 12));
        }
        if (wethUsdgPoolRef == bytes32(0)) return 1e18;
        int24 tick = this.consultTwapTick(wethUsdgPoolRef, 5 minutes);
        uint256 usdgPerWeth = Pricing.wethToUsdg(1e18, tick, wethIsCurrency0);
        return usdgPerWeth * 1e18 / 1e6;
    }
}
