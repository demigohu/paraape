// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {GridLib} from "./libraries/GridLib.sol";
import {TriggerLib} from "./libraries/TriggerLib.sol";
import {OracleLib} from "./libraries/OracleLib.sol";
import {Pricing} from "./libraries/Pricing.sol";
import {PremiumAccrual} from "./libraries/PremiumAccrual.sol";
import {V4Depth} from "./libraries/V4Depth.sol";
import {ProtocolConfig} from "./ProtocolConfig.sol";
import {MarketParams, DepthSnapshot} from "./MarketTypes.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {IRiskEngine} from "./interfaces/IRiskEngine.sol";
import {PriceObserver} from "./oracle/PriceObserver.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title InsuranceVault — per-token isolated vault (PRD §13)
contract InsuranceVault {
    using SafeERC20 for IERC20;

    enum PolicyStatus {
        None,
        Active,
        PendingPayout,
        Challenged,
        Paid,
        Void,
        Expired
    }

    struct RiskCell {
        uint256 totalAssets;
        uint256 lockedAssets;
        uint256 totalShares;
    }

    struct Policy {
        address buyer;
        uint8 severityIdx;
        uint8 windowIdx;
        uint8 durationIdx;
        uint256 coverageUsdg;
        uint256 premiumUsdg;
        uint256 lpPremiumTotal;
        uint256 lpPremiumAccrued;
        uint256 coveredTokens;
        uint256 purchasedAt;
        uint256 activeFrom;
        uint256 expiry;
        PolicyStatus status;
        uint256 pendingPayout;
        uint256 challengeDeadline;
        address challenger;
        uint256 challengeBond;
    }

    IERC20 public immutable usdg;
    IERC20 public immutable insuredToken;
    bytes32 public immutable poolRef;
    bytes32 public immutable quoteToUsdgPoolRef;
    bytes private _liquidityState;
    IPriceSource public immutable priceSource;
    IRiskEngine public immutable riskEngine;
    PriceObserver public immutable observer;
    IPoolManager public immutable poolManager;
    address public immutable tokenDeployer;
    address public immutable launchpadCreator;
    uint256 public immutable lockedQuoteDepth;
    int24 public immutable tickSpacing;
    bool public immutable tokenIsCurrency0;
    bool public immutable quoteIsUsdg;
    bool public immutable wethIsCurrency0;
    uint8 public immutable tokenDecimals;
    uint8 public immutable quoteDecimals;

    ProtocolConfig public config;
    address public guardian;
    address public factory;

    mapping(bytes32 cellKey => RiskCell) public cells;
    mapping(bytes32 cellKey => mapping(address lp => uint256 shares)) public lpShares;
    mapping(uint256 policyId => Policy) public policies;
    mapping(uint256 policyId => bytes32[] cellKeys) internal policyCells;
    mapping(uint256 policyId => uint256[] cellAmounts) internal policyCellAmounts;
    mapping(uint8 severityIdx => uint256 totalActiveCoverage) public coverageBySeverityFloor;

    uint256 public nextPolicyId = 1;
    uint256 public protocolFeesAccrued;
    uint256 public activePolicyCount;

    event CellDeposit(address indexed lp, bytes32 indexed cellKey, uint256 assets, uint256 shares);
    event CellWithdraw(address indexed lp, bytes32 indexed cellKey, uint256 assets, uint256 shares);
    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed buyer,
        uint8 severityIdx,
        uint8 windowIdx,
        uint256 coverageUsdg,
        uint256 premiumUsdg
    );
    event PolicySettled(uint256 indexed policyId, uint256 payout, uint256 challengeDeadline);
    event PolicyChallenged(uint256 indexed policyId, address indexed challenger, uint256 bond);
    event PolicyReleased(uint256 indexed policyId, uint256 payout);
    event PolicyVoided(uint256 indexed policyId);
    event PolicyExpired(uint256 indexed policyId);
    event RecordBountyPaid(address indexed recorder, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

    modifier onlyGuardian() {
        require(msg.sender == guardian, "InsuranceVault: guardian");
        _;
    }

    constructor(MarketParams memory p) {
        factory = p.factory;
        guardian = p.guardian;
        usdg = p.usdg;
        insuredToken = p.insuredToken;
        poolRef = p.poolRef;
        quoteToUsdgPoolRef = p.quoteToUsdgPoolRef;
        priceSource = p.priceSource;
        riskEngine = p.riskEngine;
        observer = p.observer;
        poolManager = p.poolManager;
        tokenDeployer = p.tokenDeployer;
        launchpadCreator = p.launchpadCreator;
        lockedQuoteDepth = p.lockedQuoteDepth;
        tickSpacing = p.tickSpacing;
        tokenIsCurrency0 = p.tokenIsCurrency0;
        quoteIsUsdg = p.quoteIsUsdg;
        wethIsCurrency0 = p.wethIsCurrency0;
        tokenDecimals = p.tokenDecimals;
        quoteDecimals = p.quoteDecimals;
        _liquidityState = p.liquidityState;
        config = p.config;
    }

    function setLiquidityState(bytes calldata state) external onlyGuardian {
        _liquidityState = state;
    }

    function deposit(uint8 severityIdx, uint8 windowIdx, uint256 assets) external returns (uint256 shares) {
        GridLib.validateCell(severityIdx, windowIdx);
        _recordPool(true);
        bytes32 key = GridLib.cellKey(severityIdx, windowIdx);
        RiskCell storage cell = cells[key];
        if (cell.totalShares == 0) {
            shares = assets;
        } else {
            require(cell.totalAssets > 0, "InsuranceVault: insolvent");
            shares = assets * cell.totalShares / cell.totalAssets;
        }
        cell.totalAssets += assets;
        cell.totalShares += shares;
        lpShares[key][msg.sender] += shares;
        usdg.safeTransferFrom(msg.sender, address(this), assets);
        emit CellDeposit(msg.sender, key, assets, shares);
    }

    function withdraw(uint8 severityIdx, uint8 windowIdx, uint256 shares) external returns (uint256 assets) {
        bytes32 key = GridLib.cellKey(severityIdx, windowIdx);
        RiskCell storage cell = cells[key];
        require(shares > 0 && lpShares[key][msg.sender] >= shares, "InsuranceVault: shares");
        _recordPool(true);
        require(cell.totalShares > 0 && cell.totalAssets > 0, "InsuranceVault: insolvent");
        assets = shares * cell.totalAssets / cell.totalShares;
        require(assets <= cell.totalAssets - cell.lockedAssets, "InsuranceVault: locked");
        cell.totalAssets -= assets;
        cell.totalShares -= shares;
        lpShares[key][msg.sender] -= shares;
        usdg.safeTransfer(msg.sender, assets);
        emit CellWithdraw(msg.sender, key, assets, shares);
    }

    function purchasePolicy(
        uint8 severityIdx,
        uint8 windowIdx,
        uint8 durationIdx,
        uint256 coverageUsdg,
        uint256 minCoverageUsdg
    ) external returns (uint256 policyId) {
        GridLib.validatePolicy(severityIdx, windowIdx, durationIdx);
        require(coverageUsdg >= minCoverageUsdg && coverageUsdg > 0, "InsuranceVault: coverage");
        _recordPool(true);
        _assertBuyerEligible(msg.sender);

        uint256 tokenBalance = insuredToken.balanceOf(msg.sender);
        uint16 severityBps = GridLib.severityBps(severityIdx);
        uint256 maxCoverage = _maxCoverageUsdg(tokenBalance, severityBps);
        require(coverageUsdg <= maxCoverage, "InsuranceVault: over-insurance");

        _assertEntryGuard();
        _assertPayoutCaps(severityIdx, coverageUsdg);

        uint256 sigma = riskEngine.realizedVol(observer.exportTickPayload(poolRef));
        (uint256 premium, uint256 filled) =
            _fillPolicy(severityIdx, windowIdx, durationIdx, coverageUsdg, sigma);
        require(filled >= minCoverageUsdg, "InsuranceVault: minCoverage");

        uint256 fee = premium * config.protocolFeeBps / 10_000;
        uint256 lpPremium = premium - fee;
        protocolFeesAccrued += fee;

        policyId = nextPolicyId++;
        uint256 nowTs = block.timestamp;
        policies[policyId] = Policy({
            buyer: msg.sender,
            severityIdx: severityIdx,
            windowIdx: windowIdx,
            durationIdx: durationIdx,
            coverageUsdg: filled,
            premiumUsdg: premium,
            lpPremiumTotal: lpPremium,
            lpPremiumAccrued: 0,
            coveredTokens: tokenBalance,
            purchasedAt: nowTs,
            activeFrom: nowTs + config.activationDelay,
            expiry: nowTs + GridLib.durationSeconds(durationIdx),
            status: PolicyStatus.Active,
            pendingPayout: 0,
            challengeDeadline: 0,
            challenger: address(0),
            challengeBond: 0
        });

        _incrementCoverageBuckets(severityIdx, filled);
        activePolicyCount++;

        usdg.safeTransferFrom(msg.sender, address(this), premium);
        emit PolicyPurchased(policyId, msg.sender, severityIdx, windowIdx, filled, premium);
    }

    function settle(uint256 policyId, uint256 t0, uint256 t1) external {
        Policy storage p = policies[policyId];
        require(p.status == PolicyStatus.Active, "InsuranceVault: status");
        require(block.timestamp <= p.expiry, "InsuranceVault: expired");
        require(block.timestamp >= p.activeFrom, "InsuranceVault: inactive");
        _syncPremium(policyId, p);
        _recordPool(true);

        uint32 windowSec = GridLib.windowSeconds(p.windowIdx);
        require(TriggerLib.withinWindow(t0, t1, windowSec), "InsuranceVault: window");
        uint32 twapLen = TriggerLib.measurementTwapLength(p.windowIdx);
        require(t0 >= p.activeFrom + twapLen, "InsuranceVault: t0");
        require(t1 <= p.expiry, "InsuranceVault: t1");

        int24 tick0 = _twapTickAt(t0, twapLen);
        int24 tick1 = _twapTickAt(t1, twapLen);
        uint16 severityBps = GridLib.severityBps(p.severityIdx);
        require(Pricing.meetsSeverityDrop(tick0, tick1, severityBps, tokenIsCurrency0), "InsuranceVault: trigger");
        _assertPersistence(uint32(t1), tick0, twapLen, severityBps);

        require(insuredToken.balanceOf(p.buyer) >= p.coveredTokens, "InsuranceVault: holding");

        uint256 payout = _computePayout(p, tick0, tick1);
        require(payout > 0, "InsuranceVault: payout");

        p.pendingPayout = payout;
        p.status = PolicyStatus.PendingPayout;
        p.challengeDeadline = block.timestamp + config.challengePeriod;
        emit PolicySettled(policyId, payout, p.challengeDeadline);
    }

    function challenge(uint256 policyId) external {
        Policy storage p = policies[policyId];
        require(p.status == PolicyStatus.PendingPayout, "InsuranceVault: status");
        require(block.timestamp <= p.challengeDeadline, "InsuranceVault: challenge window");
        usdg.safeTransferFrom(msg.sender, address(this), config.challengeBondUsdg);
        p.challenger = msg.sender;
        p.challengeBond = config.challengeBondUsdg;
        p.status = PolicyStatus.Challenged;
        emit PolicyChallenged(policyId, msg.sender, config.challengeBondUsdg);
    }

    function resolveChallengeUpheld(uint256 policyId) external onlyGuardian {
        Policy storage p = policies[policyId];
        require(p.status == PolicyStatus.Challenged, "InsuranceVault: status");
        _syncPremiumAll(policyId, p);
        p.status = PolicyStatus.Void;
        activePolicyCount--;
        _decrementCoverageBuckets(p.severityIdx, p.coverageUsdg);
        _releasePayoutLock(policyId);
        uint256 reward = p.challengeBond;
        if (protocolFeesAccrued >= config.recordBountyUsdg) {
            protocolFeesAccrued -= config.recordBountyUsdg;
            reward += config.recordBountyUsdg;
        }
        usdg.safeTransfer(p.challenger, reward);
        emit PolicyVoided(policyId);
    }

    function resolveChallengeRejected(uint256 policyId) external onlyGuardian {
        Policy storage p = policies[policyId];
        require(p.status == PolicyStatus.Challenged, "InsuranceVault: status");
        p.status = PolicyStatus.PendingPayout;
        usdg.safeTransfer(p.buyer, p.challengeBond);
        p.challenger = address(0);
        p.challengeBond = 0;
    }

    function release(uint256 policyId) external {
        Policy storage p = policies[policyId];
        require(p.status == PolicyStatus.PendingPayout, "InsuranceVault: status");
        require(block.timestamp > p.challengeDeadline, "InsuranceVault: challenge");
        _syncPremiumAll(policyId, p);
        uint256 payout = p.pendingPayout;
        p.status = PolicyStatus.Paid;
        p.pendingPayout = 0;
        activePolicyCount--;
        _decrementCoverageBuckets(p.severityIdx, p.coverageUsdg);
        _payFromCells(policyId, payout);
        usdg.safeTransfer(p.buyer, payout);
        emit PolicyReleased(policyId, payout);
    }

    function expirePolicy(uint256 policyId) external {
        Policy storage p = policies[policyId];
        require(p.status == PolicyStatus.Active, "InsuranceVault: status");
        require(block.timestamp > p.expiry, "InsuranceVault: not expired");
        _syncPremiumAll(policyId, p);
        p.status = PolicyStatus.Expired;
        activePolicyCount--;
        _decrementCoverageBuckets(p.severityIdx, p.coverageUsdg);
        _releasePayoutLock(policyId);
        emit PolicyExpired(policyId);
    }

    function recordPool() external {
        _recordPool(true);
    }

    function withdrawProtocolFees(address to, uint256 amount) external onlyGuardian {
        require(amount <= protocolFeesAccrued, "InsuranceVault: fees");
        protocolFeesAccrued -= amount;
        usdg.safeTransfer(to, amount);
        emit ProtocolFeesWithdrawn(to, amount);
    }

    function setConfig(ProtocolConfig calldata newConfig) external onlyGuardian {
        config = newConfig;
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function policyFill(uint256 policyId) external view returns (bytes32[] memory keys, uint256[] memory amounts) {
        keys = policyCells[policyId];
        amounts = policyCellAmounts[policyId];
    }

    function _recordPool(bool payBounty) internal {
        _tryRecord(poolRef);
        if (quoteToUsdgPoolRef != bytes32(0) && quoteToUsdgPoolRef != poolRef) {
            _tryRecord(quoteToUsdgPoolRef);
        }
        if (payBounty && activePolicyCount > 0 && protocolFeesAccrued >= config.recordBountyUsdg) {
            protocolFeesAccrued -= config.recordBountyUsdg;
            usdg.safeTransfer(msg.sender, config.recordBountyUsdg);
            emit RecordBountyPaid(msg.sender, config.recordBountyUsdg);
        }
    }

    function _tryRecord(bytes32 ref) internal {
        try observer.record(ref) {} catch {}
    }

    function _assertBuyerEligible(address buyer) internal view {
        require(buyer != tokenDeployer && buyer != launchpadCreator, "InsuranceVault: insider");
        uint256 bal = insuredToken.balanceOf(buyer);
        require(bal > 0, "InsuranceVault: no balance");
        uint256 supply = insuredToken.totalSupply();
        if (supply > 0) {
            require(bal * 10_000 / supply <= config.holderConcentrationBps, "InsuranceVault: concentration");
        }
    }

    function _assertEntryGuard() internal view {
        uint32[] memory agos = new uint32[](2);
        agos[0] = 1 hours;
        agos[1] = 0;
        (int56[] memory cum,) = priceSource.observe(poolRef, agos);
        int24 tickPast = OracleLib.twapTick(cum[1], cum[0], 1 hours);
        int24 tickNow = priceSource.consultTwapTick(poolRef, 5 minutes);
        require(
            Pricing.dropBps(tickPast, tickNow, tokenIsCurrency0) <= config.entryGuardDropBps,
            "InsuranceVault: entry guard"
        );
    }

    function _quoteAmountToUsdg(uint256 quoteAmount) internal view returns (uint256) {
        if (quoteIsUsdg) return quoteAmount;
        uint256 rate1e18 = priceSource.quoteToUsdg(quoteToUsdgPoolRef);
        return FullMath.mulDiv(quoteAmount, rate1e18, 1e18);
    }

    function _maxCoverageUsdg(uint256 tokenBalance, uint16 severityBps) internal view returns (uint256) {
        int24 tick = priceSource.consultTwapTick(poolRef, 5 minutes);
        uint256 quoteAmount = Pricing.tokenAmountToQuote(tokenBalance, tick, tokenIsCurrency0);
        uint256 valueUsdg = _quoteAmountToUsdg(quoteAmount);
        return valueUsdg * severityBps / 10_000;
    }

    function _poolDepthQuote(uint16 severityBps) internal view returns (uint256) {
        bytes memory packed = _liquidityState;
        if (packed.length > 0) {
            DepthSnapshot memory snap = abi.decode(packed, (DepthSnapshot));
            if (address(poolManager) != address(0)) {
                (int24 tick, uint160 sqrtP, uint128 liq) =
                    V4Depth.liveHeader(poolManager, poolRef, tokenIsCurrency0);
                packed = V4Depth.encode(tick, tokenIsCurrency0, sqrtP, liq, snap.segments);
            }
            uint256 concentrated = riskEngine.depthConcentrated(severityBps, packed);
            if (concentrated > 0) return concentrated;
        }
        return riskEngine.depthFullRange(lockedQuoteDepth, severityBps);
    }

    function _assertPayoutCaps(uint8 policySeverityIdx, uint256 newCoverage) internal view {
        for (uint8 s = policySeverityIdx; s < GridLib.SEVERITY_COUNT; s++) {
            uint16 severityBps = GridLib.severityBps(s);
            uint256 depthQuote = _poolDepthQuote(severityBps);
            uint256 depthUsdg = _quoteAmountToUsdg(depthQuote);
            uint256 cap = depthUsdg * config.payoutCapAlphaBps / 10_000;
            require(coverageBySeverityFloor[s] + newCoverage <= cap, "InsuranceVault: depth cap");
        }
    }

    function _fillPolicy(
        uint8 severityIdx,
        uint8 windowIdx,
        uint8 durationIdx,
        uint256 coverageUsdg,
        uint256 sigma
    ) internal returns (uint256 premium, uint256 filled) {
        uint256 remaining = coverageUsdg;
        for (uint8 s = GridLib.SEVERITY_COUNT; s > 0 && remaining > 0; s--) {
            uint8 sev = s - 1;
            for (uint8 w = 0; w < GridLib.WINDOW_COUNT && remaining > 0; w++) {
                if (!GridLib.cellBacksPolicy(sev, w, severityIdx, windowIdx)) continue;
                bytes32 key = GridLib.cellKey(sev, w);
                RiskCell storage cell = cells[key];
                uint256 free = cell.totalAssets - cell.lockedAssets;
                if (free == 0) continue;
                uint256 take = remaining < free ? remaining : free;
                uint256 util = cell.totalAssets == 0 ? 0 : cell.lockedAssets * 1e18 / cell.totalAssets;
                premium += riskEngine.quotePremium(
                    poolRef,
                    sigma,
                    GridLib.severityBps(severityIdx),
                    GridLib.windowSeconds(windowIdx),
                    GridLib.durationSeconds(durationIdx),
                    take,
                    util
                );
                filled += take;
                remaining -= take;
                policyCells[nextPolicyId].push(key);
                policyCellAmounts[nextPolicyId].push(take);
                cell.lockedAssets += take;
            }
        }
        require(filled > 0, "InsuranceVault: no liquidity");
        premium = _boundPremium(premium, filled);
    }

    function _boundPremium(uint256 premium, uint256 coverage) internal view returns (uint256) {
        uint256 maxPrem = coverage * config.maxPremiumBps / 10_000;
        if (premium < config.minPremiumUsdg) premium = config.minPremiumUsdg;
        if (premium > maxPrem) premium = maxPrem;
        return premium;
    }

    function _syncPremium(uint256 policyId, Policy storage p) internal {
        if (p.lpPremiumAccrued >= p.lpPremiumTotal) return;
        uint256 target = PremiumAccrual.linearAccrued(p.lpPremiumTotal, p.activeFrom, p.expiry, block.timestamp);
        if (target <= p.lpPremiumAccrued) return;
        uint256 delta = target - p.lpPremiumAccrued;
        p.lpPremiumAccrued = target;
        _accruePremiumToCells(policyId, delta);
    }

    function _syncPremiumAll(uint256 policyId, Policy storage p) internal {
        if (p.lpPremiumAccrued >= p.lpPremiumTotal) return;
        uint256 delta = p.lpPremiumTotal - p.lpPremiumAccrued;
        p.lpPremiumAccrued = p.lpPremiumTotal;
        _accruePremiumToCells(policyId, delta);
    }

    function _accruePremiumToCells(uint256 policyId, uint256 lpPremium) internal {
        bytes32[] storage keys = policyCells[policyId];
        uint256[] storage amounts = policyCellAmounts[policyId];
        uint256 totalLocked = 0;
        for (uint256 i = 0; i < amounts.length; i++) totalLocked += amounts[i];
        if (totalLocked == 0) return;
        for (uint256 i = 0; i < keys.length; i++) {
            cells[keys[i]].totalAssets += lpPremium * amounts[i] / totalLocked;
        }
    }

    function _incrementCoverageBuckets(uint8 severityIdx, uint256 coverage) internal {
        for (uint8 s = severityIdx; s < GridLib.SEVERITY_COUNT; s++) {
            coverageBySeverityFloor[s] += coverage;
        }
    }

    function _decrementCoverageBuckets(uint8 severityIdx, uint256 coverage) internal {
        for (uint8 s = severityIdx; s < GridLib.SEVERITY_COUNT; s++) {
            coverageBySeverityFloor[s] -= coverage;
        }
    }

    function _twapTickAt(uint256 timestamp, uint32 twapLen) internal view returns (int24) {
        uint256 nowTs = block.timestamp;
        require(timestamp <= nowTs, "InsuranceVault: future");
        uint32 secondsAgo = uint32(nowTs - timestamp);
        uint32[] memory agos = new uint32[](2);
        agos[0] = secondsAgo + twapLen;
        agos[1] = secondsAgo;
        (int56[] memory cum,) = priceSource.observe(poolRef, agos);
        return OracleLib.twapTick(cum[1], cum[0], twapLen);
    }

    function _assertPersistence(uint32 t1, int24 tick0, uint32 twapLen, uint16 severityBps) internal view {
        (uint32[] memory times, int24[] memory ticks, uint32[] memory blocks, uint8 count) =
            observer.observationsAfter(poolRef, t1, config.persistenceK);
        require(count >= config.persistenceK, "InsuranceVault: persistence");
        for (uint8 i = 0; i < config.persistenceK; i++) {
            require(i == 0 || blocks[i] != blocks[i - 1], "InsuranceVault: block");
            int24 tick = _twapTickAt(times[i], twapLen);
            require(
                Pricing.meetsSeverityDrop(tick0, tick, severityBps, tokenIsCurrency0),
                "InsuranceVault: persistence"
            );
        }
    }

    function _computePayout(Policy storage p, int24 tick0, int24 tick1) internal view returns (uint256) {
        uint256 v0 = Pricing.tokenAmountToQuote(p.coveredTokens, tick0, tokenIsCurrency0);
        uint256 v1 = Pricing.tokenAmountToQuote(p.coveredTokens, tick1, tokenIsCurrency0);
        if (v1 >= v0) return 0;
        uint256 indemnity = _quoteAmountToUsdg(v0 - v1);
        if (indemnity > p.coverageUsdg) indemnity = p.coverageUsdg;
        return indemnity;
    }

    function _payFromCells(uint256 policyId, uint256 payout) internal {
        bytes32[] storage keys = policyCells[policyId];
        uint256[] storage amounts = policyCellAmounts[policyId];
        uint256 totalLocked = 0;
        for (uint256 i = 0; i < amounts.length; i++) totalLocked += amounts[i];
        for (uint256 i = 0; i < keys.length; i++) {
            uint256 share = payout * amounts[i] / totalLocked;
            RiskCell storage cell = cells[keys[i]];
            require(cell.totalAssets >= share, "InsuranceVault: cell assets");
            cell.totalAssets -= share;
            cell.lockedAssets -= amounts[i];
        }
    }

    function _releasePayoutLock(uint256 policyId) internal {
        bytes32[] storage keys = policyCells[policyId];
        uint256[] storage amounts = policyCellAmounts[policyId];
        for (uint256 i = 0; i < keys.length; i++) {
            cells[keys[i]].lockedAssets -= amounts[i];
        }
    }
}
