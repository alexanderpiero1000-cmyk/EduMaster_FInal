// Cuándo hay movimiento: demostración con inferencias reales, retropropagación al entrenar y pausas por interacción.
import { useCallback, useEffect, useRef, useState } from "react";
import { forward, outputOf } from "./engine";
import type { ForwardCache, Network } from "./engine";
import { normalizeRow } from "./dataset";
import type { Dataset } from "./dataset";
import { BACKWARD_EVERY, BACKWARD_MIN_GAP, backwardPulses, demoOrder, forwardPulses, LAYER_MS, nextWaveId, sampleName } from "./flow";
import type { Wave } from "./flow";

export const RESUME_AFTER_MS = 10000;
const BACKWARD_LAYER_MS = 140;

export interface DemoSample { index: number; name: string; raw: number[]; y: number; cache: ForwardCache; p: number; wave: Wave }

interface DemoArgs { ds: Dataset; net: Network; active: number[]; running: boolean; periodMs: number; perLayer?: number }

/** Cada periodo toma la siguiente muestra de VALIDACIÓN (orden barajado con semilla) y calcula su inferencia real. */
export function useDemoFlow({ ds, net, active, running, periodMs, perLayer }: DemoArgs) {
  const [sample, setSample] = useState<DemoSample | null>(null);
  const order = useRef<number[] | null>(null);
  const next = useRef(0);
  const live = useRef({ net, active, perLayer });
  live.current = { net, active, perLayer };

  useEffect(() => {
    if (!running) return;
    order.current ??= demoOrder(ds.split.val.length);
    const show = () => {
      if (document.visibilityState !== "visible") return;
      const { net: n, active: a, perLayer: k } = live.current;
      if (n.sizes[0] !== a.length) return;
      const index = order.current![next.current++ % order.current!.length];
      const row = ds.split.val[index];
      const cache = forward(n, normalizeRow(ds, row.raw, a));
      setSample({ index, name: sampleName(index), raw: row.raw, y: row.y, cache, p: outputOf(cache), wave: { id: nextWaveId(), kind: "fwd", layers: forwardPulses(n, cache, k), layerMs: LAYER_MS } });
    };
    show();
    const id = window.setInterval(show, periodMs);
    return () => clearInterval(id);
  }, [running, periodMs, ds]);

  const clear = useCallback(() => setSample(null), []);
  return { sample, clear };
}

/** La demostración se aparta mientras el usuario actúa y vuelve 10 s después de la última interacción. */
export function useInteraction(blocked: boolean) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const stop = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  const release = useCallback(() => { stop(); timer.current = window.setTimeout(() => setHolding(false), RESUME_AFTER_MS); }, []);
  const touch = useCallback(() => { setHolding(true); release(); }, [release]);
  const wasBlocked = useRef(blocked);
  useEffect(() => {
    if (blocked) { stop(); setHolding(true); }
    else if (wasBlocked.current) release();
    wasBlocked.current = blocked;
  }, [blocked, release]);
  useEffect(() => stop, []);
  return { holding: holding || blocked, touch };
}

interface BackArgs { net: Network; ds: Dataset; active: number[]; epoch: number; training: boolean; enabled: boolean }

/** Onda violeta de derecha a izquierda: una vez cada 5 épocas y como mucho 4 por segundo. */
export function useBackwardWave({ net, ds, active, epoch, training, enabled }: BackArgs) {
  const [wave, setWave] = useState<Wave | null>(null);
  const last = useRef({ epoch: 0, at: 0, busyUntil: 0 });
  useEffect(() => {
    if (!training || !enabled) { setWave(null); return; }
    const now = performance.now();
    if (epoch < last.current.epoch) last.current = { epoch: 0, at: 0, busyUntil: 0 };
    if (epoch - last.current.epoch < BACKWARD_EVERY || now - last.current.at < BACKWARD_MIN_GAP || now < last.current.busyUntil) return;
    const layers = backwardPulses(net, ds, active);
    last.current = { epoch, at: now, busyUntil: now + layers.length * BACKWARD_LAYER_MS };
    setWave({ id: nextWaveId(), kind: "bwd", layers, layerMs: BACKWARD_LAYER_MS });
  }, [epoch, training, enabled]);
  return wave;
}
