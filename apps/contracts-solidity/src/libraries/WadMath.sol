// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev 1e18 fixed-point helpers used by the risk engine (PRD §10)
library WadMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant HALF_WAD = 5e17;
    /// 1 / sqrt(2π) in WAD
    uint256 internal constant INV_SQRT_2PI = 398942280401432677;

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function wMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / WAD;
    }

    function wDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "WadMath: div0");
        return (a * WAD) / b;
    }

    function isqrt(uint256 x) internal pure returns (uint256) {
        if (x <= 1) return x;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /// @dev √x with x and result in WAD. sqrtWad(1e18) = 1e18.
    function sqrtWad(uint256 xWad) internal pure returns (uint256) {
        return isqrt(xWad * WAD);
    }

    /// @dev e^x for 0 ≤ x ≤ 42 (WAD), 16-term Taylor.
    function expWad(uint256 xWad) internal pure returns (uint256) {
        if (xWad == 0) return WAD;
        uint256 term = WAD;
        uint256 sum = WAD;
        for (uint256 i = 1; i < 16; i++) {
            term = (term * xWad) / (WAD * i);
            sum += term;
            if (term == 0) break;
        }
        return sum;
    }

    /// @dev e^{-x} for x ≥ 0 in WAD.
    function expNegWad(uint256 xWad) internal pure returns (uint256) {
        if (xWad > 42 * WAD) return 0;
        uint256 e = expWad(xWad);
        if (e == 0) return 0;
        return (WAD * WAD) / e;
    }

    /// @dev Φ(-x) for x ≥ 0 in WAD. Mills ratio for x ≥ 1, first-order for x < 1.
    function normTailWad(uint256 xWad) internal pure returns (uint256) {
        if (xWad == 0) return HALF_WAD;
        if (xWad > 8 * WAD) return 1;
        uint256 x2half = wMul(xWad, xWad) / 2;
        uint256 phi = wMul(INV_SQRT_2PI, expNegWad(x2half));
        if (xWad >= WAD) {
            return wDiv(phi, xWad);
        }
        uint256 linear = wMul(INV_SQRT_2PI, xWad);
        return linear >= HALF_WAD ? 0 : HALF_WAD - linear;
    }
}
