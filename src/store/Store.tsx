import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { course, eligible, enrollment, prereqMet, student } from "../data/selectors";
import { assessments, seed } from "../data/db";
import type { Course, DB, RecState, Settings } from "../data/db";
import { authorize, targetOf } from "../data/guard";
import { can as roleCan } from "../data/permissions";
import type { Perm } from "../data/permissions";
import { ownsCourse, scopeStudents } from "../data/scope";
import { nextEvent } from "../data/simulator";
import { authenticate, checkAccess, enabledRoles, roleLabel, users } from "../data/users";
import type { DemoUser, LoginResult, RoleId } from "../data/users";
import { overdueSubmissions, SLA_SIM_MINUTES } from "../data/sla";
import { HELP_TYPE } from "../data/help";
import { loadDemo, maxId, saveDemo } from "../data/persist";

type Notify = { to: string; text: string };
export type Action = { by?: string } & (
  | { t: "lesson"; s: string; c: string } | { t: "enroll"; s: string; c: string }
  | { t: "attempt"; s: string; a: string; c: string; score: number }
  | { t: "submit"; s: string; a: string; c: string } | { t: "grade"; id: string; score: number } | { t: "read"; ids: string[] }
  | { t: "issue"; s: string; c: string } | { t: "revoke"; folio: string }
  | { t: "rec"; key: string; v: RecState | null } | { t: "post"; s: string; c: string; text: string; author?: string; parentId?: string }
  | { t: "help"; s: string; c: string } | { t: "review"; key: string; comment: string } | { t: "hide"; id: string; reason: string }
  | { t: "course"; c: string; kind: string; text: string } | { t: "path"; title: string; objective: string; courseIds: string[] }
  | { t: "user"; id: string; active: boolean } | { t: "export"; text: string } | { t: "check" }
  | { t: "model.register"; experimentAt: string; label: string; arch: string; auc: number; f1: number; brier: number; testAuc: number | null }
  | { t: "setting"; k: keyof Settings; v: boolean } | { t: "assign"; s: string; p: string }
  | { t: "learning"; type: "course.opened" | "lesson.started" | "lesson.completed" | "resource.consumed" | "activity.completed"; s: string; c: string; entityId?: string }
  | { t: "log"; type: string; text: string; s?: string; c?: string; notify?: Notify[] });

let n = 100;
const uid = () => `e${++n}`;
const now = () => new Date().toISOString();

interface LogOpts { by?: string; s?: string; c?: string; notify?: Notify[] }
const log = (db: DB, type: string, text: string, o: LogOpts = {}): DB => ({
  ...db,
  audit: [{ id: uid(), type, text, at: now(), by: o.by, s: o.s, c: o.c, schema_version: 1 as const, source: "simulacion" as const }, ...db.audit].slice(0, 500),
  notifications: o.notify?.length
    ? [...o.notify.map((x) => ({ id: uid(), to: x.to, text: x.text, at: now(), read: false })), ...db.notifications].slice(0, 120)
    : db.notifications,
});

