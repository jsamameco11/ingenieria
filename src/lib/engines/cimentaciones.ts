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

export { calcZapataCorrida as zapataCorrida } from "./maestria/zapataCalc";
export { calcPlatea as platea } from "./maestria/plateaCalc";
export { calcVigaCimentacion as vigaCimentacion } from "./maestria/vigaCimentacionCalc";
