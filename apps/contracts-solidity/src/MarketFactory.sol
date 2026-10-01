// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {VaultDeployer} from "./VaultDeployer.sol";
import {MarketParams} from "./MarketTypes.sol";
import {ProtocolConfig, ProtocolConfigLib} from "./ProtocolConfig.sol";
import {ILiquidityLockAdapter} from "./interfaces/ILiquidityLockAdapter.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {IRiskEngine} from "./interfaces/IRiskEngine.sol";
import {PriceObserver} from "./oracle/PriceObserver.sol";
import {Pricing} from "./libraries/Pricing.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

using PoolIdLibrary for PoolKey;

/// @title MarketFactory — permissionless market creation (PRD §9.4, §13)
contract MarketFactory {
    IERC20 public immutable usdg;
    IERC20 public immutable weth;
    IRiskEngine public immutable riskEngine;
    PriceObserver public immutable observer;
    IPriceSource public immutable priceSource;
    IPoolManager public immutable poolManager;
    VaultDeployer public immutable vaultDeployer;
    bytes32 public immutable wethUsdgPoolRef;
    bool public immutable wethIsCurrency0;

    address public guardian;
    ProtocolConfig public config;

    mapping(address token => address vault) public vaultByToken;
    mapping(address adapter => bool) public lockAdapterAllowed;

    event MarketCreated(
        address indexed token,
        address indexed vault,
        bytes32 poolRef,
        address tokenDeployer,
        address launchpadCreator
    );
    event LockAdapterSet(address indexed adapter, bool allowed);
    event GuardianUpdated(address indexed guardian);
    event ConfigUpdated();

    constructor(
        IERC20 _usdg,
        IERC20 _weth,
        IRiskEngine _riskEngine,
        PriceObserver _observer,
        IPriceSource _priceSource,
        IPoolManager _poolManager,
        VaultDeployer _vaultDeployer,
        bytes32 _wethUsdgPoolRef,
        bool _wethIsCurrency0,
        address _guardian,
        ProtocolConfig memory _config
    ) {
        usdg = _usdg;
        weth = _weth;
        riskEngine = _riskEngine;
        observer = _observer;
        priceSource = _priceSource;
        poolManager = _poolManager;
        vaultDeployer = _vaultDeployer;
        wethUsdgPoolRef = _wethUsdgPoolRef;
        wethIsCurrency0 = _wethIsCurrency0;
        guardian = _guardian;
        config = _config;
    }

    function setLockAdapter(address adapter, bool allowed) external {
        require(msg.sender == guardian, "MarketFactory: guardian");
        lockAdapterAllowed[adapter] = allowed;
        emit LockAdapterSet(adapter, allowed);
    }

    function setGuardian(address newGuardian) external {
        require(msg.sender == guardian, "MarketFactory: guardian");
        guardian = newGuardian;
        emit GuardianUpdated(newGuardian);
    }

    function setConfig(ProtocolConfig calldata newConfig) external {
        require(msg.sender == guardian, "MarketFactory: guardian");
        config = newConfig;
        emit ConfigUpdated();
    }

    function createMarket(
        PoolKey calldata poolKey,
        address token,
        address lockAdapter,
        address tokenDeployer,
        address launchpadCreator
    ) external returns (address vault) {
        require(vaultByToken[token] == address(0), "MarketFactory: exists");
        require(lockAdapterAllowed[lockAdapter], "MarketFactory: lock adapter");

        bytes32 poolRef = PoolId.unwrap(poolKey.toId());
        (uint160 sqrtPrice,,,) = StateLibrary.getSlot0(poolManager, poolKey.toId());
        require(sqrtPrice > 0, "MarketFactory: pool");

        address c0 = Currency.unwrap(poolKey.currency0);
        address c1 = Currency.unwrap(poolKey.currency1);
        require(c0 == token || c1 == token, "MarketFactory: token side");
        bool tokenIsCurrency0 = c0 == token;
        address quote = tokenIsCurrency0 ? c1 : c0;
        bool quoteIsUsdg = quote == address(usdg);
        bool quoteIsWeth = quote == address(weth);
        require(quoteIsUsdg || quoteIsWeth, "MarketFactory: quote");

        ILiquidityLockAdapter adapter = ILiquidityLockAdapter(lockAdapter);
        require(adapter.isLiquidityLocked(poolRef), "MarketFactory: not locked");

        try observer.record(poolRef) {} catch {}
        if (!quoteIsUsdg && wethUsdgPoolRef != bytes32(0)) {
            try observer.record(wethUsdgPoolRef) {} catch {}
        }

        uint256 quoteDepth = adapter.lockedQuoteDepth(poolRef);
        uint256 depthUsdg;
        if (quoteIsUsdg) {
            depthUsdg = quoteDepth;
        } else {
            uint256 rate1e18 = priceSource.quoteToUsdg(wethUsdgPoolRef);
            depthUsdg = FullMath.mulDiv(quoteDepth, rate1e18, 1e18);
        }
        require(depthUsdg >= config.minDepthUsdg, "MarketFactory: min depth");

        vault = vaultDeployer.deploy(
            MarketParams({
                factory: address(this),
                guardian: guardian,
                usdg: usdg,
                insuredToken: IERC20(token),
                poolRef: poolRef,
                quoteToUsdgPoolRef: wethUsdgPoolRef,
                priceSource: priceSource,
                riskEngine: riskEngine,
                observer: observer,
                poolManager: poolManager,
                tokenDeployer: tokenDeployer,
                launchpadCreator: launchpadCreator,
                lockedQuoteDepth: quoteDepth,
                tickSpacing: poolKey.tickSpacing,
                tokenIsCurrency0: tokenIsCurrency0,
                quoteIsUsdg: quoteIsUsdg,
                wethIsCurrency0: wethIsCurrency0,
                tokenDecimals: IERC20Metadata(token).decimals(),
                quoteDecimals: IERC20Metadata(quote).decimals(),
                liquidityState: adapter.liquidityState(poolRef),
                config: config
            })
        );
        vaultByToken[token] = vault;
        emit MarketCreated(token, vault, poolRef, tokenDeployer, launchpadCreator);
    }

    function defaultConfig() external pure returns (ProtocolConfig memory) {
        return ProtocolConfigLib.defaults();
    }
}
