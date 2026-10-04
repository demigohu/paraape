"use client";

import type { ReactNode } from "react";

/** Sticky checkout / quote panel (Protect & Underwrite). */
export function CheckoutAside({ children }: { children: ReactNode }) {
  return (
    <aside className="min-w-0 w-full lg:sticky lg:top-24 lg:max-w-md lg:justify-self-end lg:self-start">
      <div className="flex min-w-0 flex-col gap-6 overflow-visible bg-inverse p-6 text-on-inverse sm:gap-8 sm:p-8">
        {children}
      </div>
    </aside>
  );
}

export function AsideStatList({ children }: { children: ReactNode }) {
  return (
    <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-5 text-sm sm:gap-x-6">{children}</dl>
  );
}

export function AsideStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs uppercase tracking-[0.08em] text-on-inverse-muted">{label}</dt>
      <dd className="min-w-0 break-words tabular-nums">{children}</dd>
    </div>
  );
}
