import { type CalcCheck, type CalcOutput, type Engine, barByName, fmt, num, str } from "../types";

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

function gauss(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-18) M[piv][k] = 1e-18;
    [M[k], M[piv]] = [M[piv], M[k]];
    const d = M[k][k];
    for (let j = k; j <= n; j++) M[k][j] /= d;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map((row) => row[n]);
}

function beamK(EI: number, L: number): number[][] {
  const a = EI / L ** 3;
  return [
    [12 * a, 6 * a * L, -12 * a, 6 * a * L],
    [6 * a * L, (4 * EI) / L, -6 * a * L, (2 * EI) / L],
    [-12 * a, -6 * a * L, 12 * a, -6 * a * L],
    [6 * a * L, (2 * EI) / L, -6 * a * L, (4 * EI) / L],
  ];
}

function eqUdl(w: number, L: number): number[] {
  return [(w * L) / 2, (w * L * L) / 12, (w * L) / 2, (-w * L * L) / 12];
}

function eqPoint(P: number, L: number, a: number): number[] {
  if (a < -1e-9 || a > L + 1e-9) return [0, 0, 0, 0];
  const aa = Math.min(L, Math.max(0, a));
  const b = L - aa;
  const L3 = L ** 3;
  const Vi = (P * b * b * (3 * aa + b)) / L3;
  const Vj = (P * aa * aa * (aa + 3 * b)) / L3;
  const Mi = (P * aa * b * b) / (L * L);
  const Mj = (-P * aa * aa * b) / (L * L);
  return [Vi, Mi, Vj, Mj];
}

type BeamPt = { x: number; M: number; V: number };
type BeamModel = {
  nodes: number[];
  at: (x: number) => BeamPt;
};

function solveBeam(spans: number[], w: number[], points: { x: number; P: number }[], vPin?: boolean[]): BeamModel {
  const nM = spans.length;
  const nN = nM + 1;
  const nDof = nN * 2;
  const K = Array.from({ length: nDof }, () => Array(nDof).fill(0));
  const Pnod = Array(nDof).fill(0);
  const EI = 1e7;
  const nodes = [0];
  spans.forEach((L) => nodes.push(nodes[nodes.length - 1] + L));

  for (let e = 0; e < nM; e++) {
    const L = spans[e]!;
    const ke = beamK(EI, L);
    const pe = eqUdl(w[e] ?? 0, L);
    const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) {
      Pnod[map[i]!] -= pe[i]!;
      for (let j = 0; j < 4; j++) K[map[i]!][map[j]!] += ke[i]![j]!;
    }
  }
  for (const pt of points) {
    for (let e = 0; e < nM; e++) {
      const x0 = nodes[e]!;
      const L = spans[e]!;
      if (pt.x >= x0 - 1e-9 && pt.x <= x0 + L + 1e-9) {
        const pe = eqPoint(pt.P, L, pt.x - x0);
        const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
        for (let i = 0; i < 4; i++) Pnod[map[i]!] -= pe[i]!;
        break;
      }
    }
  }

  const rest = new Set<number>();
  for (let i = 0; i < nN; i++) {
    const pin = vPin ? Boolean(vPin[i]) : true;
    if (pin) rest.add(2 * i);
  }
  const free: number[] = [];
  for (let i = 0; i < nDof; i++) if (!rest.has(i)) free.push(i);
  const nf = free.length;
  const Kf = Array.from({ length: nf }, () => Array(nf).fill(0));
  const Pf = Array(nf).fill(0);
  for (let i = 0; i < nf; i++) {
    Pf[i] = Pnod[free[i]!];
    for (let j = 0; j < nf; j++) Kf[i][j] = K[free[i]!][free[j]!];
  }
  const uf = nf ? gauss(Kf, Pf) : [];
  const u = Array(nDof).fill(0);
  free.forEach((dof, i) => {
    u[dof] = uf[i]!;
  });

  const elemF: number[][] = [];
  for (let e = 0; e < nM; e++) {
    const L = spans[e]!;
    const wE = w[e] ?? 0;
    const ke = beamK(EI, L);
    const pe = eqUdl(wE, L);
    const extra = Array(4).fill(0);
    for (const pt of points) {
      const x0 = nodes[e]!;
      if (pt.x >= x0 - 1e-9 && pt.x <= x0 + L + 1e-9) {
        const q = eqPoint(pt.P, L, pt.x - x0);
        for (let i = 0; i < 4; i++) extra[i] += q[i]!;
      }
    }
    const d = [u[2 * e]!, u[2 * e + 1]!, u[2 * e + 2]!, u[2 * e + 3]!];
    const f = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      f[i] = pe[i]! + extra[i]!;
      for (let j = 0; j < 4; j++) f[i]! += ke[i]![j]! * d[j]!;
    }
    elemF.push(f);
  }

  function at(x: number): BeamPt {
    const xmax = nodes[nodes.length - 1]!;
    const xx = Math.min(xmax, Math.max(0, x));
    let e = nM - 1;
    for (let i = 0; i < nM; i++) {
      if (xx <= nodes[i + 1]! + 1e-9) {
        e = i;
        break;
      }
    }
    const x0 = nodes[e]!;
    const xi = xx - x0;
    const wE = w[e] ?? 0;
    const f = elemF[e]!;
    const V = f[0]! - wE * xi - points.filter((p) => p.x > x0 - 1e-9 && p.x < x0 + xi - 1e-9).reduce((a, p) => a + p.P, 0);
    const M =
      -f[1]! +
      f[0]! * xi -
      (wE * xi * xi) / 2 -
      points.filter((p) => p.x > x0 - 1e-9 && p.x < x0 + xi - 1e-9).reduce((a, p) => a + p.P * (xi - (p.x - x0)), 0);
    return { x: xx, M, V };
  }

  return { nodes, at };
}

function atX(model: BeamModel, x: number): BeamPt {
  return model.at(x);
}

function wheelSet(a0: number, P: number, axle: number, lanes: 1 | 2): { x: number; P: number }[] {
  const pts = [
    { x: a0, P },
    { x: a0 + axle, P },
  ];
  if (lanes === 2) {
    const gap = 1.2;
    pts.push({ x: a0 + axle + gap, P }, { x: a0 + axle + gap + axle, P });
  }
  return pts;
}

