import type { ReactNode } from "react";
import Skeleton from "./Skeleton";

/** Estados comunes de un gráfico: carga, vacío, error. */
export default function ChartState({ state, empty = "Aún no hay datos.", error, children }: { state: "loading" | "empty" | "error" | "ok"; empty?: string; error?: string; children: ReactNode }) {
  if (state === "loading") return <Skeleton className="h-40 w-full" />;
  if (state === "empty") return <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-[13px] text-em-muted">{empty}</p>;
  if (state === "error") return <p role="alert" className="rounded-xl border border-red-400/40 p-6 text-center text-[13px] text-red-300">{error ?? "No se pudo mostrar el gráfico."}</p>;
  return <>{children}</>;
}
