import { useEffect, useId, useRef, useState } from "react";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import Skeleton from "./ui/Skeleton";
import type { Trend } from "./ui/summary";

const H = 260, PL = 30, PR = 12, PT = 10, PB = 26;
const hhmm = (t: number) => new Date(t).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/** Spline cúbica suave; los puntos de control se recortan al área del gráfico para no desbordar. */
function smooth(p: [number, number][], lo: number, hi: number): string {
  if (p.length < 2) return "";
  const cl = (v: number) => Math.min(hi, Math.max(lo, v));
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${cl(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${cl(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

interface Props { trend: Trend; loading: boolean; error?: string; title?: string }

/** Tendencia en vivo derivada de db: ventanas de 1 min. Se dibuja al tamaño real (sin escalar la tipografía). */
export default function TrendChart({ trend, loading, error, title = "Actividad en vivo" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hi, setHi] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver((es) => { const n = Math.floor(es[0].contentRect.width); if (n > 0) setW(n); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error]);

  const n = trend.starts.length;
  const max = Math.max(3, ...trend.series.flatMap((s) => s.values));
  const step = STEPS.find((s) => max / s <= 3) ?? 1000;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const px = (i: number) => PL + (i * (w - PL - PR)) / (n - 1);
  const py = (v: number) => PT + (1 - v / top) * (H - PT - PB);
  const base = py(0);
  const xt = [0, 1, 2, 3, 4].map((i) => Math.round((i * (n - 1)) / 4));
  const pts = (vals: number[]): [number, number][] => vals.map((v, i) => [px(i), py(v)]);
  const main = trend.series[0];
  const mainPts = pts(main.values);
  const mainPath = smooth(mainPts, PT, base);
  const tipLeft = hi === null ? 0 : Math.min(Math.max(px(hi), 90), w - 90);

  const grid = (
    <>
      {ticks.map((t) => (
        <g key={t}><line x1={PL} x2={w - PR} y1={py(t)} y2={py(t)} stroke="rgba(255,255,255,.05)" />
          <text x={PL - 8} y={py(t) + 4} textAnchor="end" fontSize={11} fill="#8FA6C4">{t}</text></g>
      ))}
      {xt.map((i, k) => <text key={i} x={px(i)} y={H - 6} textAnchor={k === 0 ? "start" : k === 4 ? "end" : "middle"} fontSize={11} fill="#8FA6C4">{hhmm(trend.starts[i])}</text>)}
    </>
  );

  return (
    <Card title={title} featured className="min-w-0" right={<Badge tone="live">Ventanas de 1 min</Badge>}>
      {loading ? <div aria-hidden="true"><Skeleton className="mb-4 h-6 w-2/3" /><Skeleton className="h-[260px] w-full" /></div>
        : error ? <p role="alert" className="flex h-[260px] items-center justify-center rounded-xl border border-red-400/40 px-6 text-center text-[14px] text-red-300">{error}</p>
        : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {trend.series.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[12px] text-em-muted">
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}
                </span>
              ))}
            </div>
            <div ref={ref} className="relative h-[260px] w-full select-none">
              <svg width={w} height={H} role="img" aria-label={trend.collecting ? "Gráfico en espera de eventos en vivo" : `Eventos por minuto en los últimos ${n} minutos`}
                className="block overflow-visible" onPointerLeave={() => setHi(null)}
                onPointerMove={(e) => { if (trend.collecting) return; const r = e.currentTarget.getBoundingClientRect(); setHi(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left - PL) / (w - PL - PR)) * (n - 1))))); }}>
                <defs>
                  <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={main.color} stopOpacity={0.28} /><stop offset="100%" stopColor={main.color} stopOpacity={0} /></linearGradient>
                </defs>
                {grid}
                {!trend.collecting && (
                  <>
                    <path d={`${mainPath} L${px(n - 1)},${base} L${px(0)},${base} Z`} fill={`url(#g${gid})`} />
                    {trend.series.map((s) => <path key={s.name} d={smooth(pts(s.values), PT, base)} fill="none" stroke={s.color} strokeWidth={s === main ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" />)}
                    {hi !== null && (
                      <>
                        <line x1={px(hi)} x2={px(hi)} y1={PT} y2={base} stroke="#fff" strokeOpacity={0.18} />
                        {trend.series.map((s) => <circle key={s.name} cx={px(hi)} cy={py(s.values[hi])} r={4} fill={s.color} stroke="#06152B" strokeWidth={2} />)}
                      </>
                    )}
                  </>
                )}
              </svg>
              {trend.collecting && (
                <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[40%] flex flex-col items-center gap-1 text-center">
                  <span className="animate-pulse text-[14px] text-em-text motion-reduce:animate-none">Recopilando eventos en vivo…</span>
                  <span className="px-6 text-[12px] text-em-muted">La tendencia aparece cuando hay al menos 3 eventos en los últimos {n} minutos.</span>
                </div>
              )}
              {hi !== null && !trend.collecting && (
                <div role="tooltip" style={{ left: tipLeft, top: 8 }} className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-xl border border-white/10 bg-em-bg/95 px-3 py-2 text-[12px] shadow-xl">
                  <div className="mb-1 text-em-muted">{hhmm(trend.starts[hi])}{hi === n - 1 ? " · en curso" : ""}</div>
                  {trend.series.map((s) => (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-em-text">
                      <span className="flex min-w-0 items-center gap-1.5"><i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} /><span className="truncate">{s.name}</span></span>
                      <span className="font-semibold tabular-nums">{s.values[hi]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="m-0 mt-2 text-[11px] text-em-muted">Eventos por minuto, calculados con los registros en vivo. La última ventana sigue en curso.</p>
          </>
        )}
    </Card>
  );
}
