"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

const ROLES = [
  {
    href: "/protect",
    title: "Buy protection",
    body: "Hold the token, pay a premium in USDG sized by live volatility. If the trigger fires before expiry, the payout is automatic.",
    facts: ["Must hold the token", "7, 14 or 30 days", "No trigger: premium becomes LP yield"],
    cta: "Protect a token",
  },
  {
    href: "/underwrite",
    title: "Underwrite a market",
    body: "Deposit USDG into one token's isolated vault. Set your own severity and window. Earn every premium paid into that market.",
    facts: ["Single-sided USDG", "Isolated per token", "Withdraw what isn't locked"],
    cta: "Underwrite",
  },
];

export function Roles() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const title = SplitText.create("[data-roles-title]", { type: "chars", mask: "chars" });
        gsap.from(title.chars, {
          yPercent: 110,
          stagger: 0.035,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: "[data-roles-title]", start: "top 85%" },
        });

        gsap.utils.toArray<HTMLElement>("[data-role-row]").forEach((row) => {
          gsap
            .timeline({ scrollTrigger: { trigger: row, start: "top 85%" } })
            .from(row.querySelector("[data-rule]"), { scaleX: 0, duration: 1.1, ease: "expo.inOut" })
            .from(row.querySelectorAll("[data-rise]"), { y: 30, autoAlpha: 0, stagger: 0.08, duration: 0.8, ease: "expo.out" }, "-=0.6");
        });

        return () => title.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} data-pose="roles" aria-labelledby="roles-title" className="mx-auto max-w-[1400px] px-4 py-28 md:px-8 md:py-40">
      <h2 id="roles-title" className="sr-only">
        Two sides of every market
      </h2>
      <p aria-hidden data-roles-title className="display text-[clamp(3rem,8vw,8rem)]">
        Two sides
      </p>

      <ul className="mt-14 md:max-w-[64%]">
        {ROLES.map((role, i) => (
          <li key={role.href} data-role-row className="relative">
            <span data-rule aria-hidden className="absolute inset-x-0 top-0 h-px origin-left bg-fg" />
            <Link
              href={role.href}
              className="group relative grid grid-cols-[3rem_1fr] gap-x-4 gap-y-5 overflow-hidden py-8 md:grid-cols-[4rem_1fr_auto] md:py-10"
            >
              <span
                aria-hidden
                className="absolute inset-0 origin-bottom scale-y-0 bg-signal transition-transform duration-[600ms] ease-[var(--ease-out-expo)] group-hover:scale-y-100 group-focus-visible:scale-y-100"
              />
              <span data-rise className="mono-caps relative pl-1 pt-2">
                [0{i + 1}]
              </span>
              <div className="relative flex flex-col gap-4">
                <h3 data-rise className="heading text-[clamp(2rem,3.6vw,3.4rem)]">
                  {role.title}
                </h3>
                <p data-rise className="mono-caps max-w-[48ch] text-fg-muted group-hover:text-fg">
                  {role.body}
                </p>
                <ul data-rise className="mono-caps flex flex-wrap gap-2">
                  {role.facts.map((f) => (
                    <li key={f} className="border border-fg/40 px-2 py-1 group-hover:border-fg">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <span
                data-rise
                className="mono-caps relative col-start-2 flex items-center gap-2 self-end md:col-start-3 md:pr-2"
              >
                {role.cta}
                <ArrowUpRight
                  size={18}
                  weight="bold"
                  aria-hidden
                  className="transition-transform duration-[var(--duration-fast)] group-hover:-translate-y-1 group-hover:translate-x-1"
                />
              </span>
            </Link>
          </li>
        ))}
        <li aria-hidden className="h-px bg-fg" />
      </ul>
    </section>
  );
}