export function reducer(db: DB, a: Action): DB {
  const by = a.by;
  switch (a.t) {
    case "lesson": {
      const e = enrollment(db, a.s, a.c), c = course(a.c);
      if (!e || e.done >= c.lessons) return db;
      let next: DB = { ...db, enrollments: db.enrollments.map((x) => (x === e ? { ...x, done: x.done + 1 } : x)) };
      next = log(next, "learning.progress.updated", `${student(a.s).name} avanzó en ${c.title} (${e.done + 1}/${c.lessons})`, { by, s: a.s, c: a.c });
      return e.done + 1 === c.lessons
        ? log(next, "course.completed", `${student(a.s).name} completó ${c.title}`, { by, s: a.s, c: a.c, notify: [{ to: `s:${a.s}`, text: `Completaste ${c.title}` }, { to: `c:${a.c}`, text: `${student(a.s).name} completó ${c.title}` }] })
        : next;
    }
    case "enroll": {
      if (enrollment(db, a.s, a.c)) return db;
      const o = { by, s: a.s, c: a.c };
      if (!prereqMet(db, a.s, a.c)) return log(db, "enrollment.denied", `${student(a.s).name}: falta prerrequisito ${course(course(a.c).prereq!).title}`, o);
      return log({ ...db, enrollments: [...db.enrollments, { studentId: a.s, courseId: a.c, done: 0 }] }, "enrollment.created", `${student(a.s).name} se inscribió en ${course(a.c).title}`, o);
    }
    case "attempt":
      return log({ ...db, attempts: [{ id: uid(), assessmentId: a.a, studentId: a.s, score: a.score, at: now() }, ...db.attempts] },
        "assessment.submitted", `${student(a.s).name} obtuvo ${a.score} en ${course(a.c).title}`,
        { by, s: a.s, c: a.c, notify: [{ to: `s:${a.s}`, text: `Nota registrada en ${course(a.c).title}: ${a.score}` }] });
    case "submit": {
      if (!enrollment(db, a.s, a.c) || db.submissions.some((x) => x.studentId === a.s && x.assessmentId === a.a && x.status === "pendiente")) return db;
      const sub = { id: uid(), assessmentId: a.a, studentId: a.s, courseId: a.c, at: now(), status: "pendiente" as const, score: null };
      const text = `${student(a.s).name} entregó la evaluación de ${course(a.c).title}`;
      return log({ ...db, submissions: [sub, ...db.submissions] }, "assessment.submission.created", text, { by, s: a.s, c: a.c, notify: [{ to: `c:${a.c}`, text: `Entrega por calificar: ${text}` }] });
    }
    case "grade": {
      const sub = db.submissions.find((x) => x.id === a.id);
      if (!sub || sub.status !== "pendiente" || !Number.isFinite(a.score)) return db;
      const score = Math.min(100, Math.max(0, Math.round(a.score)));
      const { studentId: s, courseId: c, assessmentId } = sub;
      const title = assessments.find((x) => x.id === assessmentId)?.title ?? course(c).title;
      let next: DB = {
        ...db,
        submissions: db.submissions.map((x) => (x.id === sub.id ? { ...x, status: "calificada" as const, score } : x)),
        attempts: [{ id: uid(), assessmentId, studentId: s, score, at: now() }, ...db.attempts],
      };
      next = log(next, "assessment.graded", `${student(s).name} obtuvo ${score} en ${course(c).title}`, { by, s, c, notify: [{ to: `s:${s}`, text: `Calificación de ${title}: ${score}` }] });
      return eligible(next, s, c) ? reducer(next, { t: "issue", s, c, by: "sistema" }) : next;
    }
    case "read": return { ...db, notifications: db.notifications.map((x) => (a.ids.includes(x.id) ? { ...x, read: true } : x)) };
    case "issue": {
      if (!eligible(db, a.s, a.c)) return log(db, "certificate.denied", "No cumple criterios oficiales de finalización", { by, s: a.s, c: a.c });
      const folio = `EM-2026-${String(db.certs.length + 1).padStart(4, "0")}`;
      const base = `V${a.s.toUpperCase()}${a.c.toUpperCase()}`, repeated = db.certs.filter((x) => x.code.startsWith(base)).length;
      return log({ ...db, certs: [...db.certs, { folio, code: repeated ? `${base}R${repeated}` : base, studentId: a.s, courseId: a.c, issuedAt: now(), status: "emitido" }] },
        "certificate.issued", `Certificado ${folio} emitido a ${student(a.s).name}`,
        { by, s: a.s, c: a.c, notify: [{ to: `s:${a.s}`, text: `Certificado ${folio} de ${course(a.c).title} emitido` }, { to: "r:superadmin", text: `Certificado ${folio} emitido a ${student(a.s).name}` }] });
    }
    case "revoke": {
      const { s, c } = targetOf(db, a);
      return log({ ...db, certs: db.certs.map((x) => (x.folio === a.folio ? { ...x, status: "anulado" as const } : x)) }, "certificate.revoked", `Certificado ${a.folio} anulado`, { by, s, c });
    }
    case "rec": {
      const r = { ...db.recState }; if (a.v) r[a.key] = a.v; else delete r[a.key];
      return log({ ...db, recState: r }, "recommendation.feedback", `Recomendación ${a.key} → ${a.v}`, { by, ...targetOf(db, a) });
    }
    // El docente publica sin estudiante asociado (s = ""): el autor va en "author".
    case "post": return log({ ...db, posts: [{ id: uid(), courseId: a.c, studentId: a.s, text: a.text, at: now(), author: a.author, parentId: a.parentId }, ...db.posts] }, "community.post", `${a.author ?? student(a.s).name} publicó en ${course(a.c).title}`, { by, s: a.s || undefined, c: a.c });
    case "setting": return log({ ...db, settings: { ...db.settings, [a.k]: a.v } }, "settings.changed", `${a.k} = ${a.v}`, { by });
    case "learning": {
      const event = { id: uid(), type: a.type, studentId: a.s, courseId: a.c, entityId: a.entityId, at: now() };
      const next = { ...db, learningEvents: [event, ...db.learningEvents].slice(0, 500) };
      return log(next, `learning.${a.type}`, `${student(a.s).name} · ${a.type}${a.entityId ? ` · ${a.entityId}` : ""} · ${course(a.c).title}`, { by, s: a.s, c: a.c });
    }
    case "log": return log(db, a.type, a.text, { by, s: a.s, c: a.c, notify: a.notify });
    case "assign": {
      const p = db.paths.find((x) => x.id === a.p);
      if (!p) return db;
      const add = p.courseIds.filter((c) => !enrollment(db, a.s, c)).map((c) => ({ studentId: a.s, courseId: c, done: 0 }));
      const has = db.assignments.some((x) => x.pathId === p.id && x.studentId === a.s);
      return log({ ...db, enrollments: [...db.enrollments, ...add], assignments: has ? db.assignments : [...db.assignments, { pathId: p.id, studentId: a.s, at: now() }] },
        "path.assigned", `${p.title} asignada a ${student(a.s).name} (+${add.length} cursos)`, { by, s: a.s, notify: [{ to: `s:${a.s}`, text: `Te asignaron la ruta ${p.title}` }] });
    }
    case "path": {
      if (!a.title.trim() || !a.courseIds.length) return db;
      const p = { id: uid(), title: a.title.trim(), objective: a.objective.trim(), courseIds: a.courseIds };
      return log({ ...db, paths: [...db.paths, p] }, "path.created", `Ruta creada: ${p.title} (${p.courseIds.length} cursos)`, { by });
    }
    case "help": {
      // avisa a los docentes de todos los cursos en los que está matriculado
      const mine = db.enrollments.filter((e) => e.studentId === a.s).map((e) => e.courseId);
      const text = `${student(a.s).name} pidió ayuda al tutor`;
      return log(db, HELP_TYPE, `${text} (${course(a.c).title})`, { by, s: a.s, c: a.c, notify: [...mine.map((c) => ({ to: `c:${c}`, text })), { to: "r:superadmin", text }] });
    }
    case "review": {
      const t = targetOf(db, a);
      return log({ ...db, reviews: { ...db.reviews, [a.key]: { by: by ?? "", comment: a.comment.trim(), at: now() } } }, "recommendation.reviewed", `Recomendación ${a.key} revisada: ${a.comment.trim() || "sin comentario"}`,
        { by, ...t, notify: t.s ? [{ to: `s:${t.s}`, text: `${by} revisó tu recomendación${a.comment.trim() ? `: ${a.comment.trim()}` : ""}` }] : undefined });
    }
    case "hide": {
      const post = db.posts.find((p) => p.id === a.id);
      if (!post || post.hidden) return db;
      return log({ ...db, posts: db.posts.map((p) => (p.id === a.id ? { ...p, hidden: { by: by ?? "", reason: a.reason.trim(), at: now() } } : p)) },
        "community.moderated", `Publicación ocultada en ${course(post.courseId).title}. Motivo: ${a.reason.trim()}`, { by, c: post.courseId });
    }
    case "course": return log(db, a.kind, a.text, { by, c: a.c });
    case "export": return log(db, "export.created", a.text, { by });
    case "model.register": {
      if (db.modelVersions.some((v) => v.experimentAt === a.experimentAt)) return db;
      const version = { id: `ref-${db.modelVersions.length + 1}`, at: now(), author: by ?? "", experimentAt: a.experimentAt, label: a.label, arch: a.arch, auc: a.auc, f1: a.f1, brier: a.brier, testAuc: a.testAuc };
      const text = `Versión de referencia ${version.id} registrada (${a.label} · AUC ${a.auc.toFixed(3)}). Informativa: el tutor usa reglas.`;
      return log({ ...db, modelVersions: [version, ...db.modelVersions] }, "model.reference.registered", text, { by, notify: [{ to: "r:superadmin", text }] });
    }
    case "user": {
      const u = users.find((x) => x.id === a.id);
      if (!u) return db;
      const inactive = a.active ? db.inactive.filter((x) => x !== a.id) : [...new Set([...db.inactive, a.id])];
      return log({ ...db, inactive }, "settings.user.updated", `Cuenta ${u.email} ${a.active ? "activada" : "desactivada"}`, { by });
    }
    case "check": {
      // alerta una sola vez cada entrega que supera el plazo simulado
      const late = overdueSubmissions(db).filter((x) => !x.alerted);
      if (!late.length) return db;
      const ids = late.map((x) => x.id);
      return late.reduce((d, x) => log(d, "assessment.overdue", `Entrega de ${student(x.studentId).name} en ${course(x.courseId).title} sin calificar hace más de ${SLA_SIM_MINUTES} min simulados`,
        { by: "sistema", c: x.courseId, notify: [{ to: "r:superadmin", text: `Entrega sin calificar: ${student(x.studentId).name} · ${course(x.courseId).title}` }] }),
        { ...db, submissions: db.submissions.map((x) => (ids.includes(x.id) ? { ...x, alerted: true } : x)) });
    }
  }
}

