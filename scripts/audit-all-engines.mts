import { MODULES, SPECIALTIES } from "../src/lib/catalog.ts";
import { ENGINES, runEngine } from "../src/lib/engines/index.ts";
import { exampleModel } from "../src/lib/engines/maestria/types.ts";
import { dumpBoth } from "../src/lib/engines/maestria/drawCommon.ts";
import { readFileSync } from "node:fs";

const DIAGRAM_SRC = readFileSync(new URL("../src/components/Diagram.tsx", import.meta.url), "utf8");
const diagramCases = new Set(
  [...DIAGRAM_SRC.matchAll(/case\s+"([^"]+)"/g)].map((m) => m[1]),
);

const CUSTOM_PAGES = new Set(["acb-caminos", "edificio-3d", "tasacion-inmueble", "tasacion-terreno"]);

function seed(mod: (typeof MODULES)[number]): Record<string, string> {
  const base = { ...mod.defaults };
  if (mod.slug === "losa-2dir") return { ...base, ...dumpBoth(exampleModel("losa")), tipoLosa: base.tipoLosa || "maciza", h: base.h || "15" };
  if (mod.slug === "platea") return { ...base, ...dumpBoth(exampleModel("platea")) };
  if (mod.slug === "zapata-corrida" && base.tipo !== "muro") return { ...base, ...dumpBoth(exampleModel("zapata")) };
  return base;
}

function scanNaN(x: unknown, path = ""): string[] {
  const hits: string[] = [];
  if (typeof x === "number") {
    if (!Number.isFinite(x)) hits.push(path || "number");
    return hits;
  }
  if (typeof x === "string") {
    if (/\bNaN\b/.test(x) || /\bInfinity\b/.test(x)) hits.push(path || "string");
    return hits;
  }
  if (!x || typeof x !== "object") return hits;
  if (Array.isArray(x)) {
    x.forEach((v, i) => hits.push(...scanNaN(v, `${path}[${i}]`)));
    return hits;
  }
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) hits.push(...scanNaN(v, path ? `${path}.${k}` : k));
  return hits;
}

type Row = {
  slug: string;
  title: string;
  specialty: string;
  engine: string;
  diagram: string;
  engineOk: boolean;
  diagramOk: boolean;
  custom: boolean;
  steps: number;
  checks: number;
  fail: number;
  extras: number;
  dims: number;
  nan: number;
  error?: string;
  headline: string;
};

const rows: Row[] = [];
const missingEngines: string[] = [];
const missingDiagrams: string[] = [];
const throws: { slug: string; error: string }[] = [];
const emptyMem: string[] = [];
const nanHits: { slug: string; n: number }[] = [];
const allFail: string[] = [];

for (const mod of MODULES) {
  const custom = CUSTOM_PAGES.has(mod.slug);
  const hasEng = Boolean(ENGINES[mod.engine]);
  const diagramOk = diagramCases.has(mod.diagram);
  if (!hasEng && !custom) missingEngines.push(`${mod.slug} → ${mod.engine}`);
  if (!diagramOk && !custom) missingDiagrams.push(`${mod.slug} → ${mod.diagram}`);

  const row: Row = {
    slug: mod.slug,
    title: mod.title,
    specialty: mod.specialty,
    engine: mod.engine,
    diagram: mod.diagram,
    engineOk: hasEng || custom,
    diagramOk: diagramOk || custom,
    custom,
    steps: 0,
    checks: 0,
    fail: 0,
    extras: 0,
    dims: 0,
    nan: 0,
    headline: "",
  };

  if (hasEng) {
    try {
      const out = runEngine(mod.engine, seed(mod));
      row.steps = out.steps?.length ?? 0;
      row.checks = out.checks?.length ?? 0;
      row.fail = (out.checks ?? []).filter((c) => !c.ok).length;
      row.extras = out.extras?.length ?? 0;
      row.dims = out.dims ? Object.keys(out.dims).length : 0;
      row.headline = String(out.headline ?? "").slice(0, 140);
      const nans = scanNaN(out);
      row.nan = nans.length;
      if (nans.length) nanHits.push({ slug: mod.slug, n: nans.length });
      if (row.steps < 1) emptyMem.push(mod.slug);
      if (row.checks >= 3 && row.fail === row.checks) allFail.push(mod.slug);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      row.error = msg.slice(0, 180);
      throws.push({ slug: mod.slug, error: msg.slice(0, 180) });
    }
  } else if (!custom) {
    row.error = "motor ausente";
  }
  rows.push(row);
}

