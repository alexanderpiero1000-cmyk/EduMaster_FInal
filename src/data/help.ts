// Solicitudes de ayuda al tutor: abiertas mientras no haya una revisión posterior a la solicitud.
import type { Audit, DB } from "./db";

export const HELP_TYPE = "help.requested";

/** Última revisión (de cualquier recomendación) de un estudiante. */
export function lastReview(db: DB, s: string) {
  return Object.entries(db.reviews).filter(([key]) => key.startsWith(`${s}:`))
    .map(([key, r]) => ({ key, ...r })).sort((a, b) => b.at.localeCompare(a.at))[0];
}
/** Solicitud de ayuda sin responder, o null. */
export function openHelp(db: DB, s: string): Audit | null {
  const asked = db.audit.find((a) => a.type === HELP_TYPE && a.s === s);          // la auditoría va de más nueva a más vieja
  if (!asked) return null;
  const answered = lastReview(db, s);
  return answered && answered.at >= asked.at ? null : asked;
}
