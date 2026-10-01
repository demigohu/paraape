// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Unlock callback to initialize + add liquidity on an existing V4 PoolManager.
/// Used by tests and the testnet demo script. Does not custody funds.
contract V4LiquidityRouter is IUnlockCallback {
    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external {
        manager.initialize(key, sqrtPriceX96);
    }

    function addLiquidity(PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params) external {
        manager.unlock(abi.encode(key, params, msg.sender));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "V4LiquidityRouter: manager");
        (PoolKey memory key, IPoolManager.ModifyLiquidityParams memory params, address payer) =
            abi.decode(data, (PoolKey, IPoolManager.ModifyLiquidityParams, address));
        (BalanceDelta delta,) = manager.modifyLiquidity(key, params, "");
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
