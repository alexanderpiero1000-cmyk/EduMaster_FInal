import { useEffect, useState } from "react";
import { useStore } from "../../store/Store";

/** true si el SO pide menos movimiento o si Configuración lo activa. */
export function useReducedMotion(): boolean {
  const { db } = useStore();
  const [os, setOs] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e: MediaQueryListEvent) => setOs(e.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return os || db.settings.reducedMotion;
}
