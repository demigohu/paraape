// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {V4SwapRouter} from "../src/testnet/V4SwapRouter.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @dev One-off deploy for demo pool swaps (`apps/demo-swap`). Not the liquidity router (`V4LiquidityRouter`).
contract DeployV4SwapRouter is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER_ADDRESS"));
        vm.startBroadcast(pk);
        V4SwapRouter router = new V4SwapRouter(poolManager);
        vm.stopBroadcast();
        console2.log("V4_SWAP_ROUTER_ADDRESS", address(router));
    }
}
