// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolTickSource} from "../interfaces/IPoolTickSource.sol";
import {OracleLib} from "../libraries/OracleLib.sol";
import {ArbBlock} from "../libraries/ArbBlock.sol";

/// @title PriceObserver — sampled TWAP ring buffer for hookless V4 pools (PRD §9.1)
contract PriceObserver {
    struct Observation {
        uint32 blockTimestamp;
        int24 tick;
        int56 tickCumulative;
        uint32 blockNumber;
        bool initialized;
    }

    uint16 public constant CARDINALITY = 2048;
    uint16 public constant VOL_LOOKBACK = 256;
    int24 public immutable maxTickMove;
    uint32 public immutable minRecordInterval;

    IPoolTickSource public immutable tickSource;

    mapping(bytes32 poolRef => Observation[CARDINALITY]) internal observations;
    mapping(bytes32 poolRef => uint16) public index;
    mapping(bytes32 poolRef => uint16) public cardinality;
    mapping(bytes32 poolRef => uint32) public lastRecordTime;

    event Recorded(bytes32 indexed poolRef, uint16 index, int24 tick, uint32 timestamp, uint32 blockNumber);

    constructor(IPoolTickSource _tickSource, int24 _maxTickMove, uint32 _minRecordInterval) {
        tickSource = _tickSource;
        maxTickMove = _maxTickMove;
        minRecordInterval = _minRecordInterval;
    }

    function record(bytes32 poolRef) external returns (uint16 idx, int24 tick) {
        uint32 time = uint32(block.timestamp);
        uint32 last = lastRecordTime[poolRef];
        require(time - last >= minRecordInterval, "PriceObserver: rate limit");

        int24 rawTick = tickSource.getTick(poolRef);
        uint16 i = index[poolRef];
        Observation memory lastObs = observations[poolRef][i == 0 ? CARDINALITY - 1 : i - 1];

        if (lastObs.initialized) {
            int24 delta = rawTick - lastObs.tick;
            if (delta > maxTickMove) rawTick = lastObs.tick + maxTickMove;
            else if (delta < -maxTickMove) rawTick = lastObs.tick - maxTickMove;
        }
        tick = OracleLib.clampTick(rawTick);

        int56 tickCumulative = lastObs.initialized
            ? lastObs.tickCumulative + int56(tick) * int56(uint56(time - lastObs.blockTimestamp))
            : int56(0);

        observations[poolRef][i] = Observation({
            blockTimestamp: time,
            tick: tick,
            tickCumulative: tickCumulative,
            blockNumber: ArbBlock.number(),
            initialized: true
        });

        idx = i;
        index[poolRef] = uint16((uint256(i) + 1) % CARDINALITY);
        if (cardinality[poolRef] < CARDINALITY) cardinality[poolRef] = cardinality[poolRef] + 1;
        lastRecordTime[poolRef] = time;

        emit Recorded(poolRef, idx, tick, time, ArbBlock.number());
    }

    function observe(bytes32 poolRef, uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            tickCumulatives[i] = _observeSingle(poolRef, secondsAgos[i]);
        }
    }

    /// @dev Newest `maxCount` observations, oldest first. Used to prove the drop is still there.
    function latestObservations(bytes32 poolRef, uint8 maxCount)
        external
        view
        returns (uint32[] memory times, int24[] memory ticks, uint32[] memory blockNumbers, uint8 count)
    {
        times = new uint32[](maxCount);
        ticks = new int24[](maxCount);
        blockNumbers = new uint32[](maxCount);

        uint16 card = cardinality[poolRef];
        if (card == 0 || maxCount == 0) return (times, ticks, blockNumbers, 0);

        uint8 take = card < maxCount ? uint8(card) : maxCount;
        uint16 i = index[poolRef];
        uint16 newestIdx = i == 0 ? CARDINALITY - 1 : i - 1;

        uint32[] memory revTimes = new uint32[](take);
        int24[] memory revTicks = new int24[](take);
        uint32[] memory revBlocks = new uint32[](take);
        uint8 found;
        for (uint16 c = 0; c < card && found < take; c++) {
            uint16 pos = uint16((uint256(newestIdx) + CARDINALITY - uint256(c)) % CARDINALITY);
            Observation memory obs = observations[poolRef][pos];
            if (!obs.initialized) continue;
            revTimes[found] = obs.blockTimestamp;
            revTicks[found] = obs.tick;
            revBlocks[found] = obs.blockNumber;
            found++;
        }
        for (uint8 c = 0; c < found; c++) {
            uint8 src = found - 1 - c;
            times[c] = revTimes[src];
            ticks[c] = revTicks[src];
            blockNumbers[c] = revBlocks[src];
        }
        count = found;
    }

    /// @dev Observations strictly after `afterTimestamp` for persistence checks (PRD §6.4)
    function observationsAfter(bytes32 poolRef, uint32 afterTimestamp, uint8 maxCount)
        external
        view
        returns (uint32[] memory times, int24[] memory ticks, uint32[] memory blockNumbers, uint8 count)
    {
        times = new uint32[](maxCount);
        ticks = new int24[](maxCount);
        blockNumbers = new uint32[](maxCount);
        count = 0;

        uint16 i = index[poolRef];
        uint16 newestIdx = i == 0 ? CARDINALITY - 1 : i - 1;
        uint16 card = cardinality[poolRef];
        uint16 oldest = uint16((uint256(newestIdx) + CARDINALITY - (uint256(card) - 1)) % CARDINALITY);
        for (uint16 c = 0; c < card && count < maxCount; c++) {
            uint16 pos = uint16((uint256(oldest) + uint256(c)) % CARDINALITY);
            Observation memory obs = observations[poolRef][pos];
            if (!obs.initialized) continue;
            if (obs.blockTimestamp > afterTimestamp) {
                times[count] = obs.blockTimestamp;
                ticks[count] = obs.tick;
                blockNumbers[count] = obs.blockNumber;
                count++;
            }
        }
    }

    function exportTickPayload(bytes32 poolRef) external view returns (bytes memory payload) {
        uint16 card = cardinality[poolRef];
        uint16 take = card < VOL_LOOKBACK ? card : VOL_LOOKBACK;
        if (take == 0) return payload;
        payload = new bytes(uint256(take) * 64);
        uint16 i = index[poolRef];
        uint16 newestIdx = i == 0 ? CARDINALITY - 1 : i - 1;
        uint16 oldest = uint16((uint256(newestIdx) + CARDINALITY - (uint256(take) - 1)) % CARDINALITY);
        for (uint16 c = 0; c < take; c++) {
            uint16 pos = uint16((uint256(oldest) + uint256(c)) % CARDINALITY);
            Observation memory obs = observations[poolRef][pos];
            bytes32 tickWord = bytes32(uint256(int256(obs.tick)));
            bytes32 timeWord = bytes32(uint256(obs.blockTimestamp));
            assembly {
                mstore(add(add(payload, 32), mul(c, 64)), tickWord)
                mstore(add(add(payload, 64), mul(c, 64)), timeWord)
            }
        }
    }

    function _observeSingle(bytes32 poolRef, uint32 secondsAgo) internal view returns (int56) {
        uint32 time = uint32(block.timestamp);
        require(secondsAgo <= time, "PriceObserver: future");
        uint32 target = time - secondsAgo;

        uint16 i = index[poolRef];
        uint16 newestIdx = i == 0 ? CARDINALITY - 1 : i - 1;
        Observation memory latest = observations[poolRef][newestIdx];
        require(latest.initialized, "PriceObserver: empty");

        if (secondsAgo == 0) {
            return latest.tickCumulative + int56(latest.tick) * int56(uint56(time - latest.blockTimestamp));
        }

        uint16 card = cardinality[poolRef];
        for (uint16 c = 0; c < card; c++) {
            uint16 pos = uint16((uint256(newestIdx) + CARDINALITY - uint256(c)) % CARDINALITY);
            Observation memory obs = observations[poolRef][pos];
            if (!obs.initialized) break;
            if (obs.blockTimestamp <= target) {
                uint32 dt = target - obs.blockTimestamp;
                return obs.tickCumulative + int56(obs.tick) * int56(uint56(dt));
            }
        }
        revert("PriceObserver: stale");
    }
}
