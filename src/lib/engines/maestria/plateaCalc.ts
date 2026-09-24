import { barByName, fmt, num, str, type Engine } from "../../types";
import { designBeamStirrups } from "../../estribos";
import { clearSpanLn, invertBeam, packPts, packV, predimHBeam } from "./matrixBeam";
import {
  asFlex,
  fmtBar,
  ldTension,
  ok,
  oneWayShear,
  out,
  pendingPlantOut,
  pickBeamBars,
  pickSlabBar,
  punchCapacity,
  punchGeom,
  punchMomentAmp,
  round05,
  step,
} from "./steel";
import {
  cellOn,
  colXY,
  collectGradeBeams,
  defaultModel,
  ensureGradeBeams,
  loadsOnGradeBeam,
  momentsAt,
  nxOf,
  nyOf,
  paintedInertia,
  plantReady,
  puCol,
  resolveMaeModel,
  type MaeModel,
} from "./types";

function applyGridJson(raw: Record<string, string>, fb: MaeModel): MaeModel {
  const nBayX = Math.max(1, Math.round(num(raw, "nBayX", 3)));
  const nBayY = Math.max(1, Math.round(num(raw, "nBayY", 3)));
  const Sx = num(raw, "Sx", 5);
  const Sy = num(raw, "Sy", 5);
  const ox = num(raw, "ox", 0.5);
  const oy = num(raw, "oy", 0.5);
  fb.axesX = Array.from({ length: nBayX + 1 }, (_, i) => ox + i * Sx);
  fb.axesY = Array.from({ length: nBayY + 1 }, (_, i) => oy + i * Sy);
  const nx = fb.axesX.length - 1;
  const ny = fb.axesY.length - 1;
  fb.cells = Array.from({ length: ny }, () => Array.from({ length: nx }, () => true));
  fb.mergeH = Array.from({ length: ny }, () => Array.from({ length: nx }, () => false));
  fb.mergeV = Array.from({ length: ny }, () => Array.from({ length: nx }, () => false));
  fb.axisXKind = Array.from({ length: nx + 1 }, () => "viga");
  fb.axisYKind = Array.from({ length: ny + 1 }, () => "viga");
  if (!raw.gridJson?.trim()) return fb;
  try {
    const j = JSON.parse(raw.gridJson) as {
      axesX?: number[];
      axesY?: number[];
      panes?: boolean[][];
      cols?: { ix: number; iy: number; t1: number; t2: number; P1: number; P2: number; P3: number; M1: number; M2: number; M3: number; seat?: "nudo" | "esquinera" | "borde" }[];
      placed?: boolean;
    };
    if (Array.isArray(j.axesX) && j.axesX.length >= 2) fb.axesX = j.axesX.map(Number);
    if (Array.isArray(j.axesY) && j.axesY.length >= 2) fb.axesY = j.axesY.map(Number);
    const nx2 = fb.axesX.length - 1;
    const ny2 = fb.axesY.length - 1;
    fb.cells = Array.from({ length: ny2 }, (_, iy) => Array.from({ length: nx2 }, (_, ix) => j.panes?.[iy]?.[ix] !== false));
    fb.cols = Array.isArray(j.cols)
      ? j.cols.map((c, i) => ({
          id: `C${i + 1}`,
          ix: Number(c.ix) || 0,
          iy: Number(c.iy) || 0,
          t1: Number(c.t1) || 0.4,
          t2: Number(c.t2) || 0.4,
          P1: Number(c.P1) || 0,
          P2: Number(c.P2) || 0,
          P3: Number(c.P3) || 0,
          M1: Number(c.M1) || 0,
          M2: Number(c.M2) || 0,
          M3: Number(c.M3) || 0,
          ex: 0,
          ey: 0,
          centered: true,
          seat: c.seat === "esquinera" || c.seat === "borde" ? c.seat : "nudo",
        }))
      : [];
    if (!j.placed && (!j.cols || j.cols.length === 0)) {
      const c = num(raw, "c", 0.4);
      const P3 = (num(raw, "PdInt", 80) + num(raw, "PlInt", 30)) || 80;
      fb.cols = [];
      for (let iy = 0; iy < fb.axesY.length; iy++) {
        for (let ix = 0; ix < fb.axesX.length; ix++) {
          fb.cols.push({ id: `C${ix + 1}${iy + 1}`, ix, iy, t1: c, t2: c, P1: 0, P2: 0, P3, M1: 0, M2: 0, M3: 0, ex: 0, ey: 0, centered: true, seat: "nudo" });
        }
      }
    }
  } catch {
    /* keep fb */
  }
  return fb;
}

function modelFromRaw(raw: Record<string, string>) {
  if (raw.studioJson?.trim()) return resolveMaeModel(raw, "platea");
  if (raw.gridJson?.trim()) {
    const model = applyGridJson(raw, defaultModel("platea"));
    if (plantReady(model, "platea")) return { model, usedExample: false, pending: false };
  }
  return resolveMaeModel(raw, "platea");
}

function qNet(qadm: number, gt: number, Df: number, t: number, sc: number) {
  return qadm * 10 - gt * Df - 2.4 * t - sc;
}

