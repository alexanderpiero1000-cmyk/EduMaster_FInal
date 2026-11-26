// Simulador de eventos DEMO: función pura que propone UN evento. Nunca se agota (cae a "learning").
import type { Action } from "../store/Store";
import { assessments, courses, lessons, students } from "./db";
import type { DB, Enrollment, LearningEventType } from "./db";
import { course, eligible, enrollment, passed, prereqMet, progress, recommend } from "./selectors";
import { myCourseIds } from "./scope";
import { openHelp } from "./help";
import type { DemoUser } from "./users";

const MAX_PENDING_COURSE = 3, MAX_PENDING_TOTAL = 10;
type Rnd = () => number;
const pick = <T,>(a: T[], rnd: Rnd): T => a[Math.floor(rnd() * a.length)];
const by = "sistema";

function learning(db: DB, rnd: Rnd): Action {
  if (!db.enrollments.length) return { t: "log", by, type: "system.heartbeat", text: "Simulación activa sin matrículas" };
  const e = pick(db.enrollments, rnd);
  const type = pick<LearningEventType>(["resource.consumed", "lesson.started", "activity.completed"], rnd);
  const ls = lessons.filter((l) => l.courseId === e.courseId);
  const lesson = ls[Math.min(e.done, ls.length - 1)];
  return { t: "learning", by, type, s: e.studentId, c: e.courseId, entityId: lesson?.id };
}

function lessonEvent(db: DB, user: DemoUser, rnd: Rnd): Action | null {
  const open = db.enrollments.filter((e) => e.done < course(e.courseId).lessons);
  if (!open.length) return null;
  const own = open.filter((e) => e.studentId === user.studentId);
  const e = user.role === "estudiante" && own.length && rnd() < 0.6 ? pick(own, rnd) : pick(open, rnd);
  return { t: "lesson", by, s: e.studentId, c: e.courseId };
}

function submitEvent(db: DB, user: DemoUser, rnd: Rnd): Action | null {
  const pending = db.submissions.filter((x) => x.status === "pendiente");
  if (pending.length >= MAX_PENDING_TOTAL) return null;
  const options = db.enrollments.flatMap((e: Enrollment) => {
    const a = assessments.find((x) => x.courseId === e.courseId);
    const ok = a && progress(db, e.studentId, e.courseId) >= 0.5 && !passed(db, e.studentId, e.courseId)
      && !pending.some((p) => p.studentId === e.studentId && p.assessmentId === a.id)
      && pending.filter((p) => p.courseId === e.courseId).length < MAX_PENDING_COURSE;
    return ok ? [{ s: e.studentId, a: a.id, c: e.courseId }] : [];
  });
  // El estudiante de la sesión entrega él mismo: el simulador nunca entrega por él.
  const pool = user.role === "estudiante" ? options.filter((o) => o.s !== user.studentId) : options;
  if (!pool.length) return null;
  const mine = myCourseIds(user);
  const preferred = user.role === "docente" ? pool.filter((o) => mine.includes(o.c)) : [];
  const o = preferred.length && rnd() < 0.8 ? pick(preferred, rnd) : pick(pool, rnd);
  return { t: "submit", by, ...o };
}

function recEvent(db: DB, user: DemoUser, rnd: Rnd): Action | null {
  const s = user.studentId && rnd() < 0.6 ? user.studentId : pick(students, rnd).id;
  const r = recommend(db, s)[0];
  if (!r) return null;
  const text = `Nueva recomendación: ${r.verb} ${course(r.courseId).title}`;
  return { t: "log", by, type: "recommendation.created", text: `${students.find((x) => x.id === s)!.name} · ${text}`, s, c: r.courseId, notify: [{ to: `s:${s}`, text }] };
}

