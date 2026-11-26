// RBAC: qué puede hacer cada rol. ÚNICA fuente de la matriz: menú, botones, guarda y tablas la leen desde aquí.
import type { RoleId } from "./users";

export const allPerms = [
  "view.resumen", "view.planes", "view.cursos", "view.analisis", "view.tutor", "view.evaluaciones", "view.certificados", "view.comunidad", "view.config",
  "learn", "submit", "grade", "reco.feedback", "reco.review", "mastery.validate", "path.assign", "course.manage",
  "cert.issue", "cert.revoke", "post", "moderate", "settings.edit", "export", "audit.read", "ml.approve",
] as const;
export type Perm = typeof allPerms[number];

const views = allPerms.filter((p) => p.startsWith("view."));
const off: Perm[] = ["view.resumen"]; // roles aún no habilitados en el prototipo
const matrix: Record<RoleId, Perm[]> = {
  estudiante: ["view.resumen", "view.planes", "view.cursos", "view.tutor", "view.evaluaciones", "view.certificados", "view.comunidad", "learn", "submit", "reco.feedback", "post"],
  docente: ["view.resumen", "view.cursos", "view.analisis", "view.tutor", "view.evaluaciones", "view.comunidad", "grade", "course.manage", "reco.review", "mastery.validate", "moderate", "post", "export"],
  // Separación de funciones: gobierna, pero no aprende, entrega, califica ni publica.
  superadmin: [...views, "course.manage", "cert.issue", "cert.revoke", "path.assign", "reco.review", "moderate", "settings.edit", "export", "audit.read", "ml.approve"],
  admin: off, director: off, analista: off, ml: off, auditor: off,
};

export const can = (role: RoleId, perm: Perm): boolean => matrix[role].includes(perm);

export const sections = ["Resumen", "Planes de Aprendizaje", "Cursos", "Análisis", "IA Tutor", "Evaluaciones", "Certificados", "Comunidad", "Configuración"] as const;
export type SectionName = typeof sections[number];
const sectionPerm: Record<SectionName, Perm> = {
  "Resumen": "view.resumen", "Planes de Aprendizaje": "view.planes", "Cursos": "view.cursos", "Análisis": "view.analisis", "IA Tutor": "view.tutor",
  "Evaluaciones": "view.evaluaciones", "Certificados": "view.certificados", "Comunidad": "view.comunidad", "Configuración": "view.config",
};
export const visibleSections = (role: RoleId): SectionName[] => sections.filter((s) => can(role, sectionPerm[s]));
