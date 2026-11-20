import { useState } from "react";
import type { ReactElement } from "react";
import { neuralLayers, neuralInputOutputMap } from "../data/db";

// Estados definidos en el manual (sección 10.4)
type NState = "Detenido" | "Inferencia activa" | "Entrenando";
const W = 640, H = 260, PAD_X = 70;

export default function NeuralNetworkCanvas() {
  const [state, setState] = useState<NState>("Detenido");
  const [selectedInput, setSelectedInput] = useState<number | null>(null);

  const cols = neuralLayers.length;
  const x = (l: number) => PAD_X + (l * (W - PAD_X * 2)) / (cols - 1);
  const y = (n: number, count: number) => 30 + (n * (H - 60)) / (count - 1);
  const selectedOutput = selectedInput === null
    ? null
    : neuralInputOutputMap.find((relation) => relation.input === selectedInput)?.output ?? null;

  const animCls = state === "Inferencia activa"
    ? "flow fwd"
    : state === "Entrenando"
      ? "flow bwd"
      : "";

  const edges: ReactElement[] = [];
  for (let l = 0; l < cols - 1; l++) {
    neuralLayers[l].nodes.forEach((_, i) => {
      neuralLayers[l + 1].nodes.forEach((_, j) => {
        const isInferencePath = state === "Inferencia activa"
          && selectedInput !== null
          && (
            // Solo se propaga desde la variable de entrada elegida.
            l === 0
              ? i === selectedInput
              // Las tres capas centrales conservan todas sus conexiones animadas.
              : l === 1 || l === 2
                ? true
                // Solo una neurona de salida recibe la inferencia final.
                : l === cols - 2
                  ? j === selectedOutput
                  : false
          );

        const isTrainingPath = state === "Entrenando";
        edges.push(
          <line
            key={`${l}-${i}-${j}`}
            className={isInferencePath || isTrainingPath ? animCls : ""}
            x1={x(l)} y1={y(i, 6)} x2={x(l + 1)} y2={y(j, 6)}
          />
        );
      });
    });
  }

  const selectInput = (nodeIndex: number) => {
    setSelectedInput(nodeIndex);
    if (state === "Inferencia activa") setState("Detenido");
  };

  const selectedRelation = selectedInput === null
    ? null
    : neuralInputOutputMap.find((relation) => relation.input === selectedInput);

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
          layer.nodes.map((label, n) => {
            const isSelectedInput = l === 0 && n === selectedInput;
            const isSelectedOutput = l === cols - 1 && n === selectedOutput;

            return (
              <g key={`${l}-${n}`}>
                <circle cx={x(l)} cy={y(n, 6)} r={7}
                  className={`node l${l} ${isSelectedInput || isSelectedOutput ? "sel" : ""}`}
                  onClick={l === 0 ? () => selectInput(n) : undefined}
                  role={l === 0 ? "button" : undefined}
                  tabIndex={l === 0 ? 0 : undefined}
                  aria-label={l === 0 ? `Seleccionar entrada: ${label}` : undefined}
                  aria-pressed={l === 0 ? isSelectedInput : undefined}
                  onKeyDown={l === 0 ? (event) => {
                    if (event.key === "Enter" || event.key === " ") selectInput(n);
                  } : undefined} />
                {label && (
                  <text x={l === 0 ? x(l) - 14 : x(l) + 14} y={y(n, 6) + 3.5}
                        textAnchor={l === 0 ? "end" : "start"}>{label}</text>
                )}
              </g>
            );
          }))
        }
      </svg>
      <div className="neural-foot">
        <div className="controls">
          <button
            onClick={() => setState("Inferencia activa")}
            disabled={selectedInput === null}>Iniciar inferencia</button>
          <button onClick={() => setState("Entrenando")}>Entrenar (demo)</button>
          <button onClick={() => setState("Detenido")}>Pausar</button>
        </div>
        <p className="muted">
          {selectedRelation
            ? `${neuralLayers[0].nodes[selectedInput!]} → ${neuralLayers[4].nodes[selectedOutput!]}. ${selectedRelation.reason}`
            : "Selecciona una sola variable de entrada para comenzar la inferencia."}
          {" "}Animación de muestra: no refleja un entrenamiento real.
        </p>
      </div>
    </section>
  );
}
