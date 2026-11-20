import { course, recommend } from "../data/selectors";
import { useStore } from "../store/Store";

export default function RecommendationList() {
  const { db, act, sid } = useStore();
  const recs = recommend(db, sid).filter((r) => db.recState[r.key] !== "descartada");
  return (
    <section className="card">
      <div className="card-head"><h2>Recomendaciones de IA</h2><span className="badge demo">reglas + brechas · DEMO</span></div>
      {recs.length === 0 ? <p className="muted">Sin recomendaciones vigentes para este estudiante.</p> : (
        <ul className="list">{recs.map((r) => (
          <li key={r.key}>
            <div><b>{r.verb}:</b> {course(r.courseId).title}<div className="muted small">{r.reason}</div></div>
            <div className="row-actions">
              {db.recState[r.key] ? <span className="badge live">{db.recState[r.key]}</span> : <>
                <button onClick={() => { act({ t: "rec", key: r.key, v: "aceptada" }); if (r.verb === "Inscríbete") act({ t: "enroll", s: sid, c: r.courseId }); }}>Aceptar</button>
                <button className="ghost" onClick={() => act({ t: "rec", key: r.key, v: "descartada" })}>Descartar</button></>}
            </div>
          </li>))}
        </ul>)}
    </section>
  );
}
