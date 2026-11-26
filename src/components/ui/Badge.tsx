import type { ReactNode } from "react";
export type BadgeTone = "neutral" | "demo" | "live" | "ai" | "ok" | "warn" | "err";
const tones: Record<BadgeTone, string> = {
  neutral: "border-white/15 text-em-muted",
  demo: "border-amber-300/50 text-amber-200",
  live: "border-em-cyan/50 text-em-cyan",
  ai: "border-em-violet/60 text-violet-300",
  ok: "border-em-teal/60 text-em-teal",
  warn: "border-orange-400/60 text-orange-300",
  err: "border-red-400/60 text-red-300",
};
export default function Badge({ tone = "neutral", children, label }: { tone?: BadgeTone; children: ReactNode; label?: string }) {
  return <span aria-label={label} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 ${tones[tone]}`}>{children}</span>;
}
