"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { getLenis } from "@/components/smooth-scroll";
import { gsap, useGSAP } from "@/lib/gsap";
import { pose } from "@/lib/mascot-store";

const COLS = 12;
const ROWS = 8;
const MIN_MS = 900;
const MAX_MS = 12_000;

/**
 * Covers the page while the mascot GLB streams in, then dissolves into a pixel
 * grid. Progress comes from the three.js loading manager via the pose store.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);

  useGSAP(
    () => {
      const html = document.documentElement;
      const release = () => {
        html.style.overflow = "";
        delete html.dataset.scrollLock;
        getLenis()?.start();
      };

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setGone(true);
        onDone();
        return;
      }

      html.style.overflow = "hidden";
      html.dataset.scrollLock = "1";
      window.scrollTo(0, 0);
      getLenis()?.stop();

      const started = performance.now();
      const shown = { value: 0 };
      let exiting = false;

      const exit = () => {
        exiting = true;
        gsap.ticker.remove(tick);
        gsap
          .timeline({
            onComplete: () => {
              release();
              setGone(true);
            },
          })
          .to(shown, {
            value: 100,
            duration: 0.35,
            onUpdate: () => {
              if (counter.current) counter.current.textContent = String(Math.round(shown.value)).padStart(3, "0");
            },
          })
          .to("[data-pre-content]", { autoAlpha: 0, y: -16, duration: 0.35, ease: "power2.in" })
          .set(root.current, { backgroundColor: "transparent" })
          .add(onDone)
          .to("[data-cell]", {
            scale: 0,
            duration: 0.5,
            ease: "power3.in",
            stagger: { each: 0.008, from: "random" },
          });
      };

      const tick = () => {
        if (exiting) return;
        const elapsed = performance.now() - started;
        const target = pose.ready ? 100 : Math.min(pose.progress, 96);
        shown.value += (target - shown.value) * 0.08;
        if (counter.current) counter.current.textContent = String(Math.round(shown.value)).padStart(3, "0");
        if ((pose.ready && elapsed > MIN_MS) || elapsed > MAX_MS) exit();
      };

      gsap.ticker.add(tick);
      gsap.from("[data-pre-logo]", { y: -60, autoAlpha: 0, rotate: -10, duration: 1, ease: "back.out(1.6)" });

      return () => {
        gsap.ticker.remove(tick);
        release();
      };
    },
    { scope: root },
  );

  if (gone) return null;

  return (
    <div
      ref={root}
      role="status"
      aria-label="Loading Paraape"
      className="fixed inset-0 z-[55] bg-surface"
    >
      <div
        aria-hidden
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {Array.from({ length: COLS * ROWS }).map((_, i) => (
          <div key={i} data-cell className="-m-px bg-surface" />
        ))}
      </div>

      <div data-pre-content className="absolute inset-0 flex flex-col items-center justify-center gap-6">
        <Image data-pre-logo src="/paraape_logo.png" alt="" width={120} height={120} loading="eager" />
        <div className="mono-caps flex w-40 justify-between">
          <span>Loading</span>
          <span ref={counter} className="tabular-nums">
            000
          </span>
        </div>
      </div>
    </div>
  );
}
