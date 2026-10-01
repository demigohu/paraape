// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {PriceObserver} from "../src/oracle/PriceObserver.sol";
import {V4ChainlinkPriceSource} from "../src/oracle/V4ChainlinkPriceSource.sol";
import {MockV3Aggregator} from "../src/testnet/MockV3Aggregator.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {MockTickSource} from "./mocks/MockTickSource.sol";

contract ChainlinkPriceSourceTest is Test {
    bytes32 internal constant POOL = bytes32(uint256(1));

    function test_QuoteToUsdgFromMockFeed() public {
        MockTickSource tickSource = new MockTickSource();
        PriceObserver observer = new PriceObserver(tickSource, 9116, 30);
        MockV3Aggregator feed = new MockV3Aggregator(8, "ETH / USD", 3000e8);
        V4ChainlinkPriceSource src = new V4ChainlinkPriceSource(observer, bytes32(0), true, feed);

        uint256 rate = src.quoteToUsdg(POOL);
        uint256 usdgForOneEth = FullMath.mulDiv(1e18, rate, 1e18);
        assertEq(usdgForOneEth, 3000e6);
    }
}
