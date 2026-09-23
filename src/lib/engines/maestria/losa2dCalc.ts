import { coefAci3 } from "../../steelEngine";
import { fmt, num, str, type Engine } from "../../types";
import { packPts, solveStrip, type SpanLoad } from "./matrixBeam";
import { designSlabFace, emptySlabFace, applyMeshPick, ldTension, losaNegBarM, ok, out, pickSlabBar, pickMeshFamily, step, type LosaNegCutSrc, type SlabFace } from "./steel";
import {
  adoptRoofIfEmpty,
  edgeLabel,
  exampleModel,
  extent,
  identifyLosa,
  nxOf,
  nyOf,
  plantReady,
  resolveMaeModel,
  type IdentifiedPane,
  type IdentifiedStrip,
  type LosaRelleno,
  type LosaTipo,
  type MaeModel,
} from "./types";

function marcusPos(wu: number, lx: number, ly: number) {
  return {
    Mx: wu * lx * lx * (1 / (8 * (1 + (lx / Math.max(ly, 0.05)) ** 4))),
    My: wu * ly * ly * (1 / (8 * (1 + (ly / Math.max(lx, 0.05)) ** 4))),
  };
}

function ddmShare(caso: string) {
  if (caso === "cccc") return { n: 0.65, p: 0.35, nE: 0.65 };
  if (caso === "cccd") return { n: 0.7, p: 0.5, nE: 0.26 };
  if (caso === "ccdd") return { n: 0.75, p: 0.5, nE: 0.26 };
  if (caso === "cddd") return { n: 0.75, p: 0.52, nE: 0.16 };
  return { n: 0, p: 1, nE: 0 };
}

function hMinAci(ln: number, fy: number, exterior: boolean, aligerada: boolean) {
  if (aligerada) return Math.max(17, (ln * 100) / 25);
  const f = 0.8 + fy / 14000;
  const den = exterior ? 33 : 36;
  return Math.max(12, (ln * 100 * f) / den);
}

export function pesoLosaProfesional(opts: {
  tipo: LosaTipo;
  hCm: number;
  sCm?: number;
  bwCm?: number;
  hfCm?: number;
  relleno?: LosaRelleno;
}): { pp: number; vConc: number; detalle: string[] } {
  const hCm = Math.max(8, opts.hCm);
  const e = hCm / 100;
  if (opts.tipo !== "aligerada") {
    const pp = 2400 * e;
    return {
      pp,
      vConc: e,
      detalle: [`Maciza: γc × h = 2400 kg/m³ × ${fmt(e, 2)} m = ${fmt(pp, 0)} kg/m²`],
    };
  }
  const sCm = Math.max(25, opts.sCm ?? 40);
  const bwCm = Math.max(8, opts.bwCm ?? 10);
  const hfCm = Math.max(4, opts.hfCm ?? 5);
  const s = sCm / 100;
  const bw = bwCm / 100;
  const hf = hfCm / 100;
  const vConc = (bw / s) * e + (1 - bw / s) * hf;
  const ppConc = 2400 * vConc;
  const hLadr = Math.max(e - hf, 0.08);
  const vFill = (1 - bw / s) * hLadr;
  const relleno = opts.relleno === "eps" ? "eps" : "ladrillo";
  const ppFill = relleno === "eps" ? 15 : 900 * vFill;
  const pp = ppConc + ppFill;
  return {
    pp,
    vConc,
    detalle: [
      `Aligerada Perú: e=${fmt(hCm, 0)} cm  ·  entre-eje s=${fmt(sCm, 0)} cm  ·  nervio bw=${fmt(bwCm, 0)} cm  ·  loseta hf=${fmt(hfCm, 0)} cm  ·  ${relleno === "eps" ? "EPS" : "ladrillo hueco"}`,
      `Vconc/m² = (bw/s)·e + (1−bw/s)·hf = (${fmt(bw, 2)}/${fmt(s, 2)})·${fmt(e, 2)} + ${fmt(1 - bw / s, 2)}·${fmt(hf, 2)} = ${fmt(vConc, 4)} m³/m²`,
      `pp concreto = 2400 × ${fmt(vConc, 4)} = ${fmt(ppConc, 0)} kg/m²`,
      relleno === "eps"
        ? `pp EPS ≈ 15 kg/m² (bloque ligero, no el peso de maciza)`
        : `pp ladrillo = 900 kg/m³ × ${fmt(vFill, 4)} m³/m² = ${fmt(ppFill, 0)} kg/m²`,
      `pp losa = ${fmt(ppConc, 0)} + ${fmt(ppFill, 0)} = ${fmt(pp, 0)} kg/m²  (maciza habría sido ${fmt(2400 * e, 0)} kg/m²)`,
    ],
  };
}

function modelFromRaw(raw: Record<string, string>) {
  if (raw.studioJson?.trim()) {
    const resolved = resolveMaeModel(raw, "losa");
    const adopted = adoptRoofIfEmpty(resolved.model);
    return {
      model: adopted.model,
      usedExample: resolved.usedExample,
      pending: false,
      adoptedRoof: adopted.adopted,
    };
  }
  if (raw.gridJson?.trim()) {
    try {
      const j = JSON.parse(raw.gridJson) as { axesX?: number[]; axesY?: number[]; panes?: boolean[][] };
      const fb = exampleModel("losa");
      if (Array.isArray(j.axesX) && j.axesX.length >= 2) fb.axesX = j.axesX.map(Number);
      if (Array.isArray(j.axesY) && j.axesY.length >= 2) fb.axesY = j.axesY.map(Number);
      const nx2 = fb.axesX.length - 1;
      const ny2 = fb.axesY.length - 1;
      fb.cells = Array.from({ length: ny2 }, (_, iy) =>
        Array.from({ length: nx2 }, (_, ix) => j.panes?.[iy]?.[ix] !== false),
      );
      fb.mergeH = Array.from({ length: ny2 }, () => Array.from({ length: nx2 }, () => false));
      fb.mergeV = Array.from({ length: ny2 }, () => Array.from({ length: nx2 }, () => false));
      fb.axisXKind = Array.from({ length: nx2 + 1 }, () => "viga");
      fb.axisYKind = Array.from({ length: ny2 + 1 }, () => "viga");
      const adopted = adoptRoofIfEmpty(fb);
      if (plantReady(adopted.model, "losa")) {
        return { model: adopted.model, usedExample: false, pending: false, adoptedRoof: adopted.adopted };
      }
    } catch {
      /* fallback */
    }
  }
  const resolved = resolveMaeModel(raw, "losa");
  const adopted = adoptRoofIfEmpty(resolved.model);
  return {
    model: adopted.model,
    usedExample: resolved.usedExample,
    pending: false,
    adoptedRoof: adopted.adopted,
  };
}

