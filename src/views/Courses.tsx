import { useState } from "react";
import Icon from "../components/ui/Icon";
import { useActionNotice } from "../components/ui/useActionNotice";
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
  const { db, act, sid, can, canManage, user } = useStore();
  const { run, deny, notice } = useActionNotice();
  /** Permiso sobre el curso ya existente; avisa si no lo hay. */
  const allowed = (id: string) => { const original = courses.find((c) => c.id === id); const ok = !!original && canManage(original); if (!ok) deny(); return ok; };
  const [q, setQ] = useState(""), [lvl, setLvl] = useState(""), [statusFilter, setStatusFilter] = useState<CourseStatus | "">(""), [draft, setDraft] = useState<Course | null>(null), [versionSummary, setVersionSummary] = useState("Actualización de contenido del curso");
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [editorTab, setEditorTab] = useState<"general" | "versions">("general");
  const teaching = user?.role === "docente";
  const myCourses = courses.filter((c) => (teaching ? canManage(c) : !!enrollment(db, sid, c.id)));
  const completeNext = (c: Course) => {
    const done = enrollment(db, sid, c.id)?.done ?? 0, lesson = lessons.filter((l) => l.courseId === c.id)[done];
    if (!run({ t: "learning", type: "lesson.started", s: sid, c: c.id, entityId: lesson?.id })) return;
    act({ t: "lesson", s: sid, c: c.id });
    act({ t: "learning", type: "lesson.completed", s: sid, c: c.id, entityId: lesson?.id });
  };

  const rows = courses.filter((c) =>
    (c.title + c.code + c.description + c.tags.join(" ")).toLowerCase().includes(q.toLowerCase())
    && (!lvl || c.level === lvl)
    && (!statusFilter || c.status === statusFilter)
  );

  const saveCourse = () => {
    if (!draft || !draft.code.trim() || !draft.title.trim()) return;
    if (draft.id ? !allowed(draft.id) : !can("course.manage")) { if (!draft.id) deny(); return; }
    const cleaned = {
      ...draft,
      code: draft.code.trim().toUpperCase(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      collaboratorIds: (draft.collaboratorIds ?? []).filter((id) => id !== draft.instructorId),
    };

    if (draft.id) {
      const index = courses.findIndex((c) => c.id === draft.id);
      if (!run({ t: "course", c: draft.id, kind: "course.updated", text: `Curso actualizado: ${cleaned.title} · Responsable: ${cleaned.instructor}` })) return;
      if (index >= 0) courses[index] = cleaned;
    } else {
      const id = `c${Date.now()}`;
      if (!run({ t: "course", c: id, kind: "course.created", text: `Curso creado: ${cleaned.title} · Responsable: ${cleaned.instructor}` })) return;
      courses.push({ ...cleaned, id });
    }
    setDraft(null);
  };

  const addVersion = (target: Course, status: "borrador" | "publicada") => {
    if (!allowed(target.id)) return;
    const versions = courseVersions.filter((v) => v.courseId === target.id);
    const number = versions.length ? Math.max(...versions.map((v) => v.number)) + 1 : 1;
    if (!run({ t: "course", c: target.id, kind: status === "publicada" ? "course.version.published" : "course.version.draft", text: `${target.title} · Versión ${number} ${status === "publicada" ? "publicada" : "guardada como borrador"}` })) return;
    courseVersions.unshift({
      id: `${target.id}-v${number}-${Date.now()}`,
      courseId: target.id,
      number,
      author: target.instructor,
      at: new Date().toISOString(),
      summary: versionSummary.trim() || "Actualización de contenido del curso",
      status,
    });
  };

  const setCourseStatus = (target: Course, status: CourseStatus) => {
    const index = courses.findIndex((c) => c.id === target.id);
    if (index < 0 || !allowed(target.id)) return;
    if (!run({ t: "course", c: target.id, kind: `course.${status}`, text: `${target.title} pasó a estado ${status}` })) return;
    courses[index] = { ...target, status };
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

      {(
        <section className="card course-section">
          <div className="course-section-head">
            <div><h2>Catálogo de cursos</h2><p className="muted small">{user?.role === "superadmin" ? "Crea, edita y publica cualquier curso." : teaching ? "Consulta de todo el catálogo (solo lectura)." : "Explora los programas e inscríbete (se validan los prerrequisitos)."}</p></div>
            {can("course.manage") && user?.role !== "docente" && <button type="button" onClick={() => openEditor()}>Crear curso</button>}
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
                      {canManage(c) && !teaching && <button type="button" className="ghost" onClick={() => openEditor(c)}>Editar</button>}
                      {can("learn") && !mine && c.status === "publicado" && <button type="button" disabled={!prereqMet(db, sid, c.id)} onClick={() => run({ t: "enroll", s: sid, c: c.id })}>Inscribirme</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {rows.length === 0 && <div className="empty-state"><h3>No se encontraron cursos</h3><p className="muted">Prueba a modificar los filtros de búsqueda.</p></div>}
        </section>
      )}

      {user?.role !== "superadmin" && (
        <section className="card course-section" style={{ order: -1 }}>
          <div className="course-section-head"><div><h2>Mis cursos</h2><p className="muted small">{teaching ? "Los cursos que impartes, con sus matrículas y finalización." : "Cursos en los que estás inscrito y su progreso actual."}</p></div></div>
          <div className="course-grid">
            {myCourses.map((c) => {
              const mine = enrollment(db, sid, c.id);
              const group = db.enrollments.filter((e) => e.courseId === c.id);
              const pct = teaching ? (group.length ? (100 * group.filter((e) => e.done >= c.lessons).length) / group.length : 0) : progress(db, sid, c.id) * 100;
              return <article key={c.id} className="course-card mine" role="button" tabIndex={0} onClick={() => setDetailCourse(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDetailCourse(c); }}>
                <div className="course-card-top"><span className="course-code">{c.code}</span><span className="badge live">{teaching ? `${group.length} matrículas` : "Inscrito"}</span></div>
                <h3>{c.title}</h3><p>{c.description}</p>
                <div className="progress-header"><span className="muted small">{teaching ? "Finalización" : "Progreso"}</span><b>{Math.round(pct)}%</b></div>
                <div className="progress-track"><i style={{ width: `${pct}%` }} /></div>
                <div className="course-card-footer"><div><span className="muted small">{teaching ? `${c.lessons} lecciones` : `${mine?.done ?? 0}/${c.lessons} lecciones completadas`}</span><strong>{c.instructor}</strong></div>
                  <div className="course-card-actions" onClick={(e) => e.stopPropagation()}>
                    {teaching && canManage(c) && <button type="button" onClick={() => openEditor(c)}>Editar</button>}
                    {can("learn") && (mine && mine.done < c.lessons ? <button type="button" onClick={() => completeNext(c)}>Completar lección</button> : <span className="badge live">Completado</span>)}
                  </div></div>
              </article>;
            })}
          </div>
          {myCourses.length === 0 && <div className="empty-state"><h3>{teaching ? "No tienes cursos asignados" : "Aún no tienes cursos inscritos"}</h3>{!teaching && <p className="muted">Inscríbete desde el catálogo.</p>}</div>}
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
                              {resources.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className={`resource-link ${isAvailable ? "" : "blocked"}`} onClick={(e) => { if (!isAvailable) e.preventDefault(); else if (can("learn")) act({ t: "learning", type: "resource.consumed", s: sid, c: detailCourse.id, entityId: resource.id }); }}><Icon name={resource.type === "video" ? "play" : resource.type === "enlace" ? "externalLink" : "fileText"} size={13} /> {resource.title}</a>)}
                            </div>
                            {isCompleted ? <span className="badge live">Completada</span> : isAvailable ? !can("learn") ? <span className="badge">Disponible</span> : <button type="button" onClick={() => { if (!run({ t: "learning", type: "lesson.started", s: sid, c: detailCourse.id, entityId: lesson.id })) return; act({ t: "lesson", s: sid, c: detailCourse.id }); act({ t: "learning", type: "lesson.completed", s: sid, c: detailCourse.id, entityId: lesson.id }); }}>Completar</button> : <span className="badge">Bloqueada</span>}
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
                {enrollment(db, sid, detailCourse.id) ? <button type="button" onClick={() => setDetailCourse(null)}>Ya inscrito · cerrar</button> : can("learn") && <button type="button" disabled={detailCourse.status !== "publicado" || !prereqMet(db, sid, detailCourse.id)} onClick={() => run({ t: "enroll", s: sid, c: detailCourse.id })}>Inscribirme</button>}
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
      {notice}
    </div>
  );
}