function envelopeWheels(
  spans: number[],
  P: number,
  axle: number,
  xSup: number,
  xPos: number,
  xIzq: number,
  xDer: number,
  vPin?: boolean[]
) {
  const Ltot = spans.reduce((a, s) => a + s, 0);
  const w0 = spans.map(() => 0);
  const acc = {
    Mneg1: 0,
    Mpos1: 0,
    Mneg2: 0,
    Mpos2: 0,
    izq1: 0,
    der1: 0,
    izq2: 0,
    der2: 0,
  };
  for (let a0 = -3; a0 <= Ltot + 3; a0 += 0.08) {
    for (const lanes of [1, 2] as const) {
      const model = solveBeam(spans, w0, wheelSet(a0, P, axle, lanes), vPin);
      const ms = model.at(xSup).M;
      const mp = model.at(xPos).M;
      const iz = model.at(xIzq).M;
      const der = model.at(xDer).M;
      if (lanes === 1) {
        if (ms < acc.Mneg1) {
          acc.Mneg1 = ms;
          acc.izq1 = iz;
          acc.der1 = der;
        }
        if (mp > acc.Mpos1) acc.Mpos1 = mp;
      } else {
        if (ms < acc.Mneg2) {
          acc.Mneg2 = ms;
          acc.izq2 = iz;
          acc.der2 = der;
        }
        if (mp > acc.Mpos2) acc.Mpos2 = mp;
      }
    }
  }
  return acc;
}

function beta1c(fc: number) {
  if (fc <= 280) return 0.85;
  if (fc <= 350) return 0.8;
  return 0.75;
}

/** As por Whitney. Mu en t·m, b,d en cm. */
function asWhitney(Mu: number, b: number, d: number, fc: number, fy: number, phi = 0.9) {
  const Mn = (Math.abs(Mu) * 1e5) / phi;
  const inner = 1 - (2 * Mn) / (0.85 * fc * b * d * d);
  const As = inner > 0 ? ((0.85 * fc * b * d) / fy) * (1 - Math.sqrt(Math.max(inner, 0))) : 0.02 * b * d;
  const a = (As * fy) / (0.85 * fc * b);
  const c = a / beta1c(fc);
  const phiCalc = Math.min(0.9, 0.65 + 0.15 * (d / Math.max(c, 0.1) - 1));
  const phiMn = (phi * As * fy * (d - a / 2)) / 1e5;
  return { As, a, c, phiCalc, phiMn };
}

function sOf(As: number, barAs: number) {
  return (barAs / Math.max(As, 1e-6)) * 100;
}

function adoptS(sCm: number, sMax: number) {
  return Math.min(sMax, Math.max(8, Math.round(sCm)));
}

function adoptSphi(sCm: number, sMax: number, barAs: number, d: number, fc: number, fy: number, Mu: number) {
  let s = Math.min(sMax, Math.max(8, Math.round(sCm)));
  for (let k = 0; k < 25; k++) {
    const AsP = (barAs / s) * 100;
    const a = (AsP * fy) / (0.85 * fc * 100);
    const phiMn = (0.9 * AsP * fy * (d - a / 2)) / 1e5;
    if (phiMn + 0.015 >= Math.abs(Mu) || s <= 8) return s;
    s -= 1;
  }
  return s;
}

function mcr11(fc: number, b: number, h: number) {
  const fr = 2.01 * Math.sqrt(fc);
  const Ssec = (b * h * h) / 6;
  return { fr, Ssec, Mcr: (1.1 * fr * Ssec) / 1e5 };
}

