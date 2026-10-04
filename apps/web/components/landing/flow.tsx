"use client";

import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

const STEPS = [
  {
    title: "Bring the coin",
    body: "Paste the address. If nobody is backing it yet, a USDG deposit opens it. That coin's money never mixes with another.",
  },
  {
    title: "Name the crash",
    body: "How far it has to fall, and how long you want to be covered: a day, three days, a week, two weeks, or a month.",
  },
  {
    title: "Pay in USDG",
    body: "Only coins still in your wallet count. Cover turns on about half an hour after you pay.",
  },
  {
    title: "Get paid, or don't",
    body: "Still down that far? USDG hits your wallet. It bounced? The premium stays with the people who backed you.",
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
