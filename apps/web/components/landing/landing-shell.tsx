"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { POSES, POSE_ORDER, pose } from "@/lib/mascot-store";
import { Preloader } from "./preloader";

const MascotCanvas = dynamic(() => import("./mascot-canvas"), { ssr: false });

const IntroContext = createContext(false);

/** True once the preloader has cleared and hero entrance animations may run. */
export function useIntroDone() {
  return useContext(IntroContext);
}

export function LandingShell({ children }: { children: React.ReactNode }) {
  const [introDone, setIntroDone] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const handleDone = useCallback(() => setIntroDone(true), []);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: reduce)", () => {
      pose.reduced = true;
      pose.descent = 1;
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      pose.reduced = false;
      for (let i = 1; i < POSE_ORDER.length; i++) {
        const from = POSES[POSE_ORDER[i - 1]!];
        const key = POSE_ORDER[i]!;
        gsap.fromTo(pose, { ...from }, {
          ...POSES[key],
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: `[data-pose="${key}"]`,
            start: "top bottom",
            end: "top 25%",
            scrub: 1.2,
          },
        });
      }
    });

    mm.add("(min-width: 768px)", () => {
      gsap.to(stage.current, {
        autoAlpha: 0,
        yPercent: -12,
        ease: "none",
        scrollTrigger: { trigger: "[data-site-footer]", start: "top 90%", end: "top 45%", scrub: true },
      });
    });

    mm.add("(max-width: 767px)", () => {
      gsap.to(stage.current, {
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: { trigger: '[data-pose="hero"]', start: "bottom 85%", end: "bottom 35%", scrub: true },
      });
    });

    ScrollTrigger.refresh();
    return () => mm.revert();
  });

  useGSAP(
    () => {
      if (!introDone || pose.reduced) return;
      gsap.fromTo(pose, { descent: 0 }, { descent: 1, duration: 2.6, ease: "power2.out" });
    },
    { dependencies: [introDone] },
  );

  return (
    <IntroContext value={introDone}>
      <Preloader onDone={handleDone} />
      <div
        ref={stage}
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-0 z-30 h-[38dvh] w-full md:top-16 md:h-auto md:w-[40vw] md:max-w-[680px]"
      >
        <MascotCanvas />
      </div>
      {children}
    </IntroContext>
  );
}
