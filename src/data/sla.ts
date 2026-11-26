// Plazo de calificación en tiempo SIMULADO: la demo comprime el reloj para que la alerta se pueda ver.
import type { DB } from "./db";

export const SIM_MINUTE_MS = 6000;       // 1 minuto simulado = 6 segundos reales
export const SLA_SIM_MINUTES = 10;       // entrega sin calificar por más de 10 min simulados = 60 s reales
export const overdueSubmissions = (db: DB, now = Date.now()) =>
  db.submissions.filter((x) => x.status === "pendiente" && now - Date.parse(x.at) > SLA_SIM_MINUTES * SIM_MINUTE_MS);
