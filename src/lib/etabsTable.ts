/** Tabla de fuerzas ETABS: Column / Pier Forces (P, V2, V3, T, M2, M3). */

export type EtabsForceRow = {
  story: string;
  label: string;
  load: string;
  station: string;
  p: number;
  v2: number;
  v3: number;
  t: number;
  m2: number;
  m3: number;
};

export const ETABS_FORCE_CASES = ["CM", "CV", "CSX", "CSY"] as const;
export type EtabsForceCase = (typeof ETABS_FORCE_CASES)[number];

export const ETABS_FORCE_HEADERS = [
  { key: "label", title: "Pier / Columna", hint: "Pier Label o Unique Name de la columna" },
  { key: "load", title: "Caso", hint: "Dead/CM, Live/CV, CSX, CSY" },
  { key: "p", title: "P", unit: "t" },
  { key: "v2", title: "V2", unit: "t" },
  { key: "v3", title: "V3", unit: "t" },
  { key: "t", title: "T", unit: "t·m" },
  { key: "m2", title: "M2", unit: "t·m" },
  { key: "m3", title: "M3", unit: "t·m" },
] as const;

const LOAD_ALIAS: Record<string, EtabsForceCase> = {
  dead: "CM",
  cm: "CM",
  "dead load": "CM",
  dl: "CM",
  d: "CM",
  muerto: "CM",
  live: "CV",
  cv: "CV",
  "live load": "CV",
  ll: "CV",
  l: "CV",
  vivo: "CV",
  csx: "CSX",
  sdx: "CSX",
  sx: "CSX",
  ex: "CSX",
  eqx: "CSX",
  "sismo x": "CSX",
  "espectro x": "CSX",
  csy: "CSY",
  sdy: "CSY",
  sy: "CSY",
  ey: "CSY",
  eqy: "CSY",
  "sismo y": "CSY",
  "espectro y": "CSY",
};

export function emptyEtabsRows(label = "C1"): EtabsForceRow[] {
  return ETABS_FORCE_CASES.map((load) => ({
    story: "",
    label,
    load,
    station: "Bottom",
    p: 0,
    v2: 0,
    v3: 0,
    t: 0,
    m2: 0,
    m3: 0,
  }));
}

export function normalizeEtabsLoad(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!k) return "";
  return LOAD_ALIAS[k] || raw.trim();
}

