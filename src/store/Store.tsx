import { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { course, eligible, enrollment, prereqMet, student } from "../data/selectors";
import { paths, seed } from "../data/db";
import type { DB, RecState, Settings } from "../data/db";

export type Action =
  | { t: "lesson"; s: string; c: string } | { t: "enroll"; s: string; c: string }
  | { t: "attempt"; s: string; a: string; c: string; score: number }
  | { t: "issue"; s: string; c: string } | { t: "revoke"; folio: string }
  | { t: "rec"; key: string; v: RecState | null } | { t: "post"; s: string; c: string; text: string }
  | { t: "setting"; k: keyof Settings; v: boolean } | { t: "assign"; s: string; p: string }
  | { t: "learning"; type: "course.opened" | "lesson.started" | "lesson.completed" | "resource.consumed" | "activity.completed"; s: string; c: string; entityId?: string }
  | { t: "log"; type: string; text: string };

let n = 100;
const uid = () => `e${++n}`;
const now = () => new Date().toISOString();
const log = (db: DB, type: string, text: string): DB => ({ ...db, audit: [{ id: uid(), type, text, at: now() }, ...db.audit].slice(0, 200) });

function reducer(db: DB, a: Action): DB {
  switch (a.t) {
    case "lesson": {
      const e = enrollment(db, a.s, a.c), c = course(a.c);
      if (!e || e.done >= c.lessons) return db;
      let next = { ...db, enrollments: db.enrollments.map((x) => (x === e ? { ...x, done: x.done + 1 } : x)) };
      next = log(next, "learning.progress.updated", `${student(a.s).name} avanzó en ${c.title} (${e.done + 1}/${c.lessons})`);
      return e.done + 1 === c.lessons ? log(next, "course.completed", `${student(a.s).name} completó ${c.title}`) : next;
    }
    case "enroll": {
      if (enrollment(db, a.s, a.c)) return db;
      if (!prereqMet(db, a.s, a.c)) return log(db, "enrollment.denied", `${student(a.s).name}: falta prerrequisito ${course(course(a.c).prereq!).title}`);
      return log({ ...db, enrollments: [...db.enrollments, { studentId: a.s, courseId: a.c, done: 0 }] }, "enrollment.created", `${student(a.s).name} se inscribió en ${course(a.c).title}`);
    }
    case "attempt":
      return log({ ...db, attempts: [{ id: uid(), assessmentId: a.a, studentId: a.s, score: a.score, at: now() }, ...db.attempts] },
        "assessment.submitted", `${student(a.s).name} obtuvo ${a.score} en ${course(a.c).title}`);
    case "issue": {
      if (!eligible(db, a.s, a.c)) return log(db, "certificate.denied", "No cumple criterios oficiales de finalización");
      const folio = `EM-2026-${String(db.certs.length + 1).padStart(4, "0")}`;
      return log({ ...db, certs: [...db.certs, { folio, code: `V${a.s.toUpperCase()}${a.c.toUpperCase()}`, studentId: a.s, courseId: a.c, issuedAt: now(), status: "emitido" }] },
        "certificate.issued", `Certificado ${folio} emitido a ${student(a.s).name}`);
    }
    case "revoke": return log({ ...db, certs: db.certs.map((c) => (c.folio === a.folio ? { ...c, status: "anulado" as const } : c)) }, "certificate.revoked", `Certificado ${a.folio} anulado`);
    case "rec": {
      const r = { ...db.recState }; if (a.v) r[a.key] = a.v; else delete r[a.key];
      return log({ ...db, recState: r }, "recommendation.feedback", `Recomendación ${a.key} → ${a.v}`);
    }
    case "post": return log({ ...db, posts: [{ id: uid(), courseId: a.c, studentId: a.s, text: a.text, at: now() }, ...db.posts] }, "community.post", `${student(a.s).name} publicó en ${course(a.c).title}`);
    case "setting": return log({ ...db, settings: { ...db.settings, [a.k]: a.v } }, "settings.changed", `${a.k} = ${a.v}`);
    case "assign": {
      const p = paths.find((x) => x.id === a.p)!;
      const add = p.courseIds.filter((c) => !enrollment(db, a.s, c)).map((c) => ({ studentId: a.s, courseId: c, done: 0 }));
      return log({ ...db, enrollments: [...db.enrollments, ...add] }, "path.assigned", `${p.title} asignada a ${student(a.s).name} (+${add.length} cursos)`);
    }
    case "learning": {
      const event = {
        id: uid(),
        type: a.type,
        studentId: a.s,
        courseId: a.c,
        entityId: a.entityId,
        at: now(),
      };
      const next = { ...db, learningEvents: [event, ...db.learningEvents].slice(0, 500) };
      return log(next, `learning.${a.type}`, `${student(a.s).name} · ${a.type}${a.entityId ? ` · ${a.entityId}` : ""} · ${course(a.c).title}`);
    }
    case "log": return log(db, a.type, a.text);
  }
}

interface Ctx { db: DB; act: (a: Action) => void; sid: string; setSid: (s: string) => void }
const C = createContext<Ctx | null>(null);
export const useStore = () => { const c = useContext(C); if (!c) throw new Error("Store"); return c; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, act] = useReducer(reducer, undefined, seed);
  const [sid, setSid] = useState("s1");
  const ref = useRef(db); ref.current = db;
  useEffect(() => { // simulador de eventos en tiempo real (reemplazable por SSE/WebSocket)
    if (!db.settings.sim) return;
    const id = setInterval(() => {
      const open = ref.current.enrollments.filter((e) => e.done < course(e.courseId).lessons);
      if (open.length) { const e = open[Math.floor(Math.random() * open.length)]; act({ t: "lesson", s: e.studentId, c: e.courseId }); }
    }, 4000);
    return () => clearInterval(id);
  }, [db.settings.sim]);
  return <C.Provider value={{ db, act, sid, setSid }}>{children}</C.Provider>;
}
