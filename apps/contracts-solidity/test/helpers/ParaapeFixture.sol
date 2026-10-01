// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockTickSource} from "../mocks/MockTickSource.sol";
import {InsuranceVault} from "../../src/InsuranceVault.sol";
import {PriceObserver} from "../../src/oracle/PriceObserver.sol";
import {V4PriceSource} from "../../src/oracle/V4PriceSource.sol";
import {ParaapeRiskEngine} from "../../src/risk/ParaapeRiskEngine.sol";
import {ProtocolConfig, ProtocolConfigLib} from "../../src/ProtocolConfig.sol";
import {VaultTestHelper} from "./VaultTestHelper.sol";

contract ParaapeFixture is Test {
    MockERC20 internal usdg;
    MockERC20 internal memecoin;
    MockTickSource internal tickSource;
    PriceObserver internal observer;
    V4PriceSource internal priceSource;
    ParaapeRiskEngine internal riskEngine;
    VaultTestHelper internal helper;
    address internal vaultAddr;

    bytes32 internal constant POOL = keccak256("demo-pool");
    address internal lp = makeAddr("lp");
    address internal buyer = makeAddr("buyer");
    address internal guardian = makeAddr("guardian");
    uint256 internal clock;

    function setUp() public virtual {
        usdg = new MockERC20("USDG", "USDG", 6);
        memecoin = new MockERC20("HOODRAT", "HOOD", 18);
        tickSource = new MockTickSource();
        riskEngine = new ParaapeRiskEngine();
        helper = new VaultTestHelper();
        observer = new PriceObserver(tickSource, 9116, 30);
        priceSource = new V4PriceSource(observer, bytes32(0), true);
        tickSource.setTick(POOL, 0);
        _seedOracle(POOL);
        memecoin.mint(makeAddr("float"), 99_000_000e18);
        memecoin.mint(buyer, 1_000_000e18);
        vaultAddr = _deployMarket(
            address(0xdE00000000000000000000000000000000000000),
            address(0x1100000000000000000000000000000000000001),
            ProtocolConfigLib.defaults()
        );
        _fundLp(vaultAddr);
        clock = block.timestamp;
    }

    function _deployMarket(address tokenDeployer, address launchpadCreator, ProtocolConfig memory config)
        internal
        returns (address)
    {
        return helper.deployVault(
            address(this),
            guardian,
            usdg,
            memecoin,
            POOL,
            priceSource,
            riskEngine,
            observer,
            500_000e6,
            tokenDeployer,
            launchpadCreator,
            config
        );
    }

    function _seedOracle(bytes32 pool) internal {
        vm.warp(100 days);
        observer.record(pool);
        vm.warp(100 days + 1 hours);
        observer.record(pool);
        vm.warp(100 days + 2 hours);
        observer.record(pool);
        vm.warp(100 days + 2 hours + 31);
    }

    function _record(int24 tick) internal {
        tickSource.setTick(POOL, tick);
        clock += 31;
        vm.warp(clock);
        vm.roll(block.number + 1);
        observer.record(POOL);
    }

    function _fundLp(address vault) internal {
        usdg.mint(lp, 200_000e6);
        vm.startPrank(lp);
        usdg.approve(vault, type(uint256).max);
        InsuranceVault(vault).deposit(4, 0, 50_000e6);
        vm.stopPrank();
    }
}
