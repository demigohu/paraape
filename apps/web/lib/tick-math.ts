/** TickMath.getSqrtRatioAtTick (Uniswap v3-sdk, bigint). */

const MAX_UINT256 = 2n ** 256n - 1n;
const Q32 = 2n ** 32n;

function mulShift(val: bigint, mulBy: bigint): bigint {
  return (val * mulBy) >> 128n;
}

export function getSqrtPriceX96AtTick(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick;
  if (absTick > 887272 || !Number.isInteger(tick)) throw new Error("Invalid tick");

  let ratio =
    (absTick & 0x1) !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2) !== 0) ratio = mulShift(ratio, 0xfff97272373d413259a46990580e213an);
  if ((absTick & 0x4) !== 0) ratio = mulShift(ratio, 0xfff2e50f5f656932ef12357cf3c7fdccn);
  if ((absTick & 0x8) !== 0) ratio = mulShift(ratio, 0xffe5caca7e10e4e61c3624eaa0941cd0n);
  if ((absTick & 0x10) !== 0) ratio = mulShift(ratio, 0xffcb9843d60f6159c9db58835c926644n);
  if ((absTick & 0x20) !== 0) ratio = mulShift(ratio, 0xff973b41fa98c081472e6896dfb254c0n);
  if ((absTick & 0x40) !== 0) ratio = mulShift(ratio, 0xff2ea16466c96a3843ec78b326b52861n);
  if ((absTick & 0x80) !== 0) ratio = mulShift(ratio, 0xfe5dee046a99a2a811c461f1969c3053n);
  if ((absTick & 0x100) !== 0) ratio = mulShift(ratio, 0xfcbe86c7900a88aedcffc83b479aa3a4n);
  if ((absTick & 0x200) !== 0) ratio = mulShift(ratio, 0xf987a7253ac413176f2b074cf7815e54n);
  if ((absTick & 0x400) !== 0) ratio = mulShift(ratio, 0xf3392b0822b70005940c7a398e4b70f3n);
  if ((absTick & 0x800) !== 0) ratio = mulShift(ratio, 0xe7159475a2c29b7443b29c7fa6e889d9n);
  if ((absTick & 0x1000) !== 0) ratio = mulShift(ratio, 0xd097f3bdfd2022b8845ad8f792aa5825n);
  if ((absTick & 0x2000) !== 0) ratio = mulShift(ratio, 0xa9f746462d870fdf8a65dc1f90e061e5n);
  if ((absTick & 0x4000) !== 0) ratio = mulShift(ratio, 0x70d869a156d2a1b890bb3df62baf32f7n);
  if ((absTick & 0x8000) !== 0) ratio = mulShift(ratio, 0x31be135f97d08fd981231505542fcfa6n);
  if ((absTick & 0x10000) !== 0) ratio = mulShift(ratio, 0x9aa508b5b7a84e1c677de54f3e99bc9n);
  if ((absTick & 0x20000) !== 0) ratio = mulShift(ratio, 0x5d6af8dedb81196699c329225ee604n);
  if ((absTick & 0x40000) !== 0) ratio = mulShift(ratio, 0x2216e584f5fa1ea926041bedfe98n);
  if ((absTick & 0x80000) !== 0) ratio = mulShift(ratio, 0x48a170391f7dc42444e8fa2n);

  if (tick > 0) ratio = MAX_UINT256 / ratio;

  return ratio % Q32 === 0n ? ratio / Q32 : ratio / Q32 + 1n;
}

export function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b) / denom;
}

const Q192 = 2n ** 192n;

export function tokenAmountToQuote(
  tokenAmount: bigint,
  tick: number,
  tokenIsCurrency0: boolean,
): bigint {
  const sqrtP = getSqrtPriceX96AtTick(tick);
  const p2 = sqrtP * sqrtP;
  if (tokenIsCurrency0) {
    return mulDiv(tokenAmount, p2, Q192);
  }
  return mulDiv(tokenAmount, Q192, p2);
}

export function depthFullRangeQuote(quoteReserve: bigint, severityBps: number): bigint {
  const WAD = 10n ** 18n;
  const remainWad = (BigInt(10_000 - severityBps) * WAD) / 10_000n;
  const root = sqrtWad(remainWad);
  return mulDiv(quoteReserve, WAD - root, WAD);
}

function sqrtWad(x: bigint): bigint {
  if (x <= 0n) return 0n;
  let z = (x + 1n) / 2n;
  let y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / 2n;
  }
  return y;
}
