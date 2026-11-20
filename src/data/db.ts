// BASE DE DATOS SIMULADA (DEMO). Entidades y relaciones según manual §7.
export const DATA_SOURCE = "DEMO · dataset sintético";
export interface Student { id: string; name: string; cohort: string; region: string }
export interface Skill { id: string; name: string }
export interface Course { id: string; code: string; title: string; level: string; instructor: string; lessons: number; hpl: number; skills: { id: string; w: number }[]; prereq?: string }
export interface Assessment { id: string; courseId: string; title: string; pass: number }
export interface Enrollment { studentId: string; courseId: string; done: number }
export interface Attempt { id: string; assessmentId: string; studentId: string; score: number; at: string }
export interface Cert { folio: string; code: string; studentId: string; courseId: string; issuedAt: string; status: "emitido" | "anulado" }
export interface Post { id: string; courseId: string; studentId: string; text: string; at: string }
export interface Audit { id: string; type: string; text: string; at: string }
export interface Path { id: string; title: string; objective: string; courseIds: string[] }
export type RecState = "aceptada" | "descartada" | "util";
export interface Settings { sim: boolean; reducedMotion: boolean; humanReview: boolean }
export interface DB {
  enrollments: Enrollment[]; attempts: Attempt[]; certs: Cert[]; posts: Post[]; audit: Audit[];
  recState: Record<string, RecState>; settings: Settings;
}

export const regions = ["América del Norte","Europa","Asia","América del Sur","África","Oceanía"];
export const students: Student[] = [
  "Ana Torres","Luis Quispe","María Rojas","Carlos Díaz","Lucía Flores","Jorge Vega","Sofía Paredes","Diego Salas",
].map((name, i) => ({ id: `s${i + 1}`, name, cohort: i % 2 ? "2026-B" : "2026-A", region: regions[(i * 5) % 6] }));

export const skills: Skill[] = [
  { id: "k1", name: "Inteligencia Artificial" }, { id: "k2", name: "Machine Learning" },
  { id: "k3", name: "Ciencia de Datos" }, { id: "k4", name: "Desarrollo Web" }, { id: "k5", name: "Nube y DevOps" },
];
export const levels = ["Aprender","Practicar","Aplicar","Avanzado","Experto"];

