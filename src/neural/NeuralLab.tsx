import { useEffect, useMemo, useRef, useState } from "react";
import { useBackwardWave, useDemoFlow, useInteraction } from "./useMotion";
import { DEMO_MS, forwardPulses, LAYER_MS, nextWaveId, REDUCED_MS } from "./flow";
import type { Wave } from "./flow";
import { EXAMPLE_LABEL, isExample, prepareExample } from "./example";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import type { BadgeTone } from "../components/ui/Badge";
import Btn from "../components/ui/Btn";
import Section from "../components/ui/Section";
import { FlashValue } from "../components/ui/Stat";
import { useReducedMotion } from "../components/ui/useReducedMotion";
import { DRIFT, FEATURES, INTERACTION, N_FEATURES, NOISE_INDEX } from "./dataset";
import { ceilingAuc, ceilingStatement, INTERACTION_NOTE, pathCovered, permutationImportance } from "./experiments";
import ExperimentsPanel from "./ExperimentsPanel";
import { useTrainer, activeIdx, archLabel } from "./useTrainer";
import { useSession } from "./session";
import type { TrainState } from "./session";
import NetworkGraph, { layerName, layerOp } from "./NetworkGraph";
import type { PathMode, Sel } from "./NetworkGraph";
import RouteInfluence from "./RouteInfluence";
import LossChart from "./LossChart";
import DecisionBoundary from "./DecisionBoundary";
import StepByStep from "./StepByStep";
import { useUser } from "../store/Store";
import { HOW_TO_TELL, labFeatures, PROFILES } from "./roleMode";
import AuditCards from "./AuditCards";

