const items = ["Resumen","Planes de Aprendizaje","Cursos","Análisis","IA Tutor","Evaluaciones","Certificados","Comunidad","Configuración"];

export default function Sidebar({ active, onSelect }: { active: string; onSelect: (s: string) => void }) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="brand">EduMaster<small>.Pro</small></div>
      <nav>
        {items.map((it) => (
          <button key={it} className={it === active ? "nav active" : "nav"} onClick={() => onSelect(it)}
                  aria-current={it === active ? "page" : undefined}>{it}</button>
        ))}
      </nav>
      <div className="card precision">
        <span className="muted">Precisión del modelo</span>
        <strong>99.8%</strong>
        <span className="badge demo">DEMO</span>
      </div>
    </aside>
  );
}
