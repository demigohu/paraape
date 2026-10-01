// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {PoolSlot0Stub} from "./helpers/PoolSlot0Stub.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {VaultDeployer} from "../src/VaultDeployer.sol";
import {PriceObserver} from "../src/oracle/PriceObserver.sol";
import {V4PriceSource} from "../src/oracle/V4PriceSource.sol";
import {V4PoolTickSource} from "../src/oracle/V4PoolTickSource.sol";
import {ParaapeRiskEngine} from "../src/risk/ParaapeRiskEngine.sol";
import {ParaapeTestnetLocker} from "../src/adapters/ParaapeTestnetLocker.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {InsuranceVault} from "../src/InsuranceVault.sol";

using PoolIdLibrary for PoolKey;

contract FactoryTest is Test {
    MockERC20 usdg;
    MockERC20 meme;
    PoolSlot0Stub stub;
    MarketFactory factory;
    ParaapeTestnetLocker locker;
    PriceObserver observer;

    function setUp() public {
        usdg = new MockERC20("USDG", "USDG", 6);
        meme = new MockERC20("HOOD", "HOOD", 18);
        stub = new PoolSlot0Stub();
        ParaapeRiskEngine engine = new ParaapeRiskEngine();
        V4PoolTickSource ticks = new V4PoolTickSource(IPoolManager(address(stub)));
        observer = new PriceObserver(ticks, 9116, 30);
        V4PriceSource prices = new V4PriceSource(observer, bytes32(0), true);
        locker = new ParaapeTestnetLocker(address(this));
        factory = new MarketFactory(
            usdg,
            new MockERC20("WETH", "WETH", 18),
            engine,
            observer,
            prices,
            IPoolManager(address(stub)),
            new VaultDeployer(),
            bytes32(0),
            true,
            address(this),
            ProtocolConfigLib.defaults()
        );
        factory.setLockAdapter(address(locker), true);
        vm.warp(100 days);
    }

    function _key() internal view returns (PoolKey memory key) {
        address a = address(meme);
        address b = address(usdg);
        (address c0, address c1) = a < b ? (a, b) : (b, a);
        key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function test_CreateMarketBindsVault() public {
        PoolKey memory key = _key();
        bytes32 poolRef = PoolId.unwrap(key.toId());
        stub.setSlot0(poolRef, TickMath.getSqrtPriceAtTick(0), 0);
        locker.registerPool(poolRef, 100_000e6, "");

        address vault = factory.createMarket(key, address(meme), address(locker), makeAddr("deployer"), makeAddr("pad"));
        assertEq(factory.vaultByToken(address(meme)), vault);
        assertEq(address(InsuranceVault(vault).insuredToken()), address(meme));
        assertEq(InsuranceVault(vault).tokenIsCurrency0(), address(meme) < address(usdg));
        assertTrue(InsuranceVault(vault).quoteIsUsdg());
    }

    function test_DuplicateMarketReverts() public {
        PoolKey memory key = _key();
        bytes32 poolRef = PoolId.unwrap(key.toId());
        stub.setSlot0(poolRef, TickMath.getSqrtPriceAtTick(0), 0);
        locker.registerPool(poolRef, 100_000e6, "");
        factory.createMarket(key, address(meme), address(locker), address(0), address(0));
        vm.expectRevert("MarketFactory: exists");
        factory.createMarket(key, address(meme), address(locker), address(0), address(0));
    }

    function test_UnlockedPoolReverts() public {
        PoolKey memory key = _key();
        bytes32 poolRef = PoolId.unwrap(key.toId());
        stub.setSlot0(poolRef, TickMath.getSqrtPriceAtTick(0), 0);
        vm.expectRevert("MarketFactory: not locked");
        factory.createMarket(key, address(meme), address(locker), address(0), address(0));
    }

    function test_MinDepthReverts() public {
        PoolKey memory key = _key();
        bytes32 poolRef = PoolId.unwrap(key.toId());
        stub.setSlot0(poolRef, TickMath.getSqrtPriceAtTick(0), 0);
        locker.registerPool(poolRef, 1_000e6, "");
        vm.expectRevert("MarketFactory: min depth");
        factory.createMarket(key, address(meme), address(locker), address(0), address(0));
    }
}
