import { barByName } from "../../types";
import {
  nAlong,
  pathBothHooks90,
  ptsStr,
  STEEL_FLEX,
  STEEL_TEMP,
  type SteelDraftSpec,
  type SteelLayer,
} from "../../steelDraft";
import { ldTension } from "./steel";

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
  const m = String(text || "").match(/(\d+)\s*Ø\s*([^@·]+)/i) ?? String(text || "").match(/Ø\s*([^@·]+)/i);
  const nM = String(text || "").match(/(\d+)\s*Ø/i);
  const bM = String(text || "").match(/Ø\s*([^@·]+)/i);
  const bar = (bM?.[1] ?? fbBar).replace(/inf\.|sup\.|cm.*/gi, "").trim() || fbBar;
  const n = nM?.[1] ? Math.max(2, Math.min(8, parseInt(nM[1], 10))) : fbN;
  void m;
  return { n, bar: barByName(bar).name, db: barByName(bar).db, as: barByName(bar).as };
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

/**
 * Motor de renderizado dedicado — despiece de viga de cimentación (elevación A1).
 * Lee el cuadro del motor de cálculo (asVCInf / asVCSup / estVC / sApoyoVC /
 * sCentroVC / LzonaVC / Lbeam / bBeam / hBeam / vcColsJson) y dibuja la viga
 * en elevación: inferior corrido, superior cortado L_teo+ℓd sobre apoyos y
 * estribos con zona densa 2h + 1@5 cm. Trazo fino profesional.
 */