export const courses: Course[] = [
  { id: "c1", code: "PY-101", title: "Python Básico", level: "Básico", instructor: "Prof. Medina", lessons: 6, hpl: 2, skills: [{ id: "k3", w: 0.6 }, { id: "k4", w: 0.4 }] },
  { id: "c2", code: "DS-201", title: "Ciencia de Datos", level: "Intermedio", instructor: "Prof. Medina", lessons: 8, hpl: 3, skills: [{ id: "k3", w: 1 }], prereq: "c1" },
  { id: "c3", code: "ML-210", title: "Machine Learning Básico", level: "Intermedio", instructor: "Dra. Ríos", lessons: 8, hpl: 3, skills: [{ id: "k2", w: 0.8 }, { id: "k3", w: 0.2 }], prereq: "c1" },
  { id: "c4", code: "AI-301", title: "Inteligencia Artificial Avanzada", level: "Avanzado", instructor: "Dra. Ríos", lessons: 10, hpl: 4, skills: [{ id: "k1", w: 0.7 }, { id: "k2", w: 0.3 }], prereq: "c3" },
  { id: "c5", code: "WB-120", title: "Desarrollo Web", level: "Básico", instructor: "Prof. Campos", lessons: 7, hpl: 2, skills: [{ id: "k4", w: 1 }] },
  { id: "c6", code: "CL-220", title: "Nube y DevOps", level: "Intermedio", instructor: "Prof. Campos", lessons: 8, hpl: 3, skills: [{ id: "k5", w: 0.8 }, { id: "k4", w: 0.2 }], prereq: "c5" },
];
export const assessments: Assessment[] = courses.map((c, i) => ({ id: `a${i + 1}`, courseId: c.id, title: `Evaluación final · ${c.title}`, pass: 60 }));
export const paths: Path[] = [
  { id: "p1", title: "Ruta de Ciencia de Datos", objective: "Analizar datos con Python y modelos básicos", courseIds: ["c1", "c2", "c3"] },
  { id: "p2", title: "Ruta de Inteligencia Artificial", objective: "Construir y evaluar modelos de IA", courseIds: ["c1", "c3", "c4"] },
  { id: "p3", title: "Ruta Full Stack Cloud", objective: "Desarrollar y desplegar aplicaciones web", courseIds: ["c5", "c6"] },
];
export const rbac = [
  ["Superadministrador","Todo","Todo","Todo","Todo"], ["Administrador","CRUD","CRUD","Total","Consultar"],
  ["Docente","Lectura limitada","Asignados","Sus grupos","Propia actividad"], ["Estudiante","Propio perfil","Inscritos","Propias","Propia actividad"],
  ["Analista","Seudonimizado","Agregada","Agregadas","Lectura autorizada"], ["Auditor","Lectura","Lectura","Lectura","Lectura total"],
];
export const trend = [
  { name: "Matrículas", color: "#087FE5", values: [110,125,140,150,165,190,170,185,175,215,230,262] },
  { name: "Cursos completados", color: "#8B4DFF", values: [40,45,52,60,66,78,70,82,76,90,96,98] },
  { name: "Certificados", color: "#00BFA6", values: [20,22,28,30,34,40,38,44,42,50,55,60] },
];
export const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const neuralLayers = [
  { name: "Entrada", detail: "Variables de actividad", nodes: ["Uso de plataforma","Rendimiento","Participación","Interacciones","Asistencias","Comentarios"] },
  { name: "Embedding", detail: "Vector de características · dim 64", nodes: ["","","","","",""] },
  { name: "Temporal (GRU)", detail: "Secuencia de eventos", nodes: ["","","","","",""] },
  { name: "Fusión", detail: "Dense + LayerNorm + Dropout", nodes: ["","","","","",""] },
  { name: "Salida", detail: "Cabezas de predicción", nodes: ["Finalización","Dominio","Riesgo (apoyo)","Ranking recursos","Rendimiento","Certificación"] },
];

const H = (n: number) => new Date(Date.now() - n * 3600e3).toISOString();
export function seed(): DB {
  const enrollments: Enrollment[] = [], attempts: Attempt[] = [], certs: Cert[] = [];
  students.forEach((s, i) => courses.forEach((c, j) => {
    if ((i + j) % 3 === 0) return;
    const full = (i + j) % 4 === 0;
    const done = full ? c.lessons : (i * 3 + j * 5) % c.lessons;
    enrollments.push({ studentId: s.id, courseId: c.id, done });
    if (full || done >= c.lessons / 2) {
      const score = full ? 65 + ((i * 7 + j * 3) % 30) : 45 + ((i * 13 + j * 7) % 45);
      attempts.push({ id: `t${attempts.length + 1}`, assessmentId: `a${j + 1}`, studentId: s.id, score, at: H(i + j + 1) });
      if (full && certs.length < 2) certs.push({ folio: `EM-2026-${String(certs.length + 1).padStart(4, "0")}`, code: `V${s.id.toUpperCase()}${c.id.toUpperCase()}`, studentId: s.id, courseId: c.id, issuedAt: H(2), status: "emitido" });
    }
  }));
  return {
    enrollments, attempts, certs,
    posts: [{ id: "m1", courseId: "c1", studentId: "s1", text: "¿Alguien tiene ejemplos de listas por comprensión?", at: H(5) }],
    audit: [{ id: "x1", type: "system.started", text: "Dataset DEMO cargado", at: H(0.1) }],
    recState: {}, settings: { sim: true, reducedMotion: false, humanReview: true },
  };
}
