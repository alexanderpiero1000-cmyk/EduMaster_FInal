// Guarda única de acciones: devuelve el motivo del rechazo o null. (En producción esto se valida en el backend.)
import type { Action } from "../store/Store";
import { courses } from "./db";
import type { DB } from "./db";
import { can } from "./permissions";
import type { Perm } from "./permissions";
import { ownsCourse } from "./scope";
import type { DemoUser } from "./users";

const need: Partial<Record<Action["t"], Perm>> = {
  lesson: "learn", enroll: "learn", learning: "learn", submit: "submit", grade: "grade", attempt: "grade",
  issue: "cert.issue", revoke: "cert.revoke", rec: "reco.feedback", help: "reco.feedback", review: "reco.review",
  post: "post", hide: "moderate", course: "course.manage", path: "path.assign", assign: "path.assign",
  setting: "settings.edit", user: "settings.edit", export: "export", "model.register": "ml.approve",
};
// Acciones ligadas a un curso: el docente solo puede ejecutarlas sobre cursos que posee.
const courseScoped: Action["t"][] = ["lesson", "enroll", "learning", "submit", "grade", "attempt", "issue", "revoke", "rec", "help", "review", "post", "hide", "course"];

/** Estudiante y curso sobre los que actúa una acción. */
export function targetOf(db: DB, a: Action): { s?: string; c?: string } {
  switch (a.t) {
    case "lesson": case "enroll": case "learning": case "submit": case "attempt": case "issue": case "post": case "help": return { s: a.s, c: a.c };
    case "grade": { const sub = db.submissions.find((x) => x.id === a.id); return { s: sub?.studentId, c: sub?.courseId }; }
    case "revoke": { const cert = db.certs.find((x) => x.folio === a.folio); return { s: cert?.studentId, c: cert?.courseId }; }
    case "rec": case "review": { const [s, c] = a.key.split(":"); return { s, c }; }
    case "hide": return { c: db.posts.find((p) => p.id === a.id)?.courseId };
    case "course": return { c: a.c };
    case "assign": return { s: a.s };
    default: return {};
  }
}

export function authorize(db: DB, user: DemoUser, a: Action): string | null {
  const perm = need[a.t];
  if (!perm) return null;
  if (!can(user.role, perm)) return `El rol ${user.role} no tiene el permiso «${perm}»`;
  const { s, c } = targetOf(db, a);
  if (user.role === "estudiante" && s !== undefined && s !== user.studentId) return "Un estudiante solo puede actuar sobre sus propios datos";
  if (user.role === "docente" && courseScoped.includes(a.t)) {
    const course = courses.find((x) => x.id === c);
    if (!course || !ownsCourse(user, course)) return "El docente solo puede actuar sobre sus cursos";
  }
  if (a.t === "user" && a.id === user.id && !a.active) return "No puedes desactivar tu propia cuenta";
  if (a.t === "hide" && !a.reason.trim()) return "La moderación requiere un motivo";
  return null;
}
