// Conserva los datos de la DEMO al recargar (localStorage de este navegador). No es una base de datos.
import { courses, courseVersions, seed, students } from "./db";
import type { Course, CourseVersion, DB } from "./db";

export const DEMO_KEY = "edumaster.demo.v1";
interface Snapshot { db: DB; courses: Course[]; courseVersions: CourseVersion[] }
let resetting = false;

/** Descarta guardados de una versión anterior o dañados: mejor empezar de cero que romper una pantalla. */
function valid(s: Snapshot | null): s is Snapshot {
  if (!s || !s.db || !Array.isArray(s.courses) || !s.courses.length || !Array.isArray(s.courseVersions)) return false;
  const base = seed() as unknown as Record<string, unknown>, db = s.db as unknown as Record<string, unknown>;
  if (!Object.keys(base).every((k) => db[k] !== undefined && Array.isArray(db[k]) === Array.isArray(base[k]))) return false;
  const known = new Set(s.courses.map((c) => c.id));
  return s.db.audit.length > 0 && s.db.enrollments.every((e) => known.has(e.courseId) && students.some((x) => x.id === e.studentId));
}

export function loadDemo(): DB | null {
  try {
    const saved: Snapshot | null = JSON.parse(localStorage.getItem(DEMO_KEY) ?? "null");
    if (!valid(saved)) return null;
    // los cursos creados o editados viven fuera del Store: se restauran en su sitio
    courses.splice(0, courses.length, ...saved.courses);
    courseVersions.splice(0, courseVersions.length, ...saved.courseVersions);
    return saved.db;
  } catch { return null; }
}

export function saveDemo(db: DB): void {
  if (resetting) return;
  try { localStorage.setItem(DEMO_KEY, JSON.stringify({ db, courses, courseVersions } satisfies Snapshot)); } catch { /* sin espacio o bloqueado: la demo sigue en memoria */ }
}

/** Borra lo guardado y recarga: vuelve a los datos iniciales. */
export function resetDemo(): void {
  resetting = true;
  try { localStorage.removeItem(DEMO_KEY); } catch { /* nada que borrar */ }
  location.reload();
}

/** Mayor número usado en los identificadores "eNNN", para no repetirlos tras recargar. */
export function maxId(db: DB): number {
  let max = 0;
  const visit = (id: string) => { const m = /^e(\d+)$/.exec(id); if (m) max = Math.max(max, Number(m[1])); };
  [db.audit, db.notifications, db.attempts, db.submissions, db.posts, db.learningEvents, db.paths].forEach((list) => list.forEach((x) => visit(x.id)));
  return max;
}
