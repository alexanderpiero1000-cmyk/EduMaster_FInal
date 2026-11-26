// Lógica pura (sin React): entrenamiento paso a paso, early stopping, baselines hasta converger,
// techo teórico, importancia por permutación, estadística y definición de los experimentos guiados.
import { cloneNetwork, createNetwork, metrics, mulberry32, predictAll, weightsFinite } from "./engine";
import type { Activation, Metrics, Network } from "./engine";
import { flatten, Kernel } from "./kernel";
import type { FlatData } from "./kernel";
import { designMatrix, INTERACTION, matrix, NOISE_INDEX } from "./dataset";
import type { Dataset, Row } from "./dataset";

export const BATCH = 16;
export const BASELINE_LR = 0.05;
export const SEEDS = [11, 22, 33, 44, 55];

export interface RunSpec {
  active: number[]; hidden: number[]; activation: Activation;
  lr: number; l2: number; patience: number;      // patience 0 = sin early stopping
  maxEpochs: number; seed: number;
  untilConverged?: boolean;                      // para los baselines
  interaction?: boolean;                         // añade el producto días activos × avance como entrada
}
export interface Snapshot { trainLoss: number; valLoss: number; m: Metrics }

/** Regresión logística (0 capas ocultas); con `interaction` recibe además el término de interacción. */
export const baselineSpec = (active: number[], seed: number, interaction = false): RunSpec =>
  ({ active, hidden: [], activation: "relu", lr: BASELINE_LR, l2: 0, patience: 0, maxEpochs: 500, seed, untilConverged: true, interaction });

const NO_METRICS: Metrics = { auc: NaN, f1: NaN, recall: NaN, brier: NaN, loss: NaN };

/** Un entrenamiento que avanza época a época (lo usan el modo en vivo y las repeticiones por tandas). */
export class Run {
  net: Network;
  epoch = 0;
  bestEpoch = 0;
  bestValLoss = Infinity;
  done = false;
  stoppedEarly = false;
  error: string | null = null;
  last: Snapshot | null = null;
  current: Snapshot | null = null;            // lo medido en la última época, antes de restaurar
  private best: { net: Network; trainLoss: number; valLoss: number } | null = null;
  private maxEpochs: number;
  private wait = 0;
  private bad = 0;
  private losses: number[] = [];
  private readonly rnd: () => number;
  private readonly kernel: Kernel;
  private readonly tr: FlatData;
  private readonly va: FlatData;
  private readonly probs: Float64Array;

  readonly spec: RunSpec;
  private readonly metricsEvery: number;
  /** metricsEvery: cada cuántas épocas se calculan AUC/F1/Brier (la pérdida de validación se mide siempre: la usa el early stopping). */
  constructor(ds: Dataset, spec: RunSpec, metricsEvery = 1) {
    this.spec = spec;
    this.metricsEvery = metricsEvery;
    const tr = designMatrix(ds, ds.split.train, spec.active, spec.interaction);
    const va = designMatrix(ds, ds.split.val, spec.active, spec.interaction);
    this.tr = flatten(tr.X, tr.y);
    this.va = flatten(va.X, va.y);
    this.probs = new Float64Array(this.va.n);
    this.net = createNetwork(this.tr.d, spec.hidden, spec.activation, spec.seed);
    this.kernel = new Kernel(this.net);
    this.rnd = mulberry32(spec.seed + 1);
    this.maxEpochs = spec.maxEpochs;
  }

  /** Permite seguir entrenando después de parar. */
  extend(more: number): void { this.maxEpochs = this.epoch + more; this.done = false; this.stoppedEarly = false; this.wait = 0; }

  private valMetrics(): Metrics { return metrics(Array.from(this.probs), this.va.y); }

  evaluate(trainLoss: number): Snapshot {
    this.kernel.load(this.net);
    const valLoss = this.kernel.predict(this.va, this.probs);
    return { trainLoss, valLoss, m: this.valMetrics() };
  }

