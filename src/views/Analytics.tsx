import { useState } from "react";
import { courses, students } from "../data/db";
import { progress } from "../data/selectors";
import { downloadCsv } from "../components/ui/csv";
import { useActionNotice } from "../components/ui/useActionNotice";
import { ownsCourse, scopeStudents, shownName } from "../data/scope";
import { useStore, useUser } from "../store/Store";

export default function Analytics() {
  const { db } = useStore();
  const { run, notice } = useActionNotice();
  const user = useUser();
  const [cohort, setCohort] = useState("");
  const scoped = scopeStudents(db, user);
  const ids = new Set(scoped.map((s) => s.id));
  const myCourses = courses.filter((c) => ownsCourse(user, c));
  const events = db.learningEvents.filter((e) => ids.has(e.studentId) && myCourses.some((c) => c.id === e.courseId));
  const rows = scoped.filter((s) => !cohort || s.cohort === cohort);
  // Avance, nota y señal se calculan SOLO con los cursos del alcance (para el docente, los suyos).
  const mineIds = myCourses.map((c) => c.id);
  const avgProgress = (s: string) => { const es = db.enrollments.filter((e) => e.studentId === s && mineIds.includes(e.courseId)); return es.length ? es.reduce((a, e) => a + progress(db, s, e.courseId), 0) / es.length : 0; };
  const avgScore = (s: string) => { const t = db.attempts.filter((x) => x.studentId === s && mineIds.includes(`c${x.assessmentId.slice(1)}`)); return t.length ? Math.round(t.reduce((a, x) => a + x.score, 0) / t.length) : null; };
  const risk = (s: string) => { const p = avgProgress(s); return p < 0.35 ? "alta" : p < 0.6 ? "media" : "baja"; };
  const exportCsv = () => {
    const filters = `cohorte=${cohort || "todas"}; cursos=${myCourses.map((c) => c.code).join(" ")}`;
    if (!run({ t: "export", text: `Exportación CSV de análisis (${rows.length} filas · ${filters})` })) return;
    downloadCsv("analitica_demo.csv", [`DEMO · exportado ${new Date().toISOString()}`, filters], ["estudiante", "cohorte", "avance_medio_pct", "nota_media", "señal_apoyo"],
      rows.map((s) => [shownName(user, s), s.cohort, Math.round(avgProgress(s.id) * 100), avgScore(s.id) ?? "", risk(s.id)]));
  };
  const nameOf = (id: string) => { const s = students.find((x) => x.id === id); return s ? shownName(user, s) : id; };
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Estudiantes</h2>
        <div className="row-actions"><select value={cohort} onChange={(e) => setCohort(e.target.value)}><option value="">Todas las cohortes</option><option>2026-A</option><option>2026-B</option></select>
          <button onClick={exportCsv}>Exportar CSV</button></div></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Estudiante</th><th>Cohorte</th><th>Avance medio</th><th>Nota media</th><th>Señal de apoyo</th></tr></thead>
          <tbody>{rows.map((s) => <tr key={s.id}><td>{shownName(user, s)}</td><td>{s.cohort}</td><td>{Math.round(avgProgress(s.id) * 100)}%</td><td>{avgScore(s.id) ?? "—"}</td><td><span className={`badge ${risk(s.id) === "alta" ? "warn" : ""}`}>{risk(s.id)}</span></td></tr>)}</tbody></table></div>
        <p className="muted small">Indicador: avance medio = lecciones hechas / requeridas, promediado por matrícula. La señal de apoyo es una estimación para revisión humana, no una sanción.</p></section>
      <section className="card"><div className="card-head"><h2>Consumo de aprendizaje</h2></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Evento</th><th>Estudiante</th><th>Curso</th><th>Entidad</th><th>Fecha</th></tr></thead>
          <tbody>{events.slice(0, 12).map((e) => <tr key={e.id}><td>{e.type}</td><td>{nameOf(e.studentId)}</td><td>{courses.find((c) => c.id === e.courseId)?.title}</td><td className="muted small">{e.entityId ?? "—"}</td><td className="muted small">{new Date(e.at).toLocaleString("es-PE")}</td></tr>)}</tbody></table></div>
        <div className="legend" style={{ marginTop: 10 }}>{["course.opened","lesson.started","lesson.completed","resource.consumed","activity.completed"].map((type) => <span key={type}><i style={{ background: "var(--cyan)" }} />{type}: {events.filter((e) => e.type === type).length}</span>)}</div>
      </section>
      <section className="card"><div className="card-head"><h2>Cursos</h2></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Curso</th><th>Matrículas</th><th>Finalización</th><th>Nota media</th></tr></thead>
          <tbody>{myCourses.map((c) => {
            const es = db.enrollments.filter((e) => e.courseId === c.id), done = es.filter((e) => e.done === c.lessons).length;
            const sc = db.attempts.filter((t) => t.assessmentId === `a${c.id.slice(1)}`);
            return <tr key={c.id}><td>{c.title}</td><td>{es.length}</td><td>{es.length ? Math.round((100 * done) / es.length) : 0}%</td><td>{sc.length ? Math.round(sc.reduce((a, t) => a + t.score, 0) / sc.length) : "—"}</td></tr>;
          })}</tbody></table></div></section>
      {notice}
    </div>
  );
}
