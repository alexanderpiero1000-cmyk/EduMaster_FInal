// Bandeja de revisión (reco.review): «¿quién me necesita?». Lista a la izquierda, una sola respuesta a la derecha.
// Revisar no acepta ni descarta por el estudiante.
import { useState } from "react";
import Card from "./Card";
import Badge from "./Badge";
import Btn from "./Btn";
import { Meter } from "./StudentTutor";
import { useActionNotice } from "./useActionNotice";
import { course, progress, recommend, student } from "../../data/selectors";
import { myCourseIds, ownsCourse, scopeStudents, shownName } from "../../data/scope";
import { openHelp } from "../../data/help";
import type { DB } from "../../data/db";
import type { DemoUser } from "../../data/users";
import { useStore, useUser } from "../../store/Store";

const RESPONSE = { aceptada: "La aceptó", descartada: "La descartó", util: "Le sirvió" } as const;
const QUICK = ["Vas bien, sigue así.", "Empieza por la siguiente lección.", "Conversemos en clase."];
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

export interface PendingRow { key: string; studentId: string; courseId: string; title: string; reason: string; help: string | null }

/** Una fila por estudiante del alcance: sugerencia sin revisar o con ayuda pedida después. */
export function pendingRows(db: DB, user: DemoUser): PendingRow[] {
  return scopeStudents(db, user).flatMap((s): PendingRow[] => {
    const helpRows = myCourseIds(user).flatMap((courseId) => {
      const help = openHelp(db, s.id, courseId);
      if (!help) return [];
      const rec = recommend(db, s.id).find((r) => r.courseId === courseId);
      return [{ key: `${s.id}:${courseId}`, studentId: s.id, courseId, title: `Ayuda en ${course(courseId).title}`, reason: rec?.reason ?? "El estudiante solicitó apoyo docente", help: help.at }];
    });
    const rec = recommend(db, s.id).find((r) => ownsCourse(user, course(r.courseId)) && !helpRows.some((x) => x.courseId === r.courseId));
    const recommendationRows = rec && !db.reviews[rec.key]
      ? [{ key: rec.key, studentId: s.id, courseId: rec.courseId, title: `${rec.verb === "Continúa" ? "Que continúe" : "Que se inscriba en"} ${course(rec.courseId).title}`, reason: rec.reason, help: null }]
      : [];
    if (helpRows.length || recommendationRows.length) {
      return [...helpRows, ...recommendationRows];
    }
    return [];
  }).sort((a, b) => (b.help ?? "").localeCompare(a.help ?? ""));
}

