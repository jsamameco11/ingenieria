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
 * Lechos (E.060: mínimo dos barras corridas arriba y abajo):
 *  — Inferior: todo el lecho, continuo de extremo a extremo, gancho 90° hacia el alma.
 *    Se dibujan dos líneas para leer el par corrido; la marca lleva el n real.
 *  — Superior: dos barras corridas de extremo a extremo. El resto del As de apoyo
 *    (si n > 2) se corta sobre cada columna: 0,30 ℓn + ℓd, sin cruzar el tercio central.
 *  — Temperatura / piel: Ø 1/2" a media altura, únicamente si h ≥ 70 cm (E.060 10.6.7).
 *  — Estribos: trazo fino, de recubrimiento a recubrimiento. Misma escala que la longitud.
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

  const padL = 120;
  const padR = 168;
  const padB = 152;
  const scX = 1080 / Math.max(L, 2);
  const beamHpx = Math.max(hM, 0.25) * scX;
  const stubH = Math.max(14, 0.4 * scX);
  const padT = Math.ceil(stubH + 78);
  const W = Math.ceil(padL + L * scX + padR);
  const H = Math.ceil(padT + beamHpx + padB);
  const beamY = padT;
  const X = (x: number) => padL + x * scX;
  const recPx = Math.max(2.2, (rec / 100) * scX);
  const yMid = beamY + beamHpx / 2;
  const room = beamHpx - 2 * recPx - 2;
  const barGap = Math.max(3.6, Math.min(7, (room - 8) / 2));
  const inset = Math.max(2.1, recPx * 0.35);
  const ySupA = beamY + recPx + inset;
  const ySupB = Math.min(yMid - barGap, ySupA + barGap);
  const yInfA = beamY + beamHpx - recPx - inset;
  const yInfB = Math.max(yMid + barGap, yInfA - barGap);
  const ySupExtra = Math.min(yMid - 1.5, ySupB + barGap);
  const hookOf = (y: number, dbCm: number, toward: "up" | "down") => {
    const target = toward === "up" ? ySupA : yInfA;
    const room = Math.max(4, Math.abs(y - target) - 3.5);
    return Math.min((12 * dbCm) / 100 * scX, room);
  };
  const radOf = (dbCm: number) => Math.max(1.1, Math.min(3.2, (dbCm / 100) * scX * 2));

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

  const xSteel0 = X(0) + recPx;
  const xSteel1 = X(L) - recPx;
  const corrido = (y: number, dbCm: number, toward: "up" | "down") =>
    pathBothHooks90({ x: xSteel0, y }, { x: xSteel1, y }, toward, toward, radOf(dbCm), hookOf(y, dbCm, toward));

  const nInf = Math.max(2, inf.n);
  const nSupRun = 2;
  const nSupExtra = Math.max(0, sup.n - nSupRun);
  const infPaths = [corrido(yInfA, inf.db, "up"), corrido(yInfB, inf.db, "up")];
  const supRunPaths = [corrido(ySupA, sup.db, "down"), corrido(ySupB, sup.db, "down")];

  // Resto del As superior: un corte por apoyo. No invade el tercio central del vano.
  const supPaths: { x: number; y: number }[][] = [];
  if (nSupExtra > 0) {
    for (let i = 1; i < nodes.length - 1; i++) {
      const cx = nodes[i];
      const lnL = Math.max(nodes[i] - nodes[i - 1], 0.4);
      const lnR = Math.max(nodes[i + 1] - nodes[i], 0.4);
      const reachL = Math.min(0.3 * lnL + ldSupM, 0.42 * lnL);
      const reachR = Math.min(0.3 * lnR + ldSupM, 0.42 * lnR);
      const xa = Math.max(recPx / scX, cx - reachL);
      const xb = Math.min(L - recPx / scX, cx + reachR);
      if (xb - xa < 0.25) continue;
      supPaths.push([
        { x: X(xa), y: ySupExtra },
        { x: X(xb), y: ySupExtra },
      ]);
    }
  }

  const showTemp = hCm + 1e-9 >= TEMP_H_MIN_CM;
  const tempDef = barByName(TEMP_BAR);
  const tempPath = showTemp ? corrido(yMid, tempDef.db, "up") : [];

  const estXs = stirrupXs(L, lZona, sAp, sCe);
  const ySt0 = beamY + recPx;
  const ySt1 = beamY + beamHpx - recPx;
  const minStPx = 1.7;
  let lastSt = -1e9;
  const estPaths = estXs
    .filter((x) => {
      const px = X(x);
      if (px - lastSt < minStPx) return false;
      lastSt = px;
      return true;
    })
    .map((x) => [
      { x: X(x), y: ySt0 },
      { x: X(x), y: ySt1 },
    ]);

  const colW = Math.max(8, bM * scX);
  const regions = [
    {
      points: outline,
      fill: "#e8dcc4",
      hatch: true,
    },
    ...colsX.map((x) => ({
      points: ptsStr([
        { x: X(x) - colW / 2, y: beamY - stubH },
        { x: X(x) + colW / 2, y: beamY - stubH },
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
      face: `Cara del suelo · ${nInf} Ø ${inf.bar} · mínimo 2 corridos`,
      bar: inf.bar,
      dbCm: inf.db,
      sCm: 0,
      nReal: nInf,
      qty: `${nInf} Ø`,
      asProv: nInf * inf.as,
      asReq: asInfReq || undefined,
      asUnit: "cm²",
      ldCm: ldInf,
      recCm: rec,
      color: STEEL_FLEX,
      side: "bottom",
      draw: "bar",
      bars: [infPaths[0][Math.floor(infPaths[0].length / 2)]],
      barPath: infPaths[0],
      barPaths: infPaths,
      attach: { x: X(L * 0.22), y: yInfA },
      callout: { x: X(L * 0.22), y: beamY + beamHpx + 46, anchor: "middle" },
    },
    {
      mark: 2,
      name: "Longitudinal superior corrido",
      face: `2 Ø ${sup.bar} de extremo a extremo · el par mínimo del lecho`,
      bar: sup.bar,
      dbCm: sup.db,
      sCm: 0,
      nReal: nSupRun,
      qty: `${nSupRun} Ø`,
      asProv: nSupRun * sup.as,
      asReq: nSupExtra > 0 ? undefined : asSupReq || undefined,
      asUnit: "cm²",
      ldCm: ldSup,
      recCm: rec,
      color: STEEL_DIST,
      side: "top",
      draw: "bar",
      bars: [supRunPaths[0][Math.floor(supRunPaths[0].length / 2)]],
      barPath: supRunPaths[0],
      barPaths: supRunPaths,
      attach: { x: X(L * 0.78), y: ySupA },
      callout: { x: X(L * 0.78), y: beamY - stubH - 44, anchor: "middle" },
    },
    ...(supPaths.length
      ? [
          {
            mark: 3,
            name: "Longitudinal superior en apoyos",
            face: `Adicional de momento negativo · ${nSupExtra} Ø ${sup.bar} · 0,30ℓn + ℓd`,
            bar: sup.bar,
            dbCm: sup.db,
            sCm: 0,
            nReal: nSupExtra,
            qty: `${nSupExtra} Ø`,
            asProv: nSupExtra * sup.as,
            asReq: Math.max(0, (asSupReq || 0) - nSupRun * sup.as) || undefined,
            asUnit: "cm²" as const,
            ldCm: ldSup,
            recCm: rec,
            color: STEEL_DIST,
            side: "top" as const,
            draw: "bar" as const,
            bars: [supPaths[0][Math.floor(supPaths[0].length / 2)]],
            barPath: supPaths[0],
            barPaths: supPaths,
            attach: { x: X(colsX[0] ?? L / 3), y: ySupExtra },
            callout: { x: X(colsX[0] ?? L / 3), y: beamY - stubH - 44, anchor: "middle" as const },
          } satisfies SteelLayer,
        ]
      : []),
    {
      mark: supPaths.length ? 4 : 3,
      name: `Estribos Ø ${estBar}`,
      face: `1@5 + @${sAp} en 2h · @${sCe} al centro`,
      bar: barByName(estBar).name,
      dbCm: estDb,
      sCm: sAp,
      nReal: estXs.length,
      qty: `@${sAp}/${sCe} cm`,
      asProv: (barByName(estBar).as * 2 * 100) / Math.max(sAp, 1),
      asUnit: "cm²/m",
      recCm: rec,
      color: "#1a4473",
      side: "right",
      draw: "bar",
      hair: true,
      bars: estPaths.map((p) => p[0]),
      barPaths: estPaths,
      attach: { x: X(L) - 4, y: yMid },
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
    ...colsX.map((x, i) => ({ x: X(x), y: beamY - stubH - 8, text: `C${i + 1}`, anchor: "middle" as const, fill: "#8b1e1e" })),
    { x: X(0) - 8, y: beamY + beamHpx + 14, text: "0+00", anchor: "end" as const, fill: "#163a63" },
  ];

  const dims = [
    { x1: X(0), y1: beamY + beamHpx + 26, x2: X(L), y2: beamY + beamHpx + 26, label: `L = ${L.toFixed(2)} m`, side: "bottom" as const },
    { x1: X(0) - 36, y1: beamY, x2: X(0) - 36, y2: beamY + beamHpx, label: `h = ${(hCm / 100).toFixed(2)} m`, side: "left" as const },
    ...(colsX[0]
      ? [{ x1: X(0), y1: beamY - 12, x2: X(colsX[0]), y2: beamY - 12, label: `ℓ1 = ${colsX[0].toFixed(2)} m`, side: "top" as const }]
      : []),
  ];

  const tempNote = showTemp
    ? ` Temperatura: 2 Ø ${TEMP_BAR} a media altura porque h = ${hCm} cm ≥ ${TEMP_H_MIN_CM} cm.`
    : ` Sin acero de temperatura: h = ${hCm} cm < ${TEMP_H_MIN_CM} cm.`;

  return {
    title: "ELEVACIÓN — DESPIECE DE VIGA DE CIMENTACIÓN · HOJA A1",
    subtitle: `VC ${bCm}×${hCm} cm · L = ${L.toFixed(2)} m · ${colsX.length} apoyos · estribos verticales`,
    caption: `1  ${nInf}Ø ${inf.bar} inf. corrido   ·   2  2Ø ${sup.bar} sup. corrido${nSupExtra ? `   ·   3  ${nSupExtra}Ø ${sup.bar} sup. en apoyos` : ""}   ·   ${estBar} @ ${sAp}/${sCe} cm${showTemp ? `   ·   temp. 2Ø ${TEMP_BAR}` : ""}   ·   rec ${rec.toFixed(1)} cm`,
    note: `Escala uniforme: el peralte y la longitud usan la misma escala gráfica. En cada lecho van al menos 2 barras corridas de extremo a extremo, con gancho 90°.${nSupExtra ? ` El As superior de apoyo se completa con ${nSupExtra} Ø ${sup.bar} cortados a 0,30ℓn + ℓd, sin entrar al tercio central.` : " El superior de cálculo cabe en las 2 barras corridas."} Estribos en trazo fino, de recubrimiento a recubrimiento.${tempNote} Rec contra suelo ≥ 7,5 cm.`,
    W,
    H,
    sheet: "a1",
    pxPerM: scX,
    lineScale: 0.72,
    markBoxes: true,
    mode: "section",
    footer: "Elevación · escala uniforme",
    layout: "elevation",
    outline,
    cover,
    regions,
    dims,
    layers,
    annos,
  };
}
