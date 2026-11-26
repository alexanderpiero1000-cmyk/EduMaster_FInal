import { useState } from "react";
import { backward, bce, forward, outputOf, zeroGrads } from "./engine";
import type { Grads, Network } from "./engine";
import { FEATURES, normalizeRow } from "./dataset";
import type { Dataset } from "./dataset";
import Btn from "../components/ui/Btn";
import { layerName } from "./NetworkGraph";

interface Props {
  net: Network; ds: Dataset; active: number[]; lr: number; disabled: boolean;
  onApply: (g: Grads) => void;
}
const f = (v: number) => (v >= 0 ? " " : "") + v.toFixed(3);
const vec = (a: number[]) => `[${a.map(f).join(", ")} ]`;

/** Una sola muestra de validación: pasada hacia delante y luego hacia atrás, con los números a la vista. */
export default function StepByStep({ net, ds, active, lr, disabled, onApply }: Props) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"forward" | "backward">("forward");
  const row = ds.split.val[Math.min(i, ds.split.val.length - 1)];
  const x = normalizeRow(ds, row.raw, active);
  const cache = forward(net, x);
  const g = zeroGrads(net);
  backward(net, cache, row.y, g);
  const p = outputOf(cache);

  return (
    <div className="space-y-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-em-muted">Muestra de validación
          <input type="number" min={1} max={ds.split.val.length} value={i + 1} aria-label="Número de muestra"
            onChange={(e) => setI(Math.min(ds.split.val.length - 1, Math.max(0, Number(e.target.value) - 1)))} className="w-20!" />
        </label>
        <div role="group" aria-label="Fase" className="flex gap-2">
          <Btn variant={phase === "forward" ? "primary" : "ghost"} onClick={() => setPhase("forward")} aria-pressed={phase === "forward"}>1 · Hacia delante</Btn>
          <Btn variant={phase === "backward" ? "primary" : "ghost"} onClick={() => setPhase("backward")} aria-pressed={phase === "backward"}>2 · Hacia atrás</Btn>
        </div>
      </div>
      <p className="m-0 text-em-muted">Valores reales de la muestra: {active.map((j) => `${FEATURES[j].label} = ${row.raw[j]}`).join(" · ")}. Etiqueta real: <b className="text-em-text">{row.y ? "completó" : "no completó"}</b>.</p>
      <div className="overflow-x-auto rounded-xl border border-white/10 p-3 font-mono leading-relaxed text-em-text" aria-live="polite">
        {phase === "forward" ? (
          <>
            <div>entrada (z-score) = {vec(x)}</div>
            {net.layers.map((L, l) => (
              <div key={l} className="mt-2">
                <div className="text-em-cyan">{layerName(net, l + 1)} · z = W·a + b → a = {L.act === "relu" ? "ReLU" : L.act === "tanh" ? "tanh" : "σ"}(z)</div>
                <div>z = {vec(cache.z[l])}</div>
                <div>a = {vec(cache.a[l + 1])}</div>
              </div>
            ))}
            <div className="mt-2">probabilidad = <b className="text-em-teal">{(p * 100).toFixed(1)}%</b> · pérdida de esta muestra = {bce(p, row.y).toFixed(4)}</div>
          </>
        ) : (
          <>
            <div>error de salida = p − y = {f(p)} − {row.y} = <b className="text-violet-300">{f(p - row.y)}</b> <span className="text-em-muted">(sigmoide + entropía cruzada)</span></div>
            {[...net.layers.keys()].reverse().map((l) => (
              <div key={l} className="mt-2">
                <div className="text-violet-300">{layerName(net, l + 1)} · δ = error propagado</div>
                <div>δ = {vec(g.delta[l])}</div>
                <div>‖∂L/∂W‖ = {Math.sqrt(g.dW[l].flat().reduce((s, v) => s + v * v, 0)).toFixed(4)}</div>
              </div>
            ))}
            <div className="mt-2 text-em-muted">Cada peso se corrige: w ← w − {lr} · ∂L/∂w</div>
          </>
        )}
      </div>
      <Btn variant="ghost" disabled={disabled} onClick={() => onApply(g)} aria-label="Aplicar un paso de descenso con esta muestra">Aplicar un paso con esta muestra</Btn>
      {disabled && <span className="ml-2 text-em-muted">Pausa el entrenamiento para aplicar un paso manual.</span>}
    </div>
  );
}
