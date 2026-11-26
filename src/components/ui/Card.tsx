import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  right?: ReactNode;
  featured?: boolean;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
  pad?: string;              // relleno interior (por defecto p-5)
}

/** Tarjeta hecha solo con Tailwind (no usa la clase global .card). */
export default function Card({ title, right, featured, className = "", children, ariaLabel, pad = "p-5" }: CardProps) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={`min-w-0 rounded-2xl border bg-gradient-to-br from-em-surface to-em-surface2 ${pad} text-em-text transition-shadow duration-200 ${
        featured ? "border-em-cyan/30 shadow-[0_0_28px_rgba(32,200,245,.14)]" : "border-white/10 shadow-[0_4px_18px_var(--em-shadow)]"
      } ${className}`}
    >
      {(title || right) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="m-0! text-[13px]! font-normal! text-em-muted!">{title}</h3>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
