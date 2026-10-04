// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {VaultDeployer} from "../src/VaultDeployer.sol";
import {PriceObserver} from "../src/oracle/PriceObserver.sol";
import {V4PriceSource} from "../src/oracle/V4PriceSource.sol";
import {V4ChainlinkPriceSource} from "../src/oracle/V4ChainlinkPriceSource.sol";
import {V4PoolTickSource} from "../src/oracle/V4PoolTickSource.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {ParaapeRiskEngine} from "../src/risk/ParaapeRiskEngine.sol";
import {BoundedRiskEngine} from "../src/risk/BoundedRiskEngine.sol";
import {ParaapeTestnetLocker} from "../src/adapters/ParaapeTestnetLocker.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {V4LiquidityRouter} from "../src/testnet/V4LiquidityRouter.sol";
import {V4SwapRouter} from "../src/testnet/V4SwapRouter.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IRiskEngine} from "../src/interfaces/IRiskEngine.sol";
import {IPriceSource} from "../src/interfaces/IPriceSource.sol";
import {console2} from "forge-std/console2.sol";

contract DeployParaape is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address guardian = vm.envOr("GUARDIAN_ADDRESS", vm.addr(pk));
        vm.startBroadcast(pk);

        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER_ADDRESS"));
        IRiskEngine engineImpl;
        address stylus = vm.envOr("STYLUS_RISK_ENGINE", address(0));
        if (stylus != address(0)) {
            engineImpl = IRiskEngine(stylus);
        } else {
            engineImpl = new ParaapeRiskEngine();
        }
        BoundedRiskEngine riskEngine = new BoundedRiskEngine(engineImpl, ProtocolConfigLib.defaults().maxPremiumBps);
        V4PoolTickSource tickSource = new V4PoolTickSource(poolManager);
        PriceObserver observer = new PriceObserver(
            tickSource, ProtocolConfigLib.defaults().maxTickMove, ProtocolConfigLib.defaults().minRecordInterval
        );
        bytes32 wethUsdgPool = vm.envBytes32("WETH_USDG_POOL_ID");
        bool wethIsC0 = vm.envOr("WETH_IS_CURRENCY0", true);
        address chainlinkFeed = vm.envOr("CHAINLINK_ETH_USD_FEED", address(0));

        IPriceSource priceSource;
        if (chainlinkFeed != address(0)) {
            priceSource = IPriceSource(
                address(
                    new V4ChainlinkPriceSource(
                        observer, wethUsdgPool, wethIsC0, AggregatorV3Interface(chainlinkFeed)
                    )
                )
            );
        } else {
            priceSource = IPriceSource(address(new V4PriceSource(observer, wethUsdgPool, wethIsC0)));
        }

        ParaapeTestnetLocker locker = new ParaapeTestnetLocker(guardian);
        VaultDeployer vaultDeployer = new VaultDeployer();

        MarketFactory factory = new MarketFactory(
            IERC20(vm.envAddress("USDG_ADDRESS")),
            IERC20(vm.envAddress("WETH_ADDRESS")),
            riskEngine,
            observer,
            priceSource,
            poolManager,
            vaultDeployer,
            wethUsdgPool,
            wethIsC0,
            guardian,
            ProtocolConfigLib.defaults()
        );
        factory.setLockAdapter(address(locker), true);
        V4LiquidityRouter router = new V4LiquidityRouter(poolManager);
        V4SwapRouter swapRouter = new V4SwapRouter(poolManager);

        vm.stopBroadcast();
        console2.log("riskEngine", address(riskEngine));
        console2.log("observer", address(observer));
        console2.log("priceSource", address(priceSource));
        console2.log("locker", address(locker));
        console2.log("factory", address(factory));
        console2.log("router", address(router));
        console2.log("swapRouter", address(swapRouter));
    }
}
