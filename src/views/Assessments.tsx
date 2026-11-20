import { useState } from "react";
import { assessments } from "../data/db";
import { best, course, enrollment, probCompletion, student } from "../data/selectors";
import { useStore } from "../store/Store";

export default function Assessments() {
  const { db, act, sid } = useStore();
  const [score, setScore] = useState<Record<string, string>>({});
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Evaluaciones · {student(sid).name}</h2></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Evaluación</th><th>Aprobar con</th><th>Nota oficial</th><th>Estimación IA</th><th>Registrar intento</th></tr></thead>
          <tbody>{assessments.map((a) => {
            const enr = enrollment(db, sid, a.courseId), b = best(db, sid, a.courseId), v = Number(score[a.id]);
            const ok = score[a.id] !== undefined && score[a.id] !== "" && v >= 0 && v <= 100;
            return <tr key={a.id}><td>{a.title}</td><td>{a.pass}</td>
              <td>{b === null ? "—" : <b className={b >= a.pass ? "ok" : "bad"}>{b}</b>}</td>
              <td className="muted">{enr ? `${Math.round(probCompletion(db, sid, a.courseId) * 100)}% finalizar` : "—"}</td>
              <td>{enr ? <div className="row-actions"><input type="number" min={0} max={100} style={{ width: 70 }} value={score[a.id] ?? ""} onChange={(e) => setScore({ ...score, [a.id]: e.target.value })} />
                <button disabled={!ok} onClick={() => { act({ t: "attempt", s: sid, a: a.id, c: a.courseId, score: v }); setScore({ ...score, [a.id]: "" }); }}>Registrar</button></div> : <span className="muted small">No inscrito en {course(a.courseId).title}</span>}</td></tr>;
          })}</tbody></table></div>
        <p className="muted small">La nota oficial y la estimación IA se guardan por separado. Registrar un intento actualiza dominio, analítica y elegibilidad de certificado.</p></section>
      <section className="card"><div className="card-head"><h2>Intentos recientes</h2></div>
        <ul className="list">{db.attempts.slice(0, 8).map((t) => <li key={t.id}><span>{student(t.studentId).name} · {assessments.find((a) => a.id === t.assessmentId)!.title}</span><b>{t.score}</b></li>)}</ul></section>
    </div>
  );
}
