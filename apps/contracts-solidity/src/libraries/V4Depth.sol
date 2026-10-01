// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {DepthSnapshot, LiquiditySegment} from "../MarketTypes.sol";

/// @dev Encodes a DepthSnapshot for `IRiskEngine.depthConcentrated` (PRD §8.1)
library V4Depth {
    function liveHeader(IPoolManager manager, bytes32 poolRef, bool tokenIsCurrency0)
        internal
        view
        returns (int24 tick, uint160 sqrtP, uint128 liq)
    {
        PoolId id = PoolId.wrap(poolRef);
        (sqrtP, tick,,) = StateLibrary.getSlot0(manager, id);
        liq = StateLibrary.getLiquidity(manager, id);
        tokenIsCurrency0;
    }

    function encode(
        int24 tick,
        bool tokenIsCurrency0,
        uint160 sqrtP,
        uint128 liq,
        LiquiditySegment[] memory segments
    ) internal pure returns (bytes memory) {
        return abi.encode(
            DepthSnapshot({
                currentTick: tick,
                tokenIsCurrency0: tokenIsCurrency0,
                sqrtPriceX96: sqrtP,
                activeLiquidity: liq,
                segments: segments
            })
        );
    }
}
