// Superadministrador: ficha del modelo del laboratorio y registro (informativo) de una versión de referencia.
import { useState } from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Btn from "../components/ui/Btn";
import { useActionNotice } from "../components/ui/useActionNotice";
import { useStore } from "../store/Store";
import { DATASET_NAME, FEATURES } from "./dataset";
import type { Dataset } from "./dataset";
import type { Metrics } from "./engine";
import { useSession } from "./session";
import type { LabConfig } from "./session";
import { activeIdx, archLabel } from "./useTrainer";

const f3 = (v: number) => v.toFixed(3);
const LIMITS = [
  "Datos sintéticos: no se ha validado con estudiantes reales.",
  "No es el modelo de producción (GRU multitarea, descrito y no entrenado aquí).",
  "No soportado: decidir notas, sanciones, admisiones o certificados.",
  "No soportado: cursos o perfiles sin actividad registrada, ni valores fuera de los rangos de los deslizadores.",
  "No infiere emociones, cansancio ni motivación; no explica causas.",
];

interface Props { ds: Dataset; config: LabConfig; metrics: Metrics | null; epoch: number; params: number }

function ModelSheet({ ds, config, metrics, epoch, params }: Props) {
  const trained = epoch > 0 && !!metrics;
  const rows: [string, string][] = [
    ["Arquitectura", `${archLabel(config)} · ${params} parámetros`],
    ["Estado", trained ? `entrenada · ${epoch} épocas` : "sin entrenar"],
    ["Dataset", DATASET_NAME],
    ["División temporal", `periodos 1-4 entrenamiento (${ds.split.train.length}) · 5 validación (${ds.split.val.length}) · 6 prueba (${ds.split.test.length})`],
    ["Fecha de corte", "final del periodo 4 (los datos sintéticos no tienen fechas reales)"],
    ["Semilla", String(config.seed)],
    ["Variables de entrada", activeIdx(config).map((i) => FEATURES[i].label).join(", ")],
    ["AUC (validación)", trained ? f3(metrics.auc) : "sin entrenar"],
    ["F1 (validación)", trained ? f3(metrics.f1) : "sin entrenar"],
    ["Brier (validación)", trained ? f3(metrics.brier) : "sin entrenar"],
  ];
  return (
    <Card title="Ficha del modelo del laboratorio" right={<Badge tone="demo">DEMO</Badge>}>
      <dl className="m-0 space-y-2 text-[12px]">
        {rows.map(([k, v]) => <div key={k} className="flex flex-wrap gap-x-3"><dt className="w-32 shrink-0 text-em-muted">{k}</dt><dd className="m-0 min-w-0 flex-1 break-words text-em-text">{v}</dd></div>)}
      </dl>
      <div className="mt-4 text-[12px] text-em-muted">Limitaciones y escenarios no soportados</div>
      <ul className="m-0 mt-1 list-disc space-y-1 pl-4 text-[12px] text-em-text">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
    </Card>
  );
}

function ReferenceVersion() {
  const { db, can } = useStore();
  const { experiments } = useSession();
  const { run, notice } = useActionNotice();
  const [confirming, setConfirming] = useState(false);
  const last = experiments[0];
  const already = !!last && db.modelVersions.some((v) => v.experimentAt === last.at);
  const register = () => {
    if (!last) return;
    run({ t: "model.register", experimentAt: last.at, label: last.version, arch: last.arch, auc: last.auc, f1: last.f1, brier: last.brier, testAuc: last.testAuc });
    setConfirming(false);
  };
  return (
    <Card title="Versión de referencia" right={<Badge tone="demo">DEMO</Badge>}>
      {last ? <p className="m-0 text-[13px] text-em-text">Último experimento evaluado: <span className="font-semibold">{last.version}</span> · {last.arch} · AUC val. {f3(last.auc)}{last.testAuc !== null && ` · prueba ${f3(last.testAuc)}`}</p>
        : <p className="m-0 text-[13px] text-em-muted">Aún no hay experimentos. Entrena y pulsa «Guardar como versión demo».</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!confirming ? <Btn disabled={!last || already || !can("ml.approve")} onClick={() => setConfirming(true)}>{already ? "Ya registrada" : "Registrar como versión de referencia"}</Btn> : (
          <>
            <span className="text-[13px] text-amber-300">¿Registrar {last?.version} como referencia?</span>
            <Btn onClick={register}>Confirmar</Btn>
            <Btn variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Btn>
          </>
        )}
      </div>
      {db.modelVersions.length > 0 && (
        <ul className="m-0 mt-4 list-none divide-y divide-white/5 p-0 text-[12px]">
          {db.modelVersions.slice(0, 4).map((v) => (
            <li key={v.id} className="py-2">
              <div className="text-em-text">{v.label} · {v.arch}</div>
              <div className="text-em-muted">AUC {f3(v.auc)} · F1 {f3(v.f1)} · Brier {f3(v.brier)}{v.testAuc !== null && ` · prueba ${f3(v.testAuc)}`}</div>
              <div className="text-em-muted">{v.id} · {new Date(v.at).toLocaleString("es-PE")} · {v.author}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-3 text-[12px] text-em-muted">Registro informativo. El motor del tutor usa reglas y todavía no utiliza esta red.</p>
      {notice}
    </Card>
  );
}

export default function AuditCards(props: Props) {
  return (
    <div className="[display:grid] grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <ModelSheet {...props} />
      <ReferenceVersion />
    </div>
  );
}
