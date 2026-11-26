// Resumen de plataforma (Superadministrador). Todo se deriva de db; no actúa por nadie.
import KpiCard from "../KpiCard";
import TrendChart from "../TrendChart";
import NeuralNetworkCanvas from "../NeuralNetworkCanvas";
import Card from "./Card";
import Badge from "./Badge";
import { useReady } from "./useReady";
import type { KpiData, Trend } from "./summary";
import { overdueSubmissions, SIM_MINUTE_MS, SLA_SIM_MINUTES } from "../../data/sla";
import { course, student } from "../../data/selectors";
import type { DB } from "../../data/db";
import { useStore, useUser } from "../../store/Store";

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE");

/** Personas distintas con actividad hoy: estudiantes (actividad registrada) y cuentas que iniciaron sesión. */
function activeToday(db: DB): number {
  const today = new Date().toDateString(), isToday = (iso: string) => new Date(iso).toDateString() === today;
  const ids = new Set<string>();
  db.audit.filter((a) => isToday(a.at)).forEach((a) => { if (a.s) ids.add(a.s); else if (a.type.startsWith("auth.") && a.by && a.by !== "anónimo") ids.add(a.by); });
  db.learningEvents.filter((e) => isToday(e.at)).forEach((e) => ids.add(e.studentId));
  return ids.size;
}

function auditTrend(db: DB, windowMs = 60e3, count = 18): Trend {
  const last = Math.floor(Date.now() / windowMs) * windowMs;
  const starts = Array.from({ length: count }, (_, i) => last - (count - 1 - i) * windowMs);
  const bin = (match: (t: string) => boolean) => {
    const times = db.audit.filter((a) => match(a.type)).map((a) => Date.parse(a.at));
    return starts.map((s) => times.filter((t) => t >= s && t < s + windowMs).length);
  };
  const series = [
    { name: "Aprendizaje", color: "#20C8F5", values: bin((t) => t.startsWith("learning.") || t.startsWith("course.completed") || t.startsWith("enrollment.")) },
    { name: "Evaluaciones y certificados", color: "#00BFA6", values: bin((t) => t.startsWith("assessment.") || t.startsWith("certificate.")) },
    { name: "Accesos denegados", color: "#8B4DFF", values: bin((t) => t === "access.denied") },
  ];
  const total = series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0);
  return { starts, windowMs, series, total, collecting: total < 3 };
}

function Rows({ items, empty }: { items: { id: string; text: string; right: string }[]; empty: string }) {
  if (!items.length) return <p className="m-0 text-[13px] text-em-muted">{empty}</p>;
  return (
    <ul className="m-0 list-none divide-y divide-white/5 p-0">
      {items.map((x) => <li key={x.id} className="flex items-center gap-3 py-2.5"><span className="min-w-0 flex-1 truncate text-[13px] text-em-text" title={x.text}>{x.text}</span><span className="shrink-0 text-[11px] tabular-nums text-em-muted">{x.right}</span></li>)}
    </ul>
  );
}

export default function AdminOverview() {
  const { db } = useStore();
  const user = useUser();
  const ready = useReady();
  const pending = db.submissions.filter((x) => x.status === "pendiente").length;
  const certs = db.certs.filter((c) => c.status === "emitido");
  const denied = db.audit.filter((a) => a.type === "access.denied");
  const late = overdueSubmissions(db);
  const kpis: KpiData[] = [
    { id: "users", label: "Usuarios activos hoy", value: String(activeToday(db)), delta: null, formula: "Estudiantes distintos con actividad registrada hoy más cuentas que iniciaron sesión hoy (según el registro reciente en memoria)." },
    { id: "enr", label: "Matrículas", value: String(db.enrollments.length), delta: null, formula: "Registros de la tabla enrollments." },
    { id: "pend", label: "Entregas pendientes de calificación", value: String(pending), delta: null, formula: "db.submissions con estado «pendiente»." },
    { id: "certs", label: "Certificados emitidos", value: String(certs.length), delta: null, formula: "Certificados con estado «emitido»." },
  ];
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 font-sans">
      <header className="min-w-0">
        <h1 className="m-0 truncate text-[22px]! font-semibold! leading-7!">{user.name} · estado de la plataforma</h1>
        <p className="m-0 mt-1 text-[12px] text-em-muted">Datos en vivo · actualizado {time(db.audit[0].at)} · Simulación DEMO</p>
      </header>
      <div className="[display:grid] grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k, i) => <KpiCard key={k.id} kpi={ready ? k : null} source="Simulación · DEMO" tipAlign={i % 2 === 0 ? "left" : "right"} />)}
      </div>
      <div className="[display:grid] grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8"><TrendChart trend={auditTrend(db)} loading={!ready} title="Actividad de la plataforma" /></div>
        <Card title="Alertas" className="lg:col-span-4">
          <div className="space-y-5">
            <div>
              <div className="mb-1 flex items-center justify-between text-[13px]"><span>Accesos denegados</span><Badge tone={denied.length ? "err" : "ok"}>{denied.length}</Badge></div>
              <Rows items={denied.slice(0, 3).map((a) => ({ id: a.id, text: a.text, right: time(a.at) }))} empty="Sin rechazos recientes." />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[13px]"><span>Sin calificar &gt; {SLA_SIM_MINUTES} min simulados</span><Badge tone={late.length ? "warn" : "ok"}>{late.length}</Badge></div>
              <Rows items={late.slice(0, 3).map((x) => ({ id: x.id, text: `${student(x.studentId).name} · ${course(x.courseId).title}`, right: time(x.at) }))} empty="Ninguna fuera de plazo." />
              <p className="m-0 mt-1 text-[11px] text-em-muted">1 minuto simulado = {SIM_MINUTE_MS / 1000} s reales.</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[13px]"><span>Certificados emitidos</span><Badge tone="ok">{certs.length}</Badge></div>
              <Rows items={certs.slice(-3).reverse().map((c) => ({ id: c.folio, text: `${c.folio} · ${student(c.studentId).name}`, right: time(c.issuedAt) }))} empty="Aún no hay certificados." />
            </div>
          </div>
        </Card>
        <Card title="Actividad reciente de la plataforma" className="lg:col-span-12">
          <Rows items={db.audit.slice(0, 8).map((a) => ({ id: a.id, text: a.text, right: time(a.at) }))} empty="Sin actividad." />
        </Card>
      </div>
      <NeuralNetworkCanvas loading={!ready} />
    </div>
  );
}
