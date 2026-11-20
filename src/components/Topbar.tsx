import { students } from "../data/db";
import { useStore } from "../store/Store";

export default function Topbar() {
  const { db, sid, setSid } = useStore();
  const last = db.audit[0];
  return (
    <header className="topbar">
      <h1>Aprende • Practica • Destaca</h1>
      <div className="topbar-right">
        <label className="muted small">Estudiante activo{" "}
          <select value={sid} onChange={(e) => setSid(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <span className={db.settings.sim ? "badge live" : "badge off"} role="status">
          {db.settings.sim ? "Simulación en vivo" : "Simulación pausada"} · últ. evento {new Date(last.at).toLocaleTimeString("es-PE")}
        </span>
        <div className="profile">Dra. López <small>Administrador</small></div>
      </div>
    </header>
  );
}
