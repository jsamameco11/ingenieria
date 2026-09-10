import { type CalcCheck, type CalcOutput, type Engine, fmt, num, spacingFor, str } from "../types";

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

function round05(x: number) {
  return Math.ceil(x * 20 - 1e-9) / 20;
}

function asFlex(Mu: number, bCm: number, dCm: number, fc: number, fy: number, rec: number) {
  const hCm = dCm + rec;
  const Asmin = Math.max(0.0018 * bCm * hCm, (14 / Math.max(fy, 1)) * bCm * dCm);
  if (Mu <= 1e-6 || dCm < 4) return { As: Asmin, rho: Asmin / Math.max(bCm * dCm, 1), Asmin };
  const phi = 0.9;
  const Rn = (Mu * 100000) / (phi * bCm * dCm * dCm);
  const disc = 1 - (2 * Rn) / (0.85 * Math.max(fc, 1));
  const rho = disc > 0 ? (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(0, disc))) : 0.025;
  const As = Math.max(rho * bCm * dCm, Asmin);
  return { As, rho: As / (bCm * dCm), Asmin };
}

type PLoad = { x: number; P: number; label: string; M?: number };

function vmAt(x: number, w: number, loads: PLoad[]) {
  let V = w * x;
  let M = (w * x * x) / 2;
  for (const p of loads) {
    if (p.x <= x + 1e-8) {
      V -= p.P;
      M -= p.P * (x - p.x);
      M += p.M ?? 0;
    }
  }
  return { V, M };
}

function invertBeam(L: number, w: number, loads: PLoad[]) {
  const xs = new Set<number>([0, L]);
  for (const p of loads) xs.add(Math.min(L, Math.max(0, p.x)));
  for (let i = 1; i < 24; i++) xs.add((i / 24) * L);
  const pts = [...xs].sort((a, b) => a - b).map((x) => {
    const { V, M } = vmAt(x, w, loads);
    return { x, V, M };
  });
  let Mmax = -1e9;
  let Mmin = 1e9;
  let Vmax = 0;
  let xMmax = 0;
  let xMmin = 0;
  for (const p of pts) {
    if (p.M > Mmax) {
      Mmax = p.M;
      xMmax = p.x;
    }
    if (p.M < Mmin) {
      Mmin = p.M;
      xMmin = p.x;
    }
    Vmax = Math.max(Vmax, Math.abs(p.V));
  }
  const end = vmAt(L, w, loads);
  return { pts, Mmax, Mmin, Vmax, xMmax, xMmin, Vend: end.V, Mend: end.M };
}

function punch(Pu: number, t1: number, t2: number, dCm: number, B: number, L: number, fc: number, x: number, y: number) {
  const d = dCm / 100;
  const c1 = t1 + d;
  const c2 = t2 + d;
  const left = x - c2 / 2;
  const right = x + c2 / 2;
  const bot = y - c1 / 2;
  const top = y + c1 / 2;
  const clipL = Math.max(0, Math.min(L, right) - Math.max(0, left));
  const clipB = Math.max(0, Math.min(B, top) - Math.max(0, bot));
  const sides = (left > 0.02 ? 1 : 0) + (right < L - 0.02 ? 1 : 0) + (bot > 0.02 ? 1 : 0) + (top < B - 0.02 ? 1 : 0);
  const b0 = (clipL * 2 + clipB * 2) * (sides >= 3 ? 1 : sides === 2 ? 0.75 : 0.5) * 100;
  const b0use = Math.max(c1 * 100 + c2 * 100, Math.min(2 * (c1 + c2) * 100, b0 || 2 * (c1 + c2) * 100));
  const Acrit = clipL * clipB;
  const Vu = Math.max(0, Pu - (Pu / Math.max(B * L, 0.1)) * Acrit);
  const phiVc = (0.85 * 1.06 * Math.sqrt(Math.max(fc, 1)) * b0use * dCm) / 1000;
  return { Vu, phiVc, b0: b0use, Acrit, ok: Vu <= phiVc + 1e-6 };
}

function packPts(pts: { x: number; M: number }[]) {
  return pts.map((p) => `${p.x.toFixed(3)},${p.M.toFixed(3)}`).join(";");
}

function oneWay(qu: number, width: number, lv: number, dCm: number, fc: number) {
  const clear = Math.max(0, lv - dCm / 100);
  const Vu = qu * width * clear;
  const phiVc = (0.85 * 0.53 * Math.sqrt(Math.max(fc, 1)) * width * 100 * dCm) / 1000;
  return { Vu, phiVc, clear, ok: Vu <= phiVc + 1e-6 };
}

function readM3Col(raw: Record<string, string>, tag: "A" | "B") {
  const k = `M3${tag}`;
  if (String(raw[k] ?? "").trim() !== "") return num(raw, k, 0);
  return num(raw, `My${tag}`, 0);
}

