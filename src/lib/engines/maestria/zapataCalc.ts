import { barByName, fmt, num, str, type Engine } from "../../types";
import { designBeamStirrups } from "../../estribos";
import { clearSpanLn, invertBeam, packPts, packV, predimHBeam } from "./matrixBeam";
import {
  asFlex,
  colCantilevers,
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
  transverseCantilever,
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
            seat: "nudo" as const,
          };
        });
        fb.axisXKind = Array.from({ length: fb.axesX.length }, () => "viga");
        fb.axisYKind = ["viga", "viga"];
      }
    }
  } catch {
    /* fallback */
  }
  return ensureGradeBeams(fb, { reset: true });
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
  cols: { cx: number; cy: number; t1: number; t2: number; Pu: number }[];
  B: number;
  L: number;
  painted?: { x0: number; y0: number; x1: number; y1: number }[];
  skipPunch?: boolean;
}) {
  let h = Math.max(0.35, opts.h0);
  const rows: string[][] = [];
  const evalH = (hh: number) => {
    const d = hh * 100 - opts.rec;
    const qn = opts.qnFn(hh);
    const qu = opts.quFn(hh);
    const Mu = (qu * Math.max(opts.lv, 0) ** 2) / 2;
    const sh = oneWayShear(qu * Math.max(opts.lv - d / 100, 0), 100, d, opts.fc);
    const fb = opts.cols[0] ?? { cx: opts.L / 2, cy: opts.B / 2, t1: 0.3, t2: 0.3, Pu: 0 };
    let worst = {
      Vu: 0,
      phiVn: 1,
      ratio: 0,
      pg: punchGeom(fb.cx, fb.cy, fb.t1, fb.t2, d / 100, opts.B, opts.L, opts.painted),
      cap: punchCapacity(opts.fc, 100, d, 1, 40),
    };
    if (!opts.skipPunch) {
      for (const c of opts.cols) {
        const pg = punchGeom(c.cx, c.cy, c.t1, c.t2, d / 100, opts.B, opts.L, opts.painted);
        const beta = Math.max(c.t1, c.t2) / Math.max(Math.min(c.t1, c.t2), 0.1);
        const cap = punchCapacity(opts.fc, pg.b0, d, beta, pg.alphaS);
        const amp = punchMomentAmp(pg.kind);
        const Vu = Math.max(0, amp * Math.max(0, c.Pu - qu * pg.Acrit));
        const ratio = Vu / Math.max(cap.phiVn, 0.01);
        if (ratio >= worst.ratio) worst = { Vu, phiVn: cap.phiVn, ratio, pg, cap };
      }
    }
    const punchOk = opts.skipPunch || worst.Vu <= worst.phiVn + 1e-6;
    const okAll = qn > 0 && sh.ok && punchOk && d >= 12;
    return { h: hh, d, qn, qu, Mu, sh, pg: worst.pg, cap: worst.cap, Vu: worst.Vu, okAll };
  };
  for (let i = 0; i < 16; i++) {
    const r = evalH(h);
    rows.push([
      String(i + 1),
      h.toFixed(2),
      r.d.toFixed(1),
      r.qn.toFixed(2),
      r.Mu.toFixed(3),
      `${r.sh.Vu.toFixed(2)}/${r.sh.phiVc.toFixed(2)}`,
      opts.skipPunch ? "—" : `${r.Vu.toFixed(1)}/${r.cap.phiVn.toFixed(1)}`,
      r.okAll ? "OK" : "NO",
    ]);
    if (r.okAll) return { ...r, rows, ok: true };
    h = round05(h + 0.05);
  }
  return { ...evalH(h), rows, ok: false };
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
    cols: [{ cx: 0.5, cy: B / 2 + eMuro, t1: tw, t2: 1, Pu: Pum }],
    B,
    L: 1,
    skipPunch: true,
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
  const lvGob = Math.max(lvL, lvR, 0);
  const mTransPts = Array.from({ length: 13 }, (_, i) => {
    const x = (i / 12) * lvGob;
    return { x, M: (qu * x * x) / 2, V: qu * x };
  });
  const ldPrin = ldTension(fy, fc, prin.db);
  const ldDist = ldTension(fy, fc, dist.db);
  const vcKg = 0.53 * Math.sqrt(Math.max(fc, 1));
  return out(
    `Corrida de muro  B=${fmt(B, 2)} m  ·  h=${fmt(it.h, 2)} m`,
    `Transv. ${fmtBar(prin)} por paño  ·  inf. ${fmtBar(dist)}  ·  sup. ${fmtBar(dist)}  ·  q=${fmt(qmed, 2)} t/m²`,
    [
      step("01", "Muro — carga por metro", "p = PD+PL    pu=1.4PD+1.7PL", "p=P_D+P_L", `PD=${fmt(Pd, 2)}  PL=${fmt(Pl, 2)} t/m`, `p=${fmt(Psm, 2)}    pu=${fmt(Pum, 2)} t/m`, "Zapata corrida de muro: se calcula por metro de longitud. No hay columnas que clicar."),
      step("02", "Esfuerzo neto del suelo — E.050", "σn = σadm − γt Df − γc h − s/c    ·    B = p/σn", "\\sigma_n=\\sigma_{adm}-\\gamma_t D_f-\\gamma_c h-s/c", `σadm=${fmt(qadm * 10, 2)} t/m²    ·    γt=${fmt(gt, 2)}    ·    Df=${fmt(Df, 2)}`, `σn=${fmt(qn, 2)} t/m²    ·    B=${fmt(B, 2)} m    ·    q=${fmt(qmed, 2)} t/m²`, "σadm entra en kg/cm² (×10 → t/m²). El peso propio de la zapata y el relleno se descuentan del admisible: no se puede usar σadm bruto."),
      step("03", "Presiones y núcleo de la sección", "qmáx,mín = q(1±6e/B)    ·    |e|≤B/6", "q_{\\max,\\min}=q\\left(1\\pm 6e/B\\right)", `e=${fmt(e, 3)} m    ·    B/6=${fmt(B / 6, 3)} m`, `qmáx=${fmt(qmax, 2)}    ·    qmín=${fmt(qmin, 2)} t/m²`, inKern ? "Resultante en el tercio medio: contacto completo (E.050)." : "Fuera del núcleo: ensanchar B o recentrar el muro."),
      step(
        "04",
        "Peralte h (espesor) — cortante, flexión y mínimo geométrico",
        "d = 100h − rec    ·    h ≥ máx(0,35 m, ℓv/2)    ·    Vu = qu(ℓv−d) ≤ φVc    ·    φVc = 0,85·0,53√f'c b d",
        "d=100h-\\mathrm{rec}\\qquad h\\ge\\max(0.35,\\ell_v/2)\\qquad \\phi V_c=0.85\\cdot 0.53\\sqrt{f'_c}bd",
        `ℓv izq/der = ${fmt(lvL, 2)} / ${fmt(lvR, 2)} m    ·    rec = ${fmt(rec, 1)} cm (E.060 7.7.1, concreto contra suelo)    ·    f'c = ${fmt(fc, 0)} kg/cm²    ·    h inicial = ${fmt(hfIn, 2)} m`,
        `h = ${fmt(it.h, 2)} m    ·    d = ${fmt(it.d, 1)} cm    ·    Vu = ${fmt(it.sh.Vu, 2)} t/m    ·    φVc = ${fmt(it.sh.phiVc, 2)} t/m`,
        "El peralte se itera de 5 en 5 cm. Gobiernan: (1) h ≥ 35 cm (E.060 / ACI 13.3, mínimo de zapata), (2) corte a una distancia d de la cara del muro, (3) flexión Mu = qu ℓv²/2 con d ≥ 12 cm, (4) σn > 0. Un muro corrido no punzona (flujo en una dirección).",
        {
          desarrollo: [
            `Vuelo gobernante ℓv = máx(${fmt(lvL, 2)}, ${fmt(lvR, 2)}) = ${fmt(lvGob, 2)} m.`,
            `Recubrimiento rec = ${fmt(rec, 1)} cm → peralte efectivo d = 100 h − rec.`,
            `Mínimo geométrico: h ≥ 0,35 m (E.060). ℓv/2 = ${fmt(lvGob / 2, 2)} m es una guía de predimension, no un límite de norma.`,
            `Última fila: h = ${fmt(it.h, 2)} m → d = ${fmt(it.d, 1)} cm.`,
            `qu = pu/B = ${fmt(Pum, 2)}/${fmt(B, 2)} = ${fmt(qu, 2)} t/m².`,
            `Vu (sección a d de la cara) = qu(ℓv−d) = ${fmt(qu, 2)}×${fmt(Math.max(lvGob - it.d / 100, 0), 3)} = ${fmt(it.sh.Vu, 2)} t/m.`,
            `vc = 0,53√f'c = 0,53√${fmt(fc, 0)} = ${fmt(vcKg, 2)} kg/cm².`,
            `φVc = 0,85·vc·b·d / 1000 = 0,85×${fmt(vcKg, 2)}×100×${fmt(it.d, 1)}/1000 = ${fmt(it.sh.phiVc, 2)} t/m  ${it.sh.ok ? "(Vu ≤ φVc, CUMPLE)" : "(NO — subir h)"}.`,
            `Mu de vuelo = qu ℓv²/2 = ${fmt(qu, 2)}×${fmt(lvGob, 2)}²/2 = ${fmt(Mu, 3)} t·m/m.`,
          ],
          table: { caption: "Iteración del espesor h", headers: ["i", "h (m)", "d (cm)", "σn", "Mu", "Vu/φVc", "punz.", "¿OK?"], rows: it.rows },
        },
      ),
      step("05", "Flexión transversal por paño — acero ⊥ al eje", "Mu = qu ℓv² / 2    ·    Rn = Mu/(φ b d²)    ·    As = máx(ρ b d, 0,0018 b h)", "M_u=q_u\\ell_v^2/2\\qquad A_s=\\max(\\rho bd,\\,0.0018bh)", `qu=${fmt(qu, 2)} t/m²    ℓv=${fmt(lvGob, 2)} m    d=${fmt(it.d, 1)} cm    fy=${fmt(fy, 0)}    f'c=${fmt(fc, 0)}`, `${fmtBar(prin)}    As=${fmt(flex.As, 2)} cm²/m    Asmín=${fmt(flex.Asmin, 2)}    φMn=${fmt(flex.phiMn, 2)} t·m/m`, "Un juego de transversales por paño de 1 m, lecho inferior, ganchos 90° en ambos bordes de B. El despiece se dibuja en planta (hoja A1), no en corte perpendicular.", {
        desarrollo: [
          `Mu = ${fmt(qu, 2)} × ${fmt(lvGob, 2)}² / 2 = ${fmt(Mu, 3)} t·m/m (voladizo, cara del suelo).`,
          `Rn = Mu×10⁵ / (φ b d²) = ${fmt(flex.Rn, 1)} kg/cm²  (φ = 0,90).`,
          `ρ de Whitney y As = máx(ρbd, 0,0018 bh) = ${fmt(flex.As, 2)} cm²/m → se adopta ${fmtBar(prin)}.`,
          `En planta cada paño lleva este Ø @ s. No se corta el paño vecino: cada franja de 1 m tiene su propio juego transversal.`,
        ],
        table: { caption: "Voladizos transversales", headers: ["Lado", "ℓv (m)", "Mu (t·m/m)"], rows: [["Izq.", fmt(lvL, 2), fmt((qu * Math.max(lvL, 0) ** 2) / 2, 3)], ["Der.", fmt(lvR, 2), fmt((qu * Math.max(lvR, 0) ** 2) / 2, 3)]] },
      }),
      step("06", "Corte en una dirección — E.060 11.3", "Vu(x) = qu x    ·    sección crítica x = ℓv − d    ·    φVc = 0,85·0,53√f'c b d", "V_u(x)=q_u x\\qquad \\phi V_c=0.85\\cdot 0.53\\sqrt{f'_c}bd", `qu=${fmt(qu, 2)} t/m²    ℓv−d=${fmt(Math.max(lvGob - it.d / 100, 0), 2)} m    b=100 cm    d=${fmt(it.d, 1)} cm`, `Vu=${fmt(it.sh.Vu, 2)} t/m    φVc=${fmt(it.sh.phiVc, 2)} t/m    ${it.sh.ok ? "CUMPLE" : "NO"}`, "Diagrama de cortante: V crece desde el borde libre (V=0) hasta la cara del muro. La verificación se hace a d de la cara, no en el borde.", {
        ok: it.sh.ok,
        desarrollo: [
          `En el borde libre x=0: V=0. En la cara del muro x=ℓv: V=qu ℓv = ${fmt(qu * lvGob, 2)} t/m (no es la sección de diseño).`,
          `Sección crítica a d de la cara: x = ℓv−d = ${fmt(Math.max(lvGob - it.d / 100, 0), 2)} m → Vu = ${fmt(it.sh.Vu, 2)} t/m.`,
          `φVc = ${fmt(it.sh.phiVc, 2)} t/m. Relación Vu/φVc = ${fmt(it.sh.Vu / Math.max(it.sh.phiVc, 0.01), 2)} ${it.sh.ok ? "≤ 1, CUMPLE." : "> 1, subir h."}`,
          "Punzonamiento 11.12 no aplica: el muro es carga lineal, el flujo es en una dirección.",
        ],
      }),
      step("07", "Aceros inferior y superior — anclaje, sin lecho intermedio", "As,temp = 0,0018 b h    ·    ℓd = 0,075 fy db / √f'c    ·    gancho 90° ≥ 12 db", "A_{s,\\mathrm{temp}}=0.0018bh\\qquad \\ell_d=0.075 f_y d_b/\\sqrt{f'_c}", `As,temp=${fmt(AsDist, 2)} cm²/m    db transv.=${fmt(prin.db, 2)} cm    db long.=${fmt(dist.db, 2)} cm`, `Inf. long. ${fmtBar(dist)}    ·    sup. ${fmtBar(dist)}    ℓd transv.=${fmt(ldPrin, 1)} cm    ℓd long.=${fmt(ldDist, 1)} cm    gancho ≥ ${fmt(12 * prin.db, 1)} cm`, "Dos lechos únicamente: inferior (transversal por paño + longitudinal continuo) y superior (misma cuantía de cara). No hay acero a media altura. El despiece es planta A1, no corte perpendicular. Verificar ℓv ≥ ℓd o disponer gancho.", {
        desarrollo: [
          `Cuantía de temperatura/reparto: 0,0018×100×${fmt(it.h * 100, 0)} = ${fmt(AsDist, 2)} cm²/m → ${fmtBar(dist)} en lecho inferior continuo y en lecho superior de cara.`,
          `Transversal inf. ${fmtBar(prin)}: ℓd = 0,075×${fmt(fy, 0)}×${fmt(prin.db, 2)}/√${fmt(fc, 0)} = ${fmt(ldPrin, 1)} cm.`,
          `Longitudinal ${fmtBar(dist)}: ℓd = ${fmt(ldDist, 1)} cm. Gancho 90° mínimo 12 db = ${fmt(12 * prin.db, 1)} cm.`,
          `Vuelo ℓv = ${fmt(lvGob * 100, 0)} cm ${lvGob * 100 >= ldPrin ? `≥ ℓd: hay longitud de anclaje en planta.` : `< ℓd: gancho 90° obligatorio (ya dispuesto en ambos bordes).`}`,
        ],
      }),
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
      L: "4.00",
      hf: it.h.toFixed(2),
      tw: tw.toFixed(2),
      tipo: "muro",
      lvL: lvL.toFixed(3),
      lvR: lvR.toFixed(3),
      MuCorr: Mu.toFixed(3),
      asPrin: fmtBar(prin),
      asDist: fmtBar(dist),
      asLong: fmtBar(dist),
      asSup: fmtBar(dist),
      asSupT: fmtBar(dist),
      AsPrin: flex.As.toFixed(2),
      AsDist: AsDist.toFixed(2),
      asPrinPanes: JSON.stringify(Object.fromEntries(["P1", "P2", "P3", "P4"].map((id) => [id, fmtBar(prin)]))),
      mPts: packPts(mTransPts),
      mPtsTrans: packPts(mTransPts),
      vPtsTrans: packPts(mTransPts.map((p) => ({ x: p.x, M: p.V }))),
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
  const L = m.axesX[m.axesX.length - 1] - m.axesX[0];
  const Bapprox = A / Math.max(L, 0.5);
  const B = Math.max(Bapprox, m.axesY[m.axesY.length - 1] - m.axesY[0], 0.6);
  const xOrg = m.axesX[0];
  const yOrg = m.axesY[0];
  const painted = [] as { x0: number; y0: number; x1: number; y1: number }[];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      painted.push({ x0: m.axesX[ix] - xOrg, y0: m.axesY[iy] - yOrg, x1: m.axesX[ix + 1] - xOrg, y1: m.axesY[iy + 1] - yOrg });
    }
  }

  const packLoads = (hArm: number) => {
    let sumP = 0;
    let Mx = 0;
    let My = 0;
    const loads: { col: MaeCol; x: number; y: number; Pserv: number; Pu: number; M2: number; M3: number }[] = [];
    for (const c of cols) {
      const p = puCol(c);
      const xy = colXY(m, c);
      const mom = momentsAt(c, hArm);
      sumP += p.Pserv;
      Mx += p.Pserv * (xy.y - geom.yc) + mom.M2;
      My += p.Pserv * (xy.x - geom.xc) + mom.M3;
      loads.push({ col: c, x: xy.x, y: xy.y, Pserv: p.Pserv, Pu: p.Pu, M2: mom.M2, M3: mom.M3 });
    }
    return { loads, sumP, sumPu: loads.reduce((s, c) => s + c.Pu, 0), Mx, My };
  };

  let packed = packLoads(hfIn);
  const lv = Math.max(
    ...packed.loads.map((c) => {
      const cant = colCantilevers(c.x - xOrg, c.y - yOrg, c.col.t1, c.col.t2, painted);
      return transverseCantilever(cant);
    }),
    0.2,
  );
  const quOf = (h: number, sumPuV: number) => (sumPuV + 1.4 * (2.4 * h + gt * Math.max(Df - h, 0)) * A + 1.7 * sc * A) / A;
  let it = iterateH({
    h0: hfIn,
    rec,
    fc,
    qnFn: (h) => qNet(qadm, gt, Df, h, sc),
    lv,
    quFn: (h) => quOf(h, packed.sumPu),
    cols: packed.loads.map((c) => ({ cx: c.x - xOrg, cy: c.y - yOrg, t1: c.col.t1, t2: c.col.t2, Pu: c.Pu })),
    B,
    L,
    painted,
  });
  packed = packLoads(it.h);
  it = iterateH({
    h0: it.h,
    rec,
    fc,
    qnFn: (h) => qNet(qadm, gt, Df, h, sc),
    lv,
    quFn: (h) => quOf(h, packed.sumPu),
    cols: packed.loads.map((c) => ({ cx: c.x - xOrg, cy: c.y - yOrg, t1: c.col.t1, t2: c.col.t2, Pu: c.Pu })),
    B,
    L,
    painted,
  });
  const { loads, sumP, sumPu, Mx, My } = packed;
  const typ = loads.reduce((a, b) => (b.Pu > a.Pu ? b : a), loads[0]);
  const ex = My / Math.max(sumP, 0.1);
  const ey = Mx / Math.max(sumP, 0.1);

  const qserv = (sumP + 2.4 * it.h * A + gt * Math.max(Df - it.h, 0) * A + sc * A) / A;
  const qu = quOf(it.h, sumPu);
  const Ixx = Math.max(geom.Ixx, 1e-4);
  const Iyy = Math.max(geom.Iyy, 1e-4);
  const qCol = sumP / A;
  const qAt = (x: number, y: number) => qCol + (Mx * (y - geom.yc)) / Ixx + (My * (x - geom.xc)) / Iyy;
  const corners: { x: number; y: number }[] = [];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      corners.push({ x: m.axesX[ix], y: m.axesY[iy] }, { x: m.axesX[ix + 1], y: m.axesY[iy] }, { x: m.axesX[ix], y: m.axesY[iy + 1] }, { x: m.axesX[ix + 1], y: m.axesY[iy + 1] });
    }
  }
  const qs = corners.map((p) => qAt(p.x, p.y));
  const qmax = Math.max(...qs, qCol);
  const qmin = Math.min(...qs, qCol);
  const inKern = qmin >= -0.02;
  const qadmT = qadm * 10;

  const mBeams = ensureGradeBeams(m);
  const runs = collectGradeBeams(mBeams);
  const runPts = loads.map((c) => ({ x: c.x, y: c.y, P: c.Pu, M2: c.M2, M3: c.M3 }));
  const runRes = runs.map((run) => {
    const bl = loadsOnGradeBeam(run, runPts, runs);
    const sumP = bl.reduce((s, p) => s + p.P, 0);
    const wSoil = qu * run.b;
    const w = bl.length ? sumP / Math.max(run.L, 0.2) : 0;
    return { run, w, wSoil, nCol: bl.length, sumP, beam: invertBeam(run.L, w, bl) };
  });
  const fallbackBeam = invertBeam(
    L,
    sumPu / Math.max(L, 0.2),
    loads.map((c) => ({ x: c.x - m.axesX[0], P: c.Pu, M: c.M3 })),
  );
  const loaded = runRes.filter((r) => r.nCol > 0);
  const pool = loaded.length ? loaded : runRes;
  const gov =
    pool.reduce((a, b) => {
      const da = Math.max(Math.abs(a.beam.Mmax), Math.abs(a.beam.Mmin), a.beam.Vmax);
      const db = Math.max(Math.abs(b.beam.Mmax), Math.abs(b.beam.Mmin), b.beam.Vmax);
      return db > da ? b : a;
    }, pool[0]) ?? { run: undefined, w: sumPu / Math.max(L, 0.2), wSoil: qu * B, nCol: cols.length, sumP: sumPu, beam: fallbackBeam };
  const beam = gov.beam;
  const govStations = (gov.run
    ? loadsOnGradeBeam(gov.run, runPts, runs)
    : loads.map((c) => ({ x: c.x - m.axesX[0], P: c.Pu, M: c.M3 }))
  ).map((c) => c.x);
  const faceVC = Math.max(0.15, (typ?.col.t2 ?? 0.4) / 2, (typ?.col.t1 ?? 0.4) / 2);
  const lnVC = clearSpanLn(govStations, gov.run?.L ?? L, faceVC);
  const hPred = predimHBeam(lnVC);
  let hBeam = Math.max(hBeamIn, it.h, hPred, 0.4);
  let dBeam = hBeam * 100 - rec;
  let flexLong = asFlex(Math.max(-beam.Mmin, 0), Math.max(bBeam, 0.3) * 100, dBeam, fc, fy, hBeam * 100);
  let flexSup = asFlex(Math.max(beam.Mmax, 0), Math.max(bBeam, 0.3) * 100, dBeam, fc, fy, hBeam * 100);
  let vcInf = pickBeamBars(flexLong.As, Math.max(bBeam, 0.3) * 100, rec);
  let vcSup = pickBeamBars(Math.max(flexSup.As, 0.5), Math.max(bBeam, 0.3) * 100, rec);
  const estBar = barByName('3/8"');
  let shSt = designBeamStirrups({
    b: Math.max(bBeam, 0.3) * 100,
    h: hBeam * 100,
    d: dBeam,
    rec: Math.min(rec, 5),
    fc,
    fy,
    Vu: beam.Vmax,
    VA: beam.Vmax,
    Av: 2 * estBar.as,
    L: gov.run?.L ?? L,
    destName: estBar.name,
    destDb: estBar.db,
    dbLong: vcInf.db,
    nRamas: 2,
    sismico: true,
  });
  for (let k = 0; k < 10; k++) {
    dBeam = hBeam * 100 - rec;
    flexLong = asFlex(Math.max(-beam.Mmin, 0), Math.max(bBeam, 0.3) * 100, dBeam, fc, fy, hBeam * 100);
    flexSup = asFlex(Math.max(beam.Mmax, 0), Math.max(bBeam, 0.3) * 100, dBeam, fc, fy, hBeam * 100);
    vcInf = pickBeamBars(flexLong.As, Math.max(bBeam, 0.3) * 100, rec);
    vcSup = pickBeamBars(Math.max(flexSup.As, 0.5), Math.max(bBeam, 0.3) * 100, rec);
    shSt = designBeamStirrups({
      b: Math.max(bBeam, 0.3) * 100,
      h: hBeam * 100,
      d: dBeam,
      rec: Math.min(rec, 5),
      fc,
      fy,
      Vu: beam.Vmax,
      VA: beam.Vmax,
      Av: 2 * estBar.as,
      L: gov.run?.L ?? L,
      destName: estBar.name,
      destDb: estBar.db,
      dbLong: vcInf.db,
      nRamas: 2,
      sismico: true,
    });
    if (shSt.sectionOk) break;
    hBeam = round05(hBeam + 0.05);
  }
  const shBeam = { Vu: beam.Vmax, phiVc: shSt.phiVc, ok: shSt.sectionOk };
  const flex = asFlex(it.Mu, 100, it.d, fc, fy, it.h * 100);
  const prin = pickSlabBar(flex.As, it.h * 100);
  const dist = pickSlabBar(0.0018 * 100 * it.h * 100, it.h * 100);
  const supTrans = pickSlabBar(0.0018 * 100 * it.h * 100 * 0.5, it.h * 100);
  const vcKg = 0.53 * Math.sqrt(Math.max(fc, 1));
  const paneRows: string[][] = [];
  for (let iy = 0; iy < nyOf(m); iy++) {
    for (let ix = 0; ix < nxOf(m); ix++) {
      if (!cellOn(m, ix, iy)) continue;
      const y0 = m.axesY[iy];
      const y1 = m.axesY[iy + 1];
      const x0 = m.axesX[ix];
      const x1 = m.axesX[ix + 1];
      const near = loads.reduce((a, c) => {
        const da = Math.hypot(a.x - (x0 + x1) / 2, a.y - (y0 + y1) / 2);
        const dc = Math.hypot(c.x - (x0 + x1) / 2, c.y - (y0 + y1) / 2);
        return dc < da ? c : a;
      }, loads[0]);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const faceX = near ? near.col.t2 / 2 : 0;
      const faceY = near ? near.col.t1 / 2 : 0;
      const lvY = near ? Math.min(near.y - y0, y1 - near.y) - faceY : dy / 2;
      const lvX = near ? Math.min(near.x - x0, x1 - near.x) - faceX : dx / 2;
      const lvPane = Math.max(0.05, dx >= dy ? lvY : lvX);
      const MuPane = (it.qu * lvPane * lvPane) / 2;
      const bar = pickSlabBar(asFlex(MuPane, 100, it.d, fc, fy, it.h * 100).As, it.h * 100);
      paneRows.push([`P${ix + 1}-${iy + 1}`, fmt(dx, 2), fmt(dy, 2), fmt(lvPane, 2), fmt(MuPane, 3), fmtBar(bar)]);
    }
  }
  const punchRows: string[][] = [];
  let punchWorst: {
    Vu: number;
    phiVn: number;
    pg: ReturnType<typeof punchGeom>;
    cap: ReturnType<typeof punchCapacity>;
    col: (typeof loads)[number];
    amp: number;
    ok: boolean;
  } | null = null;
  for (const c of loads) {
    const pg = punchGeom(c.x - xOrg, c.y - yOrg, c.col.t1, c.col.t2, it.d / 100, B, L, painted);
    const beta = Math.max(c.col.t1, c.col.t2) / Math.max(Math.min(c.col.t1, c.col.t2), 0.1);
    const cap = punchCapacity(fc, pg.b0, it.d, beta, pg.alphaS);
    const amp = punchMomentAmp(pg.kind);
    const Vu = Math.max(0, amp * Math.max(0, c.Pu - it.qu * pg.Acrit));
    const okP = Vu <= cap.phiVn + 1e-6;
    punchRows.push([c.col.id, pg.kind, fmt(amp, 2), fmt(pg.b0, 0), fmt(pg.Acrit, 2), fmt(Vu, 1), fmt(cap.phiVn, 1), fmt(Vu / Math.max(cap.phiVn, 0.01), 2), okP ? "OK" : "NO"]);
    if (!punchWorst || Vu / Math.max(cap.phiVn, 0.01) > punchWorst.Vu / Math.max(punchWorst.phiVn, 0.01)) {
      punchWorst = { Vu, phiVn: cap.phiVn, pg, cap, col: c, amp, ok: okP };
    }
  }
  if (!punchWorst) {
    punchWorst = { Vu: it.Vu, phiVn: it.cap.phiVn, pg: it.pg, cap: it.cap, col: typ, amp: 1, ok: it.Vu <= it.cap.phiVn + 1e-6 };
  }
  const lvCant = lv;
  const mTransPts = Array.from({ length: 13 }, (_, i) => {
    const x = (i / 12) * lvCant;
    return { x, M: (it.qu * x * x) / 2 };
  });
  const vTransPts = Array.from({ length: 13 }, (_, i) => {
    const x = (i / 12) * lvCant;
    return { x, M: it.qu * x };
  });

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
  const ldLong = ldTension(fy, fc, vcInf.db);
  const Dshare = 0.7 * sumP;
  const Lshare = 0.3 * sumP;
  const PuComb = 1.4 * Dshare + 1.7 * Lshare;
  const ejemploNota = usedExample
    ? "Planta de ejemplo del expediente (editable en el croquis: celdas, vanos y columnas con 6 GDL)."
    : "Planta del proyecto, unión de celdas pintadas.";

  return out(
    `Zapata ${isL ? "en L / irregular" : "corrida"}  A=${fmt(A, 1)} m²  ·  h=${fmt(it.h, 2)} m  ·  ${cols.length} col.  ·  ${runRes.length} VC`,
    `Transv. ${fmtBar(prin)}  ·  VC ${vcInf.text} inf. / ${vcSup.text} sup.  ·  qmáx=${fmt(qmax, 2)} t/m². ${ejemploNota}`,
    [
      step(
        "01",
        "Geometría de la planta — área, baricentro e inercias",
        "A = Σ bi ℓi    ·    x̄ = Σ Ai xi / A    ·    Ixx = Σ (bi hi³/12 + Ai yi²)",
        "A=\\sum b_i\\ell_i\\qquad \\bar{x}=\\dfrac{\\sum A_i x_i}{A}\\qquad I_{xx}=\\sum\\left(\\dfrac{b_i h_i^3}{12}+A_i y_i^2\\right)",
        `${nxOf(m)}×${nyOf(m)} celdas    ·    ${nCells} pintadas    ·    ${cols.length} columnas    ·    ${runRes.length} viga(s) de cimentación    ·    ${ejemploNota}`,
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
        "E.050: σn es el admisible NETO (ya descontó relleno, peso propio y s/c). Por eso q en vértices se calcula SOLO con las cargas de columnas ΣP/A ± Mc/I, no con la presión total bruta. Comparar q_bruta contra σn duplicaría el peso propio.",
        {
          ok: qmax <= it.qn + 0.05 && it.qn > 0 && inKern,
          desarrollo: [
            `σn = ${fmt(qadmT, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(it.h, 2)} − ${fmt(sc, 2)} = ${fmt(it.qn, 2)} t/m² (admisible para la estructura).`,
            `q de columnas (neta): ΣP/A = ${fmt(sumP, 1)}/${fmt(A, 2)} = ${fmt(qCol, 2)} t/m².`,
            `Presión bruta total (información): qserv = (ΣP + γc h A + γt (Df−h) A + s/c A) / A = ${fmt(qserv, 2)} t/m²  vs  σadm = ${fmt(qadmT, 2)} t/m².`,
            `Excentricidad de la resultante: ex = My/ΣP = ${fmt(My, 1)}/${fmt(sumP, 1)} = ${fmt(ex, 3)} m; ey = Mx/ΣP = ${fmt(ey, 3)} m.`,
            `En cada vértice q = ΣP/A + Mx (y−ȳ)/Ixx + My (x−x̄)/Iyy. qmáx = ${fmt(qmax, 2)} t/m² ${qmax <= it.qn + 0.05 ? "≤ σn (CUMPLE)" : "> σn (NO — ensanchar planta o bajar cargas)"}.`,
            `qmín = ${fmt(qmin, 2)} t/m² ${inKern ? "≥ 0, contacto completo." : "< 0, hay despegue: redistribuir o recentrar."}`,
          ],
          table: {
            caption: "Presión neta de servicio en vértices (solo columnas)",
            headers: ["Vértice", "x (m)", "y (m)", "q (t/m²)"],
            rows: qCornerRows.slice(0, 16),
          },
        },
      ),
      step(
        "04",
        "Prediseño de h — corte 1 dir., punzonamiento 11.12 y flexión de vuelo",
        "h ← h + 5 cm hasta σn>0, Vu ≤ φVc y Vu ≤ φVn en TODAS las columnas    ·    rec ≥ 7.5 cm    ·    h ≥ 35 cm",
        "h\\leftarrow h+0.05\\,\\mathrm{m}\\quad d=h-\\mathrm{rec}",
        `ℓv gob. = ${fmt(lv, 2)} m (vuelo real al borde pintado)    ·    rec = ${fmt(rec, 1)} cm (E.060 7.7.1)    ·    h inicial = ${fmt(hfIn, 2)} m`,
        `h = ${fmt(it.h, 2)} m    ·    d = ${fmt(it.d, 1)} cm    ·    ${it.ok ? "CUMPLE el lazo" : "no convergió: revise σadm, luces o cargas"}`,
        "Cada fila es un espesor ensayado. Gobiernan corte a d de la cara (E.060 11.3) y punzonamiento de la columna peor (11.12, con amplificación de momento en borde/esquina). El mínimo de norma es h ≥ 35 cm, no h ≥ ℓv/2.",
        {
          desarrollo: [
            `Vuelo gobernante ℓv = ${fmt(lv, 2)} m (máximo de los cuatro rayos desde la cara del pedestal hasta salir del concreto pintado).`,
            `Mínimo de norma: h ≥ 0,35 m. ℓv/2 = ${fmt(lv / 2, 2)} m es solo guía de predimension.`,
            `Peralte efectivo d = 100 h − rec. Última fila: h = ${fmt(it.h, 2)} m → d = ${fmt(it.d, 1)} cm.`,
            `qu última = (ΣPu + 1,4 (γc h + γt (Df−h)) A + 1,7 s/c A)/A = ${fmt(it.qu, 2)} t/m².`,
            `Vu (1 dir.) = qu(ℓv−d) = ${fmt(it.qu, 2)}×${fmt(Math.max(lv - it.d / 100, 0), 3)} = ${fmt(it.sh.Vu, 2)} t/m.`,
            `vc = 0,53√f'c = ${fmt(vcKg, 2)} kg/cm² → φVc = 0,85·vc·100·d/1000 = ${fmt(it.sh.phiVc, 2)} t/m.`,
            `El lazo verifica punzonamiento de todas las columnas (no solo la de mayor Pu): gobierna ${punchWorst.col.col.id} (${punchWorst.pg.kind}).`,
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
        "Barras perpendiculares al eje largo (vuelo), cara del suelo. El despiece A1 es en planta: un transversal por paño (lecho inf.), un longitudinal inf. continuo por franja y un longitudinal sup. cortado (L_teo + ℓd) en cada apoyo. No hay acero a media altura.",
        {
          desarrollo: [
            `qu última (incluye 1.4 del peso propio) = ${fmt(it.qu, 2)} t/m².`,
            `Mu gob. = qu ℓv² / 2 = ${fmt(it.qu, 2)} × ${fmt(lv, 2)}² / 2 = ${fmt(it.Mu, 3)} t·m/m (voladizo, cara del suelo).`,
            `Whitney: Rn = Mu/(φ b d²) = ${fmt(flex.Rn, 1)} kg/cm², ρ de la ecuación de segundo grado, As = máx(ρbd, 0.0018 bh) = ${fmt(flex.As, 2)} cm²/m.`,
            `Se adopta ${fmtBar(prin)} para el vuelo (malla de losa). En planta: longitudinal de losa ${fmtBar(dist)} (cuantía 0,0018, temperatura/reparto). La viga de cimentación lleva ${vcInf.text} inf. y ${vcSup.text} sup. (barras, no malla).`,
            "El despiece A1 es planta: transversal inf. un Ø por paño; longitudinal inf. continuo (sin corte); superior cortado y proporcional al vano en cada apoyo.",
          ],
          table: {
            caption: "Transversal por paño (lecho inferior)",
            headers: ["Paño", "Δx (m)", "Δy (m)", "ℓv (m)", "Mu (t·m/m)", "Ø @ s"],
            rows: paneRows,
          },
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
        "Vu = α (Pu − qu Acrit)    ·    vc = mín{0.53(2+4/βc), 0.53(αs d/b0+2), 1.06} √f'c    ·    φVn = 0.85 vc b0 d",
        "V_u=\\alpha(P_u-q_u A_{\\mathrm{crit}})\\qquad v_c=\\min\\{0.53(2+4/\\beta_c),\\,0.53(\\alpha_s d/b_0+2),\\,1.06\\}\\sqrt{f'_c}",
        `${punchWorst.col.col.id} tipo ${punchWorst.pg.kind}    ·    α = ${fmt(punchWorst.amp, 2)}    ·    b0 = ${fmt(punchWorst.pg.b0, 1)} cm    ·    αs = ${punchWorst.pg.alphaS}    ·    criterio ${punchWorst.cap.govern}    ·    Acrit = ${fmt(punchWorst.pg.Acrit, 2)} m²`,
        `Vu = ${fmt(punchWorst.Vu, 2)} t    ·    φVn = ${fmt(punchWorst.phiVn, 2)} t    ·    Vu/φVn = ${fmt(punchWorst.Vu / Math.max(punchWorst.phiVn, 0.01), 2)}    ·    ${punchWorst.ok ? "CUMPLE" : "NO"}`,
        "αs = 40 interior, 30 borde, 20 esquina. α = 1,00 / 1,15 / 1,25 (interior / borde / esquina) cubre de forma simplificada la transferencia de momento E.060 11.12.6. El perímetro a d/2 se recorta al concreto pintado. Se verifica cada columna.",
        {
          ok: punchWorst.ok,
          desarrollo: [
            `Columna gobernante ${punchWorst.col.col.id}: Pu = ${fmt(punchWorst.col.Pu, 1)} t, sección ${fmt(punchWorst.col.col.t1, 2)} × ${fmt(punchWorst.col.col.t2, 2)} m, ${punchWorst.pg.kind}. El pedestal se asienta entero sobre la zapata.`,
            `Perímetro crítico recortado b0 = ${fmt(punchWorst.pg.b0, 1)} cm (${punchWorst.pg.kind === "esquina" ? "L: (c1+d/2)+(c2+d/2)" : punchWorst.pg.kind === "borde" ? "tres lados" : "cuatro lados"}). Área interior Acrit = ${fmt(punchWorst.pg.Acrit, 2)} m².`,
            `Vu = α (Pu − qu Acrit) = ${fmt(punchWorst.amp, 2)} × (${fmt(punchWorst.col.Pu, 1)} − ${fmt(it.qu, 2)} × ${fmt(punchWorst.pg.Acrit, 2)}) = ${fmt(punchWorst.Vu, 2)} t.`,
            `vc = mín{0,53(2+4/βc), 0,53(αs d/b0+2), 1,06}√f'c. Gobierna ${punchWorst.cap.govern}.`,
            `φVn = 0,85 vc b0 d = ${fmt(punchWorst.phiVn, 2)} t. ${punchWorst.ok ? "CUMPLE." : "NO: subir h, capitel o ábaco."}`,
          ],
          table: {
            caption: "Punzonamiento por columna (E.060 11.12)",
            headers: ["Col", "tipo", "α", "b0 (cm)", "Acrit (m²)", "Vu (t)", "φVn (t)", "Vu/φVn", "¿OK?"],
            rows: punchRows,
          },
        },
      ),
      step(
        "08",
        "Vigas de cimentación — viga invertida por tramo",
        "q(x)=a+bx    ·    ∫q = ΣPu    ·    ∫q x = Σ Pu xi + Σ Mc    ·    M(0)=M(L)=0",
        "q(x)=a+bx\\qquad \\int_0^L q\\,\\mathrm{d}x=\\sum P_u\\qquad M(0)=M(L)=0",
        runRes.length
          ? `${runRes.length} tramo(s)    ·    gobierna ${gov.run?.id ?? "—"}    ·    L = ${fmt(gov.run?.L ?? L, 2)} m    ·    b trib. = ${fmt(gov.run?.b ?? B, 2)} m    ·    q(0)=${fmt(beam.q0 ?? gov.w, 2)}  q(L)=${fmt(beam.qL ?? gov.w, 2)} t/m    ·    ${gov.nCol} col.`
          : `Sin VC en planta    ·    envolvente del eje L = ${fmt(L, 2)} m    ·    B = ${fmt(B, 2)} m`,
        `M+ = ${fmt(beam.Mmax, 2)} t·m    ·    M− = ${fmt(beam.Mmin, 2)} t·m    ·    Vmáx = ${fmt(beam.Vmax, 2)} t    ·    ${vcInf.text} inf.    ·    ${vcSup.text} sup.    ·    est. ${shSt.arregloPlano}`,
        "Cada tramo con columnas es una viga invertida rígida de extremos libres (Bowles): la reacción del suelo q(x)=a+bx se calibra a las Pu y Mc de las columnas asignadas a ESE tramo. Predimensión h = ℓn/7 (luz libre entre caras). M− entre apoyos (lecho inf. continuo); M+ en vuelos (lecho sup. L_teo+ℓd). Si L/h es grande, mayorar 1,20 o usar Winkler.",
        {
          desarrollo: runRes.length
            ? [
                `Se identifican ${runRes.length} tramo(s) continuo(s). Cada vano se coloca o se borra por separado (Viga cim.). Al apagar un vano, el tramo se parte y las columnas pasan al VC más cercano de esa dirección.`,
                `Luz libre ℓn = ${fmt(lnVC, 2)} m (entre caras). Predimensión h = ℓn/7 = ${fmt(hPred, 2)} m. Adoptado h = ${fmt(hBeam, 2)} m, d = ${fmt(dBeam, 1)} cm.`,
                `Gobierna ${gov.run?.id ?? "—"} (${gov.run?.kind === "v" ? "vertical" : "horizontal"}, L = ${fmt(gov.run?.L ?? 0, 2)} m, b trib. = ${fmt(gov.run?.b ?? 0, 2)} m, ${gov.nCol} col.): q(0) = ${fmt(beam.q0 ?? 0, 2)} t/m, q(L) = ${fmt(beam.qL ?? 0, 2)} t/m. Promedio ΣPu/L = ${fmt(gov.w, 2)} t/m. qu·b del paño = ${fmt(gov.wSoil ?? 0, 2)} t/m (comparación, no se aplica a un eje vacío).`,
                `Equilibrio del tramo: V(L) ≈ ${fmt(beam.Vend, 2)} t, M(L) ≈ ${fmt(beam.pts[beam.pts.length - 1]?.M ?? 0, 2)} t·m (extremos libres).`,
                `Cortante de viga: Vu = ${fmt(beam.Vmax, 2)} t  vs  φVc = ${fmt(shSt.phiVc, 2)} t y φ(Vc+Vs,máx) = ${fmt(0.85 * (shSt.Vc + shSt.VsMax), 1)} t. Estribos 2Ø ${estBar.name}: ${shSt.arregloPlano} (${shSt.sectionOk ? "sección OK" : "NO — subir h o b"}).`,
                `Lecho inf. |M−| = ${fmt(Math.max(-beam.Mmin, 0), 2)} t·m → As = ${fmt(flexLong.As, 2)} cm² → ${vcInf.text} (corrido). Lecho sup. M+ = ${fmt(Math.max(beam.Mmax, 0), 2)} t·m → As = ${fmt(flexSup.As, 2)} cm² → ${vcSup.text} (L_teo+ℓd).`,
              ]
            : [
                "No hay vigas de cimentación. Coloque tramos uno a uno con «Viga cim.» o restaure los bordes con «Vigas en bordes».",
                `Mientras tanto se informa la envolvente del eje longitudinal. |M| = ${fmt(Math.max(beam.Mmax, -beam.Mmin), 2)} t·m → ${vcInf.text}.`,
              ],
          table: runRes.length
            ? {
                caption: "Viga invertida por tramo (extremos libres, q lineal de equilibrio)",
                headers: ["Tramo", "eje", "L (m)", "b trib. (m)", "n col.", "q(0)", "q(L)", "M+ (t·m)", "M− (t·m)", "Vmáx (t)"],
                rows: runRes.map((r) => [
                  r.run.id,
                  r.run.kind === "h" ? `Y=${r.run.y0.toFixed(2)}` : `X=${r.run.x0.toFixed(2)}`,
                  fmt(r.run.L, 2),
                  fmt(r.run.b, 2),
                  String(r.nCol),
                  fmt(r.beam.q0 ?? r.w, 2),
                  fmt(r.beam.qL ?? r.w, 2),
                  fmt(r.beam.Mmax, 2),
                  fmt(r.beam.Mmin, 2),
                  fmt(r.beam.Vmax, 2),
                ]),
              }
            : undefined,
          ok: shBeam.ok,
        },
      ),
      step(
        "09",
        "Desarrollo y anclaje — E.060 12.2",
        "ℓd = 0.075 fy db / √f'c    ·    L_barra,sup = L_teo + ℓd    ·    L_teo ≈ 0,30 ℓn    ·    L_ext ≥ máx(d, 12 db, ℓn/16)",
        "\\ell_d=0.075\\,f_y d_b/\\sqrt{f'_c}\\qquad L_{\\mathrm{sup}}=L_{\\mathrm{teo}}+\\ell_d",
        `fy = ${fmt(fy, 0)} kg/cm²    ·    f'c = ${fmt(fc, 0)}    ·    db transv. = ${fmt(prin.db, 2)} cm    ·    db VC = ${fmt(vcInf.db, 2)} cm`,
        `ℓd transv. = ${fmt(ldPrin, 1)} cm    ·    ℓd viga = ${fmt(ldLong, 1)} cm    ·    gancho 90° transv. ≥ ${fmt(12 * prin.db, 1)} cm`,
        "Losa: lecho inferior transversal (vuelo) y longitudinal de temperatura 0,0018. VC: inferior continuo (barras) y superior cortado L_teo + ℓd. Rec ≥ 7,5 cm.",
        {
          desarrollo: [
            `Losa inf. long. ${fmtBar(dist)} (0,0018 bh). Transversal ${fmtBar(prin)}: ℓd = ${fmt(ldPrin, 1)} cm.`,
            `VC inf. ${vcInf.text}: ℓd = ${fmt(ldLong, 1)} cm, continuo. VC sup. ${vcSup.text}: L_teo ≈ 0,30 ℓn + ℓd = ${fmt(ldTension(fy, fc, vcSup.db), 1)} cm.`,
            `Gancho 90° mínimo 12 db. Recubrimiento rec = ${fmt(rec, 1)} cm ≥ 7.5 cm (E.060 7.7.1).`,
          ],
        },
      ),
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)} t/m²`, `≤ ${fmt(it.qn, 2)}`, qmax <= it.qn + 0.05 && it.qn > 0),
      ok("qmín ≥ 0 (sin despegue)", `${fmt(qmin, 2)} t/m²`, "≥ 0", inKern),
      ok("Corte 1 dir.", `${fmt(it.sh.Vu, 2)}`, `≤ ${fmt(it.sh.phiVc, 2)}`, it.sh.ok),
      ok("Punzonamiento", `${fmt(punchWorst.Vu, 1)} t`, `≤ ${fmt(punchWorst.phiVn, 1)} t`, punchWorst.ok),
      ok("h ≥ 35 cm", `${fmt(it.h * 100, 0)} cm`, "≥ 35", it.h >= 0.35),
      ok("Columnas clicadas", String(cols.length), "≥ 1", cols.length >= 1),
      ok("Vigas de cimentación", String(runRes.length), "≥ 1", runRes.length >= 1),
      ok("Cortante de VC", `${fmt(beam.Vmax, 1)} t`, `≤ ${fmt(0.85 * (shSt.Vc + shSt.VsMax), 1)} t`, shSt.sectionOk),
    ],
    [
      {
        title: "Estaciones de la viga invertida gobernante",
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
      AsDist: (0.0018 * 100 * it.h * 100).toFixed(2),
      asPrinPanes: JSON.stringify(Object.fromEntries(paneRows.map((r) => [r[0], r[5]]))),
      Lbeam: (gov.run?.L ?? L).toFixed(2),
      mPts: packPts(beam.pts),
      Msoil: Math.max(-beam.Mmin, 0).toFixed(3),
      Mtop: Math.max(beam.Mmax, 0).toFixed(3),
      asLong: fmtBar(dist),
      AsLong: flexLong.As.toFixed(2),
      asSup: fmtBar(dist),
      asSupT: fmtBar(supTrans),
      asVCInf: vcInf.text,
      asVCSup: vcSup.text,
      AsVCInf: flexLong.As.toFixed(2),
      AsVCSup: flexSup.As.toFixed(2),
      VmaxVC: beam.Vmax.toFixed(2),
      estVC: `2Ø ${estBar.name} ${shSt.arregloPlano}`,
      sApoyoVC: String(shSt.sApoyo),
      sCentroVC: String(shSt.sCentro),
      nEstVC: String(shSt.nTotal),
      LzonaVC: shSt.Lzona.toFixed(2),
      vcColsJson: JSON.stringify({
        cols: (gov.run
          ? loadsOnGradeBeam(gov.run, runPts, runs)
          : loads.map((c) => ({ x: c.x - m.axesX[0], P: c.Pu, M: c.M3 }))
        ).map((c, i) => ({ x: c.x, P: c.P, M: c.M, id: `C${i + 1}` })),
      }),
      bBeam: bBeam.toFixed(2),
      hBeam: hBeam.toFixed(2),
      lnVC: lnVC.toFixed(2),
      hPred: hPred.toFixed(2),
      nBeams: String(runRes.length),
      beamGov: gov.run?.id ?? "",
      vPts: packV(beam.pts),
      vPtsTrans: packPts(vTransPts),
      mPtsTrans: packPts(mTransPts),
      punchVu: punchWorst.Vu.toFixed(2),
      punchPhi: punchWorst.phiVn.toFixed(2),
      punchOk: punchWorst.ok ? "1" : "0",
      punchB0: punchWorst.pg.b0.toFixed(1),
      punchKind: punchWorst.pg.kind,
      punchJson: JSON.stringify({
        L,
        B,
        d: it.d / 100,
        col: { x: punchWorst.pg.cx, y: punchWorst.pg.cy, t1: punchWorst.col.col.t1, t2: punchWorst.col.col.t2, id: punchWorst.col.col.id },
        poly: punchWorst.pg.poly,
        segs: punchWorst.pg.segs,
        Vu: punchWorst.Vu,
        phiVn: punchWorst.phiVn,
        b0: punchWorst.pg.b0,
        kind: punchWorst.pg.kind,
        ok: punchWorst.ok,
        slab: painted,
      }),
      studioJson: str(raw, "studioJson", ""),
      corridaJson: str(raw, "corridaJson", ""),
    },
  );
};
