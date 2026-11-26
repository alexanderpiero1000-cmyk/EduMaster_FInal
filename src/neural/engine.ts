// Motor de perceptrón multicapa en TypeScript puro (sin dependencias ni React).
// Pasada hacia delante, retropropagación y descenso del gradiente por mini-lotes.
// Pérdida: entropía cruzada binaria. Salida: sigmoide. Inicialización: Xavier con semilla.

export type Activation = "relu" | "tanh";
export type LayerAct = Activation | "sigmoid";

export interface Layer { W: number[][]; b: number[]; act: LayerAct }          // W[salida][entrada]
export interface Network { sizes: number[]; layers: Layer[]; activation: Activation }
export interface ForwardCache { a: number[][]; z: number[][] }              // a[0] = entrada; a[l+1] = activación de la capa l
export interface Grads { dW: number[][][]; db: number[][]; delta: number[][] }

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-12), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
const actFn = (a: LayerAct, z: number) => (a === "relu" ? (z > 0 ? z : 0) : a === "tanh" ? Math.tanh(z) : sigmoid(z));
// derivada respecto de z, expresada con z (relu) o con la activación ya calculada (tanh)
const actDeriv = (a: LayerAct, z: number, out: number) => (a === "relu" ? (z > 0 ? 1 : 0) : a === "tanh" ? 1 - out * out : out * (1 - out));

export function createNetwork(inputs: number, hidden: number[], activation: Activation, seed: number): Network {
  const rnd = mulberry32(seed);
  const sizes = [inputs, ...hidden, 1];
  const layers: Layer[] = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l], fanOut = sizes[l + 1];
    const limit = Math.sqrt(6 / (fanIn + fanOut)); // Xavier uniforme
    layers.push({
      W: Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => (rnd() * 2 - 1) * limit)),
      b: new Array<number>(fanOut).fill(0),
      act: l === sizes.length - 2 ? "sigmoid" : activation,
    });
  }
  return { sizes, layers, activation };
}

export const paramCount = (net: Network) => net.layers.reduce((s, L) => s + L.W.length * L.W[0].length + L.b.length, 0);

export function forward(net: Network, x: number[]): ForwardCache {
  const a: number[][] = [x], z: number[][] = [];
  for (const L of net.layers) {
    const prev = a[a.length - 1];
    const zl = L.W.map((row, j) => { let s = L.b[j]; for (let i = 0; i < row.length; i++) s += row[i] * prev[i]; return s; });
    z.push(zl);
    a.push(zl.map((v) => actFn(L.act, v)));
  }
  return { a, z };
}

export const outputOf = (c: ForwardCache) => c.a[c.a.length - 1][0];