  /** Entrena una época. Devuelve false si divergió (ver `error`). */
  step(): boolean {
    if (this.done) return !this.error;
    this.kernel.load(this.net);
    const loss = this.kernel.trainEpoch(this.tr, this.spec.lr, BATCH, this.rnd, this.spec.l2);
    this.kernel.store(this.net);
    const valLoss = this.kernel.predict(this.va, this.probs);
    if (!Number.isFinite(loss) || !Number.isFinite(valLoss) || !weightsFinite(this.net)) {
      return this.fail("La pérdida se volvió NaN o Infinity: la tasa de aprendizaje es demasiado alta.");
    }
    this.bad = loss > 5 ? this.bad + 1 : 0;
    if (this.bad >= 3) return this.fail(`La pérdida divergió (${loss.toFixed(1)}): la tasa de aprendizaje es demasiado alta.`);
    this.epoch++;
    if (valLoss < this.bestValLoss - 1e-4) {
      this.bestValLoss = valLoss; this.bestEpoch = this.epoch; this.wait = 0;
      if (this.spec.patience > 0) this.best = { net: cloneNetwork(this.net), trainLoss: loss, valLoss };
    } else this.wait++;
    if (this.spec.untilConverged) {
      this.losses.push(loss);
      if (this.losses.length >= 20) {
        const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
        if (Math.abs(avg(this.losses.slice(-10)) - avg(this.losses.slice(-20, -10))) < 5e-4) this.done = true;
      }
    }
    const early = this.spec.patience > 0 && this.wait >= this.spec.patience;
    if (early || this.epoch >= this.maxEpochs) this.done = true;
    const measure = this.done || this.epoch % this.metricsEvery === 0;
    this.last = { trainLoss: loss, valLoss, m: measure ? this.valMetrics() : this.last?.m ?? NO_METRICS };
    this.current = this.last;
    if (this.done && this.spec.patience > 0 && this.best) {      // restaurar los mejores pesos y medirlos
      this.stoppedEarly = early;
      this.net = cloneNetwork(this.best.net);
      this.last = this.evaluate(this.best.trainLoss);
    }
    return true;
  }

  private fail(message: string): false { this.error = message; this.done = true; return false; }
}

// ---- techo teórico ----
export function ceilingAuc(rows: Row[]): number {
  return metrics(rows.map((r) => r.pTrue), rows.map((r) => r.y)).auc;
}
/** Fracción del camino entre baseline y techo que recorre la red (puede ser <0 o >1 por azar de muestra). */
export function pathCovered(auc: number, base: number, ceil: number): number | null {
  return ceil - base > 0.005 ? (auc - base) / (ceil - base) : null;
}

// ---- estadística ----
export function meanSd(a: number[]): { mean: number; sd: number } {
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  const sd = a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (a.length - 1)) : 0;
  return { mean, sd };
}
/** Error estándar del AUC (Hanley-McNeil, 1982). */
export function hanleyMcNeil(auc: number, pos: number, neg: number): number {
  const q1 = auc / (2 - auc), q2 = (2 * auc * auc) / (1 + auc);
  return Math.sqrt(Math.max(0, auc * (1 - auc) + (pos - 1) * (q1 - auc * auc) + (neg - 1) * (q2 - auc * auc)) / (pos * neg));
}
export interface Verdict { diff: number; text: string; conclusive: boolean }
/** Regla: |diferencia| < 2 desviaciones entre semillas → no concluyente; además se contrasta con el error por tamaño de muestra. */
export function compare(a: { mean: number; sd: number }, b: { mean: number; sd: number }, pos: number, neg: number): Verdict {
  const diff = a.mean - b.mean;
  if (Math.abs(diff) < 2 * Math.max(a.sd, b.sd) || Math.abs(diff) < 1e-9) return { diff, conclusive: false, text: "diferencia no concluyente" };
  const se = Math.sqrt(hanleyMcNeil(a.mean, pos, neg) ** 2 + hanleyMcNeil(b.mean, pos, neg) ** 2);
  if (Math.abs(diff) < 1.96 * se) return { diff, conclusive: false, text: "estable entre semillas, pero dentro del error de muestra" };
  return { diff, conclusive: true, text: diff > 0 ? "mejora clara" : "empeora claramente" };
}

