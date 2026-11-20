import { DATA_SOURCE } from "../data/db";
export default function KpiCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card kpi" title={`Fuente: ${DATA_SOURCE}`}>
      <span className="muted">{label}</span>
      <strong>{value.toLocaleString("es-PE")}</strong>
      <span className="muted small">{hint}</span>
    </div>
  );
}
