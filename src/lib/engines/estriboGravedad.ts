import { type CalcCheck, type CalcOutput, type CalcStep, type Engine, fmt, num, rad, str } from "../types";

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

function paso(
  n: string,
  title: string,
  formula: string,
  substitution: string,
  result: string,
  extra?: { note?: string; ok?: boolean; table?: CalcStep["table"] }
): CalcStep {
  return { n, title, formula, substitution, result, ...extra };
}

function bindTable(steps: CalcStep[], n: string, extra: { title: string; rows: string[][] } | undefined) {
  if (!extra) return;
  const s = steps.find((x) => x.n === n);
  if (!s) return;
  s.table = { caption: extra.title, headers: extra.rows[0] ?? [], rows: extra.rows.slice(1) };
}

function nn(i: number) {
  return String(i).padStart(2, "0");
}

function r(x: number, d: number) {
  const p = 10 ** d;
  return Math.round(x * p + Number.EPSILON) / p;
}

function roundDown05(x: number) {
  const d1 = Math.floor(x * 10 + 1e-9) / 10;
  if (Math.abs(x - d1) < 1e-9) return d1;
  if (d1 + 0.05 > x + 1e-12) return d1;
  return r(d1 + 0.05, 2);
}

function roundB(H: number) {
  const raw = r(H * 15 / 24, 2);
  const up = Math.ceil(raw * 10 - 1e-9) / 10;
  return up - 0.05 < raw - 1e-12 ? up : r(up - 0.05, 2);
}

function roundN(raw: number) {
  const up = Math.ceil(raw * 10 - 1e-12) / 10;
  return up - 0.05 < raw ? up : r(up - 0.05, 2);
}

/** Altura equivalente de suelo por sobrecarga vehicular. Tabla 3.11.6.4-1 (Excel GRAVEDAD RECTO). */
export function hPrimeGravedad(H: number) {
  const raw = H >= 6 ? 0.6 : 1.2 - H * 0.1;
  const up = Math.ceil(raw * 10 - 1e-12) / 10;
  return up - raw < 0.05 ? up : r(raw, 1);
}

export function predimEstriboG(H: number, Ltab: number, e: number) {
  const a = Math.min(0.4, roundDown05(H / 12));
  const bTalon = a;
  const h = Math.min(0.6, roundDown05(H / 8));
  const tBack = Math.min(0.55, roundDown05(H / 8));
  const B = roundB(H);
  const den = Math.max(H - h - e, 0.05);
  const S = r((Math.atan((B - tBack - 0.5 - a - bTalon) / den) * 180) / Math.PI, 2);
  const Nraw = (2 * (200 + 0.0017 * Ltab * 1000) * (1 + 0.000125 * S * S)) / 1000;
  const N = roundN(Nraw);
  return { a, bTalon, h, tBack, B, S, N };
}

function coulomb(phi: number, delta: number, beta: number, theta: number) {
  const inner =
    (Math.sin(rad(phi + delta)) * Math.sin(rad(phi - beta))) /
    Math.max(1e-9, Math.sin(rad(theta - delta)) * Math.sin(rad(theta + beta)));
  const Gamma = r((1 + Math.sqrt(Math.max(0, inner))) ** 2, 3);
  const ka = r((Math.cos(rad(phi)) ** 2) / Math.max(1e-9, Gamma * Math.cos(rad(delta))), 3);
  return { Gamma, ka };
}

type Combo = {
  name: string;
  gDC: number;
  gDW: number;
  gEV: number;
  gLL: number;
  gLSy: number;
  gEH: number;
  gLSx: number;
  gWS: number;
  gBR: number;
  gCR: number;
  uso: string;
};

const COMBOS: Combo[] = [
  { name: "Resistencia Ia", gDC: 0.9, gDW: 0.65, gEV: 1, gLL: 0, gLSy: 0, gEH: 1.5, gLSx: 1.75, gWS: 0, gBR: 1.75, gCR: 0.5, uso: "Deslizamiento y vuelco" },
  { name: "Resistencia Ib", gDC: 1.25, gDW: 1.5, gEV: 1.35, gLL: 1.75, gLSy: 1.75, gEH: 1.5, gLSx: 1.75, gWS: 0, gBR: 1.75, gCR: 0.5, uso: "Presiones y resistencia" },
  { name: "Resistencia IIIa", gDC: 0.9, gDW: 0.65, gEV: 1, gLL: 0, gLSy: 0, gEH: 1.5, gLSx: 0, gWS: 1.4, gBR: 0, gCR: 0.5, uso: "Deslizamiento y vuelco" },
  { name: "Resistencia IIIb", gDC: 1.25, gDW: 1.5, gEV: 1.35, gLL: 0, gLSy: 0, gEH: 1.5, gLSx: 0, gWS: 1.4, gBR: 0, gCR: 0.5, uso: "Presiones y resistencia" },
];

function nLookup(kind: string, val: string) {
  if (kind === "D") {
    if (val === "no-ductil") return 1.05;
    return 1;
  }
  if (kind === "R") return val === "no-redundante" ? 1.05 : 1;
  if (val === "muy") return 1.05;
  if (val === "poco") return 0.95;
  return 1;
}

