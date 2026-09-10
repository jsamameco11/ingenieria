import { type CalcCheck, type CalcOutput, type Engine, fmt, num, str } from "../types";
import { acObra, elemObra } from "../mezclaObra";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}
function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lookup1(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]!) {
      const t = (x - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return lerp(ys[i - 1]!, ys[i]!, t);
    }
  }
  return ys[ys.length - 1]!;
}

const TM = [0.25, 0.375, 0.5, 0.75, 1, 1.5, 2, 2.5, 3];
const KR = [1.6, 1.3, 1.1, 1.05, 1, 0.91, 0.82, 0.78, 0.74];
const C1 = [1.33, 1.2, 1.14, 1.05, 1, 0.93, 0.88, 0.85, 0.82];

function kaDe(fino: string, grueso: string) {
  const f = fino.startsWith("trit") ? "trit" : "nat";
  const g = grueso.startsWith("semi") ? "semi" : grueso.startsWith("canto") || grueso.startsWith("rod") ? "canto" : "trit";
  const t: Record<string, Record<string, number>> = {
    nat: { trit: 1, semi: 0.97, canto: 0.91 },
    trit: { trit: 1.14, semi: 1.1, canto: 0.93 },
  };
  return t[f]![g]!;
}
function c2De(fino: string, grueso: string) {
  const f = fino.startsWith("trit") ? "trit" : "nat";
  const g = grueso.startsWith("semi") ? "semi" : grueso.startsWith("canto") || grueso.startsWith("rod") ? "canto" : "trit";
  const t: Record<string, Record<string, number>> = {
    nat: { trit: 1, semi: 0.93, canto: 0.9 },
    trit: { trit: 1.28, semi: 1.23, canto: 0.96 },
  };
  return t[f]![g]!;
}
function fcrTabla(fc: number, control: string) {
  const c = control.toLowerCase();
  const col = c.startsWith("exc") ? 0 : c.startsWith("sin") ? 2 : 1;
  const row = fc < 210 ? 0 : fc <= 350 ? 1 : 2;
  const add = [
    [45, 80, 130],
    [60, 95, 170],
    [75, 110, 210],
  ][row]![col]!;
  return fc + add;
}
function alphaDeR(R: number, edad: number) {
  const r = Math.max(R, 50);
  if (edad <= 7) return 2.627 - 0.3887 * Math.log(r);
  if (edad >= 90) return 3.369 - 0.4896 * Math.log(r);
  return 3.147 - 0.4625 * Math.log(r);
}
function rDeAlpha(a: number, edad: number) {
  const aa = Math.max(0.2, Math.min(1.2, a));
  if (edad <= 7) return Math.exp((2.627 - aa) / 0.3887);
  if (edad >= 90) return Math.exp((3.369 - aa) / 0.4896);
  return Math.exp((3.147 - aa) / 0.4625);
}
function alphaMaxAmbiente(cond: string) {
  const c = cond.toLowerCase();
  if (c.includes("litoral")) return 0.6;
  if (c.includes("humedad")) return 0.55;
  if (c.includes("marina") || c.includes("salp") || c.includes("yeso") || c.includes("selen")) return 0.4;
  if (c.includes("no corros")) return 0.5;
  if (c.includes("delgad")) return 0.45;
  if (c.includes("masa")) return 0.65;
  return 0.75;
}
function cMinServicio(cond: string) {
  return cond.toLowerCase().includes("agres") || cond.toLowerCase().includes("marino") || cond.toLowerCase().includes("desgaste")
    ? 350
    : 270;
}

