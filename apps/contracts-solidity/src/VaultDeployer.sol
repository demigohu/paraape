// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {InsuranceVault} from "./InsuranceVault.sol";
import {MarketParams} from "./MarketTypes.sol";

/// @dev Separate deployer so MarketFactory does not embed InsuranceVault bytecode (24kb cap).
contract VaultDeployer {
    function deploy(MarketParams calldata params) external returns (address) {
        return address(new InsuranceVault(params));
    }
}
