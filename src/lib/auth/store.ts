import { folio } from "../folio";
import { analyzeUsage } from "./engine";
import { fetchMasterIdentity, saveMasterIdentity } from "./masterIdentity";
import { ingestOnboarding } from "../perfil/pipeline";
import { adSegmentOf, emptyProfile, profileComplete, type CraftFamily, type UsageEvent, type UserInsight, type UserProfile } from "./types";

const PROFILE_KEY = "memorcalc-profile-v1";
const EVENTS_KEY = "memorcalc-events-v1";
const INSTALL_KEY = "memorcalc-install-id";

export function installId(): string {
  try {
    let id = localStorage.getItem(INSTALL_KEY);
    if (!id) {
      id = `memorcalc:${crypto.randomUUID()}`;
      localStorage.setItem(INSTALL_KEY, id);
    }
    return id;
  } catch {
    return "memorcalc:anon";
  }
}

export function readLocalProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return { ...emptyProfile(), ...(JSON.parse(raw) as UserProfile) };
  } catch {
    return null;
  }
}

export function writeLocalProfile(p: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function readLocalEvents(): UsageEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UsageEvent[];
    return Array.isArray(parsed) ? parsed.slice(-400) : [];
  } catch {
    return [];
  }
}

export function pushLocalEvent(ev: UsageEvent) {
  const next = [...readLocalEvents(), { ...ev, at: ev.at || new Date().toISOString() }].slice(-400);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(next));
}

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return asStringList(parsed);
    } catch {
      /* lista separada por comas */
    }
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function throwIfError(error: { message?: string } | null, action: string) {
  if (!error) return;
  throw new Error(error.message || `No se pudo ${action}.`);
}

/** Une ficha local y nube campo a campo. Un stub de identidad no borra el oficio ya llenado. */
export function mergeUserProfile(
  userId: string,
  local: UserProfile | null,
  cloud: UserProfile | null,
  extras: Partial<UserProfile> = {},
): UserProfile {
  const localOk = local && local.user_id === userId ? local : null;
  const pick = <K extends keyof UserProfile>(key: K, fallback: UserProfile[K]): UserProfile[K] => {
    if (cloud && isFilled(cloud[key])) return cloud[key] as UserProfile[K];
    if (localOk && isFilled(localOk[key])) return localOk[key] as UserProfile[K];
    if (isFilled(extras[key])) return extras[key] as UserProfile[K];
    return fallback;
  };
  const next: UserProfile = {
    ...emptyProfile(),
    user_id: userId,
    email: pick("email", ""),
    full_name: pick("full_name", ""),
    avatar_url: pick("avatar_url", ""),
    google_sub: pick("google_sub", ""),
    craft_family: pick("craft_family", ""),
    profession_id: pick("profession_id", ""),
    profession_label: pick("profession_label", ""),
    professional_title: pick("professional_title", ""),
    cip: pick("cip", ""),
    colegiatura: pick("colegiatura", ""),
    organization: pick("organization", ""),
    workplace_role: pick("workplace_role", ""),
    practice_mode: pick("practice_mode", ""),
    specialty_focus: pick("specialty_focus", []),
    country: pick("country", "Perú"),
    country_code: pick("country_code", "PE"),
    department: pick("department", ""),
    province: pick("province", ""),
    district: pick("district", ""),
    city: pick("city", ""),
    ubigeo: pick("ubigeo", ""),
    age: pick("age", null),
    birth_year: pick("birth_year", null),
    phone: pick("phone", ""),
    sex: pick("sex", ""),
    experience_years: pick("experience_years", null),
    university: pick("university", ""),
    onboarding_done: false,
    app: "memorcalc",
    last_module: pick("last_module", ""),
    public_user_code: pick("public_user_code", ""),
    inferred_role: pick("inferred_role", ""),
    inferred_rubros: pick("inferred_rubros", []),
    inferred_confidence: pick("inferred_confidence", 0),
    ad_segment: pick("ad_segment", ""),
  };
  next.onboarding_done = Boolean(localOk?.onboarding_done || cloud?.onboarding_done || profileComplete({ ...next, onboarding_done: true }));
  return next;
}

