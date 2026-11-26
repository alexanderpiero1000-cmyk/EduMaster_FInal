import { useState } from "react";
import type { EpochPoint } from "./useTrainer";
import ChartState from "../components/ui/ChartState";

const W = 520, H = 200, L = 40, R = 10, T = 24, B = 28;

export default function LossChart({ data, bestEpoch = 0 }: { data: EpochPoint[]; bestEpoch?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxE = Math.max(10, data.length ? data[data.length - 1].epoch : 10);
  const vals = data.flatMap((d) => [d.trainLoss, d.valLoss]);
  const maxY = Math.max(0.8, Math.ceil(Math.min(Math.max(...vals, 0), 3) * 10) / 10);
  const px = (e: number) => L + (e / maxE) * (W - L - R);
  const py = (v: number) => T + (1 - Math.min(v, maxY) / maxY) * (H - T - B);
  const line = (f: (d: EpochPoint) => number) => data.map((d) => `${px(d.epoch).toFixed(1)},${py(f(d)).toFixed(1)}`).join(" ");
  const h = hover !== null ? data[hover] : null;
  return (
    <ChartState state={data.length === 0 ? "empty" : "ok"} empty="Pulsa Entrenar para ver cómo baja la pérdida.">
      <div>
        <div className="mb-2 flex flex-wrap gap-4 text-[12px] text-em-muted">
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-em-cyan" />Entrenamiento</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-em-violet" />Validación</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-em-muted" />Baseline (validación)</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curva de pérdida (entropía cruzada) por época. Última época ${data[data.length - 1]?.epoch ?? 0}.`}
          className="block h-auto w-full" onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const ep = ((e.clientX - r.left) / r.width * W - L) / (W - L - R) * maxE;
            setHover(Math.min(data.length - 1, Math.max(0, Math.round(ep) - 1)));
          }}>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={py(g * maxY)} y2={py(g * maxY)} stroke="rgba(143,166,196,.18)" />
              <text x={L - 6} y={py(g * maxY) + 3} textAnchor="end" fontSize={10} fill="#8FA6C4">{(g * maxY).toFixed(2)}</text>
            </g>
          ))}
          <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#8FA6C4">Época</text>
          <text x={4} y={10} fontSize={10} fill="#8FA6C4">Pérdida</text>
          <polyline fill="none" stroke="#8FA6C4" strokeWidth={1.5} strokeDasharray="4 4" points={line((d) => d.baseValLoss)} />
          <polyline fill="none" stroke="#8B4DFF" strokeWidth={2} points={line((d) => d.valLoss)} />
          <polyline fill="none" stroke="#20C8F5" strokeWidth={2} points={line((d) => d.trainLoss)} />
          {h && <line x1={px(h.epoch)} x2={px(h.epoch)} y1={T} y2={H - B} stroke="#fff" strokeOpacity={0.35} />}
          {bestEpoch > 0 && bestEpoch <= maxE && (
            <g>
              <line x1={px(bestEpoch)} x2={px(bestEpoch)} y1={T} y2={H - B} stroke="#00BFA6" strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={Math.min(px(bestEpoch) + 4, W - 90)} y={T + 10} fontSize={10} fill="#00BFA6">mejor época {bestEpoch}</text>
            </g>
          )}
        </svg>
        <p aria-live="polite" className="mt-1 min-h-4 text-[11px] text-em-muted">
          {h ? `Época ${h.epoch}: entrenamiento ${h.trainLoss.toFixed(3)} · validación ${h.valLoss.toFixed(3)} · baseline ${h.baseValLoss.toFixed(3)}` : "Pasa el cursor sobre la curva para ver los valores. Unidad: entropía cruzada binaria (menor es mejor)."}
        </p>
      </div>
    </ChartState>
  );
}
