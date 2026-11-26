// Núcleo rápido de entrenamiento: Float64Array y buffers reutilizados (cero asignaciones por muestra).
// Hace las MISMAS operaciones y en el MISMO orden que la versión de referencia de engine.ts
// (forward/backward), así que los resultados son idénticos bit a bit. La red visible (Network) se
// carga antes de cada época y se vuelve a escribir al terminarla.
import type { LayerAct, Network } from "./engine";

export interface FlatData { X: Float64Array; y: number[]; n: number; d: number }
export function flatten(X: number[][], y: number[]): FlatData {
  const d = X[0].length, out = new Float64Array(X.length * d);
  for (let r = 0; r < X.length; r++) for (let i = 0; i < d; i++) out[r * d + i] = X[r][i];
  return { X: out, y, n: X.length, d };
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
const loss = (p: number, y: number) => {
  if (!Number.isFinite(p)) return NaN;
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
};

interface KLayer { nin: number; nout: number; act: LayerAct; W: Float64Array; b: Float64Array; gW: Float64Array; gb: Float64Array; z: Float64Array; delta: Float64Array }

export class Kernel {
  private readonly layers: KLayer[];
  private readonly a: Float64Array[];          // a[0] = entrada, a[l+1] = activación de la capa l
  private order = new Int32Array(0);

  constructor(net: Network) {
    this.a = net.sizes.map((s) => new Float64Array(s));
    this.layers = net.layers.map((L, l) => {
      const nin = net.sizes[l], nout = net.sizes[l + 1];
      return { nin, nout, act: L.act, W: new Float64Array(nin * nout), b: new Float64Array(nout), gW: new Float64Array(nin * nout), gb: new Float64Array(nout), z: new Float64Array(nout), delta: new Float64Array(nout) };
    });
  }

  load(net: Network): void {
    this.layers.forEach((K, l) => {
      const L = net.layers[l];
      for (let j = 0; j < K.nout; j++) { K.b[j] = L.b[j]; for (let i = 0; i < K.nin; i++) K.W[j * K.nin + i] = L.W[j][i]; }
    });
  }
  store(net: Network): void {
    this.layers.forEach((K, l) => {
      const L = net.layers[l];
      for (let j = 0; j < K.nout; j++) { L.b[j] = K.b[j]; for (let i = 0; i < K.nin; i++) L.W[j][i] = K.W[j * K.nin + i]; }
    });
  }

  private forwardRow(X: Float64Array, offset: number): number {
    const input = this.a[0];
    for (let i = 0; i < input.length; i++) input[i] = X[offset + i];
    for (let l = 0; l < this.layers.length; l++) {
      const K = this.layers[l], prev = this.a[l], out = this.a[l + 1], W = K.W, nin = K.nin;
      for (let j = 0; j < K.nout; j++) {
        let s = K.b[j];
        const row = j * nin;
        for (let i = 0; i < nin; i++) s += W[row + i] * prev[i];
        K.z[j] = s;
        out[j] = K.act === "relu" ? (s > 0 ? s : 0) : K.act === "tanh" ? Math.tanh(s) : sigmoid(s);
      }
    }
    return this.a[this.layers.length][0];
  }

  private backwardRow(y: number): void {
    const last = this.layers.length - 1;
    this.layers[last].delta[0] = this.a[last + 1][0] - y;
    for (let l = last; l >= 0; l--) {
      const K = this.layers[l], prev = this.a[l], delta = K.delta, gW = K.gW, nin = K.nin;
      for (let j = 0; j < K.nout; j++) {
        const dj = delta[j], row = j * nin;
        K.gb[j] += dj;
        for (let i = 0; i < nin; i++) gW[row + i] += dj * prev[i];
      }
      if (l > 0) {
        const P = this.layers[l - 1];
        for (let i = 0; i < nin; i++) {
          let s = 0;
          for (let j = 0; j < K.nout; j++) s += K.W[j * nin + i] * delta[j];
          const o = prev[i];
          P.delta[i] = s * (P.act === "relu" ? (P.z[i] > 0 ? 1 : 0) : P.act === "tanh" ? 1 - o * o : o * (1 - o));
        }
      }
    }
  }

  /** Una época de mini-lotes. Devuelve la pérdida media de entrenamiento. */
  trainEpoch(data: FlatData, lr: number, batch: number, rnd: () => number, l2 = 0): number {
    const n = data.n;
    if (this.order.length !== n) this.order = new Int32Array(n);
    const idx = this.order;
    for (let i = 0; i < n; i++) idx[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    let total = 0;
    for (let s = 0; s < n; s += batch) {
      const end = Math.min(s + batch, n), size = end - s;
      for (const K of this.layers) { K.gW.fill(0); K.gb.fill(0); }
      for (let q = s; q < end; q++) {
        const k = idx[q];
        const p = this.forwardRow(data.X, k * data.d);
        total += loss(p, data.y[k]);
        this.backwardRow(data.y[k]);
      }
      for (const K of this.layers) {
        for (let j = 0; j < K.nout; j++) {
          K.b[j] -= (lr * K.gb[j]) / size;
          const row = j * K.nin;
          for (let i = 0; i < K.nin; i++) K.W[row + i] -= lr * (K.gW[row + i] / size + l2 * K.W[row + i]);
        }
      }
    }
    return total / n;
  }

  /** Escribe las probabilidades en `out` y devuelve la pérdida media. */
  predict(data: FlatData, out: Float64Array): number {
    let total = 0;
    for (let r = 0; r < data.n; r++) { const p = this.forwardRow(data.X, r * data.d); out[r] = p; total += loss(p, data.y[r]); }
    return total / data.n;
  }
}
