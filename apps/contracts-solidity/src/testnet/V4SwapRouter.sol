// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Exact-input swaps on an existing V4 pool (testnet demo / oracle volume).
contract V4SwapRouter is IUnlockCallback {
    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    /// @param params V4 swap params; negative `amountSpecified` = exact input.
    function swap(PoolKey calldata key, IPoolManager.SwapParams calldata params) external payable returns (BalanceDelta) {
        return abi.decode(manager.unlock(abi.encode(key, params, msg.sender)), (BalanceDelta));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "V4SwapRouter: manager");
        (PoolKey memory key, IPoolManager.SwapParams memory params, address payer) =
            abi.decode(data, (PoolKey, IPoolManager.SwapParams, address));
        BalanceDelta delta = manager.swap(key, params, "");
        _settle(key.currency0, payer, delta.amount0());
        _settle(key.currency1, payer, delta.amount1());
        return abi.encode(delta);
    }

    function _settle(Currency currency, address payer, int128 amount) internal {
        if (amount < 0) {
            uint256 owe = uint256(uint128(-amount));
            address token = Currency.unwrap(currency);
            manager.sync(currency);
            if (token == address(0)) {
                manager.settle{value: owe}();
            } else {
                IERC20(token).transferFrom(payer, address(manager), owe);
                manager.settle();
            }
        } else if (amount > 0) {
            manager.take(currency, payer, uint256(uint128(amount)));
        }
    }
}
