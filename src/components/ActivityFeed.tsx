import { visibleAudit } from "../data/scope";
import { useStore, useUser } from "../store/Store";

export default function ActivityFeed({ limit = 6 }: { limit?: number }) {
  const { db } = useStore();
  const rows = visibleAudit(db, useUser()).slice(0, limit);
  return (
    <section className="card">
      <div className="card-head"><h2>Actividad reciente</h2></div>
      {rows.length === 0 ? <p className="muted">Aún no hay actividad en tu alcance.</p> : (
        <ul className="list" aria-live="polite">
          {rows.map((a) => (
            <li key={a.id}><div>{a.text}<div className="muted small">{a.type}</div></div>
              <span className="muted small">{new Date(a.at).toLocaleTimeString("es-PE")}</span></li>))}
        </ul>
      )}
    </section>
  );
}
