/** Tooltip accesible: aparece al pasar el ratón o al enfocar con teclado. `align` decide hacia qué lado se despliega. */
export default function InfoTip({ text, label = "Más información", align = "right", className = "" }: { text: string; label?: string; align?: "left" | "right"; className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span tabIndex={0} role="img" aria-label={`${label}: ${text}`}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/20 text-[11px] leading-none text-em-muted outline-none transition-colors duration-150 hover:text-em-cyan focus-visible:ring-2 focus-visible:ring-em-cyan">i</span>
      <span role="tooltip" className={`pointer-events-none invisible absolute top-5 z-30 w-52 max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-em-bg px-3 py-2 text-[12px] leading-snug text-em-text opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${align === "right" ? "right-0" : "left-0"}`}>{text}</span>
    </span>
  );
}
