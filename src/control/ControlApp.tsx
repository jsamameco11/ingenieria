import { useEffect, useMemo, useState } from "react";
import {
  adminCreateListing,
  adminDeleteListing,
  adminDeleteNotice,
  adminInvite,
  adminRestore,
  adminRevoke,
  adminSaveListing,
  adminSaveNotice,
  adminSaveUser,
  adminSnapshot,
  adminUserProfile,
  adminRecalculateProfile,
  planVigente,
  whenAgo,
  whenPe,
  type AdminIdentity,
  type AdminInstall,
  type AdminSnapshot,
  type AdminUser,
} from "../lib/controlAdmin";
import { PLANES_PRO } from "../lib/culqi";
import { PDF_SOLES } from "../lib/billing";
import { STORE_CATEGORIES, type Listing } from "../lib/mercado";
import { clearControlGate, loginControl, readControlGate } from "../lib/controlGate";
import { SOPORTE_LABEL } from "../lib/support";
import { useAuth } from "../ui/AuthProvider";
import { BillingLaunchPanel } from "../ui/BillingLaunchPanel";
import { PrintPolicyPanel } from "./PrintPolicyPanel";

type View =
  | "dashboard"
  | "usuarios"
  | "plataforma"
  | "equipos"
  | "identidad"
  | "campanas"
  | "tienda"
  | "publicidad"
  | "mensajes"
  | "avisos"
  | "planes"
  | "ajustes";
type Chip = "all" | "pro" | "free" | "revoked" | "lectura" | "ingenieria" | "folio" | "android" | "ambos";
type DrawerTab = "cuenta" | "prefs" | "perfil" | "pcs" | "ads";

const TITLES: Record<View, { kicker: string; title: string; lead: string }> = {
  dashboard: { kicker: "Parque", title: "Resumen operativo", lead: "Identidad en la base maestra de usuarios (App Nitro PDF). Los cálculos y planes de Ingeniería siguen en sus tablas propias." },
  usuarios: { kicker: "Parque", title: "Inventario de usuarios", lead: "Una sola identidad: public.users (USER_ID = Auth). El plan Pro de Ingeniería se cobra con Culqi; CIP y oficio de obra viven en el overlay de Ingeniería." },
  plataforma: { kicker: "Parque", title: "Plataforma", lead: "user_platforms ancla cada app al mismo USER_ID. Folio PC, Android e Ingeniería no duplican la cuenta." },
  equipos: { kicker: "Parque", title: "Equipos", lead: "Una fila = un computador (install_id). La IP no identifica el PC: varios equipos del mismo Wi-Fi la comparten." },
  identidad: { kicker: "Parque", title: "Identidad", lead: "user_identities de Folio: oficio, edad, ubigeo, gustos. El PDF no se guarda." },
  campanas: { kicker: "Comercio", title: "Campañas y vitrina", lead: "Tabla listings compartida. origin_app dice si el aviso nació en Folio o en Ingeniería." },
  tienda: { kicker: "Comercio", title: "Tienda", lead: "Avisos de producto de la plaza compartida (listings)." },
  publicidad: { kicker: "Comercio", title: "Publicidad", lead: "Campañas (kind = ad) con alcance e inversión." },
  mensajes: { kicker: "Comercio", title: "Mensajes de tienda", lead: "Hilos listing_threads: un hilo por anuncio y comprador, como OLX." },
  avisos: { kicker: "Comercio", title: "Avisos", lead: "Mensajes operativos del titular para la consola." },
  planes: { kicker: "Catálogo", title: "Precios y planes", lead: "Suscripción Pro, lectura de planos y tarifa para quitar la marca de agua de cada hoja de cálculo." },
  ajustes: { kicker: "Sistema", title: "Ajustes y censo de tablas", lead: "Proyecto qfvgksstvdrxcugbdwkv (App Nitro PDF). users / user_profiles son la maestra; el resto es dato de cada app." },
};

const EMPTY: AdminSnapshot = {
  users: [],
  listings: [],
  installs: [],
  identities: [],
  threads: [],
  accounts: [],
  tables: [],
  notices: [],
  countries: {},
  connected: false,
  source: "none",
  message: "Sin leer aún.",
};

function money(value: number) {
  return `S/ ${Number(value || 0).toLocaleString("es-PE")}`;
}

function aboutLine(u: AdminUser) {
  if (u.profession_label && u.rubros.length) return `${u.profession_label} · ${u.rubros.slice(0, 3).join(", ")}`;
  if (u.profession_label) return u.profession_label;
  if (u.last_module) return `Último módulo ${u.last_module}`;
  if (u.rubros.length) return `Ingeniería · ${u.rubros.slice(0, 4).join(", ")}`;
  return "Aún no categoriza módulos";
}

function hasIng(u: Pick<AdminUser, "platforms">) {
  return u.platforms.includes("ingenieria");
}

function hasFolioPdf(u: Pick<AdminUser, "platforms">) {
  return u.platforms.includes("folio") || u.platforms.includes("android");
}

function hasAndroid(u: Pick<AdminUser, "platforms">) {
  return u.platforms.includes("android");
}

function Flag({ on, yes, no, kind = "ing" }: { on: boolean; yes: string; no: string; kind?: "ing" | "folio" | "and" }) {
  return <span className={`ctl-pill ${on ? kind : "no"}`}>{on ? yes : no}</span>;
}

function PlatformPills({ u }: { u: AdminUser }) {
  return (
    <span className="ctl-plats">
      {u.platforms.includes("folio") ? <span className="ctl-pill folio">Folio PC</span> : null}
      {u.platforms.includes("android") ? <span className="ctl-pill and">Android</span> : null}
      {u.platforms.includes("ingenieria") ? <span className="ctl-pill ing">Ingeniería</span> : null}
      {!u.platforms.length ? <span className="ctl-pill no">Sin pulso</span> : null}
    </span>
  );
}