const bySpec: Record<string, { n: number; ok: number; warn: number; bad: number }> = {};
for (const s of SPECIALTIES) bySpec[s.slug] = { n: 0, ok: 0, warn: 0, bad: 0 };
for (const r of rows) {
  const b = bySpec[r.specialty] ?? (bySpec[r.specialty] = { n: 0, ok: 0, warn: 0, bad: 0 });
  b.n += 1;
  const bad = Boolean(r.error) || !r.engineOk;
  const warn = !bad && (!r.diagramOk || r.nan > 0 || r.steps < 2);
  if (bad) b.bad += 1;
  else if (warn) b.warn += 1;
  else b.ok += 1;
}

function almost(a: number, b: number, tol = 0.02) {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
}

const numeric: { id: string; ok: boolean; detail: string }[] = [];
{
  const L = 8, w = 2.5;
  const o = runEngine("vigaDiagramas", { L: String(L), w: String(w), tipo: "repartida" });
  const M = w * L * L / 8;
  const V = w * L / 2;
  numeric.push({
    id: "vigaDiagramas M=wL²/8",
    ok: o.headline.includes(M.toFixed(2).replace(".", ",")) || o.headline.includes(M.toFixed(2)) || /15[,.]00/.test(o.headline),
    detail: `esperado M=${M} V=${V} · ${o.headline}`,
  });
}
{
  const o = runEngine("vigaFlexion", { b: "25", h: "50", rec: "5", fc: "210", fy: "4200", L: "6", wu: "2.5", dest: "0.95", db: "1.59" });
  const Mu = (2.5 * 6 * 6) / 8;
  numeric.push({
    id: "vigaFlexion Mu=wu L²/8",
    ok: o.steps.some((s) => /11[,.]25/.test(String(s.result)) || String(s.result).includes(Mu.toFixed(2))),
    detail: `Mu=${Mu} t·m · ${o.headline}`,
  });
}
{
  const o = runEngine("predColumnas", { nPisos: "5", area: "20", wd: "1000", fc: "210", bMin: "25", tipo: "interior", Lu: "300", rec: "4" });
  numeric.push({
    id: "predColumnas emite Ag y ρ",
    ok: /Ag|cm|Ø/.test(o.headline + o.adoption) && o.steps.length >= 3,
    detail: o.headline,
  });
}
{
  const o = runEngine("espectroE030", { zona: "3", suelo: "S2", categoria: "B", T: "0.6" });
  numeric.push({
    id: "espectro E.030 Sa",
    ok: o.steps.length >= 3 && /Sa|Z|U|S/.test(o.headline + JSON.stringify(o.steps.map((s) => s.title))),
    detail: o.headline,
  });
}
{
  const o = runEngine("zapataAislada", { P: "80", qadm: "20", c: "1.5", Df: "1.5", h: "50", rec: "7.5", fc: "210", fy: "4200" });
  numeric.push({
    id: "zapata aislada q y As",
    ok: o.steps.length >= 4 && o.checks.length >= 1,
    detail: o.headline,
  });
}
{
  const o = runEngine("losa2d", { ...dumpBoth(exampleModel("losa")), h: "15", rec: "2.5", cv: "250", acab: "100", fy: "4200", fc: "210", tipoLosa: "maciza" });
  numeric.push({
    id: "losa2d 5 paños L_ext",
    ok: /5 paños/.test(o.headline) && Boolean(o.dims?.losaSteelJson),
    detail: o.headline,
  });
}
{
  const o = runEngine("zapataCorrida", { ...dumpBoth(exampleModel("zapata")), tipo: "columnas", qadm: "2", Df: "1.5", gt: "1.8", sc: "0.3", hf: "0.45", fc: "210", fy: "4200", rec: "7.5" });
  numeric.push({
    id: "zapata corrida punchJson",
    ok: Boolean(o.dims?.punchJson) && o.steps.length >= 6,
    detail: o.headline,
  });
}
{
  const o = runEngine("platea", { ...dumpBoth(exampleModel("platea")), t: "0.50", qadm: "1.5", Df: "1.2", gt: "1.8", sc: "0.3", Ks: "8", fc: "210", fy: "4200", rec: "7.5" });
  numeric.push({
    id: "platea punch + VC",
    ok: Boolean(o.dims?.punchJson) && o.steps.length >= 8,
    detail: o.headline,
  });
}

const report = {
  modules: MODULES.length,
  enginesRegistered: Object.keys(ENGINES).length,
  diagramCases: [...diagramCases].sort(),
  missingEngines,
  missingDiagrams,
  throws,
  emptyMem,
  nanHits,
  allFail,
  numeric,
  bySpec,
  rows: rows.map((r) => ({
    slug: r.slug,
    specialty: r.specialty,
    engine: r.engine,
    diagram: r.diagram,
    engineOk: r.engineOk,
    diagramOk: r.diagramOk,
    custom: r.custom,
    steps: r.steps,
    checks: r.checks,
    fail: r.fail,
    extras: r.extras,
    dims: r.dims,
    nan: r.nan,
    error: r.error,
    headline: r.headline,
  })),
};

console.log(JSON.stringify(report, null, 2));
