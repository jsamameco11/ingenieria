export type WorkplaceRole =
  | "proyectista"
  | "contratista"
  | "residente"
  | "supervisor"
  | "tasador"
  | "funcionario"
  | "docente"
  | "estudiante"
  | "proveedor"
  | "gerente"
  | "otro";

export type PracticeMode = "independiente" | "empresa" | "estado" | "academia" | "ong" | "";

export type CraftFamily = "ingeniero" | "arquitecto" | "interiores" | "otro" | "";

export type UserProfile = {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  google_sub: string;
  craft_family: CraftFamily;
  profession_id: string;
  profession_label: string;
  professional_title: string;
  cip: string;
  colegiatura: string;
  organization: string;
  workplace_role: WorkplaceRole | "";
  practice_mode: PracticeMode;
  specialty_focus: string[];
  country: string;
  country_code: string;
  department: string;
  province: string;
  district: string;
  city: string;
  ubigeo: string;
  age: number | null;
  birth_year: number | null;
  phone: string;
  sex: string;
  experience_years: number | null;
  university: string;
  onboarding_done: boolean;
  app: string;
  last_module: string;
  public_user_code: string;
  inferred_role: string;
  inferred_rubros: string[];
  inferred_confidence: number;
  ad_segment: string;
};

export type UsageEvent = {
  event_type:
    | "view_module"
    | "edit_field"
    | "export"
    | "print"
    | "save"
    | "dwell"
    | "click"
    | "heartbeat"
    | "quota_use"
    | "session_start";
  module_slug: string;
  specialty: string;
  meta?: Record<string, unknown>;
  at?: string;
};

export type UserInsight = {
  role_guess: string;
  role_scores: Record<string, number>;
  rubros: Record<string, number>;
  top_modules: string[];
  contractor_score: number;
  designer_score: number;
  confidence: number;
  summary: string;
};

export const emptyProfile = (): UserProfile => ({
  user_id: "",
  email: "",
  full_name: "",
  avatar_url: "",
  google_sub: "",
  craft_family: "",
  profession_id: "",
  profession_label: "",
  professional_title: "",
  cip: "",
  colegiatura: "",
  organization: "",
  workplace_role: "",
  practice_mode: "",
  specialty_focus: [],
  country: "Perú",
  country_code: "PE",
  department: "",
  province: "",
  district: "",
  city: "",
  ubigeo: "",
  age: null,
  birth_year: null,
  phone: "",
  sex: "",
  experience_years: null,
  university: "",
  onboarding_done: false,
  app: "memorcalc",
  last_module: "",
  public_user_code: "",
  inferred_role: "",
  inferred_rubros: [],
  inferred_confidence: 0,
  ad_segment: "",
});

export function profileComplete(p: UserProfile | null): boolean {
  if (!p) return false;
  return Boolean(
    p.onboarding_done &&
      p.craft_family &&
      p.profession_id &&
      p.workplace_role &&
      p.practice_mode &&
      p.country &&
      p.age &&
      p.age >= 16 &&
      p.age <= 99 &&
      p.specialty_focus.length > 0 &&
      (p.country_code !== "PE" || (p.department && p.province && p.district)),
  );
}

export function ageBandOf(age: number | null | undefined): string {
  if (!age) return "";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

export function adSegmentOf(p: UserProfile): string {
  const family =
    p.craft_family === "ingeniero"
      ? "ingenieria"
      : p.craft_family === "arquitecto"
        ? "arquitectura"
        : p.craft_family === "interiores"
          ? "interiores"
          : "otro";
  const role = p.workplace_role || "sin-rol";
  const band = ageBandOf(p.age) || "sin-edad";
  const rubro = p.specialty_focus[0] || p.inferred_rubros[0] || "general";
  return `${family}.${role}.${rubro}.${band}`;
}
