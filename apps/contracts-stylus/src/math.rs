use alloy_primitives::U256;

pub const WAD: u64 = 1_000_000_000_000_000_000;
pub const HALF_WAD: u64 = 500_000_000_000_000_000;
pub const LOAD_WAD: u64 = 150_000_000_000_000_000;
pub const UTIL_KINK: u64 = 800_000_000_000_000_000;
pub const INV_SQRT_2PI: u64 = 398_942_280_401_432_677;
pub const MIN_SQRT_PRICE: u64 = 4_295_128_739;
/// TickMath.MAX_SQRT_PRICE − 1
pub const MAX_SQRT_PRICE: &str = "1461446703485210103287273052203988822378723970341";
pub const Q96: u128 = 1u128 << 96;

pub fn wad() -> U256 {
    U256::from(WAD)
}

pub fn min(a: U256, b: U256) -> U256 {
    if a < b { a } else { b }
}

pub fn max(a: U256, b: U256) -> U256 {
    if a > b { a } else { b }
}

pub fn w_mul(a: U256, b: U256) -> U256 {
    a * b / wad()
}

pub fn w_div(a: U256, b: U256) -> U256 {
    a * wad() / b
}

pub fn isqrt(x: U256) -> U256 {
    if x <= U256::from(1u64) {
        return x;
    }
    let mut z = (x + U256::from(1u64)) / U256::from(2u64);
    let mut y = x;
    while z < y {
        y = z;
        z = (x / z + z) / U256::from(2u64);
    }
    y
}

/// √x with x and result in WAD. sqrt_wad(1e18) = 1e18.
pub fn sqrt_wad(x_wad: U256) -> U256 {
    isqrt(x_wad * wad())
}

/// e^x for 0 ≤ x ≤ 42 (WAD), 16-term Taylor — same as WadMath.expWad.
pub fn exp_wad(x_wad: U256) -> U256 {
    if x_wad.is_zero() {
        return wad();
    }
    let mut term = wad();
    let mut sum = wad();
    for i in 1u64..16 {
        term = (term * x_wad) / (wad() * U256::from(i));
        sum += term;
        if term.is_zero() {
            break;
        }
    }
    sum
}

pub fn exp_neg_wad(x_wad: U256) -> U256 {
    if x_wad > wad() * U256::from(42u64) {
        return U256::ZERO;
    }
    let e = exp_wad(x_wad);
    if e.is_zero() {
        return U256::ZERO;
    }
    wad() * wad() / e
}

/// Φ(-x) for x ≥ 0 in WAD. Matches WadMath.normTailWad.
pub fn norm_tail_wad(x_wad: U256) -> U256 {
    if x_wad.is_zero() {
        return U256::from(HALF_WAD);
    }
    if x_wad > wad() * U256::from(8u64) {
        return U256::from(1u64);
    }
    let x2half = w_mul(x_wad, x_wad) / U256::from(2u64);
    let phi = w_mul(U256::from(INV_SQRT_2PI), exp_neg_wad(x2half));
    if x_wad >= wad() {
        return w_div(phi, x_wad);
    }
    let linear = w_mul(U256::from(INV_SQRT_2PI), x_wad);
    if linear >= U256::from(HALF_WAD) {
        U256::ZERO
    } else {
        U256::from(HALF_WAD) - linear
    }
}

/// P(drawdown ≥ s in window w) ≈ 2 Φ(-s / (σ √w)) with σ per-second log-vol.
pub fn p_drawdown(sigma_sec_wad: U256, severity_bps: u16, window_sec: u32) -> U256 {
    let s_wad = U256::from(severity_bps as u64) * wad() / U256::from(10_000u64);
    let sigma_w = w_mul(sigma_sec_wad, sqrt_wad(U256::from(window_sec as u64) * wad()));
    if sigma_w.is_zero() {
        return U256::from(1_000_000_000_000u64);
    }
    let x = w_div(s_wad, sigma_w);
    let tail = norm_tail_wad(x);
    let p = tail * U256::from(2u64);
    min(p, wad())
}

/// Memecoin jump floor (PRD §10 v2): BASE 0.8% × (1 + s) × √(5m / w), floor on window factor.
const BASE_JUMP_WAD: u64 = 80_000_000_000_000; // 80e14

pub fn jump_floor(severity_bps: u16, window_sec: u32) -> U256 {
    let s_wad = U256::from(severity_bps as u64) * wad() / U256::from(10_000u64);
    let severity_factor = wad() + s_wad;
    let mut window_factor = w_div(
        wad(),
        sqrt_wad(U256::from(window_sec as u64) * wad() / U256::from(300u64)),
    );
    let floor = wad() / U256::from(10u64);
    if window_factor < floor {
        window_factor = floor;
    }
    w_mul(
        U256::from(BASE_JUMP_WAD),
        w_mul(severity_factor, window_factor),
    )
}

