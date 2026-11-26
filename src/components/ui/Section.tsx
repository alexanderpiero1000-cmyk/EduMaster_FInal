import type { ReactNode } from "react";
import Btn from "./Btn";
import Icon from "./Icon";

/** Sección plegable para divulgación progresiva. */
export default function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <Btn variant="ghost" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Ocultar" : "Mostrar"} ${title}`}>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={14} /> {title}
      </Btn>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
