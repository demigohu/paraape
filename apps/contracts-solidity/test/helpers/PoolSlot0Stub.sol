// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IExtsload} from "@uniswap/v4-core/src/interfaces/IExtsload.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

/// @dev Minimal PoolManager surface for factory/oracle tests: packed slot0 via real StateLibrary layout.
contract PoolSlot0Stub is IExtsload {
    mapping(bytes32 slot => bytes32) internal $;

    function setSlot0(bytes32 poolId, uint160 sqrtPriceX96, int24 tick) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(poolId, StateLibrary.POOLS_SLOT));
        uint256 packed = uint256(sqrtPriceX96);
        packed |= uint256(uint24(tick)) << 160;
        $[stateSlot] = bytes32(packed);
        bytes32 liqSlot = bytes32(uint256(stateSlot) + StateLibrary.LIQUIDITY_OFFSET);
        $[liqSlot] = bytes32(uint256(1e18));
    }

    function extsload(bytes32 slot) external view returns (bytes32) {
        return $[slot];
    }

    function extsload(bytes32, uint256 nSlots) external pure returns (bytes32[] memory data) {
        data = new bytes32[](nSlots);
    }

    function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory data) {
        data = new bytes32[](slots.length);
        for (uint256 i; i < slots.length; i++) data[i] = $[slots[i]];
    }
}
