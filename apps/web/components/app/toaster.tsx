"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

type ToastTone = "ok" | "danger" | "info";

type ToastItem = {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
};

type ToastInput = {
  title: string;
  body?: string;
  tone?: ToastTone;
};

type ToastApi = {
  push: (toast: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((list) => [...list.slice(-2), { id, title: toast.title, body: toast.body, tone: toast.tone ?? "info" }]);
  }, []);

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-20 right-4 z-60 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const reduce = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), 4500);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  const Icon = item.tone === "ok" ? CheckCircle : item.tone === "danger" ? WarningCircle : Info;

  return (
    <motion.div
      role={item.tone === "danger" ? "alert" : "status"}
      aria-labelledby={titleId}
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto flex gap-3 border border-line-strong bg-surface p-4 text-sm text-fg shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    >
      <Icon
        size={18}
        weight="fill"
        aria-hidden
        className={`mt-0.5 shrink-0 ${item.tone === "danger" ? "text-danger" : item.tone === "ok" ? "text-safe" : "text-fg"}`}
      />
      <div className="min-w-0 flex-1">
        <p id={titleId}>{item.title}</p>
        {item.body ? <p className="mt-1 text-fg-muted">{item.body}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="grid size-7 shrink-0 place-items-center text-fg-muted hover:text-fg"
      >
        <X size={14} weight="bold" aria-hidden />
      </button>
    </motion.div>
  );
}
