import type { ReactNode } from "react";
import "../styles/tailwind.css"; // única importación de Tailwind (utilidades sin preflight)
import { useStore, useUser } from "../store/Store";
import { shownName, visibleAudit, visibleNotifs } from "../data/scope";
import AdminOverview from "../components/ui/AdminOverview";
import { best, completion, course, enrollment, probCompletion, progress, recommend, student } from "../data/selectors";
import KpiCard from "../components/KpiCard";
import TrendChart from "../components/TrendChart";
import CompletionDonut from "../components/CompletionDonut";
import NeuralNetworkCanvas from "../components/NeuralNetworkCanvas";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import type { BadgeTone } from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";
import InfoTip from "../components/ui/InfoTip";
import { useReady } from "../components/ui/useReady";
import { activity, enrollmentsOf, groupMastery, kpisFor, sessionScope, supportList, trendFor } from "../components/ui/summary";
import type { Kind, Scope, Signal } from "../components/ui/summary";

const SOURCE = "Simulación · DEMO";
const time = (t: number) => new Date(t).toLocaleTimeString("es-PE");
const KIND_DOT: Record<Kind, string> = { progress: "bg-em-cyan", attempt: "bg-em-blue", cert: "bg-em-teal", completed: "bg-em-teal", enrolled: "bg-em-blue", rec: "bg-em-violet", other: "bg-em-muted" };

