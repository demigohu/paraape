// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {ParaapeTestnetLocker} from "../src/adapters/ParaapeTestnetLocker.sol";
import {V4LiquidityRouter} from "../src/testnet/V4LiquidityRouter.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {DemoToken} from "../src/testnet/DemoToken.sol";

using PoolIdLibrary for PoolKey;

/// @dev Creates a hookless meme/USDG pool on the live PoolManager, locks it, opens a market.
/// At tick 0 full-range, Uniswap raw amounts ≈ liquidityDelta on each side.
/// USDG is 6 decimals, so liquidityDelta 10e6 ≈ 10 USDG from the faucet — not 1e15 (≈ 1e9 USDG).
/// `registerPool` is a testnet attestation for factory minDepth (25k); it does not pull USDG.
contract DeployDemoMarket is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IERC20 usdg = IERC20(vm.envAddress("USDG_ADDRESS"));
        MarketFactory factory = MarketFactory(vm.envAddress("FACTORY_ADDRESS"));
        ParaapeTestnetLocker locker = ParaapeTestnetLocker(vm.envAddress("LOCKER_ADDRESS"));
        V4LiquidityRouter router = V4LiquidityRouter(vm.envAddress("V4_ROUTER_ADDRESS"));
        // Default 10 USDG; override with DEMO_POOL_USDG (6 decimals).
        uint256 poolUsdg = vm.envOr("DEMO_POOL_USDG", uint256(10e6));
        require(poolUsdg > 0 && poolUsdg <= uint256(uint128(type(int128).max)), "DeployDemoMarket: L");
        require(usdg.balanceOf(deployer) >= poolUsdg, "DeployDemoMarket: USDG");

        vm.startBroadcast(pk);

        DemoToken meme = new DemoToken("PARAAPE DEMO", "PAPE", 18);
        meme.mint(deployer, 1_000_000_000e18);

        address c0 = address(meme) < address(usdg) ? address(meme) : address(usdg);
        address c1 = address(meme) < address(usdg) ? address(usdg) : address(meme);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        router.initialize(key, TickMath.getSqrtPriceAtTick(0));
        meme.approve(address(router), type(uint256).max);
        usdg.approve(address(router), type(uint256).max);

        int24 spacing = 60;
        router.addLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: TickMath.minUsableTick(spacing),
                tickUpper: TickMath.maxUsableTick(spacing),
                liquidityDelta: int256(poolUsdg),
                salt: bytes32(0)
            })
        );

        bytes32 poolRef = PoolId.unwrap(key.toId());
        locker.registerPool(poolRef, ProtocolConfigLib.defaults().minDepthUsdg, "");
        address vault =
            factory.createMarket(key, address(meme), address(locker), deployer, address(0));

        vm.stopBroadcast();
        console2.log("meme", address(meme));
        console2.log("poolRef");
        console2.logBytes32(poolRef);
        console2.log("vault", vault);
    }
}
