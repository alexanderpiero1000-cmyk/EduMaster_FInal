import { useCallback, useEffect, useRef, useState } from "react";
import { outputOf } from "./engine";
import type { ForwardCache, Network } from "./engine";
import { linkKey, nodeLevel, strongestLinks } from "./flow";
import type { Wave } from "./flow";
import FlowLayer from "./FlowLayer";

export interface Sel { l: number; n: number }        // l = índice de capa en sizes (0 = entrada); n = neurona de la red
export interface GraphInput { label: string; active: boolean }
export interface Edge { l: number; i: number; j: number; w: number; k: number }   // k = |w| / máx |w| de su capa
export type PathMode = "path" | "direct";            // camino hasta la salida / solo conexiones directas

export const layerName = (net: Network, l: number) => (l === 0 ? "Entrada" : l === net.sizes.length - 1 ? "Salida" : `Oculta ${l}`);
export const layerOp = (net: Network, l: number) => {
  if (l === 0) return "valores normalizados (z)";
  const a = net.layers[l - 1].act;
  return `Dense ${net.sizes[l - 1]}→${net.sizes[l]} · ${a === "relu" ? "ReLU" : a === "tanh" ? "tanh" : "sigmoide"}`;
};

/** Enlaces de la red. Solo existen neuronas de entrada para las variables activas, así que una desactivada no tiene enlaces. */
export function buildEdges(net: Network): Edge[] {
  return net.layers.flatMap((L, l) => {
    let max = 1e-9;
    L.W.forEach((r) => r.forEach((w) => { max = Math.max(max, Math.abs(w)); }));
    return L.W.flatMap((row, j) => row.map((w, i) => ({ l, i, j, w, k: Math.abs(w) / max })));
  });
}
export const touches = (e: Edge, s: Sel) => (e.l === s.l && e.i === s.n) || (e.l === s.l - 1 && e.j === s.n);
export const edgeKey = linkKey;

/** Propagación hacia delante desde un nodo usando |pesos|: a_siguiente[k] = Σj a_actual[j]·|w_jk|. */
export function forwardFlow(net: Network, from: Sel): number[][] {
  const flow = [Array.from({ length: net.sizes[from.l] }, (_, n): number => (n === from.n ? 1 : 0))];
  for (let l = from.l; l < net.layers.length; l++) {
    const a = flow[flow.length - 1];
    flow.push(net.layers[l].W.map((row) => row.reduce((s, w, j) => s + a[j] * Math.abs(w), 0)));
  }
  return flow;
}
/** Lo mismo en sentido inverso. Índice 0 = capa de entrada. */
export function backwardFlow(net: Network, to: Sel): number[][] {
  const flow = [Array.from({ length: net.sizes[to.l] }, (_, n): number => (n === to.n ? 1 : 0))];
  for (let l = to.l - 1; l >= 0; l--) {
    const b = flow[0];
    flow.unshift(Array.from({ length: net.sizes[l] }, (_, i) => net.layers[l].W.reduce((s, row, j) => s + Math.abs(row[i]) * b[j], 0)));
  }
  return flow;
}
/** Fuerza de ruta de cada enlace corriente abajo y arriba del nodo, normalizada por capa (máximo = 1). */
export function routeIntensity(net: Network, sel: Sel): Map<string, number> {
  const out = new Map<string, number>();
  const put = (l: number, raw: { i: number; j: number; v: number }[]) => {
    const max = Math.max(0, ...raw.map((r) => r.v));
    if (max > 0) raw.forEach((r) => { if (r.v > 0) out.set(edgeKey({ l, i: r.i, j: r.j }), r.v / max); });
  };
  const fwd = forwardFlow(net, sel);
  for (let l = sel.l; l < net.layers.length; l++) put(l, net.layers[l].W.flatMap((row, j) => row.map((w, i) => ({ i, j, v: fwd[l - sel.l][i] * Math.abs(w) }))));
  const bwd = backwardFlow(net, sel);
  for (let l = 0; l < sel.l; l++) put(l, net.layers[l].W.flatMap((row, j) => row.map((w, i) => ({ i, j, v: Math.abs(w) * bwd[l + 1][j] }))));
  return out;
}
export function highlightMap(net: Network, sel: Sel, mode: PathMode): Map<string, number> {
  if (mode === "path") return routeIntensity(net, sel);
  return new Map(buildEdges(net).filter((e) => touches(e, sel)).map((e) => [edgeKey(e), e.k]));
}

// ---- geometría ----
const COLUMNS: Record<number, number[]> = { 2: [150, 510], 3: [150, 330, 510], 4: [150, 290, 410, 510], 5: [150, 250, 340, 425, 510] };
export interface Layout { compact: boolean; W: number; H: number; cols: number[]; meter: [number, number]; cy: number }