const SHORT = ["Días activos", "Avance", "Nota media", "Entregas tardías", "Días sin actividad", "Evidencia", "ruido_demo"];
const stateTone: Record<TrainState, BadgeTone> = { "Detenido": "neutral", "Cargando datos": "live", "Entrenando": "live", "Validando": "live", "Publicado": "ok", "Inferencia activa": "ai", "Error": "err" };
type LabTab = "red" | "res" | "exp" | "ajustes" | "ficha";
const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));
const fmtVal = (j: number, v: number) => (FEATURES[j].unit === "%" ? `${Math.round(v * 100)}%` : FEATURES[j].step < 1 ? v.toFixed(2) : String(v));

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5! w-9! shrink-0 rounded-full! border-0! p-0! transition-colors duration-150 focus-visible:outline-2! focus-visible:outline-em-cyan! focus-visible:outline-offset-2! ${on ? "bg-em-cyan!" : "bg-white/20!"}`}>
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-em-onaccent transition-transform duration-150 ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

/** La primera vez, prepara la red de ejemplo antes de montar el laboratorio (que así la carga como cualquier red guardada). */
export default function NeuralLab() {
  const { saved, exampleTried } = useSession();
  const preparing = !saved && !exampleTried;
  useEffect(() => { if (preparing) prepareExample(); }, [preparing]);
  if (preparing) {
    return (
      <Card ariaLabel="Preparando laboratorio">
        <p role="status" className="m-0 text-[14px] text-em-text">Preparando una red de ejemplo…</p>
        <p className="m-0 mt-1 text-[12px] text-em-muted">Se entrena en segundo plano con datos sintéticos DEMO.</p>
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none" />
      </Card>
    );
  }
  return <Lab />;
}

function Lab() {
  const t = useTrainer();
  const { experiments, testUses, saved } = useSession();
  const reduced = useReducedMotion();
  const view = labFeatures(useUser().role);        // solo cambia la presentación; el entrenamiento es el mismo
  const [tab, setTab] = useState<LabTab>(view.audit ? "ficha" : "red");
  // La prueba se consulta una sola vez por sesión: si ya se usó, se muestra el resultado registrado.
  const testRecord = experiments.find((e) => e.testAuc !== null);
  const [showSteps, setShowSteps] = useState(false);
  const [showBoundary, setShowBoundary] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [focus, setFocus] = useState<Sel | null>(null);
  const [pathMode, setPathMode] = useState<PathMode>("path");
  const [raw, setRaw] = useState<number[]>(() => FEATURES.map((f) => f.def));
  const [bpair, setBpair] = useState<[number, number]>([0, 1]);

  const idx = activeIdx(t.config);
  const rawActive = raw;
  const inf = t.infer(rawActive);
  const probPct = Math.round(inf.p * 100);
  const trained = t.epoch > 0;
  const net = t.net;
  const inputLabels = idx.map((j) => SHORT[j]);
  const split = t.ds.split;
  const m = t.metrics, b = t.baseMetrics;
  const delta = m && b ? m.auc - b.auc : null;
  const noHidden = t.config.hidden.length === 0;
  const lrExp = Math.log10(t.config.lr);
  const pair = useMemo<[number, number]>(() => (idx.includes(bpair[0]) && idx.includes(bpair[1]) && bpair[0] !== bpair[1] ? bpair : [idx[0], idx[1] ?? idx[0]]), [idx, bpair]);

  // Medidas sobre el dataset: techo teórico y deriva de las entregas tardías.
  const ceil = useMemo(() => ({ val: ceilingAuc(t.ds.split.val), test: ceilingAuc(t.ds.split.test) }), [t.ds]);
  const lateMeans = useMemo(() => [[1, 2, 3, 4], [5], [6]].map((ps) => { const r = t.ds.rows.filter((x) => ps.includes(x.period)); return r.reduce((s, x) => s + x.raw[3], 0) / r.length; }), [t.ds]);
  // Importancia por permutación: solo con el modelo quieto (no en cada época).
  const idxKey = idx.join(",");
  const importance = useMemo(() => (trained && !t.busy && t.state !== "Error" ? permutationImportance(net, t.ds, activeIdx(t.config)) : null),
    [net, t.metrics, t.busy, trained, idxKey]);
  const maxDrop = Math.max(0.001, ...(importance?.map((x) => Math.abs(x.drop)) ?? []));
  const covered = m && b ? pathCovered(m.auc, b.auc, ceil.val) : null;
  const valPos = split.val.filter((r) => r.y === 1).length;

  const setHidden = (h: number[]) => t.setConfig({ hidden: h });
  const [animSpeed, setAnimSpeed] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [demoPaused, setDemoPaused] = useState(false);
  const [probeWave, setProbeWave] = useState<Wave | null>(null);
  const [endedWave, setEndedWave] = useState(0);
  const rawRef = useRef(raw); rawRef.current = raw;
  const debounce = useRef<number | null>(null);
  useEffect(() => () => { if (debounce.current !== null) clearTimeout(debounce.current); }, []);

  // Al cambiar entradas o capas la selección deja de corresponder: se limpia (y se valida antes de usarla).
  const topology = `${idxKey}|${t.config.hidden.join(",")}`;
  const valid = (s: Sel | null) => (s && s.l < net.sizes.length && s.n < net.sizes[s.l] ? s : null);
  const selected = valid(sel);
  const shown = valid(focus) ?? selected;

  // Demostración: inferencias reales de muestras de validación. Se aparta mientras hay interacción o entrenamiento.
  const interaction = useInteraction(t.busy || !!selected);
  const canDemo = trained && !t.busy && t.state !== "Error";
  const demoRunning = tab === "red" && canDemo && !demoPaused && !interaction.holding;
  const demo = useDemoFlow({ ds: t.ds, net, active: idx, running: demoRunning, periodMs: reduced ? REDUCED_MS : DEMO_MS / animSpeed });
  useEffect(() => { setSel(null); setFocus(null); setProbeWave(null); demo.clear(); }, [topology]);
  const sample = canDemo && !interaction.holding && demo.sample && demo.sample.cache.a[0].length === idx.length ? demo.sample : null;
  const demoRaw = sample?.raw ?? raw;
  const graphInf = sample ? { cache: sample.cache, p: sample.p } : inf;
  const backWave = useBackwardWave({ net, ds: t.ds, active: idx, epoch: t.epoch, training: t.state === "Entrenando", enabled: !reduced });
  const wave = t.state === "Entrenando" ? backWave : interaction.holding ? probeWave : sample?.wave ?? null;
  const sweeping = demoRunning && !!sample && (reduced || endedWave !== sample.wave.id);
  const stateText = sweeping ? "Inferencia activa · demostración" : demoPaused && canDemo ? "Detenido" : t.state;
  const exampleNet = isExample(saved) && t.config.seed === saved!.seed && t.epoch === saved!.epoch;

  const trainerRef = useRef(t); trainerRef.current = t;
  /** Inferencia real con los valores de prueba, con su onda (tras una breve pausa al arrastrar). */
  const probe = (delay: number) => {
    interaction.touch();
    if (debounce.current !== null) clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      const tr = trainerRef.current, result = tr.infer(rawRef.current);
      setProbeWave({ id: nextWaveId(), kind: "fwd", layers: forwardPulses(tr.net, result.cache), layerMs: LAYER_MS });
      tr.touchInference();
    }, delay);
  };
  const onSlider = (j: number, v: number) => { setRaw((r) => r.map((x, k) => (k === j ? v : x))); t.touchInference(); probe(120); };
  const selInfo = (() => {
    if (!shown) return null;
    const { l, n } = shown;
    const lines: string[] = [];
    if (l === 0) {
      const j = idx[n];
      lines.push(`Variable: ${FEATURES[j].label}`, `Normalización: (x − ${t.ds.mean[j].toFixed(2)}) / ${t.ds.std[j].toFixed(2)}`, `Valor actual: ${fmtVal(j, demoRaw[j])} → z = ${graphInf.cache.a[0][n].toFixed(3)}`,
        `Pesos de salida: ${net.layers[0].W.map((row, k) => `→ #${k + 1} ${row[n].toFixed(2)}`).join(" · ")}`);
    } else {
      const L = net.layers[l - 1];
      lines.push(`Sesgo (b): ${L.b[n].toFixed(4)}`, `z = ${graphInf.cache.z[l - 1][n].toFixed(4)} → activación = ${graphInf.cache.a[l][n].toFixed(4)}`,
        `Pesos de entrada: ${L.W[n].map((w, i) => `${l === 1 ? inputLabels[i] : `#${i + 1}`} ${w.toFixed(2)}`).join(" · ")}`);
    }
    const dim = l === 0 ? `tensor a: [${net.sizes[0]}]` : `W: [${net.sizes[l]}×${net.sizes[l - 1]}] · b: [${net.sizes[l]}] · a: [${net.sizes[l]}]`;
    return { title: `${layerName(net, l)} · neurona ${n + 1}`, op: layerOp(net, l), dim, lines };
  })();

  const tabs: [LabTab, string][] = [
    ["red", "La red"], ["res", "Resultados"], ["exp", "Experimentos"],
    ...(view.advanced ? [["ajustes", "Ajustes"] as [LabTab, string]] : []),
    ...(view.audit ? [["ficha", "Ficha del modelo"] as [LabTab, string]] : []),
  ];
  const goTab = (next: LabTab) => { setFocus(null); setTab(next); };

  return (
    <div className="space-y-5 font-sans">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0! text-[18px]! font-semibold! text-white!">{view.title}</h3>
          <Badge tone="demo">DEMO · datos sintéticos</Badge>
        </div>
        <p className="m-0 mt-1 text-[13px] text-em-muted">Es un taller: no afecta tus recomendaciones ni tu nota.</p>
        <details className="mt-1 text-[12px] text-em-muted">
          <summary className="cursor-pointer">Sobre este laboratorio</summary>
          <p className="m-0 mt-2 max-w-3xl leading-relaxed">
            Entrenamiento real en el navegador sobre un dataset sintético DEMO. No es el modelo de producción (GRU multitarea en PyTorch: descrito, no entrenado en esta demo).
            Una probabilidad es una estimación, no una certeza ni un diagnóstico. La red solo usa las variables de actividad listadas: no infiere emociones ni cansancio.
            {" "}Deriva sintética a propósito: las entregas tardías suben de {lateMeans[0].toFixed(2)} (periodos 1-4) a {lateMeans[1].toFixed(2)} (5, +{DRIFT[5]} aplicado) y {lateMeans[2].toFixed(2)} (6, +{DRIFT[6]} aplicado).
          </p>
        </details>
      </div>

      {/* Controles siempre a la vista */}
      <Card pad="p-4" ariaLabel="Entrenamiento">
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => { demo.clear(); t.train(); }} disabled={t.busy || t.state === "Error"} aria-label="Entrenar la red">{t.epoch > 0 ? "Continuar entrenando" : "Entrenar"}</Btn>
          <Btn variant="ghost" onClick={t.pause} disabled={t.state !== "Entrenando" && t.state !== "Cargando datos"}>Pausar</Btn>
          <Btn variant="ghost" onClick={() => { demo.clear(); t.reset(); }}>Reiniciar</Btn>
          {view.saveVersion && <Btn variant="ghost" onClick={t.publish} disabled={!trained || t.busy} aria-label="Guardar como versión demo">Guardar como versión demo</Btn>}
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[13px] text-em-muted">
            <span className="tabular-nums">Época <span className="text-em-text">{t.epoch}</span></span>
            <span className="tabular-nums">AUC <span className="text-em-text">{fmt(m?.auc)}</span></span>
            <Badge tone={sweeping ? "ai" : stateTone[t.state]}>{stateText}</Badge>
          </div>
        </div>
        {t.error && (
          <div role="alert" className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-[13px]">
            <b className="text-red-300">Error de entrenamiento.</b> {t.error.message}
            <div className="mt-1 text-[11px] text-em-muted">correlation_id: <code>{t.error.correlationId}</code></div>
            <Btn className="mt-2" onClick={t.retry}>Reintentar (con tasa ≤ 0,05)</Btn>
          </div>
        )}
      </Card>

      <div role="tablist" aria-label="Partes del laboratorio" className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => <Btn key={id} role="tab" aria-selected={tab === id} variant={tab === id ? "primary" : "ghost"} onClick={() => goTab(id)}>{label}</Btn>)}
      </div>

      {tab === "red" && (
        <div className="[display:grid] grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <Card title="Prueba con valores" className="order-2 lg:order-1 lg:col-span-4">
            <div className="rounded-xl border border-white/10 bg-em-bg/40 p-4" aria-live="polite">
              <div className="text-[12px] text-em-muted">Probabilidad de completar en 30 días</div>
              <div className="mt-1 text-4xl font-semibold tabular-nums text-white"><FlashValue value={`${probPct}%`} /></div>
              <div className="text-[11px] text-em-muted">{trained ? "Con tus valores. Estimación, no un diagnóstico." : "Red sin entrenar: aún no es informativa."}</div>
            </div>
            <div className="my-3 flex flex-wrap gap-2">
              {PROFILES.map((p) => <Btn key={p.name} variant="ghost" title={p.name} onClick={() => { setRaw([...p.values]); rawRef.current = p.values; probe(0); }}>{p.name.replace("Estudiante ", "")}</Btn>)}
              <Btn variant="ghost" onClick={() => probe(0)} aria-label="Probar: inferencia con estos valores">Probar</Btn>
            </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {FEATURES.map((f, j) => {
              const on = t.config.active[j];
              const only = on && idx.length === 1;
              return (
                <li key={f.key} className={on ? "" : "opacity-60"}>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-w-0 items-center gap-2.5 text-[13px] text-em-text">
                      <Switch on={on} label={`${on ? "Desactivar" : "Activar"} ${f.label}${only ? " (mínimo una entrada)" : ""}`}
                        onChange={(v) => t.setConfig({ active: t.config.active.map((a, k) => (k === j ? v : a)) })} />
                      <span className="truncate" title={f.label}>{j === NOISE_INDEX ? <>ruido_demo <span className="text-[11px] text-amber-300">control sin información</span></> : f.label}</span>
                    </label>
                    <span className="text-[12px] tabular-nums text-em-muted">{fmtVal(j, raw[j])} {f.unit === "%" || f.unit === "0-1" ? "" : f.unit}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={raw[j]} disabled={!on} aria-label={`Valor de prueba: ${f.label}`}
                    onChange={(e) => onSlider(j, Number(e.target.value))}
                    className="mt-2 block h-2 w-full cursor-pointer border-0! bg-transparent! p-0! accent-em-cyan disabled:cursor-not-allowed" />
                </li>
              );
            })}
          </ul>
            <p className="m-0 mt-3 text-[11px] text-em-muted">Apagar una entrada reinicia la red. Los perfiles son ejemplos ilustrativos, no estudiantes reales.</p>
          </Card>

          <Card title="La red" featured className="order-1 lg:order-2 lg:col-span-8" right={
            <Btn variant="ghost" onClick={() => setDemoPaused((v) => !v)} disabled={!trained} aria-pressed={demoPaused}>{demoPaused ? "Reanudar animación" : "Pausar animación"}</Btn>}>
            <p className="m-0 min-h-[20px] text-[13px] text-em-text" aria-live="polite">
              {sample ? <>Demostración, muestra sintética {sample.name}: la red estima <span className="font-semibold tabular-nums">{Math.round(sample.p * 100)}%</span> y en los datos <span className={sample.y ? "text-em-teal" : "text-amber-300"}>{sample.y ? "completó el curso" : "no completó el curso"}</span></>
                : !trained ? "Pulsa Entrenar para ver la demostración." : interaction.holding ? "Mostrando tus valores de prueba." : "Demostración en pausa."}
            </p>
            <div className="mt-3">
              <NetworkGraph net={net} inputs={SHORT.map((label, j) => ({ label, active: t.config.active[j] }))} cache={graphInf.cache} wave={wave} speed={animSpeed}
                motion={!reduced} flow={demoPaused || !trained ? null : t.state === "Entrenando" ? "bwd" : "fwd"} trained={trained} showAll={showAll} selected={selected} highlight={shown} mode={pathMode} onSelect={setSel} onFocusNode={setFocus} onWaveEnd={setEndedWave} />
            </div>
            <p className="m-0 mt-2 text-[12px] text-em-muted">Cian suma · Violeta resta · Más grueso, más peso · Clic en un nodo para ver su camino</p>
            {exampleNet && <p className="m-0 mt-1 text-[11px] text-em-muted">{EXAMPLE_LABEL}</p>}

            {selInfo && (
              <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-em-bg/40 p-3 text-[12px]" aria-live="polite">
                <div className="text-[14px] text-white">{selInfo.title}</div>
                {view.advanced && <div className="text-em-muted">Operación: {selInfo.op} · Dimensión: <code>{selInfo.dim}</code></div>}
                {selInfo.lines.map((line) => <div key={line} className="break-words text-em-muted">{line}</div>)}
                {shown && <RouteInfluence net={net} sel={shown} inputNames={inputLabels} />}
              </div>
            )}

            <details className="mt-3 text-[12px] text-em-muted">
              <summary className="cursor-pointer">Opciones de vista y cómo leerla</summary>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div role="radiogroup" aria-label="Qué resaltar al seleccionar" className="inline-flex rounded-lg border border-white/10 p-0.5">
                  {([["path", "Camino hasta la salida"], ["direct", "Solo directas"]] as const).map(([value, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={pathMode === value} onClick={() => setPathMode(value)}
                      className={`rounded-md! border-0! px-2! py-1! text-[12px] focus-visible:outline-2! focus-visible:outline-em-cyan! ${pathMode === value ? "bg-em-blue! text-em-onaccent!" : "bg-transparent! text-em-muted!"}`}>{label}</button>
                  ))}
                </div>
                <Btn variant="ghost" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>{showAll ? "Ocultar débiles" : "Mostrar todas"}</Btn>
                <label className="flex items-center gap-2">Velocidad
                  <input type="range" min={0.5} max={2} step={0.25} value={animSpeed} aria-label="Velocidad de animación" onChange={(e) => setAnimSpeed(Number(e.target.value))} className="h-2 w-24 border-0! bg-transparent! p-0! accent-em-cyan" />
                  <span className="tabular-nums">{animSpeed}x</span>
                </label>
              </div>
              <ul className="m-0 mt-3 list-disc space-y-1 pl-4">
                <li>Las líneas que corren muestran el sentido del cálculo: de las entradas a la salida, y al revés (violeta) mientras entrena.</li>
                <li>Se destaca el 25 % de las conexiones con mayor peso en cada capa; las demás corren tenues.</li>
                <li>En la demostración, cada pulso sigue una de las conexiones de mayor contribución (activación del origen × |peso|) para una muestra real de validación.</li>
                <li>Al entrenar, la onda violeta va de la salida a las entradas según el tamaño del gradiente.</li>
                <li>El camino resaltado es una aproximación según los pesos aprendidos, no una prueba de causalidad. Escape lo quita.</li>
                <li>{reduced ? "Movimiento reducido activo: sin pulsos; las muestras cambian al instante." : "La demostración se pausa al interactuar y vuelve 10 s después."}</li>
              </ul>
            </details>
          </Card>
        </div>
      )}

      {tab === "res" && (
        <div className="space-y-5">
          <div className="[display:grid] grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <Card title="¿Está aprendiendo?">
              <LossChart data={t.history} bestEpoch={t.bestEpoch} />
              {t.stoppedEarly && <p className="m-0 mt-1 text-[12px] text-em-teal">Parada temprana: se restauraron los pesos de la época {t.bestEpoch} (paciencia {t.config.patience}).</p>}
            </Card>

            <Card title="¿Es mejor que un modelo simple?">
              <div className="space-y-5">
                <div aria-live="polite">
                  <div className="text-5xl font-semibold tabular-nums text-white"><FlashValue value={fmt(m?.auc)} /></div>
                  <div className="mt-1 text-[12px] text-em-muted">ROC-AUC de la red en validación: 0,5 es azar y 1 es perfecto.</div>
                </div>
                <div>
                  {([["Baseline lineal", b?.auc, "bg-em-muted"], ["Con interacción", t.interMetrics?.auc, "bg-em-violet"], ["Red", m?.auc, "bg-em-cyan"]] as const).map(([name, v, color]) => (
                    <div key={name} className="mb-2 flex items-center gap-3 text-[12px]">
                      <span className="w-28 shrink-0 text-em-muted">{name}</span>
                      <div className="h-2 min-w-0 flex-1 rounded-full bg-white/10" role="img" aria-label={`${name}: AUC ${fmt(v)}`}><div className={`h-2 rounded-full ${color} transition-[width] duration-200`} style={{ width: `${Math.max(0, ((v ?? 0.5) - 0.5) * 200)}%` }} /></div>
                      <span className="w-12 text-right tabular-nums text-em-text">{fmt(v)}</span>
                    </div>
                  ))}
                  <p className="m-0 mt-3 text-[13px] text-em-text" aria-live="polite">
                    {!m || !b ? "Entrena para comparar." : noHidden ? "Con 0 capas ocultas la red equivale al baseline lineal." : delta !== null && delta > 0.005 ? `La red supera al baseline lineal por ${delta.toFixed(3)} de AUC en esta semilla. ${view.repeatSeeds ? "Para saber si es concluyente, repite con 5 semillas." : "Una sola semilla no basta para concluir."}` : "En este momento la red no supera al baseline lineal: prueba más neuronas o más épocas."}
                    {m && !t.baselineConverged && " Los baselines aún están convergiendo."}
                  </p>
                </div>
                <details className="text-[12px] text-em-muted">
                  <summary className="cursor-pointer">Detalles técnicos</summary>
                  <div className="mt-2 space-y-2">
                    <p className="m-0">F1 {fmt(m?.f1)} · Recall {fmt(m?.recall)} · Brier {fmt(m?.brier)} · Pérdida {fmt(m?.loss)} · latencia {inf.latencyMs.toFixed(3)} ms</p>
                    <p className="m-0">División temporal: periodos 1-4 entrenamiento ({split.train.length}), periodo 5 validación ({split.val.length}), periodo 6 prueba ({split.test.length}). Las barras empiezan en 0,5.</p>
                    <p className="m-0 text-em-text">Techo teórico (con ruido): <span className="font-semibold tabular-nums">{ceil.val.toFixed(3)}</span> · solo existe porque los datos son sintéticos.</p>
                    <p className="m-0">{covered === null ? "Entrena para ver cuánto del camino recorre la red." : <>La red recorre el <span className="font-semibold text-em-teal">{Math.round(covered * 100)}%</span> del camino entre el baseline lineal y el techo. Con {split.val.length} muestras puede quedar fuera de 0-100% por azar.</>}</p>
                    {!t.interMetrics && !(idx.includes(INTERACTION.a) && idx.includes(INTERACTION.b)) && <p className="m-0 text-amber-300">El baseline con interacción ({INTERACTION.label}) requiere activar esas dos entradas.</p>}
                    {t.interMetrics && !t.busy && (() => {
                      const cs = ceilingStatement(t.interMetrics.auc, ceil.val, valPos, split.val.length - valPos);
                      return <p className="m-0">Con interacción ({INTERACTION.label}) {cs.within ? "queda dentro del error de muestra del techo teórico" : "no alcanza el techo teórico"}: le faltan {cs.gap.toFixed(3)}, margen ±{cs.margin.toFixed(3)}.</p>;
                    })()}
                    <p className="m-0">{INTERACTION_NOTE}</p>
                  </div>
                </details>
              {view.testEval && <div>
                <Btn variant="ghost" onClick={t.evaluateTest} disabled={!trained || t.busy || !!t.testResult || testUses > 0 || t.state === "Error"}>Evaluar en prueba (periodo 6)</Btn>
                {!t.testResult && testUses > 0 && testRecord && <p className="m-0 mt-2 text-[13px] text-em-text">Ya se usó en esta sesión: AUC de prueba {fmt(testRecord.testAuc)} ({testRecord.arch}).</p>}
                <p className="m-0 mt-1 text-[11px] text-amber-300">Úsalo una sola vez, al terminar de decidir. La validación sirve para decidir; la prueba, solo para reportar.</p>
                {t.testResult && <p className="m-0 mt-2 text-[13px] text-em-text" aria-live="polite">Prueba (n = {t.testResult.n}): AUC red <span className="font-semibold">{t.testResult.auc.toFixed(3)}</span> · baseline lineal {t.testResult.baselineAuc.toFixed(3)}{t.testResult.interAuc !== null && ` · con interacción ${t.testResult.interAuc.toFixed(3)}`} · techo {ceil.test.toFixed(3)}. Registrado en el historial.</p>}
                {testUses > 1 && <p className="m-0 mt-1 text-[11px] text-orange-300">La prueba ya se ha consultado {testUses} veces en esta sesión: dejó de ser una medida imparcial.</p>}
              </div>}
              </div>
            </Card>
          </div>

        {view.importance && <Card title="¿Qué entradas usa el modelo?">
          {!importance ? <p className="m-0 text-[13px] text-em-muted">{t.busy ? "Se calcula al pausar o terminar el entrenamiento." : "Entrena para medir la importancia de cada entrada."}</p> : (
            <>
              <ul className="m-0 list-none space-y-2 p-0">
                {importance.map((x) => (
                  <li key={x.feature} className="flex items-center gap-3 text-[12px]">
                    <span className="w-28 shrink-0 truncate text-em-muted" title={FEATURES[x.feature].label}>{SHORT[x.feature]}</span>
                    <div className="h-2 min-w-0 flex-1 rounded-full bg-white/10" role="img" aria-label={`${FEATURES[x.feature].label}: caída de AUC ${x.drop.toFixed(3)}`}>
                      <div className={`h-2 rounded-full ${x.drop >= 0 ? "bg-em-violet" : "bg-em-muted"}`} style={{ width: `${(Math.abs(x.drop) / maxDrop) * 100}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right tabular-nums text-em-text">{x.drop.toFixed(3)} ± {x.sd.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3 text-[11px] text-em-muted">Cuánto empeora el modelo si se desordena esta entrada. No implica causalidad. Caída del AUC en validación (n = {split.val.length}, positivos = {valPos}), media de 5 barajados con semilla. Un valor negativo o cercano a 0 significa que no aporta.</p>
            </>
          )}
        </Card>}


          {view.explain && (
            <Card title="Cómo contar este resultado">
              <ul className="m-0 list-disc space-y-1 pl-4 text-[13px] text-em-text">{HOW_TO_TELL.map((x) => <li key={x}>{x}</li>)}</ul>
            </Card>
          )}
        </div>
      )}

      {/* Siempre montado: cambiar de pestaña no debe cortar un experimento en curso. */}
      <div hidden={tab !== "exp"}>
        <ExperimentsPanel ds={t.ds} config={t.config} ceiling={ceil.val} error={t.error} onAbsurd={t.absurdRate} onRetry={t.retry}
          repeatSeeds={view.repeatSeeds} absurdRate={view.absurdRate} help={view.experimentHelp} />
      </div>

      {tab === "ajustes" && view.advanced && (
        <div className="[display:grid] grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <Card title="Arquitectura y optimización" className="lg:col-span-12">
            <div className="space-y-4 text-[13px]">
              <div>
                <div className="mb-2 text-em-muted">Capas ocultas ({t.config.hidden.length} de 3) · neuronas por capa</div>
                {t.config.hidden.length === 0 && <p className="m-0 mb-2 text-[12px] text-em-muted">0 capas = regresión logística (baseline).</p>}
                {t.config.hidden.map((n, l) => (
                  <div key={l} className="mb-2 flex items-center gap-2">
                    <span className="w-16 text-em-muted">Oculta {l + 1}</span>
                    <Btn variant="ghost" aria-label={`Menos neuronas en capa ${l + 1}`} disabled={n <= 1} onClick={() => setHidden(t.config.hidden.map((v, k) => (k === l ? v - 1 : v)))}>−</Btn>
                    <span className="w-6 text-center tabular-nums" aria-live="polite">{n}</span>
                    <Btn variant="ghost" aria-label={`Más neuronas en capa ${l + 1}`} disabled={n >= 8} onClick={() => setHidden(t.config.hidden.map((v, k) => (k === l ? v + 1 : v)))}>+</Btn>
                    <Btn variant="ghost" aria-label={`Quitar capa ${l + 1}`} onClick={() => setHidden(t.config.hidden.filter((_, k) => k !== l))}>Quitar</Btn>
                  </div>
                ))}
                <Btn variant="ghost" disabled={t.config.hidden.length >= 3} onClick={() => setHidden([...t.config.hidden, 4])}>Añadir capa</Btn>
              </div>
              <label className="flex items-center gap-3"><span className="w-28 text-em-muted">Activación</span>
                <select value={t.config.activation} aria-label="Función de activación" onChange={(e) => t.setConfig({ activation: e.target.value === "tanh" ? "tanh" : "relu" })}>
                  <option value="relu">ReLU</option><option value="tanh">tanh</option>
                </select>
              </label>
              <label className="flex flex-wrap items-center gap-3"><span className="w-28 text-em-muted">Tasa de aprendizaje</span>
                <input type="range" min={-3} max={2} step={0.1} value={lrExp} aria-label="Tasa de aprendizaje (escala logarítmica)" onChange={(e) => t.setConfig({ lr: Number((10 ** Number(e.target.value)).toPrecision(2)) })}
                  className="h-2 w-40 border-0! bg-transparent! p-0! accent-em-cyan" />
                <span className="tabular-nums">{t.config.lr}</span>
                {t.config.lr > 5 && <span className="text-[11px] text-orange-300">Valor extremo: probablemente diverja.</span>}
              </label>
              <label className="flex items-center gap-3"><span className="w-28 text-em-muted">Velocidad</span>
                <input type="range" min={1} max={30} value={t.config.speed} aria-label="Velocidad en épocas por segundo" onChange={(e) => t.setConfig({ speed: Number(e.target.value) })} className="h-2 w-40 border-0! bg-transparent! p-0! accent-em-cyan" />
                <span className="tabular-nums">{t.config.speed} épocas/s</span>
              </label>
              <label className="flex items-center gap-3"><span className="w-28 text-em-muted">L2 (weight decay)</span>
                <input type="range" min={0} max={0.02} step={0.0005} value={t.config.l2} aria-label="Regularización L2" onChange={(e) => t.setConfig({ l2: Number(e.target.value) })} className="h-2 w-40 border-0! bg-transparent! p-0! accent-em-cyan" />
                <span className="tabular-nums">{t.config.l2.toFixed(4)}</span>
              </label>
              <label className="flex items-center gap-3"><span className="w-28 text-em-muted">Paciencia (early stopping)</span>
                <input type="range" min={0} max={100} step={5} value={t.config.patience} aria-label="Paciencia de early stopping en épocas" onChange={(e) => t.setConfig({ patience: Number(e.target.value) })} className="h-2 w-40 border-0! bg-transparent! p-0! accent-em-cyan" />
                <span className="tabular-nums">{t.config.patience === 0 ? "desactivado" : `${t.config.patience} épocas`}</span>
              </label>
              <label className="flex items-center gap-3"><span className="w-28 text-em-muted">Semilla</span>
                <input type="number" value={t.config.seed} aria-label="Semilla aleatoria" onChange={(e) => t.setConfig({ seed: Math.round(Number(e.target.value)) || 0 })} className="w-24!" />
              </label>
              <p className="m-0 text-[11px] text-em-muted">Arquitectura: {archLabel(t.config)} · {t.params} parámetros entrenables. Cambiar capas, activación o semilla reinicia la red.</p>
            </div>
          </Card>

          <Card className="lg:col-span-12">
            <div className="flex flex-wrap gap-3">
              <Section title="Paso a paso" open={showSteps} onToggle={() => setShowSteps((v) => !v)}>
                <StepByStep net={net} ds={t.ds} active={idx} lr={t.config.lr} disabled={t.busy} onApply={t.applyStep} />
              </Section>
            </div>
            <div className="mt-4"><Section title="Frontera de decisión 2D" open={showBoundary} onToggle={() => setShowBoundary((v) => !v)}>
              {idx.length < 2 ? <p className="m-0 text-[13px] text-em-muted">Activa al menos dos entradas para ver la frontera.</p> : (
                <div className="flex flex-wrap gap-6">
                  <div className="space-y-3 text-[13px]">
                    {[0, 1].map((k) => (
                      <label key={k} className="flex items-center gap-3"><span className="w-20 text-em-muted">Eje {k ? "vertical" : "horizontal"}</span>
                        <select value={pair[k]} aria-label={`Variable del eje ${k ? "vertical" : "horizontal"}`} onChange={(e) => { const v = Number(e.target.value); setBpair(k ? [pair[0], v] : [v, pair[1]]); }}>
                          {idx.map((j) => <option key={j} value={j}>{FEATURES[j].label}</option>)}
                        </select>
                      </label>
                    ))}
                    <p className="m-0 max-w-xs text-[11px] text-em-muted">Las demás entradas activas se fijan con los valores de los sliders.</p>
                  </div>
                  <DecisionBoundary net={net} ds={t.ds} active={idx} a={pair[0]} b={pair[1]} rawValues={rawActive} />
                </div>
              )}
            </Section></div>
          </Card>

          <Card title="Historial de experimentos de la sesión" className="lg:col-span-12">
            {experiments.length === 0 ? <p className="m-0 text-[13px] text-em-muted">Aún no hay experimentos. Entrena y pulsa «Guardar como versión demo» para registrar uno.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[12px]">
                  <caption className="sr-only">Experimentos guardados como versión demo</caption>
                  <thead><tr className="text-em-muted">{["Versión", "Entradas", "Arquitectura", "Tasa", "Pérdida val.", "AUC", "AUC baseline", "F1", "Brier", "Parámetros", "Mejor época", "AUC prueba"].map((h) => <th key={h} scope="col" className="border-b border-white/10 px-2 py-2 font-normal">{h}</th>)}</tr></thead>
                  <tbody>{experiments.map((e) => (
                    <tr key={e.id} className="text-em-text">
                      <td className="border-b border-white/5 px-2 py-2">{e.version}</td>
                      <td className="border-b border-white/5 px-2 py-2" title={e.inputs.join(", ")}>{e.inputs.length} de {N_FEATURES}</td>
                      <td className="border-b border-white/5 px-2 py-2">{e.arch}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{e.lr}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{fmt(e.valLoss)}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{fmt(e.auc)}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{fmt(e.baselineAuc)}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{fmt(e.f1)}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{fmt(e.brier)}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{e.params}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{e.bestEpoch}</td>
                      <td className="border-b border-white/5 px-2 py-2 tabular-nums">{fmt(e.testAuc)}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "ficha" && view.audit && <AuditCards ds={t.ds} config={t.config} metrics={m} epoch={t.epoch} params={t.params} />}
    </div>
  );
}