function tipoOf(raw: Record<string, string>): LosaTipo {
  return str(raw, "tipoLosa", "maciza") === "aligerada" ? "aligerada" : "maciza";
}

function stripLoads(st: IdentifiedStrip, m: MaeModel, wu: number, dir: "x" | "y"): { spans: SpanLoad[]; supportV: boolean[]; supportTh: boolean[] } {
  const kinds = dir === "x" ? m.axisXKind : m.axisYKind;
  const spans: SpanLoad[] = st.spans.map((L) => ({ L, w: wu * st.b }));
  const nodes = st.nodes?.length === st.spans.length + 1
    ? st.nodes
    : Array.from({ length: st.spans.length + 1 }, (_, i) => st.i0 + i);
  const supportV: boolean[] = [];
  const supportTh: boolean[] = [];
  for (const k of nodes) {
    const kind = kinds[k] ?? "viga";
    supportV.push(kind !== "libre");
    supportTh.push(kind === "muro");
  }
  while (supportV.length < spans.length + 1) {
    supportV.push(true);
    supportTh.push(false);
  }
  return { spans, supportV, supportTh };
}

type PaneSteel = {
  id: string;
  infX: SlabFace;
  infY: SlabFace;
  supX: SlabFace;
  supY: SlabFace;
};

export type LosaNegSide = {
  Lteo: number;
  Lext: number;
  Lbar: number;
  src: LosaNegCutSrc;
  edge: boolean;
};

export type LosaNegLen = {
  ln: number;
  db: number;
  dCm: number;
  twelveDb: number;
  ln16: number;
  Lext: number;
  gov: string;
  L: LosaNegSide;
  R: LosaNegSide;
};

function sideOf(Lteo: number, src: LosaNegCutSrc, edge: boolean, db: number, dCm: number, ln: number, rec: number, hasNeg: boolean): LosaNegSide {
  if (!hasNeg) return { Lteo: 0, Lext: 0, Lbar: 0, src, edge };
  const cut = losaNegBarM({ LteoM: Lteo, dbCm: db, dCm, lnM: ln, recCm: rec, edge, src, capRatio: 0.3 });
  return { Lteo, Lext: cut.LextM, Lbar: cut.LbarM, src, edge };
}

