import { useState } from "react";
import { courses, skills, students } from "../data/db";
import { enrollment, prereqMet, progress, course } from "../data/selectors";
import { useStore } from "../store/Store";

export default function Courses() {
  const { db, act, sid } = useStore();
  const [q, setQ] = useState(""), [lvl, setLvl] = useState("");
  const rows = courses.filter((c) => (c.title + c.code).toLowerCase().includes(q.toLowerCase()) && (!lvl || c.level === lvl));
  return (
    <section className="card">
      <div className="card-head"><h2>Catálogo de cursos</h2>
        <div className="row-actions"><input placeholder="Buscar curso…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">Todos los niveles</option><option>Básico</option><option>Intermedio</option><option>Avanzado</option></select></div></div>
      <div className="scroll"><table className="tbl"><thead><tr><th>Código</th><th>Curso</th><th>Nivel</th><th>Docente</th><th>Competencias</th><th>Inscritos</th><th>Avance medio</th><th>Acción</th></tr></thead>
        <tbody>{rows.map((c) => {
          const es = db.enrollments.filter((e) => e.courseId === c.id);
          const avg = es.length ? Math.round((100 * es.reduce((a, e) => a + e.done / c.lessons, 0)) / es.length) : 0;
          const mine = enrollment(db, sid, c.id);
          return <tr key={c.id}><td>{c.code}</td><td>{c.title}{c.prereq && <div className="muted small">Req.: {course(c.prereq).title}</div>}</td><td>{c.level}</td><td>{c.instructor}</td>
            <td className="small">{c.skills.map((s) => skills.find((k) => k.id === s.id)!.name).join(", ")}</td>
            <td>{es.length}/{students.length}</td><td>{avg}%</td>
            <td>{!mine ? <button disabled={!prereqMet(db, sid, c.id)} onClick={() => act({ t: "enroll", s: sid, c: c.id })}>Inscribir</button>
              : progress(db, sid, c.id) === 1 ? <span className="badge live">Completado</span>
              : <button onClick={() => act({ t: "lesson", s: sid, c: c.id })}>Avanzar lección ({mine.done}/{c.lessons})</button>}</td></tr>;
        })}</tbody></table></div>
    </section>
  );
}
