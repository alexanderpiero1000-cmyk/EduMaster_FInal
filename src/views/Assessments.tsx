import { useState } from "react";
import { useActionNotice } from "../components/ui/useActionNotice";
import { assessments } from "../data/db";
import { best, course, enrollment, probCompletion, progress, student } from "../data/selectors";
import { ownsCourse, scopeStudents, shownName } from "../data/scope";
import { useStore, useUser } from "../store/Store";

export default function Assessments() {
  const { db, sid, can } = useStore();
  const { run, notice } = useActionNotice();
  const user = useUser();
  const [score, setScore] = useState<Record<string, string>>({});
  const name = (id: string) => shownName(user, student(id));
  const inScope = new Set(scopeStudents(db, user).map((s) => s.id));
  const list = assessments.filter((a) => ownsCourse(user, course(a.courseId)));
  const queue = db.submissions.filter((x) => x.status === "pendiente" && ownsCourse(user, course(x.courseId)));
  const recent = db.attempts.filter((t) => inScope.has(t.studentId) && list.some((a) => a.id === t.assessmentId)).slice(0, 8);
  const title = (id: string) => assessments.find((a) => a.id === id)?.title ?? id;

  return (
    <div className="cols">
      {user.role !== "docente" && (
      <section className="card"><div className="card-head"><h2>Evaluaciones · {name(sid)}</h2></div>
        <div className="scroll"><table className="tbl stack"><thead><tr><th>Evaluación</th><th>Avance</th><th>Aprobar con</th><th>Nota oficial</th><th>Estimación IA</th>{can("submit") && <th>Entrega</th>}</tr></thead>
          <tbody>{list.map((a) => {
            const enr = enrollment(db, sid, a.courseId), b = best(db, sid, a.courseId), p = progress(db, sid, a.courseId);
            const pending = db.submissions.some((x) => x.studentId === sid && x.assessmentId === a.id && x.status === "pendiente");
            return <tr key={a.id}><td>{a.title}</td><td data-label="Avance">{enr ? `${Math.round(p * 100)}%` : <span className="muted small">No inscrito</span>}</td><td data-label="Aprobar con">{a.pass}</td>
              <td data-label="Nota oficial">{b === null ? "—" : <b className={b >= a.pass ? "ok" : "bad"}>{b}</b>}</td>
              <td data-label="Estimación IA" className="muted">{enr ? `${Math.round(probCompletion(db, sid, a.courseId) * 100)}% finalizar · DEMO` : "—"}</td>
              {can("submit") && <td data-label="Entrega">{!enr ? "—" : pending ? <span className="badge demo">Pendiente de calificación</span>
                : <><button disabled={p < 0.5} onClick={() => run({ t: "submit", s: sid, a: a.id, c: a.courseId })}>Entregar</button>{p < 0.5 && <div className="muted small">Requiere 50% de avance</div>}</>}</td>}
            </tr>;
          })}</tbody></table></div>
        <p className="muted small">La nota oficial la confirma el docente. La estimación IA se muestra aparte y no es una nota.</p></section>
      )}

      {(can("grade") || user.role === "superadmin") && (
        <section className="card" style={{ order: user.role === "docente" ? -1 : 0 }}><div className="card-head"><h2>{can("grade") ? "Por calificar" : "Cola de calificación (solo lectura)"}</h2><span className="badge">{queue.length}</span></div>
          {queue.length === 0 ? <p className="muted">No hay entregas pendientes{can("grade") ? " en tus cursos" : ""}.</p> : (
            <ul className="list queue" aria-live="polite">{queue.map((x) => {
              const raw = score[x.id] ?? "", v = Number(raw), ok = raw !== "" && v >= 0 && v <= 100;
              return <li key={x.id}><div>{name(x.studentId)}<div className="muted small">{title(x.assessmentId)} · {new Date(x.at).toLocaleTimeString("es-PE")}</div></div>
                {can("grade") ? <div className="row-actions"><input type="number" min={0} max={100} aria-label={`Nota para ${name(x.studentId)}`} placeholder="0-100" value={raw} onChange={(e) => setScore({ ...score, [x.id]: e.target.value })} />
                  <button disabled={!ok} onClick={() => run({ t: "grade", id: x.id, score: v })}>Calificar</button></div> : <span className="badge demo">Pendiente</span>}</li>;
            })}</ul>
          )}
        </section>
      )}

      <section className="card"><div className="card-head"><h2>Intentos recientes</h2></div>
        {recent.length === 0 ? <p className="muted">Aún no hay intentos en tu alcance.</p> :
          <ul className="list">{recent.map((t) => <li key={t.id}><span>{name(t.studentId)} · {title(t.assessmentId)}</span><b>{t.score}</b></li>)}</ul>}</section>
      {notice}
    </div>
  );
}
