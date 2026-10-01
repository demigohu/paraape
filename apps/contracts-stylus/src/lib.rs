//! Paraape RiskEngine (Stylus) — PRD §10 twin of `ParaapeRiskEngine.sol`
//!
//! ABI matches `IRiskEngine`: camelCase selectors, `bytes` (not `uint8[]`),
//! `bytes32` pool ref, `uint16` severity.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

mod math;

use alloy_primitives::{B256, Bytes, U256};
use alloy_sol_types::{sol, SolValue};
use stylus_sdk::prelude::*;

sol! {
    struct LiquiditySegment {
        uint160 sqrtLower;
        uint160 sqrtUpper;
        uint128 liquidity;
    }

    struct DepthSnapshot {
        int24 currentTick;
        bool tokenIsCurrency0;
        uint160 sqrtPriceX96;
        uint128 activeLiquidity;
        LiquiditySegment[] segments;
    }
}

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

    pub fn depth_concentrated(&self, severity_bps: u16, liquidity_state: Bytes) -> U256 {
        depth_concentrated_inner(severity_bps, liquidity_state.as_ref())
    }
}

fn depth_concentrated_inner(severity_bps: u16, data: &[u8]) -> U256 {
    if data.is_empty() {
        return U256::ZERO;
    }
    let snap = match DepthSnapshot::abi_decode(data) {
        Ok(s) => s,
        Err(_) => return U256::ZERO,
    };
    let sqrt_p = U256::from(snap.sqrtPriceX96);
    let crash = math::crash_sqrt_price(sqrt_p, severity_bps, snap.tokenIsCurrency0);
    let quote_is_token1 = snap.tokenIsCurrency0;
    if snap.segments.is_empty() {
        if snap.activeLiquidity == 0 {
            return U256::ZERO;
        }
        return math::quote_delta(sqrt_p, crash, U256::from(snap.activeLiquidity), quote_is_token1);
    }
    let mut depth = U256::ZERO;
    for seg in snap.segments.iter() {
        if seg.liquidity == 0 {
            continue;
        }
        let lo = U256::from(seg.sqrtLower);
        let hi = U256::from(seg.sqrtUpper);
        let (a, b) = math::intersect(lo, hi, sqrt_p, crash);
        if a == b {
            continue;
        }
        depth += math::quote_delta(a, b, U256::from(seg.liquidity), quote_is_token1);
    }
    depth
}


