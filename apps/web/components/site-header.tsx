"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List, X } from "@phosphor-icons/react";
import { NAV } from "@/lib/nav";
import { BrandLink } from "./brand";
import { Roll } from "./chrome";
import { ConnectButton } from "./wallet";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-8">
        <BrandLink />

        <div className="hidden items-center gap-10 md:flex">
          <nav aria-label="Primary" className="flex items-center gap-8">
            {NAV.map((item) => {
              const active = !item.external && pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 py-2 text-xs uppercase tracking-[0.06em] ${
                    active ? "text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      aria-hidden
                      className="size-2 bg-signal"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Roll>{item.label}</Roll>
                </Link>
              );
            })}
          </nav>
          <ConnectButton />
        </div>

        <button
          type="button"
          className="grid size-11 place-items-center border border-fg md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} aria-hidden /> : <List size={20} aria-hidden />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-surface px-4 pb-6 md:hidden"
          >
            <ul className="flex flex-col">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={() => setOpen(false)}
                    aria-current={!item.external && pathname.startsWith(item.href) ? "page" : undefined}
                    className="display flex h-14 items-center border-b border-line text-[clamp(1.5rem,7vw,2rem)] aria-[current=page]:underline aria-[current=page]:decoration-signal aria-[current=page]:decoration-4 aria-[current=page]:underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ConnectButton className="mt-6 w-full" />
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
