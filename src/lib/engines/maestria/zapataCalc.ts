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
  type MaeCol,
  type MaeModel,
} from "./types";

function applyCorridaJson(raw: Record<string, string>, fb: MaeModel): MaeModel {
  const tipo = str(raw, "tipo", "muro");
  if (tipo !== "columnas") return fb;
  try {
    if (raw.corridaJson?.trim()) {
      const j = JSON.parse(raw.corridaJson) as { cols?: { x: number; t1: number; t2: number; P1: number; P2: number; P3: number; M1: number; M2: number; M3: number; ey?: number; centered?: boolean }[]; bBeam?: number; hBeam?: number };
      const cols = Array.isArray(j.cols) ? j.cols : [];
      if (cols.length >= 2) {
        const xs = cols.map((c) => Number(c.x) || 0);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const n = cols.length - 1;
        fb.axesX = Array.from({ length: n + 1 }, (_, i) => x0 + (i * (x1 - x0)) / n);
        fb.axesY = [0, Math.max(num(raw, "B", 1.8), 1.2)];
        fb.cells = [Array.from({ length: n }, () => true)];
        fb.mergeH = [Array.from({ length: n }, () => false)];
        fb.mergeV = [Array.from({ length: n }, () => false)];
        fb.cols = cols.map((c, i) => {
          let ix = 0;
          let best = 1e9;
          fb.axesX.forEach((x, k) => {
            const d = Math.abs(x - (Number(c.x) || 0));
            if (d < best) {
              best = d;
              ix = k;
            }
          });
          return {
            id: `C${i + 1}`,
            ix,
            iy: 0,
            t1: Number(c.t1) || 0.3,
            t2: Number(c.t2) || 0.4,
            P1: Number(c.P1) || 0,
            P2: Number(c.P2) || 0,
            P3: Number(c.P3) || 50,
            M1: Number(c.M1) || 0,
            M2: Number(c.M2) || 0,
            M3: Number(c.M3) || 0,
            ex: 0,
            ey: Number(c.ey) || 0,
            centered: c.centered !== false,
          };
        });
        fb.axisXKind = Array.from({ length: fb.axesX.length }, () => "viga");
        fb.axisYKind = ["viga", "viga"];
      }
    }
  } catch {
    /* fallback */
  }
  return fb;
}

function modelFromRaw(raw: Record<string, string>) {
  if (raw.studioJson?.trim()) return resolveMaeModel(raw, "zapata");
  if (raw.corridaJson?.trim()) {
    const model = applyCorridaJson(raw, defaultModel("zapata"));
    if (plantReady(model, "zapata")) return { model, usedExample: false, pending: false };
  }
  return resolveMaeModel(raw, "zapata");
}

function qNet(qadm: number, gt: number, Df: number, h: number, sc: number) {
  return qadm * 10 - gt * Df - 2.4 * h - sc;
}

function iterateH(opts: {
  h0: number;
  rec: number;
  fc: number;
  qnFn: (h: number) => number;
  lv: number;
  quFn: (h: number) => number;
  PuMax: number;
  t1: number;
  t2: number;
  B: number;
  L: number;
  cx: number;
  cy: number;
}) {
  let h = Math.max(0.35, opts.h0);
  const rows: string[][] = [];
  for (let i = 0; i < 14; i++) {
    const d = h * 100 - opts.rec;
    const qn = opts.qnFn(h);
    const qu = opts.quFn(h);
    const Mu = (qu * Math.max(opts.lv, 0) ** 2) / 2;
    const sh = oneWayShear(qu * Math.max(opts.lv - d / 100, 0), 100, d, opts.fc);
    const pg = punchGeom(opts.cx, opts.cy, opts.t1, opts.t2, d / 100, opts.B, opts.L);
    const beta = Math.max(opts.t1, opts.t2) / Math.max(Math.min(opts.t1, opts.t2), 0.1);
    const cap = punchCapacity(opts.fc, pg.b0, d, beta, pg.alphaS);
    const Vu = Math.max(0, opts.PuMax - qu * pg.Acrit);
    const flexOk = d >= 12;
    const okAll = qn > 0 && sh.ok && Vu <= cap.phiVn + 1e-6 && flexOk && h >= opts.lv / 2 - 1e-6;
    rows.push([
      String(i + 1),
      h.toFixed(2),
      d.toFixed(1),
      qn.toFixed(2),
      Mu.toFixed(3),
      `${sh.Vu.toFixed(2)}/${sh.phiVc.toFixed(2)}`,
      `${Vu.toFixed(1)}/${cap.phiVn.toFixed(1)}`,
      okAll ? "OK" : "NO",
    ]);
    if (okAll) return { h, d, qn, qu, Mu, sh, pg, cap, Vu, rows, ok: true };
    h = round05(h + 0.05);
  }
  const d = h * 100 - opts.rec;
  const qn = opts.qnFn(h);
  const qu = opts.quFn(h);
  const Mu = (qu * Math.max(opts.lv, 0) ** 2) / 2;
  const sh = oneWayShear(qu * Math.max(opts.lv - d / 100, 0), 100, d, opts.fc);
  const pg = punchGeom(opts.cx, opts.cy, opts.t1, opts.t2, d / 100, opts.B, opts.L);
  const beta = Math.max(opts.t1, opts.t2) / Math.max(Math.min(opts.t1, opts.t2), 0.1);
  const cap = punchCapacity(opts.fc, pg.b0, d, beta, pg.alphaS);
  const Vu = Math.max(0, opts.PuMax - qu * pg.Acrit);
  return { h, d, qn, qu, Mu, sh, pg, cap, Vu, rows, ok: false };
}