const ACI_TM = [0.375, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const ACI_AGUA_NO: number[][] = [
  [207, 199, 190, 179, 166, 154, 130, 113],
  [228, 216, 205, 193, 181, 169, 145, 124],
  [243, 228, 216, 202, 190, 178, 160, 160],
];
const ACI_AGUA_SI: number[][] = [
  [181, 175, 168, 160, 150, 142, 122, 107],
  [202, 193, 184, 175, 165, 157, 133, 119],
  [216, 205, 197, 184, 174, 166, 154, 154],
];
const ACI_FC = [150, 200, 250, 300, 350, 400, 450];
const ACI_AC_NO = [0.79, 0.69, 0.61, 0.54, 0.47, 0.42, 0.38];
const ACI_AC_SI = [0.7, 0.6, 0.52, 0.45, 0.39, 0.39, 0.39];
const ACI_BBO: number[][] = [
  [0.5, 0.48, 0.46, 0.44],
  [0.59, 0.57, 0.55, 0.53],
  [0.66, 0.64, 0.62, 0.6],
  [0.71, 0.69, 0.67, 0.65],
  [0.75, 0.73, 0.71, 0.69],
  [0.78, 0.76, 0.74, 0.72],
  [0.82, 0.79, 0.78, 0.75],
  [0.87, 0.85, 0.83, 0.81],
];
const ACI_MF = [2.4, 2.6, 2.8, 3];
const ACI_AIRE_NO = [3, 2.5, 2, 1.5, 1, 0.5, 0.3, 0.2];
const ACI_AIRE_N = [4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];
const ACI_AIRE_M = [8, 5.5, 5, 4.5, 4.5, 4, 3.5, 3];
const ACI_AIRE_E = [7.5, 7, 6, 6, 5.5, 5, 4.5, 4];

function slumpBanda(pulg: number) {
  if (pulg <= 2.5) return 0;
  if (pulg <= 5) return 1;
  return 2;
}
function aguaAci(slumpIn: number, tm: number, aire: boolean) {
  const band = slumpBanda(slumpIn);
  const tab = aire ? ACI_AGUA_SI : ACI_AGUA_NO;
  const row = tab[band]!;
  return lookup1(ACI_TM, row, tm);
}
function acAci(fc: number, aire: boolean) {
  return lookup1(ACI_FC, aire ? ACI_AC_SI : ACI_AC_NO, fc);
}
function bboAci(tm: number, mf: number) {
  const tmClamped = Math.max(ACI_TM[0]!, Math.min(ACI_TM[ACI_TM.length - 1]!, tm));
  const mfClamped = Math.max(2.4, Math.min(3, mf));
  let i0 = 0;
  for (let i = 1; i < ACI_TM.length; i++) if (tmClamped >= ACI_TM[i]!) i0 = i;
  const i1 = Math.min(i0 + 1, ACI_TM.length - 1);
  const tt = i0 === i1 ? 0 : (tmClamped - ACI_TM[i0]!) / (ACI_TM[i1]! - ACI_TM[i0]!);
  const a = lookup1(ACI_MF, ACI_BBO[i0]!, mfClamped);
  const b = lookup1(ACI_MF, ACI_BBO[i1]!, mfClamped);
  return lerp(a, b, tt);
}
function aireAci(tm: number, aire: boolean, expo: string) {
  const e = expo.toLowerCase();
  const row = !aire ? ACI_AIRE_NO : e.startsWith("ext") ? ACI_AIRE_E : e.startsWith("nor") ? ACI_AIRE_N : ACI_AIRE_M;
  return lookup1(ACI_TM, row, tm);
}

function dimsMezcla(C: number, arena: number, piedra: number, agua: number, fc: number, vol: number) {
  const bolsas = C / 42.5;
  return {
    C: String(C),
    arena: String(arena),
    piedra: String(piedra),
    agua: String(agua),
    fc: String(fc),
    vol: String(vol),
    bolsas: String(bolsas),
    ra: String(C > 0 ? arena / C : 0),
    rp: String(C > 0 ? piedra / C : 0),
    rw: String(C > 0 ? agua / C : 0),
  };
}

/** ACI 211 — Diseñador de mezclas (Pasquel / U. Andina del Cusco). */
export const disenoMezclaAci: Engine = (raw) => {
  const fc = num(raw, "fc", 240);
  const slumpIn = num(raw, "slump", 2);
  const aire = str(raw, "aire", "si") !== "no";
  const expo = str(raw, "expo", "moderada");
  const PEf = num(raw, "PEf", 2640);
  const MF = num(raw, "MF", 2.8);
  const absF = num(raw, "absF", 0.7);
  const hF = num(raw, "hF", 6);
  const tm = num(raw, "tm", 0.75);
  const PEg = num(raw, "PEg", 2680);
  const PUCS = num(raw, "PUCS", 1600);
  const absG = num(raw, "absG", 0.5);
  const hG = num(raw, "hG", 2);
  const PEc = num(raw, "PEc", 3.15) * 1000;
  const PUf = num(raw, "PUf", 1550);
  const PUsG = num(raw, "PUsG", 1450);
  const PUc = num(raw, "PUc", 1400);
  const vol = Math.max(0.01, num(raw, "vol", 1));
  const agua = aguaAci(slumpIn, tm, aire);
  const ac = acAci(fc, aire);
  const C = agua / Math.max(ac, 0.25);
  const Vc = C / PEc;
  const Vw = agua / 1000;
  const bbo = bboAci(tm, MF);
  const PgDry = bbo * PUCS;
  const Vg = PgDry / PEg;
  const airePct = aireAci(tm, aire, expo);
  const Va = airePct / 100;
  const Vf = Math.max(0.02, 1 - Vw - Vc - Vg - Va);
  const PfDry = Vf * PEf;
  const balG = (hG - absG) / 100;
  const balF = (hF - absF) / 100;
  const PgWet = PgDry * (1 + hG / 100);
  const PfWet = PfDry * (1 + hF / 100);
  const wG = PgWet * balG;
  const wF = PfWet * balF;
  const Afinal = agua - wG - wF;
  const Ctot = C * vol;
  const Atot = Afinal * vol;
  const Gtot = PgWet * vol;
  const Ftot = PfWet * vol;
  const bolsas = Ctot / 42.5;
  const acReal = Afinal / C;
  const raP = C > 0 ? PfWet / C : 0;
  const rpP = C > 0 ? PgWet / C : 0;
  const rwP = C > 0 ? Afinal / C : 0;
  const VcemL = C / Math.max(PUc, 800);
  const VfL = PfWet / Math.max(PUf, 800);
  const VgL = PgWet / Math.max(PUsG, 800);
  const VwL = Afinal / 1000;
  const VcemTot = VcemL * vol;
  const VfTot = VfL * vol;
  const VgTot = VgL * vol;
  const VwTot = VwL * vol;
  const raV = VcemL > 0 ? VfL / VcemL : 0;
  const rpV = VcemL > 0 ? VgL / VcemL : 0;
  const rwV = VcemL > 0 ? VwL / VcemL : 0;

  return out(
    `f'c = ${fmt(fc, 0)} kg/cm²   ·   ${fmt(C, 1)} kg cem/m³   ·   a/c = ${fmt(ac, 3)}`,
    `${fmt(vol, 2)} m³  →  ${fmt(Ctot, 1)} kg cem  ·  ${fmt(bolsas, 2)} bolsas  ·  ${fmt(Ftot, 0)} kg arena  ·  ${fmt(Gtot, 0)} kg piedra  ·  ${fmt(Atot, 1)} L agua`,
    [
      {
        n: "01",
        title: "Agua de amasado (Tabla ACI 211.1)",
        formula: "A = f(slump, TM, aire)    kg/m³",
        substitution: `slump ${fmt(slumpIn, 1)}"  ·  TM ${fmt(tm, 2)}"  ·  ${aire ? "con" : "sin"} aire`,
        desarrollo: [
          `Banda de slump: ${slumpIn <= 2.5 ? "1 a 2 pulg" : slumpIn <= 5 ? "3 a 4 pulg" : "6 a 7 pulg"}.`,
          `Tabla de agua de amasado ACI 211.1 para TM = ${fmt(tm, 2)}" ${aire ? "con aire incorporado" : "sin aire"}.`,
        ],
        result: `A = ${fmt(agua, 1)} kg/m³  =  ${fmt(Vw, 3)} m³`,
        note: "Hoja Diseñador de mezclas ACI (Pasquel). El agua de tabla es de agregados secos.",
        table: {
          caption: "Tabla 1 — Agua de amasado",
          headers: ["Parámetro", "Valor"],
          rows: [
            ["Slump", `${fmt(slumpIn, 1)} pulg`],
            ["Tamaño máximo", `${fmt(tm, 2)} pulg`],
            ["Aire incorporado", aire ? "Sí" : "No"],
            ["Agua de tabla", `${fmt(agua, 1)} kg/m³`],
          ],
        },
      },
      {
        n: "02",
        title: "Relación a/c y dosis de cemento",
        formula: "a/c = f(f'c, aire)     C = A / (a/c)",
        substitution: `f'c = ${fmt(fc, 0)} kg/cm²  ·  A = ${fmt(agua, 1)}`,
        desarrollo: [
          `a/c de Tabla ACI 211.1 interpolada a f'c = ${fmt(fc, 0)} kg/cm².`,
          `C = ${fmt(agua, 1)} / ${fmt(ac, 3)} = ${fmt(C, 2)} kg/m³`,
          `Volumen absoluto del cemento = ${fmt(C, 2)} / ${fmt(PEc, 0)} = ${fmt(Vc, 4)} m³`,
        ],
        result: `a/c = ${fmt(ac, 3)}     C = ${fmt(C, 1)} kg/m³`,
        table: {
          caption: "Tabla 2 — Cemento",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["f'c", `${fmt(fc, 0)} kg/cm²`],
            ["a/c", fmt(ac, 3)],
            ["Cemento", `${fmt(C, 1)} kg/m³`],
            ["Peso específico", `${fmt(PEc / 1000, 2)} g/cm³`],
            ["Volumen absoluto", `${fmt(Vc, 4)} m³`],
          ],
        },
      },
      {
        n: "03",
        title: "Agregado grueso compactado seco",
        formula: "b/b₀ = f(TM, MF)     P_g = (b/b₀) · PUCS     V_g = P_g / PE_g",
        substitution: `b/b₀ = ${fmt(bbo, 3)}  ·  PUCS = ${fmt(PUCS, 0)} kg/m³`,
        desarrollo: [
          `Volumen de grava compactada seca (Tabla ACI) para TM ${fmt(tm, 2)}" y MF ${fmt(MF, 2)}.`,
          `P_g seca = ${fmt(bbo, 3)} × ${fmt(PUCS, 0)} = ${fmt(PgDry, 1)} kg/m³`,
          `V_g = ${fmt(PgDry, 1)} / ${fmt(PEg, 0)} = ${fmt(Vg, 4)} m³`,
        ],
        result: `P_g = ${fmt(PgDry, 1)} kg/m³     V_g = ${fmt(Vg, 4)} m³`,
        table: {
          caption: "Tabla 3 — Agregado grueso",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["b/b₀", fmt(bbo, 3)],
            ["Piedra seca", `${fmt(PgDry, 1)} kg/m³`],
            ["Volumen absoluto", `${fmt(Vg, 4)} m³`],
          ],
        },
      },
      {
        n: "04",
        title: "Aire y volumen absoluto de arena",
        formula: "V_a = %aire / 100     V_f = 1 − V_w − V_c − V_g − V_a",
        substitution: `aire ${fmt(airePct, 1)} %`,
        desarrollo: [
          `${aire ? `Aire incorporado, exposición ${expo}.` : "Aire atrapado (sin incorporador)."}`,
          `Σ (agua + cemento + grava + aire) = ${fmt(Vw + Vc + Vg + Va, 4)} m³`,
          `V_f = 1 − ${fmt(Vw + Vc + Vg + Va, 4)} = ${fmt(Vf, 4)} m³`,
          `P_f seca = ${fmt(Vf, 4)} × ${fmt(PEf, 0)} = ${fmt(PfDry, 1)} kg/m³`,
        ],
        result: `Arena seca = ${fmt(PfDry, 1)} kg/m³`,
        table: {
          caption: "Tabla 4 — Volúmenes absolutos (1 m³)",
          headers: ["Componente", "Volumen (m³)", "Peso seco (kg)"],
          rows: [
            ["Agua", fmt(Vw, 4), fmt(agua, 1)],
            ["Cemento", fmt(Vc, 4), fmt(C, 1)],
            ["Piedra", fmt(Vg, 4), fmt(PgDry, 1)],
            ["Aire", fmt(Va, 4), "0"],
            ["Arena", fmt(Vf, 4), fmt(PfDry, 1)],
            ["Total", "1.0000", fmt(agua + C + PgDry + PfDry, 1)],
          ],
        },
      },
      {
        n: "05",
        title: "Corrección por humedad y absorción",
        formula: "P_húmeda = P_seca (1 + h)     Δw = P_húmeda (h − abs)     A_final = A − ΣΔw",
        substitution: `h_g=${fmt(hG, 1)} %  abs_g=${fmt(absG, 1)} %   ·   h_f=${fmt(hF, 1)} %  abs_f=${fmt(absF, 1)} %`,
        desarrollo: [
          `Piedra húmeda = ${fmt(PgDry, 1)} × (1 + ${fmt(hG / 100, 3)}) = ${fmt(PgWet, 1)} kg`,
          `Arena húmeda = ${fmt(PfDry, 1)} × (1 + ${fmt(hF / 100, 3)}) = ${fmt(PfWet, 1)} kg`,
          `Agua de la piedra = ${fmt(PgWet, 1)} × ${fmt(balG, 3)} = ${fmt(wG, 2)} kg`,
          `Agua de la arena = ${fmt(PfWet, 1)} × ${fmt(balF, 3)} = ${fmt(wF, 2)} kg`,
          `A_final = ${fmt(agua, 1)} − ${fmt(wG, 2)} − ${fmt(wF, 2)} = ${fmt(Afinal, 1)} kg`,
        ],
        result: `Agua de amasado en obra = ${fmt(Afinal, 1)} kg/m³`,
        note: "Si h > abs el agregado aporta agua y se descuenta del amasado.",
        table: {
          caption: "Tabla 5 — Corrección de agua",
          headers: ["Agregado", "h (%)", "abs (%)", "P húmeda (kg)", "Δw (kg)"],
          rows: [
            ["Piedra", fmt(hG, 1), fmt(absG, 1), fmt(PgWet, 1), fmt(wG, 2)],
            ["Arena", fmt(hF, 1), fmt(absF, 1), fmt(PfWet, 1), fmt(wF, 2)],
            ["Agua final", "—", "—", "—", fmt(Afinal, 1)],
          ],
        },
      },
      {
        n: "06",
        title: "Dosificación para el volumen de obra",
        formula: "P_obra = P_unitario × V     bolsas = C / 42.5",
        substitution: `V = ${fmt(vol, 3)} m³`,
        desarrollo: [
          `Por peso:  1 : ${fmt(raP, 2)} : ${fmt(rpP, 2)} : ${fmt(rwP, 2)}  (cem : arena : piedra : agua, kg/kg).`,
          `Por volumen suelto:  1 : ${fmt(raV, 2)} : ${fmt(rpV, 2)} : ${fmt(rwV, 2)}  con PU cemento ${fmt(PUc, 0)}, arena ${fmt(PUf, 0)} y piedra ${fmt(PUsG, 0)} kg/m³.`,
          `a/c de obra (agua añadida) = ${fmt(acReal, 3)}.`,
        ],
        result: `Peso: ${fmt(Ctot, 1)} kg cem  ·  ${fmt(Ftot, 0)} kg arena  ·  ${fmt(Gtot, 0)} kg piedra  ·  ${fmt(Atot, 1)} L`,
        note: "El cuadro de peso es el de control de laboratorio (ACI 211). El de volumen convierte esas masas con el peso unitario suelto: es el que se usa en obra con carretilla o balde. No confundir con los volúmenes absolutos del paso 04.",
        table: {
          caption: "Tabla 6a — Dosificación por peso",
          headers: ["Material", "kg/m³", `kg en ${fmt(vol, 2)} m³`, "1 : a : p : w (peso)"],
          rows: [
            ["Cemento", fmt(C, 1), fmt(Ctot, 1), "1"],
            ["Arena húmeda", fmt(PfWet, 1), fmt(Ftot, 1), fmt(raP, 2)],
            ["Piedra húmeda", fmt(PgWet, 1), fmt(Gtot, 1), fmt(rpP, 2)],
            ["Agua de obra", fmt(Afinal, 1), fmt(Atot, 1), fmt(rwP, 2)],
            ["Bolsas 42.5 kg", fmt(C / 42.5, 2), fmt(bolsas, 2), "—"],
          ],
        },
      },
      {
        n: "07",
        title: "Dosificación por volumen suelto (obra)",
        formula: "V_i = P_i / PU_suelto     ·     1 : a : p : w = 1 : Vf/Vc : Vg/Vc : Vw/Vc",
        substitution: `PU cem=${fmt(PUc, 0)}  arena=${fmt(PUf, 0)}  piedra=${fmt(PUsG, 0)} kg/m³`,
        desarrollo: [
          `Cemento: ${fmt(C, 1)} / ${fmt(PUc, 0)} = ${fmt(VcemL, 3)} m³ sueltos/m³.`,
          `Arena: ${fmt(PfWet, 1)} / ${fmt(PUf, 0)} = ${fmt(VfL, 3)} m³ sueltos/m³.`,
          `Piedra: ${fmt(PgWet, 1)} / ${fmt(PUsG, 0)} = ${fmt(VgL, 3)} m³ sueltos/m³.`,
          `Agua: ${fmt(Afinal, 1)} L = ${fmt(VwL, 3)} m³.`,
          `Proporción en volumen  1 : ${fmt(raV, 2)} : ${fmt(rpV, 2)} : ${fmt(rwV, 2)}.`,
        ],
        result: `1 : ${fmt(raV, 2)} : ${fmt(rpV, 2)} : ${fmt(rwV, 2)}  (volumen suelto)    ·    ${fmt(bolsas, 2)} bolsas en ${fmt(vol, 2)} m³`,
        note: "El volumen suelto no es el volumen absoluto del paso 04. Aquí se usa el peso unitario suelto del agregado tal como se carga en carretilla.",
        table: {
          caption: "Tabla 6b — Dosificación por volumen suelto",
          headers: ["Material", "m³/m³", `m³ en ${fmt(vol, 2)} m³`, "1 : a : p : w (vol.)"],
          rows: [
            ["Cemento", fmt(VcemL, 3), fmt(VcemTot, 3), "1"],
            ["Arena húmeda", fmt(VfL, 3), fmt(VfTot, 3), fmt(raV, 2)],
            ["Piedra húmeda", fmt(VgL, 3), fmt(VgTot, 3), fmt(rpV, 2)],
            ["Agua de obra", fmt(VwL, 3), fmt(VwTot, 3), fmt(rwV, 2)],
          ],
        },
      },
    ],
    [
      ok("Volúmenes absolutos = 1 m³", fmt(Vw + Vc + Vg + Va + Vf, 4), "= 1.000", Math.abs(Vw + Vc + Vg + Va + Vf - 1) < 0.002),
      ok("a/c de tabla coherente", fmt(ac, 3), "0.35–0.80", ac >= 0.35 && ac <= 0.85),
      ok("Agua de obra positiva", `${fmt(Afinal, 1)} kg`, "> 0", Afinal > 20),
    ],
    [
      {
        title: "Cuadro de dosificación por peso (kg) — ACI 211",
        rows: [
          ["Material", "kg/m³", `kg en ${fmt(vol, 2)} m³`, "1 : a : p : w (peso)"],
          ["Cemento", fmt(C, 1), fmt(Ctot, 1), "1"],
          ["Arena húmeda", fmt(PfWet, 1), fmt(Ftot, 1), fmt(raP, 2)],
          ["Piedra húmeda", fmt(PgWet, 1), fmt(Gtot, 1), fmt(rpP, 2)],
          ["Agua de obra", fmt(Afinal, 1), fmt(Atot, 1), fmt(rwP, 2)],
          ["Proporción", "—", "—", `1 : ${fmt(raP, 2)} : ${fmt(rpP, 2)} : ${fmt(rwP, 2)}`],
        ],
      },
      {
        title: "Cuadro de dosificación por volumen (suelto) — ACI 211",
        rows: [
          ["Material", "m³ sueltos / m³", `m³ en ${fmt(vol, 2)} m³`, "1 : a : p : w (volumen)"],
          ["Cemento", fmt(VcemL, 3), fmt(VcemTot, 3), "1"],
          ["Arena húmeda", fmt(VfL, 3), fmt(VfTot, 3), fmt(raV, 2)],
          ["Piedra húmeda", fmt(VgL, 3), fmt(VgTot, 3), fmt(rpV, 2)],
          ["Agua de obra", fmt(VwL, 3), fmt(VwTot, 3), fmt(rwV, 2)],
          ["Proporción", "—", "—", `1 : ${fmt(raV, 2)} : ${fmt(rpV, 2)} : ${fmt(rwV, 2)}`],
          ["Bolsas 42.5 kg", fmt(C / 42.5, 2), fmt(bolsas, 2), "—"],
        ],
      },
    ],
    dimsMezcla(C, PfWet, PgWet, Afinal, fc, vol),
  );
};

