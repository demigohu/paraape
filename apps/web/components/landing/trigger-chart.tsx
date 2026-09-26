"use client";

import { useRef } from "react";
import { PixelEdge } from "@/components/pixel-edge";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { pose } from "@/lib/mascot-store";

/** Sample price path: a pump-and-dump (not covered) followed by a rug (covered). */
const POINTS: [number, number][] = [
  [0, 100], [5, 104], [9, 97], [13, 118], [17, 135], [21, 142], [24, 128],
  [28, 96], [32, 74], [36, 68], [40, 79], [44, 88], [48, 84], [52, 97],
  [56, 104], [60, 101], [64, 109], [68, 112], [71, 108], [74, 111], [76, 110],
  [77, 62], [78, 30], [79, 16], [80, 13], [84, 12], [90, 11], [96, 12], [100, 11],
];

const W = 1000;
const H = 420;
const PAD = { top: 30, bottom: 30, left: 4, right: 4 };
const sx = (x: number) => PAD.left + (x / 100) * (W - PAD.left - PAD.right);
const sy = (p: number) => PAD.top + (1 - p / 160) * (H - PAD.top - PAD.bottom);

const LINE = POINTS.map(([x, p], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(p).toFixed(1)}`).join(" ");
const TRIGGER_LEVEL = 110 * 0.15;

const STEPS = [
  { title: "Pump-and-dump", body: "-52% over three hours. Steep but slow, so the pool never pays." },
  { title: "Severity + speed", body: "-88% inside 8 minutes. Payout needs both: 85% down, within 10 minutes." },
  { title: "TWAP confirms", body: "Read from the token's own V4 pool. A keeper settles, USDG arrives." },
];

export function TriggerChart() {
  const pinned = useRef<HTMLElement>(null);
  const line = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const path = line.current!;
        const head = dot.current!;
        const total = path.getTotalLength();

        const lengthAtX = (x: number) => {
          let lo = 0;
          let hi = total;
          for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) / 2;
            if (path.getPointAtLength(mid).x < sx(x)) lo = mid;
            else hi = mid;
          }
          return lo / total;
        };

        const proxy = { p: 0 };
        const render = () => {
          path.style.strokeDashoffset = String(total * (1 - proxy.p));
          const pt = path.getPointAtLength(total * proxy.p);
          head.setAttribute("cx", String(pt.x));
          head.setAttribute("cy", String(pt.y));
        };

        path.style.strokeDasharray = String(total);
        render();
        gsap.set("[data-annot]", { autoAlpha: 0 });
        gsap.set("[data-step]", { opacity: 0.3 });

        const title = SplitText.create("[data-trigger-title]", { type: "chars", mask: "chars" });
        gsap.from(title.chars, {
          yPercent: 110,
          stagger: 0.04,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: pinned.current, start: "top 70%" },
        });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: pinned.current,
            start: "top top",
            end: "+=220%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        tl.to(proxy, { p: lengthAtX(36), duration: 0.3, onUpdate: render })
          .to("[data-annot=dump]", { autoAlpha: 1, duration: 0.05 })
          .to("[data-step='0']", { opacity: 1, duration: 0.05 }, "<")
          .to(proxy, { p: lengthAtX(76), duration: 0.22, onUpdate: render })
          .to("[data-annot=level]", { autoAlpha: 1, duration: 0.05 }, "-=0.08")
          .to(proxy, { p: lengthAtX(80), duration: 0.14, onUpdate: render })
          .to(pose, { dip: -0.22, jolt: 1, duration: 0.14 }, "<")
          .to("[data-annot=rug]", { autoAlpha: 1, duration: 0.05 })
          .to("[data-step='0']", { opacity: 0.3, duration: 0.05 }, "<")
          .to("[data-step='1']", { opacity: 1, duration: 0.05 }, "<")
          .to(proxy, { p: 1, duration: 0.12, onUpdate: render })
          .to(pose, { dip: 0, jolt: 0, duration: 0.12 }, "<")
          .to("[data-annot=payout]", { autoAlpha: 1, duration: 0.05 })
          .to("[data-step='1']", { opacity: 0.3, duration: 0.05 }, "<")
          .to("[data-step='2']", { opacity: 1, duration: 0.05 }, "<")
          .to({}, { duration: 0.12 });

        return () => title.revert();
      });
      return () => mm.revert();
    },
    { scope: pinned },
  );

  return (
    <div data-pose="trigger" className="mt-10">
      <PixelEdge direction="up" tone="inverse" />
      <section
        ref={pinned}
        aria-labelledby="trigger-title"
        className="relative flex min-h-[100dvh] flex-col justify-center bg-inverse text-on-inverse"
      >
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-16 md:px-8">
          <div className="flex flex-col gap-4 md:max-w-[62%]">
            <h2 id="trigger-title" className="sr-only">
              Only rugs trigger. Normal dumps don&apos;t.
            </h2>
            <p aria-hidden data-trigger-title className="display text-[clamp(3rem,8vw,8rem)]">
              Trigger
            </p>
            <p className="mono-caps text-on-inverse-muted">Only rugs trigger. Normal dumps don&apos;t.</p>
          </div>

          <figure className="relative md:max-w-[62%]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto max-h-[46dvh] w-full overflow-visible"
              role="img"
              aria-label="Sample price chart. A 52% drop over three hours does not trigger. An 88% drop inside eight minutes triggers a payout."
            >
              {[40, 80, 120].map((p) => (
                <line key={p} x1={sx(0)} x2={sx(100)} y1={sy(p)} y2={sy(p)} stroke="rgb(219 219 218 / 0.12)" />
              ))}

              <g data-annot="dump" fill="var(--color-on-inverse-muted)" stroke="var(--color-on-inverse-muted)">
                <line x1={sx(21)} x2={sx(21)} y1={sy(142)} y2={sy(142) - 14} />
                <line x1={sx(36)} x2={sx(36)} y1={sy(68)} y2={sy(142) - 14} strokeDasharray="3 4" />
                <line x1={sx(21)} x2={sx(36)} y1={sy(142) - 14} y2={sy(142) - 14} />
                <text x={sx(21)} y={sy(142) - 24} fontSize={16} stroke="none">
                  -52% / 3H. NOT COVERED
                </text>
              </g>

              <g data-annot="level">
                <line x1={sx(0)} x2={sx(100)} y1={sy(TRIGGER_LEVEL)} y2={sy(TRIGGER_LEVEL)} stroke="var(--color-signal)" strokeDasharray="6 6" />
                <text x={sx(0)} y={sy(TRIGGER_LEVEL) - 10} fill="var(--color-signal)" fontSize={16}>
                  TRIGGER LEVEL: -85%
                </text>
              </g>

              <g data-annot="rug">
                <rect
                  x={sx(76)}
                  y={PAD.top}
                  width={sx(80) - sx(76)}
                  height={H - PAD.top - PAD.bottom}
                  fill="var(--color-signal)"
                  opacity={0.28}
                />
                <text x={sx(80) + 12} y={sy(110)} fill="var(--color-signal)" fontSize={16}>
                  -88% / 8 MIN
                </text>
              </g>

              <path
                ref={line}
                d={LINE}
                fill="none"
                stroke="var(--color-on-inverse)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle ref={dot} cx={sx(100)} cy={sy(11)} r={7} fill="var(--color-signal)" />
              <line x1={sx(0)} x2={sx(100)} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="rgb(219 219 218 / 0.4)" />
            </svg>

            <div data-annot="payout" className="absolute right-0 top-[36%] bg-signal px-4 py-3 text-fg">
              <p className="mono-caps">Policy settled</p>
              <p className="heading mt-1 text-2xl">+2,500 USDG</p>
            </div>
            <figcaption className="mono-caps mt-2 text-on-inverse-muted">Sample price path, for illustration.</figcaption>
          </figure>

          <ol className="grid grid-cols-1 gap-4 border-t border-on-inverse/25 pt-5 sm:grid-cols-3 md:max-w-[62%]">
            {STEPS.map((step, i) => (
              <li key={step.title} data-step={i} className="flex flex-col gap-2">
                <span className="mono-caps text-signal">[0{i + 1}]</span>
                <h3 className="heading text-xl">{step.title}</h3>
                <p className="mono-caps text-on-inverse-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <PixelEdge direction="down" tone="inverse" />
    </div>
  );
}
