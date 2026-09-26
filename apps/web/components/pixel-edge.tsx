"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Column heights (0-3) for the stair-step edge. Fixed so SSR and client match. */
const HEIGHTS = [0, 2, 1, 3, 1, 0, 2, 3, 2, 1, 0, 3, 2, 1, 2, 0];
const ROWS = 3;

/**
 * Stair-stepped pixel band that transitions the page surface into a full-bleed
 * block. `direction="up"` sits above the block; `"down"` hangs below it.
 */
export function PixelEdge({
  direction = "up",
  tone = "signal",
}: {
  direction?: "up" | "down";
  tone?: "signal" | "inverse";
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-px]", {
          scaleY: 0,
          ease: "power3.out",
          stagger: { each: 0.02, from: "random" },
          scrollTrigger: {
            trigger: root.current,
            start: direction === "up" ? "top bottom" : "top 85%",
            end: direction === "up" ? "bottom 60%" : "bottom 45%",
            scrub: 0.8,
          },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const cells: { col: number; row: number }[] = [];
  HEIGHTS.forEach((h, col) => {
    for (let row = 0; row < ROWS; row++) {
      const filled = direction === "up" ? row >= ROWS - h : row < h;
      if (filled) cells.push({ col, row });
    }
  });

  return (
    <div
      ref={root}
      aria-hidden
      className="grid w-full"
      style={{
        gridTemplateColumns: `repeat(${HEIGHTS.length}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${ROWS}, clamp(22px, 4.2vw, 64px))`,
      }}
    >
      {cells.map(({ col, row }) => (
        <div
          key={`${col}-${row}`}
          data-px
          className={`-m-px ${tone === "signal" ? "bg-signal" : "bg-inverse"}`}
          style={{
            gridColumn: col + 1,
            gridRow: row + 1,
            transformOrigin: direction === "up" ? "bottom" : "top",
          }}
        />
      ))}
    </div>
  );
}
