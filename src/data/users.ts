// Usuarios de DEMOSTRACIÓN. La autenticación es simulada: no hay backend ni seguridad real.
export type RoleId = "superadmin" | "admin" | "director" | "docente" | "estudiante" | "analista" | "ml" | "auditor";

export const roles: { id: RoleId; label: string; desc: string }[] = [
  { id: "estudiante", label: "Estudiante", desc: "Cursa, entrega evaluaciones y sigue su avance." },
  { id: "docente", label: "Docente", desc: "Califica y acompaña a los estudiantes de sus cursos." },
  { id: "superadmin", label: "Superadministrador", desc: "Gobierna la plataforma; no aprende ni califica por los demás." },
  { id: "admin", label: "Administrador", desc: "Gestiona usuarios y cursos." },
  { id: "director", label: "Director académico", desc: "Supervisa programas y rutas." },
  { id: "analista", label: "Analista", desc: "Consulta datos seudonimizados." },
  { id: "ml", label: "Ingeniería de ML", desc: "Mantiene los modelos." },
  { id: "auditor", label: "Auditor", desc: "Revisa la trazabilidad." },
];
export const roleLabel = (r: RoleId) => roles.find((x) => x.id === r)!.label;

export interface DemoUser { id: string; name: string; email: string; role: RoleId; studentId?: string; instructorId?: string }
export const DEMO_PASSWORD = "demo123";
const mk = (role: RoleId, name: string, extra: Partial<DemoUser> = {}): DemoUser => ({ id: `u-${role}`, name, email: `${role}@edumaster.demo`, role, ...extra });

export const users: DemoUser[] = [
  mk("estudiante", "Ana Torres", { studentId: "s1" }),
  mk("docente", "Prof. Medina", { instructorId: "t1" }),   // cursos c1 y c2
  mk("superadmin", "Marcos Villanueva"),
  mk("admin", "Usuario demo admin"),
  mk("director", "Usuario demo director"),
  mk("analista", "Usuario demo analista"),
  mk("ml", "Usuario demo ML"),
  mk("auditor", "Usuario demo auditor"),
];

export const enabledRoles: RoleId[] = ["estudiante", "docente", "superadmin"];

export type LoginResult = "ok" | "invalid" | "inactive";
export const LOGIN_MESSAGE: Record<Exclude<LoginResult, "ok">, string> = {
  invalid: "Credenciales inválidas o rol fuera del alcance del prototipo.",
  inactive: "Esta cuenta está inactiva. Pide al superadministrador que la reactive.",
};

/** Validación pura del acceso: credenciales de demo, rol habilitado y cuenta activa. */
export function checkAccess(u: DemoUser | undefined, inactive: string[]): LoginResult {
  if (!u || !enabledRoles.includes(u.role)) return "invalid";
  return inactive.includes(u.id) ? "inactive" : "ok";
}
export function authenticate(email: string, password: string, inactive: string[] = []): { result: LoginResult; user: DemoUser | null } {
  const u = users.find((x) => x.email === email.trim().toLowerCase());
  const result = password === DEMO_PASSWORD ? checkAccess(u, inactive) : "invalid";
  return { result, user: result === "ok" ? u! : null };
}
