// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ParaapeFixture} from "./helpers/ParaapeFixture.sol";
import {InsuranceVault} from "../src/InsuranceVault.sol";
import {ProtocolConfigLib} from "../src/ProtocolConfig.sol";
import {Pricing} from "../src/libraries/Pricing.sol";
import {OracleLib} from "../src/libraries/OracleLib.sol";

contract VaultLifecycleTest is ParaapeFixture {
    uint8 constant SEV_90 = 4;
    uint8 constant DUR_7D = 2;

    function _buy() internal returns (uint256 id) {
        usdg.mint(buyer, 20_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        id = InsuranceVault(vaultAddr).purchasePolicy(SEV_90, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function _waitActive() internal {
        // Loop on `clock`. via_ir treats `block.timestamp` as invariant inside a call, so a
        // while condition on it never sees vm.warp.
        uint256 activeFrom = clock + ProtocolConfigLib.defaults().activationDelay;
        while (clock < activeFrom) {
            _record(0);
        }
    }

    /// @dev Hold the crash longer than the 5-minute claim TWAP, with K samples still down.
    function _crashAndPersist() internal {
        tickSource.setTick(POOL, -27_348);
        for (uint256 i; i < 15; i++) {
            _record(-27_348);
        }
    }

    function test_SettleThenReleasePaysBuyer() public {
        uint256 id = _buy();
        _waitActive();
        _crashAndPersist();

        InsuranceVault vault = InsuranceVault(vaultAddr);
        vault.settle(id);
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

    function test_ChallengeVoidsWhenDropRecovers() public {
        uint256 id = _buy();
        _waitActive();
        _crashAndPersist();
        InsuranceVault vault = InsuranceVault(vaultAddr);
        vault.settle(id);

        for (uint256 i; i < 15; i++) {
            _record(0);
        }

        uint256 lpBefore = usdg.balanceOf(lp);
        vm.prank(lp);
        vault.challenge(id);
        assertEq(uint256(vault.getPolicy(id).status), uint256(InsuranceVault.PolicyStatus.Void));
        assertEq(usdg.balanceOf(lp), lpBefore);
    }

    function test_ChallengeStillDownChargesSpamFee() public {
        uint256 id = _buy();
        _waitActive();
        _crashAndPersist();
        InsuranceVault vault = InsuranceVault(vaultAddr);
        vault.settle(id);

        uint256 lpBefore = usdg.balanceOf(lp);
        uint256 feesBefore = vault.protocolFeesAccrued();
        vm.prank(lp);
        vault.challenge(id);

        assertEq(uint256(vault.getPolicy(id).status), uint256(InsuranceVault.PolicyStatus.PendingPayout));
        assertEq(usdg.balanceOf(lp), lpBefore - ProtocolConfigLib.defaults().challengeSpamFeeUsdg);
        assertEq(vault.protocolFeesAccrued(), feesBefore + ProtocolConfigLib.defaults().challengeSpamFeeUsdg);
    }

    function test_BuyerCannotChallenge() public {
        uint256 id = _buy();
        _waitActive();
        _crashAndPersist();
        InsuranceVault vault = InsuranceVault(vaultAddr);
        vault.settle(id);

        vm.prank(buyer);
        vm.expectRevert("InsuranceVault: buyer");
        vault.challenge(id);
    }

    function test_InsiderCannotBuy() public {
        address deployer = buyer;
        address vault = _deployMarket(deployer, makeAddr("pad"), ProtocolConfigLib.defaults());
        _fundLp(vault);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vault, type(uint256).max);
        vm.expectRevert("InsuranceVault: insider");
        InsuranceVault(vault).purchasePolicy(SEV_90, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function test_ConcentrationLimit() public {
        memecoin.mint(buyer, 2_000_000e18);
        usdg.mint(buyer, 10_000e6);
        vm.startPrank(buyer);
        usdg.approve(vaultAddr, type(uint256).max);
        vm.expectRevert("InsuranceVault: concentration");
        InsuranceVault(vaultAddr).purchasePolicy(SEV_90, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function test_OverInsuranceReverts() public {
        address poor = makeAddr("poor");
        memecoin.mint(poor, 1e9);
        usdg.mint(poor, 10_000e6);
        vm.startPrank(poor);
        usdg.approve(vaultAddr, type(uint256).max);
        vm.expectRevert("InsuranceVault: over-insurance");
        InsuranceVault(vaultAddr).purchasePolicy(SEV_90, DUR_7D, 5_000e6, 1);
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
        InsuranceVault(vaultAddr).purchasePolicy(SEV_90, DUR_7D, 5_000e6, 5_000e6);
        vm.stopPrank();
    }

    function test_WithdrawLockedCapitalReverts() public {
        _buy();
        vm.startPrank(lp);
        vm.expectRevert("InsuranceVault: locked");
        InsuranceVault(vaultAddr).withdraw(SEV_90, 50_000e6);
        vm.stopPrank();
    }

    function test_MeetsSeverityDrop90() public pure {
        int24 crash = OracleLib.maxDownTickDelta(9000);
        assertTrue(Pricing.meetsSeverityDrop(0, crash, 9000, true));
        assertFalse(Pricing.meetsSeverityDrop(0, -1_000, 9000, true));
    }
}
