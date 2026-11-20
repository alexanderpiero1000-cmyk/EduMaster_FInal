import { levels, skills } from "../data/db";

export default function SkillHeatmap({ matrix }: { matrix: number[][] }) {
  return (
    <section className="card">
      <div className="card-head"><h2>Dominio de habilidades</h2><span className="badge demo">% de alumnos en nivel o superior · estimación DEMO</span></div>
      <div className="heat" style={{ gridTemplateColumns: `130px repeat(${levels.length}, 1fr)` }}>
        <span />{levels.map((l) => <span key={l} className="muted c">{l}</span>)}
        {skills.map((s, r) => (
          <div key={s.id} style={{ display: "contents" }}>
            <span className="muted">{s.name}</span>
            {matrix[r].map((v, c) => <span key={c} className="cell" title={`${s.name} · ${levels[c]}: ${v}%`}
              style={{ background: `rgba(139,77,255,${v / 100})`, boxShadow: `inset 0 0 0 1px rgba(32,200,245,${v / 300})` }}>{v}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}
