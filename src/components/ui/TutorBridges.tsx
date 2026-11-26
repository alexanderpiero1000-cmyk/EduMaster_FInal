// Pie de la bandeja: deja claro qué motor usa el tutor y lleva al Laboratorio.
import Btn from "./Btn";
import { students } from "../../data/db";
import { openHelp } from "../../data/help";
import { useStore, useUser } from "../../store/Store";
import { useSession } from "../../neural/session";

export default function TutorFooter({ onOpenLab }: { onOpenLab: () => void }) {
  const { db } = useStore();
  const user = useUser();
  const { summary } = useSession();
  const states = Object.values(db.recState);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-em-muted">
      <div>
        {user.role === "superadmin" && (
          <p className="m-0" aria-live="polite">
            Estudiantes: {states.filter((v) => v !== "descartada").length} sugerencias aceptadas o útiles · {states.filter((v) => v === "descartada").length} descartadas · {students.filter((s) => openHelp(db, s.id)).length} esperando ayuda.
            {" "}Laboratorio: {summary.auc === null ? "sin medir" : `AUC ${summary.auc.toFixed(3)} (datos sintéticos)`}.
          </p>
        )}
        <p className="m-0">Estimación por reglas, no por la red del laboratorio. Es para ofrecer ayuda, nunca para sancionar.</p>
      </div>
      <Btn variant="ghost" onClick={onOpenLab}>Ver cómo aprende una red</Btn>
    </div>
  );
}
