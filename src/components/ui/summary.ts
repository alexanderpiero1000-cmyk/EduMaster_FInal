// Cálculos del Resumen por rol. Todo se DERIVA de db (matrículas, intentos, certificados, entregas, eventos y
// auditoría). El avance en el tiempo se lee de los campos estructurados de db.audit (type, s, c).
import { courses, skills, students } from "../../data/db";
import type { DB } from "../../data/db";
import { assessments } from "../../data/db";
import { course, mastery, progress } from "../../data/selectors";
import { myCourseIds, scopeStudents } from "../../data/scope";
import type { DemoUser } from "../../data/users";

export type ViewKind = "estudiante" | "docente" | "general";
/** Alcance de datos del Resumen, derivado de la sesión (permisos de data/scope). */
export interface Scope { view: ViewKind; studentIds: string[]; courseIds: string[] }

export function sessionScope(db: DB, user: DemoUser): Scope {
  const view: ViewKind = user.role === "estudiante" ? "estudiante" : user.role === "docente" ? "docente" : "general";
  const studentIds = scopeStudents(db, user).map((s) => s.id);
  const courseIds = view === "estudiante" ? db.enrollments.filter((e) => e.studentId === user.studentId).map((e) => e.courseId)
    : view === "docente" ? myCourseIds(user) : courses.map((c) => c.id);
  return { view, studentIds, courseIds };
}

export const enrollmentsOf = (db: DB, sc: Scope) => db.enrollments.filter((e) => sc.studentIds.includes(e.studentId) && sc.courseIds.includes(e.courseId));

// ---- actividad derivada ----
export type Kind = "progress" | "completed" | "enrolled" | "attempt" | "cert" | "rec" | "other";
export interface Act { id: string; kind: Kind; studentId?: string; courseId?: string; at: number; text: string; type: string }
const KINDS: Record<string, Kind> = { "learning.progress.updated": "progress", "course.completed": "completed", "enrollment.created": "enrolled", "assessment.submitted": "attempt", "assessment.submission.created": "attempt", "assessment.graded": "attempt", "certificate.issued": "cert", "recommendation.created": "rec", "recommendation.feedback": "rec", "recommendation.reviewed": "rec", "help.requested": "rec" };

export function activity(entries: DB["audit"]): Act[] {
  return entries.map((a) => ({
    id: a.id, kind: KINDS[a.type] ?? "other", type: a.type, text: a.text, at: Date.parse(a.at),
    studentId: a.s, courseId: a.c,
  }));
}
export const inScope = (a: { studentId?: string; courseId?: string }, sc: Scope) =>
  !!a.studentId && sc.studentIds.includes(a.studentId) && (!a.courseId || sc.courseIds.includes(a.courseId));

// ---- KPIs ----
export type Dir = "up" | "down" | "flat";
export interface KpiData { id: string; label: string; value: string; formula: string; delta: { text: string; dir: Dir } | null }
export const WINDOW_MS = 60 * 60e3;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number, d = 1) => v.toLocaleString("es-PE", { maximumFractionDigits: d });

function diff(now: number, prev: number | null, unit: "n" | "pts"): KpiData["delta"] {
  if (prev === null) return null;
  const d = now - prev;
  const dir: Dir = Math.abs(d) < (unit === "pts" ? 0.05 : 0.5) ? "flat" : d > 0 ? "up" : "down";
  if (dir === "flat") return { text: "sin cambios", dir };
  const s = unit === "pts" ? `${d > 0 ? "+" : ""}${num(d)} pts` : `${d > 0 ? "+" : ""}${Math.round(d)}`;
  return { text: s, dir };
}
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

/** Avance medio (0-100) hace una hora = estado actual menos las lecciones registradas en la última hora. */
function avgProgressBefore(db: DB, sc: Scope, acts: Act[], since: number): number | null {
  const fresh = acts.filter((a) => a.kind === "enrolled" && a.at >= since && inScope(a, sc)).map((a) => `${a.studentId}|${a.courseId}`);
  const vals = enrollmentsOf(db, sc).filter((e) => !fresh.includes(`${e.studentId}|${e.courseId}`)).map((e) => {
    const k = acts.filter((a) => a.kind === "progress" && a.at >= since && a.studentId === e.studentId && a.courseId === e.courseId).length;
    return Math.max(0, e.done - k) / course(e.courseId).lessons;
  });
  const m = mean(vals);
  return m === null ? null : m * 100;
}

