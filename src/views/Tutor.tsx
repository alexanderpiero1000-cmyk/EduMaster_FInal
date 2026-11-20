import { courses, skills } from "../data/db";
import { course, enrollment, mastery, probCompletion, risk, student } from "../data/selectors";
import { useStore } from "../store/Store";
import RecommendationList from "../components/RecommendationList";

export default function Tutor() {
  const { db, act, sid } = useStore();
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Estimaciones de {student(sid).name}</h2><span className="badge demo">Estimación IA · no es nota oficial</span></div>
        <p>Señal de apoyo: <span className={`badge ${risk(db, sid) === "alta" ? "warn" : ""}`}>{risk(db, sid)}</span> <span className="muted small">Una probabilidad es una estimación, no un diagnóstico.</span></p>
        <h3>Dominio por competencia</h3>
        <ul className="list">{skills.map((k) => <li key={k.id}><span>{k.name}</span><div className="bar w"><i style={{ width: `${mastery(db, sid, k.id)}%` }} /></div><b>{mastery(db, sid, k.id)}%</b></li>)}</ul>
        <h3>Probabilidad de completar (ventana 30 d)</h3>
        <ul className="list">{courses.filter((c) => enrollment(db, sid, c.id)).map((c) => <li key={c.id}><span>{c.title}</span><b>{Math.round(probCompletion(db, sid, c.id) * 100)}%</b></li>)}</ul>
        <p className="muted small">Modelo: heurística DEMO. Con datos reales: EduMaster Multi-Task Learning Network v1 (por entrenar).</p></section>
      <div>
        <RecommendationList />
        <div className="card" style={{ marginTop: 12 }}>
          <button onClick={() => act({ t: "log", type: "recommendation.created", text: `Ayuda solicitada por ${student(sid).name}: ${course(courses[0].id).title} y brechas recalculadas` })}>Pedir ayuda al tutor</button>
          {db.settings.humanReview && <p className="muted small">Revisión docente activa: el docente puede revisar o anular estas sugerencias.</p>}
        </div>
      </div>
    </div>
  );
}