/** Walker / COVENIN 1753-2006 — DISEÑO DE MEZCLA..xls */
export const disenoMezclaWalker: Engine = (raw) => {
  const PEf = num(raw, "PEf", 2.65);
  const PEg = num(raw, "PEg", 2.65);
  const PUf = num(raw, "PUf", 1.55);
  const PUg = num(raw, "PUg", 1.45);
  const hF = num(raw, "hF", 5);
  const hG = num(raw, "hG", 1.4);
  const absF = num(raw, "absF", 3);
  const absG = num(raw, "absG", 2);
  const PEc = num(raw, "PEc", 3.33);
  const fc = num(raw, "fc", 210);
  const control = str(raw, "control", "aceptable");
  const edad = num(raw, "edad", 28);
  const tm = num(raw, "tm", 1);
  const fino = str(raw, "fino", "natural");
  const grueso = str(raw, "grueso", "canto");
  const ambiente = str(raw, "ambiente", "comun");
  const servicio = str(raw, "servicio", "otra");
  const T = num(raw, "T", 7.5);
  const beta = num(raw, "beta", 0.45);
  const volEl = num(raw, "vol", 1);
  const desp = num(raw, "desp", 0);
  const fcr = fcrTabla(fc, control);
  const alpha = Math.round(alphaDeR(fcr, edad) * 1000) / 1000;
  const Kr = lookup1(TM, KR, tm);
  const Ka = kaDe(fino, grueso);
  const alphaCorr = Math.round(alpha * Kr * Ka * 1000) / 1000;
  const aMax = alphaMaxAmbiente(ambiente);
  const aAmb = Math.min(alphaCorr, aMax);
  const C0 = 117.2 * aAmb ** -1.3 * T ** 0.16;
  const C1f = lookup1(TM, C1, tm);
  const C2f = c2De(fino, grueso);
  const Ccorr = Math.round(C0 * C1f * C2f * 1000) / 1000;
  const Cmin = cMinServicio(servicio);
  const C = Math.max(Ccorr, Cmin);
  const A = aAmb * C;
  const AI = (0.03937 * C) / Math.max(tm, 0.25);
  const Vagg = 1000 - C / PEc - A - AI;
  const gaf = 1 / PEf;
  const gag = 1 / PEg;
  const det = gaf * beta - gag * (beta - 1);
  const PAF = (Vagg * beta) / Math.max(det, 1e-9);
  const PAG = ((1 - beta) * Vagg) / Math.max(det, 1e-9);
  const PAFh = Math.round(PAF * (1 + hF / 100) / (1 + absF / 100) * 1000) / 1000;
  const PAGh = Math.round(PAG * (1 + hG / 100) / (1 + absG / 100) * 1000) / 1000;
  const Acorr = A - (PAFh - PAF) - (PAGh - PAG);
  const V = volEl * (1 + desp / 100);
  const FineL = PAFh / PUf;
  const GravL = PAGh / PUg;
  const bolsas = C / 42.5;

  return out(
    `f'c = ${fmt(fc, 0)}  ·  f'cr = ${fmt(fcr, 0)} kg/cm²  ·  a/c = ${fmt(aAmb, 3)}  ·  C = ${fmt(C, 1)} kg/m³`,
    `${fmt(V, 3)} m³  →  ${fmt(C * V, 1)} kg cem  ·  ${fmt(PAFh * V, 0)} kg arena  ·  ${fmt(PAGh * V, 0)} kg grava  ·  ${fmt(Acorr * V, 1)} L`,
    [
      {
        n: "01",
        title: "Resistencia promedio requerida f'cr (COVENIN 1753)",
        formula: "Sin σ: tabla 5.4.2.2     f'cr = f'c + margen(control, f'c)",
        substitution: `f'c = ${fmt(fc, 0)}  ·  control ${control}`,
        desarrollo: [
          fc < 210 ? "f'c < 210 kg/cm²" : fc <= 350 ? "210 ≤ f'c ≤ 350 kg/cm²" : "f'c > 350 kg/cm²",
          `Margen de la tabla según control ${control}.`,
          `f'cr = ${fmt(fc, 0)} + ${fmt(fcr - fc, 0)} = ${fmt(fcr, 0)} kg/cm²`,
        ],
        result: `f'cr = ${fmt(fcr, 0)} kg/cm²`,
        note: "En zona sísmica f'c no será menor de 210 kg/cm².",
        table: {
          caption: "Tabla 1 — f'cr sin desviación estándar",
          headers: ["f'c", "Excelente", "Aceptable", "Sin control"],
          rows: [
            ["< 210", "f'c + 45", "f'c + 80", "f'c + 130"],
            ["210 a 350", "f'c + 60", "f'c + 95", "f'c + 170"],
            ["> 350", "f'c + 75", "f'c + 110", "f'c + 210"],
            ["Adoptado", "—", "—", `${fmt(fcr, 0)} kg/cm²`],
          ],
        },
      },
      {
        n: "02",
        title: "Relación a/c y correcciones Kr, Ka",
        formula: "α = 3.147 − 0.4625 ln(f'cr)    (28 d)     α_corr = α · Kr · Ka     ≤ α_ambiente",
        substitution: `f'cr = ${fmt(fcr, 0)}  ·  ${fmt(edad, 0)} d  ·  TM ${fmt(tm, 2)}"`,
        desarrollo: [
          `α = ${fmt(alpha, 3)}`,
          `Kr (tamaño máximo) = ${fmt(Kr, 2)}    Ka (agregados) = ${fmt(Ka, 2)}`,
          `α_corr = ${fmt(alpha, 3)} × ${fmt(Kr, 2)} × ${fmt(Ka, 2)} = ${fmt(alphaCorr, 3)}`,
          `Tope ambiental (${ambiente}) = ${fmt(aMax, 2)}  →  α = ${fmt(aAmb, 3)}`,
        ],
        result: `α = ${fmt(aAmb, 3)}`,
        table: {
          caption: "Tabla 2 — Relación agua/cemento",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["α de resistencia", fmt(alpha, 3)],
            ["Kr", fmt(Kr, 2)],
            ["Ka", fmt(Ka, 2)],
            ["α corregida", fmt(alphaCorr, 3)],
            ["α ambiente máx.", fmt(aMax, 2)],
            ["α de diseño", fmt(aAmb, 3)],
          ],
        },
      },
      {
        n: "03",
        title: "Dosis de cemento (Walker) y agua",
        formula: "C = 117.2 · α^(−1.3) · T^0.16     C_corr = C · C1 · C2     A = α · C",
        substitution: `T = ${fmt(T, 1)} cm  ·  α = ${fmt(aAmb, 3)}`,
        desarrollo: [
          `C = 117.2 × ${fmt(aAmb, 3)}^(−1.3) × ${fmt(T, 1)}^0.16 = ${fmt(C0, 2)} kg/m³`,
          `C1 = ${fmt(C1f, 2)}    C2 = ${fmt(C2f, 2)}`,
          `C_corr = ${fmt(C0, 2)} × ${fmt(C1f, 2)} × ${fmt(C2f, 2)} = ${fmt(Ccorr, 2)} kg/m³`,
          `Mínimo de servicio (${servicio}) = ${fmt(Cmin, 0)} kg/m³  →  C = ${fmt(C, 2)} kg/m³`,
          `A = ${fmt(aAmb, 3)} × ${fmt(C, 2)} = ${fmt(A, 2)} L/m³`,
          `Aire incluido AI = 0.03937 × C / TM = ${fmt(AI, 2)} L/m³`,
        ],
        result: `C = ${fmt(C, 1)} kg/m³     A = ${fmt(A, 1)} L/m³`,
        table: {
          caption: "Tabla 3 — Cemento, agua y aire",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["C Walker", `${fmt(C0, 1)} kg/m³`],
            ["C corregida", `${fmt(Ccorr, 1)} kg/m³`],
            ["C adoptada", `${fmt(C, 1)} kg/m³`],
            ["Agua", `${fmt(A, 1)} L/m³`],
            ["Aire incluido", `${fmt(AI, 2)} L/m³`],
          ],
        },
      },
      {
        n: "04",
        title: "Agregados por volumen absoluto",
        formula: "V_agg = 1000 − C/γc − A − AI     PAF/(PAF+PAG) = β",
        substitution: `β = ${fmt(beta, 2)}  ·  V_agg = ${fmt(Vagg, 1)} L`,
        desarrollo: [
          `V_c = ${fmt(C, 2)} / ${fmt(PEc, 2)} = ${fmt(C / PEc, 1)} L`,
          `V_agg = 1000 − ${fmt(C / PEc, 1)} − ${fmt(A, 1)} − ${fmt(AI, 2)} = ${fmt(Vagg, 1)} L`,
          `PAF = ${fmt(PAF, 1)} kg     PAG = ${fmt(PAG, 1)} kg  (estado de referencia de la hoja)`,
        ],
        result: `Arena ${fmt(PAF, 1)} kg/m³     Grava ${fmt(PAG, 1)} kg/m³`,
        table: {
          caption: "Tabla 4 — Sistema de agregados",
          headers: ["Incógnita", "kg/m³"],
          rows: [
            ["PAF", fmt(PAF, 1)],
            ["PAG", fmt(PAG, 1)],
            ["Suma", fmt(PAF + PAG, 1)],
          ],
        },
      },
      {
        n: "05",
        title: "Corrección por humedad y absorción",
        formula: "P_h = P · (1+h)/(1+abs)     A_corr = A − (P_h − P)",
        substitution: `h_f=${fmt(hF, 1)} % abs_f=${fmt(absF, 1)} %   ·   h_g=${fmt(hG, 1)} % abs_g=${fmt(absG, 1)} %`,
        desarrollo: [
          `Arena húmeda = ${fmt(PAF, 1)} × (1+${fmt(hF / 100, 3)})/(1+${fmt(absF / 100, 3)}) = ${fmt(PAFh, 1)} kg`,
          `Grava húmeda = ${fmt(PAG, 1)} × (1+${fmt(hG / 100, 3)})/(1+${fmt(absG / 100, 3)}) = ${fmt(PAGh, 1)} kg`,
          `A_corr = ${fmt(A, 2)} − (${fmt(PAFh - PAF, 2)}) − (${fmt(PAGh - PAG, 2)}) = ${fmt(Acorr, 2)} L`,
        ],
        result: `A_corr = ${fmt(Acorr, 1)} L/m³`,
        table: {
          caption: "Tabla 5 — Pesos húmedos y agua de obra",
          headers: ["Material", "Referencia", "Húmedo"],
          rows: [
            ["Arena", fmt(PAF, 1), fmt(PAFh, 1)],
            ["Grava", fmt(PAG, 1), fmt(PAGh, 1)],
            ["Agua", fmt(A, 1), fmt(Acorr, 1)],
          ],
        },
      },
      {
        n: "06",
        title: "Dosificación en peso y en volumen",
        formula: "Requerido = unitario × V     V = V_elemento (1 + desperdicio)",
        substitution: `V_el = ${fmt(volEl, 3)} m³  ·  desp. ${fmt(desp, 1)} %  →  V = ${fmt(V, 3)} m³`,
        result: `${fmt(C * V, 1)} kg cem  ·  ${fmt(PAFh * V, 1)} kg arena  ·  ${fmt(PAGh * V, 1)} kg grava  ·  ${fmt(Acorr * V, 1)} L`,
        table: {
          caption: "Tabla 6 — Dosificación",
          headers: ["Componente", "Unitario / m³", "Requerido", "Unidad"],
          rows: [
            ["Cemento", fmt(C, 1), fmt(C * V, 1), "kg"],
            ["Arena", fmt(PAFh, 1), fmt(PAFh * V, 1), "kg"],
            ["Grava", fmt(PAGh, 1), fmt(PAGh * V, 1), "kg"],
            ["Agua", fmt(Acorr, 1), fmt(Acorr * V, 1), "L"],
            ["Cemento", fmt(bolsas, 2), fmt(bolsas * V, 2), "bolsas 42.5 kg"],
            ["Arena (vol.)", fmt(FineL, 1), fmt(FineL * V, 1), "L sueltos"],
            ["Grava (vol.)", fmt(GravL, 1), fmt(GravL * V, 1), "L sueltos"],
          ],
        },
      },
    ],
    [
      ok("f'c ≥ 210 en zona sísmica (aviso)", `${fmt(fc, 0)} kg/cm²`, "≥ 210", fc + 1e-9 >= 210),
      ok("C ≥ dosis mínima de servicio", `${fmt(C, 1)} kg`, `≥ ${fmt(Cmin, 0)}`, C + 1e-6 >= Cmin),
      ok("α ≤ tope ambiental", fmt(aAmb, 3), `≤ ${fmt(aMax, 2)}`, aAmb <= aMax + 1e-9),
      ok("Agua de obra positiva", `${fmt(Acorr, 1)} L`, "> 0", Acorr > 20),
    ],
    [
      {
        title: "Cuadro de dosificación por peso (kg) — COVENIN / Walker",
        rows: [
          ["Material", "kg/m³", `kg en ${fmt(V, 3)} m³`, "1 : a : p : w (peso)"],
          ["Cemento", fmt(C, 1), fmt(C * V, 1), "1"],
          ["Arena húmeda", fmt(PAFh, 1), fmt(PAFh * V, 1), fmt(PAFh / C, 2)],
          ["Grava húmeda", fmt(PAGh, 1), fmt(PAGh * V, 1), fmt(PAGh / C, 2)],
          ["Agua de obra", fmt(Acorr, 1), fmt(Acorr * V, 1), fmt(Acorr / C, 2)],
          ["Proporción", "—", "—", `1 : ${fmt(PAFh / C, 2)} : ${fmt(PAGh / C, 2)} : ${fmt(Acorr / C, 2)}`],
        ],
      },
      {
        title: "Cuadro de dosificación por volumen (suelto) — COVENIN / Walker",
        rows: [
          ["Material", "L sueltos / m³", `L en ${fmt(V, 3)} m³`, "1 : a : p : w (volumen)"],
          ["Cemento", fmt(C / 1.4, 1), fmt((C / 1.4) * V, 1), "1"],
          ["Arena húmeda", fmt(FineL, 1), fmt(FineL * V, 1), fmt(FineL / (C / 1.4), 2)],
          ["Grava húmeda", fmt(GravL, 1), fmt(GravL * V, 1), fmt(GravL / (C / 1.4), 2)],
          ["Agua de obra", fmt(Acorr, 1), fmt(Acorr * V, 1), fmt(Acorr / (C / 1.4), 2)],
          ["Proporción", "—", "—", `1 : ${fmt(FineL / (C / 1.4), 2)} : ${fmt(GravL / (C / 1.4), 2)} : ${fmt(Acorr / (C / 1.4), 2)}`],
          ["Bolsas 42.5 kg", fmt(bolsas, 2), fmt(bolsas * V, 2), "—"],
        ],
      },
    ],
    dimsMezcla(C, PAFh, PAGh, Acorr, fc, V),
  );
};

