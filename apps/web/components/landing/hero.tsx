"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Roll } from "@/components/chrome";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { useIntroDone } from "./landing-shell";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const introDone = useIntroDone();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set("[data-hero-reveal]", { autoAlpha: 0 });

        gsap.to("[data-drift='left']", {
          xPercent: -8,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to("[data-drift='right']", {
          xPercent: 8,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (!introDone) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const display = SplitText.create("[data-hero-display]", { type: "words,chars", mask: "chars" });
        const body = SplitText.create("[data-hero-body]", { type: "lines", mask: "lines" });

        gsap.set("[data-hero-reveal]", { autoAlpha: 1 });
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .from(display.chars, { yPercent: 110, duration: 1.1, stagger: 0.028 })
          .from(body.lines, { yPercent: 100, duration: 0.9, stagger: 0.07 }, "-=0.8")
          .from("[data-hero-cta]", { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, "-=0.6")
          .from("[data-scramble]", {
            duration: 1.1,
            scrambleText: { text: "{original}", chars: "01$#%", speed: 0.6 },
            stagger: 0.15,
          }, "-=0.9");

        return () => {
          display.revert();
          body.revert();
        };
      });
      return () => mm.revert();
    },
    { dependencies: [introDone], scope: root },
  );

  return (
    <section
      ref={root}
      data-pose="hero"
      className="relative mx-auto flex min-h-[calc(100dvh-64px)] max-w-[1400px] flex-col justify-between gap-8 overflow-hidden px-4 pb-8 pt-8 md:px-8 md:pb-10"
    >
      <h1 className="sr-only">Get rugged. Get paid.</h1>

      <div aria-hidden data-hero-reveal data-drift="left" className="display order-1 text-[clamp(2.2rem,9.6vw,4rem)] md:text-[clamp(3rem,7.4vw,7.6rem)]">
        <span data-hero-display className="block pb-[0.06em]">
          Get rugged.
        </span>
      </div>

      <div data-hero-reveal className="order-3 flex flex-col gap-6 md:order-2 md:max-w-[34ch]">
        <p className="mono-caps text-fg-muted">About</p>
        <p data-hero-body className="mono-caps">
          The bag stays yours. Name the crash. If the coin falls that far, you get paid in USDG.
          Nobody has to approve it.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link data-hero-cta href="/protect" className="btn btn-primary">
            <Roll>Protect a token</Roll>
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
          <Link data-hero-cta href="/underwrite" className="btn btn-ghost">
            <Roll>Underwrite</Roll>
          </Link>
        </div>
        <dl className="mono-caps hidden grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-line pt-4 md:grid">
          <dt className="text-fg-muted">Network:</dt>
          <dd data-scramble>Robinhood Chain</dd>
          <dt className="text-fg-muted">Settles in:</dt>
          <dd data-scramble>USDG</dd>
        </dl>
      </div>

      <div aria-hidden data-hero-reveal data-drift="right" className="display order-2 text-[clamp(2.2rem,9.6vw,4rem)] md:text-[clamp(3rem,7.4vw,7.6rem)] md:order-3">
        <span data-hero-display className="block pb-[0.06em]">
          Get <span className="bg-signal px-[0.08em]">paid.</span>
        </span>
      </div>

      <div aria-hidden className="order-4 h-[34dvh] md:hidden" />
    </section>
  );
}
