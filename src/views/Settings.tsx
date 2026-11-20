import { rbac } from "../data/db";
import type { Settings as S } from "../data/db";
import { useStore } from "../store/Store";

const labels: Record<keyof S, string> = { sim: "Simulación de eventos en vivo", reducedMotion: "Reducir movimiento", humanReview: "Revisión docente de recomendaciones" };

export default function Settings() {
  const { db, act } = useStore();
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Parámetros</h2></div>
        <ul className="list">{(Object.keys(labels) as (keyof S)[]).map((k) => <li key={k}><label><input type="checkbox" checked={db.settings[k]} onChange={(e) => { act({ t: "setting", k, v: e.target.checked }); if (k === "reducedMotion") document.body.classList.toggle("rm", e.target.checked); }} /> {labels[k]}</label></li>)}</ul>
        <div className="card-head" style={{ marginTop: 16 }}><h2>Roles y permisos (RBAC)</h2></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Rol</th><th>Usuarios</th><th>Cursos</th><th>Calificaciones</th><th>Auditoría</th></tr></thead>
          <tbody>{rbac.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
        <p className="muted small">En producción la autorización se valida en el backend, no solo en la interfaz.</p></section>
      <section className="card"><div className="card-head"><h2>Auditoría</h2></div>
        <ul className="list">{db.audit.slice(0, 15).map((a) => <li key={a.id}><div>{a.text}<div className="muted small">{a.type}</div></div><span className="muted small">{new Date(a.at).toLocaleTimeString("es-PE")}</span></li>)}</ul></section>
    </div>
  );
}