/* ───────── Zapata combinada / conectada (dos columnas) ───────── */
export const zapataCombinada: Engine = (raw) => {
  const tA1 = num(raw, "tA1", 0.4);
  const tA2 = num(raw, "tA2", 0.4);
  const PdA = num(raw, "PdA", 75);
  const PlA = num(raw, "PlA", 35);
  const P1A = num(raw, "P1A", 0);
  const P2A = num(raw, "P2A", 0);
  const P3Ain = num(raw, "P3A", 0);
  const M1A = num(raw, "M1A", 0);
  const M2A = num(raw, "M2A", 0);
  const M3A = readM3Col(raw, "A");
  const tB1 = num(raw, "tB1", 0.5);
  const tB2 = num(raw, "tB2", 0.5);
  const PdB = num(raw, "PdB", 125);
  const PlB = num(raw, "PlB", 50);
  const P1B = num(raw, "P1B", 0);
  const P2B = num(raw, "P2B", 0);
  const P3Bin = num(raw, "P3B", 0);
  const M1B = num(raw, "M1B", 0);
  const M2B = num(raw, "M2B", 0);
  const M3B = readM3Col(raw, "B");
  const eje = Math.max(num(raw, "eje", 5), tA2 / 2 + tB2 / 2 + 0.3);
  const lindero = str(raw, "lindero", "no");
  const qadm = num(raw, "qadm", 2);
  const Df = num(raw, "Df", 1.5);
  const gt = num(raw, "gt", 1.8);
  const sc = num(raw, "sc", 0.3);
  const hfIn = num(raw, "hf", 0.6);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 7.5);
  const LzIn = num(raw, "Lz", 0);
  const bIn = num(raw, "b", 0);

  const gravA = PdA + PlA;
  const gravB = PdB + PlB;
  const P3A = P3Ain > 0 ? P3Ain : gravA;
  const P3B = P3Bin > 0 ? P3Bin : gravB;
  const Pts = P3A + P3B;
  const PuGravA = 1.4 * PdA + 1.7 * PlA;
  const PuGravB = 1.4 * PdB + 1.7 * PlB;
  const PutGrav = PuGravA + PuGravB;
  const lam = PutGrav / Math.max(Pts, 0.1);
  const Pu1 = lam * P3A;
  const Pu2 = lam * P3B;
  const Put = Pu1 + Pu2;

  const M2cA = M2A + P2A * hfIn;
  const M2cB = M2B + P2B * hfIn;
  const M3cA = M3A + P1A * hfIn;
  const M3cB = M3B + P1B * hfIn;
  const M2c = M2cA + M2cB;
  const M3c = M3cA + M3cB;
  const M1t = M1A + M1B;
  const Hx = P1A + P1B;
  const Hy = P2A + P2B;
  const Hxy = Math.hypot(Hx, Hy);

  const qn = qadm * 10 - gt * Df - 2.4 * hfIn - sc;
  const AzNeed = Pts / Math.max(qn, 0.3);
  const ovMinA = lindero === "A" ? 0.05 : 0.2;
  const ovMinB = lindero === "B" ? 0.05 : 0.2;
  let xAuse = ovMinA + tA2 / 2;
  let xBuse = xAuse + eje;
  const xRof = (xA: number, xB: number) => (P3A * xA + P3B * xB + M3c) / Math.max(Pts, 0.1);
  let xRuse = xRof(xAuse, xBuse);
  let Lz = round05(Math.max(2 * xRuse, xBuse + tB2 / 2 + ovMinB));
  if (lindero === "B") {
    const shift = Lz - ovMinB - tB2 / 2 - xBuse;
    if (Math.abs(shift) > 0.01) {
      xAuse += shift;
      xBuse += shift;
      xRuse = xRof(xAuse, xBuse);
      Lz = round05(Math.max(2 * xRuse, xBuse + tB2 / 2 + ovMinB, xAuse + tA2 / 2 + ovMinA));
    }
  }
  if (LzIn > 1) Lz = round05(LzIn);
  xRuse = xRof(xAuse, xBuse);
  const ey = M2c / Math.max(Pts, 0.1);

  let b = bIn > 0.4 ? round05(bIn) : round05(Math.max(tA1 + 0.5, tB1 + 0.5, AzNeed / Lz, 6.2 * Math.abs(ey) + 0.3));
  let qmed = Pts / (Lz * b);
  if (bIn <= 0.4) {
    for (let i = 0; i < 40; i++) {
      const k = 1 + (6 * Math.abs(xRuse - Lz / 2)) / Lz + (6 * Math.abs(ey)) / b;
      const qPeak = qmed * k;
      const outKernY = Math.abs(ey) > b / 6 - 0.005;
      if (qPeak <= qn + 1e-6 && !outKernY) break;
      b = round05(b + 0.05);
      qmed = Pts / (Lz * b);
    }
  }

  const ovAuse = xAuse - tA2 / 2;
  const ovBuse = Lz - xBuse - tB2 / 2;
  const eR = xRuse - Lz / 2;
  const inKern = Math.abs(eR) <= Lz / 6 + 0.02 && Math.abs(ey) <= b / 6 + 0.02;
  const q11 = qmed * (1 + (6 * eR) / Lz + (6 * ey) / b);
  const q12 = qmed * (1 + (6 * eR) / Lz - (6 * ey) / b);
  const q21 = qmed * (1 - (6 * eR) / Lz + (6 * ey) / b);
  const q22 = qmed * (1 - (6 * eR) / Lz - (6 * ey) / b);
  const qmax = Math.max(q11, q12, q21, q22);
  const qmin = Math.min(q11, q12, q21, q22);

  const mu = 0.45;
  const Rdesl = mu * Pts;
  const FSdesl = Hxy < 0.01 ? 99 : Rdesl / Hxy;
  const MotL = Math.abs(Pts * eR);
  const MotB = Math.abs(M2c);
  const FSotL = MotL < 0.01 ? 99 : (Pts * (Lz / 2)) / MotL;
  const FSotB = MotB < 0.01 ? 99 : (Pts * (b / 2)) / MotB;

  const hNeed = Math.max(0.4, Math.max(ovAuse, ovBuse, (b - Math.max(tA1, tB1)) / 2) / 2);
  const hf = Math.max(hfIn, round05(hNeed));
  const d = hf * 100 - rec;
  const qu = Put / (Lz * b);
  const quMax = qu * (qmax / Math.max(qmed, 1e-6));
  const w = qu * b;
  const Mu3A = lam * M3cA;
  const Mu3B = lam * M3cB;
  const loads: PLoad[] = [
    { x: xAuse, P: Pu1, M: Mu3A, label: "Col. A" },
    { x: xBuse, P: Pu2, M: Mu3B, label: "Col. B" },
  ];
  const beam = invertBeam(Lz, w, loads);

  const Msoil = Math.max(-beam.Mmin, 0);
  const Mtop = Math.max(beam.Mmax, 0);
  const flexInf = asFlex(Msoil, b * 100, d, fc, fy, rec);
  const flexSup = asFlex(Mtop, b * 100, d, fc, fy, rec);
  const sInf = spacingFor((flexInf.As / (b * 100)) * 100, 2.84, 100);
  const sSup = flexSup.As > flexSup.Asmin * 1.05 ? spacingFor((flexSup.As / (b * 100)) * 100, 1.29, 100) : spacingFor(0.0018 * hf * 100, 0.71, 100);

  const lvA = (b - tA1) / 2;
  const lvB = (b - tB1) / 2;
  const MuTrA = ((quMax * lvA * lvA) / 2) * tA2;
  const MuTrB = ((quMax * lvB * lvB) / 2) * tB2;
  const flexTr = asFlex(Math.max(MuTrA, MuTrB) / Math.max(tA2, tB2, 0.3), 100, d, fc, fy, rec);
  const sTr = spacingFor(flexTr.As, 1.29, 100);

  const punA = punch(Pu1, tA1, tA2, d, b, Lz, fc, xAuse, b / 2);
  const punB = punch(Pu2, tB1, tB2, d, b, Lz, fc, xBuse, b / 2);
  const shA = oneWay(quMax, b, Math.max(ovAuse, 0.05), d, fc);
  const shMid = oneWay(qu, b, Math.abs(xBuse - xAuse) / 2, d, fc);

  const eqOk = Math.abs(beam.Vend) < 0.08 * Put && Math.abs(beam.Mend) < 0.15 * Put;
  const qOk = qmax <= qn + 0.05 && qmin >= -0.02 && qn > 0;
  const deslOk = FSdesl >= 1.5;
  const otOk = FSotL >= 1.5 && FSotB >= 1.5;
  const p3NotaA = P3Ain > 0 ? "P3 de análisis." : "P3 = PD+PL.";
  const p3NotaB = P3Bin > 0 ? "P3 de análisis." : "P3 = PD+PL.";

  return out(
    `Combinada ${fmt(Lz, 2)} × ${fmt(b, 2)} × ${fmt(hf, 2)} m  ·  q = ${fmt(qmed, 2)} t/m²`,
    `Long. Ø 3/4" @ ${sInf} cm inf.  ·  Ø 1/2" @ ${sSup} cm sup.  ·  Transv. Ø 1/2" @ ${sTr} cm bajo columnas`,
    [
      {
        n: "01",
        title: "Cargas de gravedad y axial P3 de cada columna",
        formula: "P3 = FZ (si > 0)    ·    si no, P3 = PD + PL    ·    Pu,grav = 1.4 PD + 1.7 PL",
        substitution: `A: PD=${fmt(PdA, 1)} PL=${fmt(PlA, 1)}  P3=${fmt(P3A, 1)} t (${p3NotaA})    ·    B: PD=${fmt(PdB, 1)} PL=${fmt(PlB, 1)}  P3=${fmt(P3B, 1)} t (${p3NotaB})`,
        result: `ΣP3 = ${fmt(Pts, 1)} t    ·    ΣPu,grav = ${fmt(PutGrav, 1)} t    ·    λ = ΣPu,grav/ΣP3 = ${fmt(lam, 3)}`,
        note: "P3 es el axial de servicio en la base (ETABS F3/FZ, compresión +). λ amplifica los 6 GDL al estado último E.060. A es la columna izquierda y B la derecha.",
      },
      {
        n: "02",
        title: "Seis GDL en la base de cada columna (servicio)",
        formula: "P1 = FX    ·    P2 = FY    ·    P3 = FZ    ·    M1 = T    ·    M2    ·    M3",
        substitution: `A: P1=${fmt(P1A, 2)}  P2=${fmt(P2A, 2)}  P3=${fmt(P3A, 2)} t   ·   M1=${fmt(M1A, 2)}  M2=${fmt(M2A, 2)}  M3=${fmt(M3A, 2)} t·m`,
        result: `B: P1=${fmt(P1B, 2)}  P2=${fmt(P2B, 2)}  P3=${fmt(P3B, 2)} t   ·   M1=${fmt(M1B, 2)}  M2=${fmt(M2B, 2)}  M3=${fmt(M3B, 2)} t·m`,
        note: "Convenio ETABS: X a lo largo de A–B, Y transversal, Z axial. P1 y P2 son cortes. M1 es torsión (eje Z). M2 flexiona alrededor de X (ey). M3 flexiona alrededor de Y y corre la resultante a lo largo de L.",
      },
      {
        n: "03",
        title: "Traslado al plano de contacto zapata–suelo",
        formula: "M2c = M2 + P2·h    ·    M3c = M3 + P1·h",
        substitution: `h = ${fmt(hfIn, 2)} m    ·    A: M2c=${fmt(M2A, 2)}+${fmt(P2A, 2)}×${fmt(hfIn, 2)}=${fmt(M2cA, 2)}    M3c=${fmt(M3A, 2)}+${fmt(P1A, 2)}×${fmt(hfIn, 2)}=${fmt(M3cA, 2)}`,
        result: `B: M2c=${fmt(M2cB, 2)}    M3c=${fmt(M3cB, 2)} t·m    ·    ΣM2c=${fmt(M2c, 2)}    ΣM3c=${fmt(M3c, 2)} t·m`,
        note: "El corte, aplicado en la cara superior, genera un par h·V en el contacto. M1 no altera las presiones verticales. Las últimas se obtienen con λ: M2u=λ M2c, M3u=λ M3c.",
      },
      {
        n: "04",
        title: "Suelo — esfuerzo neto admisible",
        formula: "σn = σadm − γt Df − γc h − s/c",
        substitution: `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(hfIn, 2)} − ${fmt(sc, 2)}`,
        result: `${fmt(qn, 2)} t/m²    ·    Az req. = ΣP3/σn = ${fmt(AzNeed, 2)} m²`,
        note: "σadm se ingresa en kg/cm². Se descuenta relleno, peso propio de la zapata y sobrecarga de piso para no cargar dos veces el suelo.",
        ok: qn > 0,
      },
      {
        n: "05",
        title: "Resultante — excentricidades ex y ey",
        formula: "xR = (P3A xA + P3B xB + ΣM3c) / ΣP3    ·    ey = ΣM2c / ΣP3",
        substitution: `eje ℓ = ${fmt(eje, 2)} m    ·    xA=${fmt(xAuse, 2)}  xB=${fmt(xBuse, 2)} m    ·    ΣM3c=${fmt(M3c, 2)}    ΣM2c=${fmt(M2c, 2)} t·m`,
        result: `xR = ${fmt(xRuse, 2)} m    ·    ex = xR − L/2 = ${fmt(eR, 3)} m    ·    ey = ${fmt(ey, 3)} m`,
        note:
          lindero === "A"
            ? "Lindero en A: el vuelo izquierdo es mínimo. La compensación de M3 y de P3 se hace alargando el vuelo de B."
            : lindero === "B"
              ? "Lindero en B: el vuelo derecho es mínimo. La compensación se hace alargando el vuelo de A."
              : "Sin lindero: se elige L = 2 xR para anular ex. ey se cubre ensanchando b hasta que |ey| ≤ b/6.",
      },
      {
        n: "06",
        title: "Dimensionamiento en planta",
        formula: "L = 2 xR    ·    b ≥ máx(Az/L, tY+0.50, 6.2 |ey|)    ·    vuelos ≥ 20 cm",
        substitution: `L calc. = ${fmt(2 * xRuse, 2)} m    Az/L = ${fmt(AzNeed / Math.max(Lz, 0.1), 2)} m    6.2|ey| = ${fmt(6.2 * Math.abs(ey), 2)} m`,
        result: `L = ${fmt(Lz, 2)} m    ·    b = ${fmt(b, 2)} m    ·    vuelo A = ${fmt(ovAuse, 2)} m    vuelo B = ${fmt(ovBuse, 2)} m`,
        note: `Columnas ${fmt(tA1, 2)}×${fmt(tA2, 2)} m y ${fmt(tB1, 2)}×${fmt(tB2, 2)} m. El ancho cubre el lado Y de ambas, Az y el núcleo de M2.`,
      },
      {
        n: "07",
        title: "Presión de contacto biaxial",
        formula: "q = ΣP3/(L b)    ·    q(x,y) = q [1 ± 6 ex/L ± 6 ey/b]",
        substitution: `q = ${fmt(Pts, 1)}/(${fmt(Lz, 2)}×${fmt(b, 2)})    ·    6ex/L = ${fmt((6 * eR) / Lz, 3)}    ·    6ey/b = ${fmt((6 * ey) / b, 3)}`,
        result: `qmed = ${fmt(qmed, 2)}    qmáx = ${fmt(qmax, 2)}    qmín = ${fmt(qmin, 2)} t/m²`,
        note: inKern
          ? `Núcleo: |ex|≤L/6 y |ey|≤b/6. Esquinas: q11=${fmt(q11, 2)}  q12=${fmt(q12, 2)}  q21=${fmt(q21, 2)}  q22=${fmt(q22, 2)} t/m².`
          : "Fuera del núcleo habría tracción en el suelo. Alargar L (M3) o ensanchar b (M2).",
        ok: qOk && inKern,
      },
      {
        n: "08",
        title: "Estabilidad — deslizamiento, volcamiento y torsión M1",
        formula: "H = √[(ΣP1)²+(ΣP2)²]    ·    FS,desl = μ ΣP3 / H    ·    FS,volc = (P·brazo) / Mot",
        substitution: `ΣP1=${fmt(Hx, 2)}  ΣP2=${fmt(Hy, 2)}  H=${fmt(Hxy, 2)} t    ·    μ=0.45    ·    ΣM1=${fmt(M1t, 2)} t·m    Tu=λ ΣM1=${fmt(lam * M1t, 2)} t·m`,
        result: `FS,desl = ${fmt(FSdesl, 2)}    ·    FS,volc L = ${fmt(FSotL, 2)}    ·    FS,volc b = ${fmt(FSotB, 2)}`,
        note: "Volcante longitudinal = ΣP3·ex (ya incluye M3c). Transversal = |ΣM2c|. Estabilizante = ΣP3 por L/2 o b/2. M1 no entra a q(x,y); si |ΣM1| es alto conviene viga de atado.",
        ok: deslOk && otOk,
      },
      {
        n: "09",
        title: "Peralte y d efectivo",
        formula: "h ≥ vuelo/2    y    h ≥ 40 cm    ·    d = h − r",
        substitution: `vuelo máx. = ${fmt(Math.max(ovAuse, ovBuse, lvA, lvB), 2)} m    r = ${fmt(rec, 1)} cm`,
        result: `h = ${fmt(hf, 2)} m    ·    d = ${fmt(d, 1)} cm`,
      },
      {
        n: "10",
        title: "Modelo de viga invertida (eje longitudinal)",
        formula: "w = qu b    ·    V(x) = w x − Σ Pu    ·    M(x) = w x²/2 − Σ Pu (x−xi) + Σ M3u",
        substitution: `qu = ${fmt(qu, 2)} t/m²    w = ${fmt(w, 2)} t/m    ·    Pu,A=${fmt(Pu1, 1)}  Pu,B=${fmt(Pu2, 1)} t    ·    M3u,A=${fmt(Mu3A, 2)}  M3u,B=${fmt(Mu3B, 2)} t·m`,
        result: `w = ${fmt(w, 2)} t/m    ·    M(L) = ${fmt(beam.Mend, 2)} t·m    V(L) = ${fmt(beam.Vend, 2)} t`,
        note: "Libre-libre: suelo hacia arriba, columnas hacia abajo y momento concentrado M3u = λ M3c en cada pedestal. El cierre en x=L anula V y M cuando L = 2 xR.",
        ok: eqOk,
      },
      {
        n: "11",
        title: "Momentos y cortes gobernantes",
        formula: "Msuelo = |mín M| (entre columnas)    ·    Mvuelo = máx M    ·    Vmáx = máx |V|",
        substitution: `Msuelo en x=${fmt(beam.xMmin, 2)} m = ${fmt(Msoil, 2)} t·m    ·    Mvuelo en x=${fmt(beam.xMmax, 2)} m = ${fmt(Mtop, 2)} t·m`,
        result: `Msuelo = ${fmt(Msoil, 2)} t·m    ·    Mvuelo = ${fmt(Mtop, 2)} t·m    ·    Vmáx = ${fmt(beam.Vmax, 2)} t`,
        note: "El acero inferior (cara del suelo) cubre Msuelo en todo el paño A–B. El superior se coloca en los vuelos si Mvuelo es apreciable. M3u desplaza el diagrama respecto del caso solo axial.",
      },
      {
        n: "12",
        title: "Acero longitudinal",
        formula: "As = ρ b d    ·    Asmín = máx(0.0018 b h, 14 b d / fy)",
        substitution: `b=${fmt(b * 100, 0)} cm  d=${fmt(d, 1)} cm    As,inf=${fmt(flexInf.As, 2)}    As,sup=${fmt(flexSup.As, 2)} cm²`,
        result: `Inferior: Ø 3/4" @ ${sInf} cm    ·    Superior: Ø 1/2" @ ${sSup} cm`,
        note: "El inferior se coloca en toda L. El superior se concentra en los vuelos (y sobre columnas si el diagrama lo pide).",
      },
      {
        n: "13",
        title: "Flexión transversal bajo cada columna",
        formula: "ℓv = (b − t1)/2    ·    Mu = qu,máx ℓv² / 2    (por metro; qu,máx incluye ey)",
        substitution: `ℓv,A=${fmt(lvA, 2)} m  ℓv,B=${fmt(lvB, 2)} m    qu,máx=${fmt(quMax, 2)} t/m²    Mu,A=${fmt(MuTrA / Math.max(tA2, 0.3), 2)}  Mu,B=${fmt(MuTrB / Math.max(tB2, 0.3), 2)} t·m/m`,
        result: `Ø 1/2" @ ${sTr} cm  (As = ${fmt(flexTr.As, 2)} cm²/m) bajo A y B, cara del suelo`,
        note: "En el sentido corto cada pedestal trabaja como zapata aislada. M2 (ey) aumenta la presión del borde cargado; se usa qu,máx. Barras bajo el pedestal, ancladas ℓd más allá de la cara.",
      },
      {
        n: "14",
        title: "Punzonamiento en A y B (E.060 / ACI 15.5)",
        formula: "Vu = Pu − qu Acrit    ·    φVc = 0.85·1.06 √f'c b0 d    ·    Pu = λ P3",
        substitution: `A: Vu=${fmt(punA.Vu, 2)} t  φVc=${fmt(punA.phiVc, 2)} t    ·    B: Vu=${fmt(punB.Vu, 2)} t  φVc=${fmt(punB.phiVc, 2)} t`,
        result: `Col. A ${punA.ok ? "CUMPLE" : "NO CUMPLE"}    ·    Col. B ${punB.ok ? "CUMPLE" : "NO CUMPLE"}`,
        ok: punA.ok && punB.ok,
        note: "La sección crítica está a d/2 de la cara. Se resta la presión que actúa dentro del perímetro. Si no cubre, subir h o f'c.",
      },
      {
        n: "15",
        title: "Corte en una dirección",
        formula: "Vu = qu b (ℓ − d)    ·    φVc = 0.85·0.53 √f'c b d",
        substitution: `Vuelo A: Vu=${fmt(shA.Vu, 2)}  φVc=${fmt(shA.phiVc, 2)} t    ·    Entre columnas (d desde la cara): Vu=${fmt(shMid.Vu, 2)} t`,
        result: `Vuelo ${shA.ok ? "OK" : "revisar h"}    ·    Paño ${shMid.ok ? "OK" : "revisar h"}`,
        ok: shA.ok && shMid.ok,
      },
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)} t/m²`, `≤ ${fmt(qn, 2)}`, qOk),
      ok("Núcleo ex (L/6)", `${fmt(Math.abs(eR), 3)} m`, `≤ ${fmt(Lz / 6, 3)} m`, Math.abs(eR) <= Lz / 6 + 0.02),
      ok("Núcleo ey (b/6)", `${fmt(Math.abs(ey), 3)} m`, `≤ ${fmt(b / 6, 3)} m`, Math.abs(ey) <= b / 6 + 0.02),
      ok("Deslizamiento FS ≥ 1.5", fmt(FSdesl, 2), "≥ 1.50", deslOk),
      ok("Volcamiento L y b", `${fmt(FSotL, 2)} / ${fmt(FSotB, 2)}`, "≥ 1.50", otOk),
      ok("Equilibrio de la viga invertida", `V(L)=${fmt(beam.Vend, 2)} t`, "≈ 0", eqOk),
      ok("Punzonamiento A", `${fmt(punA.Vu, 1)} t`, `≤ ${fmt(punA.phiVc, 1)} t`, punA.ok),
      ok("Punzonamiento B", `${fmt(punB.Vu, 1)} t`, `≤ ${fmt(punB.phiVc, 1)} t`, punB.ok),
      ok("Corte 1 dir. vuelos", `${fmt(shA.Vu, 1)} t`, `≤ ${fmt(shA.phiVc, 1)} t`, shA.ok),
      ok("h ≥ 40 cm", `${fmt(hf * 100, 0)} cm`, "≥ 40 cm", hf >= 0.4),
      ok("Vuelos ≥ 15 cm", `${fmt(Math.min(ovAuse, ovBuse) * 100, 0)} cm`, "≥ 15 cm", Math.min(ovAuse, ovBuse) >= 0.14),
    ],
    [
      {
        title: "Seis GDL por columna — servicio y último (λ)",
        rows: [
          ["GDL", "A serv.", "A últ.", "B serv.", "B últ.", "Efecto"],
          ["P1 = FX (t)", fmt(P1A, 2), fmt(lam * P1A, 2), fmt(P1B, 2), fmt(lam * P1B, 2), "Corte X + par h·P1 en M3c"],
          ["P2 = FY (t)", fmt(P2A, 2), fmt(lam * P2A, 2), fmt(P2B, 2), fmt(lam * P2B, 2), "Corte Y + par h·P2 en M2c"],
          ["P3 = FZ (t)", fmt(P3A, 2), fmt(Pu1, 2), fmt(P3B, 2), fmt(Pu2, 2), "Axial · presión media"],
          ["M1 = T (t·m)", fmt(M1A, 2), fmt(lam * M1A, 2), fmt(M1B, 2), fmt(lam * M1B, 2), "Torsión · no entra a q(x,y)"],
          ["M2 (t·m)", fmt(M2A, 2), fmt(lam * M2A, 2), fmt(M2B, 2), fmt(lam * M2B, 2), "ey = ΣM2c / ΣP3"],
          ["M3 (t·m)", fmt(M3A, 2), fmt(lam * M3A, 2), fmt(M3B, 2), fmt(lam * M3B, 2), "ex · viga invertida"],
          ["M2c contacto", fmt(M2cA, 2), fmt(lam * M2cA, 2), fmt(M2cB, 2), fmt(lam * M2cB, 2), "M2 + P2·h"],
          ["M3c contacto", fmt(M3cA, 2), fmt(Mu3A, 2), fmt(M3cB, 2), fmt(Mu3B, 2), "M3 + P1·h"],
        ],
      },
      {
        title: "Columnas y suelo — datos que interactúan",
        rows: [
          ["Dato", "Columna A", "Columna B", "Suelo / zapata"],
          ["Sección (m)", `${fmt(tA1, 2)}×${fmt(tA2, 2)}`, `${fmt(tB1, 2)}×${fmt(tB2, 2)}`, `L×b = ${fmt(Lz, 2)}×${fmt(b, 2)}`],
          ["PD / PL (t)", `${fmt(PdA, 1)} / ${fmt(PlA, 1)}`, `${fmt(PdB, 1)} / ${fmt(PlB, 1)}`, `σadm = ${fmt(qadm, 2)} kg/cm²`],
          ["P3 servicio (t)", fmt(P3A, 2), fmt(P3B, 2), `σn = ${fmt(qn, 2)} t/m²`],
          ["Pu = λ P3 (t)", fmt(Pu1, 2), fmt(Pu2, 2), `qu = ${fmt(qu, 2)} t/m²`],
          ["x desde borde (m)", fmt(xAuse, 2), fmt(xBuse, 2), `xR = ${fmt(xRuse, 2)} m`],
          ["M3c / M2c (t·m)", `${fmt(M3cA, 2)} / ${fmt(M2cA, 2)}`, `${fmt(M3cB, 2)} / ${fmt(M2cB, 2)}`, `ex=${fmt(eR, 3)}  ey=${fmt(ey, 3)} m`],
        ],
      },
      {
        title: "Viga invertida — estaciones M y V",
        rows: [
          ["x (m)", "V (t)", "M (t·m)", "Notas"],
          ...beam.pts
            .filter((_, i, a) => i === 0 || i === a.length - 1 || i % 3 === 0 || loads.some((l) => Math.abs(l.x - a[i].x) < 0.03))
            .map((p) => {
              const near = loads.find((l) => Math.abs(l.x - p.x) < 0.03);
              return [fmt(p.x, 2), fmt(p.V, 2), fmt(p.M, 2), near ? near.label : p.x === 0 ? "Borde A" : p.x === Lz ? "Borde B" : ""];
            }),
        ],
      },
    ],
    {
      Lz: Lz.toFixed(2),
      b: b.toFixed(2),
      L: Lz.toFixed(2),
      B: b.toFixed(2),
      hf: hf.toFixed(2),
      hAd: hf.toFixed(2),
      Df: Df.toFixed(2),
      tA1: tA1.toFixed(2),
      tA2: tA2.toFixed(2),
      tB1: tB1.toFixed(2),
      tB2: tB2.toFixed(2),
      xA: xAuse.toFixed(2),
      xB: xBuse.toFixed(2),
      xR: xRuse.toFixed(2),
      eje: eje.toFixed(2),
      mPts: packPts(beam.pts),
      Msoil: Msoil.toFixed(3),
      Mtop: Mtop.toFixed(3),
      asLong: `Ø 3/4" @ ${sInf} cm inf. · Ø 1/2" @ ${sSup} cm sup.`,
      AsInf: flexInf.As.toFixed(2),
      lvA: lvA.toFixed(3),
      lvB: lvB.toFixed(3),
      MuTr: (Math.max(MuTrA, MuTrB) / Math.max(tA2, tB2, 0.3)).toFixed(3),
      asTr: `Ø 1/2" @ ${sTr} cm`,
      AsTr: flexTr.As.toFixed(2),
    }
  );
};