export const estriboGravedad: Engine = (raw) => {
  const H = num(raw, "H", 4);
  const Ltab = num(raw, "Ltab", 12);
  const e = num(raw, "e", 0.8);
  const eLosa = num(raw, "eLosa", 0.3);
  const hz = num(raw, "hz", 1);
  const auto = predimEstriboG(H, Ltab, e);
  const B = num(raw, "B", auto.B);
  const a = num(raw, "a", auto.a);
  const bTalon = num(raw, "bTalon", auto.bTalon);
  const h = num(raw, "h", auto.h);
  const N = num(raw, "N", auto.N);
  const tBack = num(raw, "tBack", auto.tBack);
  const PDC = num(raw, "PDC", 7) * 1000;
  const PDW = num(raw, "PDW", 0.8) * 1000;
  const PLLIM = num(raw, "PLLIM", 9) * 1000;
  const BR = num(raw, "BR", 0.3) * 1000;
  const WS = num(raw, "WS", 0.15) * 1000;
  const CR = num(raw, "CRSHTU", 0.9) * 1000;
  const hBR = num(raw, "hBR", 1.8);
  const velV = num(raw, "velViento", 0.4);
  const phi = num(raw, "phi", 31);
  const beta = num(raw, "beta", 0);
  const theta = num(raw, "theta", 90);
  const delta = num(raw, "delta", 24);
  const gc = num(raw, "gc", 2.32) * 1000;
  const gs = num(raw, "gs", 1.6) * 1000;
  const qr = num(raw, "qr", 2);
  const suelo = str(raw, "suelo", "no-rocoso");
  const rocoso = suelo === "rocoso";
  const phiT = num(raw, "phiT", 1);
  const nD = nLookup("D", str(raw, "ductil", "ductil"));
  const nR = nLookup("R", str(raw, "redund", "redundante"));
  const nI = nLookup("I", str(raw, "importancia", "tipico"));
  const nMod = Math.min(1, Math.max(0.95, nD * nR * nI));

  const denS = Math.max(H - h - e, 0.05);
  const S = r((Math.atan((B - tBack - N - a - bTalon) / denS) * 180) / Math.PI, 2);
  const stem = Math.max(0.05, B - tBack - a - bTalon - N);
  const { Gamma, ka } = coulomb(phi, delta, beta, theta);
  const hp = hPrimeGravedad(H);
  const Hsoil = H - eLosa;
  const Hstem = H - e - h;

  const V1 = stem * Hstem / 2;
  const V2 = N * (H - e - h);
  const V3 = tBack * (H - h);
  const V4 = h * B;
  const DC1 = gc * V1;
  const DC2 = gc * V2;
  const DC3 = gc * V3;
  const DC4 = gc * V4;
  const x1 = a + (2 * stem) / 3;
  const x2 = a + stem + N / 2;
  const x3 = a + stem + N + tBack / 2;
  const x4 = B / 2;
  const DCestr = DC1 + DC2 + DC3 + DC4;
  const Mdc = DC1 * x1 + DC2 * x2 + DC3 * x3 + DC4 * x4;
  const XAestr = DCestr > 0 ? Mdc / DCestr : B / 2;

  const DClosa = gc * eLosa * bTalon;
  const xLosa = B - bTalon / 2;

  const emb = Math.max(hz - h, 0);
  const tanS = Math.tan(rad(S));
  const wSkew = r(emb * tanS, 2);
  const EV1v = (H - eLosa - h) * bTalon;
  const EV2v = a * emb;
  const EV3v = (wSkew * emb) / 2;
  const EV1 = gs * EV1v;
  const EV2 = gs * EV2v;
  const EV3 = gs * EV3v;
  const EV = EV1 + EV2 + EV3;
  const xEV1 = B - bTalon / 2;
  const xEV2 = a / 2;
  const xEV3 = a + wSkew / 3;
  const MEV = EV1 * xEV1 + EV2 * xEV2 + EV3 * xEV3;
  const XAEV = EV > 0 ? MEV / EV : B / 2;

  const EH1 = r(0.5 * ka * gs * Hsoil * Hsoil, 2);
  const EH2 = r(eLosa * gc * ka * Hsoil, 2);
  const LS2 = r(Hsoil * ka * hp * gs, 2);
  const LS1 = hp * bTalon * gs;
  const sDel = Math.sin(rad(delta));
  const cDel = Math.cos(rad(delta));
  const EH1Y = r(EH1 * sDel, 2);
  const EH2Y = r(EH2 * sDel, 2);
  const LS2Y = r(LS2 * sDel, 2);
  const EH1X = r(EH1 * cDel, 2);
  const EH2X = r(EH2 * cDel, 2);
  const LS2X = r(LS2 * cDel, 2);

  const xPDC = a + stem + N / 2;
  const xEH_Y = B;
  const xLS1 = B - bTalon / 2;
  const yEH1 = r(Hsoil / 3, 2);
  const yEH2 = r(Hsoil / 2, 2);
  const yLS = r(Hsoil / 2, 2);
  const yWS = H - e / 2;
  const yBR = H + hBR;
  const yCR = yWS;

  const loadsV = [
    { name: "DCestr", tipo: "DC", V: DCestr, x: XAestr },
    { name: "DClosa", tipo: "DC", V: DClosa, x: xLosa },
    { name: "PDC", tipo: "DC", V: PDC, x: xPDC },
    { name: "PDW", tipo: "DW", V: PDW, x: xPDC },
    { name: "EV", tipo: "EV", V: EV, x: XAEV },
    { name: "EH1Y", tipo: "EH", V: EH1Y, x: xEH_Y },
    { name: "EH2Y", tipo: "EH", V: EH2Y, x: xEH_Y },
    { name: "PLL+IM", tipo: "LL+IM", V: PLLIM, x: xPDC },
    { name: "LS1", tipo: "LS", V: LS1, x: xLS1 },
    { name: "LS2Y", tipo: "LS", V: LS2Y, x: xEH_Y },
  ];
  const loadsH = [
    { name: "EH1X", tipo: "EH", H: EH1X, y: yEH1 },
    { name: "EH2X", tipo: "EH", H: EH2X, y: yEH2 },
    { name: "LS2X", tipo: "LS", H: LS2X, y: yLS },
    { name: "WS", tipo: "WS", H: WS, y: yWS },
    { name: "BR", tipo: "BR", H: BR, y: yBR },
    { name: "CR+SH+TU", tipo: "CR+SH+TU", H: CR, y: yCR },
  ];
  const Mv = (row: (typeof loadsV)[number]) => row.V * row.x;
  const Mh = (row: (typeof loadsH)[number]) => row.H * row.y;

  const pickV = (c: Combo, name: string) => {
    const row = loadsV.find((L) => L.name === name)!;
    const g =
      row.tipo === "DC" ? c.gDC :
      row.tipo === "DW" ? c.gDW :
      row.tipo === "EV" ? c.gEV :
      row.tipo === "EH" ? c.gEH :
      row.tipo === "LL+IM" ? c.gLL :
      c.gLSy;
    return { g, V: row.V * g, M: Mv(row) * g };
  };
  const pickH = (c: Combo, name: string) => {
    const row = loadsH.find((L) => L.name === name)!;
    const g =
      row.tipo === "EH" ? c.gEH :
      row.tipo === "LS" ? c.gLSx :
      row.tipo === "WS" ? c.gWS :
      row.tipo === "BR" ? c.gBR :
      c.gCR;
    return { g, Hu: row.H * g, M: Mh(row) * g };
  };

  const comboI = COMBOS.map((c) => {
    const vs = loadsV.map((L) => pickV(c, L.name));
    const hs = loadsH.map((L) => pickH(c, L.name));
    const Vu = vs.reduce((s, x) => s + x.V, 0) * nMod;
    const Mvu = vs.reduce((s, x) => s + x.M, 0) * nMod;
    const Hu = hs.reduce((s, x) => s + x.Hu, 0) * nMod;
    const Mhu = hs.reduce((s, x) => s + x.M, 0) * nMod;
    return { c, Vu, Mvu, Hu, Mhu };
  });

  const namesII = ["DCestr", "DClosa", "EV"] as const;
  const comboII = COMBOS.map((c) => {
    const vs = namesII.map((nm) => pickV(c, nm));
    const hs = [pickH(c, "EH1X")];
    const Vu = vs.reduce((s, x) => s + x.V, 0) * nMod;
    const Mvu = vs.reduce((s, x) => s + x.M, 0) * nMod;
    const Hu = hs.reduce((s, x) => s + x.Hu, 0) * nMod;
    const Mhu = hs.reduce((s, x) => s + x.M, 0) * nMod;
    return { c, Vu, Mvu, Hu, Mhu };
  });

  const mu = r(Math.tan(rad(delta)), 2);
  const emax = rocoso ? 0.45 * B : B / 3;

  function evaluate(rows: typeof comboI) {
    return rows.map((row) => {
      const Xo = row.Vu > 0 ? r((row.Mvu - row.Mhu) / row.Vu, 3) : 0;
      const e = r(B / 2 - Xo, 3);
      const eAbs = Math.abs(e);
      const Ff = r(mu * phiT * row.Vu, 2);
      const qMeyerhof = row.Vu / Math.max(B - 2 * eAbs, 0.05) / 10000;
      const qmax = (row.Vu / B) * (1 + (6 * eAbs) / B) / 10000;
      const qmin = (row.Vu / B) * (1 - (6 * eAbs) / B) / 10000;
      const q = rocoso ? qmax : r(qMeyerhof, 2);
      const okE = eAbs <= emax + 1e-6;
      const okS = Ff > row.Hu;
      const okQ = rocoso ? qmax <= qr && qmin <= qr : q <= qr;
      return { ...row, Xo, e, eAbs, Ff, q, qmax, qmin, okE, okS, okQ };
    });
  }

  const evI = evaluate(comboI);
  const evII = evaluate(comboII);
  const allI = evI.every((x) => x.okE && x.okS && x.okQ);
  const allII = evII.every((x) => x.okE && x.okS && x.okQ);
  const qpeak = Math.max(...evI.map((x) => (rocoso ? x.qmax : x.q)));
  const epeak = Math.max(...evI.map((x) => x.eAbs));

  const t = (kg: number) => fmt(kg / 1000, 2);
  const tm = (kgm: number) => fmt(kgm / 1000, 2);

  const kp = (1 + Math.sin(rad(phi))) / (1 - Math.sin(rad(phi)));
  const needDiente = evII.some((x) => !x.okS);
  const senPD = Math.sin(rad(phi + delta));
  const senPB = Math.sin(rad(phi - beta));
  const senTD = Math.sin(rad(theta - delta));
  const senTB = Math.sin(rad(theta + beta));
  const innerC = (senPD * senPB) / Math.max(1e-9, senTD * senTB);

  const qTxt = (x: (typeof evI)[number]) =>
    rocoso ? `${fmt(x.qmax, 2)} / ${fmt(x.qmin, 2)} kg/cm²` : `${fmt(x.q, 2)} kg/cm²`;

  function bloqueEL(caso: string, x: (typeof evI)[number], n0: number): CalcStep[] {
    const qFormula = rocoso
      ? "qmáx,mín = (Vu/B) (1 ± 6e/B)    ≤    qr"
      : "q = Vu / (B − 2e)    (Meyerhof, suelo no rocoso)    ≤    qr";
    return [
      paso(
        nn(n0),
        `${caso} — ${x.c.name}: vuelco alrededor de A`,
        rocoso
          ? "Xo = (Mvu − Mhu) / Vu    ·    e = B/2 − Xo    ·    |e| ≤ 0.45 B"
          : "Xo = (Mvu − Mhu) / Vu    ·    e = B/2 − Xo    ·    |e| ≤ B/3",
        `Vu = ${t(x.Vu)} t/m    ·    Mvu = ${tm(x.Mvu)} t·m/m    ·    Mhu = ${tm(x.Mhu)} t·m/m    ·    Xo = (${tm(x.Mvu)} − ${tm(x.Mhu)}) / ${t(x.Vu)} = ${fmt(x.Xo, 3)} m    ·    B/2 = ${fmt(B / 2, 3)} m`,
        `e = ${fmt(x.e, 3)} m    ${x.okE ? "≤" : ">"}    emax = ${fmt(emax, 3)} m    ·    ${x.okE ? "CUMPLE" : "NO CUMPLE"}`,
        { ok: x.okE, note: `${x.c.name} se usa para ${x.c.uso}.` }
      ),
      paso(
        nn(n0 + 1),
        `${caso} — ${x.c.name}: deslizamiento en la base`,
        "μ = tan δ    ·    Ff = μ · φτ · Vu    ·    estable si Ff > Hu",
        `μ = tan ${fmt(delta, 0)}° = ${fmt(mu, 2)}    ·    φτ = ${fmt(phiT, 2)}    ·    Vu = ${t(x.Vu)} t/m    ·    Ff = ${fmt(mu, 2)} × ${fmt(phiT, 2)} × ${t(x.Vu)} = ${t(x.Ff)} t/m    ·    Hu = ${t(x.Hu)} t/m`,
        x.okS ? "Ff > Hu  ·  CUMPLE" : "Ff ≤ Hu  ·  N.S. — revisar B, δ o disponer diente",
        { ok: x.okS }
      ),
      paso(
        nn(n0 + 2),
        `${caso} — ${x.c.name}: presiones en la base`,
        qFormula,
        `suelo ${rocoso ? "rocoso (distribución triangular)" : "no rocoso (Meyerhof uniforme)"}    ·    |e| = ${fmt(x.eAbs, 3)} m    ·    Vu = ${t(x.Vu)} t/m    ·    B − 2e = ${fmt(Math.max(B - 2 * x.eAbs, 0.05), 3)} m    ·    qr = ${fmt(qr, 2)} kg/cm²`,
        `q = ${qTxt(x)}    ${x.okQ ? "≤ qr  ·  CUMPLE" : "> qr  ·  NO CUMPLE"}`,
        { ok: x.okQ }
      ),
    ];
  }

  const steps: CalcStep[] = [
    paso(
      "01",
      "Predimensionado — ancho de cimiento B",
      "B ≈ (15/24) H    (se redondea a 0.05 m)",
      `H = ${fmt(H, 2)} m    ·    15/24 × ${fmt(H, 2)} = ${fmt((15 / 24) * H, 3)} m    ·    sugerido Excel = ${fmt(auto.B, 2)} m`,
      `B adoptado = ${fmt(B, 2)} m`,
      { note: `Rango usual ½H–⅔H = ${fmt(H / 2, 2)} a ${fmt((2 / 3) * H, 2)} m.` }
    ),
    paso(
      "02",
      "Predimensionado — coronación a y talón b",
      "a = b = mín(0.40 m, H/12)    (redondeo a 0.05 m)",
      `H/12 = ${fmt(H / 12, 3)} m    ·    sugerido a = ${fmt(auto.a, 2)} m    ·    sugerido b = ${fmt(auto.bTalon, 2)} m`,
      `a adoptado = ${fmt(a, 2)} m    ·    b adoptado = ${fmt(bTalon, 2)} m`
    ),
    paso(
      "03",
      "Predimensionado — peralte de zapata h y espesor de asiento t",
      "h = mín(0.60 m, H/8)    ·    t = mín(0.55 m, H/8)",
      `H/8 = ${fmt(H / 8, 3)} m    ·    sugerido h = ${fmt(auto.h, 2)} m    ·    sugerido t = ${fmt(auto.tBack, 2)} m`,
      `h adoptado = ${fmt(h, 2)} m    ·    t,asiento adoptado = ${fmt(tBack, 2)} m`
    ),
    paso(
      "04",
      "Inclinación del paramento S",
      "S = arctan[ (B − t − N − a − b) / (H − h − e) ]",
      `(B − t − N − a − b) = ${fmt(B, 2)} − ${fmt(tBack, 2)} − ${fmt(N, 2)} − ${fmt(a, 2)} − ${fmt(bTalon, 2)} = ${fmt(stem, 3)} m    ·    (H − h − e) = ${fmt(H, 2)} − ${fmt(h, 2)} − ${fmt(e, 2)} = ${fmt(denS, 3)} m`,
      `S = ${fmt(S, 2)}°    ·    tan S = ${fmt(tanS, 3)}`,
      { note: "S y el alma se recalculan con el N adoptado (no se deja un N de prueba de 0.50 m)." }
    ),
    paso(
      "05",
      "Longitud de cajuela N — AASHTO 4.7.4.4",
      "N = 2 (200 + 0.0017 Lmm) (1 + 0.000125 S²) / 1000    [m]",
      `L = ${fmt(Ltab * 1000, 0)} mm    ·    S = ${fmt(S, 2)}°    ·    1 + 0.000125 S² = ${fmt(1 + 0.000125 * S * S, 4)}    ·    sugerido = ${fmt(auto.N, 2)} m`,
      `N adoptado = ${fmt(N, 2)} m    ·    alma = B − t − a − b − N = ${fmt(stem, 3)} m`
    ),
    paso(
      "06",
      "Coeficiente de empuje activo — término Γ (Coulomb)",
      "Γ = [1 + √{ sen(φ+δ) sen(φ−β) / (sen(θ−δ) sen(θ+β)) }]²",
      `φ = ${fmt(phi, 1)}°    δ = ${fmt(delta, 1)}°    β = ${fmt(beta, 1)}°    θ = ${fmt(theta, 1)}°    ·    sen(φ+δ) = ${fmt(senPD, 4)}    sen(φ−β) = ${fmt(senPB, 4)}    sen(θ−δ) = ${fmt(senTD, 4)}    sen(θ+β) = ${fmt(senTB, 4)}    ·    radicando = ${fmt(innerC, 4)}`,
      `Γ = ${fmt(Gamma, 3)}`
    ),
    paso(
      "07",
      "Coeficiente de empuje activo ka (Excel GRAVEDAD RECTO)",
      "ka = cos² φ / (Γ cos δ)",
      `cos φ = ${fmt(Math.cos(rad(phi)), 4)}    ·    cos δ = ${fmt(Math.cos(rad(delta)), 4)}    ·    Γ = ${fmt(Gamma, 3)}`,
      `ka = ${fmt(ka, 3)}`
    ),
    paso(
      "08",
      "Altura equivalente de suelo por sobrecarga LS",
      H >= 6 ? "h' = 0.60 m    (H ≥ 6 m, Tabla 3.11.6.4-1)" : "h' = 1.20 − 0.10 H    (H < 6 m, redondeo Excel)",
      H >= 6
        ? `H = ${fmt(H, 2)} m`
        : `H = ${fmt(H, 2)} m    ·    1.20 − 0.10×${fmt(H, 2)} = ${fmt(1.2 - 0.1 * H, 2)} m`,
      `h' = ${fmt(hp, 2)} m`
    ),
    paso(
      "09",
      "Metrado DC — cuerpo 1 alma triangular",
      "V1 = alma × Hstem / 2    ·    DC1 = γc V1    ·    x1 = a + 2·alma/3",
      `Hstem = H − e − h = ${fmt(H, 2)} − ${fmt(e, 2)} − ${fmt(h, 2)} = ${fmt(Hstem, 3)} m    ·    V1 = ${fmt(stem, 3)} × ${fmt(Hstem, 3)} / 2 = ${fmt(V1, 3)} m³/m    ·    γc = ${fmt(gc / 1000, 2)} t/m³    ·    x1 = ${fmt(x1, 3)} m`,
      `DC1 = ${t(DC1)} t/m    ·    M1 = ${tm(DC1 * x1)} t·m/m`
    ),
    paso(
      "10",
      "Metrado DC — cuerpo 2 cajuela N",
      "V2 = N (H − e − h)    ·    DC2 = γc V2    ·    x2 = a + alma + N/2",
      `V2 = ${fmt(N, 2)} × ${fmt(Hstem, 3)} = ${fmt(V2, 3)} m³/m    ·    x2 = ${fmt(x2, 3)} m`,
      `DC2 = ${t(DC2)} t/m    ·    M2 = ${tm(DC2 * x2)} t·m/m`
    ),
    paso(
      "11",
      "Metrado DC — cuerpo 3 asiento t",
      "V3 = t (H − h)    ·    DC3 = γc V3    ·    x3 = a + alma + N + t/2",
      `V3 = ${fmt(tBack, 2)} × ${fmt(H - h, 3)} = ${fmt(V3, 3)} m³/m    ·    x3 = ${fmt(x3, 3)} m`,
      `DC3 = ${t(DC3)} t/m    ·    M3 = ${tm(DC3 * x3)} t·m/m`
    ),
    paso(
      "12",
      "Metrado DC — cuerpo 4 zapata",
      "V4 = h × B    ·    DC4 = γc V4    ·    x4 = B/2",
      `V4 = ${fmt(h, 2)} × ${fmt(B, 2)} = ${fmt(V4, 3)} m³/m    ·    x4 = ${fmt(x4, 3)} m`,
      `DC4 = ${t(DC4)} t/m    ·    M4 = ${tm(DC4 * x4)} t·m/m`
    ),
    paso(
      "13",
      "Peso propio del estribo DCestr",
      "DCestr = DC1 + DC2 + DC3 + DC4    ·    XA = Σ (DCi xi) / DCestr",
      `DC = ${t(DC1)} + ${t(DC2)} + ${t(DC3)} + ${t(DC4)}    ·    ΣM = ${tm(Mdc)} t·m/m`,
      `DCestr = ${t(DCestr)} t/m    ·    XA = ${fmt(XAestr, 3)} m (desde A, aguas)`
    ),
    paso(
      "14",
      "Losa de acercamiento DClosa",
      "DClosa = γc × e,losa × b    ·    x = B − b/2",
      `DClosa = ${fmt(gc / 1000, 2)} × ${fmt(eLosa, 2)} × ${fmt(bTalon, 2)}    ·    x = ${fmt(xLosa, 3)} m`,
      `DClosa = ${t(DClosa)} t/m`
    ),
    paso(
      "15",
      "Cargas de la superestructura del puente",
      "PDC, PDW, PLL+IM, BR, WS, CR+SH+TU  (datos del tablero, franja 1.00 m)",
      `xPDC = a + alma + N/2 = ${fmt(xPDC, 3)} m    ·    yBR = H + hBR = ${fmt(yBR, 2)} m    ·    yWS = H − e/2 = ${fmt(yWS, 2)} m    ·    vel. viento (dato) = ${fmt(velV, 2)} km/h`,
      `PDC = ${t(PDC)} t/m    ·    PDW = ${t(PDW)} t/m    ·    PLL+IM = ${t(PLLIM)} t/m    ·    BR = ${t(BR)} t/m    ·    WS = ${t(WS)} t/m    ·    CR+SH+TU = ${t(CR)} t/m`
    ),
    paso(
      "16",
      "Presión vertical EV1 — relleno sobre el talón",
      "EV1 = γs (H − e,losa − h) b    ·    xEV1 = B − b/2",
      `H − e,losa − h = ${fmt(H - eLosa - h, 3)} m    ·    V = ${fmt(EV1v, 3)} m³/m    ·    γs = ${fmt(gs / 1000, 2)} t/m³    ·    x = ${fmt(xEV1, 3)} m`,
      `EV1 = ${t(EV1)} t/m`
    ),
    paso(
      "17",
      "Presión vertical EV2 — relleno sobre la puntera",
      "EV2 = γs a (hz − h)    ·    xEV2 = a/2",
      `hz − h = ${fmt(emb, 2)} m    ·    V = ${fmt(EV2v, 3)} m³/m    ·    x = ${fmt(xEV2, 3)} m`,
      `EV2 = ${t(EV2)} t/m`
    ),
    paso(
      "18",
      "Presión vertical EV3 — cuña del talud en el empotramiento",
      "EV3 = ½ γs (hz − h)² tan S    ·    wSkew = (hz − h) tan S    ·    xEV3 = a + wSkew/3",
      `tan S = ${fmt(tanS, 3)}    ·    wSkew = ${fmt(wSkew, 2)} m    ·    V = ${fmt(EV3v, 3)} m³/m    ·    x = ${fmt(xEV3, 3)} m`,
      `EV3 = ${t(EV3)} t/m`
    ),
    paso(
      "19",
      "Presión vertical del terreno EV",
      "EV = EV1 + EV2 + EV3    ·    XA,EV = Σ (EVi xi) / EV",
      `EV = ${t(EV1)} + ${t(EV2)} + ${t(EV3)}    ·    ΣM = ${tm(MEV)} t·m/m`,
      `EV = ${t(EV)} t/m    ·    XA,EV = ${fmt(XAEV, 3)} m`
    ),
    paso(
      "20",
      "Empuje activo EH1 sobre el respaldo",
      "EH1 = ½ ka γs Hsoil²    ·    Hsoil = H − e,losa    ·    yEH1 = Hsoil/3",
      `Hsoil = ${fmt(H, 2)} − ${fmt(eLosa, 2)} = ${fmt(Hsoil, 2)} m    ·    EH1 = ½ × ${fmt(ka, 3)} × ${fmt(gs / 1000, 2)} × ${fmt(Hsoil, 2)}²    ·    y = ${fmt(yEH1, 2)} m`,
      `EH1 = ${t(EH1)} t/m`
    ),
    paso(
      "21",
      "Empuje por losa de acercamiento EH2",
      "EH2 = ka γc e,losa Hsoil    ·    yEH2 = Hsoil/2",
      `EH2 = ${fmt(ka, 3)} × ${fmt(gc / 1000, 2)} × ${fmt(eLosa, 2)} × ${fmt(Hsoil, 2)}    ·    y = ${fmt(yEH2, 2)} m`,
      `EH2 = ${t(EH2)} t/m`
    ),
    paso(
      "22",
      "Sobrecarga viva LS1 (vertical) y LS2 (resultante)",
      "LS1 = γs h' b    ·    LS2 = ka γs h' Hsoil    ·    yLS = Hsoil/2",
      `h' = ${fmt(hp, 2)} m    ·    b = ${fmt(bTalon, 2)} m    ·    Hsoil = ${fmt(Hsoil, 2)} m    ·    yLS = ${fmt(yLS, 2)} m    ·    xLS1 = ${fmt(xLS1, 3)} m`,
      `LS1 = ${t(LS1)} t/m    ·    LS2 = ${t(LS2)} t/m`
    ),
    paso(
      "23",
      "Componentes X e Y del empuje (AASHTO 3.11.5.3)",
      "HX = R cos δ    ·    HY = R sen δ    (vertical en el respaldo, x = B)",
      `δ = ${fmt(delta, 1)}°    ·    sen δ = ${fmt(sDel, 3)}    ·    cos δ = ${fmt(cDel, 3)}`,
      `EH1X = ${t(EH1X)}    EH1Y = ${t(EH1Y)}    ·    EH2X = ${t(EH2X)}    EH2Y = ${t(EH2Y)}    ·    LS2X = ${t(LS2X)}    LS2Y = ${t(LS2Y)} t/m`
    ),
    paso(
      "24",
      "Modificador de carga n — AASHTO 1.3.2 / 3.4.1",
      "n = nD nR nI    (no mayor que 1.00 salvo lo indicado)",
      `nD = ${fmt(nD, 2)}    ·    nR = ${fmt(nR, 2)}    ·    nI = ${fmt(nI, 2)}    ·    producto = ${fmt(nD * nR * nI, 3)}`,
      `n = ${fmt(nMod, 2)}`
    ),
    paso(
      "25",
      "Factores de carga γp — Tabla 3.4.1-1 y 3.4.1-2",
      "Resistencia I: γDC = 0.90 / 1.25    γDW = 0.65 / 1.50    γEV = 1.00 / 1.35    γLL = γLS = 1.75    γEH = 1.50    γBR = 1.75.    Resistencia III: sin LL/LS, γWS = 1.40.",
      "Ia y IIIa (γDC mínimo) sirven para vuelco y deslizamiento. Ib y IIIb (γDC máximo) sirven para presiones y resistencia de la sección.",
      "Los cuatro estados se aplican al Caso I (con puente) y al Caso II (sin puente)."
    ),
  ];

  let nStep = 26;
  for (const x of evI) {
    steps.push(...bloqueEL("Caso I (estribo con puente)", x, nStep));
    nStep += 3;
  }
  for (const x of evII) {
    steps.push(...bloqueEL("Caso II (estribo sin puente: DC + EV + EH1)", x, nStep));
    nStep += 3;
  }
  steps.push(
    paso(
      nn(nStep),
      "Diente de cimentación (si el Caso II no desliza)",
      "Si Ff ≤ Hu en Caso II se dispone diente 0.30 × 0.30 m. Empuje pasivo solo en el diente: Kp = (1+sen φ)/(1−sen φ) con δ/φ = 0.",
      `Kp Rankine = (1 + sen ${fmt(phi, 1)}°) / (1 − sen ${fmt(phi, 1)}°) = ${fmt(kp, 2)}    ·    Caso II deslizamiento: ${evII.every((x) => x.okS) ? "estable" : "N.S. en algún estado"}`,
      allII
        ? "Estable sin diente"
        : needDiente
          ? `N.S. al deslizamiento → diente 0.30 × 0.30 m  ·  Kp = ${fmt(kp, 2)}`
          : "Revisar vuelco o presiones del Caso II",
      {
        ok: allII || needDiente,
        note: needDiente
          ? "El empuje pasivo se contabiliza únicamente en la cara del diente, no en todo el fuste."
          : undefined,
      }
    )
  );

  return out(
    `Ka = ${fmt(ka, 3)}  ·  B = ${fmt(B, 2)} m  ·  q = ${fmt(qpeak, 2)} kg/cm²  ·  e = ${fmt(epeak, 3)} m`,
    `Estribo de gravedad ${fmt(H, 2)} × ${fmt(B, 2)} m  ·  Caso I ${allI ? "CUMPLE" : "REVISAR"}  ·  Caso II ${allII ? "CUMPLE" : "REVISAR"}`,
    steps,
    [
      ok("Caso I vuelco e ≤ emax", `${fmt(epeak, 3)} m`, `≤ ${fmt(emax, 3)} m`, evI.every((x) => x.okE)),
      ok("Caso I deslizamiento Ff > Hu", evI.every((x) => x.okS) ? "OK" : "N.S.", "Ff > Hu", evI.every((x) => x.okS)),
      ok("Caso I q ≤ qr", `${fmt(qpeak, 2)} kg/cm²`, `≤ ${fmt(qr, 2)} kg/cm²`, evI.every((x) => x.okQ)),
      ok("Caso II vuelco", evII.every((x) => x.okE) ? "OK" : "Revisar", `e ≤ ${fmt(emax, 3)} m`, evII.every((x) => x.okE)),
      ok("Caso II deslizamiento", evII.every((x) => x.okS) ? "OK" : "N.S. / diente", "Ff > Hu", evII.every((x) => x.okS)),
      ok("Caso II q ≤ qr", `${fmt(Math.max(...evII.map((x) => (rocoso ? x.qmax : x.q))), 2)} kg/cm²`, `≤ ${fmt(qr, 2)} kg/cm²`, evII.every((x) => x.okQ)),
      ok("B en (½–⅔) H", fmt(B, 2), `${fmt(H / 2, 2)}–${fmt((2 / 3) * H, 2)} m`, B >= H / 2 - 0.15 && B <= (2 / 3) * H + 0.3),
    ],
    (() => {
      const extras: NonNullable<CalcOutput["extras"]> = [
      {
        title: "Variables de geometría, suelos y cargas (todas)",
        rows: [
          ["Variable", "Símbolo", "Valor", "Unidad"],
          ["Altura del estribo", "H", fmt(H, 2), "m"],
          ["Longitud de tablero", "Ltablero", fmt(Ltab, 2), "m"],
          ["Espesor de tablero", "e", fmt(e, 2), "m"],
          ["Espesor losa de acercamiento", "e,losa", fmt(eLosa, 2), "m"],
          ["Profundidad de cimiento", "hz", fmt(hz, 2), "m"],
          ["Ancho de cimiento", "B", fmt(B, 2), "m"],
          ["Coronación / puntera", "a", fmt(a, 2), "m"],
          ["Talón", "b", fmt(bTalon, 2), "m"],
          ["Peralte de zapata", "h", fmt(h, 2), "m"],
          ["Cajuela / neoprene", "N", fmt(N, 2), "m"],
          ["Espesor de asiento", "t", fmt(tBack, 2), "m"],
          ["Alma trapezoidal", "alma", fmt(stem, 2), "m"],
          ["Inclinación del paramento", "S", fmt(S, 2), "°"],
          ["Altura del alma", "Hstem = H−e−h", fmt(Hstem, 3), "m"],
          ["Altura de suelo al respaldo", "Hsoil = H−e,losa", fmt(Hsoil, 2), "m"],
          ["Empotramiento sobre zapata", "hz−h", fmt(emb, 2), "m"],
          ["Proyección del talud en empotramiento", "wSkew", fmt(wSkew, 2), "m"],
          ["tan S", "tan S", fmt(tanS, 3), "—"],
          ["Altura equivalente LS", "h'", fmt(hp, 2), "m"],
          ["PDC", "PDC", t(PDC), "t/m"],
          ["PDW", "PDW", t(PDW), "t/m"],
          ["PLL+IM", "PLL+IM", t(PLLIM), "t/m"],
          ["Frenado", "BR", t(BR), "t/m"],
          ["Viento sobre estructura", "WS", t(WS), "t/m"],
          ["Contracción, fluencia y temperatura", "CR+SH+TU", t(CR), "t/m"],
          ["Brazo de BR sobre el tablero", "hBR", fmt(hBR, 2), "m"],
          ["Velocidad de viento (dato)", "vel", fmt(velV, 2), "km/h"],
          ["Ángulo de fricción interna", "φ", fmt(phi, 1), "°"],
          ["Rozamiento suelo–muro", "δ", fmt(delta, 1), "°"],
          ["Inclinación del relleno", "β", fmt(beta, 1), "°"],
          ["Ángulo muro–terreno", "θ", fmt(theta, 1), "°"],
          ["Peso específico concreto simple", "γc", fmt(gc / 1000, 2), "t/m³"],
          ["Peso específico del suelo", "γs", fmt(gs / 1000, 2), "t/m³"],
          ["Capacidad admisible", "qr", fmt(qr, 2), "kg/cm²"],
          ["Cimentación", "suelo", rocoso ? "Rocoso" : "No rocoso", "—"],
          ["Resistencia al deslizamiento", "φτ", fmt(phiT, 2), "—"],
          ["Ductilidad", "nD", fmt(nD, 2), "—"],
          ["Redundancia", "nR", fmt(nR, 2), "—"],
          ["Importancia", "nI", fmt(nI, 2), "—"],
          ["Modificador", "n = nD nR nI", fmt(nMod, 2), "—"],
          ["Término Coulomb", "Γ", fmt(Gamma, 3), "—"],
          ["Empuje activo Coulomb", "ka", fmt(ka, 3), "—"],
          ["Coeficiente de fricción", "µ = tan δ", fmt(mu, 2), "—"],
          ["Excentricidad límite", "emax", fmt(emax, 3), "m"],
          ["Kp Rankine (diente, si aplica)", "Kp", fmt(kp, 2), "—"],
          ["Brazo PDC/PDW/LL", "xPDC", fmt(xPDC, 3), "m"],
          ["Brazo vertical EH en A", "xEH,Y", fmt(xEH_Y, 3), "m"],
          ["Brazo LS1", "xLS1", fmt(xLS1, 3), "m"],
          ["Brazo EH1X", "yEH1 = Hsoil/3", fmt(yEH1, 2), "m"],
          ["Brazo EH2X y LS2X", "y = Hsoil/2", fmt(yEH2, 2), "m"],
          ["Brazo WS y CR+SH+TU", "yWS = H−e/2", fmt(yWS, 2), "m"],
          ["Brazo BR", "yBR = H+hBR", fmt(yBR, 2), "m"],
        ],
      },
      {
        title: "Cuerpos de concreto DC (franja 1.00 m)",
        rows: [
          ["Cuerpo", "Volumen (m³/m)", "DC (t/m)", "x desde A (m)", "M (t·m/m)"],
          ["1 alma triangular", fmt(V1, 3), t(DC1), fmt(x1, 3), tm(DC1 * x1)],
          ["2 cajuela N", fmt(V2, 3), t(DC2), fmt(x2, 3), tm(DC2 * x2)],
          ["3 asiento t", fmt(V3, 3), t(DC3), fmt(x3, 3), tm(DC3 * x3)],
          ["4 zapata h·B", fmt(V4, 3), t(DC4), fmt(x4, 3), tm(DC4 * x4)],
          ["DCestr", fmt(V1 + V2 + V3 + V4, 3), t(DCestr), fmt(XAestr, 3), tm(Mdc)],
          ["DClosa = γc e,losa b", fmt(eLosa * bTalon, 3), t(DClosa), fmt(xLosa, 3), tm(DClosa * xLosa)],
        ],
      },
      {
        title: "Presión vertical EV por cuerpo",
        rows: [
          ["Cuerpo", "Volumen (m³/m)", "EV (t/m)", "x desde A (m)", "M (t·m/m)"],
          ["EV1 talón", fmt(EV1v, 3), t(EV1), fmt(xEV1, 3), tm(EV1 * xEV1)],
          ["EV2 puntera", fmt(EV2v, 3), t(EV2), fmt(xEV2, 3), tm(EV2 * xEV2)],
          ["EV3 cuña tan S", fmt(EV3v, 3), t(EV3), fmt(xEV3, 3), tm(EV3 * xEV3)],
          ["EV", fmt(EV1v + EV2v + EV3v, 3), t(EV), fmt(XAEV, 3), tm(MEV)],
        ],
      },
      {
        title: "Empujes EH y LS — resultante y componentes",
        rows: [
          ["Carga", "Resultante (t/m)", "X = R cos δ (t/m)", "Y = R sen δ (t/m)", "Brazo X (m)", "Brazo Y (m)"],
          ["EH1 = ½ ka γs Hsoil²", t(EH1), t(EH1X), t(EH1Y), fmt(yEH1, 2), fmt(xEH_Y, 3)],
          ["EH2 = ka γc e,losa Hsoil", t(EH2), t(EH2X), t(EH2Y), fmt(yEH2, 2), fmt(xEH_Y, 3)],
          ["LS2 = ka γs h' Hsoil", t(LS2), t(LS2X), t(LS2Y), fmt(yLS, 2), fmt(xEH_Y, 3)],
          ["LS1 = γs h' b (solo vertical)", t(LS1), "—", t(LS1), "—", fmt(xLS1, 3)],
        ],
      },
      {
        title: "Resumen cargas verticales (servicio, brazo desde A)",
        rows: [
          ["Carga", "Tipo", "V (t/m)", "x (m)", "Mv (t·m/m)"],
          ...loadsV.map((L) => [L.name, L.tipo, t(L.V), fmt(L.x, 3), tm(Mv(L))]),
          ["Σ", "", t(loadsV.reduce((s, L) => s + L.V, 0)), "", tm(loadsV.reduce((s, L) => s + Mv(L), 0))],
        ],
      },
      {
        title: "Resumen cargas horizontales (kg/m y brazo desde A)",
        rows: [
          ["Carga", "Tipo", "H (t/m)", "y (m)", "Mh (t·m/m)"],
          ...loadsH.map((L) => [L.name, L.tipo, t(L.H), fmt(L.y, 3), tm(Mh(L))]),
          ["Σ", "", t(loadsH.reduce((s, L) => s + L.H, 0)), "", tm(loadsH.reduce((s, L) => s + Mh(L), 0))],
        ],
      },
      {
        title: "Factores de carga AASHTO usados",
        rows: [
          ["Estado", "γDC", "γDW", "γEV", "γLL+IM", "γLS,Y", "γEH", "γLS,X", "γWS", "γBR", "γCR", "Uso"],
          ...COMBOS.map((c) => [
            c.name, fmt(c.gDC, 2), fmt(c.gDW, 2), fmt(c.gEV, 2), fmt(c.gLL, 2), fmt(c.gLSy, 2),
            fmt(c.gEH, 2), fmt(c.gLSx, 2), fmt(c.gWS, 2), fmt(c.gBR, 2), fmt(c.gCR, 2), c.uso,
          ]),
        ],
      },
      {
        title: "Caso I — estribo con puente (Vu, Mvu, Hu, Mhu, Xo, e, Ff, q)",
        rows: [
          ["Estado", "Vu (t/m)", "Mvu (t·m/m)", "Hu (t/m)", "Mhu (t·m/m)", "Xo (m)", "e (m)", "Ff (t/m)", "q (kg/cm²)", "Vuelco", "Desliz.", "Presión"],
          ...evI.map((x) => [
            x.c.name, t(x.Vu), tm(x.Mvu), t(x.Hu), tm(x.Mhu), fmt(x.Xo, 3), fmt(x.e, 3), t(x.Ff),
            rocoso ? `${fmt(x.qmax, 2)} / ${fmt(x.qmin, 2)}` : fmt(x.q, 2),
            x.okE ? "OK" : "Revisar", x.okS ? "OK" : "N.S.", x.okQ ? "OK" : "Revisar",
          ]),
        ],
      },
      {
        title: "Caso II — estribo sin puente",
        rows: [
          ["Estado", "Vu (t/m)", "Mvu (t·m/m)", "Hu (t/m)", "Mhu (t·m/m)", "Xo (m)", "e (m)", "Ff (t/m)", "q (kg/cm²)", "Vuelco", "Desliz.", "Presión"],
          ...evII.map((x) => [
            x.c.name, t(x.Vu), tm(x.Mvu), t(x.Hu), tm(x.Mhu), fmt(x.Xo, 3), fmt(x.e, 3), t(x.Ff),
            rocoso ? `${fmt(x.qmax, 2)} / ${fmt(x.qmin, 2)}` : fmt(x.q, 2),
            x.okE ? "OK" : "Revisar", x.okS ? "OK" : "N.S.", x.okQ ? "OK" : "Revisar",
          ]),
        ],
      },
    ];
      bindTable(steps, "13", extras[1]);
      bindTable(steps, "19", extras[2]);
      bindTable(steps, "23", extras[3]);
      bindTable(steps, "25", extras[6]);
      bindTable(steps, "26", extras[7]);
      return extras;
    })(),
    {
      H: String(H),
      B: String(B),
      a: String(a),
      bTalon: String(bTalon),
      h: String(h),
      hz: String(hz),
      N: String(N),
      e: String(e),
      tBack: String(tBack),
      stem: String(stem),
      S: String(S),
      eLosa: String(eLosa),
    }
  );
};
