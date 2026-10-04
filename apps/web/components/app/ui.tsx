"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Info, WarningCircle } from "@phosphor-icons/react";

function panelLeft(
  box: { left: number; right: number },
  align: "start" | "end",
): number {
  const width = Math.min(352, window.innerWidth - 16);
  const preferred = align === "end" ? box.right - width : box.left;
  return Math.max(8, Math.min(preferred, window.innerWidth - width - 8));
}

export function InfoPopover({
  label = "More info",
  children,
  align = "start",
  placement = "below",
}: {
  label?: string;
  children: ReactNode;
  /** Use `end` in narrow right-side panels so the panel opens leftward. */
  align?: "start" | "end";
  /** Prefer `above` in checkout sidebars so copy stays over the card, not below it. */
  placement?: "above" | "below";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [box, setBox] = useState<{ top: number; left: number; right: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const node = buttonRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
    };
    place();
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center border border-line-strong text-fg-muted transition-colors hover:border-fg hover:text-fg"
      >
        <Info size={14} weight="bold" aria-hidden />
      </button>
      {open && box && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="fixed z-50 w-[min(22rem,calc(100vw-2rem))] border border-line-strong bg-surface p-4 text-sm leading-relaxed text-fg-muted shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          style={
            placement === "above"
              ? {
                  bottom: Math.max(8, window.innerHeight - box.top + 8),
                  left: panelLeft(box, align),
                }
              : {
                  top: box.bottom + 8,
                  left: panelLeft(box, align),
                }
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function PageIntro({ title, body }: { title: string; body: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 border-b border-line pb-10"
    >
      <h1 className="display text-[clamp(2.6rem,7.5vw,7rem)]">{title}</h1>
      <p className="mono-caps max-w-[56ch] text-fg-muted">{body}</p>
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, reduce ? { duration: 0 } : { stiffness: 120, damping: 22 });
  const display = useTransform(spring, (v) => format(v));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className="tabular-nums">{display}</motion.span>;
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  hint: string;
  minLabel: string;
  maxLabel: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="label">
            {label}
          </label>
          {hint ? <InfoPopover label={`About ${label}`}>{hint}</InfoPopover> : null}
        </div>
        <output htmlFor={id} className="text-2xl tabular-nums">
          {value}
          <span className="ml-1 text-sm text-fg-muted">{unit}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={`${id}-hint`}
        className="range"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
      <div className="flex justify-between text-xs text-fg-muted">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {hint ? <span id={`${id}-hint`} className="sr-only">{hint}</span> : null}
    </div>
  );
}

export function Stat({
  label,
  children,
  tone = "default",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "default" | "signal" | "danger";
}) {
  const color = tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex flex-col gap-3">
      <span className="label flex items-center gap-2">
        {tone === "signal" && <span aria-hidden className="size-2 bg-signal" />}
        {label}
      </span>
      <span className={`heading text-[clamp(1.6rem,2.4vw,2.2rem)] tabular-nums ${color}`}>{children}</span>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "info" | "danger"; children: React.ReactNode }) {
  const Icon = tone === "danger" ? WarningCircle : Info;
  return (
    <div
      role={tone === "danger" ? "alert" : "note"}
      className={`flex gap-3 border p-4 text-sm leading-relaxed ${
        tone === "danger" ? "border-danger/60 text-danger" : "border-line-strong text-fg-muted"
      }`}
    >
      <Icon size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Section({
  title,
  children,
  aside,
  info,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  info?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-b border-line py-10 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl">{title}</h2>
          {info ? <InfoPopover label={`About ${title}`}>{info}</InfoPopover> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