/** Ancho normal: viewBox 648×350. Estrecho (móvil): unidades en píxeles reales para no encoger los textos por debajo de 11 px. */
export function layoutFor(layers: number, width: number, mini = false): Layout {
  if (mini) {
    const cols = Array.from({ length: layers }, (_, l) => 16 + (l * 168) / (layers - 1));
    return { compact: true, W: 232, H: 100, cols, meter: [206, 50], cy: 50 };
  }
  if (width > 0 && width < 600) {
    const W = Math.max(300, Math.round(width)), last = W - 36;
    const cols = Array.from({ length: layers }, (_, l) => (l === layers - 1 ? last - 28 : 116 + (l * (last - 92 - 116)) / Math.max(1, layers - 2)));   // 116: deja sitio a la etiqueta más larga
    return { compact: true, W, H: 380, cols, meter: [last, 185], cy: 188 };
  }
  return { compact: false, W: 648, H: 350, cols: COLUMNS[layers] ?? COLUMNS[4], meter: [540, 185], cy: 188 };
}

const R = 11.5, METER_R = 28;
const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;

interface Props {
  net: Network;
  inputs: GraphInput[];            // TODAS las variables; las activas corresponden en orden a las neuronas de entrada
  cache: ForwardCache | null;      // inferencia que se muestra (muestra de la demostración o valores de prueba)
  wave?: Wave | null;
  speed?: number;
  motion?: boolean;                // false = movimiento reducido: sin pulsos ni barrido, cambios instantáneos
  trained?: boolean;
  showAll?: boolean;
  mini?: boolean;
  selected?: Sel | null;
  highlight?: Sel | null;
  mode?: PathMode;
  onSelect?: (s: Sel | null) => void;
  onFocusNode?: (s: Sel | null) => void;
  onWaveEnd?: (id: number) => void;
  flow?: "fwd" | "bwd" | null;     // corriente continua en el sentido del cálculo (bwd = retropropagación)
}

