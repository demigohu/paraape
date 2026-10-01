// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ILiquidityLockAdapter} from "../interfaces/ILiquidityLockAdapter.sol";

/// @dev Attestation of permanently locked liquidity (PRD §8.2, §15)
contract ParaapeTestnetLocker is ILiquidityLockAdapter {
    mapping(bytes32 poolRef => bool) public locked;
    mapping(bytes32 poolRef => uint256) public quoteDepth;
    mapping(bytes32 poolRef => bytes) public poolLiquidityState;

    address public owner;

    event PoolRegistered(bytes32 indexed poolRef, uint256 quoteDepth);
    event OwnerUpdated(address indexed owner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Locker: owner");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Locker: zero");
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }

    function registerPool(bytes32 poolRef, uint256 quoteDepthAmount, bytes calldata state) external onlyOwner {
        locked[poolRef] = true;
        quoteDepth[poolRef] = quoteDepthAmount;
        poolLiquidityState[poolRef] = state;
        emit PoolRegistered(poolRef, quoteDepthAmount);
    }

    function isLiquidityLocked(bytes32 poolRef) external view returns (bool) {
        return locked[poolRef];
    }

    function lockedQuoteDepth(bytes32 poolRef) external view returns (uint256) {
        return quoteDepth[poolRef];
    }

    function liquidityState(bytes32 poolRef) external view returns (bytes memory) {
        return poolLiquidityState[poolRef];
    }
}
