import { useStore } from "../store/Store";

export default function ActivityFeed({ limit = 6 }: { limit?: number }) {
  const { db } = useStore();
  return (
    <section className="card">
      <div className="card-head"><h2>Actividad reciente</h2></div>
      <ul className="list" aria-live="polite">
        {db.audit.slice(0, limit).map((a) => (
          <li key={a.id}><div>{a.text}<div className="muted small">{a.type}</div></div>
            <span className="muted small">{new Date(a.at).toLocaleTimeString("es-PE")}</span></li>))}
      </ul>
    </section>
  );
}
