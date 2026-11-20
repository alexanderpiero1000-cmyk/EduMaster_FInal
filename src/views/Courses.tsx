import { useState } from "react";
import type { Course, CourseStatus } from "../data/db";
import { courses, courseUnits, lessons, courseResources, courseVersions, instructors, skills } from "../data/db";
import { enrollment, prereqMet, progress } from "../data/selectors";
import { useStore } from "../store/Store";

const generateCourseCode = () => {
  const generated = courses
    .map((course) => Number(course.code.match(/\d+$/)?.[0] ?? 0))
    .reduce((max, value) => Math.max(max, value), 0);
  return `CUR-${String(generated + 1).padStart(3, "0")}`;
};

const emptyCourse = (): Course => ({
  id: "",
  code: "",
  title: "",
  description: "",
  level: "Básico",
  instructor: "Prof. Medina",
  instructorId: "t1",
  collaboratorIds: [],
  tags: [],
  status: "borrador",
  lessons: 1,
  hpl: 1,
  skills: [],
});

export default function Courses() {
  const { db, act, sid } = useStore();
  const [q, setQ] = useState(""), [lvl, setLvl] = useState(""), [statusFilter, setStatusFilter] = useState<CourseStatus | "">(""), [draft, setDraft] = useState<Course | null>(null), [versionSummary, setVersionSummary] = useState("Actualización de contenido del curso");
  const [activeView, setActiveView] = useState<"catalog" | "mine">("catalog");
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [editorTab, setEditorTab] = useState<"general" | "versions">("general");

  const rows = courses.filter((c) =>
    (c.title + c.code + c.description + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase())
    && (!lvl || c.level === lvl)
    && (!statusFilter || c.status === statusFilter)
  );

  const saveCourse = () => {
    if (!draft || !draft.code.trim() || !draft.title.trim()) return;
    const cleaned = {
      ...draft,
      code: draft.code.trim().toUpperCase(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      collaboratorIds: (draft.collaboratorIds ?? []).filter((id) => id !== draft.instructorId),
    };

    if (draft.id) {
      const index = courses.findIndex((c) => c.id === draft.id);
      if (index >= 0) courses[index] = cleaned;
      act({ t: "log", type: "course.updated", text: `Curso actualizado: ${cleaned.title} · Responsable: ${cleaned.instructor} · Colaboradores: ${cleaned.collaboratorIds?.length ?? 0}` });
    } else {
      const id = `c${Date.now()}`;
      courses.push({ ...cleaned, id });
      act({ t: "log", type: "course.created", text: `Curso creado: ${cleaned.title} · Responsable: ${cleaned.instructor} · Colaboradores: ${cleaned.collaboratorIds?.length ?? 0}` });
    }
    setDraft(null);
  };

  const addVersion = (target: Course, status: "borrador" | "publicada") => {
    const versions = courseVersions.filter((v) => v.courseId === target.id);
    const number = versions.length ? Math.max(...versions.map((v) => v.number)) + 1 : 1;
    courseVersions.unshift({
      id: `${target.id}-v${number}-${Date.now()}`,
      courseId: target.id,
      number,
      author: target.instructor,
      at: new Date().toISOString(),
      summary: versionSummary.trim() || "Actualización de contenido del curso",
      status,
    });
    act({ t: "log", type: status === "publicada" ? "course.version.published" : "course.version.draft", text: `${target.title} · Versión ${number} ${status === "publicada" ? "publicada" : "guardada como borrador"}` });
  };

  const setCourseStatus = (target: Course, status: CourseStatus) => {
    const index = courses.findIndex((c) => c.id === target.id);
    if (index < 0) return;
    courses[index] = { ...target, status };
    act({ t: "log", type: `course.${status}`, text: `${target.title} pasó a estado ${status}` });
  };

  const openEditor = (course?: Course) => {
    setEditorTab("general");
    setDraft(course ? {
      ...course,
      tags: [...course.tags],
      skills: course.skills.map((s) => ({ ...s })),
      collaboratorIds: [...(course.collaboratorIds ?? [])],
    } : emptyCourse());
  };

  return (
    <div className="course-module">
      <div className="course-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={activeView === "catalog"} className={`course-tab ${activeView === "catalog" ? "active" : ""}`} onClick={() => setActiveView("catalog")}>Catálogo de cursos</button>
        <button type="button" role="tab" aria-selected={activeView === "mine"} className={`course-tab ${activeView === "mine" ? "active" : ""}`} onClick={() => setActiveView("mine")}>Mis cursos</button>
      </div>

      {activeView === "catalog" && (
        <section className="card course-section">
          <div className="course-section-head">
            <div><h2>Catálogo de cursos</h2><p className="muted small">Explora los programas disponibles y revisa su información completa.</p></div>
            <button type="button" onClick={() => openEditor()}>Crear curso</button>
          </div>
          <div className="course-filters">
            <input placeholder="Buscar por nombre, código o etiqueta" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={lvl} onChange={(e) => setLvl(e.target.value)}><option value="">Todos los niveles</option><option>Básico</option><option>Intermedio</option><option>Avanzado</option></select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CourseStatus | "")}><option value="">Todos los estados</option><option value="borrador">Borrador</option><option value="publicado">Publicado</option><option value="archivado">Archivado</option></select>
          </div>
          <div className="course-grid">
            {rows.map((c) => {
              const enrolled = db.enrollments.filter((e) => e.courseId === c.id).length;
              const mine = enrollment(db, sid, c.id);
              return (
                <article key={c.id} className="course-card" role="button" tabIndex={0} onClick={() => setDetailCourse(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDetailCourse(c); }}>
                  <div className="course-card-top"><span className="course-code">{c.code}</span><span className={`badge ${c.status === "publicado" ? "live" : c.status === "archivado" ? "warn" : "demo"}`}>{c.status}</span></div>
                  <h3>{c.title}</h3>
                  <p>{c.description}</p>
                  <div className="course-meta"><span><b>{c.level}</b><small>Nivel</small></span><span><b>{enrolled}</b><small>Inscritos</small></span><span><b>{c.lessons}</b><small>Lecciones</small></span></div>
                  <div className="course-card-footer"><div><span className="muted small">Docente responsable</span><strong>{c.instructor}</strong></div>
                    <div className="course-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="ghost" onClick={() => openEditor(c)}>Editar</button>
                      {!mine && c.status === "publicado" && <button type="button" disabled={!prereqMet(db, sid, c.id)} onClick={() => act({ t: "enroll", s: sid, c: c.id })}>Inscribirme</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {rows.length === 0 && <div className="empty-state"><h3>No se encontraron cursos</h3><p className="muted">Prueba a modificar los filtros de búsqueda.</p></div>}
        </section>
      )}

      {activeView === "mine" && (
        <section className="card course-section">
          <div className="course-section-head"><div><h2>Mis cursos</h2><p className="muted small">Cursos en los que estás inscrito y su progreso actual.</p></div></div>
          <div className="course-grid">
            {courses.filter((c) => enrollment(db, sid, c.id)).map((c) => {
              const mine = enrollment(db, sid, c.id)!;
              const pct = progress(db, sid, c.id) * 100;
              return <article key={c.id} className="course-card mine" role="button" tabIndex={0} onClick={() => setDetailCourse(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDetailCourse(c); }}>
                <div className="course-card-top"><span className="course-code">{c.code}</span><span className="badge live">Inscrito</span></div>
                <h3>{c.title}</h3><p>{c.description}</p>
                <div className="progress-header"><span className="muted small">Progreso</span><b>{Math.round(pct)}%</b></div>
                <div className="progress-track"><i style={{ width: `${pct}%` }} /></div>
                <div className="course-card-footer"><div><span className="muted small">{mine.done}/{c.lessons} lecciones completadas</span><strong>{c.instructor}</strong></div><button type="button" onClick={(e) => { e.stopPropagation(); setDetailCourse(c); }}>Continuar</button></div>
              </article>;
            })}
          </div>
          {!courses.some((c) => enrollment(db, sid, c.id)) && <div className="empty-state"><h3>Aún no tienes cursos inscritos</h3><p className="muted">Abre el catálogo para encontrar tu próxima inscripción.</p></div>}
        </section>
      )}

      {detailCourse && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailCourse(null); }}>
          <section className="modal course-detail-modal" role="dialog" aria-modal="true" aria-label={`Detalle de ${detailCourse.title}`}>
            <div className="modal-head"><div><span className="course-code">{detailCourse.code}</span><h2>{detailCourse.title}</h2></div><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setDetailCourse(null)}>×</button></div>
            <div className="course-detail-body">
              <div className="course-detail-main"><p>{detailCourse.description}</p>
                <div className="detail-tags">{detailCourse.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                <h3>Contenido del curso</h3>
                {(() => {
                  const mine = enrollment(db, sid, detailCourse.id);
                  const courseLessons = lessons.filter((l) => l.courseId === detailCourse.id);
                  const completed = mine?.done ?? 0;
                  return <div className="unit-list">
                    {courseUnits.filter((u) => u.courseId === detailCourse.id).map((unit) => {
                      const unitLessons = courseLessons.filter((l) => l.unitId === unit.id);
                      return <div key={unit.id} className="unit-block">
                        <div className="unit-header"><b>{unit.title}</b><span className="muted small">{unitLessons.length} lecciones</span></div>
                        {mine && unitLessons.map((lesson) => {
                          const lessonIndex = courseLessons.findIndex((l) => l.id === lesson.id);
                          const isCompleted = lessonIndex < completed;
                          const isAvailable = lessonIndex <= completed;
                          const resources = courseResources.filter((r) => r.lessonId === lesson.id);
                          return <div key={lesson.id} className="lesson-row">
                            <div className="lesson-info"><b>{lesson.title}</b><span className="muted small">{lesson.type} · {lesson.duration} min</span>
                              {resources.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className={`resource-link ${isAvailable ? "" : "blocked"}`} onClick={(e) => { if (!isAvailable) e.preventDefault(); else act({ t: "learning", type: "resource.consumed", s: sid, c: detailCourse.id, entityId: resource.id }); }}>{resource.type === "video" ? "▶" : resource.type === "enlace" ? "↗" : "◫"} {resource.title}</a>)}
                            </div>
                            {isCompleted ? <span className="badge live">Completada</span> : isAvailable ? <button type="button" onClick={() => { act({ t: "learning", type: "lesson.started", s: sid, c: detailCourse.id, entityId: lesson.id }); act({ t: "lesson", s: sid, c: detailCourse.id }); act({ t: "learning", type: "lesson.completed", s: sid, c: detailCourse.id, entityId: lesson.id }); }}>Completar</button> : <span className="badge">Bloqueada</span>}
                          </div>;
                        })}
                      </div>;
                    })}
                  </div>;
                })()}
              </div>
              <aside className="course-detail-side">
                <div><span className="muted small">Nivel</span><strong>{detailCourse.level}</strong></div>
                <div><span className="muted small">Docente responsable</span><strong>{detailCourse.instructor}</strong></div>
                <div><span className="muted small">Duración estimada</span><strong>{detailCourse.hpl} h por módulo</strong></div>
                <div><span className="muted small">Estado</span><strong>{detailCourse.status}</strong></div>
                {enrollment(db, sid, detailCourse.id) ? <button type="button" onClick={() => setActiveView("mine")}>Ir a Mis cursos</button> : <button type="button" disabled={detailCourse.status !== "publicado" || !prereqMet(db, sid, detailCourse.id)} onClick={() => act({ t: "enroll", s: sid, c: detailCourse.id })}>Inscribirme</button>}
              </aside>
            </div>
          </section>
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDraft(null); }}>
          <section className="modal course-editor-modal" role="dialog" aria-modal="true" aria-label={draft.id ? "Editar curso" : "Crear curso"}>
            <div className="modal-head"><div><span className="muted small">{draft.id ? "Administración del curso" : "Nuevo programa"}</span><h2>{draft.id ? "Editar curso" : "Crear curso"}</h2></div><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setDraft(null)}>×</button></div>
            <div className="editor-tabs"><button type="button" className={editorTab === "general" ? "active" : ""} onClick={() => setEditorTab("general")}>Información general</button><button type="button" className={editorTab === "versions" ? "active" : ""} onClick={() => setEditorTab("versions")}>Versionado y publicación</button></div>
            {editorTab === "general" ? (
              <div className="editor-grid">
                <label><span>Código generado</span><input className="readonly-code" value={draft.code || generateCourseCode()} readOnly disabled aria-label="Código automático del curso" /></label>
                <label><span>Título</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
                <label className="editor-wide"><span>Descripción</span><textarea rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
                <label><span>Nivel</span><select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}><option>Básico</option><option>Intermedio</option><option>Avanzado</option></select></label>
                <label><span>Docente responsable</span><select value={draft.instructorId} onChange={(e) => { const instructor = instructors.find((i) => i.id === e.target.value)!; setDraft({ ...draft, instructorId: instructor.id, instructor: instructor.name, collaboratorIds: (draft.collaboratorIds ?? []).filter((id) => id !== instructor.id) }); }}>{instructors.filter((i) => i.status === "activo").map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
                <label><span>Lecciones</span><input type="number" min={1} value={draft.lessons} onChange={(e) => setDraft({ ...draft, lessons: Math.max(1, Number(e.target.value)) })} /></label>
                <label><span>Etiquetas</span><input value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label>
                <fieldset className="editor-wide collaborator-field"><legend>Colaboradores</legend><div className="collaborator-options">{instructors.filter((i) => i.status === "activo" && i.id !== draft.instructorId).map((instructor) => { const selected = draft.collaboratorIds?.includes(instructor.id) ?? false; return <label key={instructor.id}><input type="checkbox" checked={selected} onChange={(e) => setDraft({ ...draft, collaboratorIds: e.target.checked ? [...(draft.collaboratorIds ?? []), instructor.id] : (draft.collaboratorIds ?? []).filter((id) => id !== instructor.id) })} /><span><b>{instructor.name}</b><small>{instructor.specialty}</small></span></label>; })}</div></fieldset>
                <label><span>Estado</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CourseStatus })}><option value="borrador">Borrador</option><option value="publicado">Publicado</option><option value="archivado">Archivado</option></select></label>
                <fieldset className="editor-wide"><legend>Competencias</legend><div className="skill-options">{skills.map((skill) => { const selected = draft.skills.find((s) => s.id === skill.id); return <label key={skill.id} className={selected ? "selected" : ""}><input type="checkbox" checked={!!selected} onChange={(e) => setDraft({ ...draft, skills: e.target.checked ? [...draft.skills, { id: skill.id, w: 1 }] : draft.skills.filter((s) => s.id !== skill.id) })} /><span><b>{skill.name}</b><small>{selected ? "Asociada al curso" : "No asociada"}</small></span></label>; })}</div></fieldset>
              </div>
            ) : (
              <div className="version-panel">
                <label><span>Resumen de cambios</span><textarea rows={3} value={versionSummary} onChange={(e) => setVersionSummary(e.target.value)} /></label>
                <div className="version-actions"><button type="button" className="ghost" disabled={!draft.id} onClick={() => addVersion(draft, "borrador")}>Guardar borrador de versión</button><button type="button" disabled={!draft.id} onClick={() => { addVersion(draft, "publicada"); setCourseStatus(draft, "publicado"); }}>Publicar versión</button></div>
                <div className="version-history">{draft.id && courseVersions.filter((v) => v.courseId === draft.id).map((v) => <div key={v.id} className="version-row"><div><b>Versión {v.number}</b><span>{v.summary}</span><small>{v.author} · {new Date(v.at).toLocaleString("es-PE")}</small></div><span className={`badge ${v.status === "publicada" ? "live" : "demo"}`}>{v.status}</span></div>)}</div>
              </div>
            )}
            <div className="modal-actions"><button type="button" className="ghost" onClick={() => setDraft(null)}>Cancelar</button><button type="button" disabled={!draft.code.trim() || !draft.title.trim()} onClick={saveCourse}>{draft.id ? "Guardar cambios" : "Crear curso"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