/** DISEÑO DE MEZCLA INVERSO.xls */
export const disenoMezclaInverso: Engine = (raw) => {
  const sacos = num(raw, "sacos", 8);
  const tm = num(raw, "tm", 0.75);
  const fino = str(raw, "fino", "triturada");
  const grueso = str(raw, "grueso", "triturado");
  const T = num(raw, "T", 1);
  const edad = num(raw, "edad", 28);
  const CD = sacos * 42.5;
  const C1f = lookup1(TM, C1, tm);
  const C2f = c2De(fino, grueso);
  const C = CD / (C1f * C2f);
  const alpha = (117.2 * T ** 0.16 / C) ** (1 / 1.3);
  const Kr = lookup1(TM, KR, tm);
  const Ka = kaDe(fino, grueso);
  const alpha0 = alpha / (Kr * Ka);
  const R = rDeAlpha(alpha0, edad);

  return out(
    `${fmt(sacos, 1)} bolsas  ·  C_real = ${fmt(CD, 0)} kg/m³  ·  R ≈ ${fmt(R, 0)} kg/cm² a ${fmt(edad, 0)} d`,
    `α descorregida ${fmt(alpha0, 3)}  ·  C Walker ${fmt(C, 1)} kg/m³`,
    [
      {
        n: "01",
        title: "Dosis real y cemento «descorregido»",
        formula: "C_D = n × 42.5     C = C_D / (C1 · C2)",
        substitution: `${fmt(sacos, 1)} × 42.5 / (${fmt(C1f, 2)} × ${fmt(C2f, 2)})`,
        desarrollo: [
          `C_D = ${fmt(CD, 1)} kg/m³`,
          `C1 (TM ${fmt(tm, 2)}") = ${fmt(C1f, 2)}`,
          `C2 (${fino} / ${grueso}) = ${fmt(C2f, 2)}`,
          `C = ${fmt(CD, 1)} / ${fmt(C1f * C2f, 3)} = ${fmt(C, 2)} kg/m³`,
        ],
        result: `C = ${fmt(C, 1)} kg/m³`,
        table: {
          caption: "Tabla 1 — Cemento inverso",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["Bolsas", fmt(sacos, 1)],
            ["C real C_D", `${fmt(CD, 1)} kg/m³`],
            ["C1", fmt(C1f, 2)],
            ["C2", fmt(C2f, 2)],
            ["C Walker", `${fmt(C, 1)} kg/m³`],
          ],
        },
      },
      {
        n: "02",
        title: "Relación a/c desde el asentamiento",
        formula: "α = [117.2 · T^0.16 / C]^(1/1.3)     α_0 = α / (Kr · Ka)",
        substitution: `T = ${fmt(T, 1)} cm  ·  C = ${fmt(C, 1)}`,
        desarrollo: [
          `α de obra = ${fmt(alpha, 3)}`,
          `Kr = ${fmt(Kr, 2)}    Ka = ${fmt(Ka, 2)}`,
          `α descorregida = ${fmt(alpha, 3)} / ${fmt(Kr * Ka, 3)} = ${fmt(alpha0, 3)}`,
        ],
        result: `α_0 = ${fmt(alpha0, 3)}`,
        table: {
          caption: "Tabla 2 — a/c inversa",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["Asentamiento T", `${fmt(T, 1)} cm`],
            ["α de obra", fmt(alpha, 3)],
            ["Kr", fmt(Kr, 2)],
            ["Ka", fmt(Ka, 2)],
            ["α_0", fmt(alpha0, 3)],
          ],
        },
      },
      {
        n: "03",
        title: "Resistencia media estimada",
        formula: "A 28 d:  α = 3.147 − 0.4625 ln(R)     →     R = exp[(3.147 − α)/0.4625]",
        substitution: `α_0 = ${fmt(alpha0, 3)}  ·  ${fmt(edad, 0)} días`,
        desarrollo: [
          `Se invierte la curva de la hoja Agua–Cemento para la edad ${fmt(edad, 0)} d.`,
          `R = ${fmt(R, 1)} kg/cm²`,
        ],
        result: `R = ${fmt(R, 0)} kg/cm² a ${fmt(edad, 0)} días`,
        note: "Es la resistencia promedio asociada a esa dosis, no f'c especificada.",
        table: {
          caption: "Tabla 3 — Resistencia inversa",
          headers: ["Edad", "Expresión", "R (kg/cm²)"],
          rows: [
            ["7 d", "α = 2.627 − 0.3887 ln R", edad <= 7 ? fmt(R, 1) : "—"],
            ["28 d", "α = 3.147 − 0.4625 ln R", edad > 7 && edad < 90 ? fmt(R, 1) : edad === 28 ? fmt(R, 1) : "—"],
            ["90 d", "α = 3.369 − 0.4896 ln R", edad >= 90 ? fmt(R, 1) : "—"],
            ["Adoptada", `${fmt(edad, 0)} d`, fmt(R, 1)],
          ],
        },
      },
    ],
    [
      ok("C Walker positiva", `${fmt(C, 1)} kg/m³`, "> 150", C > 150),
      ok("α_0 en rango de la curva", fmt(alpha0, 3), "0.30–0.85", alpha0 >= 0.3 && alpha0 <= 0.85),
    ],
    [
      {
        title: "Resumen inverso",
        rows: [
          ["Dato", "Valor"],
          ["Bolsas / m³", fmt(sacos, 1)],
          ["C_D", `${fmt(CD, 1)} kg/m³`],
          ["C Walker", `${fmt(C, 1)} kg/m³`],
          ["α_0", fmt(alpha0, 3)],
          ["R", `${fmt(R, 0)} kg/cm²`],
        ],
      },
    ],
    { C: String(CD), arena: "0", piedra: "0", agua: "0", fc: String(R), vol: "1", bolsas: String(sacos), ra: "0", rp: "0", rw: String(alpha) },
  );
};