export const calcPlatea: Engine = (raw) => {
  const { model: m, usedExample, pending } = modelFromRaw(raw);
  const tIn = num(raw, "t", 0.5);
  const qadm = num(raw, "qadm", 1.5);
  const Df = num(raw, "Df", 1.2);
  const gt = num(raw, "gt", 1.8);
  const sc = num(raw, "sc", 0.3);
  const Ks = num(raw, "Ks", 8);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 7.5);
  const geom = paintedInertia(m);
  const nCells = m.cells.flat().filter(Boolean).length;
  const cols = m.cols.filter((c) => {
    const nx = nxOf(m);
    const ny = nyOf(m);
    const nbs = [
      [c.ix - 1, c.iy - 1],
      [c.ix, c.iy - 1],
      [c.ix - 1, c.iy],
      [c.ix, c.iy],
    ];
    return nbs.some(([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny && cellOn(m, i, j));
  });

  if (pending || nCells < 1 || cols.length < 1) {
    return pendingPlantOut(
      "Platea de cimentación — pendiente de planta",
      "Pinte paños de platea y coloque cada columna (P1 a P3 y M1 a M3) o pulse «Cargar ejemplo» para emitir el expediente completo.",
    );
  }

  const A = Math.max(geom.A, 0.5);
  const Lx = m.axesX[m.axesX.length - 1] - m.axesX[0];
  const Ly = m.axesY[m.axesY.length - 1] - m.axesY[0];
  const Sx = nxOf(m) ? Lx / nxOf(m) : 5;
  const Sy = nyOf(m) ? Ly / nyOf(m) : 5;
  const xOrg = m.axesX[0];
  const yOrg = m.axesY[0];
  const painted = [] as { x0: number; y0: number; x1: number; y1: number }[];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      painted.push({ x0: m.axesX[ix] - xOrg, y0: m.axesY[iy] - yOrg, x1: m.axesX[ix + 1] - xOrg, y1: m.axesY[iy + 1] - yOrg });
    }
  }

  const loads = cols.map((c) => {
    const p = puCol(c);
    const xy = colXY(m, c);
    const mom = momentsAt(c, tIn);
    return { c, ...xy, Pserv: p.Pserv, Pu: p.Pu, M2: mom.M2, M3: mom.M3 };
  });
  const PpS = loads.reduce((s, c) => s + c.Pserv, 0);
  const PpU = loads.reduce((s, c) => s + c.Pu, 0);
  const cTyp = loads.reduce((a, b) => (b.Pu > a.Pu ? b : a), loads[0]);

  const rowsH: string[][] = [];
  let t = Math.max(0.35, tIn);
  let d = t * 100 - rec;
  let qn = qNet(qadm, gt, Df, t, sc);
  let Wslab = 2.4 * t * A;
  let Wfill = gt * Math.max(Df - t, 0) * A;
  let Pts = PpS + Wslab + Wfill + sc * A;
  let Put = PpU + 1.4 * (Wslab + Wfill) + 1.7 * sc * A;
  let qserv = Pts / A;
  let qu = Put / A;
  let shX = { Vu: 0, phiVc: 0, ok: false };
  let okT = false;
  const punchOf = (dd: number, quu: number) => {
    let worst = { Vu: 0, phiVn: 1, ratio: 0, id: "—" };
    for (const c of loads) {
      const pg = punchGeom(c.x - m.axesX[0], c.y - m.axesY[0], c.c.t1, c.c.t2, dd / 100, Ly, Lx, painted);
      const beta = Math.max(c.c.t1, c.c.t2) / Math.max(Math.min(c.c.t1, c.c.t2), 0.1);
      const cap = punchCapacity(fc, pg.b0, dd, beta, pg.alphaS);
      const am = punchMomentAmp(pg.kind);
      const Vu = Math.max(0, am * Math.max(0, c.Pu - quu * pg.Acrit));
      const ratio = Vu / Math.max(cap.phiVn, 0.01);
      if (ratio >= worst.ratio) worst = { Vu, phiVn: cap.phiVn, ratio, id: c.c.id };
    }
    return worst;
  };
  for (let i = 0; i < 16; i++) {
    d = t * 100 - rec;
    qn = qNet(qadm, gt, Df, t, sc);
    Wslab = 2.4 * t * A;
    Wfill = gt * Math.max(Df - t, 0) * A;
    Pts = PpS + Wslab + Wfill + sc * A;
    Put = PpU + 1.4 * (Wslab + Wfill) + 1.7 * sc * A;
    qserv = Pts / A;
    qu = Put / A;
    const pun = punchOf(d, qu);
    shX = oneWayShear(qu * Math.max(Sx / 2 - cTyp.c.t2 / 2 - d / 100, 0) * Sy, Sy * 100, d, fc);
    const hMin = Math.max(0.35, Math.max(Sx, Sy) / 20);
    const qCol = PpS / A;
    okT = qn > 0 && pun.Vu <= pun.phiVn + 1e-6 && shX.ok && t + 1e-9 >= hMin;
    rowsH.push([
      String(i + 1),
      t.toFixed(2),
      d.toFixed(1),
      qn.toFixed(2),
      qCol.toFixed(2),
      `${pun.Vu.toFixed(1)}/${pun.phiVn.toFixed(1)}`,
      `${shX.Vu.toFixed(1)}/${shX.phiVc.toFixed(1)}`,
      okT ? "OK" : "NO",
    ]);
    if (okT) break;
    t = round05(t + 0.05);
  }
  for (const c of loads) {
    const mom = momentsAt(c.c, t);
    c.M2 = mom.M2;
    c.M3 = mom.M3;
  }

  const Ec = 15000 * Math.sqrt(Math.max(fc, 1));
  const lRad = Math.pow((Ec * (t * 100) ** 3) / (12 * (1 - 0.2 * 0.2) * Math.max(Ks, 0.2)), 0.25);
  const Lc = (Math.min(Sx, Sy) * 100) / 2;
  const ratio = Lc / Math.max(lRad, 1);
  const rigido = ratio < 1.75;
  const amp = rigido ? 1 : 1.2;

  function loadsOnLine(dir: "x" | "y", idx: number) {
    return loads
      .filter((c) => (dir === "x" ? c.c.iy === idx : c.c.ix === idx))
      .map((c) => ({
        x: dir === "x" ? c.x - m.axesX[0] : c.y - m.axesY[0],
        P: c.Pu,
        M: dir === "x" ? c.M3 : c.M2,
      }));
  }
  const iyInt = Math.floor(m.axesY.length / 2);
  const iyEdg = 0;
  const ixInt = Math.floor(m.axesX.length / 2);
  const ixEdg = 0;
  const LxUse = Lx;
  const LyUse = Ly;
  const lIntX = loadsOnLine("x", Math.min(iyInt, m.axesY.length - 1));
  const lEdgX = loadsOnLine("x", iyEdg);
  const lIntY = loadsOnLine("y", Math.min(ixInt, m.axesX.length - 1));
  const lEdgY = loadsOnLine("y", ixEdg);
  const sum = (ls: { P: number }[]) => ls.reduce((s, p) => s + p.P, 0);
  const frIntX = invertBeam(LxUse, sum(lIntX) / Math.max(LxUse, 0.2), lIntX);
  const frEdgX = invertBeam(LxUse, sum(lEdgX) / Math.max(LxUse, 0.2), lEdgX);
  const frIntY = invertBeam(LyUse, sum(lIntY) / Math.max(LyUse, 0.2), lIntY);
  const frEdgY = invertBeam(LyUse, sum(lEdgY) / Math.max(LyUse, 0.2), lEdgY);
  const bIntX = Sy;
  const bEdgX = Math.max(0.4, Sy / 2);
  const bIntY = Sx;
  const bEdgY = Math.max(0.4, Sx / 2);

  const MsoilX = amp * Math.max(-frIntX.Mmin, -frEdgX.Mmin, 0);
  const MtopX = amp * Math.max(frIntX.Mmax, frEdgX.Mmax, 0);
  const MsoilY = amp * Math.max(-frIntY.Mmin, -frEdgY.Mmin, 0);
  const MtopY = amp * Math.max(frIntY.Mmax, frEdgY.Mmax, 0);
  const flexPos = asFlex(MsoilX / Math.max(bIntX, 1), 100, d, fc, fy, t * 100);
  const flexNeg = asFlex(MtopX / Math.max(bIntX, 1), 100, d, fc, fy, t * 100);
  const flexPosY = asFlex(MsoilY / Math.max(bIntY, 1), 100, d, fc, fy, t * 100);
  const flexNegY = asFlex(MtopY / Math.max(bIntY, 1), 100, d, fc, fy, t * 100);
  const sPos = pickSlabBar(flexPos.As, t * 100);
  const sNeg = pickSlabBar(flexNeg.As, t * 100);
  const sPosY = pickSlabBar(flexPosY.As, t * 100);
  const sNegY = pickSlabBar(flexNegY.As, t * 100);

  const punList = loads.map((c) => {
    const pg = punchGeom(c.x - m.axesX[0], c.y - m.axesY[0], c.c.t1, c.c.t2, d / 100, Ly, Lx, painted);
    const beta = Math.max(c.c.t1, c.c.t2) / Math.max(Math.min(c.c.t1, c.c.t2), 0.1);
    const cap = punchCapacity(fc, pg.b0, d, beta, pg.alphaS);
    const am = punchMomentAmp(pg.kind);
    const Vu = Math.max(0, am * Math.max(0, c.Pu - qu * pg.Acrit));
    return { id: c.c.id, kind: pg.kind, Vu, phiVn: cap.phiVn, b0: pg.b0, ok: Vu <= cap.phiVn + 1e-6, poly: pg.poly, segs: pg.segs, x: pg.cx, y: pg.cy, t1: c.c.t1, t2: c.c.t2, govern: cap.govern, amp: am };
  });
  const worst = punList.reduce((a, b) => (b.Vu / Math.max(b.phiVn, 0.01) > a.Vu / Math.max(a.phiVn, 0.01) ? b : a), punList[0]);

  let MxS = 0;
  let MyS = 0;
  for (const c of loads) {
    MxS += c.Pserv * (c.y - geom.yc) + c.M2;
    MyS += c.Pserv * (c.x - geom.xc) + c.M3;
  }
  const Ixx = Math.max(geom.Ixx, 1e-4);
  const Iyy = Math.max(geom.Iyy, 1e-4);
  const qCol = PpS / A;
  const qAt = (x: number, y: number) => qCol + (MxS * (y - geom.yc)) / Ixx + (MyS * (x - geom.xc)) / Iyy;
  const qVerts: { x: number; y: number }[] = [];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      qVerts.push({ x: m.axesX[ix], y: m.axesY[iy] }, { x: m.axesX[ix + 1], y: m.axesY[iy] }, { x: m.axesX[ix], y: m.axesY[iy + 1] }, { x: m.axesX[ix + 1], y: m.axesY[iy + 1] });
    }
  }
  const qVals = qVerts.map((p) => qAt(p.x, p.y));
  const qmax = Math.max(...qVals, qCol);
  const qmin = Math.min(...qVals, qCol);

  const mBeams = ensureGradeBeams(m);
  const runs = collectGradeBeams(mBeams);
  const runPts = loads.map((c) => ({ x: c.x, y: c.y, P: c.Pu, M2: c.M2, M3: c.M3 }));
  const runRes = runs.map((run) => {
    const bl = loadsOnGradeBeam(run, runPts, runs);
    const sumP = bl.reduce((s, p) => s + p.P, 0);
    return { run, nCol: bl.length, beam: invertBeam(run.L, bl.length ? sumP / Math.max(run.L, 0.2) : 0, bl) };
  });
  const loadedRuns = runRes.filter((r) => r.nCol > 0);
  const govRun = (loadedRuns.length ? loadedRuns : runRes).reduce((a, b) => {
    const da = Math.max(Math.abs(a.beam.Mmax), Math.abs(a.beam.Mmin), a.beam.Vmax);
    const db = Math.max(Math.abs(b.beam.Mmax), Math.abs(b.beam.Mmin), b.beam.Vmax);
    return db > da ? b : a;
  }, loadedRuns[0] ?? runRes[0] ?? { run: undefined, nCol: 0, beam: frIntX });
  const govBeam = govRun?.beam ?? frIntX;
  const bBeamM = 0.4;
  const govStations = (govRun?.run
    ? loadsOnGradeBeam(govRun.run, runPts, runs)
    : lIntX
  ).map((c) => c.x);
  const faceVC = Math.max(0.15, (cTyp?.c.t1 ?? 0.4) / 2, (cTyp?.c.t2 ?? 0.4) / 2);
  const lnVC = clearSpanLn(govStations, govRun?.run?.L ?? Lx, faceVC);
  const hPred = predimHBeam(lnVC);
  let hBeamM = Math.max(t, 0.4, hPred);
  let dBeam = hBeamM * 100 - rec;
  let flexVcInf = asFlex(Math.max(-govBeam.Mmin, 0), bBeamM * 100, dBeam, fc, fy, hBeamM * 100);
  let flexVcSup = asFlex(Math.max(govBeam.Mmax, 0), bBeamM * 100, dBeam, fc, fy, hBeamM * 100);
  let vcInf = pickBeamBars(flexVcInf.As, bBeamM * 100, rec);
  let vcSup = pickBeamBars(Math.max(flexVcSup.As, 0.5), bBeamM * 100, rec);
  const estBar = barByName('3/8"');
  let shSt = designBeamStirrups({
    b: bBeamM * 100,
    h: hBeamM * 100,
    d: dBeam,
    rec: Math.min(rec, 5),
    fc,
    fy,
    Vu: govBeam.Vmax,
    VA: govBeam.Vmax,
    Av: 2 * estBar.as,
    L: govRun?.run?.L ?? Lx,
    destName: estBar.name,
    destDb: estBar.db,
    dbLong: vcInf.db,
    nRamas: 2,
    sismico: true,
  });
  for (let k = 0; k < 10; k++) {
    dBeam = hBeamM * 100 - rec;
    flexVcInf = asFlex(Math.max(-govBeam.Mmin, 0), bBeamM * 100, dBeam, fc, fy, hBeamM * 100);
    flexVcSup = asFlex(Math.max(govBeam.Mmax, 0), bBeamM * 100, dBeam, fc, fy, hBeamM * 100);
    vcInf = pickBeamBars(flexVcInf.As, bBeamM * 100, rec);
    vcSup = pickBeamBars(Math.max(flexVcSup.As, 0.5), bBeamM * 100, rec);
    shSt = designBeamStirrups({
      b: bBeamM * 100,
      h: hBeamM * 100,
      d: dBeam,
      rec: Math.min(rec, 5),
      fc,
      fy,
      Vu: govBeam.Vmax,
      VA: govBeam.Vmax,
      Av: 2 * estBar.as,
      L: govRun?.run?.L ?? Lx,
      destName: estBar.name,
      destDb: estBar.db,
      dbLong: vcInf.db,
      nRamas: 2,
      sismico: true,
    });
    if (shSt.sectionOk) break;
    hBeamM = round05(hBeamM + 0.05);
  }

  function franjaRow(name: string, b: number, beam: ReturnType<typeof invertBeam>) {
    const flexP = asFlex((amp * Math.max(-beam.Mmin, 0)) / b, 100, d, fc, fy, t * 100);
    const flexN = asFlex((amp * Math.max(beam.Mmax, 0)) / b, 100, d, fc, fy, t * 100);
    return [name, fmt(b, 2), fmt(amp * Math.max(-beam.Mmin, 0), 1), fmt(amp * Math.max(beam.Mmax, 0), 1), fmt(beam.Vmax, 1), fmt(flexP.As, 2), fmt(flexN.As, 2)];
  }

  const ldInf = ldTension(fy, fc, sPos.db);
  const ejemploNota = usedExample
    ? "Planta de ejemplo del expediente (editable en el croquis: paños y columnas con 6 GDL)."
    : "Planta del proyecto, unión de paños pintados.";

  return out(
    `Platea ${fmt(Lx, 2)}×${fmt(Ly, 2)}×${fmt(t, 2)} m  ·  ${rigido ? "rígida" : "flexible"}  ·  ${cols.length} col.`,
    `Inf. ${fmtBar(sPos)} / ${fmtBar(sPosY)}  ·  sup. ${fmtBar(sNeg)} / ${fmtBar(sNegY)}  ·  qmáx=${fmt(qmax, 2)} t/m². ${ejemploNota}`,
    [
      step(
        "01",
        "Geometría de la platea y columnas — 6 GDL",
        "A = Σ ℓx ℓy    ·    Pu = 1.5 P3    ·    M2c = M2 + P2 t    ·    M3c = M3 + P1 t",
        "A=\\sum \\ell_x \\ell_y\\qquad P_u=1.5 P_3\\qquad M_{2c}=M_2+P_2 t",
        `${nxOf(m)}×${nyOf(m)} paños    ·    ${nCells} activos    ·    Lx = ${fmt(Lx, 2)} m    ·    Ly = ${fmt(Ly, 2)} m    ·    ${ejemploNota}`,
        `A = ${fmt(A, 2)} m²    ·    baricentro (${fmt(geom.xc, 2)}, ${fmt(geom.yc, 2)}) m    ·    ${cols.length} columnas    ·    ΣP3 = ${fmt(PpS, 0)} t    ·    ΣPu = ${fmt(PpU, 0)} t`,
        "Paños apagados (patio) no entran al área ni a las franjas. Convenio ETABS: P1 = FX, P2 = FY, P3 = FZ, M1 torsión, M2 y M3 flexión.",
        {
          desarrollo: [
            ejemploNota,
            `A = Σ paños pintados = ${fmt(A, 2)} m². Ixx = ${fmt(geom.Ixx, 2)} m⁴, Iyy = ${fmt(geom.Iyy, 2)} m⁴.`,
            `Ejes: Lx = ${fmt(Lx, 2)} m (${nxOf(m)} vanos, Sx ≈ ${fmt(Sx, 2)} m), Ly = ${fmt(Ly, 2)} m (${nyOf(m)} vanos, Sy ≈ ${fmt(Sy, 2)} m).`,
            `Cada columna aporta P3 de servicio y Pu = 1.5 P3. Los momentos se trasladan al plano de contacto con t = ${fmt(t, 2)} m.`,
          ],
          table: {
            caption: "Columnas — 6 GDL de servicio",
            headers: ["Col", "x", "y", "t1×t2", "P1", "P2", "P3", "M1", "M2", "M3", "Pu", "M2c", "M3c"],
            rows: loads.map((c) => [
              c.c.id,
              fmt(c.x, 2),
              fmt(c.y, 2),
              `${fmt(c.c.t1, 2)}×${fmt(c.c.t2, 2)}`,
              fmt(c.c.P1, 1),
              fmt(c.c.P2, 1),
              fmt(c.Pserv, 1),
              fmt(c.c.M1, 1),
              fmt(c.c.M2, 1),
              fmt(c.c.M3, 1),
              fmt(c.Pu, 1),
              fmt(c.M2, 2),
              fmt(c.M3, 2),
            ]),
          },
        },
      ),
      step(
        "02",
        "Metrado de cargas sobre el suelo",
        "ΣP = ΣPcol + γc t A + γt (Df − t) A + s/c A",
        "\\sum P=\\sum P_{col}+\\gamma_c t A+\\gamma_t(D_f-t)A+s/c\\,A",
        `A = ${fmt(A, 1)} m²    ·    t = ${fmt(t, 2)} m    ·    Df = ${fmt(Df, 2)} m    ·    γc = 2.4 t/m³    ·    γt = ${fmt(gt, 2)} t/m³    ·    s/c = ${fmt(sc, 2)} t/m²`,
        `Columnas ${fmt(PpS, 0)} t    ·    losa ${fmt(Wslab, 0)} t    ·    relleno ${fmt(Wfill, 0)} t    ·    s/c ${fmt(sc * A, 0)} t    → ΣP = ${fmt(Pts, 0)} t    ·    ΣPu = ${fmt(Put, 0)} t`,
        "La platea y el relleno también cargan el suelo. No se diseñan las franjas solo con las columnas.",
        {
          desarrollo: [
            `Peso de la platea: γc t A = 2.4 × ${fmt(t, 2)} × ${fmt(A, 1)} = ${fmt(Wslab, 0)} t.`,
            `Relleno sobre la platea: γt (Df − t) A = ${fmt(gt, 2)} × ${fmt(Math.max(Df - t, 0), 2)} × ${fmt(A, 1)} = ${fmt(Wfill, 0)} t.`,
            `Sobrecarga de piso: ${fmt(sc, 2)} × ${fmt(A, 1)} = ${fmt(sc * A, 0)} t.`,
            `Servicio ΣP = ${fmt(PpS, 0)} + ${fmt(Wslab, 0)} + ${fmt(Wfill, 0)} + ${fmt(sc * A, 0)} = ${fmt(Pts, 0)} t.`,
            `Última ΣPu = Σ 1.5 P3 + 1.4 (losa+relleno) + 1.7 s/c = ${fmt(Put, 0)} t.`,
          ],
        },
      ),
      step(
        "03",
        "Presión media y esfuerzo neto — E.050",
        "q = ΣP/A    ·    qu = ΣPu/A    ·    σn = σadm − γt Df − γc t − s/c",
        "q=\\sum P/A\\qquad \\sigma_n=\\sigma_{adm}-\\gamma_t D_f-\\gamma_c t-s/c",
        `σadm = ${fmt(qadm, 2)} kg/cm² = ${fmt(qadm * 10, 2)} t/m²    ·    A = ${fmt(A, 1)} m²`,
        `σn = ${fmt(qn, 2)} t/m²    ·    q col. = ${fmt(qCol, 2)}    ·    qmáx = ${fmt(qmax, 2)}    ·    qmín = ${fmt(qmin, 2)} t/m²    ·    q bruta = ${fmt(qserv, 2)} t/m²`,
        "σn es el admisible NETO (ya descontó relleno, platea y s/c). q en planta se calcula con las columnas: ΣP/A ± Mc/I. Comparar la presión bruta contra σn duplicaría el peso propio.",
        {
          ok: qmax <= qn + 0.05 && qn > 0 && qmin >= -0.02,
          desarrollo: [
            `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(t, 2)} − ${fmt(sc, 2)} = ${fmt(qn, 2)} t/m².`,
            `q de columnas = ΣP3/A = ${fmt(PpS, 0)}/${fmt(A, 1)} = ${fmt(qCol, 2)} t/m². Presión bruta (información) qserv = ${fmt(qserv, 2)} t/m² vs σadm = ${fmt(qadm * 10, 2)}.`,
            `q(x,y) = ΣP/A ± Mx cy/Ixx ± My cx/Iyy. qmáx = ${fmt(qmax, 2)} ${qmax <= qn + 0.05 ? "≤ σn (CUMPLE)" : "> σn (NO — ensanchar o recentrar)"}. qmín = ${fmt(qmin, 2)} t/m².`,
          ],
          table: {
            caption: "Presión neta en vértices (solo columnas)",
            headers: ["Vértice", "x (m)", "y (m)", "q (t/m²)"],
            rows: qVerts.slice(0, 12).map((p, i) => [`V${i + 1}`, fmt(p.x, 2), fmt(p.y, 2), fmt(qAt(p.x, p.y), 2)]),
          },
        },
      ),
      step(
        "04",
        "Radio de rigidez de Westergaard — rígida o flexible",
        "l = ⁴√[Ec h³ / (12 (1−ν²) Ks)]    ·    Lc = min(Sx, Sy)/2    ·    Lc/l < 1.75 → rígida",
        "l=\\sqrt[4]{\\dfrac{E_c h^3}{12(1-\\nu^2)K_s}}",
        `Ec = 15 000 √f'c = ${fmt(Ec, 0)} kg/cm²    ·    h = ${fmt(t * 100, 0)} cm    ·    Ks = ${fmt(Ks, 1)} kg/cm³    ·    ν = 0.20`,
        `l = ${fmt(lRad, 0)} cm    ·    Lc = ${fmt(Lc, 0)} cm    ·    Lc/l = ${fmt(ratio, 2)}    ·    ${rigido ? "PLATEA RÍGIDA" : "PLATEA FLEXIBLE (momentos ×1.20)"}`,
        rigido
          ? "Reparte como sólido: franjas = vigas libre-libre con reacción y las Pu de la fila (método de fajas, ACI / Bowles)."
          : "Lc/l ≥ 1.75: concentración bajo columnas. Se mayoran los momentos de franja 1.20 (Winkler aproximado). Un modelo de resortes es el siguiente paso si la planta es muy irregular.",
        {
          desarrollo: [
            `Ec = 15 000 √${fmt(fc, 0)} = ${fmt(Ec, 0)} kg/cm² (E.060).`,
            `l = [Ec h³ / (12 (1−ν²) Ks)]^{1/4} = ${fmt(lRad, 0)} cm.`,
            `Lc = min(${fmt(Sx, 2)}, ${fmt(Sy, 2)}) / 2 = ${fmt(Lc / 100, 2)} m = ${fmt(Lc, 0)} cm.`,
            `Lc/l = ${fmt(ratio, 2)} ${rigido ? "< 1.75 → rígida (amp = 1.00)." : "≥ 1.75 → flexible (amp = 1.20)."}`,
          ],
        },
      ),
      step(
        "05",
        "Espesor de platea — iteración (punzonamiento gobierna)",
        "t ← t + 5 cm hasta Vu ≤ φVn (todas las columnas) y corte 1 dir.    ·    t ≥ 35 cm y ≥ L/20",
        "t\\leftarrow t+0.05\\,\\mathrm{m}\\quad d=t-\\mathrm{rec}",
        `t inicial = ${fmt(tIn, 2)} m    ·    rec = ${fmt(rec, 1)} cm (E.060 7.7.1 ≥ 7.5 cm)    ·    L/20 ≈ ${fmt(Math.max(Sx, Sy) / 20, 2)} m`,
        `t = ${fmt(t, 2)} m    ·    d = ${fmt(d, 1)} cm    ·    ${okT ? "CUMPLE el lazo" : "revise luces / t / punzonamiento"}`,
        "El punzonamiento suele gobernar el espesor. σn no se «arregla» subiendo t: al contrario, más peso propio reduce el admisible neto. Si qmáx > σn hay que ensanchar la planta.",
        {
          desarrollo: [
            `Se parte de t = ${fmt(tIn, 2)} m y se sube de 5 en 5 cm.`,
            `Peralte d = 100 t − rec = ${fmt(d, 1)} cm.`,
            `El lazo exige Vu ≤ φVn en la peor columna (con α de esquina/borde), Vu ≤ φVc a d de la cara, t ≥ máx(35 cm, L/20) y σn > 0. La presión qmáx ≤ σn se verifica aparte (E.050).`,
          ],
          table: { caption: "Iteración de espesor t (punzonamiento de la peor columna)", headers: ["i", "t (m)", "d (cm)", "σn", "q col.", "Vu/φVn", "Vu/φVc 1 dir.", "¿OK?"], rows: rowsH },
        },
      ),
      step(
        "06",
        "Franja interior eje X — método de fajas",
        "w = ΣPu,fila / Lx    ·    V(x) = w x − Σ Pu    ·    M(x) = w x²/2 − Σ Pu (x−xi)",
        "M(x)=\\dfrac{w x^2}{2}-\\sum P_u(x-x_i)",
        `b = ${fmt(bIntX, 2)} m    ·    w = ${fmt(sum(lIntX) / Math.max(LxUse, 0.2), 2)} t/m    ·    ${lIntX.length} columnas en la fila    ·    amp = ${fmt(amp, 2)}`,
        `M+ = ${fmt(frIntX.Mmax, 1)} t·m    ·    M− = ${fmt(frIntX.Mmin, 1)} t·m    ·    Vmáx = ${fmt(frIntX.Vmax, 1)} t    ·    con amp: Msuelo = ${fmt(amp * Math.max(-frIntX.Mmin, 0), 1)} t·m`,
        "Motor FEM de viga invertida (extremos libres, q lineal de equilibrio). M− = lecho inferior, cortado en cada paño con gancho en los ejes. M+ = lecho superior en tramos L_teo+ℓd desde el eje. V(L) ≈ 0 cierra el equilibrio de la fila.",
        {
          desarrollo: [
            `Ancho tributario interior = Sy = ${fmt(bIntX, 2)} m.`,
            `w = Σ Pu de la fila / Lx = ${fmt(sum(lIntX), 1)} / ${fmt(LxUse, 2)} = ${fmt(sum(lIntX) / Math.max(LxUse, 0.2), 2)} t/m.`,
            `Lecho inf. (Msuelo = −Mmín): ${fmt(amp * Math.max(-frIntX.Mmin, 0), 1)} t·m → malla corrida ${fmtBar(sPos)}.`,
            `Lecho sup. (Mvuelo = Mmáx): ${fmt(amp * Math.max(frIntX.Mmax, 0), 1)} t·m → malla cortada ${fmtBar(sNeg)} con L_teo+ℓd.`,
            `Cortante Vmáx = ${fmt(frIntX.Vmax, 1)} t. ${!rigido ? "Platea flexible: momentos × 1.20." : "Platea rígida: sin mayorar."}`,
          ],
        },
      ),
      step(
        "07",
        "Franja de borde eje X",
        "Igual integración, fila de borde    ·    b ≈ Sy/2",
        "M(x)=\\dfrac{w x^2}{2}-\\sum P_u(x-x_i)",
        `b = ${fmt(bEdgX, 2)} m    ·    w = ${fmt(sum(lEdgX) / Math.max(LxUse, 0.2), 2)} t/m    ·    ${lEdgX.length} columnas`,
        `M+ = ${fmt(frEdgX.Mmax, 1)} t·m    ·    M− = ${fmt(frEdgX.Mmin, 1)} t·m    ·    Vmáx = ${fmt(frEdgX.Vmax, 1)} t`,
        "El vuelo de borde suele gobernar el lecho superior (tramos L_teo+ℓd). El inferior de cada paño se corta en sus ejes.",
        {
          desarrollo: [
            `Ancho de borde ≈ Sy/2 = ${fmt(bEdgX, 2)} m. Motor FEM independiente de la franja interior.`,
            `Lecho inf. Msuelo = ${fmt(amp * Math.max(-frEdgX.Mmin, 0), 1)} t·m. Lecho sup. Mvuelo = ${fmt(amp * Math.max(frEdgX.Mmax, 0), 1)} t·m. Vmáx = ${fmt(frEdgX.Vmax, 1)} t.`,
          ],
        },
      ),
      step(
        "08",
        "Franjas transversales (eje Y)",
        "M(y) = w y²/2 − Σ Pu (y−yi)    ·    se arma en dos direcciones",
        "M(y)=\\dfrac{w y^2}{2}-\\sum P_u(y-y_i)",
        `interior b = ${fmt(bIntY, 2)} m    ·    borde b = ${fmt(bEdgY, 2)} m    ·    Ly = ${fmt(LyUse, 2)} m`,
        `Int. M+ = ${fmt(frIntY.Mmax, 1)} t·m    M− = ${fmt(frIntY.Mmin, 1)} t·m    ·    Borde M+ = ${fmt(frEdgY.Mmax, 1)} t·m    M− = ${fmt(frEdgY.Mmin, 1)} t·m`,
        "Cada franja Y tiene su propio motor FEM. Por cara gobierna el mayor Mu/b. Inferior continuo en X e Y; superior cortado sobre ejes de columna.",
        {
          desarrollo: [
            `Interior Y: inf. ${fmt(amp * Math.max(-frIntY.Mmin, 0), 1)} t·m · sup. ${fmt(amp * Math.max(frIntY.Mmax, 0), 1)} t·m · V = ${fmt(frIntY.Vmax, 1)} t.`,
            `Borde Y: inf. ${fmt(amp * Math.max(-frEdgY.Mmin, 0), 1)} t·m · sup. ${fmt(amp * Math.max(frEdgY.Mmax, 0), 1)} t·m · V = ${fmt(frEdgY.Vmax, 1)} t.`,
            `Diseño con amp = ${fmt(amp, 2)}: Msuelo X/Y = ${fmt(MsoilX, 1)} / ${fmt(MsoilY, 1)} t·m · Mvuelo X/Y = ${fmt(MtopX, 1)} / ${fmt(MtopY, 1)} t·m.`,
          ],
        },
      ),
      step(
        "09",
        "Acero por metro — mallas inferior y superior",
        "As = Mu / (φ fy j d) por metro    ·    Asmín = 0.0018 t    ·    s ≤ 3t y ≤ 45 cm",
        "A_s=\\max\\left(\\dfrac{M_u}{\\phi f_y j d},0.0018 t\\right)",
        `d = ${fmt(d, 1)} cm    ·    Mu suelo X = ${fmt(MsoilX / Math.max(bIntX, 1), 2)} t·m/m    ·    Mu vuelo X = ${fmt(MtopX / Math.max(bIntX, 1), 2)} t·m/m`,
        `Inf. X ${fmtBar(sPos)} (As ${fmt(flexPos.As, 2)} cm²/m)    ·    Inf. Y ${fmtBar(sPosY)}    ·    Sup. X ${fmtBar(sNeg)}    ·    Sup. Y ${fmtBar(sNegY)}`,
        "En bandas de columna se puede densificar; en el centro del paño no bajar de Asmín. El Ø gobernante se repite en cada paño; el cuadro da n y L de ese paño.",
        {
          desarrollo: [
            `Mu/b suelo X = ${fmt(MsoilX, 1)} / ${fmt(bIntX, 2)} = ${fmt(MsoilX / Math.max(bIntX, 1), 2)} t·m/m → As inf. X = ${fmt(flexPos.As, 2)} cm²/m → ${fmtBar(sPos)}.`,
            `Mu/b vuelo X = ${fmt(MtopX / Math.max(bIntX, 1), 2)} t·m/m → As sup. X = ${fmt(flexNeg.As, 2)} cm²/m → ${fmtBar(sNeg)}.`,
            `Igual en Y: inf. ${fmtBar(sPosY)} (As ${fmt(flexPosY.As, 2)}), sup. ${fmtBar(sNegY)} (As ${fmt(flexNegY.As, 2)}).`,
            `Asmín = 0.0018 × 100 × ${fmt(t * 100, 0)} = ${fmt(0.0018 * 100 * t * 100, 2)} cm²/m. s máx = mín(3t, 45) = ${fmt(Math.min(3 * t * 100, 45), 0)} cm.`,
          ],
        },
      ),
      step(
        "10",
        "Punzonamiento — perímetro crítico, Vu y φVn",
        "Vu = α (Pu − qu Acrit)    ·    vc = mín{0.53(2+4/βc), 0.53(αs d/b0+2), 1.06} √f'c    ·    φVn = 0.85 vc b0 d",
        "V_u=\\alpha(P_u-q_u A_{\\mathrm{crit}})\\qquad v_c=\\min\\{0.53(2+4/\\beta_c),\\,0.53(\\alpha_s d/b_0+2),\\,1.06\\}\\sqrt{f'_c}",
        `Gobernante ${worst.id} (${worst.kind})    ·    α = ${fmt(worst.amp, 2)}    ·    b0 = ${fmt(worst.b0, 1)} cm    ·    αs = ${worst.kind === "interior" ? 40 : worst.kind === "borde" ? 30 : 20}    ·    criterio ${worst.govern}    ·    d = ${fmt(d, 1)} cm`,
        `Vu = ${fmt(worst.Vu, 2)} t    ·    φVn = ${fmt(worst.phiVn, 2)} t    ·    Vu/φVn = ${fmt(worst.Vu / Math.max(worst.phiVn, 0.01), 2)}    ·    ${worst.ok ? "CUMPLE" : "NO"}`,
        "αs = 40 interior, 30 borde, 20 esquina. α = 1,00 / 1,15 / 1,25 cubre de forma simplificada la transferencia de momento (E.060 11.12.6). El espesor se itera hasta que TODAS las columnas cumplen, no solo la de mayor Pu.",
        {
          ok: punList.every((p) => p.ok),
          desarrollo: [
            `Se verifica cada columna. Vu = α (Pu − qu Acrit). α = 1,15 en borde y 1,25 en esquina.`,
            `Gobernante ${worst.id}: tipo ${worst.kind}, α = ${fmt(worst.amp, 2)}, b0 = ${fmt(worst.b0, 1)} cm, Vu = ${fmt(worst.Vu, 2)} t frente a φVn = ${fmt(worst.phiVn, 2)} t.`,
            `${punList.filter((p) => p.ok).length} de ${punList.length} columnas cumplen. ${punList.every((p) => p.ok) ? "Todas OK." : "Hay columnas que no cumplen: subir t."}`,
          ],
          table: {
            caption: "Punzonamiento por columna",
            headers: ["Col", "tipo", "α", "b0 (cm)", "Vu (t)", "φVn (t)", "Vu/φVn", "¿OK?"],
            rows: punList.map((p) => [p.id, p.kind, fmt(p.amp, 2), fmt(p.b0, 1), fmt(p.Vu, 1), fmt(p.phiVn, 1), fmt(p.Vu / Math.max(p.phiVn, 0.01), 2), p.ok ? "OK" : "NO"]),
          },
        },
      ),
      step(
        "11",
        "Corte en una dirección (franja)",
        "Vu = qu b (L/2 − c/2 − d)    ·    φVc = 0.85 · 0.53 √f'c b d",
        "\\phi V_c=0.85\\cdot 0.53\\sqrt{f'_c}\\,bd",
        `b = ${fmt(Sy, 2)} m = ${fmt(Sy * 100, 0)} cm    ·    ℓ = ${fmt(Math.max(Sx / 2 - cTyp.c.t2 / 2, 0), 2)} m    ·    d = ${fmt(d, 1)} cm    ·    f'c = ${fmt(fc, 0)}`,
        `Vu = ${fmt(shX.Vu, 1)} t    ·    φVc = ${fmt(shX.phiVc, 1)} t    ·    ${shX.ok ? "CUMPLE" : "NO"}`,
        "Sección a d de la cara de la columna, en la franja de ancho Sy. Complementa el punzonamiento (dos direcciones).",
        {
          ok: shX.ok,
          desarrollo: [
            `Vu = qu × b × (Sx/2 − c/2 − d) = ${fmt(qu, 2)} × ${fmt(Sy, 2)} × ${fmt(Math.max(Sx / 2 - cTyp.c.t2 / 2 - d / 100, 0), 2)} = ${fmt(shX.Vu, 1)} t.`,
            `φVc = 0.85 × 0.53 × √${fmt(fc, 0)} × ${fmt(Sy * 100, 0)} × ${fmt(d, 1)} / 1000 = ${fmt(shX.phiVc, 1)} t.`,
            shX.ok ? `Vu/φVc = ${fmt(shX.Vu / Math.max(shX.phiVc, 0.01), 2)} ≤ 1. CUMPLE.` : "NO cumple: subir t.",
          ],
        },
      ),
      step(
        "12",
        "Desarrollo y anclaje — E.060 12.2",
        "ℓd = 0.075 fy db / √f'c    ·    gancho 90° ≥ 12 db",
        "\\ell_d=0.075\\,f_y d_b/\\sqrt{f'_c}",
        `fy = ${fmt(fy, 0)}    ·    f'c = ${fmt(fc, 0)}    ·    db inf. X = ${fmt(sPos.db, 2)} cm`,
        `ℓd inf. X = ${fmt(ldInf, 1)} cm    ·    gancho 90° ≥ ${fmt(12 * sPos.db, 1)} cm    ·    rec = ${fmt(rec, 1)} cm`,
        "Las mallas se anclan en bordes y huecos con gancho 90°. En bandas de columna el negativo cubre ~ℓn/4 a cada lado del eje.",
        {
          desarrollo: [
            `ℓd = 0.075 × ${fmt(fy, 0)} × ${fmt(sPos.db, 2)} / √${fmt(fc, 0)} = ${fmt(ldInf, 1)} cm para ${fmtBar(sPos)}.`,
            `Recubrimiento de cimentación ${fmt(rec, 1)} cm ≥ 7.5 cm (E.060 7.7.1).`,
            `Lecho inf. por paño: L = luz del paño − 2 rec + 2 ganchos de 12 db. Lecho sup.: cada tramo mide L_teo + ℓd desde el eje; la barra de taller del eje interior es la suma de los dos tramos.`,
          ],
        },
      ),
      step(
        "13",
        "Vigas de cimentación — predimensión ℓn/7 y viga invertida",
        "h = ℓn / 7    ·    q(x)=a+bx    ·    M− inf. continuo    ·    M+ sup. L_teo+ℓd",
        "h=\\ell_n/7\\qquad q(x)=a+bx\\qquad M(0)=M(L)=0",
        `ℓn libre = ${fmt(lnVC, 2)} m    ·    h_pred = ℓn/7 = ${fmt(hPred, 2)} m    ·    gobierna ${govRun?.run?.id ?? "—"}    ·    L = ${fmt(govRun?.run?.L ?? Lx, 2)} m    ·    ${govRun?.nCol ?? 0} col.`,
        `h = ${fmt(hBeamM, 2)} m    ·    M− inf. = ${fmt(Math.max(-govBeam.Mmin, 0), 2)} t·m → ${vcInf.text}    ·    M+ sup. = ${fmt(Math.max(govBeam.Mmax, 0), 2)} t·m → ${vcSup.text}    ·    Vmáx = ${fmt(govBeam.Vmax, 1)} t    ·    est. ${shSt.arregloPlano}`,
        "Motor propio de VC, distinto de las franjas de platea. Predimensión h = longitud libre entre caras de columna / 7. Si el cortante no cierra, se sube de 5 en 5 cm. Inferior corrido; superior cortado sobre apoyos.",
        {
          ok: shSt.sectionOk,
          desarrollo: [
            `Luz libre ℓn = máx. distancia entre caras de columna del tramo = ${fmt(lnVC, 2)} m.`,
            `Predimensión h = ℓn/7 = ${fmt(lnVC, 2)}/7 = ${fmt(hPred, 2)} m (mín. 40 cm y ≥ t de platea). Adoptado h = ${fmt(hBeamM, 2)} m, d = ${fmt(dBeam, 1)} cm.`,
            `Viga invertida: q(0) = ${fmt(govBeam.q0 ?? 0, 2)} t/m, q(L) = ${fmt(govBeam.qL ?? 0, 2)} t/m. V(L) ≈ ${fmt(govBeam.Vend, 2)} t.`,
            `Lecho inf. (M− cara del suelo) As = ${fmt(flexVcInf.As, 2)} cm² → ${vcInf.text}, continuo.`,
            `Lecho sup. (M+ en vuelos) As = ${fmt(flexVcSup.As, 2)} cm² → ${vcSup.text}, L_teo+ℓd desde cada eje.`,
            `Estribos 2Ø ${estBar.name}: ${shSt.arregloPlano}. Vu = ${fmt(govBeam.Vmax, 1)} t vs φ(Vc+Vs) = ${fmt(0.85 * (shSt.Vc + shSt.VsMax), 1)} t. ${shSt.sectionOk ? "CUMPLE." : "NO — se subió h."}`,
          ],
        },
      ),
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)}`, `≤ ${fmt(qn, 2)}`, qmax <= qn + 0.05 && qn > 0),
      ok("qmín ≥ 0", `${fmt(qmin, 2)}`, "≥ 0", qmin >= -0.02),
      ok("Rigidez Westergaard", fmt(ratio, 2), rigido ? "< 1.75 rígida" : "≥ 1.75 ×1.20", true),
      ok("Punzonamiento gobernante", `${fmt(worst.Vu, 1)} t`, `≤ ${fmt(worst.phiVn, 1)} t`, worst.ok),
      ok("Todas las columnas, punzonamiento", `${punList.filter((p) => p.ok).length}/${punList.length}`, "todas OK", punList.every((p) => p.ok)),
      ok("Corte 1 dir.", `${fmt(shX.Vu, 1)} t`, `≤ ${fmt(shX.phiVc, 1)}`, shX.ok),
      ok("Cortante de VC", `${fmt(govBeam.Vmax, 1)} t`, `≤ ${fmt(0.85 * (shSt.Vc + shSt.VsMax), 1)} t`, shSt.sectionOk),
      ok("t ≥ 35 cm", `${fmt(t * 100, 0)} cm`, "≥ 35", t >= 0.35),
    ],
    [
      {
        title: "Resumen de franjas",
        rows: [
          ["Franja", "b (m)", "Msuelo (t·m)", "Mvuelo (t·m)", "Vmáx (t)", "As inf.", "As sup."],
          franjaRow("Interior X", bIntX, frIntX),
          franjaRow("Borde X", bEdgX, frEdgX),
          franjaRow("Interior Y", bIntY, frIntY),
          franjaRow("Borde Y", bEdgY, frEdgY),
        ],
      },
    ],
    {
      Lx: Lx.toFixed(2),
      Ly: Ly.toFixed(2),
      t: t.toFixed(2),
      Sx: Sx.toFixed(2),
      Sy: Sy.toFixed(2),
      nBayX: String(nxOf(m)),
      nBayY: String(nyOf(m)),
      mPtsIntX: packPts(frIntX.pts),
      mPtsEdgX: packPts(frEdgX.pts),
      mPtsIntY: packPts(frIntY.pts),
      mPtsEdgY: packPts(frEdgY.pts),
      vPtsIntX: packV(frIntX.pts),
      vPtsEdgX: packV(frEdgX.pts),
      vPtsIntY: packV(frIntY.pts),
      vPtsEdgY: packV(frEdgY.pts),
      vIntXVmax: frIntX.Vmax.toFixed(2),
      vEdgXVmax: frEdgX.Vmax.toFixed(2),
      vIntYVmax: frIntY.Vmax.toFixed(2),
      vEdgYVmax: frEdgY.Vmax.toFixed(2),
      bIntX: bIntX.toFixed(2),
      bEdgX: bEdgX.toFixed(2),
      bIntY: bIntY.toFixed(2),
      bEdgY: bEdgY.toFixed(2),
      mIntXMpos: (amp * Math.max(frIntX.Mmax, 0)).toFixed(2),
      mIntXMneg: (amp * Math.max(-frIntX.Mmin, 0)).toFixed(2),
      mEdgXMpos: (amp * Math.max(frEdgX.Mmax, 0)).toFixed(2),
      mEdgXMneg: (amp * Math.max(-frEdgX.Mmin, 0)).toFixed(2),
      mIntYMpos: (amp * Math.max(frIntY.Mmax, 0)).toFixed(2),
      mIntYMneg: (amp * Math.max(-frIntY.Mmin, 0)).toFixed(2),
      mEdgYMpos: (amp * Math.max(frEdgY.Mmax, 0)).toFixed(2),
      mEdgYMneg: (amp * Math.max(-frEdgY.Mmin, 0)).toFixed(2),
      asInfX: fmtBar(sPos),
      asInfY: fmtBar(sPosY),
      asSupX: fmtBar(sNeg),
      asSupY: fmtBar(sNegY),
      asPos: fmtBar(sPos),
      asNeg: fmtBar(sNeg),
      AsPos: flexPos.As.toFixed(2),
      AsInfX: flexPos.As.toFixed(2),
      AsInfY: flexPosY.As.toFixed(2),
      AsSupX: flexNeg.As.toFixed(2),
      AsSupY: flexNegY.As.toFixed(2),
      punchVu: worst.Vu.toFixed(2),
      punchPhi: worst.phiVn.toFixed(2),
      punchOk: worst.ok ? "1" : "0",
      punchB0: worst.b0.toFixed(1),
      punchKind: worst.kind,
      punchJson: JSON.stringify({
        L: Lx,
        B: Ly,
        Lx,
        Ly,
        d: d / 100,
        col: { x: worst.x, y: worst.y, t1: worst.t1, t2: worst.t2, id: worst.id },
        poly: worst.poly,
        segs: worst.segs,
        Vu: worst.Vu,
        phiVn: worst.phiVn,
        b0: worst.b0,
        kind: worst.kind,
        ok: worst.ok,
        slab: painted,
      }),
      Lbeam: (govRun?.run?.L ?? Lx).toFixed(2),
      bBeam: bBeamM.toFixed(2),
      hBeam: hBeamM.toFixed(2),
      lnVC: lnVC.toFixed(2),
      hPred: hPred.toFixed(2),
      asVCInf: vcInf.text,
      asVCSup: vcSup.text,
      AsVCInf: flexVcInf.As.toFixed(2),
      AsVCSup: flexVcSup.As.toFixed(2),
      VmaxVC: govBeam.Vmax.toFixed(2),
      estVC: `2Ø ${estBar.name} ${shSt.arregloPlano}`,
      sApoyoVC: String(shSt.sApoyo),
      sCentroVC: String(shSt.sCentro),
      nEstVC: String(shSt.nTotal),
      LzonaVC: shSt.Lzona.toFixed(2),
      Msoil: Math.max(-govBeam.Mmin, 0).toFixed(2),
      Mtop: Math.max(govBeam.Mmax, 0).toFixed(2),
      mPts: packPts(govBeam.pts),
      vPts: packV(govBeam.pts),
      vcColsJson: JSON.stringify({
        cols: (govRun?.run
          ? loadsOnGradeBeam(govRun.run, runPts, runs)
          : lIntX
        ).map((c, i) => ({ x: c.x, P: c.P, M: c.M, id: `C${i + 1}` })),
      }),
      studioJson: str(raw, "studioJson", ""),
      gridJson: str(raw, "gridJson", ""),
    },
  );
};
