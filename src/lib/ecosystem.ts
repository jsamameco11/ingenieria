/** Catálogo compartido con Folio Control: mismas páginas, misma base de sesiones. */
export type EcosystemSite = {
  id: string;
  code: string;
  label: string;
  short: string;
  pill: string;
  kind: "app" | "web";
};

export const ECOSYSTEM: EcosystemSite[] = [
  { id: "folio", code: "FOLIO_PDF", label: "Folio PDF", short: "Folio", pill: "folio", kind: "app" },
  { id: "android", code: "FOLIO_ANDROID", label: "Folio Android", short: "Android", pill: "and", kind: "app" },
  { id: "ingenieria", code: "INGENIERIA", label: "Ingeniería", short: "Ingeniería", pill: "ing", kind: "web" },
  { id: "contrataciones", code: "CONTRATACIONES", label: "Contrataciones", short: "Contrataciones", pill: "contrat", kind: "web" },
  { id: "odontomedic", code: "ODONTOMEDIC", label: "Odontomedic", short: "Odontomedic", pill: "odonto", kind: "web" },
  { id: "casa", code: "CASA_PALABRA", label: "Casa de la Palabra", short: "Casa Palabra", pill: "casa", kind: "web" },
  { id: "linkedin", code: "LINKEDIN_JOB", label: "LinkedIn Job", short: "LinkedIn", pill: "in", kind: "web" },
  { id: "cv", code: "CV", label: "Generador de CV", short: "CV", pill: "cv", kind: "web" },
  { id: "mia", code: "MIA", label: "MiAcademiaPreU", short: "MiAcademia", pill: "mia", kind: "web" },
  { id: "driveme", code: "DRIVE_ME", label: "Drive Me", short: "Drive Me", pill: "drive", kind: "web" },
  { id: "mercago", code: "MERCAGO", label: "MercaGo", short: "MercaGo", pill: "merca", kind: "web" },
];

const CODE_TO_ID = Object.fromEntries(ECOSYSTEM.map((s) => [s.code, s.id]));

export function siteById(id: string) {
  return ECOSYSTEM.find((s) => s.id === id);
}

export function idFromPlatformCode(code: string) {
  const key = String(code || "").trim().toUpperCase();
  return CODE_TO_ID[key] || "";
}

export function idFromApp(app?: string, os?: string) {
  const value = String(app || "").trim().toLowerCase();
  const o = String(os || "").toLowerCase();
  if (!value && o.includes("android")) return "android";
  if (!value) return "";
  if (value === "folio-android" || value.includes("android")) return "android";
  if (value === "memorcalc" || value.includes("ingenier") || value === "memoriacalc") return "ingenieria";
  if (value.includes("contrat")) return "contrataciones";
  if (value.includes("odonto")) return "odontomedic";
  if (value.includes("casa") || value.includes("palabra") || value.includes("biblia")) return "casa";
  if (value.includes("linkedin")) return "linkedin";
  if (value === "cv" || value.includes("curricul")) return "cv";
  if (value.includes("mia") || value.includes("academia")) return "mia";
  if (value.includes("drive")) return "driveme";
  if (value.includes("merca")) return "mercago";
  if (value.includes("folio") || value === "folio-pdf" || value === "desktop") return "folio";
  return "";
}

export function siteLabel(id: string, app?: string) {
  const fromApp = idFromApp(app);
  const site = siteById(id || fromApp);
  if (site) return site.label;
  if (app) return app;
  return id || "Sin app";
}