export function reviewedRows(db: DB, user: DemoUser) {
  const ids = new Set(scopeStudents(db, user).map((s) => s.id));
  return Object.entries(db.reviews).map(([key, r]) => { const [s, c] = key.split(":"); return { key, s, c, ...r }; })
    .filter((r) => ids.has(r.s) && ownsCourse(user, course(r.c)))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Avance medio del estudiante en los cursos que ve quien revisa. */
function average(db: DB, user: DemoUser, s: string): number {
  const es = db.enrollments.filter((e) => e.studentId === s && ownsCourse(user, course(e.courseId)));
  return es.length ? Math.round((100 * es.reduce((a, e) => a + progress(db, s, e.courseId), 0)) / es.length) : 0;
}

export default function ReviewPanel() {
  const { db } = useStore();
  const user = useUser();
  const { run, notice } = useActionNotice();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [picked, setPicked] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState("");
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const pendingAll = pendingRows(db, user);
  const doneAll = reviewedRows(db, user);
  const matches = (id: string, c: string) => (!courseFilter || c === courseFilter)
    && (!query || `${shownName(user, student(id))} ${course(c).title}`.toLowerCase().includes(query.toLowerCase()));
  const pending = pendingAll.filter((r) => matches(r.studentId, r.courseId));
  const done = doneAll.filter((r) => matches(r.s, r.c));
  const current = pending.find((r) => r.key === picked) ?? pending[0];
  const name = (id: string) => shownName(user, student(id));

  const send = () => {
    if (!current || !comment.trim()) return;
    const sentOk = current.help
      ? run({ t: "help.reply", s: current.studentId, c: current.courseId, text: comment })
      : run({ t: "review", key: current.key, comment });
    if (!sentOk) return;
    setSent(`Enviado a ${name(current.studentId)}.`);
    setComment(""); setPicked(null);
  };
  const stats: [string, number, string][] = [
    ["Piden ayuda", pending.filter((r) => r.help).length, "text-amber-300"],
    ["Atención humana", db.consultations.filter((x) => x.status === "human_requested").filter((x) => scopeStudents(db, user).some((s) => s.id === x.studentId)).length, "text-amber-300"],
    ["Por revisar", pending.length, "text-white"],
    ["Revisadas", done.length, "text-em-teal"],
  ];

  return (
    <div className="space-y-6">
      <div className="[display:grid] grid-cols-2 gap-4 md:grid-cols-4" aria-live="polite">
        {stats.map(([label, value, color]) => (
          <Card key={label} pad="p-4 sm:p-5" ariaLabel={label}>
            <div className="truncate text-[13px] text-em-muted">{label}</div>
            <div className={`mt-1 text-[30px] font-semibold leading-9 tabular-nums ${color}`}>{value}</div>
          </Card>
        ))}
      </div>

      <Card pad="p-0" ariaLabel="Bandeja de revisión">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div role="tablist" aria-label="Estado" className="flex gap-2">
            <Btn variant={tab === "pending" ? "primary" : "ghost"} role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>Pendientes</Btn>
            <Btn variant={tab === "done" ? "primary" : "ghost"} role="tab" aria-selected={tab === "done"} onClick={() => setTab("done")}>Revisadas</Btn>
          </div>
          <span role="status" className="text-[13px] text-em-teal">{sent}</span>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Buscar consulta o estudiante" placeholder="Buscar estudiante o curso" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select aria-label="Filtrar por curso" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">Todos tus cursos</option>
              {myCourseIds(user).map((id) => <option key={id} value={id}>{course(id).title}</option>)}
            </select>
          </div>
        </div>

        {tab === "done" ? (
          <ul className="m-0 max-h-[420px] list-none divide-y divide-white/10 overflow-auto px-5 py-1">
            {done.length === 0 && <li className="py-6 text-center text-[14px] text-em-muted">Aún no hay revisiones.</li>}
            {done.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0"><div className="text-[14px] text-em-text">{name(r.s)} · {course(r.c).title}</div><div className="text-[12px] text-em-muted">{r.comment ? `«${r.comment}»` : "Sin comentario"} · {r.by} · {time(r.at)}</div></div>
                <Badge tone={db.recState[r.key] ? "ok" : "neutral"}>{db.recState[r.key] ? RESPONSE[db.recState[r.key]] : "Sin respuesta"}</Badge>
              </li>
            ))}
          </ul>
        ) : !current ? <p className="m-0 p-8 text-center text-[14px] text-em-muted">Todo al día. Las nuevas solicitudes aparecerán aquí.</p> : (
          <div className="[display:grid] grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ul aria-label="Estudiantes pendientes" className="m-0 max-h-[420px] list-none overflow-auto border-white/10 p-2 max-md:max-h-56 max-md:border-b md:border-r">
              {pending.map((r) => (
                <li key={r.key}>
                  <button type="button" aria-current={r.key === current.key} onClick={() => { setPicked(r.key); setComment(""); setSent(""); }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl! border-0! px-3! py-2.5! text-left! transition-colors duration-150 focus-visible:outline-2! focus-visible:outline-em-cyan! ${r.studentId === current.studentId ? "bg-em-blue/20! text-white!" : "bg-transparent! text-em-text! hover:bg-white/5!"}`}>
                    <span className="min-w-0 truncate text-[14px]">{name(r.studentId)}</span>
                    {r.help && <Badge tone="warn">pide ayuda</Badge>}
                  </button>
                </li>
              ))}
            </ul>

            <div className="min-w-0 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[18px] font-semibold text-white">{name(current.studentId)}</div>
                {current.help && <span className="text-[12px] text-em-muted">pidió ayuda a las {time(current.help)}</span>}
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[12px] text-em-muted"><span>Avance en tus cursos</span><span className="tabular-nums">{average(db, user, current.studentId)}%</span></div>
                <Meter value={average(db, user, current.studentId)} label="Avance medio" />
              </div>
              <div className="mt-4 rounded-xl bg-white/5 p-3">
                <div className="text-[12px] text-em-muted">Sugerencia automática</div>
                <div className="text-[14px] text-em-text">{current.title}</div>
                <div className="text-[12px] text-em-muted">{current.reason}{db.recState[current.key] ? ` · ${RESPONSE[db.recState[current.key]]}` : ""}</div>
              </div>
              {db.consultations.filter((x) => x.studentId === current.studentId && x.courseId === current.courseId).map((consultation) => (
                <div key={consultation.id} className="mt-4 space-y-2" aria-label="Historial de consulta">
                  <div className="text-[12px] text-em-muted">{consultation.status === "human_requested" ? "Solicita atención humana" : consultation.status === "fallback" ? "IA no disponible · pendiente de revisión docente" : consultation.status === "ai_attended" ? "Atendida inicialmente por IA" : "Consulta revisada"} · tema: {consultation.topic}</div>
                  {consultation.messages.map((message, index) => <div key={`${consultation.id}-${index}`} className="rounded-xl bg-white/5 p-3 text-[13px]">
                    <div className="mb-1 text-[10px] uppercase text-em-muted">{message.role === "student" ? name(current.studentId) : message.source === "teacher" ? "Docente" : message.source === "ai" ? "IA" : "Respaldo local"}</div>
                    <div>{message.text}</div>
                  </div>)}
                </div>
              ))}
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <div className="mb-2 flex flex-wrap gap-2">
                  {QUICK.map((q) => <Btn key={q} variant="ghost" onClick={() => setComment(q)}>{q}</Btn>)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input className="min-w-0 flex-1" maxLength={1000} aria-label={`Mensaje para ${name(current.studentId)}`} placeholder={current.help ? "Escribe la respuesta al estudiante" : "Nota de seguimiento"} value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Btn type="submit" disabled={!comment.trim()}>{current.help ? "Responder y cerrar" : "Registrar seguimiento"}</Btn>
                </div>
              </form>
            </div>
          </div>
        )}
      </Card>
      {notice}
    </div>
  );
}