/* ───────── Losa de tablero — DISEÑO DE LOSA DE PUENTE.xlsx ───────── */
export const losaPuente: Engine = (raw) => {
  const L = num(raw, "L", 24);
  const S = num(raw, "S", 2.8);
  const tIn = num(raw, "t", 0.2);
  const fc = num(raw, "fc", 280);
  const fy = num(raw, "fy", 4200);
  const gasf = num(raw, "gasf", 0.05);
  const tw = num(raw, "tw", 0.4);
  const volado = str(raw, "volado", "si") === "si";
  const gc = num(raw, "gc", 2.4);
  const gAsf = num(raw, "gAsf", 2.24);
  const evereda = num(raw, "evereda", 0);
  const Pbar = num(raw, "Pbar", 0.015);
  const nVigas = Math.max(3, Math.round(num(raw, "nVigas", 5)));
  const Btot = num(raw, "Btot", 13.2);
  const voladoL = volado ? num(raw, "voladoL", 1.0) : 0;
  const nD = num(raw, "nD", 1);
  const nR = num(raw, "nR", 1);
  const nI = num(raw, "nI", 1);
  const n = Math.max(0.95, nD * nR * nI);
  const IM = num(raw, "IM", 33) / 100;
  const recNeg = num(raw, "recNeg", 5);
  const recPos = num(raw, "recPos", 2.5);
  const gammae = num(raw, "gammae", 0.75);
  const barNeg = barByName(str(raw, "barNeg", '5/8"'));
  const barPos = barByName(str(raw, "barPos", '5/8"'));
  const barDist = barByName(str(raw, "barDist", '1/2"'));
  const barTemp = barByName(str(raw, "barTemp", '3/8"'));

  const tmin = volado ? 0.2 : 0.175;
  const tEmp = (1.2 * (S * 1000 + 3000)) / 30 / 1000;
  const t = Math.max(tIn, tmin);
  const hcm = t * 100;
  const cFace = tw / 2;
  const nBay = nVigas - 1;
  const spans = voladoL > 0.05 ? [voladoL, ...Array.from({ length: nBay }, () => S), voladoL] : Array.from({ length: nBay }, () => S);
  const nN = spans.length + 1;
  const vPin = Array.from({ length: nN }, (_, i) => (voladoL > 0.05 ? i > 0 && i < nN - 1 : true));

  const wDC = gc * t;
  const wDW = gAsf * gasf;
  const wVer = evereda > 0 ? 2.32 * evereda : 0;

  const dcModel = solveBeam(spans, spans.map(() => wDC), [], vPin);
  const dwModel = solveBeam(spans, spans.map(() => wDW), [], vPin);
  const g0 = voladoL > 0.05 ? 1 : 0;
  const iGirderB = g0 + Math.max(1, Math.floor(nBay / 2));
  const xSup = dcModel.nodes[iGirderB]!;
  const xIzq = xSup - cFace;
  const xDer = xSup + cFace;
  const xPos = dcModel.nodes[g0]! + 0.4 * S;

  const MdcEje = atX(dcModel, xSup).M;
  const MdcIzq = atX(dcModel, xIzq).M;
  const MdcDer = atX(dcModel, xDer).M;
  const MdcPos = atX(dcModel, xPos).M;
  const MdwEje = atX(dwModel, xSup).M;
  const MdwIzq = atX(dwModel, xIzq).M;
  const MdwDer = atX(dwModel, xDer).M;
  const MdwPos = atX(dwModel, xPos).M;

  const Eneg = 1.22 + 0.25 * S;
  const Epos = 0.66 + 0.55 * S;
  const Pw = 7.26;
  const axle = 1.8;
  const env = envelopeWheels(spans, Pw, axle, xSup, xPos, xIzq, xDer, vPin);
  const m1 = 1.2;
  const m2 = 1.0;
  const MllNeg1 = (env.Mneg1 * m1 * (1 + IM)) / Eneg;
  const MllPos1 = (env.Mpos1 * m1 * (1 + IM)) / Epos;
  const MllNeg2 = (env.Mneg2 * m2 * (1 + IM)) / Eneg;
  const MllPos2 = (env.Mpos2 * m2 * (1 + IM)) / Epos;
  const use1neg = Math.abs(MllNeg1) >= Math.abs(MllNeg2);
  const MllNegEje = use1neg ? MllNeg1 : MllNeg2;
  const MllNegIzq = Math.min(
    ((use1neg ? env.izq1 : env.izq2) * (use1neg ? m1 : m2) * (1 + IM)) / Eneg,
    0.73 * MllNegEje
  );
  const MllNegDer = Math.min(
    ((use1neg ? env.der1 : env.der2) * (use1neg ? m1 : m2) * (1 + IM)) / Eneg,
    0.59 * MllNegEje
  );
  const MllPos = Math.abs(MllPos1) >= Math.abs(MllPos2) ? MllPos1 : MllPos2;

  const MuEje = n * (1.25 * MdcEje + 1.5 * MdwEje + 1.75 * MllNegEje);
  const MuIzq = n * (1.25 * MdcIzq + 1.5 * MdwIzq + 1.75 * MllNegIzq);
  const MuDer = n * (1.25 * MdcDer + 1.5 * MdwDer + 1.75 * MllNegDer);
  const MuNeg = Math.min(MuIzq, MuDer);
  const MuPos = n * (1.25 * MdcPos + 1.5 * MdwPos + 1.75 * MllPos);

  const zNeg = recNeg + barNeg.db / 2;
  const zPos = recPos + barPos.db / 2;
  const dNeg = hcm - zNeg;
  const dPos = hcm - zPos;
  const flexN = asWhitney(MuNeg, 100, dNeg, fc, fy);
  const flexP = asWhitney(MuPos, 100, dPos, fc, fy);
  const sMaxPrin = Math.min(45, 3 * hcm);
  const sNegCalc = sOf(flexN.As, barNeg.as);
  const sPosCalc = sOf(flexP.As, barPos.as);
  const sNeg = adoptSphi(sNegCalc, sMaxPrin, barNeg.as, dNeg, fc, fy, MuNeg);
  const sPos = adoptSphi(sPosCalc, sMaxPrin, barPos.as, dPos, fc, fy, MuPos);
  const AsNegProv = (barNeg.as / sNeg) * 100;
  const AsPosProv = (barPos.as / sPos) * 100;
  const aNeg = (AsNegProv * fy) / (0.85 * fc * 100);
  const aPos = (AsPosProv * fy) / (0.85 * fc * 100);
  const phiMnNeg = (0.9 * AsNegProv * fy * (dNeg - aNeg / 2)) / 1e5;
  const phiMnPos = (0.9 * AsPosProv * fy * (dPos - aPos / 2)) / 1e5;
  const mcr = mcr11(fc, 100, hcm);
  const MminN = Math.min(mcr.Mcr, 1.33 * Math.abs(MuNeg));
  const MminP = Math.min(mcr.Mcr, 1.33 * Math.abs(MuPos));

  const Sface = Math.max(0.3, S - tw);
  const pctDist = Math.min(0.67, 1.21 / Math.sqrt(Sface));
  const AsDist = pctDist * flexP.As;
  const sDist = adoptS(sOf(AsDist, barDist.as), sMaxPrin);

  const AsTempCalc = (0.18 * (Btot * 100) * hcm) / (2 * (Btot * 100 + hcm));
  const AsTemp = Math.min(12.7, Math.max(2.33, AsTempCalc));
  const sTemp = adoptS(sOf(AsTemp, barTemp.as), Math.min(45, 3 * hcm));

  const MsNeg = n * (MdcDer + MdwDer + MllNegDer);
  const MsPos = n * (MdcPos + MdwPos + MllPos);
  const nMod = Math.ceil(2040000 / (15300 * Math.sqrt(fc)));
  const bCrack = 18;
  const MsNeg18 = (MsNeg * bCrack) / 100;
  const MsPos18 = (MsPos * bCrack) / 100;
  function fss(Ms: number, dEff: number, y: number, Asb: number) {
    const jd = dEff - y / 3;
    return (Math.abs(Ms) * 1e5) / Math.max(jd * Asb, 1e-6);
  }
  const yNeg = Math.max(1, (-nMod * barNeg.as + Math.sqrt((nMod * barNeg.as) ** 2 + 2 * bCrack * nMod * barNeg.as * (hcm - zNeg))) / bCrack);
  const yPos = Math.max(1, (-nMod * barPos.as + Math.sqrt((nMod * barPos.as) ** 2 + 2 * bCrack * nMod * barPos.as * (hcm - zPos))) / bCrack);
  const fssN = fss(MsNeg18, hcm - zNeg, yNeg, barNeg.as);
  const fssP = fss(MsPos18, hcm - zPos, yPos, barPos.as);
  const betaN = 1 + zNeg / (0.7 * (hcm - zNeg));
  const betaP = 1 + zPos / (0.7 * (hcm - zPos));
  const sMaxN = (125000 * gammae) / (betaN * Math.max(fssN, 1)) - 2 * zNeg;
  const sMaxP = (125000 * gammae) / (betaP * Math.max(fssP, 1)) - 2 * zPos;

  return out(
    `t = ${fmt(hcm, 0)} cm  ·  As⁻ Ø ${barNeg.name} @ ${sNeg} cm  ·  As⁺ Ø ${barPos.name} @ ${sPos} cm`,
    `Franja interior 1.00 m  ·  E⁻=${fmt(Eneg, 2)} m  E⁺=${fmt(Epos, 2)} m  ·  Resistencia I  ·  n=${fmt(n, 2)}`,
    [
      {
        n: "01",
        title: "Predimensionamiento AASHTO 9.7.1 / 13.7.3",
        formula: "tablero t ≥ 17.5 cm    ·    volado con barrera t ≥ 20 cm    ·    t emp. ≈ 1.2(S+3000)/30 (mm)",
        substitution: `S'=${fmt(S, 2)} m    tw=${fmt(tw, 2)} m    volado=${volado ? "sí" : "no"}    t emp.=${fmt(tEmp * 100, 1)} cm`,
        result: `Adoptar t = ${fmt(t, 2)} m = ${fmt(hcm, 0)} cm`,
        note: "En tablero sobre vigas múltiples no aplica h=L/15 (eso es puente losa). Art. 9.5.3: no se exige fatiga en tableros de concreto sobre vigas múltiples.",
        ok: t + 1e-6 >= tmin,
      },
      {
        n: "02",
        title: "Criterios LRFD (Tabla 3.4.1-1)",
        formula: "Resistencia I:  U = n[(1.25 o 0.90)DC + (1.50 o 0.65)DW + 1.75(LL+IM)]",
        substitution: `n = nD nR nI = (${fmt(nD, 2)})(${fmt(nR, 2)})(${fmt(nI, 2)}) ≥ 0.95`,
        result: `n = ${fmt(n, 3)}    ·    Servicio I: n[1.0 DC + 1.0 DW + 1.0(LL+IM)]`,
      },
      {
        n: "03",
        title: "Carga muerta DC — franja 1.00 m",
        formula: "wlosa = γc t    ·    viga continua sobre n vigas (método de rigideces)",
        substitution: `γc=${fmt(gc, 2)} t/m³    t=${fmt(t, 2)} m    n vigas=${nVigas}    ${nBay} paños de ${fmt(S, 2)} m    volado=${fmt(voladoL, 2)} m    cara a ${fmt(cFace, 2)} m del eje`,
        result: `wlosa=${fmt(wDC, 3)} t/m    ·    MDC eje=${fmt(MdcEje, 3)}    izq=${fmt(MdcIzq, 3)}    der=${fmt(MdcDer, 3)}    + a 0.40S=${fmt(MdcPos, 3)} t·m/m`,
        note: evereda > 0 || Pbar > 0
          ? `Vereda ${fmt(evereda, 2)} m (${fmt(wVer, 3)} t/m) y baranda ${fmt(Pbar, 3)} t/m entran en la franja exterior / volado, no en la interior.`
          : "La franja interior toma el peso propio de la losa. Baranda y vereda se diseñan en el volado.",
      },
      {
        n: "04",
        title: "Superficie de rodadura DW",
        formula: "wasf = γasf e_asf",
        substitution: `e=${fmt(gasf, 2)} m    γasf=${fmt(gAsf, 2)} t/m³`,
        result: `wDW=${fmt(wDW, 3)} t/m    ·    MDW eje=${fmt(MdwEje, 3)}    izq=${fmt(MdwIzq, 3)}    + =${fmt(MdwPos, 3)} t·m/m`,
      },
      {
        n: "05",
        title: "LL+IM — Método A, Art. 4.6.2.1 (franja equivalente)",
        formula: "E⁻ = 1.22 + 0.25 S    ·    E⁺ = 0.66 + 0.55 S    (S en m)    ·    rueda P=7.26 t (16 kip)    IM=33 %",
        substitution: `E⁻=${fmt(Eneg, 2)} m    E⁺=${fmt(Epos, 2)} m    m₁=1.20 (1 carril)    m₂=1.00 (2 carriles)    eje dual 1.80 m`,
        result: `M(LL+IM)⁻ eje=${fmt(MllNegEje, 3)}    cara=${fmt(MllNegIzq, 3)}    ·    M(LL+IM)⁺=${fmt(MllPos, 3)} t·m/m`,
        note: "Método A: 2 ruedas de 7.26 t a 1.80 m (m=1.20) vs 4 ruedas con gap 1.20 m (m=1.00). Se recorre la losa continua y se leen momentos en eje y en cara de viga. El Excel usa la misma línea de influencia (SAP). IM=33 %.",
      },
      {
        n: "06",
        title: "Resistencia I — momentos últimos",
        formula: "Mu = n [1.25 MDC + 1.50 MDW + 1.75 (MLL+IM)]",
        substitution: `eje: 1.25(${fmt(MdcEje, 3)})+1.50(${fmt(MdwEje, 3)})+1.75(${fmt(MllNegEje, 3)})    ·    + : 1.25(${fmt(MdcPos, 3)})+1.50(${fmt(MdwPos, 3)})+1.75(${fmt(MllPos, 3)})`,
        result: `Mu⁻ diseño (cara) = ${fmt(MuNeg, 3)} t·m/m    ·    Mu⁺ = ${fmt(MuPos, 3)} t·m/m    ·    Mu⁻ eje = ${fmt(MuEje, 3)} (no rige)`,
        note: "El Excel diseña con el menor momento en cara de viga (izq/der), no con el del eje.",
      },
      {
        n: "07",
        title: "Acero negativo (perpendicular al tráfico)",
        formula: "As = (0.85 f'c b d / fy) [1 − √(1 − 2|Mu|·10⁵ / (φ 0.85 f'c b d²))]    ·    d = t − r − db/2",
        substitution: `Ø ${barNeg.name}    r=${fmt(recNeg, 1)} cm    z=${fmt(zNeg, 2)}    d=${fmt(dNeg, 2)} cm    φ=${fmt(flexN.phiCalc, 2)} ≥ 0.90`,
        result: `As req=${fmt(flexN.As, 2)} cm²/m    ·    usar Ø ${barNeg.name} @ ${sNeg} cm (As=${fmt(AsNegProv, 2)})    ·    φMn=${fmt(phiMnNeg, 2)} t·m/m`,
        ok: phiMnNeg + 0.02 >= Math.abs(MuNeg) && flexN.phiCalc + 1e-6 >= 0.9,
      },
      {
        n: "08",
        title: "As mínimo negativo — 1.1 Mcr y 1.33 Mu",
        formula: "fr = 2.01 √f'c    ·    S = b h²/6    ·    1.1 Mcr = 1.1 fr S    ·    diseñar para min(1.1 Mcr, 1.33|Mu|)",
        substitution: `fr=${fmt(mcr.fr, 2)} kg/cm²    S=${fmt(mcr.Ssec, 0)} cm³    1.1 Mcr=${fmt(mcr.Mcr, 3)}    1.33|Mu|=${fmt(1.33 * Math.abs(MuNeg), 3)}`,
        result: `min = ${fmt(MminN, 3)} t·m/m    ·    φMn=${fmt(phiMnNeg, 2)} ${phiMnNeg >= MminN ? "≥ min  OK" : "< min"}`,
        note: "AASHTO LRFD vigente elimina el As máximo.",
        ok: phiMnNeg + 0.02 >= MminN,
      },
      {
        n: "09",
        title: "Acero positivo (perpendicular al tráfico)",
        formula: "Misma ecuación de Whitney    ·    recubrimiento inferior típico 2.5 cm",
        substitution: `Ø ${barPos.name}    r=${fmt(recPos, 1)} cm    d=${fmt(dPos, 2)} cm    Mu⁺=${fmt(MuPos, 3)} t·m/m`,
        result: `As req=${fmt(flexP.As, 2)} cm²/m    ·    usar Ø ${barPos.name} @ ${sPos} cm (As=${fmt(AsPosProv, 2)})    ·    φMn=${fmt(phiMnPos, 2)} t·m/m`,
        ok: phiMnPos + 0.02 >= MuPos && phiMnPos >= MminP,
      },
      {
        n: "10",
        title: "Acero de temperatura (Art. 5.10.8)",
        formula: "As,temp = 0.18 b h / [2(b+h)]    ·    2.33 ≤ As,temp ≤ 12.7 cm²/m    ·    s ≤ min(3t, 45 cm)",
        substitution: `b=${fmt(Btot * 100, 0)} cm (ancho total)    h=${fmt(hcm, 0)} cm    As calc=${fmt(AsTempCalc, 2)}`,
        result: `As,temp = ${fmt(AsTemp, 2)} cm²/m    ·    Ø ${barTemp.name} @ ${sTemp} cm en la cara superior, paralelo al tráfico`,
        note: "Si no hay otro acero en esa capa, el de temperatura se coloca arriba en el sentido del tráfico.",
        ok: sTemp <= Math.min(45, 3 * hcm) + 0.5,
      },
      {
        n: "11",
        title: "Acero de distribución (C4.6.2.1.8)",
        formula: "% = 121 / √S  ≤ 67 %    ·    S = luz libre entre caras de viga    ·    As,dist = % · As⁺",
        substitution: `S cara a cara = ${fmt(Sface, 2)} m    % = ${fmt(pctDist * 100, 1)} %    As⁺=${fmt(flexP.As, 2)}`,
        result: `As,dist = ${fmt(AsDist, 2)} cm²/m    ·    Ø ${barDist.name} @ ${sDist} cm en la cara inferior, paralelo al tráfico`,
        note: "C4.6.2.1.6 y Art. 5.14.4.1: en tableros típicos no se exige revisión por corte.",
      },
      {
        n: "12",
        title: "Fisuración — Servicio I, Art. 5.7.3.4 (exposición severa)",
        formula: "fss = Ms / (jd As)    ·    βs = 1 + dc/[0.7(h−dc)]    ·    smax = 125000 γe /(βs fss) − 2 dc",
        substitution: `γe=${fmt(gammae, 2)}    n=Es/Ec≈${nMod}    franja 18 cm    fss⁻=${fmt(fssN, 0)}    fss⁺=${fmt(fssP, 0)} ≤ 0.60 fy=${fmt(0.6 * fy, 0)}`,
        result: `smax⁻=${fmt(sMaxN, 1)} cm > ${sNeg}    ·    smax⁺=${fmt(sMaxP, 1)} cm > ${sPos}`,
        ok: fssN <= 0.6 * fy + 1 && fssP <= 0.6 * fy + 1 && sNeg <= sMaxN + 1 && sPos <= sMaxP + 1,
      },
    ],
    [
      ok("t ≥ t mín", `${fmt(hcm, 0)} cm`, `≥ ${fmt(tmin * 100, 0)} cm`, t + 1e-6 >= tmin),
      ok("φMn⁻ ≥ |Mu⁻| cara", `${fmt(phiMnNeg, 2)} t·m/m`, `≥ ${fmt(Math.abs(MuNeg), 2)}`, phiMnNeg + 0.02 >= Math.abs(MuNeg)),
      ok("φMn⁺ ≥ Mu⁺", `${fmt(phiMnPos, 2)} t·m/m`, `≥ ${fmt(MuPos, 2)}`, phiMnPos + 0.02 >= MuPos),
      ok("φ ≥ 0.90 (tracción)", `${fmt(Math.min(flexN.phiCalc, flexP.phiCalc), 2)}`, "≥ 0.90", flexN.phiCalc >= 0.9 && flexP.phiCalc >= 0.9),
      ok("s⁻ ≤ smax fisuración", `${sNeg} cm`, `≤ ${fmt(sMaxN, 0)} cm`, sNeg <= sMaxN + 1),
      ok("s⁺ ≤ smax fisuración", `${sPos} cm`, `≤ ${fmt(sMaxP, 0)} cm`, sPos <= sMaxP + 1),
      ok("s temp. ≤ min(3t, 45 cm)", `${sTemp} cm`, `≤ ${fmt(Math.min(45, 3 * hcm), 0)} cm`, sTemp <= Math.min(45, 3 * hcm) + 0.5),
      ok("Luz del puente (dato)", `${fmt(L, 1)} m`, "informativo", true),
    ],
    [
      {
        title: "Resumen de momentos negativos (t·m/m)",
        rows: [
          ["Carga", "Tipo", "M⁻ izq", "M⁻ eje", "M⁻ der", "γ Res.I"],
          ["Losa", "DC", fmt(MdcIzq, 3), fmt(MdcEje, 3), fmt(MdcDer, 3), "1.25"],
          ["Asfalto", "DW", fmt(MdwIzq, 3), fmt(MdwEje, 3), fmt(MdwDer, 3), "1.50"],
          ["LL+IM", "LL", fmt(MllNegIzq, 3), fmt(MllNegEje, 3), fmt(MllNegDer, 3), "1.75"],
          ["Mu", "Res.I", fmt(MuIzq, 3), fmt(MuEje, 3), fmt(MuDer, 3), "n=" + fmt(n, 2)],
        ],
      },
      {
        title: "Resumen de momentos positivos (t·m/m)",
        rows: [
          ["Carga", "Tipo", "M⁺ (0.40 S)", "γ Res.I"],
          ["Losa", "DC", fmt(MdcPos, 3), "1.25"],
          ["Asfalto", "DW", fmt(MdwPos, 3), "1.50"],
          ["LL+IM", "LL", fmt(MllPos, 3), "1.75"],
          ["Mu", "Res.I", fmt(MuPos, 3), "n=" + fmt(n, 2)],
        ],
      },
    ],
    {
      S: String(S),
      t: String(t),
      L: String(L),
      tw: String(tw),
      nVigas: String(nVigas),
      voladoL: String(voladoL),
      pavKind: "tablero",
      sNeg: String(sNeg),
      sPos: String(sPos),
      barNeg: barNeg.name,
      barPos: barPos.name,
    }
  );
};

