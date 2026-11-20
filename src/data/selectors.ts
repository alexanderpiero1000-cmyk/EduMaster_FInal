import { assessments, courses, levels, skills, students } from "./db";
import type { DB } from "./db";

export const course = (id: string) => courses.find((c) => c.id === id)!;
export const student = (id: string) => students.find((s) => s.id === id)!;
export const enrollment = (db: DB, s: string, c: string) => db.enrollments.find((e) => e.studentId === s && e.courseId === c);
export const progress = (db: DB, s: string, c: string) => { const e = enrollment(db, s, c); return e ? e.done / course(c).lessons : 0; };
export function best(db: DB, s: string, c: string): number | null {
  const ids = assessments.filter((a) => a.courseId === c).map((a) => a.id);
  const sc = db.attempts.filter((t) => t.studentId === s && ids.includes(t.assessmentId)).map((t) => t.score);
  return sc.length ? Math.max(...sc) : null;
}
export const passed = (db: DB, s: string, c: string) => (best(db, s, c) ?? 0) >= 60;
export const certOf = (db: DB, s: string, c: string) => db.certs.find((x) => x.studentId === s && x.courseId === c && x.status === "emitido");
export const eligible = (db: DB, s: string, c: string) => progress(db, s, c) === 1 && passed(db, s, c) && !certOf(db, s, c);
export const prereqMet = (db: DB, s: string, c: string) => { const p = course(c).prereq; return !p || progress(db, s, p) === 1; };

// Dominio por competencia: 60% evidencia de evaluación + 40% avance (estimación DEMO)
export function mastery(db: DB, s: string, k: string): number {
  let num = 0, den = 0;
  for (const e of db.enrollments.filter((x) => x.studentId === s)) {
    const cs = course(e.courseId).skills.find((x) => x.id === k);
    if (!cs) continue;
    num += cs.w * (0.6 * (best(db, s, e.courseId) ?? 0) + 0.4 * progress(db, s, e.courseId) * 100); den += cs.w;
  }
  return den ? Math.round(num / den) : 0;
}
export const levelOf = (m: number) => Math.min(4, Math.floor(m / 20));
export const heatmap = (db: DB) => skills.map((k) => levels.map((_, j) =>
  Math.round((100 * students.filter((s) => levelOf(mastery(db, s.id, k.id)) >= j).length) / students.length)));

export function kpis(db: DB) {
  return {
    students: students.length, courses: courses.length,
    hours: db.enrollments.reduce((a, e) => a + e.done * course(e.courseId).hpl, 0),
    certs: db.certs.filter((c) => c.status === "emitido").length,
  };
}
export function completion(db: DB) {
  const n = db.enrollments.length || 1;
  const c = db.enrollments.filter((e) => e.done === course(e.courseId).lessons).length;
  const z = db.enrollments.filter((e) => e.done === 0).length;
  return { completed: Math.round((100 * c) / n), notStarted: Math.round((100 * z) / n), inProgress: 100 - Math.round((100 * c) / n) - Math.round((100 * z) / n) };
}
export const avgProgress = (db: DB, s: string) => {
  const es = db.enrollments.filter((e) => e.studentId === s);
  return es.length ? es.reduce((a, e) => a + e.done / course(e.courseId).lessons, 0) / es.length : 0;
};
export const avgScore = (db: DB, s: string) => {
  const t = db.attempts.filter((x) => x.studentId === s);
  return t.length ? Math.round(t.reduce((a, x) => a + x.score, 0) / t.length) : null;
};
// Estimación IA (heurística DEMO): NO es la nota oficial
export function probCompletion(db: DB, s: string, c: string) {
  const b = best(db, s, c);
  return Math.min(0.98, Math.max(0.02, 0.2 + 0.7 * progress(db, s, c) + (b === null ? 0 : (b - 60) / 200)));
}
export const risk = (db: DB, s: string) => { const p = avgProgress(db, s); return p < 0.35 ? "alta" : p < 0.6 ? "media" : "baja"; };

export interface Rec { key: string; courseId: string; verb: string; reason: string }
export function recommend(db: DB, s: string): Rec[] {
  const weak = [...skills].sort((a, b) => mastery(db, s, a.id) - mastery(db, s, b.id)).slice(0, 3);
  const out: Rec[] = [];
  for (const k of weak) {
    let cand = courses.filter((c) => c.skills.some((x) => x.id === k.id) && progress(db, s, c.id) < 1)
      .sort((a, b) => (b.skills.find((x) => x.id === k.id)!.w) - (a.skills.find((x) => x.id === k.id)!.w))[0];
    if (cand && !prereqMet(db, s, cand.id)) cand = course(cand.prereq!);
    if (!cand || out.some((r) => r.courseId === cand.id)) continue;
    out.push({ key: `${s}:${cand.id}`, courseId: cand.id, verb: enrollment(db, s, cand.id) ? "Continúa" : "Inscríbete",
      reason: `Brecha en ${k.name} (dominio ${mastery(db, s, k.id)}%)` });
  }
  return out;
}
