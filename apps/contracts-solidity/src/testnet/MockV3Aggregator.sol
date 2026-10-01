// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @dev Chainlink-style mock feed for testnets without live Chainlink (PRD §15).
contract MockV3Aggregator is AggregatorV3Interface {
    uint256 public constant version = 4;

    uint8 public immutable decimals;
    string public description;

    int256 public latestAnswer;
    uint256 public latestTimestamp;
    uint256 public latestRound;

    constructor(uint8 _decimals, string memory _description, int256 _initialAnswer) {
        decimals = _decimals;
        description = _description;
        updateAnswer(_initialAnswer);
    }

    function updateAnswer(int256 _answer) public {
        latestAnswer = _answer;
        latestTimestamp = block.timestamp;
        latestRound++;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(_roundId == uint80(latestRound), "MockV3: round");
        return latestRoundData();
    }

    function latestRoundData()
        public
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(latestRound),
            latestAnswer,
            latestTimestamp,
            latestTimestamp,
            uint80(latestRound)
        );
    }
}
