// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {MockV3Aggregator} from "../src/testnet/MockV3Aggregator.sol";

/// @dev Demo helper: `updateAnswer` on the testnet MockV3Aggregator (e.g. simulate ETH dump).
contract SetMockEthUsd is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        int256 answer = int256(vm.envUint("MOCK_ETH_USD_8DEC"));
        MockV3Aggregator feed = MockV3Aggregator(vm.envAddress("CHAINLINK_ETH_USD_FEED"));
        vm.startBroadcast(pk);
        feed.updateAnswer(answer);
        vm.stopBroadcast();
    }
}
