import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../../store/Store";
import type { Action } from "../../store/Store";

export const DENIED_TEXT = "Acción no permitida para tu rol";

/**
 * Aviso compartido de acción rechazada. `run` ejecuta act() y avisa si la guarda lo rechaza;
 * `deny` muestra el aviso a mano. `notice` debe renderizarse una vez en la vista (región role="status").
 */
export function useActionNotice() {
  const { act } = useStore();
  const [message, setMessage] = useState("");
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current !== null) clearTimeout(timer.current); };
  useEffect(() => clear, []);
  const deny = useCallback(() => {
    clear();
    setMessage(DENIED_TEXT);
    timer.current = window.setTimeout(() => setMessage(""), 4000);
  }, []);
  const run = (a: Action) => { const ok = act(a); if (!ok) deny(); return ok; };
  const notice = <div role="status" className={message ? "action-notice show" : "action-notice"}>{message}</div>;
  return { run, deny, notice };
}
