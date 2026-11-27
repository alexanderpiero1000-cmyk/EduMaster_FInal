// Solicitudes de ayuda al tutor: abiertas mientras no haya una revisión posterior a la solicitud.
import type { Audit, DB } from "./db";

export const HELP_TYPE = "help.requested";

/** Última revisión de un estudiante (de un curso concreto si se indica `c`, si no de cualquiera). */
export function lastReview(db: DB, s: string, c?: string) {
  return Object.entries(db.reviews).filter(([key]) => (c ? key === `${s}:${c}` : key.startsWith(`${s}:`)))
    .map(([key, r]) => ({ key, ...r })).sort((a, b) => b.at.localeCompare(a.at))[0];
}
/** Solicitud de ayuda sin responder, o null. Con `c` solo mira ese curso. */
export function openHelp(db: DB, s: string, c?: string): Audit | null {
  const asked = db.audit.find((a) => a.type === HELP_TYPE && a.s === s && (!c || a.c === c));  // la auditoría va de más nueva a más vieja
  if (!asked) return null;
  const answered = lastReview(db, s, c);
  return answered && answered.at >= asked.at ? null : asked;
}