function wallEngine(raw: Record<string, string>) {
  const tw = num(raw, "tw", 0.25);
  const Pd = num(raw, "Pd", 12);
  const Pl = num(raw, "Pl", 4);
  const eMuro = num(raw, "eMuro", 0);
  const qadm = num(raw, "qadm", 2);
  const Df = num(raw, "Df", 1.5);
  const gt = num(raw, "gt", 1.8);
  const sc = num(raw, "sc", 0.3);
  const hfIn = num(raw, "hf", 0.45);
  const BIn = num(raw, "B", 0);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 7.5);
  const Psm = Pd + Pl;
  const Pum = 1.4 * Pd + 1.7 * Pl;
  const qn0 = qNet(qadm, gt, Df, hfIn, sc);
  let B = BIn > 0.4 ? round05(BIn) : round05(Math.max(tw + 0.5, Psm / Math.max(qn0, 0.3)));
  const it = iterateH({
    h0: hfIn,
    rec,
    fc,
    qnFn: (h) => qNet(qadm, gt, Df, h, sc),
    lv: Math.max(B / 2 - tw / 2 + eMuro, B / 2 - tw / 2 - eMuro),
    quFn: (h) => {
      void h;
      return Pum / B;
    },
    PuMax: Pum,
    t1: tw,
    t2: 1,
    B,
    L: 1,
    cx: 0.5,
    cy: B / 2 + eMuro,
  });
  const qn = it.qn;
  if (BIn <= 0.4) B = round05(Math.max(B, Psm / Math.max(qn, 0.3)));
  const qmed = Psm / B;
  const e = eMuro;
  const qmax = qmed * (1 + (6 * Math.abs(e)) / B);
  const qmin = qmed * (1 - (6 * Math.abs(e)) / B);
  const inKern = Math.abs(e) <= B / 6 + 0.01;
  const lvL = B / 2 - tw / 2 + e;
  const lvR = B / 2 - tw / 2 - e;
  const qu = Pum / B;
  const Mu = (qu * Math.max(lvL, lvR, 0) ** 2) / 2;
  const flex = asFlex(Mu, 100, it.d, fc, fy, it.h * 100);
  const prin = pickSlabBar(flex.As, it.h * 100);
  const AsDist = 0.0018 * 100 * it.h * 100;
  const dist = pickSlabBar(AsDist, it.h * 100);
  return out(
    `Corrida de muro  B=${fmt(B, 2)} m  ·  h=${fmt(it.h, 2)} m`,
    `Principal ${fmtBar(prin)} ⊥ muro  ·  distribución ${fmtBar(dist)}  ·  q=${fmt(qmed, 2)} t/m²`,
    [
      step("01", "Muro — carga por metro", "p = PD+PL    pu=1.4PD+1.7PL", "p=P_D+P_L", `PD=${fmt(Pd, 2)}  PL=${fmt(Pl, 2)} t/m`, `p=${fmt(Psm, 2)}    pu=${fmt(Pum, 2)} t/m`, "Zapata corrida de muro: se calcula por metro de longitud. No hay columnas que clicar."),
      step("02", "Esfuerzo neto del suelo — E.050", "σn = σadm − γt Df − γc h − s/c    ·    B = p/σn", "\\sigma_n=\\sigma_{adm}-\\gamma_t D_f-\\gamma_c h-s/c", `σadm=${fmt(qadm * 10, 2)} t/m²    ·    γt=${fmt(gt, 2)}    ·    Df=${fmt(Df, 2)}`, `σn=${fmt(qn, 2)} t/m²    ·    B=${fmt(B, 2)} m    ·    q=${fmt(qmed, 2)} t/m²`, "σadm entra en kg/cm² (×10 → t/m²). El peso propio de la zapata y el relleno se descuentan del admisible: no se puede usar σadm bruto."),
      step("03", "Presiones y núcleo de la sección", "qmáx,mín = q(1±6e/B)    ·    |e|≤B/6", "q_{\\max,\\min}=q\\left(1\\pm 6e/B\\right)", `e=${fmt(e, 3)} m    ·    B/6=${fmt(B / 6, 3)} m`, `qmáx=${fmt(qmax, 2)}    ·    qmín=${fmt(qmin, 2)} t/m²`, inKern ? "Resultante en el tercio medio: contacto completo (E.050)." : "Fuera del núcleo: ensanchar B o recentrar el muro."),
      step(
        "04",
        "Peralte — iteración cortante y flexión",
        "h ≥ ℓv/2    ·    Vu = qu(ℓv−d) ≤ φVc    ·    h ≥ 35 cm",
        "h\\ge \\ell_v/2\\quad V_u=q_u(\\ell_v-d)\\le\\phi V_c",
        `ℓv izq/der = ${fmt(lvL, 2)} / ${fmt(lvR, 2)} m    ·    rec=${fmt(rec, 1)} cm`,
        `h = ${fmt(it.h, 2)} m    ·    d = ${fmt(it.d, 1)} cm`,
        "Se incrementa h de 5 en 5 cm hasta cumplir suelo, corte a d de la cara del muro, punzonamiento (si aplica) y h≥ℓv/2.",
        {
          table: { caption: "Iteración de espesor", headers: ["i", "h (m)", "d (cm)", "σn", "Mu", "Vu/φVc", "punz.", "¿OK?"], rows: it.rows },
        },
      ),
      step("05", "Flexión transversal", "Mu = qu ℓv² / 2", "M_u=q_u\\ell_v^2/2", `qu=${fmt(qu, 2)} t/m²    Mu=${fmt(Mu, 3)} t·m/m`, `${fmtBar(prin)}    As=${fmt(flex.As, 2)} cm²/m`, "Acero principal perpendicular al muro, cara del suelo, ganchos en bordes. E.060 15.4."),
      step("06", "Corte en una dirección", "φVc = 0.85·0.53√f'c b d", "\\phi V_c=0.85\\cdot 0.53\\sqrt{f'_c}bd", `Vu=${fmt(it.sh.Vu, 2)} t/m`, `φVc=${fmt(it.sh.phiVc, 2)} t/m    ${it.sh.ok ? "CUMPLE" : "NO"}`, "Sección crítica a d de la cara del muro (E.060 11.1.3.1).", { ok: it.sh.ok }),
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)}`, `≤ ${fmt(qn, 2)}`, qmax <= qn + 0.05 && qn > 0),
      ok("|e| ≤ B/6", `${fmt(Math.abs(e), 3)}`, `≤ ${fmt(B / 6, 3)}`, inKern),
      ok("Corte 1 dir.", `${fmt(it.sh.Vu, 2)}`, `≤ ${fmt(it.sh.phiVc, 2)}`, it.sh.ok),
      ok("h ≥ 35 cm", `${fmt(it.h * 100, 0)} cm`, "≥ 35", it.h >= 0.35),
    ],
    [{ title: "Voladizos", rows: [["Lado", "ℓv", "Mu"], ["Izq.", fmt(lvL, 2), fmt((qu * Math.max(lvL, 0) ** 2) / 2, 3)], ["Der.", fmt(lvR, 2), fmt((qu * Math.max(lvR, 0) ** 2) / 2, 3)]] }],
    {
      B: B.toFixed(2),
      L: "1.00",
      hf: it.h.toFixed(2),
      tw: tw.toFixed(2),
      tipo: "muro",
      lvL: lvL.toFixed(3),
      lvR: lvR.toFixed(3),
      MuCorr: Mu.toFixed(3),
      asPrin: fmtBar(prin),
      asDist: fmtBar(dist),
      AsPrin: flex.As.toFixed(2),
    },
  );
}

export const calcZapataCorrida: Engine = (raw) => {
  const tipo = str(raw, "tipo", "columnas");
  if (tipo === "muro" && !raw.studioJson?.trim()) return wallEngine(raw);

  const { model: m, usedExample, pending } = modelFromRaw(raw);
  const qadm = num(raw, "qadm", 2);
  const Df = num(raw, "Df", 1.5);
  const gt = num(raw, "gt", 1.8);
  const sc = num(raw, "sc", 0.3);
  const hfIn = num(raw, "hf", 0.45);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 7.5);
  const bBeam = num(raw, "bBeam", 0.4);
  const hBeamIn = num(raw, "hBeam", 0.6);

  const nCells = m.cells.flat().filter(Boolean).length;
  const cols = m.cols.filter((c) => c.ix >= 0 && c.iy >= 0);
  if (pending || nCells < 1 || cols.length < 1) {
    return pendingPlantOut(
      "Zapata corrida — pendiente de planta",
      "Pinte celdas de zapata y coloque cada columna (P1 a P3 y M1 a M3) o pulse «Cargar ejemplo» para emitir el expediente completo.",
    );
  }

  const geom = paintedInertia(m);
  const A = Math.max(geom.A, 0.1);
  let sumP = 0;
  let Mx = 0;
  let My = 0;
  const loads: { col: MaeCol; x: number; y: number; Pserv: number; Pu: number; M2: number; M3: number }[] = [];
  for (const c of cols) {
    const p = puCol(c);
    const xy = colXY(m, c);
    const mom = momentsAt(c, hfIn);
    sumP += p.Pserv;
    Mx += p.Pserv * (xy.y - geom.yc) + mom.M2;
    My += p.Pserv * (xy.x - geom.xc) + mom.M3;
    loads.push({ col: c, x: xy.x, y: xy.y, Pserv: p.Pserv, Pu: p.Pu, M2: mom.M2, M3: mom.M3 });
  }
  const sumPu = loads.reduce((s, c) => s + c.Pu, 0);
  const ex = My / Math.max(sumP, 0.1);
  const ey = Mx / Math.max(sumP, 0.1);
  const Bapprox = A / Math.max(m.axesX[m.axesX.length - 1] - m.axesX[0], 0.5);
  const L = m.axesX[m.axesX.length - 1] - m.axesX[0];
  const B = Math.max(Bapprox, m.axesY[m.axesY.length - 1] - m.axesY[0], 0.6);

  const typ = loads.reduce((a, b) => (b.Pu > a.Pu ? b : a), loads[0]);
  const lv = Math.max(
    ...loads.map((c) => {
      const left = c.x - m.axesX[0];
      const right = m.axesX[m.axesX.length - 1] - c.x;
      const bot = c.y - m.axesY[0];
      const top = m.axesY[m.axesY.length - 1] - c.y;
      return Math.max(0.1, Math.min(left, right, bot, top) + Math.max(c.col.t1, c.col.t2) / 2);
    }),
    0.25,
  );

  const it = iterateH({
    h0: hfIn,
    rec,
    fc,
    qnFn: (h) => qNet(qadm, gt, Df, h, sc),
    lv,
    quFn: (h) => (sumPu + 1.4 * 2.4 * h * A) / A,
    PuMax: typ.Pu,
    t1: typ.col.t1,
    t2: typ.col.t2,
    B,
    L,
    cx: typ.x - m.axesX[0],
    cy: typ.y - m.axesY[0],
  });

  const qserv = (sumP + 2.4 * it.h * A + gt * Math.max(Df - it.h, 0) * A + sc * A) / A;
  const qu = (sumPu + 1.4 * (2.4 * it.h + gt * Math.max(Df - it.h, 0)) * A + 1.7 * sc * A) / A;
  const Ixx = Math.max(geom.Ixx, 1e-4);
  const Iyy = Math.max(geom.Iyy, 1e-4);
  const qAt = (x: number, y: number) => qserv + (Mx * (y - geom.yc)) / Ixx + (My * (x - geom.xc)) / Iyy;
  const corners: { x: number; y: number }[] = [];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      corners.push({ x: m.axesX[ix], y: m.axesY[iy] }, { x: m.axesX[ix + 1], y: m.axesY[iy] }, { x: m.axesX[ix], y: m.axesY[iy + 1] }, { x: m.axesX[ix + 1], y: m.axesY[iy + 1] });
    }
  }
  const qs = corners.map((p) => qAt(p.x, p.y));
  const qmax = Math.max(...qs, qserv);
  const qmin = Math.min(...qs, qserv);
  const inKern = qmin >= -0.02;

  const beamLoads = loads.map((c) => ({ x: c.x - m.axesX[0], P: c.Pu, M: c.M3 }));
  const beam = invertBeam(L, qu * B, beamLoads);
  const hBeam = Math.max(hBeamIn, it.h);
  const dBeam = hBeam * 100 - rec;
  const flexLong = asFlex(Math.max(beam.Mmax, -beam.Mmin), Math.max(bBeam, 0.3) * 100, dBeam, fc, fy, hBeam * 100);
  const longB = pickSlabBar(flexLong.As / Math.max(bBeam, 0.3), hBeam * 100);
  const flex = asFlex(it.Mu, 100, it.d, fc, fy, it.h * 100);
  const prin = pickSlabBar(flex.As, it.h * 100);
  const dist = pickSlabBar(0.0018 * 100 * it.h * 100, it.h * 100);

  const isL =
    nCells > 0 &&
    nyOf(m) > 1 &&
    m.cells.some((row) => row.includes(false)) &&
    m.cells.some((row) => row.includes(true));

  const cellRows: string[][] = [];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      const dx = m.axesX[ix + 1] - m.axesX[ix];
      const dy = m.axesY[iy + 1] - m.axesY[iy];
      cellRows.push([`${ix + 1},${iy + 1}`, fmt(dx, 2), fmt(dy, 2), fmt(dx * dy, 2)]);
    }
  }
  const qCornerRows = corners.map((p, i) => [`V${i + 1}`, fmt(p.x, 2), fmt(p.y, 2), fmt(qAt(p.x, p.y), 2)]);
  const ldPrin = ldTension(fy, fc, prin.db);
  const ldLong = ldTension(fy, fc, longB.db);
  const Dshare = 0.7 * sumP;
  const Lshare = 0.3 * sumP;
  const PuComb = 1.4 * Dshare + 1.7 * Lshare;
  const ejemploNota = usedExample
    ? "Planta de ejemplo del expediente (editable en el croquis: celdas, vanos y columnas con 6 GDL)."
    : "Planta del proyecto, unión de celdas pintadas.";

  return out(
    `Zapata ${isL ? "en L / irregular" : "corrida"}  A=${fmt(A, 1)} m²  ·  h=${fmt(it.h, 2)} m  ·  ${cols.length} col.`,
    `Transv. ${fmtBar(prin)}  ·  viga ${fmtBar(longB)}  ·  qmáx=${fmt(qmax, 2)} t/m². ${ejemploNota}`,
    [
      step(
        "01",
        "Geometría de la planta — área, baricentro e inercias",
        "A = Σ bi ℓi    ·    x̄ = Σ Ai xi / A    ·    Ixx = Σ (bi hi³/12 + Ai yi²)",
        "A=\\sum b_i\\ell_i\\qquad \\bar{x}=\\dfrac{\\sum A_i x_i}{A}\\qquad I_{xx}=\\sum\\left(\\dfrac{b_i h_i^3}{12}+A_i y_i^2\\right)",
        `${nxOf(m)}×${nyOf(m)} celdas    ·    ${nCells} pintadas    ·    ${cols.length} columnas    ·    ${ejemploNota}`,
        `A = ${fmt(A, 2)} m²    ·    baricentro (${fmt(geom.xc, 2)}, ${fmt(geom.yc, 2)}) m    ·    Ixx = ${fmt(Ixx, 2)} m⁴    ·    Iyy = ${fmt(Iyy, 2)} m⁴`,
        "La forma L o irregular se integra como unión de rectángulos. No se reemplaza por el rectángulo envolvente: eso falsearía q en el recorte. E.050 exige el área real de contacto.",
        {
          desarrollo: [
            ejemploNota,
            `Cada celda pintada es un rectángulo de vanos. A = Σ bi·ℓi = ${fmt(A, 2)} m².`,
            `Baricentro: x̄ = ${fmt(geom.xc, 2)} m, ȳ = ${fmt(geom.yc, 2)} m (origen en el primer eje).`,
            `Inercia a baricentro por Steiner: Ixx = ${fmt(Ixx, 2)} m⁴ (eje X), Iyy = ${fmt(Iyy, 2)} m⁴ (eje Y).`,
            `Envolvente aproximada B ≈ ${fmt(B, 2)} m, L = ${fmt(L, 2)} m. Forma ${isL ? "en L / irregular" : "rectangular"}.`,
          ],
          table: {
            caption: "Celdas de zapata (unión de rectángulos)",
            headers: ["Celda ix,iy", "b (m)", "ℓ (m)", "Ai (m²)"],
            rows: cellRows,
          },
        },
      ),
      step(
        "02",
        "Cargas por columna — P1 a P3, M1 a M3 y combinación",
        "P3 = FZ    ·    Pu = 1.4 D + 1.7 L ≈ 1.5 P3    ·    M2c = M2 + P2 h    ·    M3c = M3 + P1 h",
        "P_u=1.4D+1.7L\\approx 1.5 P_3\\qquad M_{2c}=M_2+P_2 h\\qquad M_{3c}=M_3+P_1 h",
        `Convenio ETABS: P1 = FX, P2 = FY, P3 = FZ, M1 = torsión, M2 y M3 flexión. h de traslado = ${fmt(it.h, 2)} m.`,
        `ΣP3 = ${fmt(sumP, 1)} t    ·    ΣPu = ${fmt(sumPu, 1)} t    ·    gobernante ${typ.col.id} Pu = ${fmt(typ.Pu, 1)} t`,
        "Sin desglose D/L en la ficha se adopta D = 0.70 P3 y L = 0.30 P3, de modo que Pu = 1.4×0.70 P3 + 1.7×0.30 P3 = 1.49 P3 ≈ 1.5 P3 (E.060 2009). M1 no entra en q(x,y). Desfase: ex, ey respecto del entrecruce.",
        {
          desarrollo: [
            `P3 es el axial de servicio en la base. Hipótesis D/L = 70/30: D = ${fmt(Dshare, 1)} t, L = ${fmt(Lshare, 1)} t.`,
            `Combinación última: Pu = 1.4 D + 1.7 L = 1.4×${fmt(Dshare, 1)} + 1.7×${fmt(Lshare, 1)} = ${fmt(PuComb, 1)} t (global). Por columna se usa Pu,i = 1.5 P3,i.`,
            `Momentos en el plano de contacto: M2c = M2 + P2·h, M3c = M3 + P1·h, con h = ${fmt(it.h, 2)} m (brazo de los cortes hasta el suelo).`,
            `ΣMx = ${fmt(Mx, 1)} t·m (incluye P3·(y−ȳ) + M2c). ΣMy = ${fmt(My, 1)} t·m.`,
          ],
          table: {
            caption: "Columnas — 6 GDL de servicio y combinación",
            headers: ["Col", "x", "y", "t1×t2", "P1", "P2", "P3", "M1", "M2", "M3", "Pu", "M2c", "M3c"],
            rows: loads.map((c) => [
              c.col.id,
              fmt(c.x, 2),
              fmt(c.y, 2),
              `${fmt(c.col.t1, 2)}×${fmt(c.col.t2, 2)}`,
              fmt(c.col.P1, 1),
              fmt(c.col.P2, 1),
              fmt(c.Pserv, 1),
              fmt(c.col.M1, 1),
              fmt(c.col.M2, 1),
              fmt(c.col.M3, 1),
              fmt(c.Pu, 1),
              fmt(c.M2, 2),
              fmt(c.M3, 2),
            ]),
          },
        },
      ),
      step(
        "03",
        "Esfuerzo neto E.050 y presión q = P/A ± Mc/I",
        "σn = σadm − γt Df − γc h − s/c    ·    q = ΣP/A ± Mx cy/Ixx ± My cx/Iyy",
        "\\sigma_n=\\sigma_{adm}-\\gamma_t D_f-\\gamma_c h-s/c\\qquad q=\\dfrac{\\sum P}{A}\\pm\\dfrac{M_x c_y}{I_{xx}}\\pm\\dfrac{M_y c_x}{I_{yy}}",
        `σadm = ${fmt(qadm, 2)} kg/cm² = ${fmt(qadm * 10, 2)} t/m²    ·    γt = ${fmt(gt, 2)} t/m³    ·    Df = ${fmt(Df, 2)} m    ·    h = ${fmt(it.h, 2)} m    ·    s/c = ${fmt(sc, 2)} t/m²`,
        `σn = ${fmt(it.qn, 2)} t/m²    ·    qserv = ${fmt(qserv, 2)}    ·    qmáx = ${fmt(qmax, 2)}    ·    qmín = ${fmt(qmin, 2)} t/m²    ·    ex = ${fmt(ex, 3)} m    ·    ey = ${fmt(ey, 3)} m`,
        "E.050: el admisible se usa neto (se descuenta relleno y peso propio). qmín ≥ 0 evita despegue; si despega, la presión se redistribuye (contacto parcial) y qmáx real sube.",
        {
          ok: qmax <= it.qn + 0.05 && it.qn > 0 && inKern,
          desarrollo: [
            `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(it.h, 2)} − ${fmt(sc, 2)} = ${fmt(it.qn, 2)} t/m².`,
            `qserv = (ΣP + γc h A + γt (Df−h) A + s/c A) / A = ${fmt(qserv, 2)} t/m².`,
            `Excentricidad de la resultante: ex = My/ΣP = ${fmt(My, 1)}/${fmt(sumP, 1)} = ${fmt(ex, 3)} m; ey = Mx/ΣP = ${fmt(ey, 3)} m.`,
            `En cada vértice q = qserv + Mx (y−ȳ)/Ixx + My (x−x̄)/Iyy. qmáx = ${fmt(qmax, 2)} t/m² ${qmax <= it.qn + 0.05 ? "≤ σn (CUMPLE)" : "> σn (NO — ensanchar planta o bajar cargas)"}.`,
            `qmín = ${fmt(qmin, 2)} t/m² ${inKern ? "≥ 0, contacto completo." : "< 0, hay despegue: redistribuir o recentrar."}`,
          ],
          table: {
            caption: "Presión de servicio en vértices",
            headers: ["Vértice", "x (m)", "y (m)", "q (t/m²)"],
            rows: qCornerRows.slice(0, 16),
          },
        },
      ),
      step(
        "04",
        "Prediseño de h — corte 1 dir., punzonamiento 11.12 y flexión de vuelo",
        "h ← h + 5 cm hasta σn, Vu ≤ φVc, Vu ≤ φVn y h ≥ ℓv/2    ·    rec ≥ 7.5 cm",
        "h\\leftarrow h+0.05\\,\\mathrm{m}\\quad d=h-\\mathrm{rec}",
        `ℓv gob. ≈ ${fmt(lv, 2)} m    ·    rec = ${fmt(rec, 1)} cm (E.060 7.7.1, concreto contra suelo)    ·    h inicial = ${fmt(hfIn, 2)} m`,
        `h = ${fmt(it.h, 2)} m    ·    d = ${fmt(it.d, 1)} cm    ·    ${it.ok ? "CUMPLE el lazo" : "no convergió: revise σadm o luces"}`,
        "Cada fila es un espesor ensayado. Gobiernan: corte a d de la cara (una dirección, E.060 11.3), punzonamiento de la columna más cargada (11.12) y Mu = qu ℓv²/2 del vuelo.",
        {
          desarrollo: [
            `Vuelo gobernante ℓv ≈ ${fmt(lv, 2)} m (mínimo de vuelos a borde más medio lado de columna).`,
            `Peralte efectivo d = 100 h − rec = ${fmt(it.d, 1)} cm.`,
            `Se incrementa h de 5 en 5 cm hasta cumplir suelo, φVc, φVn y h ≥ ℓv/2 = ${fmt(lv / 2, 2)} m, con h mín. 35 cm.`,
          ],
          table: { caption: "Iteración de espesor h", headers: ["i", "h (m)", "d (cm)", "σn", "Mu vuelo", "Vu/φVc", "Vu/φVn punz.", "¿OK?"], rows: it.rows },
        },
      ),
      step(
        "05",
        "Flexión de vuelo — acero transversal",
        "Mu = qu ℓv² / 2    ·    Rn = Mu / (φ b d²)    ·    As = máx(ρ b d, 0.0018 b h)",
        "M_u=q_u\\ell_v^2/2\\qquad A_s=\\max(\\rho b d,\\,0.0018bh)",
        `qu = ${fmt(it.qu, 2)} t/m²    ·    ℓv = ${fmt(lv, 2)} m    ·    d = ${fmt(it.d, 1)} cm    ·    fy = ${fmt(fy, 0)}    ·    f'c = ${fmt(fc, 0)}`,
        `${fmtBar(prin)}    ·    As = ${fmt(flex.As, 2)} cm²/m    ·    Asmín = ${fmt(flex.Asmin, 2)} cm²/m    ·    φMn = ${fmt(flex.phiMn, 2)} t·m/m`,
        "Barras perpendiculares al eje largo, cara del suelo, ancladas más allá de la cara de columna. En forma L se arma cada ala con su vuelo. Distribución Asmín = 0.0018 h.",
        {
          desarrollo: [
            `qu última (incluye 1.4 del peso propio) = ${fmt(it.qu, 2)} t/m².`,
            `Mu = qu ℓv² / 2 = ${fmt(it.qu, 2)} × ${fmt(lv, 2)}² / 2 = ${fmt(it.Mu, 3)} t·m/m (voladizo, cara del suelo).`,
            `Whitney: Rn = Mu/(φ b d²), ρ de la ecuación de segundo grado, As = máx(ρbd, 0.0018 bh) = ${fmt(flex.As, 2)} cm²/m.`,
            `Se adopta ${fmtBar(prin)} (As prov. ${fmt(prin.asProv, 2)} cm²/m). Distribución ${fmtBar(dist)}.`,
          ],
        },
      ),
      step(
        "06",
        "Corte en una dirección — E.060 11.3",
        "Vu = qu (ℓv − d)    ·    φVc = 0.85 · 0.53 √f'c b d",
        "V_u=q_u(\\ell_v-d)\\qquad \\phi V_c=0.85\\cdot 0.53\\sqrt{f'_c}\\,bd",
        `qu = ${fmt(it.qu, 2)} t/m²    ·    ℓv − d = ${fmt(Math.max(lv - it.d / 100, 0), 2)} m    ·    b = 100 cm    ·    d = ${fmt(it.d, 1)} cm    ·    f'c = ${fmt(fc, 0)}`,
        `Vu = ${fmt(it.sh.Vu, 2)} t/m    ·    φVc = ${fmt(it.sh.phiVc, 2)} t/m    ·    ${it.sh.ok ? "CUMPLE" : "NO — subir h"}`,
        "Sección crítica a una distancia d de la cara del pedestal (E.060 11.1.3.1 / 11.3). vc = 0.53 √f'c en kg/cm²; φ = 0.85.",
        {
          ok: it.sh.ok,
          desarrollo: [
            `Vu = ${fmt(it.qu, 2)} × ${fmt(Math.max(lv - it.d / 100, 0), 2)} = ${fmt(it.sh.Vu, 2)} t por metro de ancho.`,
            `φVc = 0.85 × 0.53 × √${fmt(fc, 0)} × 100 × ${fmt(it.d, 1)} / 1000 = ${fmt(it.sh.phiVc, 2)} t/m.`,
            it.sh.ok ? `Vu / φVc = ${fmt(it.sh.Vu / Math.max(it.sh.phiVc, 0.01), 2)} ≤ 1. CUMPLE.` : `Vu / φVc = ${fmt(it.sh.Vu / Math.max(it.sh.phiVc, 0.01), 2)} > 1. Subir h.`,
          ],
        },
      ),
      step(
        "07",
        "Punzonamiento — E.060 11.12 / ACI 22.6.5",
        "Vu = Pu − qu Acrit    ·    vc = mín{0.53(2+4/βc), 0.53(αs d/b0+2), 1.06} √f'c    ·    φVn = 0.85 vc b0 d",
        "V_u=P_u-q_u A_{\\mathrm{crit}}\\qquad v_c=\\min\\{0.53(2+4/\\beta_c),\\,0.53(\\alpha_s d/b_0+2),\\,1.06\\}\\sqrt{f'_c}",
        `${typ.col.id} tipo ${it.pg.kind}    ·    b0 = ${fmt(it.pg.b0, 1)} cm    ·    αs = ${it.pg.alphaS}    ·    criterio ${it.cap.govern}    ·    Acrit = ${fmt(it.pg.Acrit, 2)} m²`,
        `Vu = ${fmt(it.Vu, 2)} t    ·    φVn = ${fmt(it.cap.phiVn, 2)} t    ·    Vu/φVn = ${fmt(it.Vu / Math.max(it.cap.phiVn, 0.01), 2)}    ·    ${it.Vu <= it.cap.phiVn ? "CUMPLE" : "NO"}`,
        "αs = 40 interior, 30 borde, 20 esquina. El perímetro a d/2 se recorta si cae fuera de la zapata. El gráfico muestra b0, Vu, φVn y el sello.",
        {
          ok: it.Vu <= it.cap.phiVn + 1e-6,
          desarrollo: [
            `Columna gobernante ${typ.col.id}: Pu = ${fmt(typ.Pu, 1)} t, sección ${fmt(typ.col.t1, 2)} × ${fmt(typ.col.t2, 2)} m, ${it.pg.kind}.`,
            `Perímetro crítico recortado b0 = ${fmt(it.pg.b0, 1)} cm. Área interior Acrit = ${fmt(it.pg.Acrit, 2)} m².`,
            `Vu = Pu − qu Acrit = ${fmt(typ.Pu, 1)} − ${fmt(it.qu, 2)} × ${fmt(it.pg.Acrit, 2)} = ${fmt(it.Vu, 2)} t.`,
            `φVn = 0.85 vc b0 d = ${fmt(it.cap.phiVn, 2)} t (gobierna ${it.cap.govern}). ${it.Vu <= it.cap.phiVn ? "CUMPLE." : "NO: subir h, capitel o ábaco."}`,
          ],
        },
      ),
      step(
        "08",
        "Viga invertida por tramos — Mu, Vu y As",
        "w = qu B    ·    V(x) = w x − Σ Pu    ·    M(x) = w x²/2 − Σ Pu (x−xi) + Σ M3c",
        "M(x)=\\dfrac{w x^2}{2}-\\sum P_u(x-x_i)+\\sum M_{3c}",
        `L = ${fmt(L, 2)} m    ·    B = ${fmt(B, 2)} m    ·    w = ${fmt(qu * B, 2)} t/m    ·    ${cols.length} columnas en el eje`,
        `M+ = ${fmt(beam.Mmax, 2)} t·m    ·    M− = ${fmt(beam.Mmin, 2)} t·m    ·    Vmáx = ${fmt(beam.Vmax, 2)} t    ·    viga ${fmt(bBeam, 2)}×${fmt(hBeam, 2)} m    ·    ${fmtBar(longB)}    ·    As = ${fmt(flexLong.As, 2)} cm²`,
        "Modelo rígido (Bowles): el suelo es reacción uniforme calibrada a ΣPu; las columnas son cargas. M− (cara del suelo) entre apoyos; M+ en vuelos de extremo. Si L/h es grande la zapata es flexible: mayorar 1.20 o usar Winkler.",
        {
          desarrollo: [
            `Reacción última del suelo sobre el ancho B: w = qu B = ${fmt(it.qu, 2)} × ${fmt(B, 2)} = ${fmt(qu * B, 2)} t/m.`,
            `Integración por tramos entre columnas. En x = L, V(L) ≈ 0 verifica equilibrio de la línea.`,
            `Momento de diseño |M| = ${fmt(Math.max(beam.Mmax, -beam.Mmin), 2)} t·m. Whitney con b = ${fmt(bBeam, 2)} m, d = ${fmt(dBeam, 1)} cm → As = ${fmt(flexLong.As, 2)} cm² → ${fmtBar(longB)}.`,
          ],
        },
      ),
      step(
        "09",
        "Desarrollo y anclaje — E.060 12.2",
        "ℓd = 0.075 fy db / √f'c    ·    gancho 90° ≥ 12 db    ·    el vuelo debe cubrir ℓd más allá de la cara",
        "\\ell_d=0.075\\,f_y d_b/\\sqrt{f'_c}",
        `fy = ${fmt(fy, 0)} kg/cm²    ·    f'c = ${fmt(fc, 0)}    ·    db transv. = ${fmt(prin.db, 2)} cm    ·    db long. = ${fmt(longB.db, 2)} cm`,
        `ℓd transv. = ${fmt(ldPrin, 1)} cm    ·    ℓd viga = ${fmt(ldLong, 1)} cm    ·    gancho 90° transv. ≥ ${fmt(12 * prin.db, 1)} cm`,
        "Las barras del vuelo se anclan en la franja de columna (cara del suelo). La viga invertida ancla M− en el lecho inferior y M+ en el superior de los vuelos. Verificar que ℓv ≥ ℓd; si no, gancho o barra más corta de diámetro.",
        {
          desarrollo: [
            `Transversal ${fmtBar(prin)}: ℓd = 0.075 × ${fmt(fy, 0)} × ${fmt(prin.db, 2)} / √${fmt(fc, 0)} = ${fmt(ldPrin, 1)} cm.`,
            `Longitudinal ${fmtBar(longB)}: ℓd = ${fmt(ldLong, 1)} cm.`,
            `Gancho 90° mínimo 12 db = ${fmt(12 * prin.db, 1)} cm. Recubrimiento de cimentación rec = ${fmt(rec, 1)} cm ≥ 7.5 cm (E.060 7.7.1).`,
            `Vuelo ℓv = ${fmt(lv, 2)} m = ${fmt(lv * 100, 0)} cm ${lv * 100 >= ldPrin ? `≥ ℓd = ${fmt(ldPrin, 1)} cm: hay longitud para anclar.` : `< ℓd: disponer gancho o reducir db.`}`,
          ],
        },
      ),
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)} t/m²`, `≤ ${fmt(it.qn, 2)}`, qmax <= it.qn + 0.05 && it.qn > 0),
      ok("qmín ≥ 0 (sin despegue)", `${fmt(qmin, 2)} t/m²`, "≥ 0", inKern),
      ok("Corte 1 dir.", `${fmt(it.sh.Vu, 2)}`, `≤ ${fmt(it.sh.phiVc, 2)}`, it.sh.ok),
      ok("Punzonamiento", `${fmt(it.Vu, 1)} t`, `≤ ${fmt(it.cap.phiVn, 1)} t`, it.Vu <= it.cap.phiVn + 1e-6),
      ok("h ≥ 35 cm", `${fmt(it.h * 100, 0)} cm`, "≥ 35", it.h >= 0.35),
      ok("Columnas clicadas", String(cols.length), "≥ 1", cols.length >= 1),
    ],
    [
      {
        title: "Estaciones de la viga invertida",
        rows: [["x (m)", "V (t)", "M (t·m)"], ...beam.pts.filter((_, i, a) => i % 2 === 0 || i === a.length - 1).map((p) => [fmt(p.x, 2), fmt(p.V, 2), fmt(p.M, 2)])],
      },
    ],
    {
      B: B.toFixed(2),
      L: L.toFixed(2),
      hf: it.h.toFixed(2),
      hAd: it.h.toFixed(2),
      tipo: "columnas",
      lvL: lv.toFixed(3),
      lvR: lv.toFixed(3),
      MuCorr: it.Mu.toFixed(3),
      asPrin: fmtBar(prin),
      asDist: fmtBar(dist),
      AsPrin: flex.As.toFixed(2),
      Lbeam: L.toFixed(2),
      mPts: packPts(beam.pts),
      Msoil: Math.max(-beam.Mmin, 0).toFixed(3),
      Mtop: Math.max(beam.Mmax, 0).toFixed(3),
      asLong: fmtBar(longB),
      AsLong: flexLong.As.toFixed(2),
      bBeam: bBeam.toFixed(2),
      hBeam: hBeam.toFixed(2),
      punchVu: it.Vu.toFixed(2),
      punchPhi: it.cap.phiVn.toFixed(2),
      punchOk: it.Vu <= it.cap.phiVn + 1e-6 ? "1" : "0",
      punchB0: it.pg.b0.toFixed(1),
      punchKind: it.pg.kind,
      punchJson: JSON.stringify({
        L,
        B,
        d: it.d / 100,
        col: { x: typ.x - m.axesX[0], y: typ.y - m.axesY[0], t1: typ.col.t1, t2: typ.col.t2, id: typ.col.id },
        poly: it.pg.poly,
        Vu: it.Vu,
        phiVn: it.cap.phiVn,
        b0: it.pg.b0,
        kind: it.pg.kind,
        ok: it.Vu <= it.cap.phiVn + 1e-6,
      }),
      studioJson: str(raw, "studioJson", ""),
      corridaJson: str(raw, "corridaJson", ""),
    },
  );
};
