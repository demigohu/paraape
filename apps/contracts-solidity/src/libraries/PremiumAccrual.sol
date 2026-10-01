// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library PremiumAccrual {
    function linearAccrued(uint256 total, uint256 start, uint256 end, uint256 timestamp)
        internal
        pure
        returns (uint256)
    {
        if (timestamp <= start) return 0;
        if (timestamp >= end) return total;
        return total * (timestamp - start) / (end - start);
    }
}