export default function NetworkGraph({ net, inputs, cache, wave = null, speed = 1, motion = true, trained = true, showAll = false, mini = false,
  selected = null, highlight = null, mode = "path", onSelect, onFocusNode, onWaveEnd, flow = null }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const paths = useRef(new Map<string, SVGPathElement>());
  const [width, setWidth] = useState(0);
  const [stage, setStage] = useState<{ id: number; at: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || mini || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => setWidth(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mini]);
  useEffect(() => {
    if (!selected && !highlight) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { onSelect?.(null); onFocusNode?.(null); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [selected, highlight, onSelect, onFocusNode]);

  const L = net.sizes.length;
  const g = layoutFor(L, width, mini);
  const rows = inputs.map((x, f) => (x.active ? f : -1)).filter((f) => f >= 0);
  const yIn = (f: number) => (mini ? g.cy + (f - (inputs.length - 1) / 2) * (88 / inputs.length) : 84 + (f * (292 - 84)) / Math.max(1, inputs.length - 1));
  const y = (l: number, n: number) => {
    if (l === L - 1) return g.meter[1];
    if (l === 0) return yIn(rows[n]);
    const gap = mini ? Math.min(12, 88 / net.sizes[l]) : Math.min(32, 208 / Math.max(1, net.sizes[l] - 1));
    return g.cy + (n - (net.sizes[l] - 1) / 2) * gap;
  };
  const meterR = mini ? 20 : METER_R;
  const x = (l: number) => (l === L - 1 ? g.meter[0] : g.cols[l]);
  const end = (l: number) => (l === L - 1 ? g.meter[0] - meterR : g.cols[l]);       // los enlaces llegan al borde del medidor

  // Durante la onda, cada capa se enciende cuando el frente la alcanza.
  const sweeping = motion && !!wave && wave.kind === "fwd";
  const reached = sweeping ? (stage && stage.id === wave.id ? stage.at : 0) : L - 1;
  const p = cache ? outputOf(cache) : 0;
  const shownP = useRef(0);
  if (trained && (!sweeping || reached >= L - 1)) shownP.current = p;
  if (!trained) shownP.current = 0;

  const edges = buildEdges(net);
  const strong = strongestLinks(net);
  const route = highlight ? highlightMap(net, highlight, mode) : null;
  const pathOf = useCallback((key: string) => paths.current.get(key) ?? null, []);
  const smooth = motion ? "stroke-width 250ms linear, stroke 250ms linear, stroke-opacity 250ms linear" : "none";
  const circumference = 2 * Math.PI * meterR;
  const flowing = motion && !!flow;
  const dashes = flowing ? edges.flatMap((e) => {
    const key = edgeKey(e), s = route?.get(key);
    if (route && s === undefined) return [];                        // con un nodo elegido solo corre su camino
    const main = route ? true : strong.has(key);
    return [{ key, e, opacity: route ? 0.45 + 0.55 * s! : main ? 0.95 : 0.4, width: (main ? 1 + 1.6 * (route ? s! : e.k) : 0.8) * (mini ? 0.6 : 1) }];
  }) : [];
  const interactive = !mini && !!onSelect;
  const text = (key: string, tx: number, ty: number, value: string, opts: { size?: number; fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; italic?: boolean } = {}) => (
    <text key={key} x={tx} y={ty} textAnchor={opts.anchor ?? "middle"} fontSize={opts.size ?? 11} fontWeight={opts.weight ?? 400} fontStyle={opts.italic ? "italic" : undefined} fill={opts.fill ?? "#8FA6C4"}>{value}</text>
  );

  return (
    <div ref={box} className="w-full">
      <svg viewBox={`0 0 ${g.W} ${g.H}`} role="group" aria-label={`Grafo de la red: ${rows.length} de ${inputs.length} entradas activas; neuronas por capa ${net.sizes.join(", ")}`} className="block h-auto w-full">
        {/* franjas de capa */}
        {net.sizes.map((s, l) => {
          const w = mini ? 20 : l === L - 1 ? (g.compact ? 66 : 76) : g.compact ? 30 : 52;
          return (
            <g key={`band${l}`}>
              <rect x={x(l) - w / 2} y={mini ? 4 : 60} width={w} height={mini ? 92 : 252} rx={mini ? 8 : 14} fill="#fff" fillOpacity={0.03} />
              {!mini && text(`t${l}`, x(l), 24, g.compact && l > 0 && l < L - 1 ? `Ocul. ${l}` : g.compact && l === 0 ? "Entrada" : layerName(net, l), { size: g.compact ? 11 : 12, weight: 500, fill: "#E6EEF8" })}
              {!g.compact && text(`s${l}`, x(l), 40, l === 0 ? `${rows.length} de ${inputs.length} activas` : `${s} ${s === 1 ? "neurona" : "neuronas"}`)}
              {!g.compact && l > 0 && text(`o${l}`, x(l), 334, layerOp(net, l))}
            </g>
          );
        })}
        {/* conexiones: por defecto solo el 25 % de mayor |peso| de cada capa */}
        {edges.map((e) => {
          const key = edgeKey(e);
          const s = route ? route.get(key) : undefined;
          const visible = strong.has(key);
          // con la corriente encendida el trazo fijo se atenúa para que las líneas en movimiento destaquen
          const opacity = (route ? (s === undefined ? 0.035 : 0.15 + 0.8 * s) : visible ? 0.14 + 0.5 * e.k : showAll ? 0.08 : 0) * (flowing ? 0.4 : 1);
          const wdt = (route && s !== undefined && mode === "path" ? 0.7 + 3.3 * s : 0.7 + 2.3 * e.k) * (mini ? 0.6 : 1);
          return (
            <path key={key} ref={(el) => { if (el) paths.current.set(key, el); else paths.current.delete(key); }}
              d={curve(x(e.l), y(e.l, e.i), end(e.l + 1), y(e.l + 1, e.j))} fill="none" strokeLinecap="round"
              data-edge={e.l} data-visible={opacity > 0 ? "" : undefined} data-base={opacity}
              style={{ stroke: e.w >= 0 ? "var(--graph-pos, #20C8F5)" : "var(--graph-neg, #8B4DFF)", strokeWidth: wdt, strokeOpacity: opacity, transition: smooth }} />
          );
        })}
        {/* corriente continua por las conexiones: el color es el signo del peso; el sentido, el del cálculo */}
        <g aria-hidden="true" pointerEvents="none">
          {dashes.map(({ key, e, opacity, width: w }) => (
            <path key={key} d={curve(x(e.l), y(e.l, e.i), end(e.l + 1), y(e.l + 1, e.j))} fill="none" strokeDasharray="4 10"
              style={{ stroke: flow === "bwd" || e.w < 0 ? "var(--graph-neg, #8B4DFF)" : "var(--graph-pos, #20C8F5)", strokeWidth: w, strokeOpacity: opacity,
                animation: `em-dash ${(1.2 / speed).toFixed(2)}s linear infinite`, animationDirection: flow === "bwd" ? "reverse" : "normal" }} />
          ))}
        </g>
        {motion && <FlowLayer wave={wave} pathOf={pathOf} speed={speed} radius={mini ? 2 : 3.2} onStage={(id, at) => setStage({ id, at })} onEnd={onWaveEnd} />}
        {/* entradas desactivadas */}
        {inputs.map((input, f) => (input.active ? null : (
          <g key={`off${f}`} role="img" aria-label={`${input.label}: entrada desactivada`} opacity={0.5}>
            <circle cx={g.cols[0]} cy={yIn(f)} r={mini ? 2.5 : R - 2} fill="none" stroke="#8FA6C4" strokeDasharray="3 3" />
            {!mini && text("l", g.cols[0] - R - 8, yIn(f) - 1, input.label, { anchor: "end" })}
            {!mini && text("d", g.cols[0] - R - 8, yIn(f) + 11, "desactivada", { anchor: "end", italic: true })}
          </g>
        )))}
        {/* nodos (la salida se dibuja como medidor) */}
        {net.sizes.slice(0, -1).map((s, l) => Array.from({ length: s }, (_, n) => {
          const level = l <= reached && cache ? nodeLevel(net, cache, l, n) : 0;
          const sel = selected?.l === l && selected.n === n, hi = highlight?.l === l && highlight.n === n;
          const name = l === 0 ? inputs[rows[n]].label : "";
          const label = `${layerName(net, l)}, neurona ${n + 1}${name ? ` (${name})` : ""}${cache ? `, activación ${cache.a[l][n].toFixed(3)}` : ""}`;
          const toggle = () => { if (sel) { onSelect?.(null); onFocusNode?.(null); } else onSelect?.({ l, n }); };
          return (
            <g key={`n${l}-${n}`} {...(interactive ? {
              tabIndex: 0, role: "button", "aria-label": label, "aria-pressed": sel, onClick: toggle,
              onKeyDown: (ev: React.KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } },
              onFocus: (ev: React.FocusEvent<SVGGElement>) => { if (ev.currentTarget.matches(":focus-visible")) onFocusNode?.({ l, n }); },
              onBlur: () => onFocusNode?.(null),
            } : {})} className={interactive ? "cursor-pointer outline-none [&:focus-visible>circle]:stroke-white" : undefined}>
              <circle cx={x(l)} cy={y(l, n)} r={mini ? 3.6 : R} fill="#06152B" />
              <circle cx={x(l)} cy={y(l, n)} r={mini ? 3.6 : R} fill="#20C8F5" stroke={sel || hi ? "#fff" : "#20C8F5"} strokeWidth={sel || hi ? 2.5 : mini ? 1 : 1.4}
                style={{ fillOpacity: 0.14 + 0.86 * level, transition: motion ? "fill-opacity 350ms" : "none" }}>
                {!mini && <title>{label}</title>}
              </circle>
              {!mini && l === 0 && text("in", x(l) - R - 8, y(l, n) + 4, name, { anchor: "end", fill: "#C5D4E8" })}
            </g>
          );
        }))}
        {/* medidor de salida */}
        <g role="img" aria-label={trained ? `Probabilidad estimada: ${Math.round(shownP.current * 100)} por ciento` : "Sin probabilidad: la red no está entrenada"}>
          <circle cx={g.meter[0]} cy={g.meter[1]} r={meterR} fill="#06152B" stroke="#fff" strokeOpacity={0.12} strokeWidth={mini ? 5 : 7} />
          <circle cx={g.meter[0]} cy={g.meter[1]} r={meterR} fill="none" stroke="#00BFA6" strokeWidth={mini ? 5 : 7} strokeLinecap="round" transform={`rotate(-90 ${g.meter[0]} ${g.meter[1]})`}
            strokeDasharray={circumference} style={{ strokeDashoffset: circumference * (1 - shownP.current), transition: motion ? "stroke-dashoffset 600ms ease-out" : "none" }} />
          {text("pct", g.meter[0], g.meter[1] + (mini ? 4 : 6), trained ? `${Math.round(shownP.current * 100)}%` : "—", { size: mini ? 11 : 18, weight: 500, fill: "#fff" })}
        </g>
        {!mini && (g.compact ? (
          <g>{text("c1", g.W / 2, 340, "Probabilidad de completar en 30 días", { fill: "#E6EEF8" })}{text("c2", g.W / 2, 358, "Estimación, no certeza")}</g>
        ) : (
          <g>{text("c1", g.meter[0], 232, "Probabilidad de completar", { fill: "#E6EEF8" })}{text("c2", g.meter[0], 246, "en 30 días", { fill: "#E6EEF8" })}{text("c3", g.meter[0], 264, "Estimación, no certeza")}</g>
        ))}
      </svg>
    </div>
  );
}
