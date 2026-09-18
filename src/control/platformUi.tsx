import { useState } from "react";
import { planVigente, whenAgo, whenPe, type AdminInstall, type AdminUser } from "../lib/controlAdmin";
import { ECOSYSTEM, siteById, siteLabel } from "../lib/ecosystem";

export type Chip = "all" | "pro" | "free" | "revoked" | "lectura" | "multi" | string;

export function aboutLine(u: AdminUser) {
  if (u.profession_label && u.rubros.length) return `${u.profession_label} · ${u.rubros.slice(0, 3).join(", ")}`;
  if (u.profession_label) return u.profession_label;
  if (u.last_module) return `Último módulo ${u.last_module}`;
  if (u.rubros.length) return `Ingeniería · ${u.rubros.slice(0, 4).join(", ")}`;
  return "Aún no categoriza módulos";
}

export function tasteLine(u: AdminUser) {
  if (u.tastes.length) return u.tastes.slice(0, 4).map((t) => t.label).join(" · ");
  return u.rubros.slice(0, 4).join(" · ") || "—";
}

export function hasSite(u: Pick<AdminUser, "platforms" | "platformBreakdown" | "sitePresence">, id: string) {
  if ((u.platforms || []).includes(id)) return true;
  if (u.platformBreakdown?.[id]?.present) return true;
  return Boolean((u.sitePresence || []).find((row) => row.id === id && row.present));
}

export function siteCount(users: AdminUser[], id: string) {
  return users.filter((u) => hasSite(u, id)).length;
}

export function siteRows(u: AdminUser) {
  if (u.sitePresence?.length) return u.sitePresence;
  return ECOSYSTEM.map((site) => {
    const row = u.platformBreakdown?.[site.id];
    return {
      id: site.id,
      code: site.code,
      label: site.label,
      short: site.short,
      pill: site.pill,
      count: row?.count || 0,
      hosts: row?.hosts || [],
      lastSeen: row?.lastSeen || "",
      present: Boolean(row?.present || (u.platforms || []).includes(site.id)),
      source: row?.source || "",
    };
  });
}

export function Flag({ on, yes, no, kind = "ing" }: { on: boolean; yes: string; no: string; kind?: string }) {
  return <span className={`ctl-pill ${on ? kind : "off"}`}>{on ? yes : no}</span>;
}

export function PlatformPills({ u, compact = false }: { u: AdminUser; compact?: boolean }) {
  const rows = siteRows(u);
  const shown = compact ? rows.filter((row) => row.present) : rows;
  if (!shown.length) return <span className="ctl-pill off">Sin pulso</span>;
  return (
    <span className="ctl-plats">
      {shown.map((row) => (
        <span
          key={row.id}
          className={`ctl-pill ${row.present ? row.pill || row.id : "off"}`}
          title={row.present ? `${row.label}: con sesión${row.lastSeen ? ` · ${whenAgo(row.lastSeen)}` : ""}` : `${row.label}: sin sesión`}
        >
          {row.short || row.label} · {row.present ? "sí" : "no"}
        </span>
      ))}
    </span>
  );
}

export function appLabel(platform: string, app?: string) {
  return siteLabel(platform, app);
}

export function pillOf(platform: string) {
  return siteById(platform)?.pill || platform || "off";
}

export function matchesChip(u: AdminUser, chip: Chip) {
  if (!chip || chip === "all") return true;
  if (chip === "pro") return planVigente(u);
  if (chip === "free") return !planVigente(u);
  if (chip === "revoked") return u.status === "revoked";
  if (chip === "lectura") return u.coverage > 0 || u.budgets > 0;
  if (chip === "ambos" || chip === "multi") return u.platformCount >= 2;
  if (ECOSYSTEM.some((s) => s.id === chip)) return hasSite(u, chip);
  return true;
}

export function searchBlob(u: AdminUser) {
  return [
    u.full_name,
    u.email,
    u.public_user_code,
    u.city,
    u.profession_label,
    aboutLine(u),
    tasteLine(u),
    u.device_label,
    u.last_module,
    ...siteRows(u).filter((r) => r.present).map((r) => r.label),
  ].join(" ");
}

