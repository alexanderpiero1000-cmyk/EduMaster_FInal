import { useState } from "react";
import { courses } from "../data/db";
import { course, enrollment, student } from "../data/selectors";
import { useStore } from "../store/Store";

export default function Community() {
  const { db, act, sid } = useStore();
  const [cid, setCid] = useState("c1"), [text, setText] = useState("");
  const can = !!enrollment(db, sid, cid);
  return (
    <section className="card"><div className="card-head"><h2>Comunidad · {course(cid).title}</h2>
      <select value={cid} onChange={(e) => setCid(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
      <div className="row-actions"><input style={{ flex: 1 }} disabled={!can} placeholder={can ? `Publicar como ${student(sid).name}…` : "Inscríbete en el curso para participar"} value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={!can || !text.trim()} onClick={() => { act({ t: "post", s: sid, c: cid, text: text.trim() }); setText(""); }}>Publicar</button></div>
      <ul className="list" style={{ marginTop: 12 }}>{db.posts.filter((p) => p.courseId === cid).map((p) => <li key={p.id}><div><b>{student(p.studentId).name}</b><div>{p.text}</div></div><span className="muted small">{new Date(p.at).toLocaleTimeString("es-PE")}</span></li>)}
        {db.posts.filter((p) => p.courseId === cid).length === 0 && <li className="muted">Aún no hay debates en este curso.</li>}</ul></section>
  );
}
