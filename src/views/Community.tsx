import { useState } from "react";
import { courses } from "../data/db";
import type { Post } from "../data/db";
import { course, enrollment, student } from "../data/selectors";
import { ownsCourse } from "../data/scope";
import { useActionNotice } from "../components/ui/useActionNotice";
import { useStore, useUser } from "../store/Store";

export default function Community() {
  const { db, sid, can } = useStore();
  const user = useUser();
  const { run, notice } = useActionNotice();
  const [cid, setCid] = useState("c1");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [hiding, setHiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const teacher = user.role === "docente";
  const canPost = can("post") && (teacher ? ownsCourse(user, course(cid)) : !!enrollment(db, sid, cid));
  const canModerate = can("moderate") && ownsCourse(user, course(cid));
  const hint = canPost ? (teacher ? "Escribe un anuncio para el curso…" : `Publicar como ${user.name}…`) : teacher ? "Solo puedes publicar en tus cursos" : "Inscríbete en el curso para participar";
  const send = (body: string, parentId?: string) => run({ t: "post", s: teacher ? "" : sid, c: cid, text: body.trim(), parentId });

  const all = db.posts.filter((p) => p.courseId === cid && (canModerate || !p.hidden));
  const top = all.filter((p) => !p.parentId);

  const item = (p: Post, isReply = false) => (
    <li key={p.id} style={{ display: "block", marginLeft: isReply ? 20 : 0, opacity: p.hidden ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b>{p.author ?? student(p.studentId).name}{p.author?.endsWith("· Docente") && !isReply && <span className="badge" style={{ marginLeft: 6 }}>Anuncio</span>}</b>
        <span className="muted small">{new Date(p.at).toLocaleTimeString("es-PE")}</span>
      </div>
      <div style={{ overflowWrap: "anywhere" }}>{p.text}</div>
      {p.hidden && <div className="muted small">Oculta por {p.hidden.by}. Motivo: {p.hidden.reason}</div>}
      <div className="row-actions" style={{ marginTop: 6 }}>
        {!isReply && canPost && !p.hidden && <button type="button" className="ghost" onClick={() => { setReplyTo(replyTo === p.id ? null : p.id); setReply(""); }}>Responder</button>}
        {canModerate && !p.hidden && <button type="button" className="ghost" onClick={() => { setHiding(hiding === p.id ? null : p.id); setReason(""); }}>Ocultar</button>}
      </div>
      {replyTo === p.id && (
        <div className="row-actions" style={{ marginTop: 6 }}>
          <input style={{ flex: 1, minWidth: 0 }} aria-label="Respuesta" placeholder="Tu respuesta…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <button type="button" disabled={!reply.trim()} onClick={() => { if (send(reply, p.id)) { setReply(""); setReplyTo(null); } }}>Enviar</button>
        </div>
      )}
      {hiding === p.id && (
        <div className="row-actions" style={{ marginTop: 6 }}>
          <input style={{ flex: 1, minWidth: 0 }} aria-label="Motivo de la moderación" placeholder="Motivo (queda en la auditoría)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" disabled={!reason.trim()} onClick={() => { if (run({ t: "hide", id: p.id, reason })) setHiding(null); }}>Confirmar</button>
        </div>
      )}
    </li>
  );

  return (
    <section className="card">
      <div className="card-head"><h2>Comunidad · {course(cid).title}</h2>
        <select value={cid} aria-label="Curso" onChange={(e) => { setCid(e.target.value); setReplyTo(null); setHiding(null); }}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
      {can("post") ? (
        <>
          <div className="row-actions"><input style={{ flex: 1, minWidth: 0 }} disabled={!canPost} aria-label={teacher ? "Anuncio" : "Mensaje"} placeholder={hint} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="button" disabled={!canPost || !text.trim()} onClick={() => { if (send(text)) setText(""); }}>{teacher ? "Publicar anuncio" : "Publicar"}</button></div>
          {!canPost && <p className="muted small">{hint}</p>}
        </>
      ) : <p className="muted small">Vista de moderación: tu rol no publica.</p>}
      <ul className="list" style={{ marginTop: 12 }}>
        {top.flatMap((p) => [item(p), ...all.filter((r) => r.parentId === p.id).slice().reverse().map((r) => item(r, true))])}
        {top.length === 0 && <li className="muted">Aún no hay debates en este curso.</li>}
      </ul>
      {notice}
    </section>
  );
}
