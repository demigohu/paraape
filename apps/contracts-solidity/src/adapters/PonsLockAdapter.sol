// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ILiquidityLockAdapter} from "../interfaces/ILiquidityLockAdapter.sol";
/// @dev Registry adapter for Pons permanently locked pools (mainnet integration)
contract PonsLockAdapter is ILiquidityLockAdapter {
    mapping(bytes32 poolRef => bool) public locked;
    mapping(bytes32 poolRef => uint256) public quoteDepth;
    mapping(bytes32 poolRef => bytes) public poolLiquidityState;

    address public registrar;

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "PonsLockAdapter: registrar");
        _;
    }

    constructor(address _registrar) {
        registrar = _registrar;
    }

    function registerPool(bytes32 poolRef, uint256 quoteDepthAmount, bytes calldata state) external onlyRegistrar {
        locked[poolRef] = true;
        quoteDepth[poolRef] = quoteDepthAmount;
        poolLiquidityState[poolRef] = state;
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
