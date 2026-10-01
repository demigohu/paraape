// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {DemoToken} from "../src/testnet/DemoToken.sol";
import {MockV3Aggregator} from "../src/testnet/MockV3Aggregator.sol";

/// @dev Mock settlement USDG + Chainlink ETH/USD feed for Robinhood testnet redeploys.
contract DeployTestnetMocks is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        uint256 usdgMint = vm.envOr("MOCK_USDG_MINT", uint256(10_000_000e6));
        int256 ethUsd = int256(vm.envOr("MOCK_ETH_USD_8DEC", uint256(3000e8)));

        vm.startBroadcast(pk);

        DemoToken mockUsdg = new DemoToken("Paraape Test USDG", "pUSDG", 6);
        mockUsdg.mint(deployer, usdgMint);

        MockV3Aggregator ethUsdFeed = new MockV3Aggregator(8, "ETH / USD", ethUsd);

        vm.stopBroadcast();

        console2.log("mockUsdg", address(mockUsdg));
        console2.log("ethUsdFeed", address(ethUsdFeed));
        console2.log("Set USDG_ADDRESS=", address(mockUsdg));
        console2.log("Set CHAINLINK_ETH_USD_FEED=", address(ethUsdFeed));
        console2.log("WETH_USDG_POOL_ID=0x0 (use Chainlink for WETH quote markets)");
    }
}
