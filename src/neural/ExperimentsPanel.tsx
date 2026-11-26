import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Btn from "../components/ui/Btn";
import { baselineRow, ceilingStatement, compare, GUIDED, INTERACTION_NOTE, meanSd, pathCovered, SEEDS } from "./experiments";
import { useJobs } from "./useJobs";
import type { Job } from "./useJobs";
import { hasInteractionInputs, INTERACTION } from "./dataset";
import type { Dataset } from "./dataset";
import type { LabConfig } from "./session";
import { activeIdx, archLabel } from "./useTrainer";
import { EXPERIMENT_HELP } from "./roleMode";
import type { TrainError } from "./useTrainer";

interface Props {
  ds: Dataset; config: LabConfig; ceiling: number;
  error: TrainError | null; onAbsurd: () => void; onRetry: () => void;
  repeatSeeds: boolean; absurdRate: boolean; help: boolean;
}
const f3 = (v: number) => v.toFixed(3);
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
const td = "border-b border-white/5 px-2 py-2 align-top";

export default function ExperimentsPanel({ ds, config, ceiling, error, onAbsurd, onRetry, repeatSeeds, absurdRate, help }: Props) {
  const jobs = useJobs(ds);
  const s = jobs.state;
  const running = !!s?.running;
  const n = ds.split.val.length, pos = ds.split.val.filter((r) => r.y === 1).length, neg = n - pos;

  const repeat = () => {
    const active = activeIdx(config);
    const withInter = hasInteractionInputs(active);
    jobs.start({
      id: "seeds", title: "5 semillas · configuración actual", ref: 0,
      question: `Red ${archLabel(config)} frente a los baselines${withInter ? "" : ` (sin término de interacción: activa las dos variables de «${INTERACTION.label}»)`}`,
      rows: [
        baselineRow(active),
        ...(withInter ? [baselineRow(active, true)] : []),
        { label: "Red (configuración actual)", kind: "net", spec: { active, hidden: config.hidden, activation: config.activation, lr: config.lr, l2: config.l2, patience: config.patience, maxEpochs: 300 } },
      ],
    });
  };

  const summary = s?.results.map((r) => (r.aucs.length ? meanSd(r.aucs) : null)) ?? [];
  const refStat = s ? summary[s.job.ref] : null;
  const complete = !!s && !s.running && !s.cancelled;

  return (
    <Card title="Experimentos (5 semillas)" right={<Badge tone="demo">DEMO · datos sintéticos</Badge>}>
      <div className="flex flex-wrap gap-2">
        {repeatSeeds && <Btn onClick={repeat} disabled={running}>Repetir con 5 semillas</Btn>}
        {!help && GUIDED.map((g) => <Btn key={g.id} variant="ghost" disabled={running} onClick={() => jobs.start({ ...g, ref: 0 } satisfies Job)}>{g.title}</Btn>)}
        {absurdRate && <Btn variant="ghost" onClick={onAbsurd} aria-label="Entrenar con una tasa de aprendizaje absurda (100)">Tasa de aprendizaje absurda</Btn>}
      </div>

      {help && (
        <div className="mt-3 [display:grid] grid-cols-1 gap-3 md:grid-cols-3">
          {GUIDED.map((g) => (
            <div key={g.id} className="flex flex-col items-start gap-2 rounded-xl border border-white/10 p-3">
              <Btn variant="ghost" disabled={running} onClick={() => jobs.start({ ...g, ref: 0 } satisfies Job)}>{g.title}</Btn>
              <p className="m-0 text-[12px] text-em-muted">{EXPERIMENT_HELP[g.id]}</p>
            </div>
          ))}
        </div>
      )}

      {Object.keys(jobs.durations).length > 0 && (
        <p className="m-0 mt-3 text-[11px] text-em-muted">Tiempo medido en este equipo: {Object.values(jobs.durations).map((d) => `${d.title} ${d.seconds.toFixed(1)} s`).join(" · ")}</p>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-[13px]">
          Estado <span className="font-semibold text-red-300">Error</span>: {error.message}
          <div className="mt-1 text-[11px] text-em-muted">correlation_id: <code>{error.correlationId}</code></div>
          <Btn className="mt-2" onClick={onRetry}>Reintentar</Btn>
        </div>
      )}

      {!s ? <p className="m-0 mt-4 text-[13px] text-em-muted">Cada configuración se entrena con las semillas {SEEDS.join(", ")} y se informa media ± desviación del AUC de validación.</p> : (
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-[14px] text-white">{s.job.title}</div>
            <div className="text-[12px] text-em-muted">{s.job.question}</div>
          </div>
          {(s.running || s.cancelled) && (
            <div className="flex items-center gap-3">
              <div role="progressbar" aria-label="Progreso del experimento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)} className="h-2 flex-1 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-em-cyan" style={{ width: `${s.progress * 100}%` }} />
              </div>
              <span className="text-[12px] tabular-nums text-em-muted">{Math.round(s.progress * 100)}% · {s.seconds.toFixed(1)} s{s.running && (s.eta === null ? " · estimando…" : ` · quedan ~${Math.ceil(s.eta)} s (estimado)`)}</span>
              {s.running ? <Btn variant="ghost" onClick={jobs.cancel}>Cancelar</Btn> : <span className="text-[12px] text-amber-300">Cancelado</span>}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <caption className="sr-only">{s.job.title}</caption>
              <thead><tr className="text-em-muted">{["Configuración", "AUC val. (media ± desv.)", "Pérdida entren.", "Pérdida val.", "Mejor época", "Dif. vs referencia", "Lectura"].map((h) => <th key={h} scope="col" className="border-b border-white/10 px-2 py-2 font-normal">{h}</th>)}</tr></thead>
              <tbody>{s.job.rows.map((row, i) => {
                const r = s.results[i], a = summary[i];
                const full = r.aucs.length + r.diverged === SEEDS.length;
                const v = a && refStat && i !== s.job.ref && full && s.results[s.job.ref].aucs.length === SEEDS.length ? compare(a, refStat, pos, neg) : null;
                return (
                  <tr key={row.label} className="text-em-text">
                    <td className={td}>{row.label}{r.diverged > 0 && <div className="text-red-300">divergió en {r.diverged}/{SEEDS.length}</div>}</td>
                    <td className={`${td} tabular-nums`}>{a ? `${f3(a.mean)} ± ${f3(a.sd)}` : "—"}{!full && a && <span className="text-em-muted"> ({r.aucs.length}/{SEEDS.length})</span>}</td>
                    <td className={`${td} tabular-nums`}>{r.trainLoss.length ? f3(meanSd(r.trainLoss).mean) : "—"}</td>
                    <td className={`${td} tabular-nums`}>{r.valLoss.length ? f3(meanSd(r.valLoss).mean) : "—"}</td>
                    <td className={`${td} tabular-nums`}>{r.bestEpoch.length ? Math.round(meanSd(r.bestEpoch).mean) : "—"}</td>
                    <td className={`${td} tabular-nums`}>{i === s.job.ref ? "referencia" : v ? signed(v.diff) : "—"}</td>
                    <td className={`${td} ${v?.conclusive ? (v.diff > 0 ? "text-em-teal" : "text-amber-300") : "text-em-muted"}`}>{v ? v.text : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <p className="m-0 text-[11px] text-em-muted">
            Validación (periodo 5): n = {n}, positivos = {pos}. «No concluyente» si la diferencia es menor que 2 desviaciones entre semillas. Esa desviación no incluye el azar de la muestra: por eso también se contrasta con el error de Hanley-McNeil.
            {complete && ` Calculado en ${s.seconds.toFixed(1)} s.`}
          </p>
          {complete && (() => {
            const at = (k: "linear" | "inter" | "net") => { const i = s.job.rows.findIndex((r) => r.kind === k); return i < 0 ? null : summary[i]; };
            const lin = at("linear"), inter = at("inter"), red = at("net");
            if (!lin || !red) return null;
            const covered = pathCovered(red.mean, lin.mean, ceiling);
            const vs = inter ? compare(red, inter, pos, neg) : null;
            const cs = inter ? ceilingStatement(inter.mean, ceiling, pos, neg) : null;
            return (
              <div className="space-y-2 rounded-xl border border-white/10 p-3 text-[13px] text-em-text" aria-live="polite">
                {covered !== null && <p className="m-0">La red recorre el <span className="font-semibold text-em-teal">{Math.round(covered * 100)}%</span> del camino entre el baseline lineal ({f3(lin.mean)}) y el techo teórico ({f3(ceiling)}).</p>}
                {vs && cs && inter && (
                  <>
                    <p className="m-0">Red frente a baseline con interacción: {signed(vs.diff)} · {vs.text}.</p>
                    <p className="m-0">El baseline con interacción ({f3(inter.mean)}) {cs.within ? "queda dentro del error de muestra del techo teórico" : "no alcanza el techo teórico"}: le faltan {f3(cs.gap)} y el margen es ±{f3(cs.margin)}.</p>
                    <p className="m-0 text-[12px] text-em-muted">{INTERACTION_NOTE}</p>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </Card>
  );
}
