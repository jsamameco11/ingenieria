import { folio } from "./folio";
import { readControlToken } from "./controlGate";
import { asListing, type Listing } from "./mercado";

export type AdminTaste = { id: string; label: string; family: string; score: number };

export type AdminPlatformBucket = {
  id: string;
  label: string;
  count: number;
  hosts: string[];
  lastSeen: string;
  present: boolean;
};

export type AdminUser = {
  user_id: string;
  email: string;
  full_name: string;
  profession_label: string;
  organization: string;
  district: string;
  department: string;
  country: string;
  city: string;
  workplace_role: string;
  plan: "free" | "pro";
  paying: boolean;
  paid_until: string | null;
  sku: string;
  status: string;
  device_limit: number;
  phone: string;
  device_id: string;
  device_label: string;
  device_updated_at: string | null;
  listings: number;
  ads: number;
  budgets: number;
  threads: number;
  payments: number;
  profile_at: string | null;
  last_seen_at: string | null;
  last_sign_in_at: string | null;
  folio_plan: string;
  folio_status: string;
  platforms: string[];
  platformBreakdown: Record<string, AdminPlatformBucket>;
  platformCount: number;
  google_email: string;
  google_sub: string;
  last_module: string;
  rubros: string[];
  tastes: AdminTaste[];
  tasteCount: number;
  coverage: number;
  installCount: number;
  public_user_code: string;
  documentType: string;
  summary: string;
  career_path: string;
  age_band: string;
  ubigeo: string;
  craft_family: string;
  age: number | null;
  ad_segment: string;
  dwell_seconds: number;
  click_count: number;
  click_top: string[];
  modules_used: string[];
};

export type AdminInstall = {
  user_id: string;
  email: string;
  google_email: string;
  install_id: string;
  hostname: string;
  os: string;
  ip: string;
  city: string;
  department: string;
  province: string;
  district: string;
  country: string;
  last_seen_at: string | null;
  first_seen_at: string | null;
  license_tier: string;
  version: string;
  app: string;
  platform: string;
  locale: string;
  location_source: string;
  machine_key: string;
};

export type AdminIdentity = {
  user_id: string;
  email: string;
  occupation: string;
  city: string;
  coverage: number;
  age_band: string;
  degree_id: string;
  specialty_label: string;
  role: string;
  document_type: string;
  department: string;
  province: string;
  district: string;
  country: string;
  ubigeo: string;
  settlement: string;
  career_path: string;
  closeness: number;
  tastes: AdminTaste[];
  professions: { label: string; closeness: number }[];
  rubros: string[];
  last_module: string;
};

export type AdminThread = {
  id: string;
  listing_id: string;
  listing_name: string;
  listing_price: string;
  listing_kind: string;
  seller_id: string;
  seller_name: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  last_body: string;
  last_at: string | null;
  buyer_unread: number;
  seller_unread: number;
};

export type AdminAccount = {
  install_id: string;
  user_id: string;
  email: string;
  google_sub: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type AdminTableCount = { family: string; name: string; count: number };

export type AdminNotice = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
};

export type AdminSnapshot = {
  users: AdminUser[];
  listings: Listing[];
  installs: AdminInstall[];
  identities: AdminIdentity[];
  threads: AdminThread[];
  accounts: AdminAccount[];
  tables: AdminTableCount[];
  notices: AdminNotice[];
  countries: Record<string, number>;
  connected: boolean;
  source: "supabase" | "rpc" | "none";
  message: string;
};

function asTaste(row: Record<string, unknown>): AdminTaste {
  return {
    id: String(row.id || ""),
    label: String(row.label || row.id || "Gusto"),
    family: String(row.family || ""),
    score: Number(row.score || 0),
  };
}

function asBucket(row: Record<string, unknown> | undefined, fallback: AdminPlatformBucket): AdminPlatformBucket {
  if (!row) return fallback;
  return {
    id: String(row.id || fallback.id),
    label: String(row.label || fallback.label),
    count: Number(row.count || 0),
    hosts: Array.isArray(row.hosts) ? row.hosts.map(String) : [],
    lastSeen: String(row.lastSeen || ""),
    present: Boolean(row.present),
  };
}