/** Fila común de las listas: punto, texto principal truncado, detalle opcional y valor a la derecha. */
function Row({ dot, title, sub, right }: { dot: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <i className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-em-text" title={sub ? `${title} · ${sub}` : title}>{title}</div>
        {sub && <div className="truncate text-[12px] text-em-muted">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right text-[12px] text-em-muted">{right}</div>}
    </li>
  );
}
const List = ({ children }: { children: ReactNode }) => <ul className="m-0 list-none divide-y divide-white/5 p-0">{children}</ul>;
const Empty = ({ children }: { children: ReactNode }) => <p className="m-0 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-[13px] text-em-muted">{children}</p>;
const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div aria-hidden="true" className="space-y-4">{Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-2 w-2 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-3 w-12" /></div>)}</div>
);

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-1.5 w-full rounded-full bg-white/10">
      <div className="h-1.5 rounded-full bg-gradient-to-r from-em-blue to-em-cyan transition-[width] duration-200" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function ActivityCard({ loading, className }: { loading: boolean; className: string }) {
  const { db } = useStore();
  const rows = activity(visibleAudit(db, useUser())).slice(0, 6);
  return (
    <Card title="Actividad reciente" className={className}>
      {loading ? <ListSkeleton rows={6} /> : rows.length === 0 ? <Empty>Sin actividad reciente en este alcance.</Empty> : (
        <div aria-live="polite"><List>{rows.map((a) => <Row key={a.id} dot={KIND_DOT[a.kind]} title={a.text} right={<span className="tabular-nums">{time(a.at)}</span>} />)}</List></div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { role: account } = useUser();
  // El superadministrador tiene una vista propia; App vuelve a montar la vista al cambiar de cuenta.
  return account === "superadmin" ? <AdminOverview /> : <RoleDashboard />;
}

function RoleDashboard() {
  const { db } = useStore();
  const user = useUser();
  const ready = useReady();
  const sc = sessionScope(db, user);
  const role = sc.view;
  const kpis = ready ? kpisFor(db, sc) : null;
  const trend = trendFor(db, sc);
  const updatedAt = time(Date.parse(db.audit[0]?.at ?? new Date().toISOString()));
  const comp = (() => {
    if (sc.view === "general") return completion(db);
    const ens = enrollmentsOf(db, sc), n = ens.length || 1;
    const c = ens.filter((e) => e.done === course(e.courseId).lessons).length, z = ens.filter((e) => e.done === 0).length;
    const cp = Math.round((100 * c) / n), zp = Math.round((100 * z) / n);
    return { completed: cp, notStarted: zp, inProgress: 100 - cp - zp };
  })();
  const donutTitle = role === "estudiante" ? "Mi avance" : role === "docente" ? "Finalización en mis cursos" : "Estado de matrículas";

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 font-sans">
      <header className="min-w-0">
        <h1 className="m-0 truncate text-[22px]! font-semibold! leading-7!">{role === "estudiante" ? `Hola, ${user.name}` : role === "docente" ? `${user.name} · tus cursos` : "Resumen general"}</h1>
        <p className="m-0 mt-1 text-[12px] text-em-muted" aria-live="polite">Datos en vivo · actualizado {updatedAt} · Simulación DEMO</p>
      </header>

      <div className="[display:grid] grid-cols-2 gap-4 xl:grid-cols-4">
        {(kpis ?? [null, null, null, null]).map((k, i) => <KpiCard key={k?.id ?? i} kpi={k} source={SOURCE} tipAlign={i % 2 === 0 ? "left" : "right"} />)}
      </div>

      <div className="[display:grid] grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TrendChart trend={trend} loading={!ready} title={role === "estudiante" ? "Mi actividad en vivo" : "Actividad en vivo"} />
        </div>
        <Card title={donutTitle} className="lg:col-span-4">
          <CompletionDonut {...comp} loading={!ready} />
          {role === "estudiante" && ready && <CourseProgress sc={sc} />}
        </Card>

        {role === "estudiante" ? <NotificationsCard loading={!ready} /> : <ActivityCard loading={!ready} className="lg:col-span-7" />}
        {role === "estudiante" && <NextStep sc={sc} ready={ready} />}
        {role === "docente" && <SupportCard sc={sc} ready={ready} />}
        {role === "docente" && <MasteryCard sc={sc} ready={ready} />}
        {role === "docente" && <SelectedStudentCard sc={sc} ready={ready} />}
      </div>

      <NeuralNetworkCanvas loading={!ready} />
    </div>
  );
}

function NextStep({ sc, ready }: { sc: Scope; ready: boolean }) {
  const { db, sid } = useStore();
  const rec = recommend(db, sid).find((r) => db.recState[r.key] !== "descartada");
  const open = enrollmentsOf(db, sc).filter((e) => e.done < course(e.courseId).lessons).slice(0, 2);
  return (
    <Card title="Siguiente paso" className="lg:col-span-5" right={<InfoTip align="right" text="La nota oficial viene de tus evaluaciones. La estimación IA es una heurística DEMO de la probabilidad de completar el curso y nunca la sustituye." />}>
      {!ready ? <ListSkeleton rows={3} /> : !rec && open.length === 0 ? <Empty>Sin recomendaciones ni cursos en curso.</Empty> : (
        <List>
          {rec && <Row dot="bg-em-violet" title={`${rec.verb}: ${course(rec.courseId).title}`} sub={rec.reason} right={<Badge tone="ai">IA · DEMO</Badge>} />}
          {open.map((e) => { const b = best(db, sid, e.courseId); return (
            <Row key={e.courseId} dot="bg-em-cyan" title={course(e.courseId).title} sub={`${e.done} de ${course(e.courseId).lessons} lecciones`}
              right={<><div>Nota oficial <span className="font-semibold text-em-text">{b === null ? "—" : b}</span></div><div className="text-violet-300">Estimación IA · DEMO {Math.round(probCompletion(db, sid, e.courseId) * 100)}%</div></>} />); })}
        </List>
      )}
    </Card>
  );
}

const SIG: Record<Signal, { dot: string; tone: BadgeTone }> = { alta: { dot: "bg-amber-300", tone: "warn" }, media: { dot: "bg-em-cyan", tone: "live" }, baja: { dot: "bg-em-teal", tone: "ok" } };
function SupportCard({ sc, ready }: { sc: Scope; ready: boolean }) {
  const { db } = useStore();
  const user = useUser();
  const rows = supportList(db, sc).slice(0, 4).map((x) => ({ ...x, name: shownName(user, student(x.id)) }));
  return (
    <Card title="Estudiantes con señal de apoyo" className="lg:col-span-5" right={<InfoTip align="right" text="Estimación para ofrecer apoyo, nunca una sanción ni un diagnóstico. Usa el avance medio en tus cursos (menos de 35 %: alta; menos de 60 %: media)." />}>
      {!ready ? <ListSkeleton rows={4} /> : rows.length === 0 ? <Empty>No hay estudiantes matriculados en tus cursos.</Empty> : (
        <>
          <List>{rows.map((s) => <Row key={s.id} dot={SIG[s.signal].dot} title={s.name} sub={`Avance medio ${Math.round(s.avg * 100)}%`} right={<Badge tone={SIG[s.signal].tone}>Apoyo {s.signal}</Badge>} />)}</List>
          <p className="m-0 mt-4 text-[12px] text-em-muted">Es una estimación para ofrecer ayuda, nunca una sanción.</p>
        </>
      )}
    </Card>
  );
}

function MasteryCard({ sc, ready }: { sc: Scope; ready: boolean }) {
  const { db } = useStore();
  const gm = groupMastery(db, sc);
  return (
    <Card title="Dominio por habilidad del grupo" className="lg:col-span-7" right={<Badge tone="ai">Estimación IA · DEMO</Badge>}>
      {!ready ? <Skeleton className="h-16 w-full" /> : gm.length === 0 ? <Empty>Sin habilidades asociadas a tus cursos.</Empty> : (
        <ul className="m-0 [display:grid] list-none grid-cols-1 gap-y-4 p-0">
          {gm.map((g) => (
            <li key={g.id} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-[14px]"><span className="truncate text-em-text">{g.name}</span><span className="shrink-0 text-[12px] tabular-nums text-em-muted">{g.value === null ? "—" : `${g.value}%`} · {g.n} estudiantes</span></div>
              <Bar value={g.value ?? 0} label={`Dominio medio en ${g.name}`} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Estudiante elegido por el docente en «Ver estudiante» (sid), limitado a sus cursos. */
function SelectedStudentCard({ sc, ready }: { sc: Scope; ready: boolean }) {
  const { db, sid } = useStore();
  const user = useUser();
  const rows = sc.courseIds.filter((c) => enrollment(db, sid, c));
  return (
    <Card title={`Estudiante elegido · ${shownName(user, student(sid))}`} className="lg:col-span-5">
      {!ready ? <ListSkeleton rows={2} /> : rows.length === 0 ? <Empty>No está matriculado en tus cursos.</Empty> : (
        <List>
          {rows.map((c) => { const b = best(db, sid, c); const pend = db.submissions.some((x) => x.studentId === sid && x.courseId === c && x.status === "pendiente"); return (
            <Row key={c} dot={pend ? "bg-amber-300" : "bg-em-cyan"} title={course(c).title} sub={`Avance ${Math.round(progress(db, sid, c) * 100)}%${pend ? " · entrega por calificar" : ""}`}
              right={<><div>Nota oficial <span className="font-semibold text-em-text">{b === null ? "—" : b}</span></div><div className="text-violet-300">Estimación IA · DEMO {Math.round(probCompletion(db, sid, c) * 100)}%</div></>} />); })}
        </List>
      )}
    </Card>
  );
}

/** Avance por curso del estudiante. */
function CourseProgress({ sc }: { sc: Scope }) {
  const { db } = useStore();
  const rows = enrollmentsOf(db, sc).slice(0, 5);
  return (
    <ul className="m-0 mt-5 list-none space-y-3 border-t border-white/10 p-0 pt-4">
      {rows.map((e) => { const c = course(e.courseId), p = (e.done / c.lessons) * 100; return (
        <li key={c.id}><div className="mb-1 flex justify-between gap-2 text-[12px]"><span className="truncate text-em-text">{c.title}</span><span className="shrink-0 tabular-nums text-em-muted">{Math.round(p)}%</span></div><Bar value={p} label={`Avance en ${c.title}`} /></li>); })}
    </ul>
  );
}

/** Últimas notificaciones del estudiante (solo las suyas). */
function NotificationsCard({ loading }: { loading: boolean }) {
  const { db } = useStore();
  const rows = visibleNotifs(db, useUser()).slice(0, 5);
  return (
    <Card title="Mis últimas notificaciones" className="lg:col-span-7">
      {loading ? <ListSkeleton rows={5} /> : rows.length === 0 ? <Empty>Aún no tienes notificaciones.</Empty> : (
        <div aria-live="polite"><List>{rows.map((x) => <Row key={x.id} dot={x.read ? "bg-em-muted" : "bg-em-cyan"} title={x.text} right={<span className="tabular-nums">{time(Date.parse(x.at))}</span>} />)}</List></div>
      )}
    </Card>
  );
}
