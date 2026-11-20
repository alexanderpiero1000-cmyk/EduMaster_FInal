import { useState } from "react";
import type { ReactElement } from "react";
import { neuralLayers } from "../data/db";

// Estados definidos en el manual (sección 10.4)
type NState = "Detenido" | "Inferencia activa" | "Entrenando";
const W = 640, H = 260, PAD_X = 70;

export default function NeuralNetworkCanvas() {
  const [state, setState] = useState<NState>("Detenido");
  const [selected, setSelected] = useState<number | null>(null);

  const cols = neuralLayers.length;
  const x = (l: number) => PAD_X + (l * (W - PAD_X * 2)) / (cols - 1);
  const y = (n: number, count: number) => 30 + (n * (H - 60)) / (count - 1);
  const animCls = state === "Inferencia activa" ? "flow fwd" : state === "Entrenando" ? "flow bwd" : "";

  const edges: ReactElement[] = [];
  for (let l = 0; l < cols - 1; l++)
    neuralLayers[l].nodes.forEach((_, i) =>
      neuralLayers[l + 1].nodes.forEach((_, j) =>
        edges.push(
          <line key={`${l}-${i}-${j}`} className={animCls}
            x1={x(l)} y1={y(i, 6)} x2={x(l + 1)} y2={y(j, 6)} />
        )));

  return (
    <section className="card neural">
      <div className="card-head">
        <h2>Arquitectura de Aprendizaje Inteligente</h2>
        <span className={state === "Detenido" ? "badge off" : "badge live"}>{state}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label="Red neuronal: entrada, embedding, temporal, fusión y salida">
        <g className="edges">{edges}</g>
        {neuralLayers.map((layer, l) =>
          layer.nodes.map((label, n) => (
            <g key={`${l}-${n}`}>
              <circle cx={x(l)} cy={y(n, 6)} r={7}
                className={`node l${l} ${selected === l ? "sel" : ""}`}
                onClick={() => setSelected(l)} />
              {label && (
                <text x={l === 0 ? x(l) - 14 : x(l) + 14} y={y(n, 6) + 3.5}
                      textAnchor={l === 0 ? "end" : "start"}>{label}</text>
              )}
            </g>
          )))}
      </svg>
      <div className="neural-foot">
        <div className="controls">
          <button onClick={() => setState("Inferencia activa")}>Iniciar inferencia</button>
          <button onClick={() => setState("Entrenando")}>Entrenar (demo)</button>
          <button onClick={() => setState("Detenido")}>Pausar</button>
        </div>
        <p className="muted">
          {selected !== null
            ? `${neuralLayers[selected].name}: ${neuralLayers[selected].detail}.`
            : "Haz clic en una neurona para inspeccionar su capa."}
          {" "}Animación de muestra: no refleja un entrenamiento real.
        </p>
      </div>
    </section>
  );
}
