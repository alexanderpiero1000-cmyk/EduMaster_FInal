// Lógica pura del dibujo y el movimiento del grafo. Cada pulso corresponde a un enlace real y a un valor medido:
// hacia delante, activación del origen × |peso| de UNA muestra; hacia atrás, |gradiente|. Nada decorativo.
import { backward, forward, mulberry32, zeroGrads } from "./engine";
import type { ForwardCache, Network } from "./engine";
import { matrix } from "./dataset";
import type { Dataset } from "./dataset";

export const MAX_POINTS = 60;            // puntos simultáneos (cada pulso son 3: cabeza y dos de cola)
export const TAIL = [1, 0.55, 0.28];
export const PULSES_PER_LAYER = 7;
export const MINI_PULSES_PER_LAYER = 4;
export const LAYER_MS = 480;
export const DEMO_MS = 2800;
export const REDUCED_MS = 4000;
export const MINI_MS = 4000;
export const ACTIVITY_MIN = 0.3;         // actividad mínima del origen para lanzar un pulso
export const DEFAULT_SHARE = 0.25;       // fracción de enlaces visibles por capa
export const BACKWARD_EVERY = 5;         // épocas
export const BACKWARD_MIN_GAP = 250;     // ms: máximo 4 ondas por segundo

export interface Link { l: number; i: number; j: number }                   // (l,i) → (l+1,j)
export interface Wave { id: number; kind: "fwd" | "bwd"; layers: Link[][]; layerMs: number }

let waveId = 0;
export const nextWaveId = () => ++waveId;
export const linkKey = (e: Link) => `${e.l}:${e.i}:${e.j}`;

/** Nivel de encendido (0-1) de un nodo: activación normalizada dentro de su capa (lo que se ve como relleno). */
export function nodeLevel(net: Network, cache: ForwardCache | null, l: number, n: number): number {
  if (!cache) return 0;
  const v = cache.a[l][n];
  if (l === 0) return Math.min(1, Math.max(0, (v + 3) / 6));
  const act = net.layers[l - 1].act;
  if (act === "tanh") return (v + 1) / 2;
  if (act === "sigmoid") return v;
  return Math.min(1, v / Math.max(...cache.a[l], 1e-6));
}

/** Cuántos enlaces de una capa se ven por defecto: el 25 % (al menos uno). */
export const visibleCount = (total: number) => Math.max(1, Math.round(total * DEFAULT_SHARE));
/** Enlaces visibles por defecto: el 25 % de mayor |peso| de cada capa. */
export function strongestLinks(net: Network): Set<string> {
  const out = new Set<string>();
  net.layers.forEach((L, l) => {
    const all = L.W.flatMap((row, j) => row.map((w, i) => ({ l, i, j, v: Math.abs(w) })));
    all.sort((a, b) => b.v - a.v).slice(0, visibleCount(all.length)).forEach((e) => out.add(linkKey(e)));
  });
  return out;
}

function top(net: Network, value: (l: number, i: number, j: number) => number, perLayer: number): Link[][] {
  return net.layers.map((L, l) => L.W.flatMap((row, j) => row.map((_, i) => ({ l, i, j, v: value(l, i, j) })))
    .filter((e) => e.v > 0).sort((a, b) => b.v - a.v).slice(0, perLayer).map(({ i, j }) => ({ l, i, j })));
}
/** Pulsos de una inferencia: en cada capa, los enlaces de mayor contribución cuyo origen tiene actividad > 0,3. */
export const forwardPulses = (net: Network, cache: ForwardCache, perLayer = PULSES_PER_LAYER): Link[][] =>
  top(net, (l, i, j) => { const a = nodeLevel(net, cache, l, i); return a > ACTIVITY_MIN ? a * Math.abs(net.layers[l].W[j][i]) : 0; }, perLayer);

/** Pulsos de retropropagación: mayor |gradiente| en un lote fijo de entrenamiento. Solo lee la red. */
export function backwardPulses(net: Network, ds: Dataset, active: number[], perLayer = PULSES_PER_LAYER, samples = 64): Link[][] {
  const tr = matrix(ds, ds.split.train.slice(0, samples), active);
  const g = zeroGrads(net);
  tr.X.forEach((x, k) => backward(net, forward(net, x), tr.y[k], g));
  return top(net, (l, i, j) => Math.abs(g.dW[l][j][i]), perLayer);
}

/** Orden barajado (con semilla) de las muestras de validación. */
export function demoOrder(n: number, seed = 5): number[] {
  const rnd = mulberry32(seed), idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

/** Identificador de una muestra sintética de validación (no es un estudiante real). */
export const sampleName = (index: number) => `E-${1000 + index}`;
