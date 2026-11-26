// ABAC: sobre qué datos actúa cada usuario.
import { courses, students } from "./db";
import type { Audit, Course, DB, Notif, Student } from "./db";
import { can } from "./permissions";
import type { DemoUser } from "./users";

export function ownsCourse(user: DemoUser, course: Course): boolean {
  if (user.role !== "docente") return true;
  const t = user.instructorId ?? "";
  return course.instructorId === t || !!course.collaboratorIds?.includes(t);
}
export const myCourseIds = (user: DemoUser): string[] => courses.filter((c) => ownsCourse(user, c)).map((c) => c.id);

export function scopeStudents(db: DB, user: DemoUser): Student[] {
  if (user.role === "estudiante") return students.filter((s) => s.id === user.studentId);
  if (user.role === "docente") {
    const mine = myCourseIds(user);
    return students.filter((s) => db.enrollments.some((e) => e.studentId === s.id && mine.includes(e.courseId)));
  }
  return students;
}

export function visibleAudit(db: DB, user: DemoUser): Audit[] {
  if (user.role === "estudiante") return db.audit.filter((a) => a.s === user.studentId);
  if (user.role === "docente") { const mine = myCourseIds(user); return db.audit.filter((a) => !!a.c && mine.includes(a.c)); }
  return can(user.role, "audit.read") ? db.audit : [];
}

export function visibleNotifs(db: DB, user: DemoUser): Notif[] {
  const keys = [`r:${user.role}`];
  if (user.role === "estudiante" && user.studentId) keys.push(`s:${user.studentId}`);
  if (user.role === "docente") keys.push(...myCourseIds(user).map((c) => `c:${c}`));
  return db.notifications.filter((n) => keys.includes(n.to));
}

/** Nombre a mostrar. Para analista y ml queda preparado el seudónimo (roles aún no habilitados). */
export function shownName(user: DemoUser, s: Student): string {
  if (user.role === "analista" || user.role === "ml") return `E-${1000 + Number(s.id.slice(1)) * 37}`;
  return s.name;
}