/** Entropía cruzada binaria con recorte numérico (evita log(0)). */
export function bce(p: number, y: number): number {
  if (!Number.isFinite(p)) return NaN;
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

export function zeroGrads(net: Network): Grads {
  return {
    dW: net.layers.map((L) => L.W.map((r) => new Array<number>(r.length).fill(0))),
    db: net.layers.map((L) => new Array<number>(L.b.length).fill(0)),
    delta: net.layers.map((L) => new Array<number>(L.b.length).fill(0)),
  };
}

/** Retropropagación de una muestra. Con sigmoide + BCE, delta de salida = p - y. Acumula en g. */
export function backward(net: Network, c: ForwardCache, y: number, g: Grads): void {
  const nl = net.layers.length;
  let delta: number[] = [outputOf(c) - y];
  for (let l = nl - 1; l >= 0; l--) {
    const L = net.layers[l], prev = c.a[l];
    for (let j = 0; j < L.W.length; j++) {
      g.delta[l][j] = delta[j];
      g.db[l][j] += delta[j];
      for (let i = 0; i < prev.length; i++) g.dW[l][j][i] += delta[j] * prev[i];
    }
    if (l > 0) {
      const P = net.layers[l - 1];
      const next = new Array<number>(prev.length).fill(0);
      for (let i = 0; i < prev.length; i++) {
        let s = 0;
        for (let j = 0; j < L.W.length; j++) s += L.W[j][i] * delta[j];
        next[i] = s * actDeriv(P.act, c.z[l - 1][i], prev[i]);
      }
      delta = next;
    }
  }
}

/** l2 = decaimiento de pesos (no se aplica a los sesgos). */
export function applyGrads(net: Network, g: Grads, lr: number, n: number, l2 = 0): void {
  net.layers.forEach((L, l) => {
    for (let j = 0; j < L.W.length; j++) {
      L.b[j] -= (lr * g.db[l][j]) / n;
      for (let i = 0; i < L.W[j].length; i++) L.W[j][i] -= lr * (g.dW[l][j][i] / n + l2 * L.W[j][i]);
    }
  });
}

export function weightsFinite(net: Network): boolean {
  return net.layers.every((L) => L.b.every(Number.isFinite) && L.W.every((r) => r.every(Number.isFinite)));
}

export function predictAll(net: Network, X: number[][]): number[] {
  return X.map((x) => outputOf(forward(net, x)));
}
export function meanLoss(probs: number[], y: number[]): number {
  return probs.reduce((s, p, i) => s + bce(p, y[i]), 0) / probs.length;
}

export interface Metrics { auc: number; f1: number; recall: number; brier: number; loss: number }

/** ROC-AUC por rangos (Mann-Whitney, con empates promediados), F1 y recall con umbral 0,5, Brier. */
export function metrics(probs: number[], y: number[]): Metrics {
  const n = probs.length;
  const order = probs.map((_, i) => i).sort((a, b) => probs[a] - probs[b]);
  const rank = new Array<number>(n).fill(0);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && probs[order[j + 1]] === probs[order[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rank[order[k]] = r;
    i = j + 1;
  }
  const pos = y.filter((v) => v === 1).length, neg = n - pos;
  let sumPos = 0;
  y.forEach((v, i) => { if (v === 1) sumPos += rank[i]; });
  const auc = pos && neg ? (sumPos - (pos * (pos + 1)) / 2) / (pos * neg) : NaN;
  let tp = 0, fp = 0, fn = 0, br = 0;
  probs.forEach((p, i) => {
    const pred = p >= 0.5 ? 1 : 0;
    if (pred && y[i]) tp++; else if (pred && !y[i]) fp++; else if (!pred && y[i]) fn++;
    br += (p - y[i]) ** 2;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { auc, f1, recall, brier: br / n, loss: meanLoss(probs, y) };
}

/** Verifica el gradiente analítico contra diferencias finitas centrales. Devuelve el mayor error relativo. */
export function gradCheck(net: Network, x: number[], y: number, eps = 1e-5): number {
  const g = zeroGrads(net);
  backward(net, forward(net, x), y, g);
  const lossOf = () => bce(outputOf(forward(net, x)), y);
  let worst = 0;
  net.layers.forEach((L, l) => {
    for (let j = 0; j < L.W.length; j++) {
      for (let i = 0; i <= L.W[j].length; i++) {
        const isBias = i === L.W[j].length;
        const ref = isBias ? L.b : L.W[j];
        const k = isBias ? j : i;
        const old = ref[k];
        ref[k] = old + eps; const up = lossOf();
        ref[k] = old - eps; const dn = lossOf();
        ref[k] = old;
        const num = (up - dn) / (2 * eps);
        const ana = isBias ? g.db[l][j] : g.dW[l][j][i];
        worst = Math.max(worst, Math.abs(num - ana) / Math.max(1e-8, Math.abs(num) + Math.abs(ana)));
      }
    }
  });
  return worst;
}

export function cloneNetwork(net: Network): Network {
  return { sizes: [...net.sizes], activation: net.activation, layers: net.layers.map((L) => ({ W: L.W.map((r) => [...r]), b: [...L.b], act: L.act })) };
}