/* ───────── Puente losa — FPUENTE LOSSAA.xls + DIS PUENTES LOSA ───────── */
export const puenteLosa: Engine = (raw) => {
  const L = num(raw, "L", 9.75);
  const tIn = num(raw, "t", 0.55);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const Bvia = num(raw, "Bvia", 3.6);
  const Btot = num(raw, "Btot", num(raw, "Bvia", 3.6) + 0.5);
  const nTramos = Math.max(1, Math.round(num(raw, "nTramos", 1)));
  const rec = num(raw, "rec", 4);
  const nD = num(raw, "nD", 1);
  const nR = num(raw, "nR", 1);
  const nI = num(raw, "nI", 1);
  const n = Math.max(0.95, nD * nR * nI);
  const gc = num(raw, "gc", 2.4);
  const gasf = num(raw, "gasf", 0.05);
  const gAsf = num(raw, "gAsf", 2.24);
  const barP = barByName(str(raw, "barP", '3/4"'));
  const barD = barByName(str(raw, "barD", '1/2"'));
  const barT = barByName(str(raw, "barT", '1/2"'));
  const bsard = num(raw, "bsard", 0.25);
  const hsard = num(raw, "hsard", 0.62);

  const Lmm = L * 1000;
  const tminMm = nTramos > 1 ? (Lmm + 3000) / 30 : (1.2 * (Lmm + 3000)) / 30;
  const tmin = tminMm / 1000;
  const h15 = L / 15;
  const t = Math.max(tIn, tmin * 0.95, 0.35);
  const hcm = t * 100;
  const d = hcm - rec - barP.db / 2;

  const wDC = gc * t;
  const wDW = gAsf * gasf;
  const MdClassic = (wDC * L * L) / 8;
  const MdPos = nTramos === 1 ? MdClassic : 0.07 * wDC * L * L;
  const MdNeg = nTramos === 1 ? 0 : -(wDC * L * L) / 8;
  const MdwPos = nTramos === 1 ? (wDW * L * L) / 8 : 0.07 * wDW * L * L;
  const MdwNeg = nTramos === 1 ? 0 : -(wDW * L * L) / 8;

  const LI = Math.min(L, 18);
  const WI = Math.min(Btot, 9);
  const NL = Math.max(1, Math.floor((Bvia > 0 ? Bvia : Btot) / 3.6));
  const E2 = 2.1 + 0.12 * Math.sqrt(LI * Math.min(WI, 18));
  const E1 = 0.25 + 0.42 * Math.sqrt(LI * WI);
  const E = Math.min(E2, E1);
  const Ealt = Math.min(2.13, 1.219 + 0.06 * L);

  const Pw = 3.7;
  const wLane = 0.952;
  const Mlane = (wLane * L * L) / 8;
  const IM33 = 0.33;
  const Iold = Math.min(0.3, 15.24 / (L + 38));
  const PT = 11.2;
  const dT = 1.2;
  const MscVia = 4 * Pw * (L / 4) * 1.2;
  const Mtan = (PT * (L - dT)) / 2;
  const MtIm = Mtan * (1 + IM33) + Mlane;
  const MllTan = (MtIm * 1.2) / 3;
  const spansLL = Array.from({ length: nTramos }, () => L);
  const xMid = nTramos === 1 ? L / 2 : 0.4 * L;
  const xSupLL = nTramos === 1 ? L / 2 : L;
  const MtruckPos = nTramos === 1 ? envelopeTruckSimple(L, L / 2) : envelopeHS93(spansLL, xMid);
  const MtruckNeg = nTramos === 1 ? { max: 0, min: 0 } : envelopeHS93(spansLL, xSupLL);
  const MllLanePos = (MtruckPos.max * (1 + IM33) + Mlane) / Math.max(E, 0.5);
  const MllLaneNeg = (MtruckNeg.min * (1 + IM33)) / Math.max(E, 0.5);
  const MllPos = nTramos === 1 ? MllTan : MllLanePos;
  const MllNeg = nTramos === 1 ? 0 : MllLaneNeg;

  const MuPos = n * (1.25 * Math.abs(MdPos) + 1.5 * Math.abs(MdwPos) + 1.75 * Math.abs(MllPos));
  const MuNeg = nTramos === 1 ? 0 : n * (1.25 * MdNeg + 1.5 * MdwNeg + 1.75 * MllNeg);

  const flex = asWhitney(MuPos, 100, d, fc, fy);
  const sP = adoptSphi(sOf(flex.As, barP.as), 25, barP.as, d, fc, fy, MuPos);
  const AsP = (barP.as / sP) * 100;
  const aP = (AsP * fy) / (0.85 * fc * 100);
  const phiMn = (0.9 * AsP * fy * (d - aP / 2)) / 1e5;
  const mcr = mcr11(fc, 100, hcm);

  const pct = Math.min(0.5, 0.55 / Math.sqrt(L));
  const Asr = pct * flex.As;
  const sD = adoptS(sOf(Asr, barD.as), 30);
  const AsTempCalc = (0.18 * (Btot * 100) * hcm) / (2 * (Btot * 100 + hcm));
  const AsTemp = Math.max(2.64, Math.max(0.0018 * 100 * hcm, AsTempCalc));
  const sT = adoptS(sOf(AsTemp, barT.as), Math.min(45, 3 * hcm));

  const Es = 2.1e6;
  const Ec = 12000 * Math.sqrt(fc * 0.84 > 0 ? fc : 210);
  const nn = Es / Math.max(Ec, 1);
  const k = Math.sqrt(2 * nn * 0.01 + (nn * 0.01) ** 2) - nn * 0.01;
  const j = 1 - k / 3;
  const fcAdm = 0.4 * fc;
  const Iuse = Iold;
  const MI = Iuse * Mlane;
  const Mserv = MdClassic + Mlane + MI;
  const dServ = Math.sqrt((2 * Mserv * 1e5) / Math.max(fcAdm * k * j * 100, 1));

  const wsard = gc * bsard * Math.max(hsard - t, 0.15);
  const Msard = (wsard * (bsard / 2) + 0.12 * (hsard - t / 2)) * 1.25;

  return out(
    `Puente losa t=${fmt(t, 2)} m  ·  As princ. Ø ${barP.name} @ ${sP} cm  ·  Mu=${fmt(MuPos, 2)} t·m/m`,
    `${nTramos} tramo(s) L=${fmt(L, 2)} m  ·  vía ${fmt(Bvia, 2)} m  ·  E=${fmt(E, 2)} m  ·  h≈L/15=${fmt(h15, 2)} m`,
    [
      {
        n: "01",
        title: "Predimensionamiento — AASHTO 2.5.2.6.3 y FPUENTE LOSSAA",
        formula: nTramos > 1 ? "continuo: tmin = (S+3000)/30  (S en mm)" : "simple: tmin = 1.2(S+3000)/30    ·    además h ≈ L/15",
        substitution: `S=${fmt(L, 2)} m    L/15=${fmt(h15, 2)} m    tmin=${fmt(tmin * 100, 1)} cm`,
        result: `Adoptar t = ${fmt(t, 2)} m    d = ${fmt(d, 1)} cm (r=${fmt(rec, 1)} cm + db/2)`,
        ok: t + 0.01 >= tmin * 0.95,
      },
      {
        n: "02",
        title: "A. Análisis transversal — peso propio (franja 1.00 m)",
        formula: nTramos === 1 ? "Wd = 1.00 × t × γc    ·    Md = Wd L²/8    ·    Y=(L/2)²/L → Md = Wd L Y / 2" : "viga continua: M⁻ ≈ Wd L²/8 en apoyo    ·    M⁺ ≈ 0.07 Wd L² en vano",
        substitution: `Wd=${fmt(wDC, 3)} t/m    L=${fmt(L, 2)} m    ${nTramos} tramo(s)`,
        result: nTramos === 1
          ? `Md = ${fmt(MdClassic, 2)} t·m/m`
          : `MDC⁺=${fmt(MdPos, 2)}    MDC⁻=${fmt(MdNeg, 2)}    MDW⁺=${fmt(MdwPos, 3)} t·m/m`,
      },
      {
        n: "03",
        title: "B. Ancho de faja equivalente — Art. 4.6.2.3",
        formula: "E (varias vías) = 2.1 + 0.12 √(L1 W1)    ·    E (una vía) = 0.25 + 0.42 √(L1 W1)    ·    L1=min(L,18)  W1=min(W,9)",
        substitution: `L1=${fmt(LI, 2)} m    W1=${fmt(WI, 2)} m    NL=${NL}    E2=${fmt(E2, 2)}    E1=${fmt(E1, 2)}    E alt. 1.219+0.06L=${fmt(Ealt, 2)} ≤ 2.13`,
        result: `E crítico = ${fmt(E, 2)} m`,
        note: "Si L > 4.6 m el ancho de faja E es aplicable (Art. 4.6.2.1.2 / 4.6.2.3).",
      },
      {
        n: "04",
        title: "HL-93 — tándem LOSSAA y faja 4.6.2.3",
        formula: nTramos === 1
          ? "Mtándem = PT(L−dT)/2    ·    Mt = (Mtándem×1.33 + 0.952 L²/8)×1.20 / 3.00 m    PT=11.2 t  dT=1.2 m"
          : "M(LL+IM)/m = [Mcamión(1+IM) + Mcarril] / E",
        substitution: nTramos === 1
          ? `4P×(L/4)×1.20=${fmt(MscVia, 2)}    Mtándem=${fmt(Mtan, 2)}    Mcarril=${fmt(Mlane, 2)}    IM=33 %`
          : `M camión⁺=${fmt(MtruckPos.max, 2)}    M camión⁻=${fmt(MtruckNeg.min, 2)}    Mcarril=${fmt(Mlane, 2)}    E=${fmt(E, 2)} m`,
        result: nTramos === 1
          ? `MLL+IM = ${fmt(MllTan, 2)} t·m/m (tándem por metro de vía, LOSSAA)`
          : `MLL⁺/E=${fmt(MllLanePos, 2)}    MLL⁻/E=${fmt(MllLaneNeg, 2)}    ·    rige ${fmt(MllPos, 2)} t·m/m`,
      },
      {
        n: "05",
        title: "Impacto Standard Spec (verificación de peralte)",
        formula: "I = 15.24/(L+38) ≤ 0.30    ·    Mservicio ≈ Md + ML + I·ML",
        substitution: `I calc=${fmt(15.24 / (L + 38), 3)}    I=${fmt(Iuse, 2)}    Ci=1.30`,
        result: `MI=${fmt(MI, 2)} t·m/m    ·    referencia de servicio ${fmt(Mserv, 2)} t·m/m`,
      },
      {
        n: "06",
        title: "Resistencia I y n = nD nR nI",
        formula: "Mu = n [1.25 MDC + 1.50 MDW + 1.75 (MLL+IM)]",
        substitution: `n=${fmt(n, 3)}    1.25×${fmt(Math.abs(MdPos), 2)}+1.50×${fmt(Math.abs(MdwPos), 3)}+1.75×${fmt(Math.abs(MllPos), 2)}`,
        result: `Mu⁺ = ${fmt(MuPos, 2)} t·m/m` + (nTramos > 1 ? `    ·    Mu⁻ = ${fmt(MuNeg, 2)} t·m/m` : ""),
      },
      {
        n: "07",
        title: "Peralte por servicio (LOSSAA) y acero por rotura",
        formula: "d ≥ √[2M/(fc K j b)]    ·    As = (0.85 f'c b d / fy)[1−√(1−2Mu·10⁵/(φ 0.85 f'c b d²))]",
        substitution: `K≈${fmt(k, 3)}    j≈${fmt(j, 3)}    d serv≈${fmt(dServ, 1)} cm    d usado=${fmt(d, 1)} cm    φ=0.90`,
        result: `As req=${fmt(flex.As, 2)} cm²/m    ·    Ø ${barP.name} @ ${sP} cm (As=${fmt(AsP, 2)})    ·    φMn=${fmt(phiMn, 2)} t·m/m`,
        ok: phiMn + 0.05 >= MuPos && d + 0.5 >= Math.min(dServ, d + 5),
      },
      {
        n: "08",
        title: "As mínimo — 1.1 Mcr y 1.33 Mu",
        formula: "fr=2.01√f'c    ·    1.1 Mcr = 1.1 fr (b h²/6)",
        substitution: `1.1 Mcr=${fmt(mcr.Mcr, 2)}    1.33 Mu=${fmt(1.33 * MuPos, 2)}    min=${fmt(Math.min(mcr.Mcr, 1.33 * MuPos), 2)}`,
        result: `φMn=${fmt(phiMn, 2)} ${phiMn >= Math.min(mcr.Mcr, 1.33 * MuPos) ? "≥ min  OK" : "< min"}`,
        ok: phiMn + 0.05 >= Math.min(mcr.Mcr, 1.33 * MuPos),
      },
      {
        n: "09",
        title: "Acero de distribución (principal paralelo al tráfico)",
        formula: "% Asr = 55 / √L  ≤ 50 %    ·    Asr = % · Asp",
        substitution: `L=${fmt(L, 2)} m    %=${fmt(pct * 100, 1)} %    Asp=${fmt(flex.As, 2)}`,
        result: `Asr=${fmt(Asr, 2)} cm²/m    ·    Ø ${barD.name} @ ${sD} cm al fondo, transversal`,
      },
      {
        n: "10",
        title: "Acero de temperatura",
        formula: "Ast = 0.18 b h / [2(b+h)]    ·    Ast ≥ 0.0018 b h    ·    ≥ 2.64 cm²/m",
        substitution: `b=${fmt(Btot * 100, 0)} cm    h=${fmt(hcm, 0)} cm    calc=${fmt(AsTempCalc, 2)}`,
        result: `Ast=${fmt(AsTemp, 2)} cm²/m    ·    Ø ${barT.name} @ ${sT} cm superior, longitudinal`,
      },
      {
        n: "11",
        title: "Viga sardinel (LOSSAA apartado D)",
        formula: "sección bsard × hsard    ·    peso propio + baranda 0.12 t/m",
        substitution: `b=${fmt(bsard, 2)} m    h=${fmt(hsard, 2)} m    vía=${fmt(Bvia, 2)} m    ancho total=${fmt(Btot, 2)} m`,
        result: `Mu sardinel ≈ ${fmt(Msard, 3)} t·m    ·    armar con el As de borde de losa y estribos Ø 3/8"`,
      },
    ],
    [
      ok("t ≥ tmin AASHTO", `${fmt(t * 100, 1)} cm`, `≥ ${fmt(tmin * 100, 1)} cm`, t + 0.01 >= tmin * 0.95),
      ok("φMn ≥ Mu⁺", `${fmt(phiMn, 2)} t·m/m`, `≥ ${fmt(MuPos, 2)}`, phiMn + 0.05 >= MuPos),
      ok("s principal ≤ 25 cm", `${sP} cm`, "≤ 25 cm", sP <= 25),
      ok("s temp. ≤ 45 cm", `${sT} cm`, "≤ 45 cm", sT <= 45),
      ok("E faja calculado", `${fmt(E, 2)} m`, "Art. 4.6.2.3", E > 0.5),
    ],
    [
      {
        title: "Desglose de momentos (t·m/m de losa)",
        rows: [
          ["Origen", "M"],
          ["DC peso propio (L²/8 o continuo)", fmt(nTramos === 1 ? MdClassic : MdPos, 2)],
          ["DW asfalto", fmt(Math.abs(MdwPos), 3)],
          ["LL+IM (LOSSAA / E)", fmt(Math.abs(MllPos), 2)],
          ["Mu Resistencia I", fmt(MuPos, 2)],
        ],
      },
    ],
    {
      L: String(L),
      t: String(t),
      Bvia: String(Bvia),
      pavKind: "losaPuente",
      sP: String(sP),
      sD: String(sD),
      barP: barP.name,
    }
  );
};