interface Ctx {
  db: DB;
  act: (a: Action) => boolean;
  sid: string; setSid: (s: string) => void;
  user: DemoUser | null;
  login: (email: string, password: string) => LoginResult;
  loginAs: (role: RoleId) => LoginResult;
  logout: () => void;
  switchRole: (role: RoleId) => LoginResult;
  can: (perm: Perm) => boolean;
  canManage: (c: Course) => boolean;
  setSim: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
}
const C = createContext<Ctx | null>(null);
export const useStore = () => { const c = useContext(C); if (!c) throw new Error("Store"); return c; };
export const useUser = (): DemoUser => { const { user } = useStore(); if (!user) throw new Error("No hay sesión iniciada"); return user; };

const KEY = "edumaster.userId"; // solo se guarda el id, nunca la contraseña
const enabled = (u: DemoUser | undefined): u is DemoUser => !!u && enabledRoles.includes(u.role);
const userOfRole = (role: RoleId) => users.find((u) => u.role === role);
function restore(): DemoUser | null {
  try { const u = users.find((x) => x.id === sessionStorage.getItem(KEY)); return enabled(u) ? u : null; } catch { return null; }
}
function persist(u: DemoUser | null) {
  try { if (u) sessionStorage.setItem(KEY, u.id); else sessionStorage.removeItem(KEY); } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, dispatch] = useReducer(reducer, undefined, () => {
    const saved = loadDemo();                 // lo guardado antes de recargar, o los datos iniciales
    if (!saved) return seed();
    n = Math.max(n, maxId(saved));
    return saved;
  });
  useEffect(() => { saveDemo(db); }, [db]);
  const [selected, setSid] = useState("s1");
  const [user, setUser] = useState<DemoUser | null>(restore);
  const ref = useRef(db); ref.current = db;

  let sid = selected;
  if (user?.role === "estudiante") sid = user.studentId!;
  else if (user?.role === "docente") {
    const mine = scopeStudents(db, user);
    sid = mine.some((s) => s.id === selected) ? selected : mine[0]?.id ?? selected;
  }

  const enter = (u: DemoUser, type: string, text: string) => {
    setUser(u); persist(u);
    dispatch({ t: "log", type, text, by: u.name, s: u.studentId });
  };
  const refused = (result: LoginResult) => {
    const text = result === "inactive" ? "Intento de acceso con una cuenta inactiva" : "Intento de acceso fallido";
    dispatch({ t: "log", type: "auth.failed", text, by: "anónimo" });
    return result;
  };
  const login = (email: string, password: string): LoginResult => {
    const { result, user: u } = authenticate(email, password, ref.current.inactive);
    if (!u) return refused(result);
    enter(u, "auth.login", `${u.name} inició sesión`);
    return "ok";
  };
  const byRole = (role: RoleId, type: string, text: (u: DemoUser) => string): LoginResult => {
    const u = userOfRole(role), result = checkAccess(u, ref.current.inactive);
    if (result !== "ok") return refused(result);
    enter(u!, type, text(u!));
    return "ok";
  };
  const loginAs = (role: RoleId) => byRole(role, "auth.login", (u) => `${u.name} inició sesión (botón de rol)`);
  const switchRole = (role: RoleId) => byRole(role, "auth.role_switched", (u) => `Cambio de rol (demo) a ${roleLabel(role)}: ${u.name}`);
  const logout = () => {
    if (user) dispatch({ t: "log", type: "auth.logout", text: `${user.name} cerró sesión`, by: user.name, s: user.studentId });
    setUser(null); persist(null);
  };

  const act = (a: Action) => {
    if (!user) return false;
    const reason = authorize(ref.current, user, a);
    if (reason) {
      const text = `Acción «${a.t}» rechazada para ${user.name}: ${reason}`;
      dispatch({ t: "log", type: "access.denied", text, by: user.name, s: user.studentId, notify: [{ to: "r:superadmin", text: `Acceso denegado: ${text}` }] });
      return false;
    }
    // El autor de una publicación sale siempre de la sesión, no de la vista.
    if (a.t === "post") dispatch({ ...a, by: user.name, author: user.role === "docente" ? `${user.name} · Docente` : user.name });
    else dispatch({ ...a, by: user.name });
    return true;
  };
  const can = (perm: Perm) => !!user && roleCan(user.role, perm);
  const canManage = (c: Course) => !!user && can("course.manage") && ownsCourse(user, c);
  const setSim = (on: boolean) => dispatch({ t: "setting", k: "sim", v: on, by: user?.name });
  // Preferencia de interfaz: como setSim, no pasa por la guarda de permisos.
  const setReducedMotion = (on: boolean) => dispatch({ t: "setting", k: "reducedMotion", v: on, by: user?.name });
  useEffect(() => { document.body.classList.toggle("rm", db.settings.reducedMotion); }, [db.settings.reducedMotion]);

  // Vigila el plazo simulado de calificación (el reducer no cambia nada si no hay entregas vencidas).
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => dispatch({ t: "check" }), 3000);
    return () => clearInterval(id);
  }, [user]);

  // Simulador de eventos en vivo (reemplazable por SSE/WebSocket). Actúa como "sistema", sin pasar por la guarda.
  useEffect(() => {
    if (!user || !db.settings.sim) return;
    let id = 0;
    const tick = () => {
      id = window.setTimeout(() => { dispatch(nextEvent(ref.current, user)); tick(); }, 2500 + Math.random() * 2500);
    };
    tick();
    return () => clearTimeout(id);
  }, [user, db.settings.sim]);

  return <C.Provider value={{ db, act, sid, setSid, user, login, loginAs, logout, switchRole, can, canManage, setSim, setReducedMotion }}>{children}</C.Provider>;
}
