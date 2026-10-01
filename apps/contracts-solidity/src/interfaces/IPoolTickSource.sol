// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Abstraction over Uniswap V4 PoolManager slot0 reads (injected for tests / chain adapters)
interface IPoolTickSource {
    function getTick(bytes32 poolRef) external view returns (int24 tick);
}
