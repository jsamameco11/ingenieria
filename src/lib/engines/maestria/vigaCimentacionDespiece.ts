import { barByName } from "../../types";
import {
  pathBothHooks90,
  ptsStr,
  STEEL_DIST,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { ldTension } from "./steel";

/**
 * Motor de renderizado propio de la viga de cimentación (elevación A1).
 * No comparte lógica de planta de losa/zapata ni de cortes de muro.
 *
 * Lechos:
 *  — Inferior: continuo de extremo a extremo (M− entre apoyos), gancho 90° hacia el alma.
 *  — Superior: solo sobre apoyos (L_teo = 0,30 ℓn, capado al tercio de vano). Nunca cruza el
 *    centro del tramo: ahí no hay tracción superior.
 *  — Temperatura / piel: Ø 1/2" a media altura, únicamente si h ≥ 70 cm (E.060 10.6.7).
 *  — Estribos: ticks verticales de recubrimiento a recubrimiento (no puntos a media altura).
 */

const TEMP_H_MIN_CM = 70;
const TEMP_BAR = '1/2"';

function nv(v: Record<string, string>, k: string, fb = 0) {
  const s = String(v[k] ?? "").trim().replace(",", ".");
  if (s === "") return fb;
  const x = Number(s);
  return Number.isFinite(x) ? x : fb;
}
function sv(v: Record<string, string>, k: string, fb = "") {
  return String(v[k] ?? "").trim() || fb;
}
function parseCountBar(text: string, fbN: number, fbBar: string) {
  const nM = String(text || "").match(/(\d+)\s*Ø/i);
  const bM = String(text || "").match(/Ø\s*([^@·]+)/i);
  const bar = (bM?.[1] ?? fbBar).replace(/inf\.|sup\.|cm.*/gi, "").trim() || fbBar;
  const n = nM?.[1] ? Math.max(2, Math.min(8, parseInt(nM[1], 10))) : fbN;
  const def = barByName(bar);
  return { n, bar: def.name, db: def.db, as: def.as };
}
function unpackX(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  const cols: number[] = [];
  try {
    const j = JSON.parse(raw) as { cols?: { x: number }[] };
    if (Array.isArray(j.cols)) for (const c of j.cols) cols.push(Number(c.x) || 0);
  } catch {
    /* texto libre */
  }
  return cols.filter((x) => Number.isFinite(x));
}

function uniqueSorted(xs: number[], L: number) {
  return [...new Set(xs.map((x) => Math.round(x * 100) / 100))]
    .filter((x) => x > 0.08 && x < L - 0.08)
    .sort((a, b) => a - b);
}

function stirrupXs(L: number, lZona: number, sApCm: number, sCeCm: number) {
  const sAp = Math.max(5, sApCm) / 100;
  const sCe = Math.max(sAp, sCeCm) / 100;
  const xs: number[] = [];
  const fill = (a: number, b: number, s: number, first: number) => {
    if (b - a < 0.03) return;
    xs.push(a + 0.005);
    let x = a + first;
    while (x < b - 0.02) {
      xs.push(x);
      x += s;
    }
  };
  fill(0, lZona, sAp, 0.05);
  fill(lZona, Math.max(lZona, L - lZona), sCe, sCe / 2);
  fill(Math.max(lZona, L - lZona), L, sAp, 0.05);
  const seen: number[] = [];
  for (const x of xs) {
    if (!seen.length || Math.abs(x - seen[seen.length - 1]) > 0.02) seen.push(Math.min(L - 0.01, Math.max(0.01, x)));
  }
  return seen;
}

export function buildVigaCimentacionDespieceSpec(values: Record<string, string>): SteelDraftSpec {
  const L = Math.max(nv(values, "Lbeam", nv(values, "L", 12)), 1.5);
  const bM = nv(values, "bBeam", 0.4);
  const hM = nv(values, "hBeam", 0.6);
  const bCm = Math.max(Math.round(bM * 100), 25);
  const hCm = Math.max(Math.round(hM * 100), 40);
  const rec = Math.max(nv(values, "recVC", nv(values, "rec", 7.5)), 4);
  const fy = nv(values, "fy", 4200);
  const fc = nv(values, "fc", 210);
  const inf = parseCountBar(sv(values, "asVCInf", sv(values, "asLong", '3 Ø 3/4"')), 3, '3/4"');
  const sup = parseCountBar(sv(values, "asVCSup", sv(values, "asSup", '2 Ø 1/2"')), 2, '1/2"');
  const asInfReq = nv(values, "AsVCInf", inf.n * inf.as);
  const asSupReq = nv(values, "AsVCSup", sup.n * sup.as);
  const estM = String(sv(values, "estVC", '2Ø 3/8"')).match(/Ø\s*([^@·\s]+)/i);
  const estBar = (estM?.[1] ?? '3/8"').trim() || '3/8"';
  const estDb = barByName(estBar).db;
  const sAp = Math.max(5, nv(values, "sApoyoVC", 10));
  const sCe = Math.max(sAp, nv(values, "sCentroVC", 20));
  const lZona = Math.min(L / 2 - 0.04, Math.max(nv(values, "LzonaVC", 2 * hM), 2 * hM));
  const ldInf = ldTension(fy, fc, inf.db);
  const ldSup = ldTension(fy, fc, sup.db);
  const ldSupM = ldSup / 100;

  let colsX = uniqueSorted(unpackX(sv(values, "vcColsJson")), L);
  if (!colsX.length) {
    const n = Math.max(2, Math.min(5, Math.round(L / 4)));
    colsX = uniqueSorted(
      Array.from({ length: n }, (_, i) => (n === 1 ? L / 2 : (i * L) / (n - 1))),
      L,
    );
  }
  const nodes = [0, ...colsX, L];

  const padL = 92;
  const padR = 176;
  const padT = 108;
  const padB = 118;
  const scX = 1040 / Math.max(L, 2);
  const beamHpx = Math.max(148, Math.min(210, 28 + hCm * 2.35));
  const W = Math.ceil(padL + L * scX + padR);
  const H = Math.ceil(padT + beamHpx + padB);
  const beamY = padT;
  const X = (x: number) => padL + x * scX;
  const recPx = Math.min(beamHpx * 0.16, Math.max(11, (rec / Math.max(hCm, 1)) * beamHpx));
  const yInf = beamY + beamHpx - recPx - 2;
  const ySup = beamY + recPx + 2;
  const yMid = beamY + beamHpx / 2;
  const rInf = Math.min(9, Math.max(4, 0.12 * recPx * inf.db));
  const hHook = Math.min(18, Math.max(9, 0.22 * recPx * inf.db + 6));

  const outline = ptsStr([
    { x: X(0), y: beamY },
    { x: X(L), y: beamY },
    { x: X(L), y: beamY + beamHpx },
    { x: X(0), y: beamY + beamHpx },
  ]);
  const cover = ptsStr([
    { x: X(0) + recPx, y: beamY + recPx },
    { x: X(L) - recPx, y: beamY + recPx },
    { x: X(L) - recPx, y: beamY + beamHpx - recPx },
    { x: X(0) + recPx, y: beamY + beamHpx - recPx },
  ]);

  const infPath = pathBothHooks90(
    { x: X(0) + recPx, y: yInf },
    { x: X(L) - recPx, y: yInf },
    "up",
    "up",
    rInf,
    hHook,
  );

  // Superior: un solo corte por apoyo interior. No invade el tercio central del vano.
  const supPaths: { x: number; y: number }[][] = [];
  for (let i = 1; i < nodes.length - 1; i++) {
    const cx = nodes[i];
    const lnL = Math.max(nodes[i] - nodes[i - 1], 0.4);
    const lnR = Math.max(nodes[i + 1] - nodes[i], 0.4);
    const reachL = Math.min(0.3 * lnL + ldSupM, 0.42 * lnL);
    const reachR = Math.min(0.3 * lnR + ldSupM, 0.42 * lnR);
    const xa = Math.max(recPx / scX, cx - reachL);
    const xb = Math.min(L - recPx / scX, cx + reachR);
    if (xb - xa < 0.25) continue;
    const y = ySup;
    supPaths.push([
      { x: X(xa), y },
      { x: X(xb), y },
    ]);
  }

  const showTemp = hCm + 1e-9 >= TEMP_H_MIN_CM;
  const tempDef = barByName(TEMP_BAR);
  const tempPath = showTemp
    ? pathBothHooks90(
        { x: X(0) + recPx, y: yMid },
        { x: X(L) - recPx, y: yMid },
        "up",
        "up",
        Math.min(6, rInf),
        Math.min(12, hHook),
      )
    : [];

  const estXs = stirrupXs(L, lZona, sAp, sCe);
  const estPaths = estXs.map((x) => [
    { x: X(x), y: ySup },
    { x: X(x), y: yInf },
  ]);

  const colW = Math.max(10, Math.min(22, 0.35 * bCm));
  const regions = [
    {
      points: outline,
      fill: "#e8dcc4",
      hatch: true,
    },
    ...colsX.map((x) => ({
      points: ptsStr([
        { x: X(x) - colW / 2, y: beamY - 36 },
        { x: X(x) + colW / 2, y: beamY - 36 },
        { x: X(x) + colW / 2, y: beamY },
        { x: X(x) - colW / 2, y: beamY },
      ]),
      fill: "#d9c9a8",
      hatch: true,
    })),
  ];

  const layers: SteelLayer[] = [
    {
      mark: 1,
      name: "Longitudinal inferior corrido",
      face: `Cara del suelo · ${inf.n} Ø ${inf.bar}`,
      bar: inf.bar,
      dbCm: inf.db,
      sCm: 0,
      nReal: inf.n,
      qty: `${inf.n} Ø`,
      asProv: inf.n * inf.as,
      asReq: asInfReq || undefined,
      asUnit: "cm²",
      ldCm: ldInf,
      recCm: rec,
      color: STEEL_FLEX,
      side: "bottom",
      draw: "bar",
      bars: [infPath[Math.floor(infPath.length / 2)]],
      barPath: infPath,
      attach: { x: X(L * 0.38), y: yInf },
      callout: { x: X(L * 0.38), y: beamY + beamHpx + 52, anchor: "middle" },
    },
    ...(supPaths.length
      ? [
          {
            mark: 2,
            name: "Longitudinal superior en apoyos",
            face: `Cortes sobre columna · ${sup.n} Ø ${sup.bar} · 0,30ℓn (no al centro)`,
            bar: sup.bar,
            dbCm: sup.db,
            sCm: 0,
            nReal: sup.n,
            qty: `${sup.n} Ø`,
            asProv: sup.n * sup.as,
            asReq: asSupReq || undefined,
            asUnit: "cm²" as const,
            ldCm: ldSup,
            recCm: rec,
            color: STEEL_DIST,
            side: "top" as const,
            draw: "bar" as const,
            bars: [supPaths[0][Math.floor(supPaths[0].length / 2)]],
            barPath: supPaths[0],
            barPaths: supPaths,
            attach: { x: X(colsX[0] ?? L / 3), y: ySup },
            callout: { x: X(colsX[0] ?? L / 3), y: beamY - 50, anchor: "middle" as const },
          } satisfies SteelLayer,
        ]
      : []),
    {
      mark: supPaths.length ? 3 : 2,
      name: `Estribos Ø ${estBar}`,
      face: `1@5 + @${sAp} en 2h · @${sCe} al centro`,
      bar: barByName(estBar).name,
      dbCm: estDb,
      sCm: sAp,
      nReal: estPaths.length,
      qty: `@${sAp}/${sCe} cm`,
      asProv: (barByName(estBar).as * 2 * 100) / Math.max(sAp, 1),
      asUnit: "cm²/m",
      recCm: rec,
      color: "#1a4473",
      side: "right",
      draw: "bar",
      bars: estPaths.map((p) => p[0]),
      barPaths: estPaths,
      attach: { x: X(L) - 8, y: yMid },
      callout: { x: X(L) + 78, y: yMid, anchor: "middle" },
    },
  ];

  if (showTemp && tempPath.length) {
    layers.push({
      mark: layers.length + 1,
      name: "Temperatura / piel",
      face: `h ≥ ${TEMP_H_MIN_CM} cm · 2 Ø ${TEMP_BAR} a media altura`,
      bar: tempDef.name,
      dbCm: tempDef.db,
      sCm: 0,
      nReal: 2,
      qty: `2 Ø`,
      asProv: 2 * tempDef.as,
      asUnit: "cm²",
      recCm: rec,
      color: STEEL_TEMP,
      side: "left",
      draw: "bar",
      bars: [tempPath[Math.floor(tempPath.length / 2)]],
      barPath: tempPath,
      attach: { x: X(L * 0.62), y: yMid },
      callout: { x: X(L * 0.72), y: yMid - 36, anchor: "middle" },
    });
  }

  const annos = [
    ...colsX.map((x, i) => ({ x: X(x), y: beamY - 44, text: `C${i + 1}`, anchor: "middle" as const, fill: "#8b1e1e" })),
    { x: X(0) - 8, y: beamY + beamHpx + 16, text: "0+00", anchor: "end" as const, fill: "#163a63" },
    { x: X(L) + 8, y: beamY + beamHpx + 16, text: `${L.toFixed(2)} m`, anchor: "start" as const, fill: "#163a63" },
  ];

  const dims = [
    { x1: X(0), y1: beamY + beamHpx + 28, x2: X(L), y2: beamY + beamHpx + 28, label: `L = ${L.toFixed(2)} m`, side: "bottom" as const },
    { x1: X(L) + 28, y1: beamY, x2: X(L) + 28, y2: beamY + beamHpx, label: `h = ${hCm} cm`, side: "right" as const },
    ...(colsX[0]
      ? [{ x1: X(0), y1: beamY - 22, x2: X(colsX[0]), y2: beamY - 22, label: `ℓ1 = ${colsX[0].toFixed(2)} m`, side: "top" as const }]
      : []),
    ...(() => {
      const extra: { x1: number; y1: number; x2: number; y2: number; label: string; side: "top"; tiny: true }[] = [];
      if (nodes.length >= 3) {
        const cx = nodes[1];
        const lnR = Math.max(nodes[2] - nodes[1], 0.4);
        const reachR = Math.min(0.3 * lnR + ldSupM, 0.42 * lnR);
        extra.push({
          x1: X(cx),
          y1: ySup - 16,
          x2: X(Math.min(L - recPx / scX, cx + reachR)),
          y2: ySup - 16,
          label: `eje→ext. ${reachR.toFixed(2)} m (L_teo+ℓd)`,
          side: "top",
          tiny: true,
        });
      }
      return extra;
    })(),
  ];

  const tempNote = showTemp
    ? ` Temperatura: 2 Ø ${TEMP_BAR} a media altura porque h = ${hCm} cm ≥ ${TEMP_H_MIN_CM} cm.`
    : ` Sin acero de temperatura: h = ${hCm} cm < ${TEMP_H_MIN_CM} cm.`;

  return {
    title: "ELEVACIÓN — DESPIECE DE VIGA DE CIMENTACIÓN · HOJA A1",
    subtitle: `VC ${bCm}×${hCm} cm · L = ${L.toFixed(2)} m · ${colsX.length} apoyos · estribos verticales`,
    caption: `1  ${inf.n}Ø ${inf.bar} inf. corrido   ·   2  ${sup.n}Ø ${sup.bar} sup. solo en apoyos   ·   ${estBar} @ ${sAp}/${sCe} cm${showTemp ? `   ·   temp. 2Ø ${TEMP_BAR}` : ""}   ·   rec ${rec.toFixed(1)} cm`,
    note: `Viga invertida de extremos libres. Inferior corrido con gancho 90°. Superior únicamente sobre columnas (0,30ℓn, sin entrar al tercio central). Estribos dibujados de canto a canto, no como puntos a media altura.${tempNote} Rec contra suelo ≥ 7,5 cm.`,
    W,
    H,
    sheet: "a1",
    pxPerM: scX,
    lineScale: 0.58,
    markBoxes: true,
    mode: "section",
    outline,
    cover,
    regions,
    dims,
    layers,
    annos,
  };
}
