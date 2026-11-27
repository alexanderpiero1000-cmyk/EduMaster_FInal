import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "./store/Store";
import { visibleSections } from "./data/permissions";
import { roleLabel } from "./data/users";
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
import Login from "./views/Login";
import EduChatbot from "./components/ui/EduChatbot";

const views: Record<string, () => React.ReactElement> = {
  "Resumen": Dashboard, "Planes de Aprendizaje": Paths, "Cursos": Courses, "Análisis": Analytics, "IA Tutor": Tutor,
  "Evaluaciones": Assessments, "Certificados": Certificates, "Comunidad": Community, "Configuración": Settings,
};

function Shell() {
  const { user } = useStore();
  const [section, setSection] = useState("Resumen");
  const allowed: string[] = user ? visibleSections(user.role) : [];
  const permitted = allowed.includes(section);
  useEffect(() => { if (user && !permitted) setSection("Resumen"); }, [user, permitted]);
  if (!user) return <Login />;
  const current = permitted ? section : "Resumen";
  const View = views[current];
  return (
    <div className="app">
      <Sidebar active={current} onSelect={setSection} />
      <main><Topbar /><h2 className="page-title">{current} <span className="badge role-chip">{roleLabel(user.role)}</span></h2><View key={user.id} /></main>
      {user.role === "estudiante" && <EduChatbot />}
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
