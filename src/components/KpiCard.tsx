import Card from "./ui/Card";
import InfoTip from "./ui/InfoTip";
import Skeleton from "./ui/Skeleton";
import { FlashValue } from "./ui/Stat";
import type { KpiData } from "./ui/summary";

const chip = { up: "text-em-teal bg-em-teal/10", down: "text-amber-300 bg-amber-300/10", flat: "text-em-muted bg-white/5" } as const;
const arrow = { up: "▲", down: "▼", flat: "—" } as const;

/** KPI: nombre, cifra y chip de variación. Fórmula y fuente van en el tooltip (sin pie). */
export default function KpiCard({ kpi, source, tipAlign = "right" }: { kpi: KpiData | null; source: string; tipAlign?: "left" | "right" }) {
  return (
    <Card pad="p-4 sm:p-5" ariaLabel={kpi?.label ?? "Cargando indicador"} className="relative flex min-h-[128px] flex-col">
      {!kpi ? (
        <div aria-hidden="true" className="flex flex-1 flex-col gap-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-16" /><Skeleton className="mt-auto h-5 w-24 rounded-full" /></div>
      ) : (
        <>
          <InfoTip className="absolute right-3 top-3" align={tipAlign} text={`Fórmula: ${kpi.formula} Variación frente a hace 1 h. Fuente: ${source}.`} label={`Detalle de ${kpi.label}`} />
          <div className="truncate pr-6 text-[13px] text-em-muted" title={kpi.label}>{kpi.label}</div>
          <div aria-live="polite" className="mt-2 whitespace-nowrap text-[30px] font-semibold leading-9 tabular-nums text-white"><FlashValue value={kpi.value} /></div>
          <div className="mt-auto pt-3">
            <span title={kpi.delta ? "Variación frente a hace 1 h" : "No hay datos de un periodo comparable"} className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] leading-4 ${chip[kpi.delta?.dir ?? "flat"]}`}>
              <span aria-hidden="true">{arrow[kpi.delta?.dir ?? "flat"]}</span>
              <span className="truncate">{kpi.delta ? (kpi.delta.dir === "flat" ? kpi.delta.text : `${kpi.delta.text} · 1 h`) : "sin periodo previo"}</span>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