/** Entregas con status "pendiente": las propias (estudiante) o las de los cursos del alcance (docente). */
export function pendingSubmissions(db: DB, sc: Scope): number {
  return db.submissions.filter((x) => x.status === "pendiente" && sc.studentIds.includes(x.studentId) && (sc.view === "estudiante" || sc.courseIds.includes(x.courseId))).length;
}
const pendKpi = (db: DB, sc: Scope): KpiData => ({
  id: "pend", label: "Entregas pendientes de calificación", value: String(pendingSubmissions(db, sc)), delta: null,
  formula: sc.view === "estudiante" ? "Tus entregas (db.submissions) con estado «pendiente»." : "Entregas (db.submissions) con estado «pendiente» en tus cursos.",
});

export function kpisFor(db: DB, sc: Scope, now = Date.now()): KpiData[] {
  const since = now - WINDOW_MS, acts = activity(db.audit).filter((a) => inScope(a, sc));
  const ens = enrollmentsOf(db, sc), n = ens.length;
  const done = ens.filter((e) => e.done === course(e.courseId).lessons).length;
  const created = acts.filter((a) => a.kind === "enrolled" && a.at >= since).length;
  const completedNow = acts.filter((a) => a.kind === "completed" && a.at >= since).length;
  const certs = db.certs.filter((c) => c.status === "emitido" && sc.studentIds.includes(c.studentId) && sc.courseIds.includes(c.courseId));
  const certsPrev = certs.filter((c) => Date.parse(c.issuedAt) < since).length;
  const avgNow = mean(ens.map((e) => (e.done / course(e.courseId).lessons) * 100));
  const avgPrev = avgProgressBefore(db, sc, acts, since);
  const finPrev = n - created > 0 ? ((done - completedNow) / (n - created)) * 100 : null;
  const courseAssess = assessments.filter((a) => sc.courseIds.includes(a.courseId)).map((a) => a.id);
  const att = db.attempts.filter((t) => sc.studentIds.includes(t.studentId) && courseAssess.includes(t.assessmentId));
  const gradeNow = mean(att.map((t) => t.score)), gradePrev = mean(att.filter((t) => Date.parse(t.at) < since).map((t) => t.score));

  if (sc.view === "estudiante") {
    const active = ens.filter((e) => e.done < course(e.courseId).lessons).length;
    return [
      { id: "active", label: "Cursos activos", value: String(active), formula: "Matrículas del estudiante con lecciones completadas < total de lecciones.", delta: diff(active, active + completedNow - created, "n") },
      { id: "avg", label: "Avance medio", value: avgNow === null ? "—" : `${Math.round(avgNow)}%`, formula: "Media de (lecciones completadas ÷ lecciones del curso) en sus matrículas. Variación: estado actual menos las lecciones registradas en la última hora.", delta: avgNow === null ? null : diff(avgNow, avgPrev, "pts") },
      { id: "certs", label: "Certificados", value: String(certs.length), formula: "Certificados con estado «emitido» a nombre del estudiante.", delta: diff(certs.length, certsPrev, "n") },
      pendKpi(db, sc),
    ];
  }
  if (sc.view === "docente") {
    return [
      { id: "enr", label: "Matrículas en mis cursos", value: String(n), formula: "Matrículas de estudiantes en los cursos donde el docente es titular o colaborador.", delta: diff(n, n - created, "n") },
      { id: "fin", label: "Finalización", value: n ? pct(done / n) : "—", formula: "Matrículas con todas las lecciones completadas ÷ matrículas de sus cursos.", delta: n ? diff((done / n) * 100, finPrev, "pts") : null },
      { id: "grade", label: "Nota media", value: gradeNow === null ? "—" : num(gradeNow, 0), formula: "Media de los puntajes de intento (0-100) en las evaluaciones de sus cursos. Variación: frente a los intentos anteriores a hace 1 h.", delta: gradeNow === null ? null : diff(gradeNow, gradePrev, "pts") },
      pendKpi(db, sc),
    ];
  }
  return [
    { id: "stu", label: "Estudiantes", value: String(students.length), formula: "Registros de la tabla students.", delta: null },
    { id: "enr", label: "Matrículas", value: String(n), formula: "Registros de la tabla enrollments.", delta: diff(n, n - created, "n") },
    { id: "fin", label: "Finalización", value: n ? pct(done / n) : "—", formula: "Matrículas completas ÷ matrículas totales.", delta: n ? diff((done / n) * 100, finPrev, "pts") : null },
    { id: "certs", label: "Certificados", value: String(certs.length), formula: "Certificados con estado «emitido».", delta: diff(certs.length, certsPrev, "n") },
  ];
}