function asUser(row: Record<string, unknown>): AdminUser {
  const until = row.paid_until ? String(row.paid_until) : null;
    const live = Boolean(row.paying) || (row.plan === "pro" && (!until || new Date(until).getTime() > Date.now()) && String(row.status || "") !== "revoked");
  const platforms = Array.isArray(row.platforms) ? row.platforms.map(String) : [];
  const rubros = Array.isArray(row.rubros) ? row.rubros.map(String) : [];
  const tastes = Array.isArray(row.tastes) ? row.tastes.map((t) => asTaste((t || {}) as Record<string, unknown>)) : [];
  const rawBd = (row.platformBreakdown || {}) as Record<string, Record<string, unknown>>;
  const platformBreakdown = {
    folio: asBucket(rawBd.folio, { id: "folio", label: "Folio PC", count: 0, hosts: [], lastSeen: "", present: platforms.includes("folio") }),
    android: asBucket(rawBd.android, { id: "android", label: "Folio Android", count: 0, hosts: [], lastSeen: "", present: platforms.includes("android") }),
    ingenieria: asBucket(rawBd.ingenieria, { id: "ingenieria", label: "Ingeniería", count: 0, hosts: [], lastSeen: "", present: platforms.includes("ingenieria") }),
  };
  return {
    user_id: String(row.user_id || row.id || ""),
    email: String(row.email || ""),
    full_name: String(row.full_name || ""),
    profession_label: String(row.profession_label || ""),
    organization: String(row.organization || ""),
    district: String(row.district || ""),
    department: String(row.department || ""),
    country: String(row.country || "Perú"),
    city: String(row.city || row.district || ""),
    workplace_role: String(row.workplace_role || ""),
    plan: live ? "pro" : "free",
    paying: Boolean(live),
    paid_until: until,
    sku: String(row.sku || row.plan_id || (live ? "mc-monthly" : "free")),
    status: String(row.status || row.folio_status || "active"),
    device_limit: Number(row.device_limit || 1) || 1,
    phone: String(row.phone || ""),
    device_id: String(row.device_id || ""),
    device_label: String(row.device_label || ""),
    device_updated_at: row.device_updated_at ? String(row.device_updated_at) : null,
    listings: Number(row.listings || 0),
    ads: Number(row.ads || 0),
    budgets: Number(row.budgets || 0),
    threads: Number(row.threads || 0),
    payments: Number(row.payments || 0),
    profile_at: row.profile_at ? String(row.profile_at) : null,
    last_seen_at: row.last_seen_at ? String(row.last_seen_at) : row.device_updated_at ? String(row.device_updated_at) : null,
    last_sign_in_at: row.last_sign_in_at ? String(row.last_sign_in_at) : null,
    folio_plan: String(row.folio_plan || ""),
    folio_status: String(row.folio_status || row.status || ""),
    platforms: platforms.length ? platforms : ["folio"],
    platformBreakdown,
    platformCount: Number(row.platformCount || platforms.length || 1),
    google_email: String(row.google_email || row.email || ""),
    google_sub: String(row.google_sub || ""),
    last_module: String(row.last_module || ""),
    rubros,
    tastes,
    tasteCount: Number(row.tasteCount || tastes.length),
    coverage: Number(row.coverage || 0),
    installCount: Number(row.installCount || (row.device_id ? 1 : 0)),
    public_user_code: String(row.public_user_code || ""),
    documentType: String(row.documentType || ""),
    summary: String(row.summary || ""),
    career_path: String(row.career_path || ""),
    age_band: String(row.age_band || ""),
    ubigeo: String(row.ubigeo || ""),
    craft_family: String(row.craft_family || ""),
    age: row.age == null || row.age === "" ? null : Number(row.age),
    ad_segment: String(row.ad_segment || ""),
    dwell_seconds: Number(row.dwell_seconds || 0),
    click_count: Number(row.click_count || 0),
    click_top: Array.isArray(row.click_top) ? row.click_top.map(String) : [],
    modules_used: Array.isArray(row.modules_used) ? row.modules_used.map(String) : [],
  };
}

function asInstall(row: Record<string, unknown>): AdminInstall {
  const app = String(row.app || "folio-pdf");
  return {
    user_id: String(row.user_id || ""),
    email: String(row.email || ""),
    google_email: String(row.google_email || row.email || ""),
    install_id: String(row.install_id || ""),
    hostname: String(row.hostname || ""),
    os: String(row.os || ""),
    ip: String(row.ip || ""),
    city: String(row.city || ""),
    department: String(row.department || ""),
    province: String(row.province || ""),
    district: String(row.district || ""),
    country: String(row.country || ""),
    last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
    first_seen_at: row.first_seen_at ? String(row.first_seen_at) : null,
    license_tier: String(row.license_tier || ""),
    version: String(row.version || ""),
    app,
    platform: String(row.platform || (app === "memorcalc" ? "ingenieria" : app.includes("android") ? "android" : "folio")),
    locale: String(row.locale || ""),
    location_source: String(row.location_source || ""),
    machine_key: String(row.machine_key || ""),
  };
}

