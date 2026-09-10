/**
 * Auditoría plantilla × plantilla: vínculo partidas → cronograma CPM.
 * Ejecutar: npx --yes tsx scripts/audit-cronograma-plantillas.ts
 */
import { writeFileSync } from "node:fs";
import { aplicarPlantilla, PLANTILLAS } from "../src/lib/presupuesto/plantillas";
import { partidaDeLinea } from "../src/lib/presupuesto/engine";
import { hayCiclo, partidasSinTarea, resumenVinculo } from "../src/lib/cronograma/desdePresupuesto";
import { schedule } from "../src/lib/cronograma/cpm";
import type { EspecialidadPre } from "../src/lib/presupuesto/types";

type Grade = "ok" | "warn" | "fail";

type Row = {
  id: string;
  nombre: string;
  categoria: string;
  lineas: number;
  conMetrado: number;
  sinMetrado: number;
  sinPartida: number;
  tareasPartida: number;
  importadas: number;
  faltan: number;
  coveragePct: number;
  preds: number;
  orphans: number;
  especialidades: number;
  ciclo: boolean;
  diasObra: number;
  criticas: number;
  durCero: number;
  sinRend: number;
  capsSinEnlace: string[];
  grade: Grade;
  issues: string[];
};

function gradeOf(r: Omit<Row, "grade">): Grade {
  if (r.ciclo || r.coveragePct < 85 || r.diasObra <= 0) return "fail";
  // Raíces esperadas ≈ 1 por especialidad (arranque desde H-ini). Solo alerta exceso real.
  const orphanBudget = Math.max(3, r.especialidades + 1);
  if (r.faltan > 0 || r.orphans > orphanBudget || r.durCero > 2 || r.sinRend > 5 || r.capsSinEnlace.length > 2) return "warn";
  if (r.coveragePct < 98 || r.preds < r.tareasPartida * 0.5) return "warn";
  return "ok";
}

function auditOne(id: string): Row | null {
  const pre = aplicarPlantilla(id);
  if (!pre) return null;
  const pl = PLANTILLAS.find((p) => p.id === id)!;
  const crono = pre.cronograma;
  const leaves = crono.tasks.filter((t) => t.partidaCodigo);
  const vinculo = resumenVinculo(pre, crono);
  const sinTarea = partidasSinTarea(pre, crono);
  const ciclo = hayCiclo(crono.tasks);
  const computed = schedule(crono);
  const leafComp = computed.filter((c) => {
    const t = crono.tasks.find((x) => x.id === c.id);
    return t?.partidaCodigo;
  });
  const fin = leafComp.reduce((m, c) => (c.ef > m ? c.ef : m), crono.start);
  const ini = crono.start;
  const diasObra = Math.max(0, Math.round((Date.parse(fin) - Date.parse(ini)) / 86400000));
  const criticas = leafComp.filter((c) => c.critical).length;
  const durCero = leaves.filter((t) => t.duration <= 0).length;
  const sinRend = leaves.filter((t) => !t.rendimiento || t.rendimiento <= 0).length;
  const orphans = leaves.filter((t) => t.pred.length === 0 || (t.pred.length === 1 && t.pred[0].id === "H-ini")).length;
  const preds = leaves.reduce((s, t) => s + t.pred.length, 0);

  let conMetrado = 0;
  let sinMetrado = 0;
  let sinPartida = 0;
  for (const l of pre.lineas) {
    const p = partidaDeLinea(l);
    if (!p) {
      sinPartida++;
      continue;
    }
    if (l.metrado > 0) conMetrado++;
    else sinMetrado++;
  }

  const byEspCaps = new Map<string, string[]>();
  const byCap = new Map<string, { n: number; firstLeaf?: (typeof leaves)[0] }>();
  for (const t of leaves) {
    const p = partidaDeLinea({ id: t.id, codigo: t.partidaCodigo!, metrado: t.metrado });
    if (!p) continue;
    const m = p.capitulo.match(/^(\d{2})/);
    const num = m?.[1] ?? "?";
    const key = `${p.especialidad}::${num}`;
    const cur = byCap.get(key) ?? { n: 0 };
    cur.n += 1;
    if (!cur.firstLeaf) cur.firstLeaf = t;
    byCap.set(key, cur);
    const arr = byEspCaps.get(p.especialidad) ?? [];
    if (!arr.includes(num)) arr.push(num);
    byEspCaps.set(p.especialidad, arr);
  }
  for (const [, nums] of byEspCaps) nums.sort();
  const especialidades = byEspCaps.size;
  const capsSinEnlace: string[] = [];
  for (const [cap, info] of byCap) {
    const [esp, num] = cap.split("::");
    const ordered = byEspCaps.get(esp) ?? [];
    const isEntry = ordered[0] === num; // primer capítulo presente de la especialidad
    const sample = info.firstLeaf;
    if (!sample || isEntry) continue;
    if (sample.pred.length === 1 && sample.pred[0].id === "H-ini") {
      capsSinEnlace.push(`${cap} (${info.n})`);
    }
  }

  const coveragePct = vinculo.validas > 0 ? Math.round((vinculo.importadas / Math.max(1, conMetrado || vinculo.validas)) * 1000) / 10 : 0;
  // coverage: importadas vs líneas con metrado>0 (las de metrado 0 no deben generar tarea)
  const cov = conMetrado > 0 ? Math.round((vinculo.importadas / conMetrado) * 1000) / 10 : 100;

  const issues: string[] = [];
  if (ciclo) issues.push("Ciclo en la red CPM");
  if (vinculo.faltan > 0) issues.push(`${vinculo.faltan} partidas con metrado sin tarea C-*`);
  if (sinPartida > 0) issues.push(`${sinPartida} líneas con código inexistente en catálogo`);
  if (sinMetrado > 0) issues.push(`${sinMetrado} líneas con metrado 0 (no entran al cronograma — correcto)`);
  if (diasObra <= 0) issues.push("Duración de obra ≤ 0 días");
  if (durCero > 0) issues.push(`${durCero} tareas con duración 0`);
  if (sinRend > 0) issues.push(`${sinRend} tareas sin rendimiento APU`);
  if (orphans > leaves.length * 0.35) issues.push(`Muchas hojas solo cuelgan del hito inicio (${orphans})`);
  if (capsSinEnlace.length) issues.push(`Capítulos sin enlace cruzado explícito: ${capsSinEnlace.slice(0, 4).join(", ")}`);
  if (criticas === 0 && leaves.length > 5) issues.push("Ninguna tarea crítica detectada");
  if (cov < 99.9 && conMetrado !== vinculo.importadas) {
    issues.push(`Cobertura ${cov}% (${vinculo.importadas}/${conMetrado})`);
  }

  const row: Omit<Row, "grade"> = {
    id: pl.id,
    nombre: pl.nombre,
    categoria: pl.categoria,
    lineas: pre.lineas.length,
    conMetrado,
    sinMetrado,
    sinPartida,
    tareasPartida: leaves.length,
    importadas: vinculo.importadas,
    faltan: Math.max(0, conMetrado - vinculo.importadas),
    coveragePct: cov,
    preds,
    orphans,
    especialidades,
    ciclo,
    diasObra,
    criticas,
    durCero,
    sinRend,
    capsSinEnlace,
    issues,
  };
  return { ...row, grade: gradeOf(row) };
}

