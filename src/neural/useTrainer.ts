import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/Store";
import { applyGrads, cloneNetwork, forward, metrics, outputOf, paramCount, predictAll } from "./engine";
import type { ForwardCache, Metrics } from "./engine";
import { designMatrix, FEATURES, getDataset, hasInteractionInputs, normalizeRow } from "./dataset";
import { baselineSpec, Run } from "./experiments";
import { getSession, modelKey, updateSession } from "./session";
import type { Experiment, LabConfig, TrainState } from "./session";

export interface EpochPoint { epoch: number; trainLoss: number; valLoss: number; baseValLoss: number }
export interface TrainError { message: string; correlationId: string }
export interface Inference { p: number; cache: ForwardCache; latencyMs: number }

const EPOCHS_PER_RUN = 300;
const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
export const activeIdx = (c: LabConfig) => c.active.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
export const archLabel = (c: LabConfig) => `${activeIdx(c).length} → ${[...c.hidden, 1].join(" → ")}${c.hidden.length ? ` · ${c.activation === "relu" ? "ReLU" : "tanh"}` : " · sin capas ocultas (baseline)"}`;
const cid = () => `ml-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function useTrainer() {
  const { act } = useStore();
  const ds = useMemo(getDataset, []);
  const [config, setConfigState] = useState<LabConfig>(() => getSession().config);
  // Red guardada de una visita anterior (solo si la configuración coincide).
  const [restored] = useState(() => { const s = getSession().saved; return s && modelKey(s.config) === modelKey(getSession().config) ? s : null; });
  const [state, setStateRaw] = useState<TrainState>(restored?.state === "Publicado" ? "Publicado" : "Detenido");
  const [, setTick] = useState(0);
  const [error, setError] = useState<TrainError | null>(null);
  const [testResult, setTestResult] = useState<{ auc: number; baselineAuc: number; interAuc: number | null; n: number } | null>(null);

  const build = useCallback((c: LabConfig) => ({
    run: new Run(ds, { active: activeIdx(c), hidden: c.hidden, activation: c.activation, lr: c.lr, l2: c.l2, patience: c.patience, maxEpochs: EPOCHS_PER_RUN, seed: c.seed }),
    base: new Run(ds, baselineSpec(activeIdx(c), c.seed)),
    inter: hasInteractionInputs(activeIdx(c)) ? new Run(ds, baselineSpec(activeIdx(c), c.seed, true)) : null,
  }), [ds]);

  const cfg = useRef(config); cfg.current = config;
  const st = useRef<TrainState>(restored?.state === "Publicado" ? "Publicado" : "Detenido");
  const models = useRef<{ run: Run; base: Run; inter: Run | null } | null>(null);
  const hist = useRef<EpochPoint[]>(restored?.history ?? []);
  if (!models.current) {
    const m = build(config);
    if (restored) {
      Object.assign(m.run, { net: cloneNetwork(restored.net), epoch: restored.epoch, bestEpoch: restored.bestEpoch, bestValLoss: restored.bestValLoss, stoppedEarly: restored.stoppedEarly, last: restored.last, current: restored.last, done: true });
      while (!m.base.done) m.base.step();               // los baselines son deterministas: se recalculan
      while (m.inter && !m.inter.done) m.inter.step();
    }
    models.current = m;
  }
  const timers = useRef<number[]>([]);
  const idleTimer = useRef<number | null>(null);

  const setState = useCallback((s: TrainState) => { st.current = s; setStateRaw(s); }, []);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; if (idleTimer.current !== null) clearTimeout(idleTimer.current); idleTimer.current = null; }, []);

  /** Guarda pesos, estado y semilla de la red entrenada (nunca una divergida o sin entrenar). */
  const persist = useCallback((s: TrainState) => {
    const { run } = models.current!;
    if (!run.last || run.epoch === 0 || run.error || s === "Error") return;
    updateSession({ saved: { config: cfg.current, seed: cfg.current.seed, state: s, at: new Date().toISOString(), net: cloneNetwork(run.net), epoch: run.epoch, bestEpoch: run.bestEpoch, bestValLoss: run.bestValLoss, stoppedEarly: run.stoppedEarly, history: hist.current, last: run.last } });
  }, []);

  const publishSummary = useCallback((s: TrainState) => {
    persist(s);
    const m = models.current!;
    updateSession({ summary: { state: s, epoch: m.run.epoch, auc: m.run.last?.m.auc ?? null, baselineAuc: m.base.last?.m.auc ?? null, arch: archLabel(cfg.current), at: new Date().toISOString() } });
  }, [persist]);

  const fail = useCallback((message: string) => {
    const e = { message, correlationId: cid() };
    setError(e); setState("Error");
    act({ t: "log", type: "model.training.failed", text: `Entrenamiento detenido (${message}) · correlation_id=${e.correlationId}` });
    publishSummary("Error"); bump();
  }, [act, bump, publishSummary, setState]);

  const finish = useCallback(() => {
    setState("Validando"); bump();
    later(() => {
      if (st.current !== "Validando") return;
      const { run, base, inter } = models.current!;
      while (!base.done) base.step();                       // los baselines siempre se entrenan hasta converger
      while (inter && !inter.done) inter.step();
      setState("Detenido");
      act({ t: "log", type: "model.training.completed", text: `Entrenamiento DEMO completado · ${archLabel(cfg.current)} · época ${run.epoch}${run.stoppedEarly ? ` (parada temprana, mejor época ${run.bestEpoch})` : ""} · AUC validación ${run.last ? run.last.m.auc.toFixed(3) : "n/d"}` });
      publishSummary("Detenido"); bump();
    }, 400);
  }, [act, bump, later, publishSummary, setState]);

  const runEpoch = useCallback((): boolean => {
    const { run, base, inter } = models.current!;
    if (run.done) return true;
    if (!run.step()) { fail(run.error!); return false; }
    for (let k = 0; k < 4 && !base.done; k++) base.step();
    for (let k = 0; k < 4 && inter && !inter.done; k++) inter.step();
    hist.current = [...hist.current, { epoch: run.epoch, trainLoss: run.current!.trainLoss, valLoss: run.current!.valLoss, baseValLoss: base.last!.valLoss }];
    return true;
  }, [fail]);

  // Bucle con requestAnimationFrame: velocidad en épocas/s (máx. 30).
  useEffect(() => {
    if (state !== "Entrenando") return;
    let id = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      acc += t - last; last = t;
      const period = 1000 / cfg.current.speed;
      let did = false;
      const start = performance.now();
      while (acc >= period && st.current === "Entrenando" && performance.now() - start < 20) {
        acc -= period;
        if (!runEpoch()) return;
        did = true;
        if (models.current!.run.done) { bump(); finish(); return; }
      }
      acc = Math.min(acc, period * 2);
      if (did) bump();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [state, runEpoch, bump, finish]);

  useEffect(() => () => {
    clearTimers();
    if (st.current === "Entrenando" || st.current === "Cargando datos" || st.current === "Validando") publishSummary("Detenido");
    else persist(st.current === "Publicado" ? "Publicado" : "Detenido");
  }, [clearTimers, persist, publishSummary]);

  const reset = useCallback((next?: LabConfig) => {
    clearTimers();
    models.current = build(next ?? cfg.current); hist.current = [];
    setError(null); setTestResult(null); setState("Detenido"); publishSummary("Detenido"); bump();
  }, [build, bump, clearTimers, publishSummary, setState]);

  const setConfig = useCallback((patch: Partial<LabConfig>) => {
    const next: LabConfig = { ...cfg.current, ...patch };
    next.hidden = next.hidden.slice(0, 3).map((n) => clampInt(n, 1, 8));
    if (!next.active.some(Boolean)) return;                       // mínimo una entrada activa
    next.lr = Math.min(100, Math.max(0.0001, next.lr));
    next.speed = clampInt(next.speed, 1, 30);
    next.l2 = Math.min(0.1, Math.max(0, next.l2));
    next.patience = clampInt(next.patience, 0, 100);
    cfg.current = next; setConfigState(next); updateSession({ config: next });
    // todo salvo la velocidad cambia el entrenamiento: se reinicia para que las cifras correspondan a la configuración visible
    if (Object.keys(patch).some((k) => k !== "speed")) reset(next); else bump();
  }, [bump, reset]);

  const train = useCallback(() => {
    if (st.current === "Entrenando" || st.current === "Cargando datos" || st.current === "Validando" || st.current === "Error") return;
    clearTimers();
    setState("Cargando datos"); publishSummary("Cargando datos"); bump();
    later(() => {
      const { run } = models.current!;
      if (run.done) run.extend(EPOCHS_PER_RUN);
      setTestResult(null);
      act({ t: "log", type: "model.training.started", text: `Entrenamiento DEMO iniciado · ${archLabel(cfg.current)} · tasa ${cfg.current.lr} · dataset sintético` });
      setState("Entrenando"); publishSummary("Entrenando"); bump();
    }, 300);
  }, [act, bump, clearTimers, later, publishSummary, setState]);

  const pause = useCallback(() => {
    if (st.current === "Entrenando" || st.current === "Cargando datos") { clearTimers(); setState("Detenido"); publishSummary("Detenido"); bump(); }
  }, [bump, clearTimers, publishSummary, setState]);

  const retry = useCallback(() => {
    const next = { ...cfg.current, lr: Math.min(cfg.current.lr, 0.05) };
    cfg.current = next; setConfigState(next); updateSession({ config: next });
    reset(next);
  }, [reset]);

  /** Botón de demostración: fija una tasa absurda y entrena para mostrar el estado Error. */
  const absurdRate = useCallback(() => {
    setConfig({ lr: 100, activation: "relu", hidden: [8, 6] });
    train();
  }, [setConfig, train]);

  const infer = useCallback((raw: number[]): Inference => {
    const t0 = performance.now();
    const cache = forward(models.current!.run.net, normalizeRow(ds, raw, activeIdx(cfg.current)));
    return { p: outputOf(cache), cache, latencyMs: performance.now() - t0 };
  }, [ds]);

  const touchInference = useCallback(() => {
    if (st.current !== "Detenido" && st.current !== "Publicado" && st.current !== "Inferencia activa") return;
    setState("Inferencia activa");
    if (idleTimer.current !== null) clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => { if (st.current === "Inferencia activa") { setState("Detenido"); bump(); } }, 1500);
  }, [bump, setState]);

  const record = useCallback((kind: "version" | "prueba", testAuc: number | null) => {
    const { run, base } = models.current!, c = cfg.current, m = run.last!.m;
    const n = getSession().experiments.length + 1;
    const e: Experiment = {
      id: `exp-${n}`, version: kind === "version" ? `demo-v${n}` : `prueba-${n}`, at: new Date().toISOString(),
      inputs: activeIdx(c).map((i) => FEATURES[i].key), arch: archLabel(c), lr: c.lr, epochs: run.epoch,
      valLoss: m.loss, auc: m.auc, f1: m.f1, brier: m.brier, recall: m.recall, params: paramCount(run.net),
      baselineAuc: base.last!.m.auc, testAuc, bestEpoch: run.bestEpoch, l2: c.l2, patience: c.patience,
    };
    updateSession({ experiments: [e, ...getSession().experiments] });
  }, [persist]);

  const publish = useCallback(() => {
    const { run, base, inter } = models.current!;
    if (!run.last) return;
    while (!base.done) base.step();
    while (inter && !inter.done) inter.step();
    record("version", null);
    setState("Publicado"); publishSummary("Publicado"); bump();
  }, [bump, publishSummary, record, setState]);

  /** El periodo 6 solo se usa aquí, y solo para reportar. */
  const evaluateTest = useCallback(() => {
    const { run, base, inter } = models.current!;
    if (!run.last || testResult) return;
    while (!base.done) base.step();
    while (inter && !inter.done) inter.step();
    const idx = activeIdx(cfg.current), te = designMatrix(ds, ds.split.test, idx);
    const interAuc = inter ? metrics(predictAll(inter.net, designMatrix(ds, ds.split.test, idx, true).X), te.y).auc : null;
    const result = { auc: metrics(predictAll(run.net, te.X), te.y).auc, baselineAuc: metrics(predictAll(base.net, te.X), te.y).auc, interAuc, n: te.y.length };
    setTestResult(result);
    updateSession({ testUses: getSession().testUses + 1 });
    record("prueba", result.auc);
    bump();
  }, [bump, ds, record, testResult]);

  const applyStep = useCallback((g: Parameters<typeof applyGrads>[1]) => {
    const { run } = models.current!;
    applyGrads(run.net, g, cfg.current.lr, 1);
    if (run.last) run.last = run.evaluate(run.last.trainLoss);
    persist("Detenido");
    setTestResult(null); bump();
  }, [bump]);

  const { run, base, inter } = models.current;
  const m: Metrics | null = run.last?.m ?? null;
  return {
    config, setConfig, state, error, retry, absurdRate,
    net: run.net, history: hist.current, epoch: run.epoch,
    bestEpoch: run.bestEpoch, stoppedEarly: run.stoppedEarly, baselineConverged: base.done && (!inter || inter.done),
    interMetrics: inter?.last?.m ?? null,
    metrics: m, baseMetrics: base.last?.m ?? null, params: paramCount(run.net), ds,
    testResult, evaluateTest,
    train, pause, reset: () => { updateSession({ saved: null }); reset(); }, infer, touchInference, publish, applyStep,
    restoredAt: restored?.at ?? null,
    busy: state === "Entrenando" || state === "Cargando datos" || state === "Validando",
  };
}