export function PlatformsView({
  users,
  q,
  onQ,
  onOpen,
}: {
  users: AdminUser[];
  q: string;
  onQ: (v: string) => void;
  onOpen: (u: AdminUser) => void;
}) {
  const [filter, setFilter] = useState("all");
  const multi = users.filter((u) => u.platformCount >= 2).length;
  const one = users.filter((u) => u.platformCount === 1).length;
  const none = users.filter((u) => u.platformCount === 0).length;
  const s = q.trim().toLowerCase();
  const rows = users
    .filter((u) => {
      if (filter === "multi" && u.platformCount < 2) return false;
      if (filter === "1" && u.platformCount !== 1) return false;
      if (filter === "0" && u.platformCount !== 0) return false;
      if (ECOSYSTEM.some((site) => site.id === filter) && !hasSite(u, filter)) return false;
      if (!s) return true;
      return searchBlob(u).toLowerCase().includes(s);
    })
    .slice()
    .sort((a, b) => (b.platformCount || 0) - (a.platformCount || 0) || String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || "")));
  return (
    <div>
      <p className="ctl-hint">Misma base que Folio Control: public.users, user_platforms y user_sessions. Cada pastilla dice si hay sesión en esa página.</p>
      <div className="ctl-kpis ctl-site-cards">
        {ECOSYSTEM.map((site) => (
          <button type="button" key={site.id} onClick={() => setFilter(site.id)}>
            <small>{site.label}</small>
            <strong>{siteCount(users, site.id)}</strong>
            <em>con sesión</em>
          </button>
        ))}
        <button type="button" onClick={() => setFilter("multi")}>
          <small>2 o más sitios</small>
          <strong>{multi}</strong>
          <em>{one} en una · {none} sin pulso</em>
        </button>
      </div>
      <div className="ctl-toolbar">
        <input className="ctl-search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Filtrar por correo, ciudad u oficio…" />
        <div className="ctl-chips">
          <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>Todos ({users.length})</button>
          {ECOSYSTEM.map((site) => (
            <button key={site.id} type="button" className={filter === site.id ? "on" : ""} onClick={() => setFilter(site.id)}>
              {site.short} ({siteCount(users, site.id)})
            </button>
          ))}
          <button type="button" className={filter === "1" ? "on" : ""} onClick={() => setFilter("1")}>1 sitio ({one})</button>
          <button type="button" className={filter === "multi" ? "on" : ""} onClick={() => setFilter("multi")}>2 o más ({multi})</button>
          <button type="button" className={filter === "0" ? "on" : ""} onClick={() => setFilter("0")}>Sin pulso ({none})</button>
        </div>
      </div>
      <table className="ctl-table">
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Cuántas</th>
            <th>Sesiones por página</th>
            <th>Última vez</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.user_id} className="click" onClick={() => onOpen(u)}>
              <td><b>{u.email || "—"}</b><small>{[u.city, u.department, u.country].filter(Boolean).join(" · ") || "Sin ubicación"}</small></td>
              <td><span className={`ctl-pill ${u.platformCount >= 3 ? "warn" : u.platformCount === 2 ? "folio" : "mute"}`}>{u.platformCount || 0} sitio(s)</span></td>
              <td className="ctl-plat-detail">
                <PlatformPills u={u} />
                <small>{siteRows(u).filter((r) => r.present).map((r) => `${r.short}${r.lastSeen ? ` ${whenAgo(r.lastSeen)}` : ""}`).join(" · ") || "sin sesión registrada"}</small>
              </td>
              <td>{whenAgo(u.last_seen_at)}<small>{whenPe(u.last_sign_in_at)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="ctl-empty">Ninguna cuenta con ese filtro.</p> : null}
    </div>
  );
}

