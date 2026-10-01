// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Arbitrum L2 block number when ArbSys is present; otherwise `block.number`.
library ArbBlock {
    address internal constant ARB_SYS = address(100);

    function number() internal view returns (uint32) {
        (bool ok, bytes memory data) =
            ARB_SYS.staticcall(abi.encodeWithSignature("arbBlockNumber()"));
        if (ok && data.length == 32) {
            return uint32(uint256(bytes32(data)));
        }
        return uint32(block.number);
    }
}
