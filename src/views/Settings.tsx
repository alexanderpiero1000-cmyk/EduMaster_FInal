// Configuración (solo Superadministrador): roles y permisos, usuarios, auditoría y parámetros.
import { useState } from "react";
import type { Settings as S } from "../data/db";
import { allPerms, can } from "../data/permissions";
import { enabledRoles, roleLabel, roles, users } from "../data/users";
import { useActionNotice } from "../components/ui/useActionNotice";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { downloadCsv } from "../components/ui/csv";
import Icon from "../components/ui/Icon";
import { useStore, useUser } from "../store/Store";

const TABS = ["Roles y permisos", "Usuarios", "Auditoría", "Parámetros"] as const;
type Tab = typeof TABS[number];
const th = "border-b border-white/10 px-2 py-2 text-left align-bottom font-normal text-em-muted";
const td = "border-b border-white/5 px-2 py-2 align-top";

function Permissions() {
  return (
    <Card title="Roles contra permisos">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <caption className="sr-only">Matriz de permisos por rol, leída de permissions.ts</caption>
          <thead><tr><th scope="col" className={th}>Permiso</th>{roles.map((r) => (
            <th key={r.id} scope="col" className={`${th} text-center!`}><div className="text-em-text">{r.label}</div>
              {enabledRoles.includes(r.id) ? <Badge tone="ok">Habilitado</Badge> : <span className="text-[11px]">Fuera del alcance del prototipo</span>}</th>))}</tr></thead>
          <tbody>{allPerms.map((p) => (
            <tr key={p}><th scope="row" className={`${td} text-left font-normal`}><code>{p}</code></th>
              {roles.map((r) => <td key={r.id} className={`${td} text-center`}>{can(r.id, p) ? <span className="text-em-teal"><Icon name="check" label="permitido" /></span> : <span className="text-white/25"><Icon name="minus" label="no permitido" /></span>}</td>)}</tr>))}</tbody>
        </table>
      </div>
      <p className="m-0 mt-3 text-[11px] text-em-muted">En producción la autorización se valida en el backend, no solo en la interfaz.</p>
    </Card>
  );
}

