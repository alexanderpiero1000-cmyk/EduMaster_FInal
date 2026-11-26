// Un único bucle requestAnimationFrame que mueve un grupo fijo de puntos por las curvas reales (getPointAtLength).
// No provoca repintados de React por fotograma: solo avisa cuando el frente llega a una capa nueva.
import { useEffect, useRef } from "react";
import { linkKey, MAX_POINTS, TAIL } from "./flow";
import type { Wave } from "./flow";

interface Props {
  wave: Wave | null;
  pathOf: (key: string) => SVGPathElement | null;
  speed: number;
  radius?: number;
  onStage?: (waveId: number, stage: number) => void;   // capas alcanzadas por el frente (0 = entradas)
  onEnd?: (waveId: number) => void;
}

export default function FlowLayer({ wave, pathOf, speed, radius = 3.2, onStage, onEnd }: Props) {
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const live = useRef({ wave, pathOf, speed, onStage, onEnd, radius });
  live.current = { wave, pathOf, speed, onStage, onEnd, radius };

  useEffect(() => {
    const current = live.current.wave;
    if (!current) return;
    const total = current.layers.length;
    const lit = new Set<SVGPathElement>();
    let frame = 0, last = performance.now(), done = 0, stage = -1, avg = 16;
    const clear = () => {
      dots.current.forEach((d) => d?.setAttribute("opacity", "0"));
      lit.forEach((p) => { p.style.strokeOpacity = p.dataset.base ?? "0"; });
      lit.clear();
    };
    const loop = (now: number) => {
      const dt = now - last;
      avg = avg * 0.9 + dt * 0.1;
      if (avg > 24 && dt < 1000 / 30 - 1) { frame = requestAnimationFrame(loop); return; }   // equipo lento: 30 FPS
      last = now;
      if (document.visibilityState === "visible") done += (dt * live.current.speed) / current.layerMs;
      const reached = Math.min(total, Math.floor(done));
      if (reached !== stage) { stage = reached; live.current.onStage?.(current.id, stage); }
      clear();
      if (done >= total) { live.current.onEnd?.(current.id); return; }
      const step = Math.floor(done), u = done - step;
      const layer = current.kind === "fwd" ? step : total - 1 - step;
      let n = 0;
      for (const link of current.layers[layer] ?? []) {
        const path = live.current.pathOf(linkKey(link));
        if (!path) continue;
        const length = path.getTotalLength();
        path.style.strokeOpacity = "0.85"; lit.add(path);
        for (let k = 0; k < TAIL.length && n < MAX_POINTS; k++, n++) {
          const at = Math.max(0, u - k * 0.07);
          const pt = path.getPointAtLength(length * (current.kind === "fwd" ? at : 1 - at));
          const dot = dots.current[n];
          if (!dot) continue;
          dot.setAttribute("cx", String(pt.x)); dot.setAttribute("cy", String(pt.y));
          dot.setAttribute("r", String(live.current.radius * (1 - k * 0.18)));
          dot.setAttribute("fill", current.kind === "fwd" ? "#E6F9FF" : "#B58CFF");
          dot.setAttribute("opacity", String(TAIL[k]));
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); clear(); };
  }, [wave?.id]);

  return (
    <g pointerEvents="none" aria-hidden="true">
      {Array.from({ length: MAX_POINTS }, (_, i) => <circle key={i} ref={(el) => { dots.current[i] = el; }} r={0} opacity={0} />)}
    </g>
  );
}
