import { DATA_SOURCE, regions, students } from "../data/db";
import { completion, heatmap, kpis } from "../data/selectors";
import { useStore } from "../store/Store";
import KpiCard from "../components/KpiCard";
import NeuralNetworkCanvas from "../components/NeuralNetworkCanvas";
import TrendChart from "../components/TrendChart";
import CompletionDonut from "../components/CompletionDonut";
import SkillHeatmap from "../components/SkillHeatmap";
import RecommendationList from "../components/RecommendationList";
import ActivityFeed from "../components/ActivityFeed";

export default function Dashboard() {
  const { db } = useStore();
  const k = kpis(db);
  return (
    <div className="grid">
      <div className="a-neural"><NeuralNetworkCanvas /></div>
      <div className="a-trend"><TrendChart /></div>
      <div className="a-kpis">
        <KpiCard label="Alumnos" value={k.students} hint="tabla students" />
        <KpiCard label="Cursos" value={k.courses} hint="tabla courses" />
        <KpiCard label="Horas de aprendizaje" value={k.hours} hint="lecciones × horas" />
        <KpiCard label="Certificaciones" value={k.certs} hint="certs emitidos" />
      </div>
      <section className="card a-map">
        <div className="card-head"><h2>Alumnos por región</h2></div>
        <ul className="list">{regions.map((r) => <li key={r}><span>{r}</span><b>{students.filter((s) => s.region === r).length}</b></li>)}</ul>
      </section>
      <div className="a-donut"><CompletionDonut {...completion(db)} /></div>
      <div className="a-skills"><SkillHeatmap matrix={heatmap(db)} /></div>
      <div className="a-reco"><RecommendationList /></div>
      <div className="a-feed"><ActivityFeed /></div>
      <p className="muted small" style={{ gridColumn: "1/-1" }}>Fuente: {DATA_SOURCE}. KPIs, finalización y heatmap se calculan desde las matrículas, evaluaciones y certificados de las demás vistas.</p>
    </div>
  );
}
