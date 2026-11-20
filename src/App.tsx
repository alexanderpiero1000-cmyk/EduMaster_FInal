import { useState } from "react";
import { StoreProvider } from "./store/Store";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./views/Dashboard";
import Paths from "./views/Paths";
import Courses from "./views/Courses";
import Analytics from "./views/Analytics";
import Tutor from "./views/Tutor";
import Assessments from "./views/Assessments";
import Certificates from "./views/Certificates";
import Community from "./views/Community";
import Settings from "./views/Settings";

const views: Record<string, () => React.ReactElement> = {
  "Resumen": Dashboard, "Planes de Aprendizaje": Paths, "Cursos": Courses, "Análisis": Analytics, "IA Tutor": Tutor,
  "Evaluaciones": Assessments, "Certificados": Certificates, "Comunidad": Community, "Configuración": Settings,
};

export default function App() {
  const [section, setSection] = useState("Resumen");
  const View = views[section];
  return (
    <StoreProvider>
      <div className="app">
        <Sidebar active={section} onSelect={setSection} />
        <main><Topbar /><h2 className="page-title">{section}</h2><View /></main>
      </div>
    </StoreProvider>
  );
}
