// Bandeja de revisión (reco.review): «¿quién me necesita?». Lista a la izquierda, una sola respuesta a la derecha.
// Revisar no acepta ni descarta por el estudiante.
import { useState } from "react";
import Card from "./Card";
import Badge from "./Badge";
import Btn from "./Btn";
import { Meter } from "./StudentTutor";
import { useActionNotice } from "./useActionNotice";
import { course, progress, recommend, student } from "../../data/selectors";
import { ownsCourse, scopeStudents, shownName } from "../../data/scope";
import { openHelp } from "../../data/help";
import type { DB } from "../../data/db";
import type { DemoUser } from "../../data/users";
import { useStore, useUser } from "../../store/Store";

const RESPONSE = { aceptada: "La aceptó", descartada: "La descartó", util: "Le sirvió" } as const;
const QUICK = ["Vas bien, sigue así.", "Empieza por la siguiente lección.", "Conversemos en clase."];
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

export interface PendingRow { key: string; studentId: string; title: string; reason: string; help: string | null }

/** Una fila por estudiante del alcance: sugerencia sin revisar o con ayuda pedida después. */
export function pendingRows(db: DB, user: DemoUser): PendingRow[] {
  return scopeStudents(db, user).flatMap((s): PendingRow[] => {
    const help = openHelp(db, s.id);
    const rec = recommend(db, s.id).find((r) => ownsCourse(user, course(r.courseId)));
    if (rec && (help || !db.reviews[rec.key])) {
      return [{ key: rec.key, studentId: s.id, title: `${rec.verb === "Continúa" ? "Que continúe" : "Que se inscriba en"} ${course(rec.courseId).title}`, reason: rec.reason, help: help?.at ?? null }];
    }
    // pidió ayuda y no hay sugerencia en los cursos del revisor: se atiende sobre un curso propio
    const own = help ? db.enrollments.find((e) => e.studentId === s.id && ownsCourse(user, course(e.courseId))) : undefined;
    return own && !rec ? [{ key: `${s.id}:${own.courseId}`, studentId: s.id, title: `Apoyo en ${course(own.courseId).title}`, reason: "Sin sugerencia automática en tus cursos", help: help!.at }] : [];
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
  const pending = pendingRows(db, user);
  const done = reviewedRows(db, user);
  const current = pending.find((r) => r.studentId === picked) ?? pending[0];
  const name = (id: string) => shownName(user, student(id));

  const send = () => {
    if (!current || !run({ t: "review", key: current.key, comment })) return;
    setSent(`Enviado a ${name(current.studentId)}.`);
    setComment(""); setPicked(null);
  };
  const stats: [string, number, string][] = [
    ["Piden ayuda", pending.filter((r) => r.help).length, "text-amber-300"],
    ["Por revisar", pending.length, "text-white"],
    ["Revisadas", done.length, "text-em-teal"],
  ];

  return (
    <div className="space-y-6">
      <div className="[display:grid] grid-cols-3 gap-4" aria-live="polite">
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
                <li key={r.studentId}>
                  <button type="button" aria-current={r.studentId === current.studentId} onClick={() => { setPicked(r.studentId); setComment(""); setSent(""); }}
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
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <div className="mb-2 flex flex-wrap gap-2">
                  {QUICK.map((q) => <Btn key={q} variant="ghost" onClick={() => setComment(q)}>{q}</Btn>)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input className="min-w-0 flex-1" maxLength={140} aria-label={`Mensaje para ${name(current.studentId)}`} placeholder="Escribe un mensaje (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Btn type="submit">Enviar</Btn>
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