/* ───────── Zapata corrida ───────── */
export const zapataCorrida: Engine = (raw) => {
  const tipo = str(raw, "tipo", "muro");
  const tw = num(raw, "tw", 0.25);
  const t1 = num(raw, "t1", 0.3);
  const t2 = num(raw, "t2", 0.4);
  const Pd = num(raw, "Pd", 12);
  const Pl = num(raw, "Pl", 4);
  const sCol = num(raw, "sCol", 4);
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
  const nTramos = Math.max(1, Math.round(num(raw, "nTramos", 3)));

  const isCols = tipo === "columnas";
  const Psm = Pd + Pl;
  const Pum = 1.4 * Pd + 1.7 * Pl;
  const qn = qadm * 10 - gt * Df - 2.4 * hfIn - sc;
  let B = BIn > 0.4 ? round05(BIn) : round05(Math.max(isCols ? t1 + 0.6 : tw + 0.5, Psm / Math.max(qn, 0.3)));
  let qmed = Psm / B;
  if (qmed > qn && BIn <= 0.4) {
    B = round05(Psm / Math.max(qn, 0.3) + 0.05);
    qmed = Psm / B;
  }
  const e = isCols ? 0 : eMuro;
  const qmax = qmed * (1 + (6 * Math.abs(e)) / B);
  const qmin = qmed * (1 - (6 * Math.abs(e)) / B);
  const inKern = Math.abs(e) <= B / 6 + 0.01;
  const cWall = isCols ? t1 : tw;
  const lvL = B / 2 - cWall / 2 + e;
  const lvR = B / 2 - cWall / 2 - e;
  const hNeed = Math.max(0.35, Math.max(lvL, lvR) / 2);
  const hf = Math.max(hfIn, round05(hNeed));
  const d = hf * 100 - rec;
  const qu = Pum / B;
  const MuL = (qu * Math.max(lvL, 0) ** 2) / 2;
  const MuR = (qu * Math.max(lvR, 0) ** 2) / 2;
  const Mu = Math.max(MuL, MuR);
  const flex = asFlex(Mu, 100, d, fc, fy, rec);
  const sPrin = spacingFor(flex.As, 1.29, 100);
  const AsDist = 0.0018 * 100 * hf * 100;
  const sDist = spacingFor(AsDist, 0.71, 100);
  const sh = oneWay(qu, 1, Math.max(lvL, lvR), d, fc);

  const Lbeam = isCols ? nTramos * sCol : 0;
  const PuCol = isCols ? Pum * sCol : 0;
  const loads: PLoad[] = [];
  if (isCols) {
    for (let i = 0; i <= nTramos; i++) loads.push({ x: i * sCol, P: 1.4 * Pd * sCol + 1.7 * Pl * sCol, label: `Col ${i + 1}` });
  }
  const w = isCols ? qu * B : 0;
  const beam = isCols ? invertBeam(Lbeam, w, loads) : null;
  const pun = isCols ? punch(PuCol, t1, t2, d, B, Math.max(sCol, t2 + 0.4), fc, sCol / 2, B / 2) : null;
  const flexLong = beam ? asFlex(Math.max(beam.Mmax, -beam.Mmin), B * 100, d, fc, fy, rec) : null;
  const sLong = flexLong ? spacingFor((flexLong.As / (B * 100)) * 100, 1.29, 100) : sDist;

  return out(
    isCols
      ? `Corrida de columnas  B=${fmt(B, 2)} m  ·  h=${fmt(hf, 2)} m  ·  s=${fmt(sCol, 2)} m`
      : `Corrida de muro  B=${fmt(B, 2)} m  ·  h=${fmt(hf, 2)} m  ·  muro ${fmt(tw, 2)} m`,
    isCols
      ? `Transv. Ø 1/2" @ ${sPrin} cm  ·  Long. Ø 1/2" @ ${sLong} cm  ·  q=${fmt(qmed, 2)} t/m²`
      : `Principal Ø 1/2" @ ${sPrin} cm (⊥ muro)  ·  Distribución Ø 3/8" @ ${sDist} cm  ·  q=${fmt(qmed, 2)} t/m²`,
    [
      {
        n: "01",
        title: isCols ? "Línea de columnas — carga por metro y por apoyo" : "Muro — carga por metro de corrida",
        formula: isCols ? "p = PD + PL  (t/m de muro de carga)    ·    Pcol = p · s" : "p = PD + PL    ·    pu = 1.4 PD + 1.7 PL",
        substitution: isCols
          ? `p=${fmt(Psm, 2)} t/m    s=${fmt(sCol, 2)} m    Pcol=${fmt(Psm * sCol, 1)} t    Pucol=${fmt(PuCol, 1)} t`
          : `PD=${fmt(Pd, 2)}  PL=${fmt(Pl, 2)} t/m    p=${fmt(Psm, 2)}    pu=${fmt(Pum, 2)} t/m`,
        result: isCols ? `${nTramos} tramos  ·  ${nTramos + 1} columnas` : `Muro t = ${fmt(tw, 2)} m    ·    excentricidad e = ${fmt(e, 3)} m`,
        note: isCols
          ? "La corrida recibe la carga de la línea de columnas. El suelo reacciona en el ancho B; las columnas interactúan como viga invertida continua."
          : "La zapata corrida se calcula por metro de longitud. Si el muro no está centrado (lindero), e desplaza la presión hacia un vuelo.",
      },
      {
        n: "02",
        title: "Suelo — esfuerzo neto y ancho B",
        formula: "σn = σadm − γt Df − γc h − s/c    ·    B = p / σn",
        substitution: `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(hfIn, 2)} − ${fmt(sc, 2)} = ${fmt(qn, 2)} t/m²`,
        result: `B = ${fmt(B, 2)} m    ·    q = p/B = ${fmt(qmed, 2)} t/m²`,
        note: "B se redondea a 5 cm. Debe cubrir el muro o el lado de columna más un vuelo mínimo de 25 cm a cada lado.",
        ok: qn > 0,
      },
      {
        n: "03",
        title: "Presiones y núcleo",
        formula: "qmáx,mín = q [1 ± 6e/B]    ·    |e| ≤ B/6",
        substitution: `e=${fmt(e, 3)} m    B/6=${fmt(B / 6, 3)} m`,
        result: `qmáx=${fmt(qmax, 2)}    qmín=${fmt(qmin, 2)} t/m²`,
        ok: qmax <= qn + 0.05 && inKern && qmin >= -0.02,
        note: inKern ? "Resultante dentro del tercio medio: contacto completo." : "Fuera del núcleo: ensanchar B o recentrar el muro.",
      },
      {
        n: "04",
        title: "Vuelos y peralte",
        formula: "ℓv = B/2 − t/2 ± e    ·    h ≥ ℓv/2    y    h ≥ 35 cm",
        substitution: `ℓv,izq=${fmt(lvL, 2)} m    ℓv,der=${fmt(lvR, 2)} m    r=${fmt(rec, 1)} cm`,
        result: `h = ${fmt(hf, 2)} m    ·    d = ${fmt(d, 1)} cm`,
      },
      {
        n: "05",
        title: "Flexión transversal (voladizos)",
        formula: "Mu = qu ℓv² / 2    (t·m por metro de corrida)",
        substitution: `qu=${fmt(qu, 2)} t/m²    Mu,izq=${fmt(MuL, 3)}    Mu,der=${fmt(MuR, 3)} t·m/m`,
        result: `Mu gob. = ${fmt(Mu, 3)} t·m/m    ·    Ø 1/2" @ ${sPrin} cm  (As=${fmt(flex.As, 2)} cm²/m)`,
        note: "El acero principal va perpendicular al muro, en la cara del suelo, continuo de vuelo a vuelo, con gancho en los extremos.",
      },
      {
        n: "06",
        title: "Corte en una dirección",
        formula: "Vu = qu (ℓv − d)    ·    φVc = 0.85·0.53 √f'c b d   (b = 1.00 m)",
        substitution: `ℓv − d = ${fmt(sh.clear, 2)} m`,
        result: `Vu = ${fmt(sh.Vu, 2)} t/m    ≤    φVc = ${fmt(sh.phiVc, 2)} t/m`,
        ok: sh.ok,
      },
      {
        n: "07",
        title: isCols ? "Viga invertida entre columnas (eje de la corrida)" : "Acero de distribución (paralelo al muro)",
        formula: isCols ? "w = qu B    ·    V(x)=w x − Σ Pu    ·    M(x)=w x²/2 − Σ Pu(x−xi)" : "As,dist = 0.0018 b h    ·    s ≤ 3h y ≤ 45 cm",
        substitution: isCols
          ? `L=${fmt(Lbeam, 2)} m    w=${fmt(w, 2)} t/m    M+=${fmt(beam?.Mmax ?? 0, 2)}    M−=${fmt(beam?.Mmin ?? 0, 2)} t·m`
          : `As,dist = ${fmt(AsDist, 2)} cm²/m    h=${fmt(hf * 100, 0)} cm`,
        result: isCols
          ? `Longitudinal Ø 1/2" @ ${sLong} cm  (As=${fmt(flexLong?.As ?? 0, 2)} cm² en el ancho B)`
          : `Ø 3/8" @ ${sDist} cm paralelas al muro`,
        note: isCols
          ? "Las columnas bajan cargas puntuales; el suelo las equilibra en el ancho B. M+ entre apoyos (acero inferior) y M− en vuelos de extremo si los hay."
          : "La distribución controla fisuración y reparte la reacción del suelo a lo largo del muro.",
      },
      ...(isCols && pun
        ? [
            {
              n: "08",
              title: "Punzonamiento en columna típica",
              formula: "Vu = Pucol − qu Acrit    ·    φVc = 0.85·1.06 √f'c b0 d",
              substitution: `Pucol=${fmt(PuCol, 1)} t    Vu=${fmt(pun.Vu, 2)}    φVc=${fmt(pun.phiVc, 2)} t`,
              result: pun.ok ? "CUMPLE" : "Aumentar h o B",
              ok: pun.ok,
              note: "Cada columna perfora la corrida. Si el muro es de carga continua sin pedestales, este chequeo no gobierna.",
            },
          ]
        : []),
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)} t/m²`, `≤ ${fmt(qn, 2)}`, qmax <= qn + 0.05 && qn > 0),
      ok("Núcleo |e| ≤ B/6", `${fmt(Math.abs(e), 3)} m`, `≤ ${fmt(B / 6, 3)} m`, inKern),
      ok("Corte 1 dir.", `${fmt(sh.Vu, 2)} t/m`, `≤ ${fmt(sh.phiVc, 2)}`, sh.ok),
      ok("h mínimo", `${fmt(hf * 100, 0)} cm`, "≥ 35 cm", hf >= 0.35),
      ...(pun ? [ok("Punzonamiento", `${fmt(pun.Vu, 1)} t`, `≤ ${fmt(pun.phiVc, 1)} t`, pun.ok)] : []),
    ],
    isCols && beam
      ? [
          {
            title: "Estaciones de la viga invertida (línea de columnas)",
            rows: [
              ["x (m)", "V (t)", "M (t·m)", ""],
              ...beam.pts
                .filter((_, i, a) => i % 2 === 0 || i === a.length - 1)
                .map((p) => [fmt(p.x, 2), fmt(p.V, 2), fmt(p.M, 2), ""]),
            ],
          },
        ]
      : [
          {
            title: "Voladizos por metro de corrida",
            rows: [
              ["Lado", "ℓv (m)", "Mu (t·m/m)", "Vu (t/m)"],
              ["Izquierdo", fmt(lvL, 2), fmt(MuL, 3), fmt(qu * Math.max(lvL - d / 100, 0), 2)],
              ["Derecho", fmt(lvR, 2), fmt(MuR, 3), fmt(qu * Math.max(lvR - d / 100, 0), 2)],
            ],
          },
        ],
    {
      B: B.toFixed(2),
      L: isCols ? Lbeam.toFixed(2) : "1.00",
      hf: hf.toFixed(2),
      hAd: hf.toFixed(2),
      Df: Df.toFixed(2),
      tw: tw.toFixed(2),
      t1: t1.toFixed(2),
      t2: t2.toFixed(2),
      tipo,
      sCol: sCol.toFixed(2),
      lvL: lvL.toFixed(3),
      lvR: lvR.toFixed(3),
      MuCorr: Mu.toFixed(3),
      asPrin: `Ø 1/2" @ ${sPrin} cm`,
      AsPrin: flex.As.toFixed(2),
      Lbeam: Lbeam.toFixed(2),
      mPts: beam ? packPts(beam.pts) : "",
      Msoil: beam ? Math.max(-beam.Mmin, 0).toFixed(3) : "0",
      Mtop: beam ? Math.max(beam.Mmax, 0).toFixed(3) : "0",
      asLong: `Ø 1/2" @ ${sLong} cm`,
      AsLong: flexLong ? flexLong.As.toFixed(2) : AsDist.toFixed(2),
    }
  );
};