function asIdentity(row: Record<string, unknown>): AdminIdentity {
  const tastes = Array.isArray(row.tastes) ? row.tastes.map((t) => asTaste((t || {}) as Record<string, unknown>)) : [];
  const professions = Array.isArray(row.professions)
    ? row.professions.map((p) => {
        const o = (p || {}) as Record<string, unknown>;
        return { label: String(o.label || ""), closeness: Number(o.closeness || 0) };
      })
    : [];
  return {
    user_id: String(row.user_id || ""),
    email: String(row.email || ""),
    occupation: String(row.occupation || ""),
    city: String(row.city || ""),
    coverage: Number(row.coverage || 0),
    age_band: String(row.age_band || ""),
    degree_id: String(row.degree_id || ""),
    specialty_label: String(row.specialty_label || ""),
    role: String(row.role || ""),
    document_type: String(row.document_type || ""),
    department: String(row.department || ""),
    province: String(row.province || ""),
    district: String(row.district || ""),
    country: String(row.country || ""),
    ubigeo: String(row.ubigeo || ""),
    settlement: String(row.settlement || ""),
    career_path: String(row.career_path || ""),
    closeness: Number(row.closeness || 0),
    tastes,
    professions,
    rubros: Array.isArray(row.rubros) ? row.rubros.map(String) : [],
    last_module: String(row.last_module || ""),
  };
}

function asThread(row: Record<string, unknown>): AdminThread {
  return {
    id: String(row.id || ""),
    listing_id: String(row.listing_id || ""),
    listing_name: String(row.listing_name || ""),
    listing_price: String(row.listing_price || ""),
    listing_kind: String(row.listing_kind || "product"),
    seller_id: String(row.seller_id || ""),
    seller_name: String(row.seller_name || ""),
    buyer_id: String(row.buyer_id || ""),
    buyer_name: String(row.buyer_name || ""),
    buyer_email: String(row.buyer_email || ""),
    last_body: String(row.last_body || ""),
    last_at: row.last_at ? String(row.last_at) : null,
    buyer_unread: Number(row.buyer_unread || 0),
    seller_unread: Number(row.seller_unread || 0),
  };
}

function asAccount(row: Record<string, unknown>): AdminAccount {
  return {
    install_id: String(row.install_id || ""),
    user_id: String(row.user_id || ""),
    email: String(row.email || ""),
    google_sub: String(row.google_sub || ""),
    first_seen_at: row.first_seen_at ? String(row.first_seen_at) : null,
    last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
  };
}

function asTable(row: Record<string, unknown>): AdminTableCount {
  return {
    family: String(row.family || "cuenta"),
    name: String(row.name || ""),
    count: Number(row.count || 0),
  };
}

function asNotice(row: Record<string, unknown>): AdminNotice {
  return {
    id: String(row.id || ""),
    title: String(row.title || "Aviso"),
    body: String(row.body || row.text || ""),
    active: row.active !== false,
    created_at: String(row.created_at || ""),
  };
}

