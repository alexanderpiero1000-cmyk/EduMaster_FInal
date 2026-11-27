
import { useState } from "react";
import { useStore } from "../store/Store";
import { student } from "../data/selectors";
import ReviewPanel from "../components/ui/ReviewPanel";
import StudentTutor from "../components/ui/StudentTutor";
import TutorFooter from "../components/ui/TutorBridges";
import TeacherTutorAssistant from "../components/ui/TeacherTutorAssistant";
import Badge from "../components/ui/Badge";
import { TUTOR_ENGINE } from "../components/ui/tutorEngine";
import NeuralLab from "../neural/NeuralLab";
import { consumeRequestedTab } from "../neural/session";

export default function Tutor() {
  const { can, sid } = useStore();
  const [tab, setTab] = useState<"tutor" | "lab">(
    () => consumeRequestedTab() ?? "tutor"
  );

  const openLab = () => setTab("lab");
  const learner = can("reco.feedback");

  return (
    <>
      <div
        className="course-tabs"
        role="tablist"
        aria-label="Secciones de IA Tutor"
        style={{ marginBottom: 12 }}
      >
        <button
          role="tab"
          aria-selected={tab === "tutor"}
          className={`course-tab${tab === "tutor" ? " active" : ""}`}
          onClick={() => setTab("tutor")}
        >
          Tutor
        </button>

        <button
          role="tab"
          aria-selected={tab === "lab"}
          className={`course-tab${tab === "lab" ? " active" : ""}`}
          onClick={() => setTab("lab")}
        >
          Laboratorio
        </button>
      </div>

      {tab === "lab" ? (
        <NeuralLab />
      ) : (
        <div className="space-y-6 font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[15px] text-em-text">
              {learner
                ? `Hola, ${student(sid).name.split(" ")[0]}. Esto es lo que te conviene hacer ahora.`
                : "Bienvenido a tu asistente inteligente docente."}
            </p>

            <Badge tone="demo">{TUTOR_ENGINE}</Badge>
          </div>

                    {learner ? (
            <StudentTutor onOpenLab={openLab} />
          ) : (
            <>
              <TeacherTutorAssistant />
              {can("reco.review") && <ReviewPanel />}
            </>
          )}

          <TutorFooter onOpenLab={openLab} />
        </div>
      )}
    </>
  );
}
