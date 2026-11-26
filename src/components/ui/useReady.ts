import { useEffect, useState } from "react";
/** false durante un instante tras montar: permite mostrar esqueletos de carga en lugar de una pantalla vacía. */
export function useReady(ms = 450): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setReady(true), ms); return () => clearTimeout(id); }, [ms]);
  return ready;
}
