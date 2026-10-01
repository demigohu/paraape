// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {IRiskEngine} from "./interfaces/IRiskEngine.sol";
import {PriceObserver} from "./oracle/PriceObserver.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

struct LiquiditySegment {
    uint160 sqrtLower;
    uint160 sqrtUpper;
    uint128 liquidity;
}

/// @dev Packed snapshot for `IRiskEngine.depthConcentrated` (Solidity + Stylus)
struct DepthSnapshot {
    int24 currentTick;
    bool tokenIsCurrency0;
    uint160 sqrtPriceX96;
    uint128 activeLiquidity;
    LiquiditySegment[] segments;
}

struct MarketParams {
    address factory;
    address guardian;
    IERC20 usdg;
    IERC20 insuredToken;
    bytes32 poolRef;
    bytes32 quoteToUsdgPoolRef;
    IPriceSource priceSource;
    IRiskEngine riskEngine;
    PriceObserver observer;
    IPoolManager poolManager;
    address tokenDeployer;
    address launchpadCreator;
    uint256 lockedQuoteDepth;
    int24 tickSpacing;
    bool tokenIsCurrency0;
    bool quoteIsUsdg;
    bool wethIsCurrency0;
    uint8 tokenDecimals;
    uint8 quoteDecimals;
    bytes liquidityState;
    ProtocolConfig config;
}
