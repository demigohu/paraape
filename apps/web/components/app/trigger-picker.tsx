"use client";

import { AnimatePresence, motion } from "motion/react";
import { RangeField } from "@/components/app/ui";
import { TRIGGER_PLANS, type TriggerPlanId } from "@/lib/grid";
import { SEVERITY } from "@/lib/protocol";

type TriggerPickerProps = {
  layoutId: string;
  reduce: boolean;
  activePreset: TriggerPlanId | "custom";
  showSliders: boolean;
  severity: number;
  onPreset: (preset: (typeof TRIGGER_PLANS)[number]) => void;
  onCustom: () => void;
  onSeverity: (v: number) => void;
  snapNote?: string | null;
};

export function TriggerPicker({
  layoutId,
  reduce,
  activePreset,
  showSliders,
  severity,
  onPreset,
  onCustom,
  onSeverity,
  snapNote,
}: TriggerPickerProps) {
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Severity tier"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {TRIGGER_PLANS.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPreset(preset)}
              className={`relative flex flex-col items-start gap-3 border p-5 text-left transition-colors ${
                active ? "border-fg" : "border-line-strong hover:border-fg"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 bg-surface-raised"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative text-sm uppercase tracking-wide">{preset.name}</span>
              <span className="relative text-2xl tabular-nums">−{preset.severity}%</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={activePreset === "custom"}
          onClick={onCustom}
          className={`relative flex flex-col items-start gap-3 border p-5 text-left transition-colors ${
            activePreset === "custom" ? "border-fg" : "border-line-strong hover:border-fg"
          }`}
        >
          {activePreset === "custom" && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 bg-surface-raised"
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
            />
          )}
          <span className="relative text-sm uppercase tracking-wide">Custom</span>
          <span className="relative text-sm text-fg-muted">Choose the drop</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showSliders && (
          <motion.div
            key="trigger-sliders"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-8">
              <RangeField
                label="Drop"
                value={severity}
                min={SEVERITY.min}
                max={SEVERITY.max}
                step={SEVERITY.step}
                unit="% drop"
                onChange={onSeverity}
                minLabel="Pays more often"
                maxLabel="Pays less often"
                hint="How far price must fall from the price when cover starts."
              />
            </div>
            {snapNote ? <p className="pt-4 text-sm text-fg-muted">{snapNote}</p> : null}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
