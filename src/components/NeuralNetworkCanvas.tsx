import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import Btn from "./ui/Btn";
import Skeleton from "./ui/Skeleton";
import { useReducedMotion } from "./ui/useReducedMotion";
import NetworkGraph from "../neural/NetworkGraph";
import { useSession, updateSession } from "../neural/session";
import type { SavedModel } from "../neural/session";
import { EXAMPLE_LABEL, isExample, prepareExample } from "../neural/example";
import { useDemoFlow } from "../neural/useMotion";
import { MINI_MS, MINI_PULSES_PER_LAYER } from "../neural/flow";
import { getDataset, N_FEATURES } from "../neural/dataset";

/** Miniatura en demostración: una muestra de validación cada 4 s, inferida con la red guardada. */
function MiniNet({ saved }: { saved: SavedModel }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  const active = saved.config.active.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
  // con movimiento reducido o pestaña oculta la miniatura se queda quieta (con una sola inferencia)
  const { sample } = useDemoFlow({ ds: getDataset(), net: saved.net, active, running: visible, periodMs: reduced ? 3600e3 : MINI_MS, perLayer: MINI_PULSES_PER_LAYER });
  const inputs = Array.from({ length: N_FEATURES }, (_, i) => ({ label: "", active: saved.config.active[i] }));
  return (
    <div ref={box} className="w-full max-w-[280px] shrink-0">
      <NetworkGraph mini net={saved.net} inputs={inputs} cache={sample?.cache ?? null} wave={sample?.wave ?? null} motion={!reduced} flow={visible ? "fwd" : null} />
      <p className="m-0 mt-1 text-[11px] text-em-muted">{sample ? <>Muestra sintética {sample.name} · {Math.round(sample.p * 100)}%</> : "Preparando muestra…"}</p>
    </div>
  );
}

/** Tarjeta compacta del laboratorio: miniatura en demostración, última métrica MEDIDA y acceso. */
export default function NeuralNetworkCanvas({ loading }: { loading?: boolean }) {
  const { summary, saved } = useSession();
  useEffect(() => { if (!loading && !saved) prepareExample(); }, [loading, saved]);

  // Navegación sin tocar App: se pide la pestaña y se pulsa el botón del menú lateral.
  const open = () => {
    updateSession({ requestedTab: "lab" });
    Array.from(document.querySelectorAll<HTMLButtonElement>("aside nav button")).find((b) => b.textContent?.trim() === "IA Tutor")?.click();
  };

  if (loading) {
    return (
      <Card ariaLabel="Cargando laboratorio"><div aria-hidden="true" className="flex flex-col gap-4 md:flex-row md:items-center">
        <Skeleton className="h-[100px] w-[232px] shrink-0" /><div className="flex-1 space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-1/3" /></div><Skeleton className="h-9 w-40" />
      </div></Card>
    );
  }
  return (
    <Card ariaLabel="Laboratorio de red neuronal">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        {saved ? <MiniNet key={saved.at} saved={saved} /> : <p role="status" className="m-0 w-full max-w-[280px] text-[13px] text-em-muted">Preparando una red de ejemplo…</p>}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-[14px] font-semibold text-white">Laboratorio de red neuronal</div>
          <Badge tone="demo">Demostración · muestras sintéticas</Badge>
          {isExample(saved) && <div className="text-[11px] text-em-muted">{EXAMPLE_LABEL}</div>}
          <div className="text-[13px] text-em-text">{summary.auc !== null ? <>AUC <span className="font-semibold tabular-nums">{summary.auc.toFixed(3)}</span> en validación sintética</> : "Sin métrica medida todavía"}</div>
        </div>
        <Btn onClick={open} aria-label="Abrir laboratorio de red neuronal" className="shrink-0">Abrir laboratorio</Btn>
      </div>
    </Card>
  );
}
