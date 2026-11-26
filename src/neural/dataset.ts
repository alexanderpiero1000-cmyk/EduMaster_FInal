// Dataset SINTÉTICO (DEMO): 1200 estudiantes (200 por periodo), con semilla fija.
// Variables según documento 8.3 más una variable de control sin información (ruido_demo).
// La etiqueta sale de una regla oculta con una interacción NO lineal (actividad × avance) más ruido.
// DERIVA documentada: en los periodos 5 y 6 suben las entregas tardías (desplazamiento DRIFT antes de redondear).
import { gaussian, mulberry32 } from "./engine";

export const PER_PERIOD = 200;
export const DRIFT: Record<number, number> = { 5: 0.6, 6: 1.0 };   // entregas tardías extra
const NOISE_SD = 0.35;                                              // ruido no observable de la regla
export const DATASET_NAME = "Sintético DEMO · 1200 estudiantes · semilla 2026";
export const FEATURES = [
  { key: "active_days_14d", label: "Días activos (14 d)", unit: "días", min: 0, max: 14, step: 1, def: 7 },
  { key: "completion_ratio", label: "Proporción completada", unit: "%", min: 0, max: 1, step: 0.01, def: 0.5 },
  { key: "assessment_mean", label: "Nota media en evaluaciones", unit: "pts", min: 0, max: 100, step: 1, def: 65 },
  { key: "late_submissions_30d", label: "Entregas tardías (30 d)", unit: "entregas", min: 0, max: 8, step: 1, def: 2 },
  { key: "days_since_last_activity", label: "Días desde la última actividad", unit: "días", min: 0, max: 30, step: 1, def: 6 },
  { key: "skill_evidence_score", label: "Evidencia de habilidad", unit: "0-1", min: 0, max: 1, step: 0.01, def: 0.5 },
  { key: "ruido_demo", label: "ruido_demo (control sin información)", unit: "0-1", min: 0, max: 1, step: 0.01, def: 0.5 },
] as const;
export const N_FEATURES = FEATURES.length;
export const NOISE_INDEX = 6;

export interface Row { raw: number[]; y: number; period: number; pTrue: number }   // pTrue = P(y=1 | variables observables)
export interface Dataset {
  rows: Row[];
  mean: number[]; std: number[];
  split: { train: Row[]; val: Row[]; test: Row[] };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
/** Probabilidad verdadera: integra numéricamente el ruido no observable, que ningún modelo puede conocer. */
function marginal(f: number): number {
  let num = 0, den = 0;
  for (let e = -5; e <= 5.0001; e += 0.1) { const w = Math.exp(-0.5 * e * e); num += w * sigmoid(f + NOISE_SD * e); den += w; }
  return num / den;
}

export function generateRows(perPeriod = PER_PERIOD, seed = 2026): Row[] {
  const rnd = mulberry32(seed);
  const noise = mulberry32(seed + 777);                       // flujo aparte para la variable de control
  const rows: Row[] = [];
  for (let i = 0; i < perPeriod * 6; i++) {
    const period = (i % 6) + 1;
    const e = gaussian(rnd);                                  // compromiso latente (no se expone)
    const nz = () => 0.6 * gaussian(rnd) + 0.4 * e;
    const ad = clamp(Math.round(7 + 4 * nz()), 0, 14);
    const cr = clamp(0.5 + 0.22 * nz(), 0, 1);
    const am = clamp(Math.round(65 + 15 * nz()), 0, 100);
    const late = clamp(Math.round(2 - 1.8 * nz() + (DRIFT[period] ?? 0)), 0, 8);
    const dsl = clamp(Math.round(6 - 5 * nz() + 2 * gaussian(rnd)), 0, 30);
    const se = clamp(0.5 + 0.2 * nz(), 0, 1);
    // regla oculta: parte lineal moderada + interacción fuerte (actividad × avance)
    const c = [(ad - 7) / 4, (cr - 0.5) / 0.22, (am - 65) / 15, (late - 2) / 1.8, (dsl - 6) / 5, (se - 0.5) / 0.2];
    const f = 0.2 * c[1] + 0.3 * c[2] - 0.25 * c[3] - 0.25 * c[4] + 0.15 * c[5] + 2.6 * c[0] * c[1];
    const y = rnd() < sigmoid(f + NOISE_SD * gaussian(rnd)) ? 1 : 0;
    rows.push({ raw: [ad, cr, am, late, dsl, se, noise()], y, period, pTrue: marginal(f) });
  }
  return rows;
}

let cache: Dataset | null = null;
export function getDataset(): Dataset {
  if (cache) return cache;
  const rows = generateRows();
  const train = rows.filter((r) => r.period <= 4);            // periodos 1-4 entrenamiento
  const mean = FEATURES.map((_, j) => train.reduce((s, r) => s + r.raw[j], 0) / train.length);
  const std = FEATURES.map((_, j) => Math.sqrt(train.reduce((s, r) => s + (r.raw[j] - mean[j]) ** 2, 0) / train.length) || 1);
  cache = { rows, mean, std, split: { train, val: rows.filter((r) => r.period === 5), test: rows.filter((r) => r.period === 6) } };
  return cache;
}

/** Normaliza (z-score con estadísticas de entrenamiento) y selecciona solo las variables activas. */
export function normalizeRow(ds: Dataset, raw: number[], active: number[]): number[] {
  return active.map((j) => (raw[j] - ds.mean[j]) / ds.std[j]);
}
export function matrix(ds: Dataset, rows: Row[], active: number[]): { X: number[][]; y: number[] } {
  return { X: rows.map((r) => normalizeRow(ds, r.raw, active)), y: rows.map((r) => r.y) };
}

/** Pareja que usa la regla oculta (su producto). Es un dato del GENERADOR sintético: en datos reales no se conoce. */
export const INTERACTION = { a: 0, b: 1, label: "Días activos × avance" } as const;
export const hasInteractionInputs = (active: number[]) => active.includes(INTERACTION.a) && active.includes(INTERACTION.b);

/** Matriz de entrada de un modelo; con `interaction` añade la columna z(días activos) × z(avance), ambas con estadísticas de entrenamiento. */
export function designMatrix(ds: Dataset, rows: Row[], active: number[], interaction = false): { X: number[][]; y: number[] } {
  const base = matrix(ds, rows, active);
  if (!interaction) return base;
  const i = active.indexOf(INTERACTION.a), j = active.indexOf(INTERACTION.b);
  if (i < 0 || j < 0) throw new Error("El término de interacción requiere activar días activos y proporción completada");
  return { X: base.X.map((r) => [...r, r[i] * r[j]]), y: base.y };
}
