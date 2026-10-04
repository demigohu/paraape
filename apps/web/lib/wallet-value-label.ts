import type { Token } from "@/lib/protocol";
import { usd } from "@/lib/protocol";
import { holdingsUsdgHuman } from "@/lib/token-price";

/** Human label for wallet USDG value (same TWAP path as vault max cover). */
export function walletValueUsdLabel(token: Token): string {
  if (token.usdgPerTokenRaw !== "0" && token.walletBalanceRaw !== "0") {
    return usd(
      holdingsUsdgHuman(
        BigInt(token.walletBalanceRaw),
        BigInt(token.usdgPerTokenRaw),
        token.tokenDecimals,
      ),
    );
  }

  const samples = token.oracleCardinality ?? 0;
  if (samples > 0 && token.oracleLastTick === 0) {
    return "not USD-priced (pool at tick 0)";
  }
  if (samples === 0) {
    return "oracle warming up";
  }
  return "TWAP price out of range";
}
