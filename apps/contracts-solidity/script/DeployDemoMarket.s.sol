// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {ParaapeTestnetLocker} from "../src/adapters/ParaapeTestnetLocker.sol";
import {V4LiquidityRouter} from "../src/testnet/V4LiquidityRouter.sol";
import {DemoGradPool} from "../src/testnet/DemoGradPool.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {DemoToken} from "../src/testnet/DemoToken.sol";
import {LiquidityAmounts} from "../lib/v4-core/test/utils/LiquidityAmounts.sol";

using PoolIdLibrary for PoolKey;

/// @dev Graduate-style meme pool: 1B PAPE (18 dec) + 10k USDG (6 dec) full-range LP.
/// Init tick derived from deposit ratio (not hand-set $1/PAPE). Mcap = price × circulating; with 100% in LP, FDV ≈ quote side at init.
/// `registerPool` attests factory minDepth (25k USDG testnet); V4 reserves = actual deposit.
contract DeployDemoMarket is Script {
    uint256 internal constant DEFAULT_LP_PAPE = 1_000_000_000e18;
    uint256 internal constant DEFAULT_LP_USDG = 10_000e6;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IERC20 usdg = IERC20(vm.envAddress("USDG_ADDRESS"));
        MarketFactory factory = MarketFactory(vm.envAddress("FACTORY_ADDRESS"));
        ParaapeTestnetLocker locker = ParaapeTestnetLocker(vm.envAddress("LOCKER_ADDRESS"));
        V4LiquidityRouter router = V4LiquidityRouter(vm.envAddress("V4_ROUTER_ADDRESS"));

        uint256 lpUsdg = vm.envOr("DEMO_POOL_USDG", DEFAULT_LP_USDG);
        uint256 lpPape = vm.envOr("DEMO_LP_PAPE", DEFAULT_LP_PAPE);
        require(lpUsdg > 0 && lpPape > 0, "DeployDemoMarket: amounts");
        require(usdg.balanceOf(deployer) >= lpUsdg, "DeployDemoMarket: USDG");

        vm.startBroadcast(pk);

        DemoToken meme = new DemoToken("PARAAPE DEMO", "PAPE", 18);
        meme.mint(deployer, lpPape);

        address c0 = address(meme) < address(usdg) ? address(meme) : address(usdg);
        address c1 = address(meme) < address(usdg) ? address(usdg) : address(meme);
        bool memeIsCurrency0 = address(meme) == c0;

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        int24 spacing = key.tickSpacing;
        uint256 amount0 = memeIsCurrency0 ? lpPape : lpUsdg;
        uint256 amount1 = memeIsCurrency0 ? lpUsdg : lpPape;

        uint160 sqrtP = DemoGradPool.sqrtPriceX96FromAmounts(amount0, amount1);
        int24 initTick;
        if (vm.envExists("DEMO_INIT_TICK")) {
            initTick = int24(int256(vm.envOr("DEMO_INIT_TICK", int256(0))));
        } else {
            initTick = DemoGradPool.snapTick(TickMath.getTickAtSqrtPrice(sqrtP), spacing);
        }
        require(initTick >= TickMath.MIN_TICK && initTick <= TickMath.MAX_TICK, "DeployDemoMarket: tick");
        require(initTick % spacing == 0, "DeployDemoMarket: tick spacing");
        sqrtP = TickMath.getSqrtPriceAtTick(initTick);

        int24 tickLower = TickMath.minUsableTick(spacing);
        int24 tickUpper = TickMath.maxUsableTick(spacing);
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtP, sqrtLower, sqrtUpper, amount0, amount1
        );
        require(liquidity > 0, "DeployDemoMarket: liquidity");

        router.initialize(key, sqrtP);
        console2.log("memeIsCurrency0", memeIsCurrency0);
        console2.logInt(initTick);
        console2.log("lpUsdg", lpUsdg);
        console2.log("lpPape", lpPape);
        console2.log("liquidity", liquidity);
        console2.log("priceUsdgPerToken1e18", DemoGradPool.impliedUsdgPerToken1e18(lpPape, lpUsdg));
        console2.log("fdvUsdg6_at_1B_float", DemoGradPool.fdvUsdg6(lpPape, lpUsdg, lpPape));

        meme.approve(address(router), type(uint256).max);
        usdg.approve(address(router), type(uint256).max);

        router.addLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
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