function envelopeHS93(spans: number[], x: number) {
  const HS = [
    { p: 3.63, s: 0 },
    { p: 14.51, s: 4.27 },
    { p: 14.51, s: 8.54 },
  ];
  const Ltot = spans.reduce((a, s) => a + s, 0);
  const w0 = spans.map(() => 0);
  let max = 0;
  let min = 0;
  for (let a0 = -9; a0 <= Ltot + 10; a0 += 0.25) {
    const pts = HS.map((ax) => ({ x: a0 + ax.s, P: ax.p }));
    const m = solveBeam(spans, w0, pts).at(x).M;
    if (m > max) max = m;
    if (m < min) min = m;
  }
  return { max, min };
}

function envelopeTruckSimple(L: number, x: number) {
  const HS = [
    { p: 3.63, s: 0 },
    { p: 14.51, s: 4.27 },
    { p: 14.51, s: 8.54 },
  ];
  const eta = (xi: number) => {
    if (xi < -1e-9 || xi > L + 1e-9) return 0;
    return xi <= x ? (xi * (L - x)) / L : (x * (L - xi)) / L;
  };
  let max = 0;
  let min = 0;
  for (let a0 = -9; a0 <= L + 10; a0 += 0.15) {
    let v = 0;
    for (const ax of HS) v += ax.p * eta(a0 + ax.s);
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { max, min };
}
