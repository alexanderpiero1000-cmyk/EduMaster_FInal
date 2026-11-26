import { useState } from "react";
import { useActionNotice } from "../components/ui/useActionNotice";
import { courses } from "../data/db";
import type { Cert } from "../data/db";
import { best, course, eligible, student } from "../data/selectors";
import { scopeStudents, shownName } from "../data/scope";
import { downloadCertificate, previewCertificate } from "../components/ui/certificatePdf";
import Icon from "../components/ui/Icon";
import { useStore, useUser } from "../store/Store";

export default function Certificates() {
  const { db, can } = useStore();
  const { run, notice } = useActionNotice();
  const user = useUser();
  const [code, setCode] = useState("");
  const mine = scopeStudents(db, user);
  const ids = new Set(mine.map((s) => s.id));
  const pending = mine.flatMap((s) => courses.filter((c) => eligible(db, s.id, c.id)).map((c) => ({ s, c })));
  const certs = db.certs.filter((x) => ids.has(x.studentId));
  const found = db.certs.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
  const data = (x: Cert) => {
    const c = course(x.courseId);
    return { student: shownName(user, student(x.studentId)), course: c.title, instructor: c.instructor, lessons: c.lessons, score: best(db, x.studentId, x.courseId), issuedAt: x.issuedAt, folio: x.folio, code: x.code };
  };
  return (
    <div className="cols">
      <section className="card"><div className="card-head"><h2>{can("cert.issue") ? "Elegibles para emitir (uso excepcional)" : "Por emitirse"}</h2></div>
        {can("cert.revoke") && <p className="muted small">Emitir y anular a mano queda registrado en la auditoría.</p>}
        {pending.length === 0 ? <p className="muted">Nadie cumple aún: requiere curso al 100% y evaluación aprobada.</p> :
          <ul className="list">{pending.map(({ s, c }) => <li key={s.id + c.id}><span>{shownName(user, s)} · {c.title}</span>
            {can("cert.issue") ? <button onClick={() => run({ t: "issue", s: s.id, c: c.id })}>Emitir</button> : <span className="muted small">Se emitirá automáticamente</span>}</li>)}</ul>}
        <div className="card-head" style={{ marginTop: 16 }}><h2>Verificación pública</h2></div>
        <input placeholder="Código, ej. VS1C1" value={code} onChange={(e) => setCode(e.target.value)} />
        {code && (found ? <p>Válido: <b>{course(found.courseId).title}</b> · {student(found.studentId).name.split(" ")[0]} {student(found.studentId).name.split(" ")[1][0]}. · <span className="badge live">{found.status}</span></p> : <p className="muted">Código no encontrado.</p>)}
        <p className="muted small">La verificación muestra solo datos mínimos.</p></section>
      <section className="card"><div className="card-head"><h2>Certificados emitidos</h2></div>
        {certs.length === 0 ? <p className="muted">Aún no tienes certificados emitidos.</p> :
          <div className="scroll"><table className="tbl stack"><thead><tr><th>Folio</th><th>Estudiante</th><th>Curso</th><th>Código</th><th>Estado</th><th /></tr></thead>
            <tbody>{certs.map((x) => <tr key={x.folio}><td>{x.folio}</td><td data-label="Estudiante">{shownName(user, student(x.studentId))}</td><td data-label="Curso">{course(x.courseId).title}</td><td data-label="Código">{x.code}</td><td data-label="Estado"><span className={`badge ${x.status === "emitido" ? "live" : "warn"}`}>{x.status}</span></td>
              <td data-label=""><div className="row-actions">{x.status === "emitido" && <>
                <button className="ghost" aria-label={`Ver certificado ${x.folio}`} onClick={() => previewCertificate(data(x))}><Icon name="eye" size={14} /> Ver</button>
                <button aria-label={`Descargar en PDF el certificado ${x.folio}`} onClick={() => downloadCertificate(data(x))}><Icon name="download" size={14} /> PDF</button></>}{x.status === "emitido" && can("cert.revoke") && <button className="ghost" onClick={() => run({ t: "revoke", folio: x.folio })}>Anular</button>}</div></td></tr>)}</tbody></table></div>}</section>
      {notice}
    </div>
  );
}
