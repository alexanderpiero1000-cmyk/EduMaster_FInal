import { useEffect, useState } from "react";
import { useStore } from "../../store/Store";
import { course } from "../../data/selectors";
import { askAI } from "./aiClient";
import type { ChatMessage } from "../../data/db";

const FAQ = [
  "¿Qué cursos estoy llevando?",
  "¿Qué tareas tengo pendientes?",
  "¿Cuándo es mi próximo examen?",
  "¿Cómo consulto mis certificados?",
];

export default function EduChatbot() {
  const { db, sid } = useStore();
  const key = `edumaster.chat.${sid}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]") as ChatMessage[];
      if (Array.isArray(saved)) setMessages(saved);
    } catch { setMessages([]); }
  }, [key]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(messages)); } catch { /* sigue disponible en memoria */ } }, [key, messages]);

  const localReply = (text: string) => {
    const q = text.toLowerCase();
    const enrolled = db.enrollments.filter((e) => e.studentId === sid);
    if (q.includes("curso")) return `Tus cursos actuales son: ${enrolled.map((e) => course(e.courseId).title).join(", ") || "ninguno registrado"}.`;
    if (q.includes("tarea") || q.includes("pendiente")) {
      const pending = db.submissions.filter((x) => x.studentId === sid && x.status === "pendiente").length;
      const unfinished = enrolled.filter((e) => e.done < course(e.courseId).lessons).length;
      return `Tienes ${unfinished} curso(s) con lecciones pendientes y ${pending} evaluación(es) entregada(s) por calificar.`;
    }
    if (q.includes("examen") || q.includes("evaluación")) return "Revisa el módulo Evaluaciones. Allí encontrarás tus entregas y el estado de cada evaluación.";
    if (q.includes("certificado")) return "Los certificados aparecen al completar el curso y aprobar la evaluación con la calificación requerida.";
    if (q.includes("certificat")) return "Consulta tus certificados en el módulo Certificados.";
    return "Puedo ayudarte con cursos, tareas, evaluaciones y certificados. Para explicaciones de temas, usa el IA Tutor.";
  };

  const send = async (textValue = input) => {
    const text = textValue.trim();
    if (!text || busy) return;
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "student", text, at: new Date().toISOString(), source: "local" }];
    setMessages(next);
    setBusy(true);
    const context = db.enrollments.filter((e) => e.studentId === sid).map((e) => {
      const c = course(e.courseId);
      return `${c.title}: ${e.done}/${c.lessons} lecciones`;
    }).join("; ");
    const result = await askAI("chatbot", next.map((m) => ({ role: m.role, text: m.text })), context);
    const reply = result.source === "ai"
      ? result.text
      : `IA no disponible${result.error ? ` (${result.error})` : ""}. Respuesta local: ${localReply(text)}`;
    setMessages([...next, { role: "assistant", text: reply, at: new Date().toISOString(), source: result.source === "ai" ? "ai" : "local" }]);
    setBusy(false);
  };

  const newChat = () => { setMessages([]); try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ } };

  return (
    <>
      <button type="button" aria-label={open ? "Cerrar chatbot" : "Abrir chatbot"} onClick={() => setOpen((v) => !v)}
        style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, borderRadius: 999, padding: "12px 16px" }}>
        {open ? "Cerrar" : "Asistente"}
      </button>
      {open && (
        <section aria-label="Chatbot educativo" style={{ position: "fixed", right: 18, bottom: 68, zIndex: 80, width: "min(360px, calc(100vw - 36px))" }} className="card">
          <div className="card-head"><strong>Asistente EduMaster</strong><button type="button" className="ghost" onClick={newChat}>Nueva conversación</button></div>
          <div role="log" aria-live="polite" style={{ maxHeight: 300, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.length === 0 && <div className="flex flex-wrap gap-2">{FAQ.map((q) => <button type="button" key={q} className="ghost" onClick={() => void send(q)}>{q}</button>)}</div>}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "student" ? "flex-end" : "flex-start", maxWidth: "85%", borderRadius: 14, padding: "8px 10px", background: m.role === "student" ? "rgba(8,127,229,.28)" : "rgba(143,166,196,.10)" }}>
                <small className="muted">{m.role === "student" ? "Alumno" : m.source === "ai" ? "Asistente IA" : "Asistente"}</small>
                <div>{m.text}</div>
              </div>
            ))}
            {busy && <div className="muted small">El asistente está escribiendo…</div>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-3 flex gap-2">
            <input className="min-w-0 flex-1" maxLength={2000} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe tu consulta" />
            <button type="submit" disabled={busy || !input.trim()}>Enviar</button>
          </form>
        </section>
      )}
    </>
  );
}
