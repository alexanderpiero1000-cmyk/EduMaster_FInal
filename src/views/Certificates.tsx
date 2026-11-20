import { useState } from "react";
import { courses, students } from "../data/db";
import { course, eligible, student } from "../data/selectors";
import { useStore } from "../store/Store";

export default function Certificates() {
  const { db, act } = useStore();
  const [code, setCode] = useState("");
  const pending = students.flatMap((s) => courses.filter((c) => eligible(db, s.id, c.id)).map((c) => ({ s, c })));
  const found = db.certs.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>Elegibles para emitir</h2></div>
        {pending.length === 0 ? <p className="muted">Nadie cumple aún: requiere curso al 100% y evaluación aprobada.</p> :
          <ul className="list">{pending.map(({ s, c }) => <li key={s.id + c.id}><span>{s.name} · {c.title}</span><button onClick={() => act({ t: "issue", s: s.id, c: c.id })}>Emitir</button></li>)}</ul>}
        <div className="card-head" style={{ marginTop: 16 }}><h2>Verificación pública</h2></div>
        <input placeholder="Código, ej. VS1C1" value={code} onChange={(e) => setCode(e.target.value)} />
        {code && (found ? <p>Válido: <b>{course(found.courseId).title}</b> · {student(found.studentId).name.split(" ")[0]} {student(found.studentId).name.split(" ")[1][0]}. · <span className="badge live">{found.status}</span></p> : <p className="muted">Código no encontrado.</p>)}
        <p className="muted small">La verificación muestra solo datos mínimos.</p></section>
      <section className="card"><div className="card-head"><h2>Certificados emitidos</h2></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Folio</th><th>Estudiante</th><th>Curso</th><th>Código</th><th>Estado</th><th /></tr></thead>
          <tbody>{db.certs.map((x) => <tr key={x.folio}><td>{x.folio}</td><td>{student(x.studentId).name}</td><td>{course(x.courseId).title}</td><td>{x.code}</td><td><span className={`badge ${x.status === "emitido" ? "live" : "warn"}`}>{x.status}</span></td>
            <td>{x.status === "emitido" && <button className="ghost" onClick={() => act({ t: "revoke", folio: x.folio })}>Anular</button>}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