/// P(≥1 hit in duration) ≈ 1 − (1−p)^k
pub fn union_hit_rate_wad(p_wad: U256, duration_sec: u32, window_sec: u32) -> U256 {
    if p_wad.is_zero() {
        return U256::ZERO;
    }
    if p_wad >= wad() {
        return wad();
    }
    if window_sec == 0 || duration_sec <= window_sec {
        return p_wad;
    }
    let mut k = (U256::from(duration_sec as u64) + U256::from(window_sec as u64) - U256::from(1u64))
        / U256::from(window_sec as u64);
    if k > U256::from(4096u64) {
        k = U256::from(4096u64);
    }
    let survive = wad_pow(wad() - p_wad, k.as_limbs()[0] as u64);
    wad() - survive
}

fn wad_pow(base_wad: U256, exp: u64) -> U256 {
    if exp == 0 {
        return wad();
    }
    let mut result = wad();
    let mut base = base_wad;
    let mut e = exp;
    while e > 0 {
        if e & 1 == 1 {
            result = w_mul(result, base);
        }
        base = w_mul(base, base);
        e >>= 1;
    }
    result
}

pub fn utilization_multiplier(u_wad: U256) -> U256 {
    if u_wad >= wad() {
        return wad() * U256::from(3u64);
    }
    let kink = U256::from(UTIL_KINK);
    if u_wad <= kink {
        return wad() + u_wad;
    }
    let excess = u_wad - kink;
    wad() + u_wad + w_mul(excess, excess) * U256::from(2u64) / (wad() - kink)
}

pub fn quote_premium(
    sigma_1e18: U256,
    severity_bps: u16,
    window_sec: u32,
    duration_sec: u32,
    coverage_usdg: U256,
    cell_utilization_1e18: U256,
) -> U256 {
    let p = p_drawdown(sigma_1e18, severity_bps, window_sec);
    let jump = jump_floor(severity_bps, window_sec);
    let union_bound = union_hit_rate_wad(p, duration_sec, window_sec);
    let mut rate = max(jump, union_bound);
    let load = wad() + U256::from(LOAD_WAD) + cell_utilization_1e18 / U256::from(2u64);
    rate = w_mul(rate, load);
    rate = w_mul(rate, utilization_multiplier(cell_utilization_1e18));
    let mut premium = coverage_usdg * rate / wad();
    if premium.is_zero() {
        premium = U256::from(1u64);
    }
    premium
}

pub fn estimate_apy(severity_bps: u16, window_sec: u32, utilization_1e18: U256, sigma_1e18: U256) -> U256 {
    let p = p_drawdown(sigma_1e18, severity_bps, window_sec);
    let jump = jump_floor(severity_bps, window_sec);
    let union_year = union_hit_rate_wad(p, 365 * 86400, window_sec);
    let mut rate_year = max(jump, union_year);
    rate_year = w_mul(rate_year, wad() + U256::from(LOAD_WAD) + utilization_1e18 / U256::from(2u64));
    rate_year = w_mul(rate_year, utilization_multiplier(utilization_1e18));
    rate_year * U256::from(10_000u64) / wad()
}

/// D(s) = y × (1 − √(1 − s))
pub fn depth_full_range(quote_reserve: U256, severity_bps: u16) -> U256 {
    let remain_wad = U256::from((10_000u16 - severity_bps) as u64) * wad() / U256::from(10_000u64);
    let root = sqrt_wad(remain_wad);
    quote_reserve * (wad() - root) / wad()
}

/// Payload: 64 bytes per observation — tick then timestamp. Fallback 32-byte ticks, dt=30.
pub fn realized_vol(payload: &[u8]) -> U256 {
    let fallback = U256::from(70_000_000_000_000u64); // 7e13
    if payload.len() < 128 {
        return fallback;
    }
    let paired = payload.len() % 64 == 0;
    let n = if paired { payload.len() / 64 } else { payload.len() / 32 };
    if n < 2 {
        return fallback;
    }

    let word = |off: usize| -> U256 {
        let mut buf = [0u8; 32];
        buf.copy_from_slice(&payload[off..off + 32]);
        U256::from_be_bytes(buf)
    };
    let tick_at = |off: usize| -> i32 {
        let raw = word(off);
        let as_u = raw.as_limbs()[0] as u32;
        as_u as i32
    };

    let mut prev_tick = tick_at(0);
    let mut prev_ts = if paired {
        word(32).as_limbs()[0] as u32
    } else {
        0u32
    };
    let mut sum_var = U256::ZERO;
    let mut count = 0u64;

    for i in 1..n {
        let off = if paired { i * 64 } else { i * 32 };
        let tick = tick_at(off);
        let dt = if paired {
            let ts = word(off + 32).as_limbs()[0] as u32;
            let d = if ts > prev_ts { ts - prev_ts } else { 0 };
            prev_ts = ts;
            d
        } else {
            30u32
        };
        let d_tick = (tick as i64) - (prev_tick as i64);
        prev_tick = tick;
        if dt == 0 {
            continue;
        }
        let d2 = U256::from(d_tick.unsigned_abs());
        let d2 = d2 * d2;
        sum_var += d2 * U256::from(10_000_000_000u64) / U256::from(dt as u64);
        count += 1;
    }
    if count == 0 {
        return fallback;
    }
    let mean_var = sum_var / U256::from(count);
    let mut sigma_sec = sqrt_wad(mean_var);
    if sigma_sec < U256::from(10_000_000_000u64) {
        sigma_sec = U256::from(10_000_000_000u64);
    }
    if sigma_sec > U256::from(10_000_000_000_000_000u64) {
        sigma_sec = U256::from(10_000_000_000_000_000u64);
    }
    sigma_sec
}

