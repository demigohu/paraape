"use client";

import { useRef } from "react";
import { Drop, Scales, UserMinus } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

type Guard = {
  title: string;
  body: string;
  stops: string;
  icon: Icon;
  tone: string;
  muted: string;
};

const GUARDS: Guard[] = [
  {
    title: "You still have to hold it",
    body: "Sell the coins and the payout dies with them. This pays holders, not the wallet that dumped.",
    stops: "Cover bought, then sold by the same wallet",
    icon: UserMinus,
    tone: "bg-inverse text-on-inverse",
    muted: "text-on-inverse-muted",
  },
  {
    title: "The crash has to cost more",
    body: "What you can collect stays under the cost of forcing that fall in the pool.",
    stops: "A payout bigger than the shove",
    icon: Scales,
    tone: "bg-signal text-fg",
    muted: "text-fg",
  },
  {
    title: "Skinny pools stay out",
    body: "If a small trade can fake the crash, that coin does not get a market.",
    stops: "Pools anyone can shove",
    icon: Drop,
    tone: "bg-surface-raised text-fg border border-fg",
    muted: "text-fg-muted",
  },
];

export function Safeguards() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const title = SplitText.create("[data-guards-title]", { type: "chars", mask: "chars" });
        gsap.from(title.chars, {
          yPercent: 110,
          stagger: 0.035,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: "[data-guards-title]", start: "top 85%" },
        });
        return () => title.revert();
      });

      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-guard]");
        cards.forEach((card, i) => {
          gsap.from(card, {
            yPercent: 18,
            rotate: i % 2 ? 2 : -2,
            ease: "power2.out",
            scrollTrigger: { trigger: card, start: "top bottom", end: "top 55%", scrub: 1 },
          });
          const next = cards[i + 1];
          if (!next) return;
          gsap
            .timeline({ scrollTrigger: { trigger: next, start: "top 70%", end: "top 25%", scrub: true } })
            .to(card, { scale: 0.93, ease: "none" })
            .to(card.querySelector("[data-dim]"), { opacity: 0.55, ease: "none" }, 0);
        });
      });

      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 767px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-guard]").forEach((card, i) => {
          gsap
            .timeline({ scrollTrigger: { trigger: card, start: "top 88%" } })
            .from(card, {
              clipPath: "inset(100% 0% 0% 0%)",
              rotate: i % 2 ? 1.5 : -1.5,
              duration: 1.1,
              ease: "expo.inOut",
            })
            .from(
              card.querySelectorAll(":scope > div:first-of-type, h3, p"),
              { y: 28, autoAlpha: 0, stagger: 0.06, duration: 0.8, ease: "expo.out" },
              "-=0.55",
            );
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} data-pose="guards" aria-labelledby="guards-title" className="mx-auto max-w-[1400px] px-4 pt-28 md:px-8 md:pt-40">
      <h2 id="guards-title" className="sr-only">
        Three reasons a fake crash does not get paid
      </h2>
      <p aria-hidden data-guards-title className="display text-[clamp(3rem,8vw,8rem)]">
        Defense
      </p>
      <p className="mono-caps mt-6 max-w-[40ch] text-fg-muted">
        Three reasons a fake crash does not get paid.
      </p>

      <div className="flex flex-col gap-6 pb-10 pt-14 md:max-w-[62%] md:gap-[16vh] md:pb-24">
        {GUARDS.map((g, i) => {
          const Icon = g.icon;
          return (
            <article
              key={g.title}
              data-guard
              style={{ top: `calc(6rem + ${i * 26}px)` }}
              className={`${g.tone} relative flex origin-top flex-col justify-between gap-12 p-7 will-change-transform md:sticky md:min-h-[54dvh] md:p-12`}
            >
              <span data-dim aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-fg opacity-0" />
              <div className="flex items-start justify-between">
                <span className="mono-caps">[0{i + 1}]</span>
                <Icon size={36} weight="light" aria-hidden />
              </div>
              <div className="flex flex-col gap-5">
                <h3 className="heading text-[clamp(2rem,3.8vw,3.6rem)]">{g.title}</h3>
                <p className={`mono-caps max-w-[48ch] ${g.muted}`}>{g.body}</p>
                <p className="mono-caps border-t border-current pt-4">Stops: {g.stops}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
