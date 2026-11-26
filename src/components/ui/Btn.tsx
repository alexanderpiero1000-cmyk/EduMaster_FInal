import type { ButtonHTMLAttributes } from "react";
type Variant = "primary" | "ghost" | "danger";
// El "!" (important) es necesario: global.css define estilos de <button> sin capas que ganarían a las utilidades.
const v: Record<Variant, string> = {
  primary: "bg-em-blue! hover:bg-sky-500! text-em-onaccent! border-transparent!",
  ghost: "bg-transparent! hover:bg-white/10! text-em-text! border-white/15!",
  danger: "bg-red-500/80! hover:bg-red-500! text-em-onaccent! border-transparent!",
};
export default function Btn({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl! border! px-3.5! py-2! text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-2! focus-visible:outline-em-cyan! focus-visible:outline-offset-2! disabled:cursor-not-allowed disabled:opacity-40 ${v[variant]} ${className}`}
    />
  );
}