/* ───────── Platea de cimentación — método de franjas ───────── */
export const platea: Engine = (raw) => {
  const nBayX = Math.max(1, Math.round(num(raw, "nBayX", 3)));
  const nBayY = Math.max(1, Math.round(num(raw, "nBayY", 3)));
  const Sx = num(raw, "Sx", 5);
  const Sy = num(raw, "Sy", 5);
  const ox = num(raw, "ox", 0.5);
  const oy = num(raw, "oy", 0.5);
  const tIn = num(raw, "t", 0.5);
  const c = num(raw, "c", 0.4);
  const PdInt = num(raw, "PdInt", 80);
  const PlInt = num(raw, "PlInt", 30);
  const PdEdge = num(raw, "PdEdge", 55);
  const PlEdge = num(raw, "PlEdge", 20);
  const PdCor = num(raw, "PdCor", 40);
  const PlCor = num(raw, "PlCor", 15);
  const qadm = num(raw, "qadm", 1.5);
  const Df = num(raw, "Df", 1.2);
  const gt = num(raw, "gt", 1.8);
  const sc = num(raw, "sc", 0.3);
  const Ks = num(raw, "Ks", 8);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 7.5);

  const nColX = nBayX + 1;
  const nColY = nBayY + 1;
  const Lx = nBayX * Sx + 2 * ox;
  const Ly = nBayY * Sy + 2 * oy;
  const nCor = 4;
  const nEdge = Math.max(0, 2 * (nColX - 2) + 2 * (nColY - 2));
  const nInt = Math.max(0, (nColX - 2) * (nColY - 2));
  const nTot = nColX * nColY;

  const PcorS = PdCor + PlCor;
  const PedS = PdEdge + PlEdge;
  const PinS = PdInt + PlInt;
  const PcorU = 1.4 * PdCor + 1.7 * PlCor;
  const PedU = 1.4 * PdEdge + 1.7 * PlEdge;
  const PinU = 1.4 * PdInt + 1.7 * PlInt;

  const PpColS = nCor * PcorS + nEdge * PedS + nInt * PinS;
  const PpColU = nCor * PcorU + nEdge * PedU + nInt * PinU;
  const A = Lx * Ly;
  const Wslab = 2.4 * tIn * A;
  const Wfill = gt * Math.max(Df - tIn, 0) * A;
  const Wsc = sc * A;
  const Pts = PpColS + Wslab + Wfill + Wsc;
  const Put = PpColU + 1.4 * (Wslab + Wfill) + 1.7 * Wsc;
  const qserv = Pts / A;
  const qu = Put / A;
  const qn = qadm * 10 - gt * Df - 2.4 * tIn - sc;

  const Ec = 15000 * Math.sqrt(Math.max(fc, 1));
  const nu = 0.2;
  const lRad = Math.pow((Ec * (tIn * 100) ** 3) / (12 * (1 - nu * nu) * Math.max(Ks, 0.2)), 0.25);
  const Lc = Math.min(Sx, Sy) * 100 / 2;
  const ratio = Lc / Math.max(lRad, 1);
  const rigido = ratio < 1.75;
  const amp = rigido ? 1 : 1.2;

  const tNeed = Math.max(0.35, c + 0.05, (Math.max(Sx, Sy) / 20) * 0.8);
  const t = Math.max(tIn, round05(tNeed));
  const d = t * 100 - rec;

  function rowLoads(kind: "int" | "edge", n: number, span: number, ov: number, Pedge: number, Pint: number, Pcor: number): PLoad[] {
    const outL: PLoad[] = [];
    for (let i = 0; i < n; i++) {
      const x = ov + i * span;
      const end = i === 0 || i === n - 1;
      const P = kind === "edge" ? (end ? Pcor : Pedge) : end ? Pedge : Pint;
      outL.push({ x, P, label: end ? (kind === "edge" ? "Esquina" : "Borde") : kind === "edge" ? "Borde" : "Interior" });
    }
    return outL;
  }

  const bIntX = Sy;
  const bEdgX = Sy / 2 + oy;
  const bIntY = Sx;
  const bEdgY = Sx / 2 + ox;
  const loadsIntX = rowLoads("int", nColX, Sx, ox, PedU, PinU, PcorU);
  const loadsEdgX = rowLoads("edge", nColX, Sx, ox, PedU, PinU, PcorU);
  const loadsIntY = rowLoads("int", nColY, Sy, oy, PedU, PinU, PcorU);
  const loadsEdgY = rowLoads("edge", nColY, Sy, oy, PedU, PinU, PcorU);
  const sumP = (ls: PLoad[]) => ls.reduce((s, p) => s + p.P, 0);
  const frIntX = invertBeam(Lx, sumP(loadsIntX) / Lx, loadsIntX);
  const frEdgX = invertBeam(Lx, sumP(loadsEdgX) / Lx, loadsEdgX);
  const frIntY = invertBeam(Ly, sumP(loadsIntY) / Ly, loadsIntY);
  const frEdgY = invertBeam(Ly, sumP(loadsEdgY) / Ly, loadsEdgY);

  const Msoil = amp * Math.max(-frIntX.Mmin, -frEdgX.Mmin, -frIntY.Mmin, -frEdgY.Mmin, 0);
  const Mtop = amp * Math.max(frIntX.Mmax, frEdgX.Mmax, frIntY.Mmax, frEdgY.Mmax, 0);
  const flexPos = asFlex(Msoil / Math.max(bIntX, 1), 100, d, fc, fy, rec);
  const flexNeg = asFlex(Mtop / Math.max(bIntX, 1), 100, d, fc, fy, rec);
  const sPos = spacingFor(flexPos.As, 1.29, 100);
  const sNeg = spacingFor(flexNeg.As, 1.29, 100);
  const AsTemp = 0.0018 * 100 * t * 100;
  const sTemp = spacingFor(AsTemp, 0.71, 100);

  const punInt = punch(PinU, c, c, d, Sx, Sy, fc, Sx / 2, Sy / 2);
  const punEdg = punch(PedU, c, c, d, Sx, bEdgX, fc, Sx / 2, c / 2 + 0.05);
  const punCor = punch(PcorU, c, c, d, bEdgY, bEdgX, fc, c / 2 + 0.05, c / 2 + 0.05);

  const shX = oneWay(qu, bIntX, Sx / 2 - c / 2, d, fc);
  const shY = oneWay(qu, bIntY, Sy / 2 - c / 2, d, fc);

  const cgOk = Math.abs(frIntX.Vend) < 0.12 * PinU * nColX + 1;
  const qOk = qserv <= qn + 0.05 && qn > 0;

  function franjaRows(name: string, b: number, beam: ReturnType<typeof invertBeam>) {
    const flexP = asFlex((amp * Math.max(-beam.Mmin, 0)) / b, 100, d, fc, fy, rec);
    const flexN = asFlex((amp * Math.max(beam.Mmax, 0)) / b, 100, d, fc, fy, rec);
    return [
      name,
      fmt(b, 2),
      fmt(amp * Math.max(-beam.Mmin, 0), 1),
      fmt(amp * Math.max(beam.Mmax, 0), 1),
      fmt(beam.Vmax, 1),
      fmt(flexP.As, 2),
      fmt(flexN.As, 2),
    ];
  }

  return out(
    `Platea ${fmt(Lx, 2)}×${fmt(Ly, 2)}×${fmt(t, 2)} m  ·  ${rigido ? "rígida" : "flexible"}  ·  q=${fmt(qserv, 2)} t/m²`,
    `Malla inf. Ø 1/2" @ ${sPos} cm  ·  malla sup. Ø 1/2" @ ${sNeg} cm  ·  temp. Ø 3/8" @ ${sTemp} cm`,
    [
      {
        n: "01",
        title: "Geometría de la platea y de la malla de columnas",
        formula: "Lx = nX·Sx + 2 ox    ·    Ly = nY·Sy + 2 oy    ·    n col. = (nX+1)(nY+1)",
        substitution: `${nBayX}×${nBayY} paños    Sx=${fmt(Sx, 2)}  Sy=${fmt(Sy, 2)}    ox=${fmt(ox, 2)}  oy=${fmt(oy, 2)}`,
        result: `Lx=${fmt(Lx, 2)} m    Ly=${fmt(Ly, 2)} m    ·    ${nTot} columnas (${nCor} esquinas, ${nEdge} bordes, ${nInt} interiores)`,
        note: "Los vuelos ox, oy sacan la resultante hacia el interior del núcleo y reducen el punzonamiento de esquina. La columna se toma cuadrada de lado c.",
      },
      {
        n: "02",
        title: "Cargas por tipo de columna y metrado de la platea",
        formula: "ΣPcol = 4 Pcor + n_borde Ped + n_int Pint    ·    W = γc t A + γt (Df−t) A + s/c A",
        substitution: `Pcor=${fmt(PcorS, 1)}  Ped=${fmt(PedS, 1)}  Pint=${fmt(PinS, 1)} t    ·    A=${fmt(A, 1)} m²`,
        result: `Columnas ${fmt(PpColS, 0)} t    losa ${fmt(Wslab, 0)}    relleno ${fmt(Wfill, 0)}    s/c ${fmt(Wsc, 0)}    →    ΣP = ${fmt(Pts, 0)} t`,
        note: "Cada columna entra con su PD y PL. La platea y el relleno sobre ella también cargan el suelo: no se diseñan las franjas solo con las columnas.",
      },
      {
        n: "03",
        title: "Presión media y esfuerzo neto del suelo",
        formula: "q = ΣP / A    ·    qu = ΣPu / A    ·    σn = σadm − γt Df − γc t − s/c",
        substitution: `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(t, 2)} − ${fmt(sc, 2)}`,
        result: `q = ${fmt(qserv, 2)} t/m²    ·    qu = ${fmt(qu, 2)} t/m²    ·    σn = ${fmt(qn, 2)} t/m²`,
        ok: qOk,
        note: "En platea rígida la presión se toma uniforme (el centro de rigideces coincide con el de cargas si la malla es regular). qu se usa en las franjas.",
      },
      {
        n: "04",
        title: "Radio de rigidez relativa (Westergaard) y criterio rígido / flexible",
        formula: "l = ⁴√[ Ec h³ / (12 (1−ν²) Ks) ]    ·    Lc = min(Sx,Sy)/2    ·    Lc/l < 1.75 → rígida",
        substitution: `Ec=${fmt(Ec, 0)} kg/cm²    h=${fmt(t * 100, 0)} cm    Ks=${fmt(Ks, 1)} kg/cm³    ν=0.20`,
        result: `l = ${fmt(lRad, 0)} cm    ·    Lc/l = ${fmt(ratio, 2)}    ·    ${rigido ? "PLATEA RÍGIDA" : "PLATEA FLEXIBLE"}`,
        note: rigido
          ? "La platea reparte como un sólido: las franjas se integran como vigas libre-libre con qu uniforme y las Pu de la fila."
          : "Lc/l ≥ 1.75: hay concentración bajo columnas. Se diseñan las mismas franjas con mayoración 1.20 de qu (aproximación de Winkler). Conviene un modelo de resortes si el edificio es irregular.",
      },
      {
        n: "05",
        title: "Definición de franjas (método de fajas)",
        formula: "Franja int. X: b = Sy    ·    Franja borde X: b = Sy/2 + oy    ·    análogo en Y",
        substitution: `b int X=${fmt(bIntX, 2)}    b borde X=${fmt(bEdgX, 2)}    ·    b int Y=${fmt(bIntY, 2)}    b borde Y=${fmt(bEdgY, 2)} m`,
        result: "4 franjas gobernantes: interior X, borde X, interior Y, borde Y",
        note: "Cada franja se equilibra con w = ΣPu de su fila / L, de modo que V(L)≈0. El peso propio uniforme de la platea no flecta (se cancela con su propia reacción). Si la platea es flexible, los momentos de franja se mayoran 1.20.",
      },
      {
        n: "06",
        title: "Franja interior longitudinal (eje X)",
        formula: "w = qu b    ·    V(x)=w x − Σ Pu    ·    M(x)=w x²/2 − Σ Pu(x−xi)",
        substitution: `b=${fmt(bIntX, 2)} m    w = ΣPu,fila / Lx = ${fmt(sumP(loadsIntX) / Lx, 2)} t/m    columnas: 2 bordes + ${Math.max(nColX - 2, 0)} interiores`,
        result: `M+ = ${fmt(frIntX.Mmax, 1)} t·m    M− = ${fmt(frIntX.Mmin, 1)} t·m    Vmáx = ${fmt(frIntX.Vmax, 1)} t`,
        note: "Entre columnas el momento tracciona la cara del suelo (malla inferior). En los vuelos ox, el momento de voladizo tracciona la cara superior. V(Lx)≈0 verifica el equilibrio de la fila.",
      },
      {
        n: "07",
        title: "Franja de borde longitudinal (eje X)",
        formula: "Igual integración, con b = Sy/2+oy y Pu de esquina / borde",
        substitution: `b=${fmt(bEdgX, 2)} m    w = ${fmt(sumP(loadsEdgX) / Lx, 2)} t/m`,
        result: `M+ = ${fmt(frEdgX.Mmax, 1)} t·m    M− = ${fmt(frEdgX.Mmin, 1)} t·m    Vmáx = ${fmt(frEdgX.Vmax, 1)} t`,
        note: "La franja de borde es más estrecha y las columnas de esquina pesan menos, pero el vuelo oy produce M− de borde que a menudo gobierna la malla superior.",
      },
      {
        n: "08",
        title: "Franjas transversales (eje Y)",
        formula: "Se repite el modelo en la dirección ortogonal",
        substitution: `int. b=${fmt(bIntY, 2)} m    borde b=${fmt(bEdgY, 2)} m    Sy=${fmt(Sy, 2)} m`,
        result: `Int. M+=${fmt(frIntY.Mmax, 1)}  M−=${fmt(frIntY.Mmin, 1)}    ·    Borde M+=${fmt(frEdgY.Mmax, 1)}  M−=${fmt(frEdgY.Mmin, 1)} t·m`,
        note: "La platea se arma en dos direcciones. Gobierna, en cada cara, el mayor Mu de las cuatro franjas, expresado por metro de ancho.",
      },
      {
        n: "09",
        title: "Acero por metro — mallas inferior y superior",
        formula: "As = Mu/(φ fy j d) por metro    ·    Asmín = 0.0018 t",
        substitution: `Mu,suelo gob. = ${fmt(Msoil / Math.max(bIntX, 1), 2)} t·m/m    Mu,vuelo gob. = ${fmt(Mtop / Math.max(bIntX, 1), 2)} t·m/m    d=${fmt(d, 1)} cm`,
        result: `Inferior Ø 1/2" @ ${sPos} cm  (As=${fmt(flexPos.As, 2)} cm²/m)    ·    Superior Ø 1/2" @ ${sNeg} cm  (As=${fmt(flexNeg.As, 2)} cm²/m)`,
        note: "Ambas direcciones. En bandas de columna se puede densificar al s calculado; en el centro del paño no bajar de Asmín ni de Ø 3/8\" @ 25 cm.",
      },
      {
        n: "10",
        title: "Punzonamiento en interior, borde y esquina",
        formula: "Vu = Pu − qu Acrit    ·    φVc = 0.85·1.06 √f'c b0 d",
        substitution: `Int. Vu=${fmt(punInt.Vu, 1)} φVc=${fmt(punInt.phiVc, 1)}    ·    Borde Vu=${fmt(punEdg.Vu, 1)} φVc=${fmt(punEdg.phiVc, 1)}    ·    Esq. Vu=${fmt(punCor.Vu, 1)} φVc=${fmt(punCor.phiVc, 1)} t`,
        result: `Interior ${punInt.ok ? "OK" : "NO"}    ·    Borde ${punEdg.ok ? "OK" : "NO"}    ·    Esquina ${punCor.ok ? "OK" : "NO"}`,
        ok: punInt.ok && punEdg.ok && punCor.ok,
        note: "El perímetro crítico se recorta si cae fuera de la platea (borde y esquina). Si no cubre, subir t o capitel / ábaco.",
      },
      {
        n: "11",
        title: "Corte en una dirección (franja interior)",
        formula: "Vu = qu b (L/2 − c/2 − d)    ·    φVc = 0.85·0.53 √f'c b d",
        substitution: `X: Vu=${fmt(shX.Vu, 1)} φVc=${fmt(shX.phiVc, 1)} t    ·    Y: Vu=${fmt(shY.Vu, 1)} φVc=${fmt(shY.phiVc, 1)} t`,
        result: `X ${shX.ok ? "CUMPLE" : "NO CUMPLE"}    ·    Y ${shY.ok ? "CUMPLE" : "NO CUMPLE"}`,
        ok: shX.ok && shY.ok,
      },
      {
        n: "12",
        title: "Acero de temperatura / retracción",
        formula: "As,temp = 0.0018 t    ·    s ≤ 3t y ≤ 45 cm",
        substitution: `t=${fmt(t * 100, 0)} cm    As=${fmt(AsTemp, 2)} cm²/m`,
        result: `Ø 3/8" @ ${sTemp} cm en la cara que no gobierne por flexión`,
      },
    ],
    [
      ok("q ≤ σn", `${fmt(qserv, 2)} t/m²`, `≤ ${fmt(qn, 2)}`, qOk),
      ok("Criterio de rigidez", fmt(ratio, 2), rigido ? "< 1.75 rígida" : "≥ 1.75 (×1.20)", true),
      ok("Punzonamiento interior", `${fmt(punInt.Vu, 1)} t`, `≤ ${fmt(punInt.phiVc, 1)} t`, punInt.ok),
      ok("Punzonamiento borde", `${fmt(punEdg.Vu, 1)} t`, `≤ ${fmt(punEdg.phiVc, 1)} t`, punEdg.ok),
      ok("Punzonamiento esquina", `${fmt(punCor.Vu, 1)} t`, `≤ ${fmt(punCor.phiVc, 1)} t`, punCor.ok),
      ok("Corte 1 dir. X", `${fmt(shX.Vu, 1)} t`, `≤ ${fmt(shX.phiVc, 1)} t`, shX.ok),
      ok("Corte 1 dir. Y", `${fmt(shY.Vu, 1)} t`, `≤ ${fmt(shY.phiVc, 1)} t`, shY.ok),
      ok("t ≥ 35 cm", `${fmt(t * 100, 0)} cm`, "≥ 35 cm", t >= 0.35),
      ok("Equilibrio franja int. X", `V(L)=${fmt(frIntX.Vend, 1)} t`, "≈ 0", cgOk),
    ],
    [
      {
        title: "Resumen de franjas (método de fajas)",
        rows: [
          ["Franja", "b (m)", "Msuelo (t·m)", "Mvuelo (t·m)", "Vmáx (t)", "As inf. (cm²/m)", "As sup. (cm²/m)"],
          franjaRows("Interior X (fila)", bIntX, frIntX),
          franjaRows("Borde X", bEdgX, frEdgX),
          franjaRows("Interior Y (fila)", bIntY, frIntY),
          franjaRows("Borde Y", bEdgY, frEdgY),
        ],
      },
      {
        title: "Columnas — conteo y cargas",
        rows: [
          ["Tipo", "n", "PD (t)", "PL (t)", "P serv. (t)", "Pu (t)", "ΣPu (t)"],
          ["Esquina", String(nCor), fmt(PdCor, 1), fmt(PlCor, 1), fmt(PcorS, 1), fmt(PcorU, 1), fmt(nCor * PcorU, 1)],
          ["Borde", String(nEdge), fmt(PdEdge, 1), fmt(PlEdge, 1), fmt(PedS, 1), fmt(PedU, 1), fmt(nEdge * PedU, 1)],
          ["Interior", String(nInt), fmt(PdInt, 1), fmt(PlInt, 1), fmt(PinS, 1), fmt(PinU, 1), fmt(nInt * PinU, 1)],
          ["Total columnas", String(nTot), "—", "—", fmt(PpColS, 0), "—", fmt(PpColU, 0)],
        ],
      },
    ],
    {
      Lx: Lx.toFixed(2),
      Ly: Ly.toFixed(2),
      t: t.toFixed(2),
      Sx: Sx.toFixed(2),
      Sy: Sy.toFixed(2),
      ox: ox.toFixed(2),
      oy: oy.toFixed(2),
      nBayX: String(nBayX),
      nBayY: String(nBayY),
      c: c.toFixed(2),
      Df: Df.toFixed(2),
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
      asPos: `Ø 1/2" @ ${sPos} cm inf. · Ø 1/2" @ ${sNeg} cm sup.`,
      AsPos: flexPos.As.toFixed(2),
    }
  );
};
