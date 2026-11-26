import { useEffect, useRef } from "react";
import { forward, outputOf } from "./engine";
import type { Network } from "./engine";
import { FEATURES, normalizeRow } from "./dataset";
import type { Dataset } from "./dataset";

const G = 32, S = 280;

interface Props {
  net: Network; ds: Dataset;
  active: number[];          // índices de variables activas (orden de entrada de la red)
  a: number; b: number;      // variables elegidas (índices globales, deben estar activas)
  rawValues: number[];       // valores actuales de los sliders para las demás variables
}

/** Frontera de decisión 2D: P(completa) variando dos entradas y fijando las demás con los sliders. */
export default function DecisionBoundary({ net, ds, active, a, b, rawValues }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const fa = FEATURES[a], fb = FEATURES[b];
    const img = ctx.createImageData(G, G);
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const raw = [...rawValues];
      raw[a] = fa.min + ((gx + 0.5) / G) * (fa.max - fa.min);
      raw[b] = fb.min + (1 - (gy + 0.5) / G) * (fb.max - fb.min);
      const p = outputOf(forward(net, normalizeRow(ds, raw, active)));
      const o = (gy * G + gx) * 4;
      // escala por intensidad: violeta (p bajo) ↔ cian (p alto), oscuro en 0,5
      const k = Math.abs(p - 0.5) * 2;
      img.data[o] = p >= 0.5 ? 6 + 20 * k : 6 + 120 * k; img.data[o + 1] = p >= 0.5 ? 21 + 180 * k : 21 + 50 * k; img.data[o + 2] = p >= 0.5 ? 43 + 200 * k : 43 + 200 * k; img.data[o + 3] = 255;
    }
    const off = document.createElement("canvas"); off.width = G; off.height = G;
    off.getContext("2d")?.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.clearRect(0, 0, S, S); ctx.drawImage(off, 0, 0, S, S);
    // puntos reales de validación
    for (const r of ds.split.val) {
      const cx = ((r.raw[a] - fa.min) / (fa.max - fa.min)) * S, cy = (1 - (r.raw[b] - fb.min) / (fb.max - fb.min)) * S;
      ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = r.y ? "#00BFA6" : "#FFC857"; ctx.fill(); ctx.strokeStyle = "#06152B"; ctx.lineWidth = 1; ctx.stroke();
    }
  });
  return (
    <figure className="m-0">
      <canvas ref={ref} width={S} height={S} role="img" aria-label={`Frontera de decisión: ${FEATURES[a].label} (horizontal) contra ${FEATURES[b].label} (vertical)`} className="h-auto w-full max-w-[300px] rounded-xl border border-white/10" />
      <figcaption className="mt-2 text-[11px] text-em-muted">
        Horizontal: {FEATURES[a].label} · Vertical: {FEATURES[b].label}. Cian: probabilidad alta de completar; violeta: baja. Puntos de validación: <span className="text-em-teal">completó</span> / <span className="text-amber-300">no completó</span>.
      </figcaption>
    </figure>
  );
}
