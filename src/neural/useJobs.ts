import { useCallback, useEffect, useRef, useState } from "react";
import type { Dataset } from "./dataset";
import { Run, SEEDS } from "./experiments";
import type { ExpRow } from "./experiments";

export interface Job { id: string; title: string; question: string; rows: ExpRow[]; ref: number }  // ref = fila de referencia
export interface RowResult { aucs: number[]; trainLoss: number[]; valLoss: number[]; bestEpoch: number[]; diverged: number }
export interface JobState { job: Job; results: RowResult[]; progress: number; running: boolean; cancelled: boolean; seconds: number; eta: number | null }

const SLICE_MS = 12;      // cada tanda empieza épocas nuevas solo durante ~12 ms y luego cede el control al navegador
const METRICS_EVERY = 5;  // AUC/F1/Brier cada 5 épocas y al final; la pérdida de validación se mide siempre

/** Entrena varias configuraciones × 5 semillas sin bloquear la interfaz y mide el tiempo real empleado. */
export function useJobs(ds: Dataset) {
  const [state, setState] = useState<JobState | null>(null);
  const [durations, setDurations] = useState<Record<string, { title: string; seconds: number }>>({});
  const timer = useRef<number | null>(null);
  const stop = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const start = useCallback((job: Job) => {
    stop();
    const queue = job.rows.flatMap((r, row) => SEEDS.map((seed) => ({ row, spec: { ...r.spec, seed } })));
    const results: RowResult[] = job.rows.map(() => ({ aucs: [], trainLoss: [], valLoss: [], bestEpoch: [], diverged: 0 }));
    const t0 = performance.now();
    let i = 0, run: Run | null = null, doneEpochs = 0;
    const publish = (running: boolean) => {
      const seconds = (performance.now() - t0) / 1000;
      const typical = i > 0 ? doneEpochs / i : queue[0].spec.maxEpochs;           // épocas típicas por entrenamiento
      const units = i + (run ? Math.min(0.95, run.epoch / typical) : 0);
      setState({
        job, running, cancelled: false, seconds,
        eta: running && units >= 0.5 ? (seconds / units) * (queue.length - units) : null,
        progress: units / queue.length,
        results: results.map((r) => ({ ...r, aucs: [...r.aucs], trainLoss: [...r.trainLoss], valLoss: [...r.valLoss], bestEpoch: [...r.bestEpoch] })),
      });
      if (!running) setDurations((d) => ({ ...d, [job.id]: { title: job.title, seconds } }));
    };
    const tick = () => {
      const begin = performance.now();
      while (i < queue.length && performance.now() - begin < SLICE_MS) {
        if (!run) { run = new Run(ds, queue[i].spec, METRICS_EVERY); continue; }
        run.step();
        if (run.done) {
          const out = results[queue[i].row];
          if (run.error || !run.last) out.diverged++;
          else { out.aucs.push(run.last.m.auc); out.trainLoss.push(run.last.trainLoss); out.valLoss.push(run.last.valLoss); out.bestEpoch.push(run.bestEpoch); }
          doneEpochs += run.epoch; run = null; i++;
        }
      }
      publish(i < queue.length);
      if (i < queue.length) timer.current = window.setTimeout(tick, 0);
    };
    publish(true);
    timer.current = window.setTimeout(tick, 0);
  }, [ds]);

  const cancel = useCallback(() => { stop(); setState((s) => (s ? { ...s, running: false, cancelled: true, eta: null } : s)); }, []);
  return { state, durations, start, cancel };
}
