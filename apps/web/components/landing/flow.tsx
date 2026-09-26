"use client";

import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

const STEPS = [
  {
    title: "Paste the contract address",
    body: "No market yet? The factory deploys an isolated vault for that token, permissionlessly.",
  },
  {
    title: "Pick severity and window",
    body: "Choose how deep and how fast a crash must be. Quotes update from live volatility.",
  },
  {
    title: "Pay the premium in USDG",
    body: "Your wallet balance is checked first. Protection only covers tokens you actually hold.",
  },
  {
    title: "Get paid, or let it expire",
    body: "If TWAP confirms the trigger, a keeper settles and USDG arrives. If not, the premium is LP yield.",
  },
];

export function Flow() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const title = SplitText.create("[data-flow-title]", { type: "chars", mask: "chars" });
        gsap.from(title.chars, {
          yPercent: 110,
          stagger: 0.035,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: "[data-flow-title]", start: "top 85%" },
        });

        const splits: SplitText[] = [];
        gsap.utils.toArray<HTMLElement>("[data-flow-step]").forEach((step) => {
          const heading = SplitText.create(step.querySelector("h3"), { type: "lines", mask: "lines" });
          splits.push(heading);
          const num = step.querySelector("[data-num]");

          gsap
            .timeline({
              scrollTrigger: { trigger: step, start: "top 80%", end: "top 40%", scrub: 1 },
            })
            .fromTo(step, { opacity: 0.25 }, { opacity: 1, ease: "none" })
            .from(heading.lines, { yPercent: 100, stagger: 0.1, ease: "power2.out" }, 0);

          gsap.from(num, {
            duration: 1,
            scrambleText: { text: "{original}", chars: "0123456789", speed: 0.5 },
            scrollTrigger: { trigger: step, start: "top 75%" },
          });
        });

        return () => {
          title.revert();
          splits.forEach((s) => s.revert());
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} data-pose="flow" aria-labelledby="flow-title" className="mx-auto max-w-[1400px] px-4 py-28 md:px-8 md:py-40">
      <h2 id="flow-title" className="sr-only">
        Four steps from address to payout
      </h2>
      <p aria-hidden data-flow-title className="display text-[clamp(3rem,8vw,8rem)]">
        How it works
      </p>

      <ol className="mt-16 flex flex-col md:max-w-[62%]">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            data-flow-step
            className="grid grid-cols-1 gap-4 border-t border-fg py-10 md:grid-cols-[9rem_1fr] md:gap-8 md:py-14"
          >
            <span data-num aria-hidden className="display text-[clamp(2.6rem,4.6vw,4.4rem)] tabular-nums">
              00{i + 1}
            </span>
            <div className="flex flex-col gap-4">
              <h3 className="heading text-[clamp(1.8rem,3vw,2.8rem)]">{step.title}</h3>
              <p className="mono-caps max-w-[46ch] text-fg-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
