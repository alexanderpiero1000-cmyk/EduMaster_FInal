import { months, trend } from "../data/db";
const W = 620, H = 220, L = 36, B = 24, T = 10;

export default function TrendChart() {
  const max = 300;
  const px = (i: number) => L + (i * (W - L - 10)) / 11;
  const py = (v: number) => T + (1 - v / max) * (H - T - B);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Progreso analítico <span className="badge demo">DEMO</span></h2>
        <div className="legend">
          {trend.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tendencia mensual de matrículas, cursos y certificados">
        {[0, 100, 200, 300].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - 10} y1={py(g)} y2={py(g)} className="grid" />
            <text x={L - 6} y={py(g) + 4} textAnchor="end">{g}</text>
          </g>
        ))}
        {months.map((m, i) => <text key={m} x={px(i)} y={H - 6} textAnchor="middle">{m}</text>)}
        {trend.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth={2.5}
              points={s.values.map((v, i) => `${px(i)},${py(v)}`).join(" ")} />
            {s.values.map((v, i) => (
              <circle key={i} cx={px(i)} cy={py(v)} r={3} fill={s.color}>
                <title>{`${s.name} · ${months[i]}: ${v}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </section>
  );
}
