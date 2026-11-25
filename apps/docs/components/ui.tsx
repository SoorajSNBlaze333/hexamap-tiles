"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type ReactNode } from "react";
import { setTheme, useIsDark } from "@/lib/useIsDark";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div className="inline-flex w-full rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800/70">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-md px-2.5 font-medium transition-colors ${
              size === "sm" ? "py-1 text-xs" : "py-1.5 text-[13px]"
            } ${active ? "text-stone-900 dark:text-stone-50" : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-stone-900/5 dark:bg-stone-700 dark:ring-white/5"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-1 text-[13px] text-stone-700 dark:text-stone-300"
    >
      {label}
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-stone-900 dark:bg-stone-100" : "bg-stone-200 dark:bg-stone-700"}`}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm dark:bg-stone-900"
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
        />
      </span>
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ["--range-pct" as string]: `${pct}%` }}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase dark:text-stone-500">{label}</span>
        {hint && <span className="font-mono text-xs text-stone-500 tabular-nums dark:text-stone-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function ThemeToggle() {
  const dark = useIsDark();
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(!dark)}
      className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={dark ? "moon" : "sun"}
          initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2 }}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {dark ? (
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}

export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={`rounded-md px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(copied)} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.12 }} className="block">
          {copied ? "Copied" : "Copy"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function HexLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      {[
        [10, 9, 0.35],
        [22, 9, 0.6],
        [4, 19.5, 0.5],
        [16, 19.5, 1],
        [28, 19.5, 0.25],
      ].map(([x, y, o], i) => (
        <path
          key={i}
          transform={`translate(${x} ${y})`}
          d="M0,-6.4L5.5,-3.2L5.5,3.2L0,6.4L-5.5,3.2L-5.5,-3.2Z"
          fill="currentColor"
          opacity={o}
        />
      ))}
    </svg>
  );
}
