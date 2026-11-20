import { paths } from "../data/db";
import { course, enrollment, prereqMet, progress, student } from "../data/selectors";
import { useStore } from "../store/Store";

export default function Paths() {
  const { db, act, sid } = useStore();
  return (
    <div className="cols">
      {paths.map((p) => {
        const total = p.courseIds.reduce((a, c) => a + progress(db, sid, c), 0) / p.courseIds.length;
        return (
          <section key={p.id} className="card">
            <div className="card-head"><h2>{p.title}</h2><span className="badge">{Math.round(total * 100)}% · {student(sid).name}</span></div>
            <p className="muted">{p.objective}</p>
            <ol className="steps">{p.courseIds.map((cid) => {
              const c = course(cid), pr = progress(db, sid, cid), enr = enrollment(db, sid, cid);
              const status = pr === 1 ? "Completado" : enr ? "En progreso" : prereqMet(db, sid, cid) ? "Sin inscribir" : `Bloqueado: requiere ${course(c.prereq!).title}`;
              return <li key={cid}><div><b>{c.title}</b><div className="muted small">{status}</div>
                <div className="bar"><i style={{ width: `${pr * 100}%` }} /></div></div></li>;
            })}</ol>
            <button onClick={() => act({ t: "assign", s: sid, p: p.id })}>Asignar a {student(sid).name}</button>
          </section>);
      })}
    </div>
  );
}