export async function fetchCloudProfile(userId: string): Promise<UserProfile | null> {
  const [mcRes, master] = await Promise.all([
    folio.from("memorcalc_profiles").select("*").eq("user_id", userId).maybeSingle(),
    fetchMasterIdentity(userId).catch(() => null),
  ]);
  const row = !mcRes.error && mcRes.data ? (mcRes.data as Record<string, unknown>) : null;
  if (!row && !master) return null;
  const fromMc: Partial<UserProfile> = row
    ? {
        user_id: String(row.user_id || userId),
        email: String(row.email || ""),
        full_name: String(row.full_name || ""),
        avatar_url: String(row.avatar_url || ""),
        google_sub: String(row.google_sub || ""),
        craft_family: (row.craft_family as CraftFamily) || "",
        profession_id: String(row.profession_id || ""),
        profession_label: String(row.profession_label || ""),
        professional_title: String(row.professional_title || ""),
        cip: String(row.cip || ""),
        colegiatura: String(row.colegiatura || ""),
        organization: String(row.organization || ""),
        workplace_role: (row.workplace_role as UserProfile["workplace_role"]) || "",
        practice_mode: (row.practice_mode as UserProfile["practice_mode"]) || "",
        specialty_focus: asStringList(row.specialty_focus),
        country: String(row.country || "Perú"),
        country_code: String(row.country_code || "PE"),
        department: String(row.department || ""),
        province: String(row.province || ""),
        district: String(row.district || ""),
        city: String(row.city || ""),
        ubigeo: String(row.ubigeo || ""),
        age: typeof row.age === "number" ? row.age : row.age ? Number(row.age) : null,
        birth_year: typeof row.birth_year === "number" ? row.birth_year : null,
        phone: String(row.phone || ""),
        sex: String(row.sex || ""),
        experience_years: typeof row.experience_years === "number" ? row.experience_years : null,
        university: String(row.university || ""),
        onboarding_done: Boolean(row.onboarding_done),
        app: "memorcalc",
        last_module: String(row.last_module || ""),
        inferred_role: String(row.inferred_role || ""),
        inferred_rubros: asStringList(row.inferred_rubros),
        inferred_confidence: Number(row.inferred_confidence || 0),
        ad_segment: String(row.ad_segment || ""),
      }
    : {};
  return {
    ...emptyProfile(),
    ...fromMc,
    user_id: userId,
    public_user_code: master?.public_user_code || "",
    full_name: master?.full_name || fromMc.full_name || "",
    avatar_url: master?.avatar_url || fromMc.avatar_url || "",
    phone: master?.phone || fromMc.phone || "",
    sex: master?.sex || fromMc.sex || "",
    professional_title: master?.professional_title || fromMc.professional_title || "",
    experience_years: master?.experience_years ?? fromMc.experience_years ?? null,
    birth_year: master?.birth_year ?? fromMc.birth_year ?? null,
    onboarding_done: Boolean(fromMc.onboarding_done),
  };
}

function rowFromProfile(p: UserProfile, insight: UserInsight) {
  return {
    user_id: p.user_id,
    email: p.email,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    google_sub: p.google_sub,
    craft_family: p.craft_family,
    profession_id: p.profession_id,
    profession_label: p.profession_label,
    professional_title: p.professional_title,
    cip: p.cip,
    colegiatura: p.colegiatura,
    organization: p.organization,
    workplace_role: p.workplace_role,
    practice_mode: p.practice_mode,
    specialty_focus: p.specialty_focus,
    country: p.country,
    country_code: p.country_code,
    department: p.department,
    province: p.province,
    district: p.district,
    city: p.city || p.district,
    ubigeo: p.ubigeo,
    age: p.age,
    birth_year: p.birth_year,
    phone: p.phone,
    sex: p.sex,
    experience_years: p.experience_years,
    university: p.university,
    onboarding_done: profileComplete(p),
    app: "memorcalc",
    last_module: p.last_module,
    inferred_role: insight.role_guess,
    inferred_rubros: Object.entries(insight.rubros)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k),
    inferred_confidence: insight.confidence,
    ad_segment: adSegmentOf({ ...p, inferred_rubros: Object.keys(insight.rubros) }),
    updated_at: new Date().toISOString(),
  };
}

