import { useEffect, useRef, useState } from "react";
import { scopeStudents, shownName, visibleNotifs } from "../data/scope";
import { enabledRoles, roleLabel, users } from "../data/users";
import type { RoleId } from "../data/users";
import { useStore, useUser } from "../store/Store";
import ThemeToggle from "../theme/ThemeToggle";
import { resetDemo } from "../data/persist";
import Icon from "./ui/Icon";

/** Panel desplegable accesible: se cierra con Escape (devuelve el foco) y al hacer clic fuera. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  return { open, setOpen, wrap, trigger };
}

export default function Topbar() {
  const { db, act, sid, setSid, logout, switchRole, setSim, setReducedMotion } = useStore();
  const user = useUser();
  const demo = useDropdown();
  const bell = useDropdown();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!demo.open) setConfirmReset(false); }, [demo.open]);
  const last = db.audit[0];
  const notifs = visibleNotifs(db, user);
  const unread = notifs.filter((x) => !x.read);
  const state = db.settings.sim ? "Simulación en vivo" : "Simulación pausada";

  return (
    <header className="topbar topbar-compact">
      <h1>Aprende • Practica • Destaca</h1>
      <div className="topbar-right">
        <span className={db.settings.sim ? "badge live" : "badge off"} role="status" title={`Último evento ${new Date(last.at).toLocaleTimeString("es-PE")}`}>{state}</span>

        <div className="drop-wrap" ref={demo.wrap}>
          <button type="button" className="ghost" ref={demo.trigger} aria-expanded={demo.open} aria-controls="demo-panel" onClick={() => { bell.setOpen(false); demo.setOpen((v) => !v); }}>
            Demo <Icon name="chevronDown" size={14} />
          </button>
          {demo.open && (
            <div id="demo-panel" className="card drop-panel demo-panel" role="group" aria-label="Controles de demostración">
              <label>Cambiar rol (demo)
                <select value={user.role} onChange={(e) => { switchRole(e.target.value as RoleId); demo.setOpen(false); demo.trigger.current?.focus(); }}>
                  {enabledRoles.map((r) => { const off = users.some((u) => u.role === r && db.inactive.includes(u.id)); return <option key={r} value={r} disabled={off}>{roleLabel(r)}{off ? " (inactivo)" : ""}</option>; })}
                </select>
              </label>
              {(user.role === "docente" || user.role === "superadmin") && (
                <label>{user.role === "superadmin" ? "Ver estudiante (solo lectura)" : "Ver estudiante"}
                  <select value={sid} onChange={(e) => setSid(e.target.value)}>
                    {scopeStudents(db, user).map((s) => <option key={s.id} value={s.id}>{shownName(user, s)}</option>)}
                  </select>
                </label>
              )}
              <button type="button" className="ghost" onClick={() => setSim(!db.settings.sim)}>{db.settings.sim ? "Pausar" : "Reanudar"} simulación</button>
              <label className="switch-row">
                <input type="checkbox" role="switch" checked={db.settings.reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
                Reducir movimiento
              </label>
              {!confirmReset ? <button type="button" className="ghost" onClick={() => setConfirmReset(true)}>Reiniciar demo</button> : (
                <div role="group" aria-label="Confirmar reinicio">
                  <p className="muted small" style={{ margin: "0 0 6px" }}>Se borra todo lo hecho y vuelven los datos iniciales.</p>
                  <div className="row-actions">
                    <button type="button" onClick={resetDemo}>Sí, reiniciar</button>
                    <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ThemeToggle />

        <div className="drop-wrap" ref={bell.wrap}>
          <button type="button" className="ghost" ref={bell.trigger} aria-expanded={bell.open} aria-label={`Notificaciones: ${unread.length} sin leer`} onClick={() => { demo.setOpen(false); bell.setOpen((v) => !v); }}>
            <Icon name="bell" size={18} />{unread.length > 0 && <span className="bell-count">{unread.length}</span>}
          </button>
          {bell.open && (
            <div className="card drop-panel bell-panel" role="dialog" aria-label="Notificaciones">
              <div className="card-head"><h2>Notificaciones</h2>
                <button type="button" className="ghost" disabled={!unread.length} onClick={() => act({ t: "read", ids: unread.map((x) => x.id) })}>Marcar leídas</button></div>
              {notifs.length === 0 ? <p className="muted">Sin notificaciones.</p> : (
                <ul className="list">{notifs.slice(0, 8).map((x) => (
                  <li key={x.id} className={x.read ? "" : "unread"}><div>{x.text}</div><span className="muted small">{new Date(x.at).toLocaleTimeString("es-PE")}</span></li>))}</ul>
              )}
            </div>
          )}
        </div>

        <div className="profile">{user.name} <small>{roleLabel(user.role)}</small></div>
        <button type="button" className="ghost" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