function appLabel(platform: string, app?: string) {
  if (platform === "android" || app === "folio-android") return "Folio Android";
  if (platform === "ingenieria" || app === "memorcalc") return "Ingeniería";
  return "Folio PC";
}

function tasteLine(u: AdminUser) {
  if (u.tastes.length) return u.tastes.slice(0, 4).map((t) => t.label).join(" · ");
  return u.rubros.slice(0, 4).join(" · ") || "—";
}

function localUntil(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArr(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  return [];
}

function Perfil360Panel({
  userId,
  pack,
  busy,
  onRecalc,
}: {
  userId: string;
  pack: Record<string, unknown> | null;
  busy: string;
  onRecalc: () => void;
}) {
  if (!pack) return <p className="ctl-hint">Leyendo evidencias del USER_ID {userId.slice(0, 8)}…</p>;
  const profile = asObj(pack.profile);
  const professional = asObj(profile.professional);
  const completeness = asObj(profile.profile_completeness);
  const interests = asArr(profile.interests);
  const techs = asArr(profile.technologies);
  const conflicts = asArr(profile.conflicts);
  const evidence = asArr(pack.evidence);
  const overall = completeness.overall_pct ?? completeness.overall;
  return (
    <div>
      <p className="ctl-hint">Cadena: pregunta → respuesta cruda → extracción → evidencia → atributo → score. Una inferencia no se convierte en hecho.</p>
      <p>Profesión: <b>{String(professional.primary_profession || "—")}</b> · experiencia {String(professional.years_of_experience ?? "—")} años</p>
      <p>Especialidad: {String(professional.specialization_summary || "—")}</p>
      <p>Completitud: <b>{overall != null ? `${overall}%` : "—"}</b></p>
      {interests.length ? (
        <p>Intereses: {interests.slice(0, 8).map((i) => `${String(i.name || i.code)} ${i.score ?? i.declared_score ?? ""}`).join(" · ")}</p>
      ) : <p>Aún no hay intereses con evidencia.</p>}
      {techs.length ? <p>Tecnologías: {techs.map((t) => String(t.name || t.code)).join(" · ")}</p> : null}
      {conflicts.length ? <p>Conflictos abiertos: {conflicts.map((c) => `${c.field}: ${c.declared} / ${c.other}`).join(" · ")}</p> : null}
      <button type="button" className="ctl-btn" disabled={Boolean(busy)} onClick={onRecalc}>
        {busy === "Recalcular perfil" ? "Recalculando…" : "Recalcular desde evidencia"}
      </button>
      <h3 className="ctl-sub">Evidencias</h3>
      <table className="ctl-table">
        <thead>
          <tr><th>Atributo</th><th>Valor</th><th>Origen</th><th>Confianza</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          {evidence.slice(0, 40).map((e) => (
            <tr key={String(e.id)}>
              <td>{String(e.target_type)} · {String(e.catalog_code)}</td>
              <td>{String(e.evidence_text || "—")}</td>
              <td>{String(e.evidence_kind)} / {String(e.weight_code || e.source_type || "")}</td>
              <td>{e.confidence != null ? Number(e.confidence).toFixed(2) : "—"}</td>
              <td>{e.created_at ? whenAgo(String(e.created_at)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {evidence.length === 0 ? <p className="ctl-empty">Este usuario todavía no tiene evidencias del motor.</p> : null}
    </div>
  );
}

export function ControlApp() {
  const { ready, signOut } = useAuth();
  const [unlocked, setUnlocked] = useState(() => readControlGate());
  const [id, setId] = useState("jrenzosamco@gmail.com");
  const [clave, setClave] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [snap, setSnap] = useState<AdminSnapshot>(EMPTY);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [sel, setSel] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<DrawerTab>("cuenta");
  const [edit, setEdit] = useState<Listing | null>(null);
  const [invite, setInvite] = useState("");
  const [draft, setDraft] = useState({ plan: "free", sku: "free", status: "active", device_limit: 1, expiration_at: "", phone: "" });
  const [notice, setNotice] = useState({ title: "", body: "" });
  const [product, setProduct] = useState({ name: "", description: "", price_label: "", category: "Servicios", city: "", phone: "" });
  const [perfil, setPerfil] = useState<Record<string, unknown> | null>(null);

  const users = snap.users;
  const listings = snap.listings;

  async function load() {
    const next = await adminSnapshot();
    setSnap(next);
    if (sel) setSel(next.users.find((u) => u.user_id === sel.user_id) ?? null);
    if (edit) setEdit(next.listings.find((x) => x.id === edit.id) ?? null);
    if (!next.connected) setErr(next.message);
    else setErr("");
  }

  useEffect(() => {
    document.title = "MemoriaCalc Control · Ingeniería · Cálculos";
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    void adminSnapshot()
      .then((next) => {
        if (!alive) return;
        setSnap(next);
        if (!next.connected) setErr(next.message);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "No se pudo cargar el panel.");
      });
    return () => {
      alive = false;
    };
  }, [unlocked]);

  useEffect(() => {
    if (!sel || tab !== "perfil") return;
    let alive = true;
    setPerfil(null);
    void adminUserProfile(sel.user_id)
      .then((data) => {
        if (alive) setPerfil(data);
      })
      .catch((e) => {
        if (alive) setPerfil({ ok: false, message: e instanceof Error ? e.message : "No se pudo leer el perfil 360." });
      });
    return () => {
      alive = false;
    };
  }, [sel?.user_id, tab]);

  useEffect(() => {
    if (!sel) return;
    setDraft({
      plan: planVigente(sel) ? "pro" : "free",
      sku: sel.sku || "free",
      status: sel.status || "active",
      device_limit: sel.device_limit || 1,
      expiration_at: localUntil(sel.paid_until),
      phone: sel.phone || "",
    });
  }, [sel?.user_id]);

  const stats = useMemo(() => {
    const pro = users.filter(planVigente).length;
    const revoked = users.filter((u) => u.status === "revoked").length;
    const lectura = users.filter((u) => u.coverage > 0 || u.budgets > 0).length;
    const anclados = users.filter((u) => u.device_id || u.installCount > 0).length;
    const arts = listings.filter((x) => x.kind !== "ad");
    const ads = listings.filter((x) => x.kind === "ad");
    const spend = listings.reduce((n, x) => n + (x.paid_soles || 0), 0);
    return {
      usuarios: users.length,
      pro,
      free: users.length - pro,
      revoked,
      lectura,
      anclados,
      articulos: arts.length,
      articulosVivos: arts.filter((x) => x.active && !x.hidden).length,
      campañas: ads.length,
      campañasVivas: ads.filter((x) => x.active && !x.hidden).length,
      presupuestos: users.reduce((n, u) => n + u.budgets, 0),
      spend,
      identityPct: users.length ? Math.round((lectura / users.length) * 100) : 0,
    };
  }, [users, listings]);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (chip === "pro" && !planVigente(u)) return false;
      if (chip === "free" && planVigente(u)) return false;
      if (chip === "revoked" && u.status !== "revoked") return false;
      if (chip === "lectura" && !(u.coverage > 0 || u.budgets > 0)) return false;
      if (chip === "ingenieria" && !hasIng(u)) return false;
      if (chip === "folio" && !hasFolioPdf(u)) return false;
      if (chip === "android" && !hasAndroid(u)) return false;
      if (chip === "ambos" && !(hasIng(u) && hasFolioPdf(u))) return false;
      if (!s) return true;
      return [u.full_name, u.email, u.public_user_code, u.city, u.profession_label, aboutLine(u), tasteLine(u), u.device_label, u.last_module]
        .join(" ")
        .toLowerCase()
        .includes(s);
    });
  }, [users, q, chip]);

  const catalog = useMemo(() => {
    const s = q.trim().toLowerCase();
    return listings
      .filter((x) => {
        if (view === "publicidad") return x.kind === "ad";
        if (view === "tienda") return x.kind !== "ad";
        return true;
      })
      .filter((x) => !s || `${x.name} ${x.seller_name} ${x.seller_email} ${x.category} ${x.campaign_package || ""}`.toLowerCase().includes(s))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [listings, view, q]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo completar.");
      setToast(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy("");
    }
  }

  function go(next: View) {
    setView(next);
    setQ("");
    setChip("all");
    setEdit(null);
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  if (!ready) return <div className="ctl-boot">Cargando panel…</div>;

  if (!unlocked) {
    return (
      <div className="ctl-login" data-guest-ok>
        <div className="ctl-card">
          <div className="ctl-mark">MC</div>
          <p className="ctl-brand">MEMORIACALC</p>
          <h1>Control</h1>
          <p className="ctl-muted">
            Consola de Ingeniería. Las cuentas salen de la base maestra de usuarios (App Nitro PDF). Aquí se ve el plan Culqi y si la misma identidad entra a Folio PDF.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setErr("");
              setBusy("Entrando…");
              void loginControl(id, clave)
                .then(() => {
                  setUnlocked(true);
                  setClave("");
                })
                .catch((e) => setErr(e instanceof Error ? e.message : "No se pudo entrar."))
                .finally(() => setBusy(""));
            }}
          >
            <label>
              ID
              <input type="email" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} required />
            </label>
            <label>
              Clave
              <input type="password" name="password" autoComplete="current-password" autoFocus value={clave} onChange={(e) => setClave(e.target.value)} required />
            </label>
            {err ? <p className="ctl-err">{err}</p> : null}
            <button type="submit" className="ctl-btn primary" disabled={Boolean(busy)}>
              {busy || "Entrar al panel"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const meta = TITLES[view];
  const countryRows = Object.entries(snap.countries).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...countryRows.map(([, n]) => n));

  return (
    <div className="ctl-app">
      <aside className="ctl-nav">
        <div className="ctl-aside-brand">
          <div className="ctl-mark sm">MC</div>
          <div>
            <strong>MemoriaCalc Control</strong>
            <span>Ingeniería · Cálculos</span>
          </div>
        </div>
        <p className="ctl-nav-label">Parque</p>
        <nav>
          <button type="button" className={view === "dashboard" ? "on" : ""} onClick={() => go("dashboard")}>Resumen</button>
          <button type="button" className={view === "usuarios" ? "on" : ""} onClick={() => go("usuarios")}>Usuarios</button>
          <button type="button" className={view === "plataforma" ? "on" : ""} onClick={() => go("plataforma")}>Plataforma</button>
          <button type="button" className={view === "equipos" ? "on" : ""} onClick={() => go("equipos")}>Equipos</button>
          <button type="button" className={view === "identidad" ? "on" : ""} onClick={() => go("identidad")}>Identidad</button>
        </nav>
        <p className="ctl-nav-label">Comercio</p>
        <nav>
          <button type="button" className={view === "campanas" ? "on" : ""} onClick={() => go("campanas")}>Campañas</button>
          <button type="button" className={view === "tienda" ? "on" : ""} onClick={() => go("tienda")}>Tienda</button>
          <button type="button" className={view === "publicidad" ? "on" : ""} onClick={() => go("publicidad")}>Publicidad</button>
          <button type="button" className={view === "mensajes" ? "on" : ""} onClick={() => go("mensajes")}>Mensajes</button>
          <button type="button" className={view === "avisos" ? "on" : ""} onClick={() => go("avisos")}>Avisos</button>
        </nav>
        <p className="ctl-nav-label">Catálogo</p>
        <nav>
          <button type="button" className={view === "planes" ? "on" : ""} onClick={() => go("planes")}>Precios y planes</button>
        </nav>
        <p className="ctl-nav-label">Sistema</p>
        <nav>
          <button type="button" className={view === "ajustes" ? "on" : ""} onClick={() => go("ajustes")}>Ajustes</button>
        </nav>
        <div className="ctl-foot">
          <span className={`ctl-db ${snap.connected ? "on" : "bad"}`}>
            {snap.connected ? "Supabase conectado" : "Supabase sin leer"}
          </span>
          <button type="button" onClick={() => { clearControlGate(); setUnlocked(false); setClave(""); void signOut(); }}>
              Salir
            </button>
        </div>
      </aside>

      <div className="ctl-main">
        <header className="ctl-top">
          <div>
            <p>{meta.kicker}</p>
            <h2>{meta.title}</h2>
          </div>
          <div className="ctl-top-actions">
            <button type="button" className="ctl-ghost" disabled={Boolean(busy)} onClick={() => void run("Actualizar", load)}>
              {busy === "Actualizar" ? "Leyendo…" : "Actualizar"}
            </button>
            <a className="ctl-ghost" href="https://ingenieria.miacademiapreu.com" target="_blank" rel="noreferrer">Abrir la web</a>
            <button type="button" className="ctl-ghost" onClick={() => { clearControlGate(); setUnlocked(false); void signOut(); }}>Salir</button>
          </div>
        </header>

        <section className="ctl-view">
          <p className="ctl-lead">{meta.lead}</p>
          {err ? <p className="ctl-err ctl-pad">{err}</p> : null}
          <p className="ctl-hint ctl-pad">{snap.message}</p>

          {view === "dashboard" ? (
            <>
          <div className="ctl-kpis">
                <button type="button" onClick={() => go("usuarios")}><small>Cuentas Auth</small><strong>{stats.usuarios}</strong><em>base maestra de usuarios</em></button>
                <button type="button" onClick={() => { go("usuarios"); setChip("pro"); }}><small>Pagando PRO</small><strong className="ctl-stat-pro">{stats.pro}</strong><em>{stats.free} Free · {stats.revoked} revocados</em></button>
                <button type="button" onClick={() => go("equipos")}><small>Equipos</small><strong>{snap.installs.length || stats.anclados}</strong><em>installs + anclas Ingeniería</em></button>
                <button type="button" onClick={() => go("plataforma")}><small>Cruce de apps</small><strong>{users.filter((u) => hasIng(u) && hasFolioPdf(u)).length}</strong><em>en Folio e Ingeniería a la vez</em></button>
                <button type="button" onClick={() => go("mensajes")}><small>Hilos de tienda</small><strong>{snap.threads.length}</strong><em>{snap.accounts.length} PC↔cuenta</em></button>
                <button type="button" onClick={() => go("publicidad")}><small>Inversión publicitaria</small><strong>{money(stats.spend)}</strong><em>{stats.articulos} avisos · {stats.campañas} campañas</em></button>
              </div>
              <div className="ctl-dash-grid">
                <section className="ctl-panel">
                  <h3>Actividad reciente</h3>
                  <table className="ctl-table">
                    <thead><tr><th>Cuenta</th><th>Plan</th><th>Identidad</th><th>Última vez</th></tr></thead>
                    <tbody>
                      {[...users].sort((a, b) => String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || ""))).slice(0, 8).map((u) => (
                        <tr key={u.user_id} className="click" onClick={() => { setSel(u); setTab("cuenta"); }}>
                          <td><b>{u.email || "Sin correo"}</b><small>{u.city || u.country || "—"}</small></td>
                          <td><span className={`ctl-pill ${planVigente(u) ? "pro" : "mute"}`}>{planVigente(u) ? "PRO" : "Free"}</span></td>
                          <td>
                            {aboutLine(u)}
                            <small><PlatformPills u={u} /></small>
                          </td>
                          <td>{whenAgo(u.last_seen_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 ? <p className="ctl-empty">Aún no hay cuentas.</p> : null}
                </section>
                <section className="ctl-panel">
                  <h3>Distribución por país</h3>
                  {countryRows.map(([name, n]) => (
                    <div key={name} className="ctl-country">
                      <span>{name}</span>
                      <div className="ctl-bar"><span style={{ width: `${Math.round((n / maxC) * 100)}%` }} /></div>
                      <b>{n}</b>
                    </div>
                  ))}
                  {countryRows.length === 0 ? <p className="ctl-hint">Cuando haya pulsos aparecerán aquí.</p> : null}
                </section>
          </div>
            </>
        ) : null}

        {view === "usuarios" ? (
            <UsersView
              users={users}
              filtered={filteredUsers}
              q={q}
              chip={chip}
              stats={stats}
              invite={invite}
              sel={sel}
              onQ={setQ}
              onChip={setChip}
              onInvite={setInvite}
              onOpen={(u) => { setSel(u); setTab("cuenta"); }}
              onSend={() =>
                void run("Invitar", async () => {
                  await adminInvite(invite.trim());
                  setInvite("");
                  flash("Invitación enviada");
                })
              }
            />
          ) : null}

          {view === "equipos" ? <InstallsView items={snap.installs} q={q} onQ={setQ} /> : null}

          {view === "identidad" ? <IdentityView items={snap.identities} /> : null}

          {view === "campanas" || view === "tienda" || view === "publicidad" ? (
            <CatalogView
              view={view}
              items={catalog}
              all={listings}
              q={q}
              onQ={setQ}
              edit={edit}
              product={product}
              busy={busy}
              onEdit={setEdit}
              onProduct={setProduct}
              onCreate={() => {
                void run("Publicar", async () => {
                  await adminCreateListing({ ...product, kind: view === "publicidad" ? "ad" : "product" });
                  setProduct({ name: "", description: "", price_label: "", category: "Servicios", city: "", phone: "" });
                  flash("Aviso publicado en la plaza");
                });
              }}
              onSave={() => {
                if (!edit) return;
                void run("Guardar", async () => {
                  await adminSaveListing(edit.id, {
                    name: edit.name,
                    description: edit.description,
                    price_label: edit.price_label,
                    category: edit.category,
                    city: edit.city,
                    department: edit.department,
                    phone: edit.phone,
                    hidden: edit.hidden,
                    active: edit.active,
                  });
                  flash("Aviso actualizado");
                });
              }}
              onHide={(hidden) => {
                if (!edit) return;
                void run(hidden ? "Ocultar" : "Publicar", async () => {
                  await adminSaveListing(edit.id, { hidden, active: !hidden });
                  flash(hidden ? "Aviso oculto" : "Aviso al aire");
                });
              }}
              onDelete={() => {
                if (!edit || !window.confirm("Se eliminará este aviso de la plaza.")) return;
                void run("Eliminar", async () => {
                  await adminDeleteListing(edit.id);
                  setEdit(null);
                  flash("Aviso eliminado");
                });
              }}
            />
          ) : null}

          {view === "avisos" ? (
            <div>
              <p className="ctl-hint">Avisos internos del titular. No entran al PDF del usuario.</p>
              <form
                className="ctl-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("Aviso", async () => {
                    await adminSaveNotice(notice.title, notice.body);
                    setNotice({ title: "", body: "" });
                    flash("Aviso guardado");
                  });
                }}
              >
                <label>Título<input value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} required /></label>
                <label>Texto<textarea value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} required /></label>
                <button type="submit" className="ctl-btn primary" disabled={Boolean(busy)}>Publicar aviso</button>
              </form>
              <table className="ctl-table">
                <thead><tr><th>Aviso</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {snap.notices.map((n) => (
                    <tr key={n.id}>
                      <td><b>{n.title}</b><small>{n.body}</small></td>
                      <td>{n.active ? "Activo" : "Oculto"}<small>{whenPe(n.created_at)}</small></td>
                      <td>
                        <button type="button" className="ctl-ghost danger" onClick={() => void run("Quitar aviso", async () => { await adminDeleteNotice(n.id); flash("Aviso eliminado"); })}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snap.notices.length === 0 ? <p className="ctl-empty">No hay avisos.</p> : null}
            </div>
          ) : null}

          {view === "planes" ? (
            <div>
              <BillingLaunchPanel force />
              <PrintPolicyPanel />
              <div className="ctl-kpis">
                {PLANES_PRO.map((p) => (
                  <div key={p.id} className="ctl-stat">
                    <small>{p.title}</small>
                    <b>{money(p.soles)}</b>
                    <span className="delta">{p.blurb}</span>
                  </div>
                ))}
                <div className="ctl-stat">
                  <small>Lectura de planos</small>
                  <b>{money(PDF_SOLES)}</b>
                  <span className="delta">Por hoja · agente de IA</span>
                </div>
              </div>
              <h3 className="ctl-sub">Cuentas Pro vigentes</h3>
              <table className="ctl-table">
                <thead><tr><th>Usuario</th><th>SKU</th><th>Vigencia</th><th>Nube</th></tr></thead>
                <tbody>
                  {users.filter(planVigente).map((u) => (
                    <tr key={u.user_id} className="click" onClick={() => { setSel(u); go("usuarios"); }}>
                      <td><b>{u.full_name || "—"}</b><small>{u.email}</small></td>
                      <td>{u.sku}</td>
                      <td>{whenPe(u.paid_until)}</td>
                      <td>{u.budgets} presupuestos</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.filter(planVigente).length === 0 ? <p className="ctl-empty">Nadie tiene Pro vigente.</p> : null}
            </div>
          ) : null}

          {view === "ajustes" ? (
            <section className="ctl-panel">
              <h3>Cómo opera este panel</h3>
              <p className="ctl-hint">Producción: <b>https://control-ingenieria.miacademiapreu.com</b>. Lee el proyecto Supabase <b>qfvgksstvdrxcugbdwkv</b> (App Nitro Pdf / Folio PDF), la misma base que Folio Control.</p>
              <p className="ctl-hint">El censo entra con la clave de titular. El servidor usa la clave secreta: no hay login Google en este panel.</p>
              <p className="ctl-hint">Soporte para liberar equipo: WhatsApp {SOPORTE_LABEL}.</p>
              <p className="ctl-hint">Estado: {snap.connected ? "Supabase conectado" : "sin lectura"} · {snap.message}</p>
              <h3 className="ctl-sub">Censo de tablas (lectura en vivo)</h3>
              <table className="ctl-table">
                <thead><tr><th>Familia</th><th>Tabla</th><th>Filas</th></tr></thead>
                <tbody>
                  {snap.tables.map((t) => (
                    <tr key={t.name}>
                      <td>{t.family}</td>
                      <td className="ctl-mono">{t.name}</td>
                      <td><b>{t.count}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snap.tables.length === 0 ? <p className="ctl-empty">Aún no hay censo. Pulse Actualizar.</p> : null}
            </section>
          ) : null}
        </section>
      </div>

      {sel ? (
        <div className="ctl-overlay">
          <div className="ctl-overlay-back" onClick={() => setSel(null)} />
          <aside className="ctl-drawer">
            <div className="ctl-drawer-top">
              <div>
                <p className="ctl-drawer-kicker">Ficha de cuenta</p>
                <h3>{sel.email || sel.full_name || "Usuario"}</h3>
                <span className={`ctl-pill ${planVigente(sel) ? "pro" : "mute"}`}>{planVigente(sel) ? "PRO" : "Free"}</span>
                <span className={`ctl-pill ${sel.status === "revoked" ? "warn" : "ok"}`}>{sel.status || "active"}</span>
                <div className="ctl-flags" style={{ marginTop: 10 }}>
                  <div className="ctl-flag"><span>Folio PC</span><Flag on={sel.platforms.includes("folio")} yes="Sí" no="No" kind="folio" /></div>
                  <div className="ctl-flag"><span>Folio Android</span><Flag on={hasAndroid(sel)} yes="Sí" no="No" kind="and" /></div>
                  <div className="ctl-flag"><span>Ingeniería (cálculos)</span><Flag on={hasIng(sel)} yes="Sí" no="No" kind="ing" /></div>
                </div>
              </div>
              <button type="button" className="ctl-ghost" onClick={() => setSel(null)}>Cerrar</button>
            </div>
            <div className="ctl-tabs">
              <button type="button" className={tab === "cuenta" ? "on" : ""} onClick={() => setTab("cuenta")}>Cuenta y plan</button>
              <button type="button" className={tab === "prefs" ? "on" : ""} onClick={() => setTab("prefs")}>Preferencias</button>
              <button type="button" className={tab === "perfil" ? "on" : ""} onClick={() => setTab("perfil")}>Perfil 360</button>
              <button type="button" className={tab === "pcs" ? "on" : ""} onClick={() => setTab("pcs")}>Equipos ({sel.installCount})</button>
              <button type="button" className={tab === "ads" ? "on" : ""} onClick={() => setTab("ads")}>Publicidad ({sel.listings + sel.ads})</button>
            </div>
            {tab === "cuenta" ? (
              <form
                className="ctl-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("Guardar ficha", async () => {
                    await adminSaveUser(sel.user_id, {
                      email: sel.email,
                      plan: draft.plan,
                      plan_id: draft.sku,
                      status: draft.status,
                      device_limit: draft.device_limit,
                      expiration_at: draft.expiration_at || null,
                      phone: draft.phone,
                    });
                    flash("Cambios guardados");
                  });
                }}
              >
                <div className="ctl-form-grid">
                  <label>Plan
                    <select value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })}>
                      <option value="free">Free</option>
                      <option value="pro">PRO</option>
                    </select>
                  </label>
                  <label>SKU de cobro
                    <select value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })}>
                      <option value="free">free</option>
                      {PLANES_PRO.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
                    </select>
                  </label>
                  <label>Estado
                    <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                      <option value="active">Activo</option>
                      <option value="grace">Gracia</option>
                      <option value="expired">Vencido</option>
                      <option value="revoked">Revocado</option>
                    </select>
                  </label>
                  <label>Límite de PCs
                    <input type="number" min={1} value={draft.device_limit} onChange={(e) => setDraft({ ...draft, device_limit: Number(e.target.value) || 1 })} />
                  </label>
                  <label>Vence (vacío = de por vida / Free)
                    <input type="datetime-local" value={draft.expiration_at} onChange={(e) => setDraft({ ...draft, expiration_at: e.target.value })} />
                  </label>
                  <label>Celular de vendedor
                    <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+51…" />
                  </label>
                </div>
                <p className="ctl-hint">Alta {whenPe(sel.profile_at)} · último acceso {whenPe(sel.last_sign_in_at || sel.last_seen_at)} · {sel.full_name || "sin nombre"}</p>
                <p className="ctl-hint">Google {sel.google_email || sel.email || "—"}{sel.google_sub ? ` · sub ${sel.google_sub.slice(0, 16)}…` : ""} · Folio {sel.folio_plan || "—"} / {sel.folio_status || "—"}</p>
                <button type="submit" className="ctl-btn primary" disabled={Boolean(busy)}>{busy === "Guardar ficha" ? "Guardando…" : "Guardar cambios"}</button>
              </form>
            ) : null}
            {tab === "prefs" ? (
              <div>
                <p className="ctl-hint">{aboutLine(sel)}</p>
                <p>Oficio: {sel.craft_family || "—"} · {sel.profession_label || "—"}</p>
                <p>Edad: {sel.age ?? "—"} · franja {sel.age_band || "—"} · ubigeo {sel.ubigeo || "—"}</p>
                <p>Carrera: {sel.career_path || "—"}</p>
                <p>Organización: {sel.organization || "—"}</p>
                <p>Rol: {sel.workplace_role || "—"}</p>
                <p>Segmento publicitario: <b>{sel.ad_segment || "—"}</b></p>
                <p>Último módulo: {sel.last_module || "—"}</p>
                <p>Tiempo en plataforma: {sel.dwell_seconds ? `${Math.floor(sel.dwell_seconds / 60)} min ${sel.dwell_seconds % 60} s` : "sin pulso aún"}</p>
                <p>Clics registrados: {sel.click_count}</p>
                {sel.click_top.length ? <p>Clics más frecuentes: {sel.click_top.join(" · ")}</p> : null}
                {sel.modules_used.length ? <p>Motores visitados: {sel.modules_used.join(" · ")}</p> : null}
                <p>Presupuestos en nube: {sel.budgets} · hilos de tienda: {sel.threads} · pagos Ingeniería: {sel.payments}</p>
                <p className="ctl-hint">{sel.summary || "Sin resumen de identidad todavía."}</p>
                <div>{sel.tastes.map((t) => <span key={t.id || t.label} className="ctl-taste">{t.label}<b>{t.score.toFixed(1)}</b></span>)}</div>
                {sel.tastes.length === 0 && sel.rubros.length ? <p>{sel.rubros.join(" · ")}</p> : null}
              </div>
            ) : null}
            {tab === "perfil" ? (
              <Perfil360Panel
                userId={sel.user_id}
                pack={perfil}
                busy={busy}
                onRecalc={() => {
                  void run("Recalcular perfil", async () => {
                    await adminRecalculateProfile(sel.user_id);
                    const data = await adminUserProfile(sel.user_id);
                    setPerfil(data);
                    flash("Perfil 360 recalculado desde evidencia");
                  });
                }}
              />
            ) : null}
            {tab === "pcs" ? (
              <div>
                <p>Estado Ingeniería: {sel.device_id ? "Anclado" : "Libre / sin ancla"}</p>
                <p>Equipo anclado: {sel.device_label || "—"}</p>
                <p>Installs Folio: {sel.installCount} · PC↔cuenta: {snap.accounts.filter((a) => a.user_id === sel.user_id).length}</p>
                <table className="ctl-table">
                  <thead><tr><th>App</th><th>Equipo</th><th>Red</th><th>Visto</th></tr></thead>
                  <tbody>
                    {snap.installs.filter((i) => i.user_id === sel.user_id).map((i) => (
                      <tr key={i.install_id}>
                        <td><span className={`ctl-pill ${i.platform === "ingenieria" ? "ing" : i.platform === "android" ? "and" : "folio"}`}>{appLabel(i.platform, i.app)}</span></td>
                        <td><b>{i.hostname || i.install_id.slice(0, 12)}</b><small>{i.os || i.version || "—"}</small></td>
                        <td>{[i.city, i.country].filter(Boolean).join(", ") || "—"}<small>{i.ip || i.location_source || "—"}</small></td>
                        <td>{whenAgo(i.last_seen_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {snap.installs.filter((i) => i.user_id === sel.user_id).length === 0 ? <p className="ctl-hint">Sin huella de instalación todavía.</p> : null}
                <p>Última vez: {whenAgo(sel.last_seen_at)} · {whenPe(sel.last_seen_at)}</p>
                <div className="ctl-actions">
                  <button type="button" className="ctl-btn primary" disabled={Boolean(busy)} onClick={() => void run("Cerrar sesiones", async () => { await adminRevoke(sel.user_id); flash("Sesiones cerradas. El usuario puede anclar otro equipo."); })}>
                    Revocar y liberar equipo
                  </button>
                </div>
                <p className="ctl-hint">Si piden liberar, WhatsApp {SOPORTE_LABEL}.</p>
              </div>
            ) : null}
            {tab === "ads" ? (
              <div>
                <p>Artículos: {sel.listings}</p>
                <p>Campañas: {sel.ads}</p>
                <p>Presupuestos en nube: {sel.budgets}</p>
              </div>
            ) : null}
            <div className="ctl-actions">
              {sel.status === "revoked" ? (
                <button type="button" className="ctl-ghost" disabled={Boolean(busy)} onClick={() => void run("Restaurar", async () => { await adminRestore(sel.user_id, sel.email); flash("Cuenta restaurada"); })}>Restaurar cuenta</button>
              ) : (
                <button type="button" className="ctl-ghost danger" disabled={Boolean(busy)} onClick={() => void run("Revocar", async () => { await adminSaveUser(sel.user_id, { email: sel.email, plan: "free", plan_id: "free", status: "revoked" }); flash("Cuenta revocada (pasa a Free)"); })}>Revocar (pasa a Free)</button>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {toast ? <div className="ctl-toast">{toast}</div> : null}
    </div>
  );
}

function UsersView({
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
  const ing = users.filter(hasIng).length;
  const folio = users.filter(hasFolioPdf).length;
  const android = users.filter(hasAndroid).length;
  const both = users.filter((u) => hasIng(u) && hasFolioPdf(u)).length;
  return (
    <div>
      <p className="ctl-hint">Identidad única en public.users. Cada fila indica si esa misma cuenta usa Ingeniería, Folio PDF o ambas.</p>
      <div className="ctl-toolbar">
        <input className="ctl-search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Buscar correo, oficio, ciudad, módulo…" />
        <div className="ctl-chips">
          {([
            ["all", `Todos (${stats.usuarios})`],
            ["ingenieria", `Ingeniería (${ing})`],
            ["folio", `Folio (${folio})`],
            ["android", `Android (${android})`],
            ["ambos", `Ambos (${both})`],
            ["lectura", `Con lectura (${stats.lectura})`],
            ["pro", `PRO (${stats.pro})`],
            ["free", `Free (${stats.free})`],
            ["revoked", `Revocados (${stats.revoked})`],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={chip === id ? "on" : ""} onClick={() => onChip(id)}>{label}</button>
          ))}
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
                <small>{u.installCount ? `${u.installCount} equipo(s)` : "sin huella"}{u.last_module ? ` · ${u.last_module}` : ""}</small>
              </td>
              <td>{aboutLine(u)}<small>{u.documentType || u.workplace_role || "sin tipo"}</small></td>
              <td>{tasteLine(u)}<small>{u.tasteCount} gustos{u.last_module ? ` · último módulo ${u.last_module}` : ""}</small></td>
              <td><span className={`ctl-pill ${planVigente(u) ? "pro" : "mute"}`}>{planVigente(u) ? "PRO" : "Free"}</span><small>{u.sku}</small></td>
              <td>{whenAgo(u.last_seen_at)}<small>{whenPe(u.profile_at)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 ? <p className="ctl-empty">Ninguna cuenta con ese filtro.</p> : null}
      <div className="ctl-invite">
        <h3>Invitar por correo</h3>
        <input value={invite} onChange={(e) => onInvite(e.target.value)} placeholder="cliente@correo.com" />
        <button type="button" className="ctl-btn primary" onClick={onSend}>Enviar invitación</button>
      </div>
    </div>
  );
}

function InstallsView({ items, q, onQ }: { items: AdminInstall[]; q: string; onQ: (v: string) => void }) {
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
              <td><span className={`ctl-pill ${i.platform === "ingenieria" ? "ing" : i.platform === "android" ? "and" : "folio"}`}>{appLabel(i.platform, i.app)}</span></td>
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

function IdentityView({ items }: { items: AdminIdentity[] }) {
  if (!items.length) return <p className="ctl-empty">Aún no hay perfiles. Use un módulo en Ingeniería o abra PDFs en Folio.</p>;
  return (
    <div>
      <p className="ctl-hint">Perfil cuajado: oficio, módulos, gustos. Folio e Ingeniería (mismos usuarios). El PDF no se sube.</p>
      {items.slice().sort((a, b) => (b.coverage || 0) - (a.coverage || 0)).map((i) => (
        <article key={i.user_id || i.email} className="ctl-panel ctl-identity">
          <p><b>{i.occupation || "Sin oficio"}</b> · {[i.city, i.district, i.department, i.country].filter(Boolean).join(" · ") || "—"} · cobertura {i.coverage || 0}%</p>
          <div className="ctl-bar"><span style={{ width: `${Math.min(100, i.coverage || 0)}%` }} /></div>
          <p>Rol {i.role || "—"} · documento {i.document_type || "—"} · edad {i.age_band || "—"} · {i.email}</p>
          <p className="ctl-hint">Carrera {i.career_path || "—"} · especialidad {i.specialty_label || "—"} · grado {i.degree_id || "—"} · ubigeo {i.ubigeo || "—"} {i.settlement ? `· ${i.settlement}` : ""}</p>
          <p className="ctl-hint">Rubros: {(i.rubros || []).join(" · ") || "—"}{i.last_module ? ` · último módulo ${i.last_module}` : ""}</p>
          <p className="ctl-hint">Alternativas: {i.professions.slice(0, 6).map((p) => `${p.label} (${p.closeness.toFixed(2)})`).join(" · ") || "—"}</p>
          <div>
            {i.tastes.slice(0, 18).map((t) => <span key={t.id || t.label} className="ctl-taste">{t.label}<b>{Number(t.score || 0).toFixed(1)}</b></span>)}
            {i.tastes.length === 0 ? <span className="ctl-hint">Sin gustos todavía.</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function CatalogView({
  view, items, all, q, onQ, edit, product, busy, onEdit, onProduct, onCreate, onSave, onHide, onDelete,
}: {
  view: View;
  items: Listing[];
  all: Listing[];
  q: string;
  onQ: (v: string) => void;
  edit: Listing | null;
  product: { name: string; description: string; price_label: string; category: string; city: string; phone: string };
  busy: string;
  onEdit: (x: Listing) => void;
  onProduct: (x: { name: string; description: string; price_label: string; category: string; city: string; phone: string }) => void;
  onCreate: () => void;
  onSave: () => void;
  onHide: (hidden: boolean) => void;
  onDelete: () => void;
}) {
  const ads = all.filter((x) => x.kind === "ad").length;
  const products = all.length - ads;
  return (
    <div>
      <div className="ctl-toolbar">
        <input className="ctl-search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Buscar nombre, vendedor, ciudad, paquete…" />
        {view === "campanas" ? (
          <div className="ctl-chips">
            <span className="ctl-pill mute">Todos ({all.length})</span>
            <span className="ctl-pill">Campañas ({ads})</span>
            <span className="ctl-pill">Productos ({products})</span>
          </div>
        ) : null}
      </div>
            <table className="ctl-table">
              <thead>
                <tr>
            <th>Pieza</th>
            <th>Tipo</th>
            <th>Paquete / precio</th>
            <th>Alcance</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
          {items.map((row) => {
            const live = row.active !== false && !row.hidden;
            return (
              <tr key={row.id} className={`click${edit?.id === row.id ? " on" : ""}`} onClick={() => onEdit(row)}>
                <td><b>{row.name}</b><small>{row.seller_email || row.seller_name} · {row.city}</small></td>
                <td><span className={`ctl-pill ${row.kind === "ad" ? "pro" : "mute"}`}>{row.kind === "ad" ? "Campaña" : "Producto"}</span><small>{row.category}</small></td>
                <td>{row.campaign_package || row.price_label}<small>{money(row.paid_soles || 0)}</small></td>
                <td>{(row.people || 0).toLocaleString("es-PE")} pers.<small>{row.impressions_used || 0}{row.impressions_cap ? ` / ${row.impressions_cap}` : ""} imp.</small></td>
                <td><span className={`ctl-pill ${live ? "ok" : "warn"}`}>{live ? "Al aire" : "Oculta"}</span><small>{whenPe(row.created_at)}</small></td>
                  </tr>
            );
          })}
              </tbody>
            </table>
      {items.length === 0 ? <p className="ctl-empty">Sin publicaciones.</p> : null}

      {edit ? (
        <form className="ctl-form" style={{ marginTop: 24 }} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          <h3>Editar aviso</h3>
          <label>Título<input value={edit.name} onChange={(e) => onEdit({ ...edit, name: e.target.value })} /></label>
          <label>Descripción<textarea value={edit.description} onChange={(e) => onEdit({ ...edit, description: e.target.value })} /></label>
          <div className="ctl-form-grid">
            <label>Precio<input value={edit.price_label} onChange={(e) => onEdit({ ...edit, price_label: e.target.value })} /></label>
            <label>Categoría
              <select value={edit.category} onChange={(e) => onEdit({ ...edit, category: e.target.value })}>
                {STORE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Ciudad<input value={edit.city} onChange={(e) => onEdit({ ...edit, city: e.target.value })} /></label>
            <label>Teléfono<input value={edit.phone} onChange={(e) => onEdit({ ...edit, phone: e.target.value })} /></label>
          </div>
          <div className="ctl-actions">
            <button type="submit" className="ctl-btn primary" disabled={Boolean(busy)}>{busy === "Guardar" ? "Guardando…" : "Guardar cambios"}</button>
            <button type="button" className="ctl-ghost" onClick={() => onHide(!edit.hidden)}>{edit.hidden ? "Publicar" : "Ocultar"}</button>
            <button type="button" className="ctl-ghost danger" onClick={onDelete}>Eliminar</button>
          </div>
        </form>
        ) : null}

      {view === "tienda" ? (
        <form className="ctl-form" style={{ marginTop: 28 }} onSubmit={(e) => { e.preventDefault(); onCreate(); }}>
          <h3>Nuevo producto</h3>
          <label>Nombre<input value={product.name} onChange={(e) => onProduct({ ...product, name: e.target.value })} required /></label>
          <label>Descripción<textarea value={product.description} onChange={(e) => onProduct({ ...product, description: e.target.value })} /></label>
          <div className="ctl-form-grid">
            <label>Precio<input value={product.price_label} onChange={(e) => onProduct({ ...product, price_label: e.target.value })} placeholder="Consultar" /></label>
            <label>Categoría
              <select value={product.category} onChange={(e) => onProduct({ ...product, category: e.target.value })}>
                {STORE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Ciudad<input value={product.city} onChange={(e) => onProduct({ ...product, city: e.target.value })} /></label>
            <label>Teléfono<input value={product.phone} onChange={(e) => onProduct({ ...product, phone: e.target.value })} /></label>
          </div>
          <button type="submit" className="ctl-btn primary" disabled={Boolean(busy)}>Publicar en la plaza</button>
        </form>
        ) : null}
    </div>
  );
}