function Users() {
  const { db } = useStore();
  const me = useUser();
  const { run, notice } = useActionNotice();
  return (
    <Card title="Usuarios de demostración">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr>{["Nombre", "Correo", "Rol", "Estado", "Activo"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>{users.map((u) => {
            const active = !db.inactive.includes(u.id), self = u.id === me.id;
            return (
              <tr key={u.id}>
                <td className={td}>{u.name}</td><td className={td}>{u.email}</td>
                <td className={td}>{roleLabel(u.role)}{!enabledRoles.includes(u.role) && <div className="text-[11px] text-em-muted">Fuera del alcance</div>}</td>
                <td className={td}><Badge tone={active ? "ok" : "warn"}>{active ? "activo" : "inactivo"}</Badge></td>
                <td className={td}><label className="flex items-center gap-2">
                  <input type="checkbox" role="switch" checked={active} disabled={self} aria-label={`Cuenta de ${u.name} activa`} onChange={(e) => run({ t: "user", id: u.id, active: e.target.checked })} />
                  {self && <span className="text-[11px] text-em-muted">Tu cuenta</span>}
                </label></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {notice}
    </Card>
  );
}

const RANGES = [{ v: 0, label: "Todo el registro" }, { v: 5, label: "Últimos 5 min" }, { v: 15, label: "Últimos 15 min" }, { v: 60, label: "Última hora" }];

function AuditLog() {
  const { db } = useStore();
  const { run, notice } = useActionNotice();
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [range, setRange] = useState(0);
  const [text, setText] = useState("");
  const group = (type: string) => `${type.split(".")[0]}.*`;
  const actors = [...new Set(db.audit.map((a) => a.by ?? "sistema"))].sort();
  const kinds = [...new Set(db.audit.map((a) => group(a.type)))].sort();
  const since = range ? Date.now() - range * 60e3 : 0;
  const q = text.trim().toLowerCase();
  const rows = db.audit.filter((a) => (!actor || (a.by ?? "sistema") === actor) && (!kind || (kind === "access.denied" ? a.type === kind : group(a.type) === kind))
    && Date.parse(a.at) >= since && (!q || `${a.text} ${a.type}`.toLowerCase().includes(q)));

  const exportCsv = () => {
    const filters = `actor=${actor || "todos"}; tipo=${kind || "todos"}; rango=${RANGES.find((r) => r.v === range)!.label}; texto=${text.trim() || "-"}`;
    if (!run({ t: "export", text: `Exportación de auditoría (${rows.length} filas · ${filters})` })) return;
    downloadCsv("auditoria_demo.csv", [`DEMO · exportado ${new Date().toISOString()}`, filters], ["fecha", "actor", "tipo", "detalle"], rows.map((a) => [a.at, a.by ?? "sistema", a.type, a.text]));
  };

  return (
    <Card title={`Auditoría · ${rows.length} entradas`} right={<button type="button" onClick={exportCsv}>Exportar CSV</button>}>
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={actor} aria-label="Filtrar por actor" onChange={(e) => setActor(e.target.value)}><option value="">Todos los actores</option>{actors.map((a) => <option key={a}>{a}</option>)}</select>
        <select value={kind} aria-label="Filtrar por tipo" onChange={(e) => setKind(e.target.value)}><option value="">Todos los tipos</option><option value="access.denied">access.denied</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
        <select value={range} aria-label="Rango de tiempo" onChange={(e) => setRange(Number(e.target.value))}>{RANGES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select>
        <input value={text} aria-label="Buscar en la auditoría" placeholder="Buscar texto" className="min-w-0 flex-1" onChange={(e) => setText(e.target.value)} />
      </div>
      {rows.length === 0 ? <p className="m-0 text-[13px] text-em-muted">No hay entradas con estos filtros.</p> : (
        <ol className="m-0 max-h-[480px] list-none overflow-auto border-l border-white/10 p-0">
          {rows.slice(0, 100).map((a) => (
            <li key={a.id} className={`ml-3 rounded-lg px-3 py-2 ${a.type === "access.denied" ? "bg-red-500/15" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-em-muted">
                <span><code className={a.type === "access.denied" ? "text-red-300" : "text-em-cyan"}>{a.type}</code> · {a.by ?? "sistema"}</span>
                <span className="tabular-nums">{new Date(a.at).toLocaleTimeString("es-PE")}</span>
              </div>
              <div className="break-words text-[13px] text-em-text">{a.text}</div>
            </li>
          ))}
        </ol>
      )}
      <p className="m-0 mt-3 text-[11px] text-em-muted">Se muestran hasta 100 entradas; la exportación incluye todas las filtradas. El registro vive en memoria (máximo 500).</p>
      {notice}
    </Card>
  );
}

const LABELS: Record<keyof S, string> = { sim: "Simulación de eventos en vivo", reducedMotion: "Reducir movimiento", humanReview: "Revisión docente de recomendaciones" };

function Params() {
  const { db } = useStore();
  const { run, notice } = useActionNotice();
  return (
    <Card title="Parámetros de la plataforma">
      <ul className="m-0 list-none divide-y divide-white/5 p-0">
        {(Object.keys(LABELS) as (keyof S)[]).map((k) => (
          <li key={k} className="py-3"><label className="flex items-center gap-3 text-[14px]">
            <input type="checkbox" role="switch" checked={db.settings[k]} onChange={(e) => run({ t: "setting", k, v: e.target.checked })} />{LABELS[k]}</label></li>
        ))}
      </ul>
      {notice}
    </Card>
  );
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>("Roles y permisos");
  return (
    <div className="space-y-5 font-sans">
      <div className="course-tabs" role="tablist" aria-label="Secciones de configuración" style={{ flexWrap: "wrap" }}>
        {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={`course-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === "Roles y permisos" && <Permissions />}
      {tab === "Usuarios" && <Users />}
      {tab === "Auditoría" && <AuditLog />}
      {tab === "Parámetros" && <Params />}
    </div>
  );
}