async function controlFetch(path: string, init: RequestInit = {}) {
  const token = readControlToken();
  const res = await fetch(`/api/control/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(init.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.message || `No se pudo hablar con /api/control/${path}.`));
  return data;
}

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

export async function adminSnapshot(): Promise<AdminSnapshot> {
  try {
    const data = await controlFetch("snapshot");
    const users = ((data.users as Record<string, unknown>[]) ?? []).map(asUser);
    return {
      users,
      listings: ((data.listings as Record<string, unknown>[]) ?? []).map((row) => asListing(row)),
      installs: ((data.installs as Record<string, unknown>[]) ?? []).map(asInstall),
      identities: ((data.identities as Record<string, unknown>[]) ?? []).map(asIdentity),
      threads: ((data.threads as Record<string, unknown>[]) ?? []).map(asThread),
      accounts: ((data.accounts as Record<string, unknown>[]) ?? []).map(asAccount),
      tables: ((data.tables as Record<string, unknown>[]) ?? []).map(asTable),
      notices: ((data.notices as Record<string, unknown>[]) ?? []).map(asNotice),
      countries: (data.countries as Record<string, number>) || {},
      connected: true,
      source: "supabase",
      message: String(data.message || `Supabase conectado · ${users.length} cuentas`),
    };
  } catch (apiErr) {
    try {
      const [census, rows] = await Promise.all([
        folio.rpc("memorcalc_admin_census"),
        folio.rpc("memorcalc_admin_listings"),
      ]);
      if (census.error) throw new Error(census.error.message);
      if (rows.error) throw new Error(rows.error.message);
      const users = ((census.data as Record<string, unknown>[]) ?? []).map(asUser);
      const listings = (Array.isArray(rows.data) ? rows.data : []).map((row) => asListing(row as Record<string, unknown>));
      return {
        ...EMPTY,
        users,
        listings,
        connected: true,
        source: "rpc",
        message: `Sesión Google del titular · ${users.length} cuentas`,
      };
    } catch (rpcErr) {
      const a = apiErr instanceof Error ? apiErr.message : "API de control no disponible.";
      const b = rpcErr instanceof Error ? rpcErr.message : "RPC no disponible.";
      return { ...EMPTY, message: `${a} ${b}` };
    }
  }
}

export async function adminSaveUser(userId: string, patch: Record<string, unknown>) {
  return controlFetch("user", { method: "POST", body: JSON.stringify({ user_id: userId, ...patch }) });
}

export async function adminInvite(email: string) {
  return controlFetch("invite", { method: "POST", body: JSON.stringify({ email }) });
}

export async function adminRestore(userId: string, email: string) {
  return controlFetch("restore", { method: "POST", body: JSON.stringify({ user_id: userId, email, status: "active", plan: "free" }) });
}

export async function adminCreateListing(body: Record<string, unknown>) {
  const data = await controlFetch("listing", { method: "PUT", body: JSON.stringify(body) });
  return asListing((data.listing || {}) as Record<string, unknown>);
}

export async function adminSaveNotice(title: string, body: string) {
  return controlFetch("notices", { method: "POST", body: JSON.stringify({ title, body, active: true }) });
}

export async function adminDeleteNotice(id: string) {
  return controlFetch("notices", { method: "DELETE", body: JSON.stringify({ id }) });
}

export async function adminUserProfile(userId: string) {
  return controlFetch(`profile?user_id=${encodeURIComponent(userId)}`);
}

export async function adminRecalculateProfile(userId: string) {
  return controlFetch("profile/recalculate", { method: "POST", body: JSON.stringify({ user_id: userId }) });
}

export async function adminSetPlan(userId: string, email: string, plan: "pro" | "free", days = 31) {
  try {
    return await controlFetch("plan", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, email, plan, days }),
    });
  } catch {
    const { data, error } = await folio.rpc("memorcalc_admin_set_plan", {
      p_user_id: userId,
      p_email: email,
      p_plan: plan,
      p_days: days,
    });
    if (error) throw new Error(error.message);
    return data as { plan?: string; paid_until?: string | null };
  }
}

export async function adminSaveListing(
  id: string,
  patch: Partial<Pick<Listing, "name" | "description" | "price_label" | "category" | "city" | "department" | "phone" | "hidden" | "active">>,
) {
  try {
    const data = await controlFetch("listing", { method: "POST", body: JSON.stringify({ id, patch }) });
    return asListing((data.listing || {}) as Record<string, unknown>);
  } catch {
    const { data, error } = await folio.rpc("memorcalc_admin_save_listing", { p_id: id, p_patch: patch });
    if (error) throw new Error(error.message);
    return asListing((data || {}) as Record<string, unknown>);
  }
}

export async function adminDeleteListing(id: string) {
  try {
    await controlFetch("listing", { method: "DELETE", body: JSON.stringify({ id }) });
    return;
  } catch {
    const { error } = await folio.rpc("memorcalc_admin_delete_listing", { p_id: id });
    if (error) throw new Error(error.message);
  }
}

export async function adminRevoke(userId: string) {
  try {
    await controlFetch("revoke", { method: "POST", body: JSON.stringify({ user_id: userId }) });
    return;
  } catch {
    const { error } = await folio.rpc("memorcalc_revoke_sessions", { p_user_id: userId });
    if (error) throw new Error(error.message);
  }
}

export function planVigente(u: Pick<AdminUser, "plan" | "paid_until" | "paying" | "status">) {
  if (u.status === "revoked") return false;
  if (u.paying) return true;
  if (u.plan !== "pro") return false;
  if (!u.paid_until) return true;
  return new Date(u.paid_until).getTime() > Date.now();
}

export function whenPe(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function whenAgo(iso: string | null | undefined) {
  if (!iso) return "Sin actividad";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin actividad";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 14) return `hace ${Math.floor(s / 86400)} d`;
  return whenPe(iso);
}