// ---- tendencia en vivo: ventanas reales de 1 min sobre los últimos 18 min ----
export interface TrendSeries { name: string; color: string; values: number[] }
export interface Trend { starts: number[]; series: TrendSeries[]; windowMs: number; total: number; collecting: boolean }
const MIN_EVENTS = 3; // con menos eventos no se dibuja una línea (sería engañosa)
export function trendFor(db: DB, sc: Scope, now = Date.now(), windowMs = 60e3, count = 18): Trend {
  const w = windowMs, last = Math.floor(now / w) * w;
  const starts = Array.from({ length: count }, (_, i) => last - (count - 1 - i) * w);
  const bin = (times: number[]) => starts.map((s) => times.filter((t) => t >= s && t < s + w).length);
  const lessons = activity(db.audit).filter((a) => a.kind === "progress" && inScope(a, sc)).map((a) => a.at);
  const events = db.learningEvents.filter((e) => sc.studentIds.includes(e.studentId) && sc.courseIds.includes(e.courseId)).map((e) => Date.parse(e.at));
  const aIds = assessments.filter((a) => sc.courseIds.includes(a.courseId)).map((a) => a.id);
  const exams = db.attempts.filter((t) => sc.studentIds.includes(t.studentId) && aIds.includes(t.assessmentId)).map((t) => Date.parse(t.at));
  const series = [
    { name: "Lecciones avanzadas", color: "#20C8F5", values: bin(lessons) },
    { name: "Eventos de aprendizaje", color: "#8B4DFF", values: bin(events) },
    { name: "Evaluaciones rendidas", color: "#00BFA6", values: bin(exams) },
  ];
  const total = series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0);
  return { starts, windowMs: w, series, total, collecting: total < MIN_EVENTS };
}

// ---- estudiantes con señal de apoyo (docente) ----
export type Signal = "alta" | "media" | "baja";
export function supportList(db: DB, sc: Scope) {
  return sc.studentIds.map((id) => {
    const es = enrollmentsOf(db, { ...sc, studentIds: [id] });
    const p = es.length ? es.reduce((s, e) => s + progress(db, id, e.courseId), 0) / es.length : 0;
    const signal: Signal = p < 0.35 ? "alta" : p < 0.6 ? "media" : "baja";
    return { id, avg: p, courses: es.length, signal };
  }).filter((x) => x.courses > 0).sort((a, b) => a.avg - b.avg);
}

// ---- dominio por habilidad del grupo ----
export function groupMastery(db: DB, sc: Scope) {
  const relevant = skills.filter((k) => courses.some((c) => sc.courseIds.includes(c.id) && c.skills.some((x) => x.id === k.id)));
  return relevant.map((k) => {
    const vals = sc.studentIds.filter((s) => enrollmentsOf(db, { ...sc, studentIds: [s] }).length > 0).map((s) => mastery(db, s, k.id));
    return { id: k.id, name: k.name, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, n: vals.length };
  });
}

// IA (heurística DEMO) vs nota oficial: nunca se mezclan.
export { probCompletion } from "../../data/selectors";
