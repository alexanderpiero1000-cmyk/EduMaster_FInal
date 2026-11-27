// Tutor del estudiante: responde «¿qué hago ahora?». Las sugerencias son reglas, no la red del laboratorio.
import Card from "./Card";
import Badge from "./Badge";
import Btn from "./Btn";
import { useActionNotice } from "./useActionNotice";
import { TUTOR_ENGINE } from "./tutorEngine";
import { lessons, skills } from "../../data/db";
import { course, enrollment, mastery, recommend } from "../../data/selectors";
import type { Rec } from "../../data/selectors";
import { lastReview, openHelp } from "../../data/help";
import { useStore } from "../../store/Store";
import { useState } from "react";
import { askAI, type AiMessage } from "./aiClient";

const skillName = (id: string) => skills.find((k) => k.id === id)!.name;
const why = (r: Rec) => (r.goalId === r.courseId ? `Para mejorar en ${skillName(r.skillId)}` : `Te abre la puerta a ${course(r.goalId).title}`);
const RESPONSE = { aceptada: "En tu plan", util: "Marcada como útil", descartada: "Descartada" } as const;
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
type TutorLine = AiMessage & { source?: "ai" | "fallback" };

export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded-full bg-white/10">
      <div className="h-1.5 rounded-full bg-gradient-to-r from-em-blue to-em-cyan transition-[width] duration-300" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function StudentTutor({ onOpenLab }: { onOpenLab: () => void }) {
  const { db, sid, act } = useStore();
  const { run, notice } = useActionNotice();
  const recs = recommend(db, sid).filter((r) => db.recState[r.key] !== "descartada");
  const [main, ...others] = recs;
  const asked = openHelp(db, sid);
  const reply = lastReview(db, sid);
  const [tutorMessages, setTutorMessages] = useState<TutorLine[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const [helpError, setHelpError] = useState("");

  const sendTutor = async () => {
    const text = tutorInput.trim();
    if (!text || tutorBusy) return;
    setTutorInput("");
    setTutorError("");
    const next: TutorLine[] = [...tutorMessages, { role: "student", text }];
    setTutorMessages(next);
    setTutorBusy(true);
    const enrolled = db.enrollments.filter((e) => e.studentId === sid);
    const context = enrolled.map((e) => {
      const c = course(e.courseId);
      return `${c.title}: nivel ${c.level}, avance ${e.done}/${c.lessons}`;
    }).join("; ");
    const result = await askAI("tutor", next.map(({ role, text: message }) => ({ role, text: message })), context);
    setTutorMessages([...next, { role: "assistant", text: result.text, source: result.source }]);
    if (result.unavailable) setTutorError(result.error || "La IA real no está disponible; se utilizó el respaldo local.");
    setTutorBusy(false);
  };

  const accept = (r: Rec) => { if (run({ t: "rec", key: r.key, v: "aceptada" }) && !enrollment(db, sid, r.courseId)) run({ t: "enroll", s: sid, c: r.courseId }); };
  const advance = (c: string) => {
    const done = enrollment(db, sid, c)?.done ?? 0, lesson = lessons.filter((l) => l.courseId === c)[done];
    if (!run({ t: "learning", type: "lesson.started", s: sid, c, entityId: lesson?.id })) return;
    act({ t: "lesson", s: sid, c });
    act({ t: "learning", type: "lesson.completed", s: sid, c, entityId: lesson?.id });
  };

  const hero = () => {
    if (!main) return <Card title="Tu siguiente paso" featured className="lg:col-span-8"><p className="m-0 text-[14px] text-em-muted">No tienes pasos pendientes. ¡Buen trabajo!</p></Card>;
    const c = course(main.courseId), e = enrollment(db, sid, c.id), pct = e ? Math.round((100 * e.done) / c.lessons) : 0, state = db.recState[main.key];
    return (
      <Card title="Tu siguiente paso" featured className="lg:col-span-8" right={state && <Badge tone="ok">{RESPONSE[state]}</Badge>}>
        <div className="text-[26px] font-semibold leading-8 text-white">{c.title}</div>
        <p className="m-0 mt-1 text-[14px] text-em-muted">{why(main)}</p>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-[12px] text-em-muted"><span>{e ? `${e.done} de ${c.lessons} lecciones` : `${c.lessons} lecciones · aún no inscrito`}</span><span className="tabular-nums">{pct}%</span></div>
          <Meter value={pct} label={`Avance en ${c.title}`} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {!e ? <Btn onClick={() => accept(main)}>Inscribirme</Btn> : e.done < c.lessons && <Btn onClick={() => advance(c.id)}>Avanzar una lección</Btn>}
          {e && !state && <Btn variant="ghost" onClick={() => accept(main)}>Añadir a mi plan</Btn>}
          {state !== "util" && <Btn variant="ghost" onClick={() => run({ t: "rec", key: main.key, v: "util" })}>Me sirve</Btn>}
          {!state && <Btn variant="ghost" onClick={() => run({ t: "rec", key: main.key, v: "descartada" })}>No me interesa</Btn>}
        </div>
        <details className="mt-4 text-[12px] text-em-muted">
          <summary className="cursor-pointer">¿Cómo se generó?</summary>
          <p className="m-0 mt-2">{main.reason}. Motor {TUTOR_ENGINE}: son reglas sobre tus notas y tu avance, no una red neuronal.</p>
          <Btn variant="ghost" className="mt-2" onClick={onOpenLab}>Ver cómo aprende una red</Btn>
        </details>
      </Card>
    );
  };

  return (
    <div className="[display:grid] grid-cols-1 items-start gap-6 lg:grid-cols-12">
      {hero()}

      <Card title="¿Necesitas ayuda?" className="lg:col-span-4">
        <div role="status">
          {asked ? <p className="m-0 text-[14px] text-em-text">Enviada: {time(asked.at)} <span className="text-em-muted">Esperando respuesta…</span></p>
            : reply ? (
              <div className="rounded-2xl rounded-tl-sm bg-white/5 p-3 text-[14px] text-em-text">
                {reply.comment || "Revisé tu sugerencia: vas por buen camino."}
                <div className="mt-1 text-[11px] text-em-muted">{reply.by} · {time(reply.at)}</div>
              </div>
            ) : <p className="m-0 text-[14px] text-em-muted">Tu docente te responde aquí.</p>}
        </div>
        <Btn className="mt-4 w-full" disabled={!!asked || !db.enrollments.some((e) => e.studentId === sid)}
          onClick={async () => {
            setHelpError("");
            const c = db.enrollments.find((e) => e.studentId === sid)?.courseId;
            if (!c) return;
            if (!run({ t: "help", s: sid, c })) return;
            const target = course(c);
            const question = `Necesito ayuda con ${target.title}. ¿Puedes identificar el tema y darme una explicación con pistas antes de la respuesta?`;
            const result = await askAI("tutor", [{ role: "student", text: question }], `${target.title}: nivel ${target.level}`);
            if (result.unavailable) setHelpError(result.error || "No se pudo obtener respuesta de la IA real.");
            run({ t: "help.ai", s: sid, c, question, topic: target.tags[0] || target.title, messages: [
              { role: "student", text: question, at: new Date().toISOString(), source: "ai" },
              { role: "assistant", text: result.text, at: new Date().toISOString(), source: result.source === "ai" ? "ai" : "simulation" },
            ] });
          }}>{asked ? "Solicitud enviada" : "Pedir ayuda"}</Btn>
        {asked && <Btn variant="ghost" className="mt-2 w-full" onClick={() => {
          const c = db.enrollments.find((e) => e.studentId === sid)?.courseId;
          if (c) run({ t: "help.human", s: sid, c, question: "Solicito atención adicional de un docente." });
        }}>Solicitar atención de un docente</Btn>}
        {helpError && <p role="alert" className="mt-2 text-[12px] text-amber-300">Problema de conexión: {helpError}</p>}
      </Card>

      <Card title="Conversación con el IA Tutor" className="lg:col-span-12">
        <div role="log" aria-live="polite" className="max-h-[300px] space-y-2 overflow-auto rounded-xl bg-white/[0.03] p-3">
          {tutorMessages.length === 0 && <p className="m-0 text-[13px] text-em-muted">Pregunta sobre un curso, pide pistas, ejemplos o una explicación alternativa.</p>}
          {tutorMessages.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${m.role === "student" ? "ml-auto bg-em-blue/30 text-white" : "bg-white/5 text-em-text"}`}>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-em-muted">{m.role === "student" ? "Alumno" : m.source === "fallback" ? "Respaldo · no es IA" : "IA Tutor"}</div>{m.text}
            </div>
          ))}
          {tutorBusy && <div className="text-[12px] text-em-muted">El IA Tutor está escribiendo…</div>}
        </div>
        {tutorError && <p role="alert" className="mt-2 text-[12px] text-amber-300">{tutorError}</p>}
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void sendTutor(); }}>
          <input className="min-w-0 flex-1" maxLength={2000} value={tutorInput} onChange={(e) => setTutorInput(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendTutor(); }
          }} placeholder="¿Qué tema quieres comprender?" />
          <Btn type="submit" disabled={tutorBusy || !tutorInput.trim()}>Enviar</Btn>
        </form>
      </Card>

      <Card title="Mis habilidades" className="lg:col-span-6">
        <ul className="m-0 list-none space-y-3 p-0">
          {skills.map((k) => { const v = mastery(db, sid, k.id); return (
            <li key={k.id}><div className="mb-1 flex justify-between text-[13px]"><span className="text-em-text">{k.name}</span><span className="tabular-nums text-em-muted">{v}%</span></div><Meter value={v} label={`Dominio en ${k.name}`} /></li>); })}
        </ul>
        <p className="m-0 mt-4 text-[11px] text-em-muted">Estimación, no es una nota.</p>
      </Card>

      <Card title="También puedes" className="lg:col-span-6">
        {others.length === 0 ? <p className="m-0 text-[14px] text-em-muted">No hay otras sugerencias.</p> : (
          <ul className="m-0 list-none divide-y divide-white/10 p-0">
            {others.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0"><div className="text-[14px] text-em-text">{course(r.courseId).title}</div><div className="text-[12px] text-em-muted">{why(r)}</div></div>
                {db.recState[r.key] ? <Badge tone="ok">{RESPONSE[db.recState[r.key]]}</Badge> : (
                  <div className="flex gap-2"><Btn variant="ghost" onClick={() => accept(r)}>Añadir</Btn><Btn variant="ghost" aria-label={`Descartar ${course(r.courseId).title}`} onClick={() => run({ t: "rec", key: r.key, v: "descartada" })}>No</Btn></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {notice}
    </div>
  );
}
