// Pequeño almacén de módulo (NO es el Store de la app). Conserva solo lo que debe sobrevivir
// a cambiar de pestaña: configuración, experimentos guardados y el último hito medido para el Resumen.
// El entrenamiento época a época vive en useTrainer (estado local) y nunca pasa por aquí.
import { useSyncExternalStore } from "react";
import type { Activation, Metrics, Network } from "./engine";

export type TrainState = "Detenido" | "Cargando datos" | "Entrenando" | "Validando" | "Publicado" | "Inferencia activa" | "Error";

export interface LabConfig {
  active: boolean[];        // una por variable de entrada
  hidden: number[];         // neuronas por capa oculta (0 a 3 capas, 1 a 8 neuronas)
  activation: Activation;
  lr: number;
  speed: number;            // épocas por segundo
  seed: number;
  l2: number;               // decaimiento de pesos
  patience: number;         // early stopping: épocas sin mejorar (0 = desactivado)
}
export const DEFAULT_CONFIG: LabConfig = { active: [true, true, true, true, true, true, false], hidden: [8, 6], activation: "relu", lr: 0.05, speed: 12, seed: 1, l2: 0, patience: 30 };

export interface Experiment {
  id: string; version: string; at: string;
  inputs: string[]; arch: string; lr: number; epochs: number;
  valLoss: number; auc: number; f1: number; brier: number; recall: number; params: number;
  baselineAuc: number; testAuc: number | null; bestEpoch: number; l2: number; patience: number;
}
export interface Summary { state: TrainState; epoch: number; auc: number | null; baselineAuc: number | null; arch: string; at: string | null }

/** Última red entrenada (pesos incluidos) para no perderla al salir de la pestaña. Vive en memoria hasta recargar la página. */
export interface SavedModel {
  config: LabConfig; seed: number; state: TrainState; at: string;
  net: Network; epoch: number; bestEpoch: number; bestValLoss: number; stoppedEarly: boolean;
  history: { epoch: number; trainLoss: number; valLoss: number; baseValLoss: number }[];
  last: { trainLoss: number; valLoss: number; m: Metrics };
}

interface Session {
  config: LabConfig; experiments: Experiment[]; summary: Summary; requestedTab: "lab" | null; testUses: number; saved: SavedModel | null;
  example: { epoch: number; valLoss: number } | null;   // huella de la red de ejemplo, para rotularla
  exampleTried: boolean;                                // ya se preparó en esta sesión
}
let snap: Session = {
  config: DEFAULT_CONFIG, experiments: [], requestedTab: null, testUses: 0, saved: null,
  example: null, exampleTried: false,
  summary: { state: "Detenido", epoch: 0, auc: null, baselineAuc: null, arch: "", at: null },
};
const subs = new Set<() => void>();
export function updateSession(patch: Partial<Session>): void { snap = { ...snap, ...patch }; subs.forEach((f) => f()); }
export const getSession = () => snap;
export function useSession(): Session {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getSession, getSession);
}
/** Lo lee Tutor al montarse para abrir directamente la pestaña Laboratorio. */
export function consumeRequestedTab(): "lab" | null { const t = snap.requestedTab; if (t) snap = { ...snap, requestedTab: null }; return t; }

/** Solo se reutiliza la red guardada si la configuración que afecta al entrenamiento es la misma. */
export const modelKey = (c: LabConfig) => JSON.stringify([c.active, c.hidden, c.activation, c.seed, c.lr, c.l2, c.patience]);
