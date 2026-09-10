import { folio } from "../folio";

export const MASTER_PLATFORM = "INGENIERIA";
const APP_VERSION = "web-1.0";
const INSTALL_KEY = "memorcalc-install-id";

export type MasterIdentity = {
  public_user_code: string;
  full_name: string;
  avatar_url: string;
  phone: string;
  sex: string;
  professional_title: string;
  experience_years: number | null;
  onboarding_done: boolean;
  birth_year: number | null;
  account_status: string;
};

function installationUuid(): string {
  try {
    const raw = localStorage.getItem(INSTALL_KEY) || "";
    const found = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (found) return found[0].toLowerCase();
    const next = crypto.randomUUID();
    localStorage.setItem(INSTALL_KEY, `memorcalc:${next}`);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function splitName(full: string) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

/** Tras Google: el USER_ID universal queda anclado a Ingeniería. No crea otra cuenta. */
export async function anchorIngenieriaPlatform(): Promise<void> {
  const { error } = await folio.rpc("touch_platform", {
    p_platform_code: MASTER_PLATFORM,
    p_installation_uuid: installationUuid(),
    p_app_version: APP_VERSION,
    p_acquisition_source: "ingenieria.web",
  });
  if (error && !/schema cache|does not exist|42P01|PGRST/i.test(error.message)) {
    console.warn("touch_platform", error.message);
  }
}

export async function fetchMasterIdentity(userId: string): Promise<MasterIdentity | null> {
  if (!userId) return null;
  const [{ data: u }, { data: p }, { data: pp }] = await Promise.all([
    folio.from("users").select("id,public_user_code,onboarding_completed,account_status,is_active").eq("id", userId).maybeSingle(),
    folio.from("user_profiles").select("display_name,first_name,last_name,profile_photo_url,phone,birth_date,gender").eq("user_id", userId).maybeSingle(),
    folio.from("user_professional_profiles").select("professional_headline,years_of_experience").eq("user_id", userId).maybeSingle(),
  ]);
  if (!u && !p) return null;
  const first = String(p?.first_name || "").trim();
  const last = String(p?.last_name || "").trim();
  const composed = [first, last].filter(Boolean).join(" ");
  const birth = String(p?.birth_date || "");
  return {
    public_user_code: String(u?.public_user_code || ""),
    full_name: String(p?.display_name || composed || ""),
    avatar_url: String(p?.profile_photo_url || ""),
    phone: String(p?.phone || ""),
    sex: String(p?.gender || ""),
    professional_title: String(pp?.professional_headline || ""),
    experience_years:
      pp?.years_of_experience == null || pp.years_of_experience === ""
        ? null
        : Number(pp.years_of_experience),
    onboarding_done: Boolean(u?.onboarding_completed),
    birth_year: birth ? Number(birth.slice(0, 4)) || null : null,
    account_status: String(u?.account_status || "active"),
  };
}

export async function saveMasterIdentity(input: {
  user_id: string;
  full_name: string;
  avatar_url: string;
  phone: string;
  sex: string;
  professional_title: string;
  experience_years: number | null;
  birth_year: number | null;
  onboarding_done: boolean;
}): Promise<void> {
  const uid = input.user_id;
  if (!uid) return;
  const { first, last } = splitName(input.full_name);
  const birth =
    input.birth_year && input.birth_year >= 1930 && input.birth_year <= new Date().getFullYear() - 10
      ? `${input.birth_year}-01-01`
      : null;
  await folio.from("user_profiles").upsert(
    {
      user_id: uid,
      display_name: input.full_name || first || null,
      first_name: first || null,
      last_name: last || null,
      profile_photo_url: input.avatar_url || null,
      phone: input.phone || null,
      gender: input.sex || null,
      birth_date: birth,
    },
    { onConflict: "user_id" },
  );
  await folio.from("user_professional_profiles").upsert(
    {
      user_id: uid,
      professional_headline: input.professional_title || null,
      years_of_experience: input.experience_years,
    },
    { onConflict: "user_id" },
  );
  await folio
    .from("users")
    .update({
      onboarding_completed: input.onboarding_done,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", uid);
}