export function buildVigaCimentacionDespieceSpec(values: Record<string, string>): SteelDraftSpec {
  const L = Math.max(nv(values, "Lbeam", nv(values, "L", 12)), 1.5);
  const bM = nv(values, "bBeam", 0.4);
  const hM = nv(values, "hBeam", 0.6);
  const bCm = Math.max(Math.round(bM * 100), 25);
  const hCm = Math.max(Math.round(hM * 100), 40);
  const rec = nv(values, "recVC", nv(values, "rec", 4));
  const fy = nv(values, "fy", 4200);
  const fc = nv(values, "fc", 210);
  const inf = parseCountBar(sv(values, "asVCInf", sv(values, "asLong", '3 Ø 3/4"')), 3, '3/4"');
  const sup = parseCountBar(sv(values, "asVCSup", sv(values, "asSup", '2 Ø 1/2"')), 2, '1/2"');
  const estM = String(sv(values, "estVC", '2Ø 3/8"')).match(/Ø\s*([^@·\s]+)/i);
  const estBar = (estM?.[1] ?? '3/8"').trim() || '3/8"';
  const estDb = barByName(estBar).db;
  const sAp = Math.max(5, nv(values, "sApoyoVC", 10));
  const sCe = Math.max(sAp, nv(values, "sCentroVC", 20));
  const lZona = Math.min(L / 2 - 0.05, Math.max(nv(values, "LzonaVC", 2 * hM), 2 * hM));
  const ldInf = ldTension(fy, fc, inf.db);
  const ldSup = ldTension(fy, fc, sup.db);

  let colsX = unpackX(sv(values, "vcColsJson")).filter((x) => x > 0.05 && x < L - 0.05);
  colsX = [...new Set(colsX.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
  if (!colsX.length) {
    const n = Math.max(2, Math.min(6, Math.round(L / 4)));
    colsX = Array.from({ length: n }, (_, i) => (n === 1 ? L / 2 : (i * L) / (n - 1)));
  }

  // Geometría de hoja: viga horizontal con aire para llamadas DENTRO del borde.
  const padL = 110;
  const padR = 150;
  const padT = 120;
  const padB = 130;
  const scX = 980 / Math.max(L, 2);
  const scY = 300 / Math.max(hM, 0.4);
  const sc = Math.min(scX, scY);
  const W = Math.ceil(padL + L * sc + padR);
  const H = Math.ceil(padT + hM * sc + padB);
  const beamY = padT;
  const beamHpx = hM * sc;
  const X = (x: number) => padL + x * sc;
  const recPx = Math.min(14, Math.max(6, (rec / 100) * sc));
  const rBar = Math.min(7, Math.max(3.2, 2.2 * (inf.db / 100) * sc));
  const hBar = Math.min(15, Math.max(7, 5.5 * (inf.db / 100) * sc));
  const rSup = Math.min(7, Math.max(3.2, 2.2 * (sup.db / 100) * sc));
  const hSup = Math.min(15, Math.max(7, 5.5 * (sup.db / 100) * sc));

  const outline = ptsStr([
    { x: X(0), y: beamY },
    { x: X(L), y: beamY },
    { x: X(L), y: beamY + beamHpx },
    { x: X(0), y: beamY + beamHpx },
  ]);

  // Inferior corrido (2–3 líneas representativas según n).
  const yInf = beamY + beamHpx - recPx - 3;
  const infPaths: { x: number; y: number }[][] = [];
  const kInf = Math.min(inf.n, 3);
  for (let i = 0; i < kInf; i++) {
    const y = yInf - i * 5;
    infPaths.push(pathBothHooks90({ x: X(0) + recPx, y }, { x: X(L) - recPx, y }, "up", "up", rBar, hBar));
  }
  // Superior cortado: un segmento por vano/apoyo (L_teo 0.30ℓn + ℓd).
  const ySup = beamY + recPx + 3;
  const supPaths: { x: number; y: number }[][] = [];
  const bounds = [0, ...colsX, L];
  for (let i = 0; i < bounds.length - 1; i++) {
    const ln = Math.max(bounds[i + 1] - bounds[i], 0.5);
    const cut = 0.3 * ln + ldSup / 100;
    for (const cx of [bounds[i], bounds[i + 1]]) {
      if (cx <= 0.01 || cx >= L - 0.01) {
        const xa = cx <= 0.01 ? recPx / sc : Math.max(recPx / sc, cx - cut);
        const xb = cx <= 0.01 ? Math.min(L - recPx / sc, cx + cut) : L - recPx / sc;
        if (xb - xa < 0.3) continue;
        supPaths.push(
          pathBothHooks90({ x: X(xa), y: ySup + (supPaths.length % 2) * 5 }, { x: X(xb), y: ySup + (supPaths.length % 2) * 5 }, "down", "down", rSup, hSup),
        );
      } else {
        const xa = Math.max(recPx / sc, cx - cut);
        const xb = Math.min(L - recPx / sc, cx + cut);
        if (xb - xa < 0.3) continue;
        supPaths.push(
          pathBothHooks90({ x: X(xa), y: ySup + (supPaths.length % 2) * 5 }, { x: X(xb), y: ySup + (supPaths.length % 2) * 5 }, "down", "down", rSup, hSup),
        );
      }
    }
  }

  // Estribos: ticks verticales — densos en ℓzona de cada extremo, ralos al centro.
  const stirrups: { x: number }[] = [];
  const pushZone = (x0: number, x1: number, sCm: number, firstAt = 0.05) => {
    if (x1 - x0 <= 0.02) return;
    let x = x0 + firstAt;
    stirrups.push({ x: x0 + 0.001 });
    while (x < x1 - 0.02) {
      stirrups.push({ x });
      x += sCm / 100;
    }
  };
  pushZone(0, lZona, sAp);
  pushZone(lZona, L - lZona, sCe, sCe / 100 / 2);
  pushZone(L - lZona, L, sAp);
  const estBars = stirrups.map((s) => ({ x: X(s.x), y: beamY + beamHpx / 2 }));

  const nInfReal = inf.n;
  const nSupReal = sup.n;
  const layers: SteelLayer[] = [
    {
      mark: 1, name: "Longitudinal inferior corrido", face: `M− cara del suelo · ${inf.n} Ø ${inf.bar}`,
      bar: inf.bar, dbCm: inf.db, sCm: 0, nReal: nInfReal,
      asProv: inf.n * inf.as, asUnit: "cm²", ldCm: ldInf, recCm: rec,
      color: STEEL_FLEX, side: "bottom", draw: "bar", bars: [infPaths[0]?.[Math.floor((infPaths[0]?.length ?? 1) / 2)] ?? { x: X(L / 2), y: yInf }],
      barPath: infPaths[0], barPaths: infPaths,
      attach: { x: X(L / 2), y: yInf },
      callout: { x: X(L / 2), y: beamY + beamHpx + 46, anchor: "middle" },
    },
    {
      mark: 2, name: "Longitudinal superior (cortes)", face: `M+ vuelos · ${sup.n} Ø ${sup.bar} · L_teo + ℓd`,
      bar: sup.bar, dbCm: sup.db, sCm: 0, nReal: nSupReal,
      asProv: sup.n * sup.as, asUnit: "cm²", ldCm: ldSup, recCm: rec,
      color: STEEL_TEMP, side: "top", draw: "bar", bars: [supPaths[0]?.[Math.floor((supPaths[0]?.length ?? 1) / 2)] ?? { x: X(L / 2), y: ySup }],
      barPath: supPaths[0], barPaths: supPaths,
      attach: { x: X(L / 2), y: ySup },
      callout: { x: X(L / 2), y: beamY - 46, anchor: "middle" },
    },
    {
      mark: 3, name: `Estribos ${estBar}`, face: `1@5 + ${Math.round(nAlong(lZona * 100, sAp))}@${sAp} en 2h + resto@${sCe}`,
      bar: barByName(estBar).name, dbCm: estDb, sCm: sAp, nReal: estBars.length,
      asProv: (barByName(estBar).as * 2 * 100) / Math.max(sAp, 1), asUnit: "cm²/m", recCm: rec,
      color: "#1a4473", side: "right", draw: "dots", bars: estBars,
      attach: estBars[Math.floor(estBars.length / 2)] ?? { x: X(L / 2), y: beamY + beamHpx / 2 },
      callout: { x: X(L) + 18, y: beamY + beamHpx / 2, anchor: "start" },
    },
  ];

  const annos = [
    ...colsX.map((x, i) => ({ x: X(x), y: beamY - 14, text: `C${i + 1}`, anchor: "middle" as const, fill: "#8b1e1e" })),
    { x: X(0) - 10, y: beamY + beamHpx / 2 + 4, text: "0+00", anchor: "end" as const, fill: "#163a63" },
    { x: X(L) + 10, y: beamY + beamHpx / 2 + 4, text: `L=${L.toFixed(2)}`, anchor: "start" as const, fill: "#163a63" },
  ];

  return {
    title: "ELEVACIÓN — DESPIECE DE VIGA DE CIMENTACIÓN · HOJA A1",
    subtitle: `VC ${bCm}×${hCm} cm · L = ${L.toFixed(2)} m · ${colsX.length} apoyos · estribos con zona 2h`,
    caption: `1 ${inf.n}Ø ${inf.bar} corrido inf. (ℓd ${ldInf.toFixed(0)} cm)   ·   2 ${sup.n}Ø ${sup.bar} sup. L_teo+ℓd (ℓd ${ldSup.toFixed(0)} cm)   ·   3 Ø ${estBar} ${sv(values, "estVC", "").includes("@") ? sv(values, "estVC") : `1@5+${sAp}/r@${sCe}`}   ·   rec ${rec.toFixed(1)} cm`,
    note: "Viga invertida de extremos libres: inferior corrido de borde a borde con gancho 90°; superior cortado sobre cada apoyo (0,30ℓn + ℓd). Estribos: primer estribo a 5 cm, zona densa 2h en cada extremo (E.060 21.3.3), resto al centro. Rec contra suelo ≥ 7,5 cm.",
    W, H, sheet: "a1", pxPerM: sc, lineScale: 0.6, markBoxes: false,
    outline,
    dims: [
      { x1: X(0), y1: beamY + beamHpx + 24, x2: X(L), y2: beamY + beamHpx + 24, label: `L = ${L.toFixed(2)} m`, side: "bottom" },
      { x1: X(L) + 26, y1: beamY, x2: X(L) + 26, y2: beamY + beamHpx, label: `h = ${hCm} cm`, side: "right" },
      { x1: X(0), y1: beamY - 30, x2: X(colsX[0] ?? L / 2), y2: beamY - 30, label: `ℓ1 = ${(colsX[0] ?? L / 2).toFixed(2)} m`, side: "top" },
    ],
    layers, annos,
  };
}
