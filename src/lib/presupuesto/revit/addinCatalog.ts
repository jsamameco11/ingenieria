export const REVIT_YEARS = [2023, 2024, 2025, 2026] as const;
export type RevitYear = (typeof REVIT_YEARS)[number];

export type AddinRelease = {
  version: string;
  publishedAt: string | null;
  notes: string;
  sizeLabel: string;
  sha256: string;
  available: boolean;
  setupUrl: string;
  urls: Partial<Record<RevitYear, string>>;
};

export const ADDIN_RELEASE: AddinRelease = {
  version: "2.0.0",
  publishedAt: "2026-09-06",
  notes: "Add-in de Revit con panel acoplable. Conecta, analiza el modelo y sincroniza metrados en vivo.",
  sizeLabel: "instalador",
  sha256: "",
  available: true,
  setupUrl: "/addin/MemoriaCalc.Revit.Setup.exe",
  urls: {
    2023: "/addin/MemoriaCalc.Revit.Setup.exe",
    2024: "/addin/MemoriaCalc.Revit.Setup.exe",
    2025: "/addin/MemoriaCalc.Revit.Setup.exe",
    2026: "/addin/MemoriaCalc.Revit.Setup.exe",
  },
};

function asRelease(raw: Partial<AddinRelease> | null | undefined): AddinRelease | null {
  if (!raw || typeof raw !== "object") return null;
  const setup = raw.setupUrl || raw.urls?.[2025] || raw.urls?.[2024];
  if (!raw.version && !setup) return null;
  return {
    ...ADDIN_RELEASE,
    ...raw,
    setupUrl: setup || ADDIN_RELEASE.setupUrl,
    urls: raw.urls ?? ADDIN_RELEASE.urls,
    available: raw.available !== false,
  };
}

export async function fetchAddinRelease(): Promise<AddinRelease> {
  try {
    const local = await fetch("/addin/release.json", { headers: { Accept: "application/json" } });
    if (local.ok) {
      const text = await local.text();
      if (!text.includes("<!doctype") && !text.includes("<html")) {
        const parsed = asRelease(JSON.parse(text) as Partial<AddinRelease>);
        if (parsed) return parsed;
      }
    }
  } catch {
    /* manifiesto estático ausente */
  }
  try {
    const res = await fetch("/api/revit/addin/releases", { headers: { Accept: "application/json" } });
    if (!res.ok) return ADDIN_RELEASE;
    const text = await res.text();
    if (text.includes("<!doctype") || text.includes("<html")) return ADDIN_RELEASE;
    return asRelease(JSON.parse(text) as Partial<AddinRelease>) ?? ADDIN_RELEASE;
  } catch {
    return ADDIN_RELEASE;
  }
}

export function downloadHref(rel: AddinRelease, year: RevitYear) {
  if (rel.urls[year]) return rel.urls[year] as string;
  if (rel.setupUrl) return rel.setupUrl;
  return "/addin/MemoriaCalc.Revit.Setup.exe";
}
