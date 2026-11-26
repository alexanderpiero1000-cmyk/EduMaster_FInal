import { course, recommend } from "../data/selectors";
import { useStore } from "../store/Store";
import { useActionNotice } from "./ui/useActionNotice";
import { TUTOR_ENGINE } from "./ui/tutorEngine";

export default function RecommendationList({ onOpenLab }: { onOpenLab?: () => void }) {
  const { db, sid, can } = useStore();
  const { run, notice } = useActionNotice();
  const recs = recommend(db, sid).filter((r) => db.recState[r.key] !== "descartada");
  return (
    <section className="card">
      <div className="card-head"><h2>Recomendaciones de IA</h2><span className="badge demo">{TUTOR_ENGINE}</span></div>
      {recs.length === 0 ? <p className="muted">Sin recomendaciones vigentes para este estudiante.</p> : (
        <ul className="list">{recs.map((r) => (
          <li key={r.key}>
            <div><b>{r.verb}:</b> {course(r.courseId).title}<div className="muted small">{r.reason}</div>
              {db.reviews[r.key] && <div className="small ok">Revisada por {db.reviews[r.key].by}{db.reviews[r.key].comment ? `: ${db.reviews[r.key].comment}` : ""}</div>}
              <details className="small" style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer" }}>¿Cómo se generó?</summary>
                <p className="muted">Reglas, no una red: se miran tus competencias con menor dominio (60 % evaluación + 40 % avance) y se propone un curso que las trabaje; si falta un prerrequisito, se sugiere ese primero. Motivo en este caso: {r.reason}. Motor: {TUTOR_ENGINE}.</p>
                {onOpenLab && <button type="button" className="ghost" onClick={onOpenLab}>Ver cómo aprende una red</button>}
              </details></div>
            <div className="row-actions">
              {db.recState[r.key] && <span className="badge live">{db.recState[r.key]}</span>}
              {can("reco.feedback") && db.recState[r.key] !== "util" && <button className="ghost" onClick={() => run({ t: "rec", key: r.key, v: "util" })}>Útil</button>}
              {!db.recState[r.key] && can("reco.feedback") && <>
                <button onClick={() => { if (run({ t: "rec", key: r.key, v: "aceptada" }) && r.verb === "Inscríbete") run({ t: "enroll", s: sid, c: r.courseId }); }}>Aceptar</button>
                <button className="ghost" onClick={() => run({ t: "rec", key: r.key, v: "descartada" })}>Descartar</button></>}
            </div>
          </li>))}
        </ul>)}
      {notice}
    </section>
  );
}