// ---- importancia por permutación (sobre validación) ----
export interface Importance { feature: number; drop: number; sd: number }
export function permutationImportance(net: Network, ds: Dataset, active: number[], repeats = 5, seed = 99): Importance[] {
  const va = matrix(ds, ds.split.val, active);
  const base = metrics(predictAll(net, va.X), va.y).auc;
  return active.map((feature, col) => {
    const rnd = mulberry32(seed + feature);
    const drops = Array.from({ length: repeats }, () => {
      const perm = va.X.map((r) => r[col]);
      for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      const X = va.X.map((r, i) => { const c = r.slice(); c[col] = perm[i]; return c; });
      return base - metrics(predictAll(net, X), va.y).auc;
    });
    const s = meanSd(drops);
    return { feature, drop: s.mean, sd: s.sd };
  }).sort((a, b) => b.drop - a.drop);
}

// ---- experimentos guiados ----
export type RowKind = "linear" | "inter" | "net";
export interface ExpRow { label: string; spec: Omit<RunSpec, "seed">; kind?: RowKind }
export interface Guided { id: string; title: string; question: string; rows: ExpRow[] }

const all6 = [0, 1, 2, 3, 4, 5];
const net = (active: number[], hidden: number[], extra: Partial<RunSpec> = {}): Omit<RunSpec, "seed"> =>
  ({ active, hidden, activation: "relu", lr: 0.05, l2: 0, patience: 30, maxEpochs: 300, ...extra });
export function baselineRow(active: number[], interaction = false): ExpRow {
  const { seed: _seed, ...spec } = baselineSpec(active, 0, interaction);
  return { label: interaction ? `Baseline con interacción (${INTERACTION.label})` : "Baseline lineal", spec, kind: interaction ? "inter" : "linear" };
}

export const GUIDED: Guided[] = [
  { id: "inputs", title: "Más entradas", question: "¿Qué cambia al dar más información a la red? (arquitectura 8-6; se compara con la primera fila)", rows: [
    { label: "1 entrada (proporción completada)", spec: net([1], [8, 6]) },
    { label: "2 entradas (+ días activos)", spec: net([0, 1], [8, 6]) },
    { label: "6 entradas", spec: net(all6, [8, 6]) },
    { label: "6 + ruido_demo", spec: net([...all6, NOISE_INDEX], [8, 6]) },
  ] },
  { id: "layers", title: "¿Sirve la capa oculta?", question: "Regresión logística, regresión logística con el término de interacción y red 8-6, con las 6 entradas (se compara con el baseline lineal)", rows: [
    baselineRow(all6),
    baselineRow(all6, true),
    { label: "Red (8-6)", spec: net(all6, [8, 6]), kind: "net" },
  ] },
  { id: "overfit", title: "Sobreajuste", question: "La misma red grande (8-8-8), sin y con early stopping + L2 (se compara con la primera fila)", rows: [
    { label: "Sin regularización (300 épocas)", spec: net(all6, [8, 8, 8], { patience: 0 }) },
    { label: "Early stopping (30) + L2 0,001", spec: net(all6, [8, 8, 8], { patience: 30, l2: 0.001 }) },
  ] },
];

export const INTERACTION_NOTE = "Si conoces la relación, un modelo simple puede igualar a la red. La red la descubre sola, sin que se la indiques. En datos reales no hay una regla conocida.";

/** ¿El AUC queda a menos de 1,96 errores estándar (Hanley-McNeil) del techo teórico? */
export function ceilingStatement(auc: number, ceil: number, pos: number, neg: number): { within: boolean; gap: number; margin: number } {
  const margin = 1.96 * hanleyMcNeil(auc, pos, neg), gap = ceil - auc;
  return { within: gap <= margin, gap, margin };
}