pub fn crash_sqrt_price(current_sqrt: U256, severity_bps: u16, token_is_currency0: bool) -> U256 {
    let remain_wad = U256::from((10_000u16 - severity_bps) as u64) * wad() / U256::from(10_000u64);
    let sqrt_remain = sqrt_wad(remain_wad);
    let min_sqrt = U256::from(MIN_SQRT_PRICE);
    let max_sqrt = U256::from_str_radix(MAX_SQRT_PRICE, 10).unwrap();
    if token_is_currency0 {
        let next = current_sqrt * sqrt_remain / wad();
        if next < min_sqrt {
            min_sqrt
        } else {
            next
        }
    } else {
        let up = current_sqrt * wad() / sqrt_remain;
        if up > max_sqrt {
            max_sqrt
        } else {
            up
        }
    }
}

pub fn quote_delta(sqrt_a: U256, sqrt_b: U256, liquidity: U256, quote_is_token1: bool) -> U256 {
    if liquidity.is_zero() || sqrt_a == sqrt_b {
        return U256::ZERO;
    }
    let (lo, hi) = if sqrt_a < sqrt_b { (sqrt_a, sqrt_b) } else { (sqrt_b, sqrt_a) };
    let q96 = U256::from(Q96);
    if quote_is_token1 {
        liquidity * (hi - lo) / q96
    } else {
        liquidity * (hi - lo) * q96 / (hi * lo)
    }
}

pub fn intersect(a0: U256, a1: U256, b0: U256, b1: U256) -> (U256, U256) {
    let lo0 = min(a0, a1);
    let hi0 = max(a0, a1);
    let lo1 = min(b0, b1);
    let hi1 = max(b0, b1);
    let lo = max(lo0, lo1);
    let hi = min(hi0, hi1);
    if lo >= hi {
        (lo, lo)
    } else {
        (lo, hi)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn depth_matches_prd_table() {
        let y = U256::from(100_000u64) * U256::from(1_000_000u64);
        let d50 = depth_full_range(y, 5000);
        let d95 = depth_full_range(y, 9500);
        // 29_289e6 and 77_639e6 ± 1%
        assert!(d50 > U256::from(29_000u64) * U256::from(1_000_000u64));
        assert!(d50 < U256::from(29_600u64) * U256::from(1_000_000u64));
        assert!(d95 > U256::from(76_800u64) * U256::from(1_000_000u64));
        assert!(d95 < U256::from(78_500u64) * U256::from(1_000_000u64));
        assert!(d95 > d50);
    }

    #[test]
    fn stricter_flash_trigger_higher_premium() {
        let sigma = U256::from(70_000_000_000_000u64);
        let p90 = quote_premium(sigma, 9000, 300, 7 * 86400, U256::from(5_000u64) * U256::from(1_000_000u64), U256::ZERO);
        let p50 = quote_premium(sigma, 5000, 300, 7 * 86400, U256::from(5_000u64) * U256::from(1_000_000u64), U256::ZERO);
        assert!(p90 > p50);
        assert!(p50 < U256::from(2_500u64) * U256::from(1_000_000u64));
    }

    #[test]
    fn depth_70_and_85() {
        let y = U256::from(100_000u64) * U256::from(1_000_000u64);
        let d70 = depth_full_range(y, 7000);
        let d85 = depth_full_range(y, 8500);
        assert!(d70 > U256::from(44_000u64) * U256::from(1_000_000u64));
        assert!(d85 > d70);
        assert!(d85 < U256::from(63_000u64) * U256::from(1_000_000u64));
    }

    #[test]
    fn jump_floor_stricter_higher() {
        let j50 = jump_floor(5000, 300);
        let j90 = jump_floor(9000, 300);
        assert!(j90 > j50);
    }

    #[test]
    fn realized_vol_fallback() {
        assert_eq!(realized_vol(&[]), U256::from(70_000_000_000_000u64));
    }

    #[test]
    fn quote_delta_amount1_positive() {
        let q96 = U256::from(1u128 << 96);
        let d = quote_delta(q96, q96 / U256::from(2u64), U256::from(1_000_000_000_000_000_000u64), true);
        assert!(d > U256::ZERO);
    }
}