export async function saveCloudProfile(p: UserProfile, events: UsageEvent[]): Promise<UserInsight> {
  const insight = analyzeUsage(events, p);
  const saved: UserProfile = {
    ...p,
    onboarding_done: true,
    inferred_role: insight.role_guess,
    inferred_rubros: insight.top_modules,
    inferred_confidence: insight.confidence,
  };
  writeLocalProfile(saved);
  const row = rowFromProfile(saved, insight);
  const profileRes = await folio.from("memorcalc_profiles").upsert(row, { onConflict: "user_id" });
  throwIfError(profileRes.error, "guardar la ficha profesional");
  await saveMasterIdentity({
    user_id: p.user_id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    phone: p.phone,
    sex: p.sex,
    professional_title: p.professional_title,
    experience_years: p.experience_years,
    birth_year: p.birth_year,
    onboarding_done: true,
  }).catch(() => undefined);
  const insightRes = await folio.from("memorcalc_insights").upsert(
    {
      user_id: p.user_id,
      role_guess: insight.role_guess,
      role_scores: insight.role_scores,
      rubros: insight.rubros,
      top_modules: insight.top_modules,
      contractor_score: insight.contractor_score,
      designer_score: insight.designer_score,
      summary: insight.summary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  throwIfError(insightRes.error, "guardar el resumen de uso");
  try {
    await folio.rpc("sync_memorcalc_identity", { p_profile: row });
  } catch {
    /* Folio aún sin la RPC */
  }
  void ingestOnboarding(saved).catch(() => undefined);
  return insight;
}

export async function flushEvents(userId: string, events: UsageEvent[]) {
  if (!userId || events.length === 0) return;
  const pending = events.slice(-80).map((ev) => ({
    user_id: userId,
    session_id: installId(),
    event_type: ev.event_type,
    module_slug: ev.module_slug,
    specialty: ev.specialty,
    meta: ev.meta ?? {},
    created_at: ev.at || new Date().toISOString(),
  }));
  try {
    await folio.from("memorcalc_events").insert(pending);
  } catch {
    /* nube opcional */
  }
}

export function currentInsight(profile: UserProfile | null, extra: UsageEvent[] = []): UserInsight {
  return analyzeUsage([...readLocalEvents(), ...extra], profile ?? emptyProfile());
}

const QUOTA_KEY = "memorcalc-quota-uses-v1";

export function readLocalQuotaUses(): Record<string, number> {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalQuotaUses(map: Record<string, number>) {
  localStorage.setItem(QUOTA_KEY, JSON.stringify(map));
}

export async function fetchCloudQuotaUses(userId: string): Promise<Record<string, number>> {
  const { data, error } = await folio.from("memorcalc_quota_uses").select("engine_id, used").eq("user_id", userId);
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, number> = {};
  for (const row of data as { engine_id?: string; used?: number }[]) {
    if (row.engine_id) out[row.engine_id] = Number(row.used || 0);
  }
  return out;
}

export async function saveCloudQuotaUse(userId: string, engineId: string, used: number) {
  await folio.from("memorcalc_quota_uses").upsert(
    { user_id: userId, engine_id: engineId, used, updated_at: new Date().toISOString() },
    { onConflict: "user_id,engine_id" },
  );
}