/** Ajuste de la Relación Triangular.xls */
export const ajusteTriangular: Engine = (raw) => {
  const fc = num(raw, "fc", 300);
  const T = num(raw, "T", 5);
  const C = num(raw, "C", 350);
  const A = num(raw, "A", 175);
  const Ar = num(raw, "Ar", 167);
  const dA = A - Ar;
  const FV = 1000 / Math.max(1000 - dA, 100);
  const Cc = C * FV;
  const Ac = Ar * FV;
  const ad = A / Math.max(C, 1);
  const ar = Ar / Math.max(Cc, 1);
  const theta = Cc * ar ** 1.3;
  const Creq = theta / ad ** 1.3;
  const Areq = Creq * ad;

  return out(
    `Ajuste triangular  ·  C = ${fmt(Creq, 1)} kg/m³  ·  A = ${fmt(Areq, 1)} L/m³  ·  a/c = ${fmt(ad, 3)}`,
    `Slump ${fmt(T, 1)} cm fijo  ·  Δagua = ${fmt(dA, 1)} L  ·  f'c ref. ${fmt(fc, 0)} kg/cm²`,
    [
      {
        n: "01",
        title: "Desajuste de agua y factor de volumen",
        formula: "ΔA = A − A_r     FV = 1000 / (1000 − ΔA)",
        substitution: `${fmt(A, 1)} − ${fmt(Ar, 1)}`,
        desarrollo: [
          `ΔA = ${fmt(dA, 2)} L`,
          `FV = 1000 / (1000 − ${fmt(dA, 2)}) = ${fmt(FV, 5)}`,
          `C_corr = ${fmt(C, 1)} × ${fmt(FV, 5)} = ${fmt(Cc, 2)} kg/m³`,
          `A_corr = ${fmt(Ar, 1)} × ${fmt(FV, 5)} = ${fmt(Ac, 2)} L/m³`,
        ],
        result: `FV = ${fmt(FV, 4)}     C_corr = ${fmt(Cc, 1)} kg/m³`,
        note: "La primera mezcla debe haberse medido en peso y el slump del cono de Abrams es la referencia fija.",
        table: {
          caption: "Tabla 1 — Corrección de volumen",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["A diseño", `${fmt(A, 1)} L/m³`],
            ["A real", `${fmt(Ar, 1)} L/m³`],
            ["ΔA", `${fmt(dA, 1)} L`],
            ["FV", fmt(FV, 5)],
            ["C corregida", `${fmt(Cc, 1)} kg/m³`],
            ["A corregida", `${fmt(Ac, 1)} L/m³`],
          ],
        },
      },
      {
        n: "02",
        title: "Relación triangular (exponente 1.3)",
        formula: "α_d = A/C     α_r = A_r / C_corr     θ = C_corr · α_r^1.3     C_req = θ / α_d^1.3",
        substitution: `α_d = ${fmt(ad, 3)}  ·  α_r = ${fmt(ar, 3)}`,
        desarrollo: [
          `α_diseño = ${fmt(A, 1)} / ${fmt(C, 1)} = ${fmt(ad, 4)}`,
          `α_real = ${fmt(Ar, 1)} / ${fmt(Cc, 2)} = ${fmt(ar, 4)}`,
          `θ = ${fmt(Cc, 2)} × ${fmt(ar, 4)}^1.3 = ${fmt(theta, 2)}`,
          `C_req = ${fmt(theta, 2)} / ${fmt(ad, 4)}^1.3 = ${fmt(Creq, 2)} kg/m³`,
          `A_req = ${fmt(Creq, 2)} × ${fmt(ad, 4)} = ${fmt(Areq, 2)} L/m³`,
        ],
        result: `C = ${fmt(Creq, 1)} kg/m³     A = ${fmt(Areq, 1)} L/m³     a/c = ${fmt(ad, 3)}`,
        table: {
          caption: "Tabla 2 — Mezcla ajustada",
          headers: ["Dato", "Inicial", "Ajustado"],
          rows: [
            ["Asentamiento", `${fmt(T, 1)} cm`, `${fmt(T, 1)} cm`],
            ["a/c", fmt(ad, 3), fmt(ad, 3)],
            ["Cemento", `${fmt(C, 1)} kg/m³`, `${fmt(Creq, 1)} kg/m³`],
            ["Agua", `${fmt(A, 1)} L/m³`, `${fmt(Areq, 1)} L/m³`],
          ],
        },
      },
    ],
    [
      ok("Agua real medida", `${fmt(Ar, 1)} L`, "> 50", Ar > 50),
      ok("C requerida positiva", `${fmt(Creq, 1)} kg/m³`, "> 150", Creq > 150),
    ],
    [
      {
        title: "Diseño ajustado",
        rows: [
          ["Magnitud", "Valor"],
          ["f'c de referencia", `${fmt(fc, 0)} kg/cm²`],
          ["Asentamiento", `${fmt(T, 1)} cm`],
          ["a/c", fmt(ad, 3)],
          ["Cemento", `${fmt(Creq, 1)} kg/m³`],
          ["Agua", `${fmt(Areq, 1)} L/m³`],
        ],
      },
    ],
    { C: String(Creq), arena: "0", piedra: "0", agua: String(Areq), fc: String(fc), vol: "1", bolsas: String(Creq / 42.5), ra: "0", rp: "0", rw: String(ad) },
  );
};

