export default function CompletionDonut({ completed, inProgress, notStarted }: { completed: number; inProgress: number; notStarted: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const parts = [
    { label: "Completados", v: completed, color: "#20C8F5" },
    { label: "En progreso", v: inProgress, color: "#8B4DFF" },
    { label: "No iniciados", v: notStarted, color: "#FF8A4C" },
  ];
  let offset = 0;
  return (
    <section className="card">
      <div className="card-head"><h2>Finalización de matrículas</h2></div>
      <div className="donut-wrap">
        <svg viewBox="0 0 140 140" role="img" aria-label={`${completed}% completados`}>
          {parts.map((p) => {
            const len = (p.v / 100) * c;
            const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
            offset += len; return el;
          })}
          <text x="70" y="76" textAnchor="middle" className="donut-n">{completed}%</text>
        </svg>
        <ul className="legend col">{parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label} <b>{p.v}%</b></li>)}</ul>
      </div>
    </section>
  );
}
