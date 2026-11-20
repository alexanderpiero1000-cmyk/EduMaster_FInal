import { useState } from "react";
import { courses, students } from "../data/db";
import { avgProgress, avgScore, risk } from "../data/selectors";
import { useStore } from "../store/Store";

export default function Analytics() {
  const { db, act } = useStore();
  const [cohort, setCohort] = useState("");
  const rows = students.filter((s) => !cohort || s.cohort === cohort);
  const exportCsv = () => {
    const head = "estudiante,cohorte,avance_medio_pct,nota_media,señal_apoyo";
    const body = rows.map((s) => [s.name, s.cohort, Math.round(avgProgress(db, s.id) * 100), avgScore(db, s.id) ?? "", risk(db, s.id)].join(","));
    const csv = `# DEMO · filtro cohorte=${cohort || "todas"} · ${new Date().toISOString()}\n${head}\n${body.join("\n")}`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "analitica_demo.csv"; a.click();
    act({ t: "log", type: "export.created", text: `Exportación CSV (${rows.length} filas, cohorte ${cohort || "todas"})` });
  };
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Estudiantes</h2>
        <div className="row-actions"><select value={cohort} onChange={(e) => setCohort(e.target.value)}><option value="">Todas las cohortes</option><option>2026-A</option><option>2026-B</option></select>
          <button onClick={exportCsv}>Exportar CSV</button></div></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Estudiante</th><th>Cohorte</th><th>Avance medio</th><th>Nota media</th><th>Señal de apoyo</th></tr></thead>
          <tbody>{rows.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.cohort}</td><td>{Math.round(avgProgress(db, s.id) * 100)}%</td><td>{avgScore(db, s.id) ?? "—"}</td><td><span className={`badge ${risk(db, s.id) === "alta" ? "warn" : ""}`}>{risk(db, s.id)}</span></td></tr>)}</tbody></table></div>
        <p className="muted small">Indicador: avance medio = lecciones hechas / requeridas, promediado por matrícula. La señal de apoyo es una estimación para revisión humana, no una sanción.</p></section>
      <section className="card"><div className="card-head"><h2>Cursos</h2></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Curso</th><th>Matrículas</th><th>Finalización</th><th>Nota media</th></tr></thead>
          <tbody>{courses.map((c) => {
            const es = db.enrollments.filter((e) => e.courseId === c.id), done = es.filter((e) => e.done === c.lessons).length;
            const sc = db.attempts.filter((t) => t.assessmentId === `a${c.id.slice(1)}`);
            return <tr key={c.id}><td>{c.title}</td><td>{es.length}</td><td>{es.length ? Math.round((100 * done) / es.length) : 0}%</td><td>{sc.length ? Math.round(sc.reduce((a, t) => a + t.score, 0) / sc.length) : "—"}</td></tr>;
          })}</tbody></table></div></section>
    </div>
  );
}
