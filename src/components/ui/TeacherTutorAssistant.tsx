
import { useEffect, useState } from "react";
import Card from "./Card";
import { askAI, type AiMessage } from "./aiClient";
import { assessments, courses } from "../../data/db";
import { best, course, progress, student } from "../../data/selectors";
import { myCourseIds, scopeStudents, shownName } from "../../data/scope";
import { useActionNotice } from "./useActionNotice";
import { useStore, useUser } from "../../store/Store";

type ChatLine = {
  role: "student" | "assistant";
  text: string;
  source: "ai" | "fallback";
};

const QUESTIONS = [
  "¿Qué estudiantes necesitan más apoyo?",
  "¿Qué curso tiene menor avance?",
  "¿Qué alumnos tienen evaluaciones pendientes?",
  "¿Qué temas debería reforzar con mi grupo?",
];

export default function TeacherTutorAssistant() {
  const { db } = useStore();
  const user = useUser();
  const { run, notice } = useActionNotice();

  const courseIds = myCourseIds(user);
  const teacherCourses = courses.filter((c) => courseIds.includes(c.id));
  const teacherStudents = scopeStudents(db, user);
  const studentIds = new Set(teacherStudents.map((s) => s.id));

  const assessmentIds = new Set(
    assessments
      .filter((a) => courseIds.includes(a.courseId))
      .map((a) => a.id)
  );

  const scopedEnrollments = db.enrollments.filter(
    (e) => studentIds.has(e.studentId) && courseIds.includes(e.courseId)
  );

  const [selectedCourse, setSelectedCourse] = useState(courseIds[0] ?? "");
  const [query, setQuery] = useState("");
  const [historyStudent, setHistoryStudent] = useState("");
  const [messages, setMessages] = useState<ChatLine[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`edumaster.teacher-tutor.${user.id}`) || "[]"
      ) as ChatLine[];

      return Array.isArray(saved)
        ? saved
            .filter(
              (x) =>
                x &&
                (x.role === "student" || x.role === "assistant") &&
                typeof x.text === "string"
            )
            .slice(-20)
        : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Básico");
  const [quantity, setQuantity] = useState(5);
  const [activityType, setActivityType] = useState("Ejercicios prácticos");
  const [activityDraft, setActivityDraft] = useState("");
  const [activityError, setActivityError] = useState("");
  const [activityBusy, setActivityBusy] = useState(false);

  const storageKey = `edumaster.teacher-tutor.${user.id}`;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    } catch {
      // El chat sigue disponible en memoria.
    }
  }, [messages, storageKey]);

  // Datos académicos y señales de seguimiento.
  const evidence = scopedEnrollments
    .flatMap((enrollment) => {
      const c = course(enrollment.courseId);
      const p = progress(db, enrollment.studentId, c.id);
      const score = best(db, enrollment.studentId, c.id);

      const attempts = db.attempts.filter(
        (a) =>
          a.studentId === enrollment.studentId &&
          assessmentIds.has(a.assessmentId)
      );

      const averageScore = attempts.length
        ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
        : null;

      const pending = db.submissions.filter(
        (s) =>
          s.studentId === enrollment.studentId &&
          s.courseId === c.id &&
          s.status === "pendiente"
      ).length;

      const last = db.learningEvents
        .filter(
          (e) =>
            e.studentId === enrollment.studentId && e.courseId === c.id
        )
        .reduce((latest, e) => Math.max(latest, Date.parse(e.at)), 0);

      const consultation = db.consultations.find(
        (x) =>
          x.studentId === enrollment.studentId &&
          x.courseId === c.id &&
          (x.status === "human_requested" || x.status === "fallback")
      );

      const signals = [
        p < 0.35
          ? `avance ${Math.round(p * 100)}% (umbral de revisión: menos de 35%)`
          : "",
        averageScore !== null && averageScore < 60
          ? `promedio de intentos ${Math.round(averageScore)} (referencia: menos de 60)`
          : "",
        pending ? `${pending} evaluación(es) pendiente(s) de calificación` : "",
        consultation?.status === "human_requested"
          ? "solicitó atención humana"
          : consultation
            ? "IA no disponible; falta revisión docente"
            : "",
      ].filter(Boolean);

      if (last && Date.now() - last > 14 * 24 * 60 * 60 * 1000) {
        signals.push("última actividad registrada hace más de 14 días");
      }

      if (!signals.length) return [];

      return [
        {
          studentId: enrollment.studentId,
          courseId: c.id,
          p,
          score,
          pending,
          last,
          signals,
          key: `${enrollment.studentId}:${c.id}`,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(
          b.signals.some((x) => x.includes("atención humana"))
        ) -
          Number(a.signals.some((x) => x.includes("atención humana"))) ||
        a.p - b.p
    );

  const alias = (id: string) =>
    `Estudiante ${Math.max(
      1,
      teacherStudents.findIndex((s) => s.id === id) + 1
    )}`;

  const aiContext = () => {
    const courseStats = teacherCourses.map((c) => {
      const rows = scopedEnrollments.filter((e) => e.courseId === c.id);

      const avgProgress = rows.length
        ? Math.round(
            (rows.reduce(
              (sum, e) => sum + progress(db, e.studentId, c.id),
              0
            ) *
              100) /
              rows.length
          )
        : null;

      const scores = db.attempts.filter(
        (a) =>
          assessmentIds.has(a.assessmentId) &&
          rows.some((e) => e.studentId === a.studentId)
      );

      const avgScore = scores.length
        ? Math.round(
            scores.reduce((sum, a) => sum + a.score, 0) / scores.length
          )
        : null;

      return `${c.title}: ${rows.length} matrículas, avance medio ${
        avgProgress === null ? "sin datos" : `${avgProgress}%`
      }, promedio de intentos ${avgScore ?? "sin datos"}`;
    });

    const studentStats = [
      ...new Set(scopedEnrollments.map((e) => e.studentId)),
    ].map((id) => {
      const rows = scopedEnrollments.filter((e) => e.studentId === id);

      return `${alias(id)}: ${rows
        .map((e) => {
          const c = course(e.courseId);
          const p = Math.round(progress(db, id, c.id) * 100);
          const score = best(db, id, c.id);

          const pending = db.submissions.filter(
            (s) =>
              s.studentId === id &&
              s.courseId === c.id &&
              s.status === "pendiente"
          ).length;

          const human = db.consultations.some(
            (x) =>
              x.studentId === id &&
              x.courseId === c.id &&
              (x.status === "human_requested" || x.status === "fallback")
          );

          return `${c.title} avance=${p}%, mejor intento=${
            score ?? "sin intentos"
          }, pendientes=${pending}, atención docente pendiente=${
            human ? "sí" : "no"
          }`;
        })
        .join("; ")}`;
    });

    return `Alcance autorizado del docente. Cursos: ${
      courseStats.join(" | ") || "sin cursos asignados"
    }. Estudiantes seudonimizados: ${
      studentStats.join(" | ") || "sin matrículas disponibles"
    }. Usa solo estos datos, indica cuando falte evidencia y no conviertas señales en diagnósticos.`;
  };

  const send = async (value = input) => {
    const text = value.trim();

    if (!text || chatBusy) return;

    setInput("");
    setChatError("");

    const sentMessage: ChatLine = {
      role: "student",
      text,
      source: "ai",
    };

    const next = [...messages, sentMessage].slice(-20);
    setMessages(next);
    setChatBusy(true);

    const history: AiMessage[] = next.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const result = await askAI("tutor", history, aiContext());

    const receivedMessage: ChatLine = {
      role: "assistant",
      text:
        result.source === "ai"
          ? result.text
          : "La IA no respondió; no se generó un análisis. Revisa el error y vuelve a intentarlo cuando el proveedor esté disponible.",
      source: result.source,
    };

    setMessages([...next, receivedMessage].slice(-20));

    if (result.unavailable) {
      setChatError(
        result.error ||
          "La IA no está disponible. No se generó una respuesta inteligente."
      );
    }

    setChatBusy(false);
  };

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedCourse || !topic.trim() || activityBusy) return;

    setActivityDraft("");
    setActivityError("");
    setActivityBusy(true);

    const c = course(selectedCourse);

    const prompt = `Prepara ${quantity} ${activityType.toLowerCase()} sobre «${topic.trim()}» para ${c.title}. Nivel ${level}. Entrega instrucciones claras, contenido editable y respuestas explicadas en una sección separada. No afirmes que se publica automáticamente.`;

    const result = await askAI(
      "tutor",
      [{ role: "student", text: prompt }],
      `Herramienta de apoyo docente. Curso asignado: ${c.title}. Nivel: ${level}. Responde como material sugerido, nunca como evaluación oficial.`
    );

    if (result.source === "ai") {
      setActivityDraft(result.text);
    } else {
      setActivityError(
        result.error ||
          "La IA no está disponible; no se generó contenido de actividad."
      );
    }

    setActivityBusy(false);
  };

  const visibleEvidence = evidence.filter(
    (x) =>
      (!selectedCourse || x.courseId === selectedCourse) &&
      (!query ||
        `${shownName(user, student(x.studentId))} ${course(
          x.courseId
        ).title}`
          .toLowerCase()
          .includes(query.toLowerCase()))
  );

  const history = historyStudent
    ? {
        events: db.learningEvents
          .filter(
            (e) =>
              e.studentId === historyStudent && courseIds.includes(e.courseId)
          )
          .slice(0, 10),

        attempts: db.attempts
          .filter(
            (a) =>
              a.studentId === historyStudent &&
              assessmentIds.has(a.assessmentId)
          )
          .slice(0, 10),
      }
    : null;

  const mark = (
    item: (typeof evidence)[number],
    sendToStudent = false
  ) =>
    run({
      t: "review",
      key: item.key,
      comment: sendToStudent
        ? `Recomendación de seguimiento en ${course(item.courseId).title}: ${item.signals.join(
            "; "
          )}. Revisemos juntos el siguiente paso.`
        : `Se revisó la señal en ${course(item.courseId).title}: ${item.signals.join(
            "; "
          )}.`,
    });

  const highPriority = evidence.filter(
    (x) =>
      x.p < 0.2 ||
      x.signals.some(
        (s) =>
          s.includes("atención humana") || s.includes("revisión docente")
      )
  ).length;

  const pendingCount = evidence.filter((x) => x.pending > 0).length;

  return (
    <div className="space-y-5">

      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-em-text">
            Panel docente
          </h2>
          <p className="mt-1 text-sm text-em-muted">
            Seguimiento académico y herramientas inteligentes
          </p>
        </div>

        <span className="badge">Asistente IA</span>
      </div>

      
{/* INDICADORES */}
<div
  className="grid w-full self-stretch grid-cols-1 gap-4 sm:grid-cols-3"
  style={{ width: "100%", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
>
  <div className="flex min-h-[155px] w-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-6">
    <div className="flex items-center justify-between">
      <span className="text-sm text-em-muted">Cursos asignados</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-xl">📚</span>
    </div>
    <div>
      <p className="m-0 text-3xl font-bold text-em-text">{teacherCourses.length}</p>
      <p className="mb-0 mt-1 text-sm text-em-muted">Cursos disponibles</p>
    </div>
  </div>

  <div className="flex min-h-[155px] w-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-6">
    <div className="flex items-center justify-between">
      <span className="text-sm text-em-muted">Estudiantes</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-xl">👥</span>
    </div>
    <div>
      <p className="m-0 text-3xl font-bold text-em-text">{teacherStudents.length}</p>
      <p className="mb-0 mt-1 text-sm text-em-muted">En tu alcance académico</p>
    </div>
  </div>

  <div className="flex min-h-[155px] w-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-6">
    <div className="flex items-center justify-between">
      <span className="text-sm text-em-muted">Alertas prioritarias</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-xl">⚠️</span>
    </div>
    <div>
      <p className="m-0 text-3xl font-bold text-em-text">{highPriority}</p>
      <p className="mb-0 mt-1 text-sm text-em-muted">{pendingCount} con evaluaciones pendientes</p>
    </div>
  </div>
</div>


      {/* SEGUIMIENTO */}
      <Card
        title="Seguimiento académico"
        right={
          <span className="text-xs text-em-muted">
            {visibleEvidence.length} señales
          </span>
        }
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Buscar estudiante"
            placeholder="Buscar estudiante..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1"
          />

          <select
            aria-label="Filtrar señales por curso"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="sm:max-w-[220px]"
          >
            <option value="">Todos tus cursos</option>
            {teacherCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {visibleEvidence.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
            <div className="mb-2 text-2xl">✓</div>
            <p className="m-0 text-sm font-medium text-em-text">
              No hay alertas para mostrar
            </p>
            <p className="mb-0 mt-1 text-xs text-em-muted">
              No se encontraron señales con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEvidence.map((item) => {
              const reviewed = db.reviews[item.key];
              const priority =
                item.p < 0.2 ||
                item.signals.some(
                  (x) =>
                    x.includes("atención humana") ||
                    x.includes("revisión docente")
                );

              return (
                <article
                  key={item.key}
                  className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <strong className="text-sm text-em-text">
                        {shownName(user, student(item.studentId))}
                      </strong>

                      <p className="mb-0 mt-1 text-xs text-em-muted">
                        {course(item.courseId).title}
                      </p>
                    </div>

                    <span
                      className={`badge ${
                        priority ? "warn" : ""
                      }`}
                    >
                      {reviewed
                        ? "Revisado"
                        : priority
                          ? "Prioridad alta"
                          : "Pendiente"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.signals.map((signal, index) => (
                      <span
                        key={index}
                        className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-em-muted"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setHistoryStudent(item.studentId);
                        setQuery(
                          shownName(user, student(item.studentId))
                        );
                      }}
                    >
                      Ver historial
                    </button>

                    <button
                      type="button"
                      className="ghost"
                      onClick={() => mark(item)}
                    >
                      {reviewed ? "Actualizar revisión" : "Marcar revisado"}
                    </button>

                    <button
                      type="button"
                      onClick={() => mark(item, true)}
                    >
                      Enviar recomendación
                    </button>
                  </div>

                  {reviewed && (
                    <p className="mb-0 mt-3 text-xs text-em-muted">
                      Seguimiento: {reviewed.comment} ·{" "}
                      {new Date(reviewed.at).toLocaleString("es-PE")}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {historyStudent && history && (
          <div className="mt-4 rounded-xl border border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <strong className="text-sm">
                Historial de{" "}
                {shownName(user, student(historyStudent))}
              </strong>

              <button
                type="button"
                className="ghost"
                onClick={() => setHistoryStudent("")}
              >
                Cerrar
              </button>
            </div>

            <p className="mb-2 text-xs font-semibold text-em-muted">
              Actividad registrada
            </p>

            {history.events.length ? (
              <ul className="space-y-2 text-xs text-em-text">
                {history.events.map((e) => (
                  <li key={e.id}>
                    {course(e.courseId).title} · {e.type} ·{" "}
                    {new Date(e.at).toLocaleString("es-PE")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-em-muted">
                Sin eventos de aprendizaje disponibles.
              </p>
            )}

            <p className="mb-2 mt-4 text-xs font-semibold text-em-muted">
              Intentos de evaluación
            </p>

            {history.attempts.length ? (
              <ul className="space-y-2 text-xs text-em-text">
                {history.attempts.map((a) => (
                  <li key={a.id}>
                    {assessments.find((x) => x.id === a.assessmentId)
                      ?.title ?? a.assessmentId}{" "}
                    · {a.score} puntos ·{" "}
                    {new Date(a.at).toLocaleDateString("es-PE")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-em-muted">
                Sin intentos disponibles.
              </p>
            )}
          </div>
        )}

        {notice}
      </Card>

      {/* ASISTENTE IA */}
      <Card
        title="Asistente inteligente"
        right={<span className="badge">IA docente</span>}
      >
        <p className="mb-3 mt-0 text-xs text-em-muted">
          Consulta información de tus cursos y recibe sugerencias para
          mejorar el aprendizaje.
        </p>

        <div
          role="log"
          aria-live="polite"
          className="max-h-[360px] min-h-[180px] space-y-3 overflow-auto rounded-xl border border-white/10 bg-white/[0.025] p-3"
        >
          {messages.length === 0 && (
            <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
              <div className="mb-2 text-3xl">✦</div>
              <p className="m-0 text-sm font-semibold text-em-text">
                ¿En qué puedo ayudarte?
              </p>
              <p className="mb-4 mt-1 text-xs text-em-muted">
                Selecciona una consulta para comenzar.
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {QUESTIONS.map((q) => (
                  <button
                    type="button"
                    className="ghost"
                    key={q}
                    onClick={() => void send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${i}-${m.text.slice(0, 12)}`}
              className={`max-w-[90%] rounded-xl p-3 text-sm ${
                m.role === "student"
                  ? "ml-auto bg-em-blue/20"
                  : "bg-white/[0.06]"
              }`}
            >
              <div className="mb-1 text-[10px] font-semibold uppercase text-em-muted">
                {m.role === "student"
                  ? "Tú"
                  : m.source === "ai"
                    ? "Asistente IA"
                    : "Respuesta de respaldo"}
              </div>

              <p className="m-0 whitespace-pre-wrap text-em-text">
                {m.text}
              </p>
            </div>
          ))}

          {chatBusy && (
            <p className="m-0 text-xs text-em-muted">
              El asistente está preparando una respuesta...
            </p>
          )}
        </div>

        {chatError && (
          <p role="alert" className="mt-2 text-xs text-amber-300">
            {chatError}
          </p>
        )}

        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            id="teacher-ai-question"
            className="min-w-0 flex-1"
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu consulta..."
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!input.trim() || chatBusy}
            >
              Enviar
            </button>

            <button
              type="button"
              className="ghost"
              disabled={chatBusy}
              onClick={() => {
                setMessages([]);
                setChatError("");
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </Card>

      {/* GENERADOR DE ACTIVIDADES */}
      <Card title="Herramientas docentes">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-lg">
                ✎
              </div>

              <div>
                <p className="m-0 text-sm font-semibold text-em-text">
                  Generador de actividades
                </p>
                <p className="m-0 mt-1 text-xs text-em-muted">
                  Crea ejercicios y material de aprendizaje con IA.
                </p>
              </div>
            </div>

            <span className="text-sm text-em-muted transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>

          <div className="mt-4 border-t border-white/10 pt-4">
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={generate}
            >
              <label className="flex flex-col gap-1 text-xs text-em-muted">
                Curso asignado
                <select
                  required
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  <option value="" disabled>
                    Selecciona un curso
                  </option>

                  {teacherCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-em-muted">
                Tema
                <input
                  required
                  maxLength={120}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej. variables y tipos de datos"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-em-muted">
                Tipo de actividad
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                  {[
                    "Ejercicios prácticos",
                    "Cuestionario de opción múltiple",
                    "Preguntas abiertas",
                    "Caso práctico",
                    "Material de repaso",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-em-muted">
                  Nivel
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    {["Básico", "Intermedio", "Avanzado"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-em-muted">
                  Cantidad
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  >
                    {[3, 5, 10].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={
                    activityBusy || !topic.trim() || !selectedCourse
                  }
                >
                  {activityBusy
                    ? "Generando actividad..."
                    : "Generar actividad"}
                </button>
              </div>
            </form>

            {activityBusy && (
              <p role="status" className="mt-3 text-xs text-em-muted">
                Esperando respuesta del proveedor...
              </p>
            )}

            {activityError && (
              <p role="alert" className="mt-3 text-xs text-amber-300">
                {activityError}
              </p>
            )}

            {activityDraft && (
              <div className="mt-4">
                <label className="mb-2 block text-xs text-em-muted">
                  Propuesta generada · editable
                </label>

                <textarea
                  className="min-h-56 w-full"
                  value={activityDraft}
                  onChange={(e) => setActivityDraft(e.target.value)}
                />

                <p className="mt-2 text-xs text-em-muted">
                  Revisa y edita el contenido antes de utilizarlo. No se
                  publica automáticamente ni se añade a evaluaciones.
                </p>
              </div>
            )}

            {!teacherCourses.length && (
              <p className="mt-3 text-xs text-em-muted">
                No tienes cursos asignados para generar actividades.
              </p>
            )}
          </div>
        </details>
      </Card>
    </div>
  );
}
