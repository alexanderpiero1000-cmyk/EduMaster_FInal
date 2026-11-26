// Red de ejemplo: se entrena en segundo plano (por tandas) la primera vez, con la configuración por defecto,
// semilla fija y parada temprana, y se guarda en session.ts como cualquier red entrenada.
import { cloneNetwork } from "./engine";
import { getDataset } from "./dataset";
import { baselineSpec, Run } from "./experiments";
import { DEFAULT_CONFIG, getSession, modelKey, updateSession } from "./session";
import type { LabConfig, SavedModel } from "./session";

export const EXAMPLE_SEED = 11;
export const EXAMPLE_CONFIG: LabConfig = { ...DEFAULT_CONFIG, seed: EXAMPLE_SEED };
export const EXAMPLE_LABEL = `Red de ejemplo entrenada al abrir (semilla ${EXAMPLE_SEED})`;

let working = false;
const active = EXAMPLE_CONFIG.active.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);

/** Sigue siendo la red de ejemplo mientras no se haya vuelto a entrenar ni cambiado la configuración. */
export function isExample(saved: SavedModel | null): boolean {
  const e = getSession().example;
  return !!saved && !!e && saved.epoch === e.epoch && saved.last.valLoss === e.valLoss && saved.config.seed === EXAMPLE_SEED;
}

export function prepareExample(): void {
  if (working || getSession().saved) return;
  working = true;
  const ds = getDataset();
  const run = new Run(ds, { active, hidden: EXAMPLE_CONFIG.hidden, activation: EXAMPLE_CONFIG.activation, lr: EXAMPLE_CONFIG.lr, l2: 0, patience: 30, maxEpochs: 300, seed: EXAMPLE_SEED });
  const base = new Run(ds, baselineSpec(active, EXAMPLE_SEED));
  const history: SavedModel["history"] = [];
  const tick = () => {
    const start = performance.now();
    while (!run.done && performance.now() - start < 12) {
      run.step();
      if (!base.done) base.step();
      if (run.current && base.last) history.push({ epoch: run.epoch, trainLoss: run.current.trainLoss, valLoss: run.current.valLoss, baseValLoss: base.last.valLoss });
    }
    if (!run.done) { setTimeout(tick, 0); return; }
    while (!base.done) base.step();
    working = false;
    const s = getSession();
    if (s.saved || !run.last) { updateSession({ exampleTried: true }); return; }        // el usuario entrenó mientras tanto
    const saved: SavedModel = { config: EXAMPLE_CONFIG, seed: EXAMPLE_SEED, state: "Detenido", at: new Date().toISOString(), net: cloneNetwork(run.net), epoch: run.epoch, bestEpoch: run.bestEpoch, bestValLoss: run.bestValLoss, stoppedEarly: run.stoppedEarly, history, last: run.last };
    const untouched = modelKey(s.config) === modelKey(DEFAULT_CONFIG) || modelKey(s.config) === modelKey(EXAMPLE_CONFIG);
    updateSession({
      saved, exampleTried: true, example: { epoch: run.epoch, valLoss: run.last.valLoss },
      ...(untouched ? { config: { ...EXAMPLE_CONFIG, speed: s.config.speed }, summary: { state: "Detenido" as const, epoch: run.epoch, auc: run.last.m.auc, baselineAuc: base.last?.m.auc ?? null, arch: `${active.length} → ${[...EXAMPLE_CONFIG.hidden, 1].join(" → ")}`, at: saved.at } } : {}),
    });
  };
  setTimeout(tick, 0);
}
