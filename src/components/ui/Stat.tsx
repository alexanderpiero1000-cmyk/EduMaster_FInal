import { useEffect, useRef, useState } from "react";
import Skeleton from "./Skeleton";

/** Cifra con destello breve cuando cambia (el CSS lo anula con prefers-reduced-motion). */
export function FlashValue({ value, className = "" }: { value: string; className?: string }) {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useEffect(() => { if (prev.current !== value) { prev.current = value; setN((x) => x + 1); } }, [value]);
  return <span key={n} className={`${n > 0 ? "em-flash" : ""} ${className}`}>{value}</span>;
}

export interface StatProps {
  label: string;
  value: string | null;      // null → skeleton de carga
  caption?: string;          // detalle pequeño
  tone?: "default" | "ok" | "ai";
}

export default function Stat({ label, value, caption, tone = "default" }: StatProps) {
  const color = tone === "ok" ? "text-em-teal" : tone === "ai" ? "text-violet-300" : "text-white";
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-em-muted">{label}</div>
      {value === null ? <Skeleton className="mt-2 h-8 w-24" /> : (
        <div aria-live="polite" className={`mt-1 text-3xl font-semibold tabular-nums ${color}`}><FlashValue value={value} /></div>
      )}
      {caption && <div className="mt-1 text-[12px] text-em-muted">{caption}</div>}
    </div>
  );
}
