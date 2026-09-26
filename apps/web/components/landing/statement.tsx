"use client";

import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

export function Statement() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create("[data-fold]", { type: "lines", linesClass: "fold-line" });
        gsap.set(root.current!.querySelectorAll(".fold-line"), { transformPerspective: 900 });

        gsap.from(split.lines, {
          rotationX: -95,
          yPercent: 40,
          autoAlpha: 0,
          transformOrigin: "50% 0% -30px",
          ease: "power2.out",
          stagger: 0.18,
          scrollTrigger: { trigger: root.current, start: "top 80%", end: "center 55%", scrub: 1 },
        });

        gsap.from("[data-statement-note]", {
          autoAlpha: 0,
          y: 20,
          scrollTrigger: { trigger: "[data-statement-note]", start: "top 90%", end: "top 70%", scrub: 1 },
        });

        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      data-pose="statement"
      aria-label="Why Paraape"
      className="mx-auto max-w-[1400px] px-4 py-28 md:px-8 md:py-44"
    >
      <div className="flex flex-col gap-10 md:max-w-[60%]">
        <p data-fold className="heading text-[clamp(2.2rem,5vw,4.6rem)]">
          Scanners warn you before the rug.
        </p>
        <p data-fold className="heading text-[clamp(2.2rem,5vw,4.6rem)] text-fg-muted">
          Paraape pays you after it.
        </p>
        <p data-statement-note className="mono-caps max-w-[44ch]">
          Existing tools detect and warn. None of them compensate a trader who gets rugged anyway.
          Paraape is payout insurance, isolated per token and settled on-chain.
        </p>
      </div>
    </section>
  );
}
