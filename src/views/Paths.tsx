import { useState } from "react";
import { courses, students } from "../data/db";
import type { Path } from "../data/db";
import { course, enrollment, prereqMet, progress, student } from "../data/selectors";
import { useActionNotice } from "../components/ui/useActionNotice";
import { useStore } from "../store/Store";

/** Etapas de una ruta con avance y prerrequisitos de un estudiante. */
function Stages({ path, sid }: { path: Path; sid: string }) {
  const { db } = useStore();
  return (
    <ol className="steps">{path.courseIds.map((cid) => {
      const c = course(cid), pr = progress(db, sid, cid), enr = enrollment(db, sid, cid);
      const status = pr === 1 ? "Completado" : enr ? `En progreso · ${Math.round(pr * 100)}%` : prereqMet(db, sid, cid) ? "Sin inscribir" : `Bloqueado: requiere ${course(c.prereq!).title}`;
      return <li key={cid}><div><b>{c.title}</b><div className="muted small">{status}</div><div className="bar"><i style={{ width: `${pr * 100}%` }} /></div></div></li>;
    })}</ol>
  );
}

/** Estudiante: sus rutas asignadas, solo lectura. */
function MyPaths() {
  const { db, sid } = useStore();
  const mine = db.paths.filter((p) => db.assignments.some((a) => a.pathId === p.id && a.studentId === sid));
  if (!mine.length) return <section className="card"><p className="muted">Aún no tienes rutas asignadas.</p></section>;
  return (
    <div className="cols">
      {mine.map((p) => {
        const total = p.courseIds.reduce((a, c) => a + progress(db, sid, c), 0) / p.courseIds.length;
        return (
          <section key={p.id} className="card">
            <div className="card-head"><h2>{p.title}</h2><span className="badge">{Math.round(total * 100)}%</span></div>
            <p className="muted">{p.objective}</p>
            <Stages path={p} sid={sid} />
          </section>
        );
      })}
    </div>
  );
}

/** Quien puede asignar (path.assign): crea rutas y las asigna a estudiantes o cohortes. */
function ManagePaths() {
  const { db } = useStore();
  const { run, notice } = useActionNotice();
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState<Record<string, string>>({});
  const cohorts = [...new Set(students.map((s) => s.cohort))];

  const create = () => {
    if (run({ t: "path", title, objective, courseIds: picked })) { setTitle(""); setObjective(""); setPicked([]); }
  };
  const assign = (pathId: string) => {
    const value = target[pathId] ?? `s:${students[0].id}`;
    const list = value.startsWith("c:") ? students.filter((s) => s.cohort === value.slice(2)).map((s) => s.id) : [value.slice(2)];
    list.every((s) => run({ t: "assign", s, p: pathId }));
  };

  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Crear ruta</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input aria-label="Título de la ruta" placeholder="Título de la ruta" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input aria-label="Objetivo" placeholder="Objetivo" value={objective} onChange={(e) => setObjective(e.target.value)} />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="muted small">Cursos (en el orden en que los marques)</legend>
            {courses.map((c) => <label key={c.id} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
              <input type="checkbox" checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />
              {c.title}{picked.includes(c.id) && <span className="muted small">· etapa {picked.indexOf(c.id) + 1}</span>}</label>)}
          </fieldset>
          <button type="button" disabled={!title.trim() || !picked.length} onClick={create}>Crear ruta</button>
        </div>
      </section>
      {db.paths.map((p) => {
        const assigned = db.assignments.filter((a) => a.pathId === p.id);
        return (
          <section key={p.id} className="card">
            <div className="card-head"><h2>{p.title}</h2><span className="badge">{assigned.length} asignadas</span></div>
            <p className="muted">{p.objective}</p>
            <ol className="steps">{p.courseIds.map((c) => <li key={c}>{course(c).title}</li>)}</ol>
            <p className="muted small">{assigned.length ? `Asignada a ${assigned.map((a) => student(a.studentId).name).join(", ")}` : "Sin asignaciones."}</p>
            <div className="row-actions">
              <select aria-label={`Destino de ${p.title}`} value={target[p.id] ?? `s:${students[0].id}`} onChange={(e) => setTarget({ ...target, [p.id]: e.target.value })} style={{ minWidth: 0, flex: 1 }}>
                <optgroup label="Estudiantes">{students.map((s) => <option key={s.id} value={`s:${s.id}`}>{s.name}</option>)}</optgroup>
                <optgroup label="Cohortes">{cohorts.map((c) => <option key={c} value={`c:${c}`}>Cohorte {c}</option>)}</optgroup>
              </select>
              <button type="button" onClick={() => assign(p.id)}>Asignar</button>
            </div>
          </section>
        );
      })}
      {notice}
    </div>
  );
}

export default function Paths() {
  const { can } = useStore();
  return can("path.assign") ? <ManagePaths /> : <MyPaths />;
}
