import Skeleton from "./ui/Skeleton";

interface Props { completed: number; inProgress: number; notStarted: number; loading?: boolean }

/** Anillo de estado de matrículas (porcentajes sobre el total). Se incrusta dentro de una tarjeta. */
export default function CompletionDonut({ completed, inProgress, notStarted, loading }: Props) {
  if (loading) {
    return (
      <div aria-hidden="true" className="flex flex-col items-center gap-5">
        <Skeleton className="h-36 w-36 rounded-full" />
        <div className="w-full space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>
      </div>
    );
  }
  const r = 54, c = 2 * Math.PI * r;
  const parts = [
    { label: "Completadas", v: completed, color: "#00BFA6" },
    { label: "En progreso", v: inProgress, color: "#20C8F5" },
    { label: "Sin iniciar", v: notStarted, color: "#6B7F9C" },
  ];
  const sum = parts.reduce((s, p) => s + p.v, 0) || 1;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${completed}% completadas, ${inProgress}% en progreso, ${notStarted}% sin iniciar`} className="h-36 w-36 shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
        {parts.filter((p) => p.v > 0).map((p) => {
          const len = (p.v / sum) * c;
          const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="10" strokeDasharray={`${len} ${Math.max(0, c - len)}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray 200ms, stroke-dashoffset 200ms" }}><title>{`${p.label}: ${p.v}%`}</title></circle>;
          offset += len; return el;
        })}
        <text x="70" y="78" textAnchor="middle" fontSize={26} fontWeight={600} fill="#fff" className="tabular-nums">{completed}%</text>
      </svg>
      <ul className="m-0 [display:grid] w-full list-none gap-2 p-0 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="[display:grid] grid-cols-[auto_1fr_auto] items-center gap-2 text-em-muted">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="truncate">{p.label}</span>
            <span className="font-semibold tabular-nums text-em-text">{p.v}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