function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  return line
    .split(/ {2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function toNum(raw: string | undefined): number {
  if (raw == null || raw === "") return NaN;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function normHead(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function findHead(heads: string[], ...needles: string[]): number {
  const exact = heads.findIndex((h) => needles.includes(h));
  if (exact >= 0) return exact;
  return heads.findIndex((h) => needles.some((n) => n.length >= 3 && (h.startsWith(n) || n.startsWith(h))));
}

function isHeaderRow(cells: string[]): boolean {
  const heads = cells.map(normHead);
  const hasP = heads.some((h) => h === "p" || h === "pton" || h === "axial");
  const hasM = heads.some((h) => h === "m2" || h === "m3" || h === "v2");
  const hasLabel = heads.some((h) =>
    ["pier", "column", "columna", "label", "uniquename", "unique", "story"].includes(h),
  );
  return hasP && (hasM || hasLabel);
}

function rowHasForce(r: EtabsForceRow): boolean {
  return [r.p, r.v2, r.v3, r.t, r.m2, r.m3].some((n) => Math.abs(n) > 1e-9);
}

export function parseEtabsForceTable(raw: string): EtabsForceRow[] {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = splitCells(lines[0]);
  const headed = isHeaderRow(first);
  const heads = headed ? first.map(normHead) : [];
  const idxStory = findHead(heads, "story", "piso", "nivel");
  const idxLabel = findHead(heads, "pier", "column", "columna", "uniquename", "unique", "label", "name", "nombre");
  const idxLoad = findHead(heads, "loadcasecombo", "outputcase", "loadcase", "combo", "caso", "case", "load");
  const idxStat = findHead(heads, "station", "location", "loc", "estacion");
  const idxP = findHead(heads, "pton", "p", "axial");
  const idxV2 = findHead(heads, "v2");
  const idxV3 = findHead(heads, "v3");
  const idxT = findHead(heads, "t", "torsion");
  const idxM2 = findHead(heads, "m2");
  const idxM3 = findHead(heads, "m3");

  const src = headed ? lines.slice(1) : lines;
  const out: EtabsForceRow[] = [];

  for (const line of src) {
    const cols = splitCells(line);
    if (!cols.length) continue;
    const nums = cols.map(toNum);
    let row: EtabsForceRow | null = null;

    if (headed && idxP >= 0) {
      row = {
        story: idxStory >= 0 ? cols[idxStory] ?? "" : "",
        label: idxLabel >= 0 ? cols[idxLabel] ?? "" : "",
        load: normalizeEtabsLoad(idxLoad >= 0 ? cols[idxLoad] ?? "" : ""),
        station: idxStat >= 0 ? cols[idxStat] ?? "" : "",
        p: toNum(cols[idxP]),
        v2: idxV2 >= 0 ? toNum(cols[idxV2]) : 0,
        v3: idxV3 >= 0 ? toNum(cols[idxV3]) : 0,
        t: idxT >= 0 ? toNum(cols[idxT]) : 0,
        m2: idxM2 >= 0 ? toNum(cols[idxM2]) : NaN,
        m3: idxM3 >= 0 ? toNum(cols[idxM3]) : NaN,
      };
      if (!Number.isFinite(row.m2) || !Number.isFinite(row.m3)) {
        const tail = nums.filter(Number.isFinite);
        if (tail.length >= 3) {
          row.m2 = tail[tail.length - 2];
          row.m3 = tail[tail.length - 1];
        }
      }
    } else {
      const named: string[] = [];
      const values: number[] = [];
      for (let i = 0; i < cols.length; i++) {
        if (Number.isFinite(nums[i])) values.push(nums[i]);
        else if (cols[i]) named.push(cols[i]);
      }
      if (values.length < 3) continue;
      const six = values.length >= 6 ? values.slice(-6) : [values[values.length - 3], 0, 0, 0, values[values.length - 2], values[values.length - 1]];
      row = {
        story: "",
        label: named[0] ?? "",
        load: normalizeEtabsLoad(named[1] ?? named[0] ?? ""),
        station: named[2] ?? "",
        p: six[0],
        v2: six[1],
        v3: six[2],
        t: six[3],
        m2: six[4],
        m3: six[5],
      };
    }

    if (!row || !Number.isFinite(row.p) || !Number.isFinite(row.m2) || !Number.isFinite(row.m3)) continue;
    row.v2 = Number.isFinite(row.v2) ? row.v2 : 0;
    row.v3 = Number.isFinite(row.v3) ? row.v3 : 0;
    row.t = Number.isFinite(row.t) ? row.t : 0;
    if (!row.label && !row.load) row.label = `ETABS ${out.length + 1}`;
    out.push(row);
  }
  return out;
}

export function serializeEtabsForceTable(rows: EtabsForceRow[]): string {
  const head = "Pier/Columna\tCaso\tP\tV2\tV3\tT\tM2\tM3";
  const body = rows.map((r) =>
    [r.label, r.load, r.p, r.v2, r.v3, r.t, r.m2, r.m3].join("\t"),
  );
  return [head, ...body].join("\n");
}

export function displayEtabsRows(raw: string, fallbackLabel = "C1"): EtabsForceRow[] {
  const parsed = parseEtabsForceTable(raw);
  return parsed.length ? parsed : emptyEtabsRows(fallbackLabel);
}

export function rowsWithForces(rows: EtabsForceRow[]): EtabsForceRow[] {
  return rows.filter(rowHasForce);
}

export const PLACA_ETABS_KEYS: Record<EtabsForceCase, Record<"p" | "v2" | "v3" | "t" | "m2" | "m3", string>> = {
  CM: { p: "Pcm", v2: "V2cm", v3: "V3cm", t: "Tcm", m2: "M2cm", m3: "M3cm" },
  CV: { p: "Pcv", v2: "V2cv", v3: "V3cv", t: "Tcv", m2: "M2cv", m3: "M3cv" },
  CSX: { p: "Pdx", v2: "V2dx", v3: "V3dx", t: "Tdx", m2: "M2dx", m3: "M3dx" },
  CSY: { p: "Pdy", v2: "V2dy", v3: "V3dy", t: "Tdy", m2: "M2dy", m3: "M3dy" },
};

export function placaRowsFromValues(values: Record<string, string>): EtabsForceRow[] {
  return ETABS_FORCE_CASES.map((load) => {
    const k = PLACA_ETABS_KEYS[load];
    const n = (key: string) => Number(String(values[key] ?? "0").replace(",", ".")) || 0;
    return {
      story: "",
      label: values.etabsLabel || "P1",
      load,
      station: "Bottom",
      p: n(k.p),
      v2: n(k.v2),
      v3: n(k.v3),
      t: n(k.t),
      m2: n(k.m2),
      m3: n(k.m3),
    };
  });
}

export function applyPlacaRows(values: Record<string, string>, rows: EtabsForceRow[]): Record<string, string> {
  const next = { ...values };
  const label = rows.find((r) => r.label)?.label;
  if (label) next.etabsLabel = label;
  for (const row of rows) {
    const load = normalizeEtabsLoad(row.load) as EtabsForceCase;
    if (!ETABS_FORCE_CASES.includes(load)) continue;
    const k = PLACA_ETABS_KEYS[load];
    next[k.p] = String(row.p);
    next[k.v2] = String(row.v2);
    next[k.v3] = String(row.v3);
    next[k.t] = String(row.t);
    next[k.m2] = String(row.m2);
    next[k.m3] = String(row.m3);
  }
  return next;
}
