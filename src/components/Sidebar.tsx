import { visibleSections } from "../data/permissions";
import { roleLabel } from "../data/users";
import { useUser } from "../store/Store";

export default function Sidebar({ active, onSelect }: { active: string; onSelect: (s: string) => void }) {
  const user = useUser();
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="brand">EduMaster<small>.ai</small></div>
      <nav>
        {visibleSections(user.role).map((it) => (
          <button key={it} className={it === active ? "nav active" : "nav"} onClick={() => onSelect(it)}
                  aria-current={it === active ? "page" : undefined}>{it}</button>
        ))}
      </nav>
      <div className="card session-card">
        <span className="muted">Sesión como</span>
        <strong>{roleLabel(user.role)}</strong>
        <span className="badge demo">DATOS SIMULADOS · DEMO</span>
      </div>
    </aside>
  );
}
