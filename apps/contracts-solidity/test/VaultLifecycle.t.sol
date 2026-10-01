// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ParaapeFixture} from "./helpers/ParaapeFixture.sol";
import {InsuranceVault} from "../src/InsuranceVault.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {Pricing} from "../src/libraries/Pricing.sol";
import {TriggerLib} from "../src/libraries/TriggerLib.sol";
import {OracleLib} from "../src/libraries/OracleLib.sol";

contract VaultLifecycleTest is ParaapeFixture {
    uint8 constant SEV_90 = 4;
    uint8 constant WIN_5M = 0;
    uint8 constant DUR_7D = 2;

    function _buy() internal returns (uint256 id) {
        usdg.mint(buyer, 20_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        id = InsuranceVault(vaultAddr).purchasePolicy(SEV_90, WIN_5M, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function _waitActiveAndMarkT0() internal returns (uint256 t0) {
        uint32 L = TriggerLib.measurementTwapLength(WIN_5M);
        uint256 activeFrom = block.timestamp + ProtocolConfigLib.defaults().activationDelay;
        while (block.timestamp < activeFrom + L) {
            _record(0);
        }
        t0 = block.timestamp;
    }

    function _crashAndPersist(uint256 t0) internal returns (uint256 t1) {
        tickSource.setTick(POOL, -27_348);
        _record(-27_348);
        _record(-27_348);
        _record(-27_348);
        _record(-27_348);
        _record(-27_348);
        t1 = block.timestamp;
        require(t1 > t0 && t1 - t0 <= 5 minutes, "test timeline");
        _record(-27_348);
        _record(-27_348);
        _record(-27_348);
    }

    function test_SettleThenReleasePaysBuyer() public {
        uint256 id = _buy();
        uint256 t0 = _waitActiveAndMarkT0();
        uint256 t1 = _crashAndPersist(t0);

        InsuranceVault vault = InsuranceVault(vaultAddr);
        vault.settle(id, t0, t1);
        InsuranceVault.Policy memory pending = vault.getPolicy(id);
        assertEq(uint256(pending.status), uint256(InsuranceVault.PolicyStatus.PendingPayout));
        assertGt(pending.pendingPayout, 0);
        assertLe(pending.pendingPayout, 5_000e6);

        uint256 buyerBefore = usdg.balanceOf(buyer);
        vm.warp(block.timestamp + ProtocolConfigLib.defaults().challengePeriod + 1);
        vault.release(id);
        InsuranceVault.Policy memory paid = vault.getPolicy(id);
        assertEq(uint256(paid.status), uint256(InsuranceVault.PolicyStatus.Paid));
        assertEq(usdg.balanceOf(buyer), buyerBefore + pending.pendingPayout);
    }

    function test_ChallengeUpheldReturnsBondAndVoids() public {
        uint256 id = _buy();
        uint256 t0 = _waitActiveAndMarkT0();
        uint256 t1 = _crashAndPersist(t0);
        InsuranceVault vault = InsuranceVault(vaultAddr);
        vault.settle(id, t0, t1);

        address challenger = makeAddr("challenger");
        usdg.mint(challenger, 500e6);
        vm.startPrank(challenger);
        usdg.approve(vaultAddr, type(uint256).max);
        vault.challenge(id);
        vm.stopPrank();

        uint256 chalBefore = usdg.balanceOf(challenger);
        vm.prank(guardian);
        vault.resolveChallengeUpheld(id);
        assertEq(uint256(vault.getPolicy(id).status), uint256(InsuranceVault.PolicyStatus.Void));
        assertGt(usdg.balanceOf(challenger), chalBefore);
    }

    function test_InsiderCannotBuy() public {
        address deployer = buyer;
        address vault = _deployMarket(deployer, makeAddr("pad"), ProtocolConfigLib.defaults());
        _fundLp(vault);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vault, type(uint256).max);
        vm.expectRevert("InsuranceVault: insider");
        InsuranceVault(vault).purchasePolicy(SEV_90, WIN_5M, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function test_ConcentrationLimit() public {
        memecoin.mint(buyer, 2_000_000e18);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        vm.expectRevert("InsuranceVault: concentration");
        InsuranceVault(vaultAddr).purchasePolicy(SEV_90, WIN_5M, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function test_OverInsuranceReverts() public {
        address poor = makeAddr("poor");
        memecoin.mint(poor, 1e9);
        usdg.mint(poor, 10_000e6);
        vm.startPrank(poor);
        usdg.approve(vaultAddr, type(uint256).max);
        vm.expectRevert("InsuranceVault: over-insurance");
        InsuranceVault(vaultAddr).purchasePolicy(SEV_90, WIN_5M, DUR_7D, 5_000e6, 1);
        vm.stopPrank();
    }

    function test_EntryGuardRevertsOnRecentDump() public {
        tickSource.setTick(POOL, -27_348);
        for (uint256 i; i < 12; i++) {
            _record(-27_348);
        }
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        vm.expectRevert("InsuranceVault: entry guard");
        InsuranceVault(vaultAddr).purchasePolicy(SEV_90, WIN_5M, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function test_WithdrawLockedCapitalReverts() public {
        _buy();
        vm.startPrank(lp);
        vm.expectRevert("InsuranceVault: locked");
        InsuranceVault(vaultAddr).withdraw(SEV_90, WIN_5M, 50_000e6);
        vm.stopPrank();
    }

    function test_MeetsSeverityDrop90() public pure {
        int24 crash = OracleLib.maxDownTickDelta(9000);
        assertTrue(Pricing.meetsSeverityDrop(0, crash, 9000, true));
        assertFalse(Pricing.meetsSeverityDrop(0, -1_000, 9000, true));
    }
}
