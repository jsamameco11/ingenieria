/** Catálogo de sitios del ecosistema. Misma lista que Folio Control. */
export const ECOSYSTEM = [
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

const CODE_TO_ID = Object.fromEntries(ECOSYSTEM.filter((s) => s.code).map((s) => [s.code, s.id]));

export function emptyBreakdown() {
  const buckets = {};
  for (const site of ECOSYSTEM) {
    buckets[site.id] = {
      id: site.id,
      code: site.code,
      label: site.label,
      short: site.short,
      pill: site.pill,
      count: 0,
      hosts: [],
      lastSeen: "",
      present: false,
      source: "",
    };
  }
  return buckets;
}

export function markSite(buckets, id, extra = {}) {
  if (!id) return;
  if (!buckets[id]) {
    const site = ECOSYSTEM.find((s) => s.id === id);
    buckets[id] = {
      id,
      code: extra.code || site?.code || "",
      label: extra.label || site?.label || id,
      short: extra.short || site?.short || id,
      pill: extra.pill || site?.pill || "folio",
      count: 0,
      hosts: [],
      lastSeen: "",
      present: false,
      source: "",
    };
  }
  const bucket = buckets[id];
  bucket.present = true;
  if (extra.count != null) bucket.count += Number(extra.count) || 0;
  else bucket.count += 1;
  const host = String(extra.host || "").trim();
  if (host && !bucket.hosts.includes(host)) bucket.hosts.push(host);
  const seen = extra.lastSeen || "";
  if (seen && (!bucket.lastSeen || String(seen) > String(bucket.lastSeen))) {
    bucket.lastSeen = seen;
  }
  if (extra.source && !bucket.source) bucket.source = extra.source;
}

export function idFromPlatformCode(code) {
  const key = String(code || "").trim().toUpperCase();
  if (CODE_TO_ID[key]) return CODE_TO_ID[key];
  return "";
}

export function idFromApp(app, os) {
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

export function sitePresenceFromBreakdown(breakdown) {
  const known = new Set(ECOSYSTEM.map((s) => s.id));
  const extras = Object.keys(breakdown || {}).filter((id) => !known.has(id) && breakdown[id]?.present);
  const sites = [
    ...ECOSYSTEM,
    ...extras.map((id) => ({
      id,
      code: breakdown[id]?.code || "",
      label: breakdown[id]?.label || id,
      short: breakdown[id]?.short || id,
      pill: breakdown[id]?.pill || "folio",
    })),
  ];
  return sites.map((site) => {
    const row = breakdown[site.id] || {};
    return {
      id: site.id,
      code: site.code,
      label: site.label,
      short: site.short,
      pill: site.pill,
      present: Boolean(row.present),
      lastSeen: row.lastSeen || "",
      count: row.count || 0,
      hosts: row.hosts || [],
      source: row.source || "",
    };
  });
}

export function nestedPlatformCode(row) {
  const plat = row?.platforms || row?.platform || null;
  const obj = Array.isArray(plat) ? plat[0] : plat;
  return String(obj?.platform_code || row?.platform_code || "").toUpperCase();
}
