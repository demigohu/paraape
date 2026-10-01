// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolTickSource} from "../../src/interfaces/IPoolTickSource.sol";

contract MockTickSource is IPoolTickSource {
    mapping(bytes32 => int24) public ticks;

    function setTick(bytes32 poolRef, int24 tick) external {
        ticks[poolRef] = tick;
    }

    function getTick(bytes32 poolRef) external view returns (int24) {
        return ticks[poolRef];
    }
}
