// Qué muestra el Laboratorio según el rol. Solo presentación: el entrenamiento es el mismo para todos.
import type { RoleId } from "../data/users";

export type LabMode = "aprende" | "interpreta" | "audita";

export const labMode = (role: RoleId): LabMode => (role === "docente" ? "interpreta" : role === "superadmin" ? "audita" : "aprende");

export interface LabFeatures {
  title: string;
  advanced: boolean; importance: boolean; repeatSeeds: boolean; testEval: boolean; history: boolean;
  saveVersion: boolean; absurdRate: boolean; experimentHelp: boolean; explain: boolean; audit: boolean;
}

const aprende: LabFeatures = {
  title: "Aprende cómo aprende una red",
  advanced: false, importance: false, repeatSeeds: false, testEval: false, history: false,
  saveVersion: false, absurdRate: false, experimentHelp: true, explain: false, audit: false,
};
const interpreta: LabFeatures = {
  title: "Interpreta y explica",
  advanced: true, importance: true, repeatSeeds: true, testEval: true, history: true,
  saveVersion: true, absurdRate: true, experimentHelp: false, explain: true, audit: false,
};
const FEATURES_BY_MODE: Record<LabMode, LabFeatures> = { aprende, interpreta, audita: { ...interpreta, title: "Audita el modelo", audit: true } };
export const labFeatures = (role: RoleId): LabFeatures => FEATURES_BY_MODE[labMode(role)];

/** Valores de prueba ilustrativos, en el orden de las variables del laboratorio. */
export const PROFILES: { name: string; values: number[] }[] = [
  { name: "Estudiante constante", values: [12, 0.75, 78, 0, 1, 0.75, 0.5] },
  { name: "Estudiante irregular", values: [5, 0.45, 62, 4, 9, 0.45, 0.5] },
  { name: "Estudiante recién llegado", values: [10, 0.1, 65, 0, 0, 0.2, 0.5] },
];

export const EXPERIMENT_HELP: Record<string, string> = {
  inputs: "Mira cómo cambia el AUC al dar más variables a la red. Fíjate en que más entradas no siempre es mejor, y en qué pasa con el ruido.",
  layers: "Compara una regla lineal, la misma con la interacción añadida y una red. La capa oculta intenta descubrir esa relación sola.",
  overfit: "Mira la pérdida de entrenamiento y la de validación. Si la primera baja y la segunda sube, la red está memorizando.",
};

export const HOW_TO_TELL = [
  "Sí se puede decir: con estos datos sintéticos, la red combinó variables de actividad mejor o peor que una regla simple, según el AUC medido.",
  "No se puede decir: que estas variables causen que alguien complete o abandone un curso.",
  "Sí se puede decir: una probabilidad es una estimación para conversar y ofrecer ayuda, no un diagnóstico ni una nota.",
  "No se puede decir: que esto describa a estudiantes reales, ni que la red perciba emociones, cansancio o motivación.",
];
