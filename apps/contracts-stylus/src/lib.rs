//! Paraape RiskEngine (Stylus) — PRD §10 twin of `ParaapeRiskEngine.sol`
//!
//! ABI matches `IRiskEngine`: camelCase selectors, `bytes` (not `uint8[]`),
//! `bytes32` pool ref, `uint16` severity.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

mod math;

use alloy_primitives::{B256, Bytes, U256};
use stylus_sdk::prelude::*;

#[storage]
#[entrypoint]
pub struct RiskEngine {}

#[public]
impl RiskEngine {
    pub fn realized_vol(&self, observer_payload: Bytes) -> U256 {
        math::realized_vol(observer_payload.as_ref())
    }

    pub fn quote_premium(
        &self,
        _pool_ref: B256,
        sigma_1e18: U256,
        severity_bps: u16,
        window_sec: u32,
        duration_sec: u32,
        coverage_usdg: U256,
        cell_utilization_1e18: U256,
    ) -> U256 {
        math::quote_premium(
            sigma_1e18,
            severity_bps,
            window_sec,
            duration_sec,
            coverage_usdg,
            cell_utilization_1e18,
        )
    }

    pub fn estimate_apy(
        &self,
        severity_bps: u16,
        window_sec: u32,
        utilization_1e18: U256,
        sigma_1e18: U256,
    ) -> U256 {
        math::estimate_apy(severity_bps, window_sec, utilization_1e18, sigma_1e18)
    }

    pub fn depth_full_range(&self, quote_reserve: U256, severity_bps: u16) -> U256 {
        math::depth_full_range(quote_reserve, severity_bps)
    }

    /// Demo / size: vault falls back to `depth_full_range` when this returns 0 (see `InsuranceVault._poolDepthQuote`).
    /// Full V4 segment math stays in the Solidity twin for local tests.
    pub fn depth_concentrated(&self, _severity_bps: u16, _liquidity_state: Bytes) -> U256 {
        U256::ZERO
    }
}