function reminderEvent(db: DB, rnd: Rnd): Action | null {
  const open = db.enrollments.filter((e) => e.done < course(e.courseId).lessons);
  if (!open.length) return null;
  const e = pick(open, rnd), text = `Recordatorio: tienes lecciones pendientes en ${course(e.courseId).title}`;
  // A veces, señal de apoyo para el docente del curso (sin s: no aparece en la actividad del estudiante).
  if (progress(db, e.studentId, e.courseId) < 0.35 && rnd() < 0.5) {
    const note = `Señal de apoyo (estimación): ${students.find((x) => x.id === e.studentId)!.name} avanza poco en ${course(e.courseId).title}; podrías ofrecer ayuda.`;
    return { t: "log", by, type: "support.signal", text: note, c: e.courseId, notify: [{ to: `c:${e.courseId}`, text: note }] };
  }
  return { t: "log", by, type: "notification.created", text: `${students.find((x) => x.id === e.studentId)!.name} · ${text}`, s: e.studentId, c: e.courseId, notify: [{ to: `s:${e.studentId}`, text }] };
}

const MAX_OPEN_HELP = 3;
export const AUTO_ANSWER_MS = 45_000;
const others = (user: DemoUser) => students.filter((s) => s.id !== user.studentId);    // nunca actúa por el usuario de la sesión

/** Otros estudiantes responden a sus recomendaciones. */
function responseEvent(db: DB, user: DemoUser, rnd: Rnd): Action | null {
  const waiting = others(user).flatMap((s) => recommend(db, s.id).slice(0, 1).filter((r) => !db.recState[r.key]));
  if (!waiting.length) return null;
  const x = rnd();
  return { t: "rec", by, key: pick(waiting, rnd).key, v: x < 0.5 ? "aceptada" : x < 0.8 ? "util" : "descartada" };
}
/** Otros estudiantes piden ayuda (con un máximo de solicitudes abiertas). */
function helpEvent(db: DB, user: DemoUser, rnd: Rnd): Action | null {
  if (students.filter((s) => openHelp(db, s.id)).length >= MAX_OPEN_HELP) return null;
  const options = others(user).filter((s) => !openHelp(db, s.id)).flatMap((s) => db.enrollments.filter((e) => e.studentId === s.id));
  if (!options.length) return null;
  const mine = myCourseIds(user);
  const preferred = user.role === "docente" ? options.filter((e) => mine.includes(e.courseId)) : [];
  const e = pick(preferred.length ? preferred : options, rnd);
  return { t: "help", by, s: e.studentId, c: e.courseId };
}
/** Si el estudiante de la sesión pidió ayuda y nadie respondió, un docente simulado contesta. */
function autoAnswer(db: DB, user: DemoUser): Action | null {
  if (user.role !== "estudiante" || !user.studentId) return null;
  const asked = openHelp(db, user.studentId);
  if (!asked || Date.now() - Date.parse(asked.at) < AUTO_ANSWER_MS) return null;
  const key = recommend(db, user.studentId)[0]?.key ?? `${user.studentId}:${asked.c}`;
  return { t: "review", by: "Docente simulado", key, comment: "Revisé tu avance: empieza por el curso sugerido y escríbeme si te atascas." };
}

function enrollEvent(db: DB, rnd: Rnd): Action | null {
  const options = students.flatMap((s) => courses.filter((c) => c.status === "publicado" && !enrollment(db, s.id, c.id) && prereqMet(db, s.id, c.id)).map((c) => ({ s: s.id, c: c.id })));
  return options.length ? { t: "enroll", by, ...pick(options, rnd) } : null;
}

export function nextEvent(db: DB, user: DemoUser, rnd: Rnd = Math.random): Action {
  // Primero, el sistema emite los certificados que ya correspondan.
  // (un certificado anulado no se vuelve a emitir solo: la reemisión es una decisión humana)
  const ready = db.enrollments.find((e) => eligible(db, e.studentId, e.courseId) && !db.certs.some((c) => c.studentId === e.studentId && c.courseId === e.courseId && c.status === "anulado"));
  if (ready) return { t: "issue", by, s: ready.studentId, c: ready.courseId };
  const answer = autoAnswer(db, user);
  if (answer) return answer;
  const x = rnd() * 100;
  const event = x < 30 ? lessonEvent(db, user, rnd)
    : x < 42 ? null                       // 12 % learning
    : x < 56 ? submitEvent(db, user, rnd)
    : x < 65 ? recEvent(db, user, rnd)
    : x < 75 ? reminderEvent(db, rnd)
    : x < 84 ? enrollEvent(db, rnd)
    : x < 94 ? responseEvent(db, user, rnd)
    : helpEvent(db, user, rnd);
  return event ?? learning(db, rnd);
}