export function UsersView({
  users, filtered, q, chip, stats, invite, sel, onQ, onChip, onInvite, onOpen, onSend,
}: {
  users: AdminUser[];
  filtered: AdminUser[];
  q: string;
  chip: Chip;
  stats: { usuarios: number; pro: number; free: number; revoked: number; lectura: number };
  invite: string;
  sel: AdminUser | null;
  onQ: (v: string) => void;
  onChip: (v: Chip) => void;
  onInvite: (v: string) => void;
  onOpen: (u: AdminUser) => void;
  onSend: () => void;
}) {
  const multi = users.filter((u) => u.platformCount >= 2).length;
  return (
    <div>
      <p className="ctl-hint">Identidad única en public.users. Cada pastilla indica si esa misma cuenta tiene sesión en esa página del ecosistema (la misma lectura que Folio Control).</p>
      <div className="ctl-toolbar">
        <input className="ctl-search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Buscar correo, oficio, ciudad, módulo, página…" />
        <div className="ctl-chips">
          <button type="button" className={chip === "all" ? "on" : ""} onClick={() => onChip("all")}>Todos ({stats.usuarios})</button>
          {ECOSYSTEM.map((site) => (
            <button key={site.id} type="button" className={chip === site.id ? "on" : ""} onClick={() => onChip(site.id)}>
              {site.short} ({users.filter((u) => hasSite(u, site.id)).length})
            </button>
          ))}
          <button type="button" className={chip === "multi" ? "on" : ""} onClick={() => onChip("multi")}>2 o más ({multi})</button>
          <button type="button" className={chip === "lectura" ? "on" : ""} onClick={() => onChip("lectura")}>Con lectura ({stats.lectura})</button>
          <button type="button" className={chip === "pro" ? "on" : ""} onClick={() => onChip("pro")}>PRO ({stats.pro})</button>
          <button type="button" className={chip === "free" ? "on" : ""} onClick={() => onChip("free")}>Free ({stats.free})</button>
          <button type="button" className={chip === "revoked" ? "on" : ""} onClick={() => onChip("revoked")}>Revocados ({stats.revoked})</button>
        </div>
      </div>
      <table className="ctl-table">
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Plataformas</th>
            <th>De qué se trata</th>
            <th>Gustos / rubros</th>
            <th>Plan</th>
            <th>Última vez</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.user_id} className={`click${sel?.user_id === u.user_id ? " on" : ""}`} onClick={() => onOpen(u)}>
              <td><b>{u.email || "—"}</b><small>{[u.public_user_code, u.city, u.department, u.country].filter(Boolean).join(" · ") || "Sin ubicación"}</small></td>
              <td>
                <PlatformPills u={u} />
                <small>{u.installCount ? `${u.installCount} equipo(s)` : "sin huella"} · {u.platformCount || 0} sitio(s){u.last_module ? ` · ${u.last_module}` : ""}</small>
              </td>
              <td>{aboutLine(u)}<small>{u.documentType || u.workplace_role || "sin tipo"}</small></td>
              <td>{tasteLine(u)}<small>{u.tasteCount} gustos{u.last_module ? ` · último módulo ${u.last_module}` : ""}</small></td>
              <td><span className={`ctl-pill ${planVigente(u) ? "pro" : "mute"}`}>{planVigente(u) ? "PRO" : "Free"}</span><small>{u.sku}</small></td>
              <td>{whenAgo(u.last_seen_at)}<small>{whenPe(u.profile_at)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 ? (
        <p className="ctl-empty">
          {users.length === 0 ? "No se pudo leer el inventario. Las cuentas no se han borrado." : "Ninguna cuenta con ese filtro."}
        </p>
      ) : null}
      <div className="ctl-invite">
        <h3>Invitar por correo</h3>
        <input value={invite} onChange={(e) => onInvite(e.target.value)} placeholder="cliente@correo.com" />
        <button type="button" className="ctl-btn primary" onClick={onSend}>Enviar invitación</button>
      </div>
    </div>
  );
}

export function SessionFlags({ user }: { user: AdminUser }) {
  return (
    <div className="ctl-flags" style={{ marginTop: 10 }}>
      {siteRows(user).map((row) => (
        <div className="ctl-flag" key={row.id}>
          <span>{row.label}</span>
          <Flag on={row.present} yes={row.lastSeen ? whenAgo(row.lastSeen) : "Sí"} no="No" kind={row.pill || row.id} />
        </div>
      ))}
    </div>
  );
}

export function InstallAppPill({ platform, app }: { platform: string; app?: string }) {
  return <span className={`ctl-pill ${pillOf(platform)}`}>{appLabel(platform, app)}</span>;
}

export function InstallsView({ items, q, onQ }: { items: AdminInstall[]; q: string; onQ: (v: string) => void }) {
  const rows = items.filter((i) => {
    if (!q.trim()) return true;
    return [i.hostname, i.email, i.google_email, i.city, i.ip, i.install_id, i.os, i.app, i.platform].join(" ").toLowerCase().includes(q.toLowerCase());
  });
  return (
    <div>
      <p className="ctl-hint">Una fila = un computador (install_id / machine_key). Varios PCs en el mismo Wi-Fi comparten IP y son filas distintas. App sale de installs.app.</p>
      <div className="ctl-toolbar">
        <input className="ctl-search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Buscar hostname, correo, ciudad, IP, app…" />
      </div>
      <table className="ctl-table">
        <thead><tr><th>App</th><th>Equipo</th><th>Cuenta</th><th>Ubicación / red</th><th>Plan</th><th>Versión</th><th>Última vez</th></tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={`${i.user_id}-${i.install_id}`}>
              <td><InstallAppPill platform={i.platform} app={i.app} /></td>
              <td><b>{i.hostname || i.install_id || "—"}</b><small className="ctl-mono">{String(i.install_id).slice(0, 18)}</small></td>
              <td>{i.email || i.google_email || "Sin cuenta"}<small>{i.google_email && i.google_email !== i.email ? i.google_email : ""}</small></td>
              <td>{[i.city, i.district, i.department, i.country].filter(Boolean).join(", ") || "—"}<small>{i.ip || "sin IP"} · {i.location_source || "—"}</small></td>
              <td>{i.license_tier || "—"}</td>
              <td>{i.version || "—"}<small>{i.os || i.locale || "—"}</small></td>
              <td>{whenAgo(i.last_seen_at)}<small>{whenPe(i.first_seen_at)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="ctl-empty">Sin equipos.</p> : null}
    </div>
  );
}