/** Dosificación de ejecución en obra: baldes de 20 L, f′c y tipo de elemento. */
export const mezclaEjecucion: Engine = (raw) => {
  const el = elemObra(str(raw, "elemento", "vereda"));
  const fc = num(raw, "fc", el.fc);
  const tipo = str(raw, "tipoMezcla", el.tipo) as "concreto" | "hormigon" | "ciclopeo" | "pobre";
  const modo = str(raw, "modoMedida", "proporcion");
  const geom = str(raw, "geom", el.geom);
  const Vbalde = Math.max(5, num(raw, "Vbalde", 20));
  const PUc = num(raw, "PUc", 1400);
  const PUa = num(raw, "PUa", 1450);
  const PUp = num(raw, "PUp", 1500);
  const PUh = num(raw, "PUh", 1600);
  const PEcem = 3150;
  const PEag = 2600;
  const bolsaKg = 42.5;
  const desper = Math.max(0, num(raw, "desper", 5)) / 100;
  const slump = num(raw, "slump", Number(el.slump));
  const acUser = num(raw, "ac", 0);
  const nWuser = num(raw, "nBaldeW", 0);

  let V = Math.max(0.01, num(raw, "vol", 1));
  let geomTxt = `${fmt(V, 3)} m³ ingresados`;
  if (geom === "losa") {
    const L = num(raw, "L", 10);
    const B = num(raw, "B", 1);
    const e = num(raw, "e", Number(el.e));
    V = Math.max(0.01, L * B * e);
    geomTxt = `${fmt(L, 2)} × ${fmt(B, 2)} × ${fmt(e, 3)} m = ${fmt(V, 3)} m³`;
  } else if (geom === "cimiento") {
    const L = num(raw, "L", 12);
    const b = num(raw, "bcim", 0.4);
    const h = num(raw, "hcim", Number(el.e) || 0.4);
    V = Math.max(0.01, L * b * h);
    geomTxt = `${fmt(L, 2)} m × ${fmt(b, 2)} × ${fmt(h, 2)} m = ${fmt(V, 3)} m³`;
  } else if (geom === "zapata") {
    const nZ = Math.max(1, num(raw, "nZap", 1));
    const B = num(raw, "B", 1.2);
    const Lz = num(raw, "Lz", 1.2);
    const e = num(raw, "e", Number(el.e));
    V = Math.max(0.01, nZ * B * Lz * e);
    geomTxt = `${fmt(nZ, 0)} zapatas × ${fmt(B, 2)} × ${fmt(Lz, 2)} × ${fmt(e, 2)} m = ${fmt(V, 3)} m³`;
  }
  const Vobra = V * (1 + desper);

  const VcemSuelto = bolsaKg / Math.max(PUc, 800);
  const esHorm = tipo === "hormigon" || tipo === "pobre" || tipo === "ciclopeo";
  let a = num(raw, "propA", el.a);
  let p = num(raw, "propP", el.p);
  let h = num(raw, "propH", el.h || 8);
  const pg = num(raw, "pctPG", el.pg) / 100;
  if (modo === "baldes") {
    const nA = num(raw, "nBaldeA", esHorm ? 0 : 4);
    const nP = num(raw, "nBaldeP", esHorm ? 0 : 4);
    const nH = num(raw, "nBaldeH", esHorm ? 8 : 0);
    const u = Vbalde / 1000;
    if (esHorm) h = (nH * u) / VcemSuelto;
    else {
      a = (nA * u) / VcemSuelto;
      p = (nP * u) / VcemSuelto;
    }
  }

  const ac = acUser > 0.25 ? acUser : acObra(fc);
  const aguaBolsa = nWuser > 0 ? nWuser * Vbalde : ac * bolsaKg;
  const acReal = aguaBolsa / bolsaKg;

  let Marena = 0;
  let Mpiedra = 0;
  let Mhorm = 0;
  if (esHorm) {
    Mhorm = h * VcemSuelto * PUh;
  } else {
    Marena = a * VcemSuelto * PUa;
    Mpiedra = p * VcemSuelto * PUp;
  }
  const Vabs =
    bolsaKg / PEcem +
    (esHorm ? Mhorm / PEag : Marena / PEag + Mpiedra / PEag) +
    aguaBolsa / 1000 +
    0.018;
  const fracConc = tipo === "ciclopeo" ? Math.max(0.5, 1 - Math.min(0.45, pg)) : 1;
  const Vconc = Vobra * fracConc;
  const Vpg = Vobra - Vconc;
  const nBolsas = Vconc / Math.max(Vabs, 0.02);
  const Ctot = nBolsas * bolsaKg;
  const Atot = nBolsas * aguaBolsa;
  const Ftot = nBolsas * Marena;
  const Gtot = nBolsas * Mpiedra;
  const Htot = nBolsas * Mhorm;
  const PGtot = Vpg * 1600;
  const C_m3 = Ctot / Math.max(Vconc, 0.01);
  const bolsas1 = 1 / Math.max(Vabs, 0.02);
  const Va1 = esHorm ? 0 : a * VcemSuelto * bolsas1;
  const Vp1 = esHorm ? 0 : p * VcemSuelto * bolsas1;
  const Vh1 = esHorm ? h * VcemSuelto * bolsas1 : 0;
  const Vw1 = (aguaBolsa / 1000) * bolsas1;
  const VaTot = Va1 * Vconc;
  const VpTot = Vp1 * Vconc;
  const VhTot = Vh1 * Vconc;
  const VwTot = Vw1 * Vconc;
  const nBalA = (nBolsas * a * VcemSuelto * 1000) / Vbalde;
  const nBalP = (nBolsas * p * VcemSuelto * 1000) / Vbalde;
  const nBalH = (nBolsas * h * VcemSuelto * 1000) / Vbalde;
  const nBalW = Atot / Vbalde;
  const propTxt = esHorm ? `1 : ${fmt(h, 2)} (cemento : hormigón)` : `1 : ${fmt(a, 2)} : ${fmt(p, 2)} (C : arena : piedra)`;
  const tipoNom =
    tipo === "ciclopeo" ? "ciclópeo" : tipo === "hormigon" ? "hormigón de cimientos" : tipo === "pobre" ? "concreto pobre" : "concreto de arena y piedra";

  return out(
    `${el.label}  ·  ${fmt(bolsas1, 2)} bolsas de cemento/m³  ·  total ${fmt(nBolsas, 2)} bolsas  ·  V_obra ${fmt(Vobra, 2)} m³`,
    `${tipoNom}  ·  ${propTxt}  ·  1 m³ → ${fmt(bolsas1, 2)} bolsas de cemento + ${esHorm ? `${fmt(Vh1, 3)} m³ hormigón` : `${fmt(Va1, 3)} m³ arena + ${fmt(Vp1, 3)} m³ piedra`}`,
    [
      {
        n: "01",
        title: "Elemento, calidad y tipo de ejecución",
        formula: "f′c y proporción según el elemento a vaciar (práctica de obra peruana)",
        substitution: `${el.label}  ·  f′c = ${fmt(fc, 0)} kg/cm²  ·  slump ${fmt(slump, 0)} cm`,
        desarrollo: [
          `Tipo de ejecución: ${tipoNom}. Materiales: ${el.materiales}.`,
          el.nota,
          "Calidades frecuentes: solado 100, cimiento corrido y sobrecimiento 140, vereda y piso 175, zapata/columna/viga/losa 210 kg/cm².",
          "Esta memoria es dosificación de ejecución (baldes). No reemplaza un diseño ACI 211 con ensayos de agregados.",
        ],
        result: `${el.label}  ·  ${propTxt}`,
        note: "En cimiento corrido no se separa arena y piedra: se usa hormigón. En vereda, piso y estructura sí se dosifica 1 : arena : piedra.",
        table: {
          caption: "Tabla 1 — Criterio del vaciado",
          headers: ["Dato", "Valor"],
          rows: [
            ["Elemento", el.label],
            ["f′c de obra", `${fmt(fc, 0)} kg/cm²`],
            ["Tipo de ejecución", tipoNom],
            ["Materiales", el.materiales],
            ["Proporción", propTxt],
            ["Asentamiento de referencia", `${fmt(slump, 0)} cm`],
            ["a/c adoptada", fmt(acReal, 2)],
          ],
        },
      },
      {
        n: "02",
        title: "Volumen a vaciar",
        formula: geom === "volumen" ? "V_obra = V (1 + d)" : "V = geometría del elemento    V_obra = V (1 + d)",
        substitution: geomTxt,
        desarrollo: [
          `Volumen geométrico V = ${fmt(V, 3)} m³.`,
          `Desperdicio d = ${fmt(desper * 100, 1)} %.`,
          `V_obra = ${fmt(V, 3)} × (1 + ${fmt(desper, 3)}) = ${fmt(Vobra, 3)} m³.`,
          tipo === "ciclopeo"
            ? `Ciclópeo: concreto ${fmt(fracConc * 100, 0)} % = ${fmt(Vconc, 3)} m³  ·  piedra grande ${fmt(Vpg, 3)} m³.`
            : "Todo el volumen es concreto (o hormigón) dosificado.",
        ],
        result: `V = ${fmt(V, 3)} m³     V_obra = ${fmt(Vobra, 3)} m³`,
        table: {
          caption: "Tabla 2 — Volumen",
          headers: ["Magnitud", "Valor"],
          rows: [
            ["Geometría", geomTxt],
            ["Desperdicio", `${fmt(desper * 100, 1)} %`],
            ["Volumen de obra", `${fmt(Vobra, 3)} m³`],
            ...(tipo === "ciclopeo"
              ? [
                  ["Concreto / hormigón", `${fmt(Vconc, 3)} m³`],
                  ["Piedra grande", `${fmt(Vpg, 3)} m³`],
                ]
              : []),
          ],
        },
      },
      {
        n: "03",
        title: "Tanda de una bolsa y rendimiento",
        formula: "V_cem = 42.5 / PU_c     V_i = n_i · V_cem     V_tanda = Σ V_abs + agua + aire",
        substitution: `1 bolsa = ${fmt(bolsaKg, 1)} kg  ·  PU cemento ${fmt(PUc, 0)} kg/m³  ·  balde ${fmt(Vbalde, 0)} L`,
        desarrollo: [
          `Volumen suelto de 1 bolsa: ${fmt(bolsaKg, 1)} / ${fmt(PUc, 0)} = ${fmt(VcemSuelto * 1000, 1)} L  ≈  ${fmt(VcemSuelto * 1000 / Vbalde, 2)} baldes.`,
          esHorm
            ? `Hormigón suelto = ${fmt(h, 2)} × ${fmt(VcemSuelto * 1000, 1)} L = ${fmt(h * VcemSuelto * 1000, 1)} L  (${fmt(h * VcemSuelto * 1000 / Vbalde, 2)} baldes). Masa ≈ ${fmt(Mhorm, 1)} kg.`
            : `Arena = ${fmt(a, 2)} partes → ${fmt(a * VcemSuelto * 1000, 1)} L (${fmt(a * VcemSuelto * 1000 / Vbalde, 2)} baldes). Piedra = ${fmt(p, 2)} partes → ${fmt(p * VcemSuelto * 1000, 1)} L (${fmt(p * VcemSuelto * 1000 / Vbalde, 2)} baldes).`,
          `Agua por bolsa: ${nWuser > 0 ? `${fmt(nWuser, 1)} baldes × ${fmt(Vbalde, 0)} L` : `a/c ${fmt(ac, 2)} × 42.5 kg`} = ${fmt(aguaBolsa, 1)} L  (${fmt(aguaBolsa / Vbalde, 2)} baldes).`,
          `Rendimiento de 1 bolsa (volúmenes absolutos + 1.8 % de aire) = ${fmt(Vabs, 4)} m³ de concreto fresco.`,
          `Bolsas = ${fmt(Vconc, 3)} / ${fmt(Vabs, 4)} = ${fmt(nBolsas, 2)}.`,
        ],
        result: `1 bolsa rinde ${fmt(Vabs, 3)} m³     se requieren ${fmt(nBolsas, 2)} bolsas de cemento`,
        note: `El cemento se pide en bolsas de ${fmt(bolsaKg, 1)} kg. El balde de ${fmt(Vbalde, 0)} L es solo para arena, piedra u hormigón y para el agua.`,
        table: {
          caption: "Tabla 3 — Tanda de 1 bolsa de cemento",
          headers: ["Material", "Cantidad en la tanda", "Unidad", "Equivalencia"],
          rows: [
            ["Bolsas de cemento", "1", "bolsa de 42.5 kg", `${fmt(bolsaKg, 1)} kg`],
            ...(esHorm
              ? [["Hormigón suelto", fmt(h * VcemSuelto, 3), "m³", `${fmt(h * VcemSuelto * 1000 / Vbalde, 2)} baldes`]]
              : [
                  ["Arena suelta", fmt(a * VcemSuelto, 3), "m³", `${fmt(a * VcemSuelto * 1000 / Vbalde, 2)} baldes`],
                  ["Piedra suelta", fmt(p * VcemSuelto, 3), "m³", `${fmt(p * VcemSuelto * 1000 / Vbalde, 2)} baldes`],
                ]),
            ["Agua", fmt(aguaBolsa, 1), "L", `${fmt(aguaBolsa / Vbalde, 2)} baldes`],
          ],
        },
      },
      {
        n: "04",
        title: "Pedido por 1 m³ de concreto",
        formula: "bolsas/m³ = 1 / V_tanda     ·     m³_suelto/m³ = (partes × V_cem) / V_tanda",
        substitution: `V_tanda = ${fmt(Vabs, 4)} m³/bolsa  →  ${fmt(bolsas1, 2)} bolsas por cada m³ de concreto fresco`,
        desarrollo: [
          `Una bolsa de cemento (42.5 kg) rinde ${fmt(Vabs, 4)} m³. Entonces 1 m³ de concreto pide ${fmt(bolsas1, 2)} bolsas.`,
          esHorm
            ? `Hormigón suelto por m³ = ${fmt(bolsas1, 2)} × ${fmt(h * VcemSuelto, 3)} = ${fmt(Vh1, 3)} m³  (${fmt(Htot / Math.max(Vconc, 0.01), 0)} kg).`
            : `Arena suelta por m³ = ${fmt(bolsas1, 2)} × ${fmt(a * VcemSuelto, 3)} = ${fmt(Va1, 3)} m³.  Piedra suelta por m³ = ${fmt(bolsas1, 2)} × ${fmt(p * VcemSuelto, 3)} = ${fmt(Vp1, 3)} m³.`,
          `Agua por m³ = ${fmt(Vw1 * 1000, 1)} L.`,
          "Estos m³ son de agregado suelto (como se carga en obra), no el volumen absoluto de sólidos.",
        ],
        result: esHorm
          ? `1 m³ → ${fmt(bolsas1, 2)} bolsas de cemento  +  ${fmt(Vh1, 3)} m³ de hormigón  +  ${fmt(Vw1 * 1000, 0)} L de agua`
          : `1 m³ → ${fmt(bolsas1, 2)} bolsas de cemento  +  ${fmt(Va1, 3)} m³ arena  +  ${fmt(Vp1, 3)} m³ piedra  +  ${fmt(Vw1 * 1000, 0)} L agua`,
        note: "El cemento se pide en bolsas de 42.5 kg. Arena, piedra u hormigón se piden en m³ sueltos.",
        table: {
          caption: "Tabla 4 — Materiales para 1 m³ de concreto",
          headers: ["Material", "Por 1 m³", "Unidad de pedido"],
          rows: [
            ["Bolsas de cemento", fmt(bolsas1, 2), "bolsas de 42.5 kg"],
            ...(esHorm
              ? [["Hormigón suelto", fmt(Vh1, 3), "m³"]]
              : [
                  ["Arena suelta", fmt(Va1, 3), "m³"],
                  ["Piedra suelta", fmt(Vp1, 3), "m³"],
                ]),
            ["Agua", fmt(Vw1 * 1000, 1), "L"],
          ],
        },
      },
      {
        n: "05",
        title: "Pedido total = (por m³) × volumen de concreto",
        formula: "Total_i = (cantidad / m³) × V_concreto     ·     V_concreto = V (1+d)  [o la fracción de concreto si es ciclópeo]",
        substitution: `V = ${fmt(V, 3)} m³    d = ${fmt(desper * 100, 1)} %    V_obra = ${fmt(Vobra, 3)} m³    V_concreto = ${fmt(Vconc, 3)} m³`,
        desarrollo: [
          `Bolsas de cemento: ${fmt(bolsas1, 2)} bolsas/m³ × ${fmt(Vconc, 3)} m³ = ${fmt(nBolsas, 2)} bolsas.`,
          esHorm
            ? `Hormigón: ${fmt(Vh1, 3)} m³/m³ × ${fmt(Vconc, 3)} = ${fmt(VhTot, 3)} m³  (${fmt(Htot, 0)} kg · ${fmt(nBalH, 1)} baldes de ${fmt(Vbalde, 0)} L).`
            : `Arena: ${fmt(Va1, 3)} × ${fmt(Vconc, 3)} = ${fmt(VaTot, 3)} m³  (${fmt(Ftot, 0)} kg).  Piedra: ${fmt(Vp1, 3)} × ${fmt(Vconc, 3)} = ${fmt(VpTot, 3)} m³  (${fmt(Gtot, 0)} kg).`,
          `Agua: ${fmt(Vw1 * 1000, 1)} L/m³ × ${fmt(Vconc, 3)} = ${fmt(VwTot * 1000, 1)} L  (${fmt(nBalW, 1)} baldes).`,
          tipo === "ciclopeo" ? `Piedra grande (además del concreto): ${fmt(Vpg, 3)} m³ ≈ ${fmt(PGtot, 0)} kg.` : `El desperdicio ya está dentro de V_obra. Si d = 0, el total coincide con (por m³) × V.`,
        ],
        result: esHorm
          ? `Pedir ${fmt(nBolsas, 2)} bolsas de cemento  +  ${fmt(VhTot, 3)} m³ de hormigón  +  ${fmt(Atot, 0)} L de agua`
          : `Pedir ${fmt(nBolsas, 2)} bolsas de cemento  +  ${fmt(VaTot, 3)} m³ arena  +  ${fmt(VpTot, 3)} m³ piedra  +  ${fmt(Atot, 0)} L agua`,
        note: `Arena, piedra u hormigón también se pueden medir en baldes de ${fmt(Vbalde, 0)} L: ${esHorm ? `${fmt(nBalH, 1)} de hormigón` : `${fmt(nBalA, 1)} de arena y ${fmt(nBalP, 1)} de piedra`}. El cemento no se pide en baldes.`,
        table: {
          caption: "Tabla 5 — Pedido total del vaciado",
          headers: ["Material", "Por 1 m³", `× ${fmt(Vconc, 2)} m³`, "Total a pedir"],
          rows: [
            ["Bolsas de cemento", `${fmt(bolsas1, 2)} bolsas`, `× ${fmt(Vconc, 2)}`, `${fmt(nBolsas, 2)} bolsas`],
            ...(esHorm
              ? [["Hormigón suelto", `${fmt(Vh1, 3)} m³`, `× ${fmt(Vconc, 2)}`, `${fmt(VhTot, 3)} m³`]]
              : [
                  ["Arena suelta", `${fmt(Va1, 3)} m³`, `× ${fmt(Vconc, 2)}`, `${fmt(VaTot, 3)} m³`],
                  ["Piedra suelta", `${fmt(Vp1, 3)} m³`, `× ${fmt(Vconc, 2)}`, `${fmt(VpTot, 3)} m³`],
                ]),
            ["Agua", `${fmt(Vw1 * 1000, 1)} L`, `× ${fmt(Vconc, 2)}`, `${fmt(Atot, 1)} L`],
            ...(tipo === "ciclopeo" ? [["Piedra grande", `${fmt(Vpg / Math.max(Vobra, 0.01), 3)} m³ / m³ obra`, `× ${fmt(Vobra, 2)}`, `${fmt(Vpg, 3)} m³`]] : []),
          ],
        },
      },
    ],
    [
      ok("Volumen de obra", `${fmt(Vobra, 3)} m³`, "> 0", Vobra > 0.01),
      ok("Bolsas de cemento / m³", `${fmt(bolsas1, 2)} bolsas`, "≥ 0.5", bolsas1 >= 0.5),
      ok("Bolsas de cemento (total)", `${fmt(nBolsas, 2)} bolsas`, "≥ 0.5", nBolsas >= 0.5),
      ok("a/c de obra", fmt(acReal, 2), fc >= 210 ? "≤ 0.55" : "≤ 0.80", acReal <= (fc >= 210 ? 0.56 : 0.82)),
      ok("Dosis de cemento", `${fmt(C_m3, 0)} kg/m³`, fc >= 210 ? "≥ 300" : "≥ 180", C_m3 >= (fc >= 210 ? 280 : 170)),
    ],
    [
      {
        title: "Pedido por 1 m³ de concreto",
        rows: [
          ["Material", "Cantidad por 1 m³", "Unidad de pedido"],
          ["Bolsas de cemento", fmt(bolsas1, 2), "bolsas de 42.5 kg"],
          ...(esHorm
            ? [["Hormigón suelto", fmt(Vh1, 3), "m³"]]
            : [
                ["Arena suelta", fmt(Va1, 3), "m³"],
                ["Piedra suelta", fmt(Vp1, 3), "m³"],
              ]),
          ["Agua", fmt(Vw1 * 1000, 1), "L"],
        ],
      },
      {
        title: `Pedido total = (por m³) × ${fmt(Vconc, 2)} m³ de concreto`,
        rows: [
          ["Material", "Por 1 m³", `× ${fmt(Vconc, 2)} m³`, "Total a pedir"],
          ["Bolsas de cemento", `${fmt(bolsas1, 2)} bolsas`, `× ${fmt(Vconc, 2)}`, `${fmt(nBolsas, 2)} bolsas`],
          ...(esHorm
            ? [["Hormigón suelto", `${fmt(Vh1, 3)} m³`, `× ${fmt(Vconc, 2)}`, `${fmt(VhTot, 3)} m³`]]
            : [
                ["Arena suelta", `${fmt(Va1, 3)} m³`, `× ${fmt(Vconc, 2)}`, `${fmt(VaTot, 3)} m³`],
                ["Piedra suelta", `${fmt(Vp1, 3)} m³`, `× ${fmt(Vconc, 2)}`, `${fmt(VpTot, 3)} m³`],
              ]),
          ["Agua", `${fmt(Vw1 * 1000, 1)} L`, `× ${fmt(Vconc, 2)}`, `${fmt(Atot, 1)} L`],
          ...(tipo === "ciclopeo" ? [["Piedra grande", "—", `× ${fmt(Vobra, 2)} obra`, `${fmt(Vpg, 3)} m³`]] : []),
        ],
      },
      {
        title: "Calidades habituales de obra",
        rows: [
          ["Elemento", "f′c", "Ejecución", "Proporción", "Materiales"],
          ["Solado", "100", "Pobre", "1 : 12", "Cemento + hormigón + agua"],
          ["Cimiento corrido", "140", "Hormigón", "1 : 8", "Cemento + hormigón + agua"],
          ["Sobrecimiento", "140", "Ciclópeo", "1 : 8 + 30 % piedra", "Cemento + hormigón + piedra grande + agua"],
          ["Vereda / sardinel", "175", "Concreto", "1 : 2 : 4", "Cemento + arena + piedra + agua"],
          ["Piso / contrapiso", "175", "Concreto", "1 : 2 : 4", "Cemento + arena + piedra + agua"],
          ["Zapata, columna, viga, losa", "210", "Concreto", "1 : 2 : 3", "Cemento + arena + piedra + agua"],
        ],
      },
    ],
    {
      C: String(Ctot),
      arena: String(esHorm ? Htot : Ftot),
      piedra: String(esHorm ? PGtot : Gtot),
      agua: String(Atot),
      fc: String(fc),
      vol: String(Vobra),
      bolsas: String(nBolsas),
      ra: String(esHorm ? h : a),
      rp: String(esHorm ? 0 : p),
      rw: String(acReal),
      tipoMezcla: tipo,
      hormigon: String(Htot),
      piedraG: String(PGtot),
    },
  );
};

export const mezclas: Record<string, Engine> = {
  disenoMezclaAci,
  disenoMezclaWalker,
  disenoMezclaInverso,
  ajusteTriangular,
  mezclaEjecucion,
};
