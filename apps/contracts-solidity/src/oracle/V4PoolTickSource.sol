// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolTickSource} from "../interfaces/IPoolTickSource.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

/// @dev Reads live tick from Uniswap V4 PoolManager via extsload (PRD §9)
contract V4PoolTickSource is IPoolTickSource {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function getTick(bytes32 poolRef) external view returns (int24 tick) {
        PoolId id = PoolId.wrap(poolRef);
        (, tick,,) = StateLibrary.getSlot0(poolManager, id);
    }
}
