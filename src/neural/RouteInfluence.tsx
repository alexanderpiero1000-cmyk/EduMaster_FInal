// Influencia por rutas (APROXIMACIÓN): solo usa |pesos|; ignora activaciones, signos y escalas.
import { backwardFlow, forwardFlow, layerName, routeIntensity } from "./NetworkGraph";
import type { Sel } from "./NetworkGraph";
import type { Network } from "./engine";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const shares = (a: number[]) => { const s = a.reduce((x, y) => x + y, 0) || 1; return a.map((v) => v / s); };

interface Row { layer: string; items: { name: string; share: number }[] }

/**
 * Para una entrada: por qué neuronas pasa su influencia hacia la salida en cada capa, y su peso frente a las demás entradas.
 * Para una neurona oculta o la salida: de qué entradas depende.
 */
export function influence(net: Network, sel: Sel, inputNames: string[]): { summary: string; rows: Row[]; strong: number; total: number } {
  const output: Sel = { l: net.sizes.length - 1, n: 0 };
  const route = [...routeIntensity(net, sel).values()];
  const strong = route.filter((v) => v >= 0.5).length, total = route.length;
  const top = (vals: number[], name: (n: number) => string) => shares(vals).map((share, n) => ({ name: name(n), share })).sort((a, b) => b.share - a.share);
  if (sel.l === 0) {
    const toOutput = backwardFlow(net, output);                                  // cuánto de cada nodo llega a la salida
    const fwd = forwardFlow(net, sel);
    const among = shares(toOutput[0])[sel.n];
    const rows: Row[] = [];
    for (let l = 1; l < net.sizes.length - 1; l++) rows.push({ layer: layerName(net, l), items: top(fwd[l].map((v, k) => v * toOutput[l][k]), (k) => `#${k + 1}`) });
    return { summary: `Esta entrada concentra el ${pct(among)} de las rutas que llegan a la salida (frente a las ${net.sizes[0]} entradas activas).`, rows, strong, total };
  }
  const back = backwardFlow(net, sel);
  const target = sel.l === output.l ? "la salida" : "esta neurona";
  return { summary: `De qué entradas depende ${target} según las rutas de pesos:`, rows: [{ layer: "Entradas", items: top(back[0], (n) => inputNames[n]) }], strong, total };
}

export default function RouteInfluence({ net, sel, inputNames }: { net: Network; sel: Sel; inputNames: string[] }) {
  const r = influence(net, sel, inputNames);
  return (
    <div className="mt-2 border-t border-white/10 pt-2 text-[12px]">
      <div className="text-em-text">{sel.l === 0 ? "Influencia sobre la salida" : "Influencia por entrada"} <span className="text-amber-300">(aproximación)</span></div>
      <p className="m-0 mt-1 text-em-muted">{r.summary}</p>
      {r.rows.length > 0 && (
        <table className="mt-2 w-full border-collapse text-left">
          <caption className="sr-only">Reparto porcentual de las rutas por capa, aproximado</caption>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.layer}>
                <th scope="row" className="w-20 py-1 pr-2 align-top font-normal text-em-muted">{row.layer}</th>
                <td className="py-1 text-em-text tabular-nums">{row.items.map((i) => `${i.name} ${pct(i.share)}`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 text-em-muted">Rutas fuertes (intensidad ≥ 0,5): {r.strong} de {r.total} enlaces.</div>
    </div>
  );
}
