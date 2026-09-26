"use client";

import { useEffect, useId } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Info, WarningCircle } from "@phosphor-icons/react";

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
        <label htmlFor={id} className="label">
          {label}
        </label>
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
      <p id={`${id}-hint`} className="text-sm leading-relaxed text-fg-muted">
        {hint}
      </p>
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
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-b border-line py-10 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
