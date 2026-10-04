// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockTickSource} from "./mocks/MockTickSource.sol";
import {GridLib} from "../src/libraries/GridLib.sol";
import {Pricing} from "../src/libraries/Pricing.sol";
import {InsuranceVault} from "../src/InsuranceVault.sol";
import {PriceObserver} from "../src/oracle/PriceObserver.sol";
import {V4PriceSource} from "../src/oracle/V4PriceSource.sol";
import {ParaapeRiskEngine} from "../src/risk/ParaapeRiskEngine.sol";
import {ParaapeTestnetLocker} from "../src/adapters/ParaapeTestnetLocker.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {VaultTestHelper} from "./helpers/VaultTestHelper.sol";

contract ParaapeTest is Test {
    MockERC20 usdg;
    MockERC20 memecoin;
    MockTickSource tickSource;
    PriceObserver observer;
    V4PriceSource priceSource;
    ParaapeRiskEngine riskEngine;
    VaultTestHelper helper;
    address vaultAddr;

    bytes32 constant POOL = keccak256("demo-pool");
    address lp = makeAddr("lp");
    address buyer = makeAddr("buyer");

    function setUp() public {
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

        vaultAddr = helper.deployVault(
            address(this),
            makeAddr("guardian"),
            usdg,
            memecoin,
            POOL,
            priceSource,
            riskEngine,
            observer,
            500_000e6,
            ProtocolConfigLib.defaults()
        );

        usdg.mint(lp, 100_000e6);
        vm.startPrank(lp);
        usdg.approve(vaultAddr, type(uint256).max);
        InsuranceVault(vaultAddr).deposit(4, 50_000e6);
        vm.stopPrank();
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

    function test_GridDominance() public pure {
        assertTrue(GridLib.cellBacksPolicy(4, 4));
        assertFalse(GridLib.cellBacksPolicy(4, 3));
        assertTrue(GridLib.cellBacksPolicy(2, 4));
        assertEq(GridLib.severityBps(5), 9500);
        assertEq(GridLib.severityBps(4), 9000);
    }

    function test_DepthFullRangeMatchesPRD() public view {
        uint256 y = 100_000e6;
        uint256 d50 = riskEngine.depthFullRange(y, 5000);
        uint256 d95 = riskEngine.depthFullRange(y, 9500);
        assertApproxEqRel(d50, 29_289e6, 0.01e18);
        assertApproxEqRel(d95, 77_639e6, 0.01e18);
        assertGt(d95, d50);
    }

    function test_StricterFlashTriggerHigherPremium() public view {
        uint256 sigma = 7e13;
        uint256 p90 = riskEngine.quotePremium(bytes32(0), sigma, 9000, 5 minutes, 7 days, 5_000e6, 0);
        uint256 p50 = riskEngine.quotePremium(bytes32(0), sigma, 5000, 5 minutes, 7 days, 5_000e6, 0);
        assertGt(p90, p50);
        assertLt(p50, 5_000e6 / 2);
    }

    function test_PurchasePolicy() public {
        InsuranceVault vault = InsuranceVault(vaultAddr);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        uint256 id = vault.purchasePolicy(4, 2, 5_000e6, 5_000e6);
        vm.stopPrank();
        InsuranceVault.Policy memory p = vault.getPolicy(id);
        assertEq(p.buyer, buyer);
        assertEq(p.coverageUsdg, 5_000e6);
        assertGt(p.premiumUsdg, 0);
        assertLt(p.premiumUsdg, 2_500e6);
    }

    function test_LockerOnlyOwner() public {
        ParaapeTestnetLocker locker = new ParaapeTestnetLocker(address(this));
        locker.registerPool(POOL, 1, "");
        vm.prank(buyer);
        vm.expectRevert("Locker: owner");
        locker.registerPool(keccak256("x"), 1, "");
    }

    function test_WithdrawProtocolFees() public {
        InsuranceVault vault = InsuranceVault(vaultAddr);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        vault.purchasePolicy(4, 2, 5_000e6, 5_000e6);
        vm.stopPrank();
        uint256 fees = vault.protocolFeesAccrued();
        assertGt(fees, 0);
        address guardian = makeAddr("guardian");
        vm.prank(guardian);
        vault.withdrawProtocolFees(guardian, fees);
        assertEq(usdg.balanceOf(guardian), fees);
    }

    function test_EmptyLiquidityStateUsesFullRangeDepth() public view {
        uint256 concentrated = riskEngine.depthConcentrated(9000, "");
        assertEq(concentrated, 0);
        uint256 full = riskEngine.depthFullRange(500_000e6, 9000);
        assertGt(full, 0);
    }

    function test_ExpireAccruesRemainingPremium() public {
        InsuranceVault vault = InsuranceVault(vaultAddr);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        uint256 id = vault.purchasePolicy(4, 2, 5_000e6, 5_000e6);
        vm.stopPrank();

        InsuranceVault.Policy memory beforeP = vault.getPolicy(id);
        bytes32 key = GridLib.cellKey(4);
        (uint256 assetsBefore,,) = vault.cells(key);

        vm.warp(block.timestamp + 8 days);
        vault.expirePolicy(id);

        InsuranceVault.Policy memory afterP = vault.getPolicy(id);
        assertEq(uint256(afterP.status), uint256(InsuranceVault.PolicyStatus.Expired));
        assertEq(afterP.lpPremiumAccrued, afterP.lpPremiumTotal);
        (uint256 assetsAfter,,) = vault.cells(key);
        assertEq(assetsAfter, assetsBefore + beforeP.lpPremiumTotal);
    }

    function test_DurationGrid() public pure {
        assertEq(GridLib.durationSeconds(0), 1 days);
        assertEq(GridLib.durationSeconds(2), 7 days);
        assertEq(GridLib.durationSeconds(4), 30 days);
    }

    function test_QuoteToUsdgPassthrough() public pure {
        uint256 q = 12_345e6;
        assertEq(Pricing.quoteToUsdgAmount(q, true, 0, true), q);
    }
}
