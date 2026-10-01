// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {InsuranceVault} from "../../src/InsuranceVault.sol";
import {MarketParams} from "../../src/MarketTypes.sol";
import {ProtocolConfig} from "../../src/ProtocolConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPriceSource} from "../../src/interfaces/IPriceSource.sol";
import {IRiskEngine} from "../../src/interfaces/IRiskEngine.sol";
import {PriceObserver} from "../../src/oracle/PriceObserver.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

contract VaultTestHelper {
    function deployVault(
        address factory,
        address guardian,
        IERC20 usdg,
        IERC20 token,
        bytes32 poolRef,
        IPriceSource priceSource,
        IRiskEngine riskEngine,
        PriceObserver observer,
        uint256 lockedQuoteDepth,
        address tokenDeployer,
        address launchpadCreator,
        ProtocolConfig memory config
    ) external returns (address) {
        return address(
            new InsuranceVault(
                MarketParams({
                    factory: factory,
                    guardian: guardian,
                    usdg: usdg,
                    insuredToken: token,
                    poolRef: poolRef,
                    quoteToUsdgPoolRef: bytes32(0),
                    priceSource: priceSource,
                    riskEngine: riskEngine,
                    observer: observer,
                    poolManager: IPoolManager(address(0)),
                    tokenDeployer: tokenDeployer,
                    launchpadCreator: launchpadCreator,
                    lockedQuoteDepth: lockedQuoteDepth,
                    tickSpacing: 0,
                    tokenIsCurrency0: true,
                    quoteIsUsdg: true,
                    wethIsCurrency0: true,
                    tokenDecimals: 18,
                    quoteDecimals: 6,
                    liquidityState: "",
                    config: config
                })
            )
        );
    }

    function deployVault(
        address factory,
        address guardian,
        IERC20 usdg,
        IERC20 token,
        bytes32 poolRef,
        IPriceSource priceSource,
        IRiskEngine riskEngine,
        PriceObserver observer,
        uint256 lockedQuoteDepth,
        ProtocolConfig memory config
    ) external returns (address) {
        return this.deployVault(
            factory,
            guardian,
            usdg,
            token,
            poolRef,
            priceSource,
            riskEngine,
            observer,
            lockedQuoteDepth,
            address(0xdE00000000000000000000000000000000000000),
            address(0x1100000000000000000000000000000000000001),
            config
        );
    }
}