export const calcLosa2d: Engine = (raw) => {
  const { model: m, usedExample, adoptedRoof } = modelFromRaw(raw);
  const tipo = tipoOf(raw);
  const h = num(raw, "h", tipo === "aligerada" ? 20 : 15);
  const rec = num(raw, "rec", 2.5);
  const fy = num(raw, "fy", 4200);
  const fc = num(raw, "fc", 210);
  const cv = num(raw, "cv", 250);
  const acab = num(raw, "acab", 100);
  const tab = num(raw, "tab", tipo === "aligerada" ? 150 : 0);
  const sAli = num(raw, "sAli", 40);
  const bwAli = num(raw, "bwAli", 10);
  const hfAli = num(raw, "hfAli", 5);
  const peso = pesoLosaProfesional({
    tipo,
    hCm: h,
    sCm: sAli,
    bwCm: bwAli,
    hfCm: hfAli,
    relleno: str(raw, "relleno", "ladrillo") === "eps" ? "eps" : "ladrillo",
  });
  const Duse = peso.pp + acab + tab;
  const wuKg = 1.4 * Duse + 1.7 * cv;
  const wu = wuKg / 1000;
  const found = identifyLosa(m, tipo);
  const { panes, strips, voids, posRuns, negCuts } = found;
  const ext = extent(m);

  type Row = IdentifiedPane & {
    MuCneg: number;
    MuCpos: number;
    MuLneg: number;
    MuLpos: number;
    MxPosM: number;
    MyPosM: number;
    M0x: number;
    M0y: number;
    posX: number;
    negX: number;
    posY: number;
    negY: number;
  };
  const rows: Row[] = [];
  let lnMax = 0;
  let exterior = false;

  for (const p of panes) {
    const k = coefAci3(p.caso);
    const ln = Math.min(p.lx, p.ly);
    lnMax = Math.max(lnMax, Math.max(p.lx, p.ly));
    const MuCneg = k.nC * wu * ln * ln;
    const MuCpos = k.pC * wu * ln * ln;
    const MuLneg = k.nL * wu * ln * ln;
    const MuLpos = k.pL * wu * ln * ln;
    const mar = marcusPos(wu, p.lx, p.ly);
    const ddm = ddmShare(p.caso);
    const M0x = (wu * p.lx * p.lx * p.ly) / 8;
    const M0y = (wu * p.ly * p.ly * p.lx) / 8;
    const xIsShort = p.lx <= p.ly + 1e-6;
    const posX = Math.max(xIsShort ? MuCpos : MuLpos, mar.Mx * (ddm.p > 0.4 ? 0.7 : 1), (ddm.p * M0x) / Math.max(p.ly, 0.5));
    const negX = Math.max(xIsShort ? MuCneg : MuLneg, (ddm.n * M0x) / Math.max(p.ly, 0.5));
    const posY = Math.max(xIsShort ? MuLpos : MuCpos, mar.My * (ddm.p > 0.4 ? 0.7 : 1), (ddm.p * M0y) / Math.max(p.lx, 0.5));
    const negY = Math.max(xIsShort ? MuLneg : MuCneg, (ddm.n * M0y) / Math.max(p.lx, 0.5));
    if (p.edges.L === "libre" || p.edges.R === "libre" || p.edges.B === "libre" || p.edges.T === "libre") exterior = true;
    if (p.edges.L === "discontinuo" || p.edges.R === "discontinuo" || p.edges.B === "discontinuo" || p.edges.T === "discontinuo") exterior = true;
    rows.push({
      ...p,
      MuCneg,
      MuCpos,
      MuLneg,
      MuLpos,
      MxPosM: mar.Mx,
      MyPosM: mar.My,
      M0x,
      M0y,
      posX,
      negX,
      posY,
      negY,
    });
  }

  const stripFigs: { title: string; pts: string; L: number; MuPos: number; MuNeg: number }[] = [];
  const posXByPane = new Map<string, number>();
  const negXByPane = new Map<string, number>();
  const posYByPane = new Map<string, number>();
  const negYByPane = new Map<string, number>();
  for (const r of rows) {
    posXByPane.set(r.id, r.posX);
    negXByPane.set(r.id, r.negX);
    posYByPane.set(r.id, r.posY);
    negYByPane.set(r.id, r.negY);
  }

  for (const st of strips) {
    const loads = stripLoads(st, m, wu, st.dir);
    const solved = solveStrip(loads.spans, loads.supportV, loads.supportTh);
    const b = Math.max(st.b, 0.3);
    stripFigs.push({
      title: `${st.id}  ·  b trib. ${fmt(st.b, 2)} m`,
      pts: packPts(solved.pts),
      L: st.spans.reduce((s, L) => s + L, 0),
      MuPos: Math.max(solved.Mmax, 0),
      MuNeg: Math.max(-solved.Mmin, 0),
    });
    const mPos = Math.max(solved.Mmax, 0) / b;
    const mNeg = Math.max(-solved.Mmin, 0) / b;
    for (const id of st.paneIds) {
      if (st.dir === "x") {
        posXByPane.set(id, Math.max(posXByPane.get(id) ?? 0, mPos));
        negXByPane.set(id, Math.max(negXByPane.get(id) ?? 0, mNeg));
      } else {
        posYByPane.set(id, Math.max(posYByPane.get(id) ?? 0, mPos));
        negYByPane.set(id, Math.max(negYByPane.get(id) ?? 0, mNeg));
      }
    }
  }

  const dX = Math.max(h - rec - 0.5, 6);
  const dY = Math.max(dX - 1, 5);
  const aligerada = tipo === "aligerada";
  const faceOf = (Mu: number, dCm: number, perRib: boolean) =>
    designSlabFace({ Mu, dCm, fc, fy, hCm: h, perRib, sAli, bwCm: bwAli });
  const steels: PaneSteel[] = rows.map((r) => {
    const MuPosX = posXByPane.get(r.id) ?? r.posX;
    const hasBeamX = r.edges.L !== "libre" || r.edges.R !== "libre";
    const hasBeamY = r.edges.B !== "libre" || r.edges.T !== "libre";
    const MuNegX = hasBeamX ? negXByPane.get(r.id) ?? r.negX : 0;
    const MuPosY = posYByPane.get(r.id) ?? r.posY;
    const MuNegY = hasBeamY ? negYByPane.get(r.id) ?? r.negY : 0;
    return {
      id: r.id,
      infX: faceOf(MuPosX, dX, aligerada),
      infY: faceOf(MuPosY, dY, aligerada),
      supX: hasBeamX ? faceOf(MuNegX, dX, false) : emptySlabFace(dX),
      supY: hasBeamY ? faceOf(MuNegY, dY, false) : emptySlabFace(dY),
    };
  });
  if (!aligerada && steels.length) {
    const infX = pickMeshFamily(steels.map((s) => s.infX.As), h);
    const infY = pickMeshFamily(steels.map((s) => s.infY.As), h);
    const supX = pickMeshFamily(steels.map((s) => s.supX.As), h);
    const supY = pickMeshFamily(steels.map((s) => s.supY.As), h);
    steels.forEach((s, i) => {
      s.infX = applyMeshPick(s.infX, infX[i]);
      s.infY = applyMeshPick(s.infY, infY[i]);
      s.supX = s.supX.As <= 1e-8 ? emptySlabFace(dX) : applyMeshPick(s.supX, supX[i]);
      s.supY = s.supY.As <= 1e-8 ? emptySlabFace(dY) : applyMeshPick(s.supY, supY[i]);
    });
  } else if (steels.length) {
    const supX = pickMeshFamily(steels.map((s) => s.supX.As), h);
    const supY = pickMeshFamily(steels.map((s) => s.supY.As), h);
    steels.forEach((s, i) => {
      s.supX = s.supX.As <= 1e-8 ? emptySlabFace(dX) : applyMeshPick(s.supX, supX[i]);
      s.supY = s.supY.As <= 1e-8 ? emptySlabFace(dY) : applyMeshPick(s.supY, supY[i]);
    });
  }

  const isEdge = (k: IdentifiedPane["edges"]["L"]) => k === "libre" || k === "discontinuo";
  const negLens = new Map<string, { x: LosaNegLen; y: LosaNegLen }>();
  const buildNeg = (row: (typeof rows)[number], face: SlabFace, dir: "x" | "y"): LosaNegLen => {
    const ln = dir === "x" ? row.lx : row.ly;
    const has = face.As > 1e-8;
    const edgeL = dir === "x" ? isEdge(row.edges.L) : isEdge(row.edges.B);
    const edgeR = dir === "x" ? isEdge(row.edges.R) : isEdge(row.edges.T);
    const srcL: LosaNegCutSrc = "anclaje";
    const srcR: LosaNegCutSrc = "anclaje";
    const LteoL = 0;
    const LteoR = 0;
    const db = has ? face.db : 0;
    const dCm = face.dCm;
    const L = sideOf(LteoL, srcL, edgeL, db, dCm, ln, rec, has);
    const R = sideOf(LteoR, srcR, edgeR, db, dCm, ln, rec, has);
    const sample = has ? losaNegBarM({ LteoM: LteoL, dbCm: db, dCm, lnM: ln, recCm: rec, edge: edgeL, src: srcL, capRatio: 0.3 }) : null;
    return {
      ln,
      db,
      dCm,
      twelveDb: sample?.twelveDb ?? 0,
      ln16: sample?.ln16 ?? (ln * 100) / 16,
      Lext: L.Lext || R.Lext,
      gov: sample?.gov ?? "ℓn/16",
      L,
      R,
    };
  };
  for (const r of rows) {
    const s = steels.find((x) => x.id === r.id);
    if (!s) continue;
    negLens.set(r.id, { x: buildNeg(r, s.supX, "x"), y: buildNeg(r, s.supY, "y") });
  }
  const demoNeg =
    (rows[0] && (negLens.get(rows[0].id)?.x.Lext ?? 0) > 0 ? negLens.get(rows[0].id)!.x : undefined) ??
    [...negLens.values()].find((n) => n.x.Lext > 0)?.x ??
    [...negLens.values()].find((n) => n.y.Lext > 0)?.y;

  const hNeed = hMinAci(rows[0] ? Math.min(rows[0].lx, rows[0].ly) : 4, fy, exterior, tipo === "aligerada");
  const twoWayPanes = rows.filter((p) => p.twoWay);
  const nOneWay = rows.filter((p) => !p.twoWay).length;
  const ratio = twoWayPanes.length
    ? Math.min(...twoWayPanes.map((p) => Math.min(p.lx, p.ly) / Math.max(p.lx, p.ly, 0.05)))
    : 1;
  const nOn = rows.length;
  const first = steels[0];
  const tipoTxt = tipo === "aligerada" ? "aligerada" : "maciza";

  const identRows = rows.map((p) => [
    p.id,
    fmt(p.lx, 2),
    fmt(p.ly, 2),
    p.twoWay ? "2 dir." : "1 dir.",
    `${edgeLabel(p.edges.L)}/${edgeLabel(p.edges.R)}/${edgeLabel(p.edges.B)}/${edgeLabel(p.edges.T)}`,
    p.caso,
    tipoTxt,
  ]);
  const stripRows = strips.map((s) => [
    s.id,
    s.dir.toUpperCase(),
    `${s.spans.length} tramo(s)`,
    s.spans.map((L) => fmt(L, 2)).join("+"),
    fmt(s.b, 2),
    s.paneIds.join(", ") || "—",
  ]);

  const ejemploNota = usedExample
    ? "Planta de ejemplo tipo C/U (hueco 1,00–4,40 × 0–5,00 m), editable en el croquis."
    : adoptedRoof
      ? "La grilla no tenía paños techados: se adoptó techo en todos los vanos (un hueco se marca con Paño on/off)."
      : "Planta del proyecto.";
  const p0 = rows[0];
  const demo = steels[0]?.infX;
  const sMax = Math.min(3 * h, 45);
  const AsTemp = 0.0018 * 100 * (aligerada ? hfAli : h);
  const tempBar = pickSlabBar(AsTemp, aligerada ? hfAli : h);
  const ldX = demo ? ldTension(fy, fc, demo.db) : 0;
  const facesOf = (s: PaneSteel): { cara: string; f: SlabFace }[] => [
    { cara: "+X centro", f: s.infX },
    { cara: "−X apoyo", f: s.supX },
    { cara: "+Y centro", f: s.infY },
    { cara: "−Y apoyo", f: s.supY },
  ];
  const steelRows = steels.flatMap((s) =>
    facesOf(s).map(({ cara, f }) => [
      s.id,
      cara,
      fmt(f.Mu, 3),
      fmt(f.Rn, 2),
      fmt(f.rho, 5),
      fmt(f.As, 2),
      fmt(f.Asmin, 2),
      f.label,
      fmt(f.asProv, 2),
      fmt(f.phiMn, 3),
    ]),
  );
  const steelOk = steels.every((s) => facesOf(s).every(({ f }) => f.ok));
  const workHalf = losaNegBarM({ LteoM: 0, dbCm: 1.27, dCm: dX, lnM: 3, recCm: rec, edge: true, src: "anclaje", capRatio: 0.3 });
  const negRows = rows.flatMap((p) => {
    const n = negLens.get(p.id);
    if (!n) return [];
    const s = steels.find((x) => x.id === p.id);
    const line = (dir: "X" | "Y", len: LosaNegLen, label: string) => [
      p.id,
      dir,
      label,
      fmt(len.ln, 2),
      fmt(len.db, 2),
      fmt(len.twelveDb, 2),
      fmt(len.dCm, 1),
      fmt(len.ln16, 2),
      fmt(len.Lext * 100, 2),
      len.gov,
      fmt(len.L.Lteo, 2),
      fmt(len.L.Lbar, 2),
      fmt(len.R.Lteo, 2),
      fmt(len.R.Lbar, 2),
    ];
    const outRows: string[][] = [];
    if (s && s.supX.As > 1e-8) outRows.push(line("X", n.x, s.supX.label));
    if (s && s.supY.As > 1e-8) outRows.push(line("Y", n.y, s.supY.label));
    return outRows;
  });

  return out(
    `Losa ${tipoTxt} 2 dir.  ${nOn} paños  ·  ${strips.length} franjas  ·  h=${fmt(h, 0)} cm`,
    `Identificación: ${nOn} paños techo, ${voids.length} hueco(s), ${strips.length} franjas (no 2 genéricas). wu = ${fmt(wuKg, 0)} kg/m². Aceros por paño. ${ejemploNota}`,
    [
      step(
        "01",
        "Identificación de paños y franjas — antes del análisis",
        "Paño = celda techo o rectángulo unido (Unir quita la viga)    ·    Franja = techos consecutivos (el hueco corta; Unir fusiona tramos)",
        "N_{\\mathrm{analisis}}=N_{\\mathrm{panos}}+N_{\\mathrm{franjas}}",
        `Grilla ${nxOf(m)}×${nyOf(m)}  ·  planta ${fmt(ext.Lx, 2)}×${fmt(ext.Ly, 2)} m  ·  ${nOn} paños  ·  ${voids.length} hueco(s)  ·  ${strips.length} franjas  ·  ${ejemploNota}`,
        `${nOn} paños + ${strips.length} franjas = ${found.nAnalisis} análisis. No se usan 2 únicos X e Y para toda la planta.`,
        "La geometría sale de los vanos entre ejes, no de un par A×B. Unir/separar en la línea interior entre dos techos elimina la viga de esa arista: un solo paño rectangular, sin eje interior. Separar la vuelve a poner. Un hueco (patio, caja de escalera) deja de ser paño y parte las franjas. Bordes: continuo si hay paño vecino o muro; discontinuo si hay viga sin losa al otro lado; libre si el eje es libre.",
        {
          desarrollo: [
            ejemploNota,
            `Planta ${fmt(ext.Lx, 2)} × ${fmt(ext.Ly, 2)} m en grilla de ${nxOf(m)} vanos en X y ${nyOf(m)} en Y.`,
            `${nOn} paños techados y ${voids.length} hueco(s). Cada paño lleva ℓx, ℓy, bordes L/R/B/T y caso de continuidad ACI-3.`,
            `Franjas de pórtico equivalente: ${strips.length}. Un hueco corta la franja; Unir omite el apoyo interior.`,
            `${posRuns.length} tramo(s) de positivo continuo · ${negCuts.length} corte(s) de negativo en viga/muro.`,
            p0
              ? `Ejemplo paño ${p0.id}: ℓx = ${fmt(p0.lx, 2)} m, ℓy = ${fmt(p0.ly, 2)} m, ${p0.twoWay ? "dos direcciones" : "una dirección"}, caso ${p0.caso}, bordes L/R/B/T = ${edgeLabel(p0.edges.L)}/${edgeLabel(p0.edges.R)}/${edgeLabel(p0.edges.B)}/${edgeLabel(p0.edges.T)}.`
              : "Sin paños.",
          ],
          table: {
            caption: "Paños válidos (lx, ly, bordes L/R/B/T, tipo)",
            headers: ["Paño", "ℓx (m)", "ℓy (m)", "Tipo luz", "Bordes L/R/B/T", "caso", "losa"],
            rows: identRows.length ? identRows : [["—", "—", "—", "—", "—", "—", "—"]],
          },
        },
      ),
      step(
        "01b",
        "Franjas de pórtico equivalente",
        "Una franja X por cada racha de celdas techo en un vano Y    ·    una franja Y por cada racha en un vano X",
        "b_{\\mathrm{trib}}=\\text{ancho del vano transversal}",
        strips.map((s) => s.why).join("    ·    ") || "Sin franjas — no hay celdas techo.",
        `${strips.length} franja(s) de análisis`,
        "En una planta en C o U el hueco impide una sola viga continua de lado a lado. Cada franja tiene su ancho tributario (el vano transversal de esa racha), no el primer vano de la grilla.",
        {
          table: {
            caption: "Franjas a analizar",
            headers: ["Id", "Dir.", "Tramos", "Luces (m)", "b trib. (m)", "Paños"],
            rows: stripRows.length ? stripRows : [["—", "—", "—", "—", "—", "—"]],
          },
        },
      ),
      step(
        "02",
        tipo === "aligerada" ? "Peso propio de losa aligerada — nervio + loseta + relleno" : "Peso propio de losa maciza — γc × h",
        tipo === "aligerada"
          ? "Vconc = (bw/s)·e + (1−bw/s)·hf    ·    pp = 2400 Vconc + pp relleno"
          : "pp = 2400 kg/m³ × h",
        tipo === "aligerada"
          ? "p_p=2400\\,V_{\\mathrm{conc}}+p_{\\mathrm{relleno}}"
          : "p_p=2400\\,h",
        peso.detalle[0],
        `pp = ${fmt(peso.pp, 0)} kg/m²`,
        tipo === "aligerada"
          ? "No se usa el peso de maciza. Entre-eje típico Perú 0.40 m, nervio 0.10 m, loseta 0.05 m, e = 0.20–0.25 m. Ladrillo hueco ≈ 900 kg/m³ del volumen de bloque; EPS ≈ 15 kg/m²."
          : "E.020: concreto armado 2400 kg/m³. El espesor h es el de la losa maciza.",
        { desarrollo: peso.detalle },
      ),
      step(
        "03",
        "Cargas de servicio y última — E.020 / E.060",
        "D = pp + acabados + tabiquería    ·    wu = 1.4 D + 1.7 L",
        "w_u=1.4D+1.7L",
        `pp=${fmt(peso.pp, 0)}    acab=${fmt(acab, 0)}    tab=${fmt(tab, 0)}    D=${fmt(Duse, 0)} kg/m²    L=${fmt(cv, 0)} kg/m²    h=${fmt(h, 0)} cm`,
        `wu = ${fmt(wuKg, 0)} kg/m² = ${fmt(wu, 3)} t/m²`,
        "E.060 2009 usa 1.4D+1.7L (más conservador que 1.2+1.6). No se incluye sismo de losa (masa en el pórtico).",
        { desarrollo: [`D = ${fmt(peso.pp, 0)}+${fmt(acab, 0)}+${fmt(tab, 0)} = ${fmt(Duse, 0)} kg/m²`, `wu = 1.4×${fmt(Duse, 0)} + 1.7×${fmt(cv, 0)} = ${fmt(wuKg, 0)} kg/m²`] },
      ),
      step(
        "04",
        "Espesor mínimo — ACI 318 / E.060",
        tipo === "aligerada" ? "h ≥ Ln/25    ·    h ≥ 17 cm (aligerado Perú)" : "h ≥ ℓn (0.8 + fy/14000) / 36 ó 33    ·    h ≥ 12 cm",
        tipo === "aligerada" ? "h_{\\min}=\\ell_n/25\\ge 17\\,\\mathrm{cm}" : "h_{\\min}=\\dfrac{\\ell_n(0.8+f_y/14000)}{36\\text{ ó }33}\\ge 12\\,\\mathrm{cm}",
        `ℓn máx≈${fmt(lnMax, 2)} m    ·    fy=${fmt(fy, 0)}    ·    ${tipo === "aligerada" ? "aligerada → /25" : exterior ? "borde disc./libre → /33" : "interiores → /36"}`,
        `h mín = ${fmt(hNeed, 1)} cm    ·    h adoptado = ${fmt(h, 0)} cm`,
        tipo === "aligerada"
          ? "Aligerado de techo en Perú: 17 cm práctico mínimo (ladrillo 12 + loseta 5) y Ln/25. No se descuenta αf de vigas."
          : "Sin vigas de borde el denominador es 33 (exterior) o 36 (interior). Losa maciza de techo: 12 cm de piso práctico.",
        { ok: h + 1e-6 >= hNeed },
      ),
      step(
        "05",
        "Momentos de cada paño — método 3 ACI y Marcus",
        "Mu = α wu ℓn²    ·    Marcus: Mx = wu ℓx² / [8(1+(ℓx/ℓy)⁴)]",
        "M_u=\\alpha w_u\\ell_n^2\\qquad M_x^{\\mathrm{Marcus}}=\\dfrac{w_u\\ell_x^2}{8\\bigl(1+(\\ell_x/\\ell_y)^4\\bigr)}",
        `α según continuidad de cada paño (no un caso único de planta). wu=${fmt(wu, 3)} t/m².`,
        nOn ? `${nOn} paños con momentos propios (positivo en centro, negativo en apoyos).` : "Sin paños",
        "Cada paño tiene sus bordes. Un patio hace libre o discontinuo el lado que da al hueco. Si ℓlargo/ℓcorto > 2 el paño es de una dirección. Se toma el envolvente ACI-3 / Marcus / DDM por paño.",
        {
          desarrollo: p0
            ? [
                `wu = ${fmt(wu, 3)} t/m². Paño ${p0.id}: ℓn = min(ℓx, ℓy) = ${fmt(Math.min(p0.lx, p0.ly), 2)} m, caso ${p0.caso}.`,
                `ACI-3: Mu− corto = ${fmt(p0.MuCneg, 3)} t·m/m, Mu+ corto = ${fmt(p0.MuCpos, 3)}, Mu− largo = ${fmt(p0.MuLneg, 3)}, Mu+ largo = ${fmt(p0.MuLpos, 3)}.`,
                `Marcus: Mx+ = wu ℓx² / [8(1+(ℓx/ℓy)⁴)] = ${fmt(p0.MxPosM, 3)} t·m/m; My+ = ${fmt(p0.MyPosM, 3)} t·m/m.`,
                `M0x = wu ℓx² ℓy / 8 = ${fmt(p0.M0x, 3)} t·m (total del paño). Envolvente de diseño +X = ${fmt(p0.posX, 3)}, −X = ${fmt(p0.negX, 3)}, +Y = ${fmt(p0.posY, 3)}, −Y = ${fmt(p0.negY, 3)} t·m/m.`,
                `Se repite el mismo procedimiento en cada paño de la tabla (no un único caso de planta).`,
              ]
            : ["Sin paños techados."],
          table: {
            caption: "Momentos de paño (t·m/m)",
            headers: ["Paño", "caso", "Mu− corto", "Mu+ corto", "Mu− largo", "Mu+ largo", "Marcus Mx+", "Marcus My+"],
            rows: rows.map((p) => [
              p.id,
              p.caso,
              fmt(p.MuCneg, 3),
              fmt(p.MuCpos, 3),
              fmt(p.MuLneg, 3),
              fmt(p.MuLpos, 3),
              fmt(p.MxPosM, 3),
              fmt(p.MyPosM, 3),
            ]),
          },
        },
      ),
      step(
        "06",
        "Análisis matricial por franja (pórtico equivalente)",
        "K u = F    ·    w = wu · b_tributario de ESA franja",
        "Ku=F\\qquad w=w_u b",
        `${strips.length} franjas independientes. Cada una con sus vanos techo y apoyos viga/muro/libre.`,
        strips.length ? stripFigs.map((f) => `${f.title}: M+=${fmt(f.MuPos, 2)}  |M−|=${fmt(f.MuNeg, 2)} t·m`).join("    ·    ") : "Sin franjas",
        "No hay dos análisis genéricos X e Y para toda la planta. Una C o U alrededor del hueco produce varias franjas. EI uniforme (espesor constante).",
      ),
      step(
        "07",
        "Acero por paño — Whitney, Asmín y Ø comercial",
        "Rn = Mu/(φ b d²)    ·    ρ = 0.85(f'c/fy)[1−√(1−2Rn/(0.85f'c))]    ·    As = máx(ρbd, 0.0018bh, 14/fy·bd)",
        "\\rho=0.85\\dfrac{f'_c}{f_y}\\left[1-\\sqrt{1-\\dfrac{2R_n}{0.85f'_c}}\\right]",
        demo
          ? `Paño ${steels[0].id} +X: Mu=${fmt(demo.Mu, 3)} t·m/m  b=${fmt(demo.bCm, 0)} cm  d=${fmt(demo.dCm, 1)} cm  fy=${fmt(fy, 0)}  f'c=${fmt(fc, 0)}  h=${fmt(h, 0)} cm  rec=${fmt(rec, 1)} cm`
          : `h=${fmt(h, 0)} cm  rec=${fmt(rec, 1)} cm  dX=${fmt(dX, 1)} cm  dY=${fmt(dY, 1)} cm`,
        steels.length
          ? steels.map((s) => `${s.id}: +X ${s.infX.label}  +Y ${s.infY.label}  −X ${s.supX.label}  −Y ${s.supY.label}`).join("    ·    ")
          : "Sin paños",
        aligerada
          ? "Positivo en nervios (As por nervio, b=bw). Negativo solo en apoyos viga/muro (cm²/m). Una malla: Ø de pulgadas 3/8…1½ y s de norma; si un paño pide más se sube Ø o se aprieta s solo ahí."
          : "Una malla (no doble capa). Ø 3/8, 1/2, 5/8, 3/4, 1, 1¼, 1½ y s de norma (10–45 cm, s≤3h). El Ø mínimo cubre las zonas suaves; si un paño pide más momento se aumenta Ø o se reduce s solo en esa zona. Negativo solo en viga/muro.",
        {
          desarrollo: demo
            ? [
                `Lechos: dX = h − rec − Ø/2 ≈ ${fmt(dX, 1)} cm; dY = ${fmt(dY, 1)} cm (capa superior, 1 cm menos).`,
                `Rn = Mu·10⁵/(φ b d²) = ${fmt(demo.Mu, 3)}·100000/(0.90·${fmt(demo.bCm, 0)}·${fmt(demo.dCm, 1)}²) = ${fmt(demo.Rn, 2)} kg/cm².`,
                `ρ = 0.85(f'c/fy)[1−√(1−2Rn/(0.85 f'c))] = ${fmt(demo.rho, 5)}.`,
                `As,flex = ρ b d = ${fmt(demo.As, 2)} ${demo.perRib ? "cm²/nervio" : "cm²/m"}.`,
                `Asmín = máx(0.0018 b h, 14/fy · b d) = ${fmt(demo.Asmin, 2)}. Se usa As = máx(As,flex, Asmín).`,
                `Comercial: ${demo.detalle}. As,prov = ${fmt(demo.asProv, 2)} cm²/m  ·  φMn = ${fmt(demo.phiMn, 3)} t·m ${demo.ok ? "≥ demanda OK" : "insuficiente"}.`,
                `El cuadro aplica el mismo Whitney a las 4 caras de cada paño (${steels.length} paños × 4).`,
              ]
            : ["Sin paños techados."],
          table: {
            caption: "Whitney por paño y cara (As en cm²/m salvo nervio)",
            headers: ["Paño", "Cara", "Mu", "Rn", "ρ", "As req", "As mín", "Ø @ s", "As prov", "φMn"],
            rows: steelRows.length ? steelRows : [["—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
          },
        },
      ),
      step(
        "08",
        "Colocación — s máx, desarrollo y temperatura",
        "s ≤ mín(3h, 45 cm)    ·    ℓd ≈ 0.075 fy db / √f'c    ·    As,temp = 0.0018 b h",
        "s_{\\max}=\\min(3h,45)\\qquad \\ell_d=0.075\\,f_y d_b/\\sqrt{f'_c}",
        `h=${fmt(h, 0)} cm  s máx=${fmt(sMax, 0)} cm  fy=${fmt(fy, 0)}  f'c=${fmt(fc, 0)}  ${demo ? `db=+X ${fmt(demo.db, 2)} cm` : ""}`,
        demo
          ? `ℓd (Ø ${demo.bar}) ≈ ${fmt(ldX, 1)} cm    ·    temperatura ${tempBar.bar} @ ${tempBar.s} cm    ·    negativo: paso 09`
          : "Sin paños",
        "El positivo inferior es continuo en paños unidos y en la misma franja de techos sin hueco (se corta en huecos y bordes). El negativo superior solo en apoyos con viga o muro: Unir elimina esa viga y no se arma negativo ni se dibuja eje ahí. Ganchos 90° en extremos libres o de borde. La longitud del As− no es una U a ojo: se corta con L teórica + extensión (paso 09).",
        {
          desarrollo: [
            `s máx flexión E.060 7.6.5 = mín(3h, 45 cm) = mín(${fmt(3 * h, 0)}, 45) = ${fmt(sMax, 0)} cm.`,
            demo
              ? `ℓd tracción (forma simplificada E.060 12.2) = 0.075 fy db / √f'c = 0.075·${fmt(fy, 0)}·${fmt(demo.db, 2)} / √${fmt(fc, 0)} = ${fmt(ldX, 1)} cm.`
              : "Sin Ø de referencia.",
            `${posRuns.length} tramo(s) de positivo continuo. ${negCuts.length} apoyo(s) con negativo.`,
            ...posRuns.slice(0, 8).map((r) => r.why),
            ...negCuts.slice(0, 8).map((r) => r.why),
            aligerada
              ? `Temperatura/retracción en loseta: As = 0.0018 b hf = 0.0018×100×${fmt(hfAli, 0)} = ${fmt(AsTemp, 2)} cm²/m → Ø ${tempBar.bar} @ ${tempBar.s} cm.`
              : `La malla inferior cubre temperatura (0.0018 h = ${fmt(0.0018 * 100 * h, 2)} cm²/m). No se duplica una segunda malla en todo el paño.`,
            aligerada
              ? `Aligerada: 1 Ø por nervio en positivo (entre-eje s=${fmt(sAli, 0)} cm, bw=${fmt(bwAli, 0)} cm). El negativo va en la loseta sobre apoyos viga/muro.`
              : "Maciza: una malla de flexión en dos direcciones. Positivo continuo; negativo solo en apoyos.",
          ],
        },
      ),
      step(
        "09",
        "Longitud de acero negativo (superior) — apoyo simple en todas las vigas",
        "L_ext = máx(12 db, d, ℓn/16)    ·    L_teo = 0    ·    L_barra = L_ext (gancho 90° corto)",
        "L_{\\mathrm{ext}}=\\max(12d_b,\\,d,\\,\\ell_n/16)\\qquad L_{\\mathrm{teo}}=0\\qquad L_{\\mathrm{barra}}=L_{\\mathrm{ext}}",
        demoNeg
          ? `Ø db=${fmt(demoNeg.db, 2)} cm    d=${fmt(demoNeg.dCm, 1)} cm    ℓn=${fmt(demoNeg.ln, 2)} m    12 db=${fmt(demoNeg.twelveDb, 2)} cm    d=${fmt(demoNeg.dCm, 1)} cm    ℓn/16=${fmt(demoNeg.ln16, 2)} cm`
          : `dX=${fmt(dX, 1)} cm  rec=${fmt(rec, 1)} cm  (sin As− de referencia)`,
        demoNeg
          ? `L_ext = ${fmt(demoNeg.Lext * 100, 2)} cm (${demoNeg.gov})    ·    L_teo izq/inf = ${fmt(demoNeg.L.Lteo, 2)} m (${demoNeg.L.src})    ·    L_barra = ${fmt(demoNeg.L.Lbar, 2)} m`
          : "Sin acero negativo",
        "Las vigas de la losa son apoyos simples (θ libre); el nudo no se empotra. El As− cubre el apoyo y ancla L_ext = máx(12 db, d, ℓn/16) hacia el vano, con gancho 90° corto. No se usa 0,30 ℓn (eso es losa empotrada / DDM).",
        {
          desarrollo: [
            `L_ext = máx(12 db, d, ℓn/16). Caso de verificación Ø 1/2\" (db = 1,27 cm), losa h = ${fmt(h, 0)} cm rec = ${fmt(rec, 1)} cm → d = h − rec − Ø/2 ≈ ${fmt(dX, 1)} cm, ℓn = 3,00 m:`,
            `12 db = 12×1,27 = ${fmt(workHalf.twelveDb, 2)} cm;  d = ${fmt(workHalf.dCm, 1)} cm;  ℓn/16 = 300/16 = ${fmt(workHalf.ln16, 2)} cm.`,
            `máx(${fmt(workHalf.twelveDb, 2)}, ${fmt(workHalf.dCm, 1)}, ${fmt(workHalf.ln16, 2)}) = ${fmt(workHalf.LextCm, 2)} cm  →  gobierna ${workHalf.gov}.`,
            `Todas las vigas son apoyos simples: L_teo = 0.  L_barra = L_ext = ${fmt(workHalf.LbarM, 3)} m (gancho 90° = 12 db). No se usa 0,30 ℓn ni inflexión de pórtico: esa regla es de losa empotrada / DDM.`,
            demoNeg
              ? `En este expediente, paño de referencia ℓn = ${fmt(demoNeg.ln, 2)} m, Ø db = ${fmt(demoNeg.db, 2)} cm, d = ${fmt(demoNeg.dCm, 1)} cm: 12 db = ${fmt(demoNeg.twelveDb, 2)} cm, ℓn/16 = ${fmt(demoNeg.ln16, 2)} cm → L_ext = ${fmt(demoNeg.Lext * 100, 2)} cm (${demoNeg.gov}). L_teo = ${fmt(demoNeg.L.Lteo, 2)} m (${demoNeg.L.src}) y ${fmt(demoNeg.R.Lteo, 2)} m (${demoNeg.R.src}). L_barra = ${fmt(demoNeg.L.Lbar, 2)} / ${fmt(demoNeg.R.Lbar, 2)} m.`
              : "No hay paño con As− para sustituir.",
            "Al menos 1/3 del As− debe recibir esa extensión cuando hay inflexión; con una sola malla de apoyo se aplica a todas las barras del lecho superior.",
            "Despiece: longitud emplazada = L_barra desde el eje; gancho 90° corto (radio 3 db, ramal 12 db) solo en extremo libre o borde. No se dibuja una U simétrica de ℓn/4 por paño.",
          ],
          table: {
            caption: "Corte de As−: apoyo simple — L_barra = L_ext  (m salvo db y extensiones en cm)",
            headers: ["Paño", "Dir.", "Ø @ s", "ℓn", "db", "12 db", "d", "ℓn/16", "L_ext", "gobierna", "L_teo L/B", "L_barra L/B", "L_teo R/T", "L_barra R/T"],
            rows: negRows.length ? negRows : [["—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
          },
        },
      ),
    ],
    [
      ok("Hay paños techados", String(nOn), "≥ 1", nOn >= 1),
      ok("Hay franjas de análisis", String(strips.length), "≥ 1", strips.length >= 1 || nOn === 0),
      twoWayPanes.length
        ? ok("Paños 2 dir. ℓcorto/ℓlargo ≥ 0.5", fmt(ratio, 2), "≥ 0.50", ratio >= 0.5)
        : ok("Paños 1 dir. (ℓl/ℓc > 2)", String(nOneWay), "ACI 6.2.1 · se arman como losa 1 dir.", true),
      ok(`h ≥ hmín ${fmt(hNeed, 1)} cm`, `${fmt(h, 0)} cm`, `≥ ${fmt(hNeed, 1)}`, h + 1e-6 >= hNeed),
      ok(tipo === "aligerada" ? "h ≥ 17 cm (aligerada)" : "h ≥ 12 cm (maciza)", `${fmt(h, 0)} cm`, tipo === "aligerada" ? "≥ 17" : "≥ 12", tipo === "aligerada" ? h >= 17 : h >= 12),
      ok("As,prov ≥ As,req en todas las caras", steelOk ? "OK" : "revisar", "As,prov ≥ As", steelOk),
      ok(`s ≤ s máx ${fmt(sMax, 0)} cm`, demo ? `${fmt(Math.max(demo.s, steels[0].infY.s, steels[0].supX.s || 0, steels[0].supY.s || 0), 0)} cm` : "—", `≤ ${fmt(sMax, 0)}`, !demo || [demo, steels[0].infY, steels[0].supX, steels[0].supY].every((f) => f.s <= 1e-6 || f.s <= sMax + 1e-6)),
      ok(
        "L_ext As− = máx(12 db, d, ℓn/16)",
        demoNeg ? `${fmt(demoNeg.Lext * 100, 2)} cm (${demoNeg.gov})` : "sin As−",
        demoNeg ? `≥ ${fmt(Math.max(demoNeg.twelveDb, demoNeg.dCm, demoNeg.ln16), 2)} cm` : "—",
        !demoNeg || Math.abs(demoNeg.Lext * 100 - Math.max(demoNeg.twelveDb, demoNeg.dCm, demoNeg.ln16)) < 0.05,
      ),
    ],
    [
      {
        title: "Aceros por paño (positivo centro / negativo apoyos)",
        rows: [
          ["Paño", "ℓx", "ℓy", "+X", "As+X", "−X", "As−X", "+Y", "As+Y", "−Y", "As−Y"],
          ...steels.map((s) => {
            const p = rows.find((r) => r.id === s.id);
            return [
              s.id,
              fmt(p?.lx ?? 0, 2),
              fmt(p?.ly ?? 0, 2),
              s.infX.label,
              fmt(s.infX.asProv, 2),
              s.supX.label,
              fmt(s.supX.asProv, 2),
              s.infY.label,
              fmt(s.infY.asProv, 2),
              s.supY.label,
              fmt(s.supY.asProv, 2),
            ];
          }),
        ],
      },
      {
        title: "Longitudes de acero negativo (m) — apoyo simple: L_barra = L_ext (no 0,30 ℓn)",
        rows: [
          ["Paño", "Dir.", "ℓn", "L_ext", "L_teo L/B", "L_barra L/B", "L_teo R/T", "L_barra R/T", "origen L_teo"],
          ...negRows.map((r) => [r[0], r[1], r[3], `${r[8]} cm`, r[10], r[11], r[12], r[13], (negLens.get(r[0])?.[r[1] === "X" ? "x" : "y"].L.src ?? "—") + " / " + (negLens.get(r[0])?.[r[1] === "X" ? "x" : "y"].R.src ?? "—")]),
        ],
      },
    ],
    {
      h: String(h),
      rec: String(rec),
      tipoLosa: tipo,
      asInfX: first ? first.infX.label : 'Ø 3/8" @ 20 cm',
      asInfY: first ? first.infY.label : 'Ø 3/8" @ 20 cm',
      asSupX: first ? first.supX.label : 'Ø 3/8" @ 20 cm',
      asSupY: first ? first.supY.label : 'Ø 3/8" @ 20 cm',
      AsInfX: first ? first.infX.As.toFixed(2) : "0",
      AsInfY: first ? first.infY.As.toFixed(2) : "0",
      mPtsX: stripFigs.find((f) => f.title.startsWith("FX"))?.pts ?? packPts([]),
      mPtsY: stripFigs.find((f) => f.title.startsWith("FY"))?.pts ?? packPts([]),
      mStripXMpos: String(stripFigs.find((f) => f.title.startsWith("FX"))?.MuPos ?? 0),
      mStripXMneg: String(stripFigs.find((f) => f.title.startsWith("FX"))?.MuNeg ?? 0),
      mStripYMpos: String(stripFigs.find((f) => f.title.startsWith("FY"))?.MuPos ?? 0),
      mStripYMneg: String(stripFigs.find((f) => f.title.startsWith("FY"))?.MuNeg ?? 0),
      bStripX: String(strips.find((s) => s.dir === "x")?.b ?? 1),
      bStripY: String(strips.find((s) => s.dir === "y")?.b ?? 1),
      studioJson: str(raw, "studioJson", ""),
      gridJson: str(raw, "gridJson", ""),
      stripFigsJson: JSON.stringify(stripFigs),
      losaSteelJson: JSON.stringify({
        tipo,
        h,
        rec,
        panes: rows.map((p) => ({
          id: p.id,
          x0: p.x0,
          y0: p.y0,
          x1: p.x1,
          y1: p.y1,
          lx: p.lx,
          ly: p.ly,
          ix0: p.ix0,
          iy0: p.iy0,
          ix1: p.ix1,
          iy1: p.iy1,
          edges: p.edges,
        })),
        voids: voids.map((v) => ({ id: v.id, x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1 })),
        axesX: m.axesX,
        axesY: m.axesY,
        mergeH: m.mergeH,
        mergeV: m.mergeV,
        axisXKind: m.axisXKind,
        axisYKind: m.axisYKind,
        posRuns,
        negCuts,
        steels: steels.map((s) => {
          const n = negLens.get(s.id);
          return {
            id: s.id,
            infX: s.infX.label,
            infY: s.infY.label,
            supX: s.supX.label,
            supY: s.supY.label,
            asPosX: s.infX.As,
            asNegX: s.supX.As,
            asPosY: s.infY.As,
            asNegY: s.supY.As,
            neg: n
              ? {
                  xL: n.x.L.Lbar,
                  xR: n.x.R.Lbar,
                  yB: n.y.L.Lbar,
                  yT: n.y.R.Lbar,
                  LextX: n.x.Lext,
                  LextY: n.y.Lext,
                  LteoXL: n.x.L.Lteo,
                  LteoXR: n.x.R.Lteo,
                  LteoYB: n.y.L.Lteo,
                  LteoYT: n.y.R.Lteo,
                }
              : undefined,
          };
        }),
      }),
    },
  );
};

export { losaNegBarM, losaNegLextCm } from "./steel";
