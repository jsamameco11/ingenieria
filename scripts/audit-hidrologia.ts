/**
 * Auditoría de las 7 hojas de hidrología (HID-13 … HID-13F).
 * Ejecutar: npx --yes tsx scripts/audit-hidrologia.ts
 */
import { writeFileSync } from "node:fs";
import {
  calcularHidrologico,
  FINALIDAD_META,
  HIDROLOGICO_DEFAULT,
  type FinalidadEstudio,
} from "../src/lib/hidro/hidrologico";

const HOJAS: { id: string; code: string; finalidad: FinalidadEstudio }[] = [
  { id: "hidro-estudio", code: "HID-13", finalidad: "estudio-general" },
  { id: "hidro-puente", code: "HID-13A", finalidad: "puente" },
  { id: "hidro-defensa", code: "HID-13B", finalidad: "defensa-riberena" },
  { id: "hidro-baden", code: "HID-13C", finalidad: "badén-alcantarilla" },
  { id: "hidro-mineria", code: "HID-13D", finalidad: "mineria-aurifera" },
  { id: "hidro-bocatoma-est", code: "HID-13E", finalidad: "bocatoma-riego" },
  { id: "hidro-industrial", code: "HID-13F", finalidad: "captacion-industrial" },
];

function defaultsFor(finalidad: FinalidadEstudio) {
  const m = FINALIDAD_META[finalidad];
  const base = { ...HIDROLOGICO_DEFAULT, finalidad, Tret: m.T };
  if (finalidad === "mineria-aurifera") {
    return {
      ...base,
      tipoCauce: "quebrada" as const,
      C: 0.85,
      usarSCS: true,
      CN: 85,
      QdemandaLps: 25,
      horasOperacion: 16,
      fraccionCaptacion: 0.4,
      FSagua: 1.5,
      Tret: 50,
    };
  }
  if (finalidad === "puente") return { ...base, tipoCauce: "rio" as const, Tret: 100, bordeLibre: 1.5, usarSCS: true };
  if (finalidad === "defensa-riberena") return { ...base, tipoCauce: "rio" as const, Tret: 50, bordeLibre: 1.0, usarSCS: true };
  if (finalidad === "badén-alcantarilla") return { ...base, tipoCauce: "quebrada" as const, Tret: 25, bordeLibre: 0.8, Aha: 80 };
  if (finalidad === "bocatoma-riego") {
    return { ...base, tipoCauce: "rio" as const, Tret: 25, QdemandaLps: 50, horasOperacion: 12, fraccionCaptacion: 0.5 };
  }
  if (finalidad === "captacion-industrial") {
    return { ...base, tipoCauce: "rio" as const, Tret: 25, QdemandaLps: 10, horasOperacion: 24, fraccionCaptacion: 0.35 };
  }
  return base;
}

type Grade = "ok" | "warn" | "fail";

const rows = HOJAS.map((h) => {
  const issues: string[] = [];
  let grade: Grade = "ok";
  try {
    const meta = FINALIDAD_META[h.finalidad];
    if (!meta) {
      issues.push("FINALIDAD_META ausente");
      grade = "fail";
    }
    const inp = defaultsFor(h.finalidad);
    const r = calcularHidrologico(inp);
    if (!(r.Qadopt > 0)) {
      issues.push(`Qadopt ≤ 0 (${r.Qadopt})`);
      grade = "fail";
    }
    if (!(r.I > 0)) {
      issues.push(`I ≤ 0 (${r.I})`);
      grade = grade === "fail" ? "fail" : "warn";
    }
    if (!(r.cotaNameNueva > 0)) {
      issues.push("N.A.M.E. inválida");
      grade = grade === "fail" ? "fail" : "warn";
    }
    if (!(r.listoDiseno.Qdiseño > 0)) {
      issues.push("listoDiseno.Qdiseño vacío");
      grade = "fail";
    }
    if (!Number.isFinite(r.Qmanning) || !Number.isFinite(r.Qvel) || !Number.isFinite(r.Qracional)) {
      issues.push("Método A/B/C no finito");
      grade = "fail";
    }
    if (inp.usarSCS && !(r.Qscs >= 0)) {
      issues.push("SCS inválido");
      grade = "fail";
    }
    const esAgua =
      h.finalidad === "mineria-aurifera" ||
      h.finalidad === "bocatoma-riego" ||
      h.finalidad === "captacion-industrial";
    if (esAgua && !(r.QcaptacionLps > 0)) {
      issues.push("Captación L/s = 0 con demanda activa");
      grade = grade === "fail" ? "fail" : "warn";
    }
    return {
      ...h,
      label: meta?.label ?? "?",
      T: inp.Tret,
      Qadopt: r.Qadopt,
      I: r.I,
      Tc: r.TcMin,
      name: r.cotaNameNueva,
      QestiajeLps: r.QestiajeLps,
      QcaptacionLps: r.QcaptacionLps,
      balanceOk: r.balanceOk,
      avisos: r.avisos.length,
      faltantes: r.faltantes.length,
      grade,
      issues,
    };
  } catch (e) {
    return {
      ...h,
      label: FINALIDAD_META[h.finalidad]?.label ?? "?",
      T: 0,
      Qadopt: 0,
      I: 0,
      Tc: 0,
      name: 0,
      QestiajeLps: 0,
      QcaptacionLps: 0,
      balanceOk: false,
      avisos: 0,
      faltantes: 0,
      grade: "fail" as Grade,
      issues: [`Excepción: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
});

const summary = {
  total: rows.length,
  ok: rows.filter((r) => r.grade === "ok").length,
  warn: rows.filter((r) => r.grade === "warn").length,
  fail: rows.filter((r) => r.grade === "fail").length,
};

writeFileSync("scripts/_audit-hidrologia-result.json", JSON.stringify({ summary, rows }, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
for (const r of rows) {
  console.log(
    `${r.grade.toUpperCase()} ${r.code} · ${r.id} · Q=${r.Qadopt} · T=${r.T} · I=${r.I}${r.issues.length ? " · " + r.issues.join("; ") : ""}`
  );
}