const rows: Row[] = [];
for (const pl of PLANTILLAS) {
  try {
    const r = auditOne(pl.id);
    if (r) rows.push(r);
  } catch (e) {
    rows.push({
      id: pl.id,
      nombre: pl.nombre,
      categoria: pl.categoria,
      lineas: 0,
      conMetrado: 0,
      sinMetrado: 0,
      sinPartida: 0,
      tareasPartida: 0,
      importadas: 0,
      faltan: 0,
      coveragePct: 0,
      preds: 0,
      orphans: 0,
      especialidades: 0,
      ciclo: false,
      diasObra: 0,
      criticas: 0,
      durCero: 0,
      sinRend: 0,
      capsSinEnlace: [],
      grade: "fail",
      issues: [`Excepción: ${e instanceof Error ? e.message : String(e)}`],
    });
  }
}

const summary = {
  total: rows.length,
  ok: rows.filter((r) => r.grade === "ok").length,
  warn: rows.filter((r) => r.grade === "warn").length,
  fail: rows.filter((r) => r.grade === "fail").length,
  avgCoverage: Math.round((rows.reduce((s, r) => s + r.coveragePct, 0) / Math.max(1, rows.length)) * 10) / 10,
  avgDays: Math.round(rows.reduce((s, r) => s + r.diasObra, 0) / Math.max(1, rows.length)),
  withCycles: rows.filter((r) => r.ciclo).length,
  withMissing: rows.filter((r) => r.faltan > 0).length,
  withBadCodes: rows.filter((r) => r.sinPartida > 0).length,
};

const byCat = new Map<string, Row[]>();
for (const r of rows) {
  const a = byCat.get(r.categoria) ?? [];
  a.push(r);
  byCat.set(r.categoria, a);
}

const out = { generatedAt: new Date().toISOString(), summary, byCat: Object.fromEntries([...byCat].map(([k, v]) => [k, v])), rows };
writeFileSync("scripts/_audit-cronograma-result.json", JSON.stringify(out, null, 2), "utf8");

console.log(JSON.stringify(summary, null, 2));
console.log("\nFAILS:");
for (const r of rows.filter((x) => x.grade === "fail")) {
  console.log(`- ${r.id} · ${r.nombre}: ${r.issues.join(" | ")}`);
}
console.log("\nWARNS (sample):");
for (const r of rows.filter((x) => x.grade === "warn").slice(0, 25)) {
  console.log(`- ${r.id}: ${r.issues.slice(0, 2).join(" | ")}`);
}
console.log(`\nWrote scripts/_audit-cronograma-result.json (${rows.length} plantillas)`);
