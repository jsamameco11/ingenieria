import { fmt, num, str, type Engine } from "../../types";
import { invertBeam, packPts } from "./matrixBeam";
import { asFlex, fmtBar, ldTension, ok, oneWayShear, out, pendingPlantOut, pickSlabBar, punchCapacity, punchGeom, round05, step } from "./steel";
import {
  cellOn,
  colXY,
  defaultModel,
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
      cols?: { ix: number; iy: number; t1: number; t2: number; P1: number; P2: number; P3: number; M1: number; M2: number; M3: number }[];
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
        }))
      : [];
    if (!j.placed && (!j.cols || j.cols.length === 0)) {
      const c = num(raw, "c", 0.4);
      const P3 = (num(raw, "PdInt", 80) + num(raw, "PlInt", 30)) || 80;
      fb.cols = [];
      for (let iy = 0; iy < fb.axesY.length; iy++) {
        for (let ix = 0; ix < fb.axesX.length; ix++) {
          fb.cols.push({ id: `C${ix + 1}${iy + 1}`, ix, iy, t1: c, t2: c, P1: 0, P2: 0, P3, M1: 0, M2: 0, M3: 0, ex: 0, ey: 0, centered: true });
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
  for (let i = 0; i < 14; i++) {
    d = t * 100 - rec;
    qn = qNet(qadm, gt, Df, t, sc);
    Wslab = 2.4 * t * A;
    Wfill = gt * Math.max(Df - t, 0) * A;
    Pts = PpS + Wslab + Wfill + sc * A;
    Put = PpU + 1.4 * (Wslab + Wfill) + 1.7 * sc * A;
    qserv = Pts / A;
    qu = Put / A;
    const pg = punchGeom(cTyp.x - m.axesX[0], cTyp.y - m.axesY[0], cTyp.c.t1, cTyp.c.t2, d / 100, Ly, Lx);
    const beta = Math.max(cTyp.c.t1, cTyp.c.t2) / Math.max(Math.min(cTyp.c.t1, cTyp.c.t2), 0.1);
    const cap = punchCapacity(fc, pg.b0, d, beta, pg.alphaS);
    const Vu = Math.max(0, cTyp.Pu - qu * pg.Acrit);
    shX = oneWayShear(qu * Math.max(Sx / 2 - cTyp.c.t2 / 2 - d / 100, 0) * Sy, Sy * 100, d, fc);
    const hMin = Math.max(0.35, Math.max(Sx, Sy) / 20);
    okT = qn > 0 && qserv <= qn + 0.05 && Vu <= cap.phiVn + 1e-6 && shX.ok && t + 1e-9 >= hMin;
    rowsH.push([
      String(i + 1),
      t.toFixed(2),
      d.toFixed(1),
      qn.toFixed(2),
      qserv.toFixed(2),
      `${Vu.toFixed(1)}/${cap.phiVn.toFixed(1)}`,
      `${shX.Vu.toFixed(1)}/${shX.phiVc.toFixed(1)}`,
      okT ? "OK" : "NO",
    ]);
    if (okT) break;
    t = round05(t + 0.05);
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
    const pg = punchGeom(c.x - m.axesX[0], c.y - m.axesY[0], c.c.t1, c.c.t2, d / 100, Ly, Lx);
    const beta = Math.max(c.c.t1, c.c.t2) / Math.max(Math.min(c.c.t1, c.c.t2), 0.1);
    const cap = punchCapacity(fc, pg.b0, d, beta, pg.alphaS);
    const Vu = Math.max(0, c.Pu - qu * pg.Acrit);
    return { id: c.c.id, kind: pg.kind, Vu, phiVn: cap.phiVn, b0: pg.b0, ok: Vu <= cap.phiVn + 1e-6, poly: pg.poly, x: c.x - m.axesX[0], y: c.y - m.axesY[0], t1: c.c.t1, t2: c.c.t2, govern: cap.govern };
  });
  const worst = punList.reduce((a, b) => (b.Vu / Math.max(b.phiVn, 0.01) > a.Vu / Math.max(a.phiVn, 0.01) ? b : a), punList[0]);

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
    `Inf. ${fmtBar(sPos)} / ${fmtBar(sPosY)}  ·  sup. ${fmtBar(sNeg)} / ${fmtBar(sNegY)}  ·  q=${fmt(qserv, 2)} t/m². ${ejemploNota}`,
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
        `q = ${fmt(qserv, 2)} t/m²    ·    qu = ${fmt(qu, 2)} t/m²    ·    σn = ${fmt(qn, 2)} t/m²    ·    ${qserv <= qn + 0.05 && qn > 0 ? "CUMPLE" : "NO"}`,
        "Platea rígida: q se toma uniforme si el centroide de cargas ≈ centroide de área. Si no, q(x,y) = P/A ± Mc/I (igual que zapata).",
        {
          ok: qserv <= qn + 0.05 && qn > 0,
          desarrollo: [
            `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(t, 2)} − ${fmt(sc, 2)} = ${fmt(qn, 2)} t/m².`,
            `q = ${fmt(Pts, 0)} / ${fmt(A, 1)} = ${fmt(qserv, 2)} t/m². qu = ${fmt(Put, 0)} / ${fmt(A, 1)} = ${fmt(qu, 2)} t/m².`,
            qserv <= qn + 0.05 && qn > 0 ? `q / σn = ${fmt(qserv / Math.max(qn, 0.01), 2)} ≤ 1. CUMPLE E.050.` : "q supera σn: ensanchar platea, bajar t o mejorar el suelo.",
          ],
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
        "t ← t + 5 cm hasta q ≤ σn, Vu ≤ φVn y corte 1 dir.    ·    t ≥ 35 cm y ≥ L/20",
        "t\\leftarrow t+0.05\\,\\mathrm{m}\\quad d=t-\\mathrm{rec}",
        `t inicial = ${fmt(tIn, 2)} m    ·    rec = ${fmt(rec, 1)} cm (E.060 7.7.1 ≥ 7.5 cm)    ·    L/20 ≈ ${fmt(Math.max(Sx, Sy) / 20, 2)} m`,
        `t = ${fmt(t, 2)} m    ·    d = ${fmt(d, 1)} cm    ·    ${okT ? "CUMPLE el lazo" : "revise σadm / luces / t"}`,
        "El punzonamiento suele gobernar el espesor en plateas de edificios. Cada fila de la tabla es un espesor ensayado.",
        {
          desarrollo: [
            `Se parte de t = ${fmt(tIn, 2)} m y se sube de 5 en 5 cm.`,
            `Peralte d = 100 t − rec = ${fmt(d, 1)} cm.`,
            `El lazo exige q ≤ σn, Vu ≤ φVn en la columna más cargada, Vu ≤ φVc a d de la cara, y t ≥ máx(35 cm, L/20).`,
          ],
          table: { caption: "Iteración de espesor t", headers: ["i", "t (m)", "d (cm)", "σn", "q", "Vu/φVn", "Vu/φVc 1 dir.", "¿OK?"], rows: rowsH },
        },
      ),
      step(
        "06",
        "Franja interior eje X — método de fajas",
        "w = ΣPu,fila / Lx    ·    V(x) = w x − Σ Pu    ·    M(x) = w x²/2 − Σ Pu (x−xi)",
        "M(x)=\\dfrac{w x^2}{2}-\\sum P_u(x-x_i)",
        `b = ${fmt(bIntX, 2)} m    ·    w = ${fmt(sum(lIntX) / Math.max(LxUse, 0.2), 2)} t/m    ·    ${lIntX.length} columnas en la fila    ·    amp = ${fmt(amp, 2)}`,
        `M+ = ${fmt(frIntX.Mmax, 1)} t·m    ·    M− = ${fmt(frIntX.Mmin, 1)} t·m    ·    Vmáx = ${fmt(frIntX.Vmax, 1)} t    ·    con amp: Msuelo = ${fmt(amp * Math.max(-frIntX.Mmin, 0), 1)} t·m`,
        "Entre columnas, tracción hacia el suelo (malla inferior). En vuelos, tracción superior. V(L) ≈ 0 verifica equilibrio de la fila.",
        {
          desarrollo: [
            `Ancho tributario interior = Sy = ${fmt(bIntX, 2)} m.`,
            `w = Σ Pu de la fila / Lx = ${fmt(sum(lIntX), 1)} / ${fmt(LxUse, 2)} = ${fmt(sum(lIntX) / Math.max(LxUse, 0.2), 2)} t/m.`,
            `Integración libre-libre. M− (suelo) = ${fmt(frIntX.Mmin, 1)} t·m; M+ (vuelo) = ${fmt(frIntX.Mmax, 1)} t·m.`,
            !rigido ? `Platea flexible: momentos mayorados × 1.20.` : `Platea rígida: momentos sin mayorar.`,
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
        "El vuelo de borde suele gobernar la malla superior.",
        {
          desarrollo: [
            `Ancho de borde ≈ Sy/2 = ${fmt(bEdgX, 2)} m.`,
            `w = ${fmt(sum(lEdgX) / Math.max(LxUse, 0.2), 2)} t/m. M− = ${fmt(frEdgX.Mmin, 1)} t·m; M+ = ${fmt(frEdgX.Mmax, 1)} t·m.`,
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
        "Por cara gobierna el mayor Mu/b de las cuatro franjas. La platea se arma inferior y superior en X e Y.",
        {
          desarrollo: [
            `Franja interior Y: w = ${fmt(sum(lIntY) / Math.max(LyUse, 0.2), 2)} t/m, b = ${fmt(bIntY, 2)} m.`,
            `Franja de borde Y: w = ${fmt(sum(lEdgY) / Math.max(LyUse, 0.2), 2)} t/m, b = ${fmt(bEdgY, 2)} m.`,
            `Momentos de diseño con amp = ${fmt(amp, 2)}: Msuelo X = ${fmt(MsoilX, 1)} t·m, Mvuelo X = ${fmt(MtopX, 1)} t·m, Msuelo Y = ${fmt(MsoilY, 1)} t·m, Mvuelo Y = ${fmt(MtopY, 1)} t·m.`,
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
        "En bandas de columna se puede densificar; en el centro del paño no bajar de Asmín. Un Ø representativo por lecho en la planta A1.",
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
        "Vu = Pu − qu Acrit    ·    vc = mín{0.53(2+4/βc), 0.53(αs d/b0+2), 1.06} √f'c    ·    φVn = 0.85 vc b0 d",
        "V_u=P_u-q_u A_{\\mathrm{crit}}\\qquad v_c=\\min\\{0.53(2+4/\\beta_c),\\,0.53(\\alpha_s d/b_0+2),\\,1.06\\}\\sqrt{f'_c}",
        `Gobernante ${worst.id} (${worst.kind})    ·    b0 = ${fmt(worst.b0, 1)} cm    ·    αs = ${worst.kind === "interior" ? 40 : worst.kind === "borde" ? 30 : 20}    ·    criterio ${worst.govern}    ·    d = ${fmt(d, 1)} cm`,
        `Vu = ${fmt(worst.Vu, 2)} t    ·    φVn = ${fmt(worst.phiVn, 2)} t    ·    Vu/φVn = ${fmt(worst.Vu / Math.max(worst.phiVn, 0.01), 2)}    ·    ${worst.ok ? "CUMPLE" : "NO"}`,
        "αs = 40 interior, 30 borde, 20 esquina (E.060 11.12 / ACI 22.6.5). El gráfico pinta el perímetro recortado a d/2, Vu, φVn y el sello. Si NO: subir t, capitel o ábaco.",
        {
          ok: punList.every((p) => p.ok),
          desarrollo: [
            `Se verifica cada columna. Vu = Pu − qu Acrit (se descuenta la reacción del suelo dentro del perímetro).`,
            `Gobernante ${worst.id}: tipo ${worst.kind}, b0 = ${fmt(worst.b0, 1)} cm, Vu = ${fmt(worst.Vu, 2)} t frente a φVn = ${fmt(worst.phiVn, 2)} t.`,
            `${punList.filter((p) => p.ok).length} de ${punList.length} columnas cumplen. ${punList.every((p) => p.ok) ? "Todas OK." : "Hay columnas que no cumplen: subir t."}`,
          ],
          table: {
            caption: "Punzonamiento por columna",
            headers: ["Col", "tipo", "b0 (cm)", "Vu (t)", "φVn (t)", "Vu/φVn", "¿OK?"],
            rows: punList.map((p) => [p.id, p.kind, fmt(p.b0, 1), fmt(p.Vu, 1), fmt(p.phiVn, 1), fmt(p.Vu / Math.max(p.phiVn, 0.01), 2), p.ok ? "OK" : "NO"]),
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
          ],
        },
      ),
    ],
    [
      ok("q ≤ σn", `${fmt(qserv, 2)}`, `≤ ${fmt(qn, 2)}`, qserv <= qn + 0.05 && qn > 0),
      ok("Rigidez Westergaard", fmt(ratio, 2), rigido ? "< 1.75 rígida" : "≥ 1.75 ×1.20", true),
      ok("Punzonamiento gobernante", `${fmt(worst.Vu, 1)} t`, `≤ ${fmt(worst.phiVn, 1)} t`, worst.ok),
      ok("Todas las columnas, punzonamiento", `${punList.filter((p) => p.ok).length}/${punList.length}`, "todas OK", punList.every((p) => p.ok)),
      ok("Corte 1 dir.", `${fmt(shX.Vu, 1)} t`, `≤ ${fmt(shX.phiVc, 1)}`, shX.ok),
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
        Vu: worst.Vu,
        phiVn: worst.phiVn,
        b0: worst.b0,
        kind: worst.kind,
        ok: worst.ok,
      }),
      studioJson: str(raw, "studioJson", ""),
      gridJson: str(raw, "gridJson", ""),
    },
  );
};
