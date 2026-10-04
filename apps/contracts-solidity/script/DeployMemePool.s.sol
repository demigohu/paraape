// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

/// @notice New meme + V4 pool + locked-liquidity attestation. Does not call MarketFactory.createMarket.
///         Underwrite in the app opens the vault on first deposit.
contract DeployMemePool is Script {
    uint256 internal constant DEFAULT_LP_PAPE = 1_000_000_000e18;
    uint256 internal constant DEFAULT_LP_USDG = 10_000e6;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IERC20 usdg = IERC20(vm.envAddress("USDG_ADDRESS"));
        ParaapeTestnetLocker locker = ParaapeTestnetLocker(vm.envAddress("LOCKER_ADDRESS"));
        V4LiquidityRouter router = V4LiquidityRouter(vm.envAddress("V4_ROUTER_ADDRESS"));

        uint256 lpUsdg = vm.envOr("DEMO_POOL_USDG", DEFAULT_LP_USDG);
        uint256 lpPape = vm.envOr("DEMO_LP_PAPE", DEFAULT_LP_PAPE);
        string memory name = vm.envOr("MEME_NAME", string("FRESH MEME"));
        string memory symbol = vm.envOr("MEME_SYMBOL", string("FRESH"));
        require(lpUsdg > 0 && lpPape > 0, "DeployMemePool: amounts");
        require(usdg.balanceOf(deployer) >= lpUsdg, "DeployMemePool: USDG");

        vm.startBroadcast(pk);

        DemoToken meme = new DemoToken(name, symbol, 18);
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
        int24 initTick = DemoGradPool.snapTick(TickMath.getTickAtSqrtPrice(sqrtP), spacing);
        require(initTick >= TickMath.MIN_TICK && initTick <= TickMath.MAX_TICK, "DeployMemePool: tick");
        require(initTick % spacing == 0, "DeployMemePool: tick spacing");
        sqrtP = TickMath.getSqrtPriceAtTick(initTick);

        int24 tickLower = TickMath.minUsableTick(spacing);
        int24 tickUpper = TickMath.maxUsableTick(spacing);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtP,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amount0,
            amount1
        );
        require(liquidity > 0, "DeployMemePool: liquidity");

        router.initialize(key, sqrtP);
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
        // Attest the factory floor so a later permissionless createMarket can pass the depth check.
        // Actual V4 reserves stay at DEMO_POOL_USDG.
        locker.registerPool(poolRef, ProtocolConfigLib.defaults().minDepthUsdg, "");

        vm.stopBroadcast();

        console2.log("meme", address(meme));
        console2.log("symbol", symbol);
        console2.log("memeIsCurrency0", memeIsCurrency0);
        console2.log("poolRef");
        console2.logBytes32(poolRef);
        console2.log("vault", address(0));
    }
}
