import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "./brand";
import { Roll } from "./chrome";
import { PixelEdge } from "./pixel-edge";
import { NAV } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer data-site-footer className="mt-24">
      <PixelEdge direction="up" />
      <div className="bg-signal text-fg">
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-12 md:px-8 md:pb-14 md:pt-20">
          <div className="grid grid-cols-1 border border-fg md:grid-cols-[1.3fr_1fr_1fr]">
            <div className="flex flex-col gap-8 border-b border-fg p-6 md:border-b-0 md:border-r md:p-10">
              <h2 className="heading text-[clamp(2.2rem,4vw,3.6rem)]">
                Hold a memecoin?
                <br />
                Pack a parachute.
              </h2>
              <p className="mono-caps max-w-[38ch]">
                Isolated rug-pull protection for Robinhood Chain memecoins. Priced from Uniswap V4
                TWAP, settled in USDG.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/protect" className="btn btn-inverse">
                  <Roll>Protect a token</Roll>
                  <ArrowRight size={16} weight="bold" aria-hidden />
                </Link>
                <Link href="/underwrite" className="btn btn-ghost">
                  <Roll>Underwrite</Roll>
                </Link>
              </div>
            </div>

            <nav aria-label="Footer" className="flex flex-col gap-3 border-b border-fg p-6 md:border-b-0 md:border-r md:p-10">
              <span className="heading mb-3 text-xl">App</span>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="mono-caps w-fit">
                  <Roll>{item.label}</Roll>
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-3 p-6 md:p-10">
              <span className="heading mb-3 text-xl">Network</span>
              <span className="mono-caps">Robinhood Chain testnet</span>
              <span className="mono-caps">Arbitrum Sepolia</span>
              <span className="mono-caps">Settlement: USDG</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex items-center gap-3">
              <BrandMark size={36} />
              <span className="display text-3xl">Paraape</span>
            </div>
            <p className="mono-caps max-w-[60ch] md:text-right">
              Protection is not a guarantee of profit. Trigger thresholds are illustrative and not
              yet calibrated against historical data.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
