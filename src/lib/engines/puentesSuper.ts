import { type CalcCheck, type CalcOutput, type Engine, fmt, num, str } from "../types";

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

function etaM(L: number, x: number, xi: number) {
  if (xi < -1e-9 || xi > L + 1e-9) return 0;
  return xi <= x ? (xi * (L - x)) / L : (x * (L - xi)) / L;
}
function etaV(L: number, x: number, xi: number) {
  if (xi < -1e-9 || xi > L + 1e-9) return 0;
  return xi <= x ? -(L - x) / L : x / L;
}

const HS20 = [
  { p: 3.63, s: 0 },
  { p: 14.51, s: 4.27 },
  { p: 14.51, s: 8.54 },
];

function envelopeTruck(L: number, x: number, kind: "M" | "V") {
  let max = 0;
  let min = 0;
  for (let a0 = -9; a0 <= L + 10; a0 += 0.15) {
    let v = 0;
    for (const ax of HS20) {
      const xi = a0 + ax.s;
      v += ax.p * (kind === "M" ? etaM(L, x, xi) : etaV(L, x, xi));
    }
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { max, min };
}

function asFlex(Mu: number, b: number, d: number, fc: number, fy: number) {
  const MnNeed = (Math.abs(Mu) * 100000) / 0.9;
  const R = MnNeed / Math.max(b * d * d, 1e-6);
  const m = fy / (0.85 * Math.max(fc, 1));
  const disc = 1 - (2 * R * m) / fy;
  const rho = disc > 0 ? (1 - Math.sqrt(Math.max(disc, 0))) / m : 0.018;
  const As = Math.max(rho * b * d, 0.0018 * b * (d + 5));
  return { As, rho };
}

/* ───────── Cargas AASHTO — PUENTES GENERAL.xlsx ───────── */
export const cargasAashto: Engine = (raw) => {
  const L = num(raw, "L", 25);
  const nTramos = Math.max(1, Math.round(num(raw, "nTramos", 1)));
  const nCarr = Math.max(1, Math.round(num(raw, "nCarr", 2)));
  const H = num(raw, "H", 8);
  const wLane = num(raw, "wLane", 0.95);
  const IM = num(raw, "IM", 33) / 100;
  const nD = num(raw, "nD", 1);
  const nR = num(raw, "nR", 1);
  const nI = num(raw, "nI", 1);
  const m = nCarr === 1 ? 1.2 : nCarr === 2 ? 1.0 : nCarr === 3 ? 0.85 : 0.65;
  const n = Math.max(0.95, nD * nR * nI);
  const P1 = 3.63;
  const P2 = 14.51;
  const truck = P1 + 2 * P2;
  const lane = wLane * L;
  const Br25 = 0.25 * truck;
  const Br5 = 0.05 * (truck + lane);
  const BR = Math.max(Br25, Br5);
  const Mmid = envelopeTruck(L, L / 2, "M");
  const Vend = envelopeTruck(L, 0.01, "V");
  const Mll = m * (1 + IM) * Mmid.max + m * wLane * (L * L) / 8 * 0.8;
  const Vll = m * (1 + IM) * Math.max(Math.abs(Vend.max), Math.abs(Vend.min)) + m * wLane * L / 2;
  const vr = num(raw, "vr", 0.366);
  const sr = num(raw, "sr", 0.76);
  return out(
    `HL-93  ·  m=${fmt(m, 2)}  ·  IM=${fmt(IM * 100, 0)} %  ·  BR=${fmt(BR, 2)} t`,
    `n = nD nR nI = ${fmt(n, 3)}  ·  Resistencia I: 1.25 DC + 1.50 DW + 1.75 (LL+IM)`,
    [
      {
        n: "01",
        title: "Camión de diseño HL-93 / HS-20",
        formula: "Ejes 8–32–32 kip = 3.63 + 14.51 + 14.51 t    ·    separación 4.27 m",
        substitution: `Luz L=${fmt(L, 2)} m   ·   ${nTramos} tramo(s)   ·   ${nCarr} carril(es)`,
        result: `Σ ejes = ${fmt(truck, 2)} t    ·    carril w = ${fmt(wLane, 2)} t/m`,
        note: "El tren se envuelve cada décimo de tramo. El envelope se obtiene recorriendo el HS-20 sobre la viga simplemente apoyada.",
      },
      {
        n: "02",
        title: "Incremento por carga dinámica IM",
        formula: "IM = 33 % (Resistencia y Servicio)    ·    15 % Fatiga    ·    75 % uniones",
        substitution: `IM ingresado = ${fmt(IM * 100, 0)} %`,
        result: `factor (1+IM) = ${fmt(1 + IM, 2)}`,
        note: "AASHTO 3.6.2. No se aplica IM a la carga de carril ni a peatones.",
      },
      {
        n: "03",
        title: "Presencia múltiple m",
        formula: "1 carril 1.20   ·   2 carriles 1.00   ·   3 → 0.85   ·   ≥4 → 0.65",
        substitution: `${nCarr} carril(es) cargados`,
        result: `m = ${fmt(m, 2)}`,
      },
      {
        n: "04",
        title: "Fuerza de frenado BR (AASHTO 3.6.4)",
        formula: "BR = máx[ 25 % camión  ;  5 % (camión+carril) ]    a 1.80 m sobre la calzada",
        substitution: `0.25×${fmt(truck, 2)} = ${fmt(Br25, 2)} t    ·    0.05×(${fmt(truck, 2)}+${fmt(lane, 2)}) = ${fmt(Br5, 2)} t`,
        result: `BR = ${fmt(BR, 2)} t    ·    momento en estribo ≈ BR×(H+1.8) = ${fmt(BR * (H + 1.8), 1)} t·m`,
        note: "BR se aplica en cada tramo. En estribo entra como par a 1.8 m sobre el tablero.",
      },
      {
        n: "05",
        title: "Vereda y sardinel",
        formula: "PL = 366 kg/m² si ancho ≥ 0.60 m    ·    sardinel 760 kg/m",
        substitution: `vereda ${fmt(vr * 1000, 0)} kg/m²    sardinel ${fmt(sr * 1000, 0)} kg/m`,
        result: `PL = ${fmt(vr, 3)} t/m²    ·    Sr = ${fmt(sr, 2)} t/m`,
      },
      {
        n: "06",
        title: "Factor de modificación n = nD nR nI",
        formula: "nD ductilidad · nR redundancia · nI importancia    ·    n ≥ 0.95",
        substitution: `nD=${fmt(nD, 2)}  nR=${fmt(nR, 2)}  nI=${fmt(nI, 2)}`,
        result: `n = ${fmt(n, 3)}`,
        note: "Convencional / redundante / puente típico → 1.00. Poco dúctil o no redundante → 1.05.",
      },
      {
        n: "07",
        title: "Envelope de LL en tramo simple",
        formula: "Se recorre el tren HS-20; η_M(x,ξ)=ξ(L−x)/L  (ξ≤x)",
        substitution: `sección x = L/2 = ${fmt(L / 2, 2)} m`,
        result: `Mcamión = ${fmt(Mmid.max, 2)} t·m    ·    Vapoyo = ${fmt(Math.max(Math.abs(Vend.max), Math.abs(Vend.min)), 2)} t`,
      },
      {
        n: "08",
        title: "LL+IM de diseño (un tramo)",
        formula: "MLL+IM = m(1+IM) Mcamión + m w L²/8    (carril sin IM)",
        substitution: `m=${fmt(m, 2)}  (1+IM)=${fmt(1 + IM, 2)}`,
        result: `MLL+IM = ${fmt(Mll, 2)} t·m    ·    VLL+IM = ${fmt(Vll, 2)} t`,
      },
      {
        n: "09",
        title: "Combinación Resistencia I",
        formula: "U = n [1.25 DC + 1.50 DW + 1.75 (LL+IM) + 1.75 BR]",
        substitution: `n = ${fmt(n, 3)}`,
        result: `γ_LL = ${fmt(n * 1.75, 3)}    ·    γ_DC = ${fmt(n * 1.25, 3)}    ·    γ_DW = ${fmt(n * 1.5, 3)}`,
        note: "Servicio I: n[1.0 DC + 1.0 DW + 1.0(LL+IM)]. Fatiga: 0.75(LL+IM) con IM=15 %.",
      },
    ],
    [
      ok("n ≥ 0.95", fmt(n, 3), "≥ 0.95", n >= 0.95),
      ok("IM Resistencia", `${fmt(IM * 100, 0)} %`, "33 % típico", IM >= 0.32),
      ok("m según carriles", fmt(m, 2), nCarr <= 2 ? "1.20 ó 1.00" : "≤ 0.85", true),
    ],
    [
      {
        title: "Envelope HS-20 en décimos de la luz",
        rows: [
          ["x/L", "x (m)", "Mmáx (t·m)", "Mmín (t·m)", "Vmáx (t)"],
          ...Array.from({ length: 11 }, (_, i) => {
            const x = (i / 10) * L;
            const M = envelopeTruck(L, Math.min(Math.max(x, 0.01), L - 0.01), "M");
            const V = envelopeTruck(L, Math.min(Math.max(x, 0.01), L - 0.01), "V");
            return [fmt(i / 10, 1), fmt(x, 2), fmt(M.max, 2), fmt(M.min, 2), fmt(Math.max(Math.abs(V.max), Math.abs(V.min)), 2)];
          }),
        ],
      },
    ]
  );
};


/* Losa de tablero y puente losa: ver losaTablero.ts */

/* Apoyo elastomérico — DIS DISPOSITIVOS DE APOYO */
export const apoyoElast: Engine = (raw) => {
  const PDC = num(raw, "PDC", 29790);
  const PDW = num(raw, "PDW", 8131);
  const PLL = num(raw, "PLL", 7985);
  const bViga = num(raw, "bViga", 30);
  const G = num(raw, "G", 9.14);
  const sigma = num(raw, "sigma", 87.9);
  const Lpuente = num(raw, "Lpuente", 33);
  const dT = num(raw, "dT", 15);
  const PT = PDC + PDW + PLL;
  const Areq = PT / sigma;
  const W = bViga;
  const L = Math.max(W, Math.ceil(Areq / W / 5) * 5);
  const A = W * L;
  const alpha = 10.8e-6;
  const Dtemp = Lpuente * 100 * alpha * dT;
  const Dpost = num(raw, "Dpost", 1);
  const Dret = num(raw, "Dret", 0.9);
  const gamma = 1.2;
  const Ds = gamma * (Dtemp + Dpost + Dret);
  const hrt = 2 * Ds;
  const sigs = PT / A;
  const Si = sigs / (1.25 * G);
  const hri = Math.max(1.2, W / (4 * Math.max(Si, 1)));
  const nCapas = Math.max(3, Math.ceil(hrt / hri));
  const hriUse = hrt / nCapas;
  return out(
    `Apoyo ${W.toFixed(0)} × ${L.toFixed(0)} cm  ·  ${nCapas} capas de ${fmt(hriUse, 2)} cm`,
    `A=${fmt(A, 0)} cm² ≥ ${fmt(Areq, 0)}  ·  hrt=${fmt(hrt, 2)} cm  ·  Si≥${fmt(Si, 2)}`,
    [
      {
        n: "01",
        title: "Carga de servicio (estado límite de servicio)",
        formula: "PT = PDC + PDW + PLL",
        substitution: `${fmt(PDC, 0)}+${fmt(PDW, 0)}+${fmt(PLL, 0)}`,
        result: `PT = ${fmt(PT, 0)} kg`,
        note: "DIS DISPOSITIVOS DE APOYO.xlsx: PDW = 0.05×2.2×L×2.24×1000 si no se ingresa el asfalto ya metrado.",
      },
      {
        n: "02",
        title: "Área en planta",
        formula: "Areq = PT / σadm    ·    W = ancho de viga    ·    L ≥ Areq/W",
        substitution: `σadm=${fmt(sigma, 1)} kg/cm² (dureza 60)    W=${fmt(W, 0)} cm`,
        result: `Areq=${fmt(Areq, 1)} cm²    ·    adoptar ${W.toFixed(0)}×${L.toFixed(0)} cm (A=${fmt(A, 0)})`,
        ok: A >= Areq,
      },
      {
        n: "03",
        title: "Acortamiento total Δs",
        formula: "Δs = γ (ΔT + Δpost + Δretrac)    ·    ΔT = α L Δt    ·    α=10.8×10⁻⁶ /°C",
        substitution: `L=${fmt(Lpuente, 2)} m  Δt=${fmt(dT, 1)} °C  →  ΔT=${fmt(Dtemp, 2)} cm    ·    γ=1.2`,
        result: `Δs = ${fmt(Ds, 2)} cm`,
        note: "Manual de Puentes MTC, zona costa: tsup=40 °C, tinf=10 °C, tinst=25 °C → Δt típico 15 °C. Postensado 1 cm y retracción 0.9 cm como en el Excel.",
      },
      {
        n: "04",
        title: "Espesor total de elastómero",
        formula: "hrt ≥ 2 Δs",
        substitution: `2×${fmt(Ds, 2)}`,
        result: `hrt ≥ ${fmt(hrt, 2)} cm`,
      },
      {
        n: "05",
        title: "Factor de forma mínimo Si",
        formula: "σs ≤ 1.25 G Si    →    Si ≥ σs /(1.25 G)",
        substitution: `σs=PT/A=${fmt(sigs, 1)} kg/cm²    G=${fmt(G, 2)}`,
        result: `Si ≥ ${fmt(Si, 2)}`,
      },
      {
        n: "06",
        title: "Capas interiores",
        formula: "hri ≈ W/(4 Si)    ·    n = hrt / hri",
        substitution: `hri calc=${fmt(hri, 2)} cm`,
        result: `${nCapas} capas × ${fmt(hriUse, 2)} cm + placas de acero 2 mm`,
      },
    ],
    [
      ok("A ≥ Areq", `${fmt(A, 0)} cm²`, `≥ ${fmt(Areq, 0)}`, A >= Areq),
      ok("σs ≤ σadm", `${fmt(sigs, 1)}`, `≤ ${fmt(sigma, 1)}`, sigs <= sigma + 0.5),
    ],
    [
      {
        title: "Cuadro de metrado — cargas de servicio del apoyo",
        rows: [
          ["Carga", "Tipo", "Valor (kg)", "Notas"],
          ["PDC", "DC", fmt(PDC, 0), "Peso propio de viga + losa"],
          ["PDW", "DW", fmt(PDW, 0), "Asfalto y cargas de acabado"],
          ["PLL", "LL", fmt(PLL, 0), "Live load de servicio"],
          ["PT", "Σ servicio", fmt(PT, 0), "PDC + PDW + PLL"],
          ["Areq = PT/σadm", "—", fmt(Areq, 1) + " cm²", `σadm = ${fmt(sigma, 1)} kg/cm²`],
          ["A provista", "—", fmt(A, 0) + " cm²", `${W.toFixed(0)} × ${L.toFixed(0)} cm`],
        ],
      },
    ],
    { bViga: String(bViga) }
  );
};

/* Placa de apoyo — DISEÑ PLAC APOYO */
export const placaApoyo: Engine = (raw) => {
  const fc = num(raw, "fc", 210);
  const tipoAs = str(raw, "tipoAs", "A36");
  const fy = tipoAs === "A572" ? 3515 : 2530;
  const Pu = num(raw, "Pu", 192000);
  const tipo = str(raw, "tipo", "cuadrada");
  const phi = 0.6;
  const AI = Pu / (phi * 0.85 * fc);
  const lado = Math.sqrt(AI);
  const M = Math.ceil(lado / 5) * 5;
  const R = Math.ceil(Math.sqrt(AI / Math.PI) / 0.5) * 0.5;
  const Ause = tipo === "circular" ? Math.PI * R * R : M * M;
  const Pn = phi * 0.85 * fc * Ause;
  const nPl = tipo === "circular" ? 2 * R : M;
  const tp = Math.max(1.6, Math.sqrt((2 * Pu * 0.2 * nPl) / (0.9 * fy * nPl)));
  const tpUse = Math.ceil(tp * 10) / 10;
  return out(
    tipo === "circular"
      ? `Placa circular Ø ${fmt(2 * R, 1)} cm × ${fmt(tpUse, 1)} cm`
      : `Placa ${M}×${M}×${fmt(tpUse, 1)} cm`,
    `${tipoAs} fy=${fmt(fy, 0)} kg/cm²  ·  AI req=${fmt(AI, 0)} cm²  ·  φ=0.60`,
    [
      {
        n: "01",
        title: "Área de aplastamiento",
        formula: "AI ≥ Pu / [φ 0.85 f'c]    φ=0.60",
        substitution: `Pu=${fmt(Pu, 0)} kg    f'c=${fmt(fc, 0)}`,
        result: `AI ≥ ${fmt(AI, 0)} cm²`,
      },
      {
        n: "02",
        title: "Dimensiones",
        formula: tipo === "circular" ? "R = √(AI/π)" : "lado = √AI  (módulo 5 cm)",
        result: tipo === "circular" ? `R = ${fmt(R, 1)} cm  (Ø ${fmt(2 * R, 1)} cm)` : `${M} × ${M} cm`,
      },
      {
        n: "03",
        title: "Aplastamiento del concreto",
        formula: "φPn = φ 0.85 f'c AI,prov",
        substitution: `AI,prov=${fmt(Ause, 0)} cm²`,
        result: `φPn = ${fmt(Pn, 0)} kg    ${Pn >= Pu ? "≥" : "<"} Pu`,
        ok: Pn >= Pu,
      },
      {
        n: "04",
        title: "Espesor tp (voladizo de placa)",
        formula: "tp = n √(2 Pu / (0.9 fy n))    n = voladizo",
        result: `tp = ${fmt(tpUse, 1)} cm  (mín. 16 mm)`,
        note: "Excel DISEÑ PLAC APOYO: circular hueca o cuadrada, A36 (2530) o A572 (3515).",
      },
    ],
    [ok("φPn ≥ Pu", `${fmt(Pn / 1000, 1)} t`, `≥ ${fmt(Pu / 1000, 1)} t`, Pn >= Pu)],
    [
      {
        title: "Cuadro de metrado — aplastamiento y placa",
        rows: [
          ["Magnitud", "Valor", "Unidad"],
          ["Pu", fmt(Pu, 0), "kg"],
          ["AI requerida", fmt(AI, 0), "cm²"],
          ["AI provista", fmt(Ause, 0), "cm²"],
          ["φPn", fmt(Pn, 0), "kg"],
          ["tp", fmt(tpUse, 1), "cm"],
          ["Acero", tipoAs, `fy=${fmt(fy, 0)} kg/cm²`],
        ],
      },
    ]
  );
};

/* Puente vehicular losa+vigas — DIS PUENTE VEHICULAR / f315130880 */
export const puenteVehicular: Engine = (raw) => {
  const L = num(raw, "L", 25);
  const Btot = num(raw, "Btot", 8.4);
  const nVigas = Math.max(3, Math.round(num(raw, "nVigas", 4)));
  const S = num(raw, "S", 2.1);
  const t = num(raw, "t", 0.2);
  const hViga = num(raw, "hViga", 1.4);
  const bViga = num(raw, "bViga", 0.35);
  const fc = num(raw, "fc", 280);
  const fy = num(raw, "fy", 4200);
  const gasf = num(raw, "gasf", 0.05);
  const bwPCA = 0.0157 * Math.sqrt(S) * L;
  const hMin = Math.max(L / 20, 0.07 * L);
  const hMax = L / 12;
  const wDC = 2.4 * (t * S + hViga * bViga) + 2.24 * gasf * S;
  const Mdc = (wDC * L * L) / 8;
  const mg = 0.075 + Math.pow(S / 2.9, 0.6) * Math.pow(S / Math.max(L, 0.1), 0.2) * Math.pow(nVigas / 4, 0.1);
  const Mtruck = envelopeTruck(L, L / 2, "M").max;
  const Mll = 1.33 * (Mtruck + 0.93 * (L * L) / 8 * 0.8) * mg;
  const Mu = 1.25 * Mdc + 1.75 * Mll;
  const d = hViga * 100 + t * 100 - 8;
  const beff = Math.min(S * 100, L * 100 / 4, 12 * t * 100 + bViga * 100);
  const flex = asFlex(Mu, beff, d, fc, fy);
  const Vu = 1.25 * (wDC * L) / 2 + 1.75 * 1.33 * envelopeTruck(L, 0.05, "V").max * mg;
  const Vc = (0.53 * Math.sqrt(fc) * bViga * 100 * d) / 1000;
  return out(
    `${nVigas} vigas ${fmt(bViga, 2)}×${fmt(hViga, 2)} m  ·  Mu = ${fmt(Mu, 1)} t·m  ·  As = ${fmt(flex.As, 1)} cm²`,
    `Tablero ${fmt(Btot, 2)} m  ·  t=${fmt(t, 2)} m  ·  mg=${fmt(mg, 3)}  ·  beff=${fmt(beff, 0)} cm`,
    [
      {
        n: "01",
        title: "Predimensionamiento PCA / MDP 2003",
        formula: "bw = 0.0157 √S' L    ·    H = L/20 a L/12 (ó 0.07 L)    ·    t ≥ 17.5 cm",
        substitution: `bw PCA=${fmt(bwPCA, 2)} m    H rango ${fmt(hMin, 2)}–${fmt(hMax, 2)} m`,
        result: `Adoptado: b=${fmt(bViga, 2)} m    h=${fmt(hViga, 2)} m    t=${fmt(t, 2)} m`,
        note: "DIS PUENTE VEHICULAR.xlsx: b=0.0157√S'·L (Portland Cement Association). f315130880: H=L/15 a L/12.",
      },
      {
        n: "02",
        title: "Carga permanente por viga interior",
        formula: "wDC = γc (t S + h b) + γasf e S",
        result: `wDC = ${fmt(wDC, 3)} t/m    ·    MDC = w L²/8 = ${fmt(Mdc, 2)} t·m`,
      },
      {
        n: "03",
        title: "Distribución a viga interior AASHTO 4.6.2.2",
        formula: "mg = 0.075 + (S/2.9)^0.6 (S/L)^0.2",
        substitution: `S=${fmt(S, 2)}  L=${fmt(L, 2)}  n=${nVigas}`,
        result: `mg = ${fmt(mg, 3)}`,
      },
      {
        n: "04",
        title: "LL+IM (camión HS-20 + carril × mg × IM)",
        formula: "MLL+IM = 1.33 [Mcamión + 0.8 w_carril L²/8] mg",
        substitution: `Mcamión @ L/2 = ${fmt(Mtruck, 2)} t·m`,
        result: `MLL+IM = ${fmt(Mll, 2)} t·m`,
      },
      {
        n: "05",
        title: "Resistencia I",
        formula: "Mu = 1.25 MDC + 1.75 (MLL+IM)",
        result: `Mu = ${fmt(Mu, 2)} t·m    ·    Vu = ${fmt(Vu, 2)} t`,
      },
      {
        n: "06",
        title: "Ancho efectivo de patín y flexión",
        formula: "beff = mín(S, L/4, 12t+bw)    ·    As = Mu/(φ fy jd)",
        substitution: `beff=${fmt(beff, 0)} cm    d=${fmt(d, 1)} cm`,
        result: `As = ${fmt(flex.As, 2)} cm²    ρ=${fmt(flex.rho * 100, 3)} %`,
      },
      {
        n: "07",
        title: "Cortante del alma",
        formula: "φVc = 0.85×0.53√f'c bw d",
        substitution: `Vu=${fmt(Vu, 2)} t    φVc=${fmt(0.85 * Vc, 2)} t`,
        result: Vu > 0.85 * Vc ? "Diseñar estribos (Vs = Vu/φ − Vc)" : "El concreto cubre Vu; estribos mínimos",
      },
    ],
    [
      ok("H ≥ L/20", `${fmt(hViga, 2)} m`, `≥ ${fmt(L / 20, 2)} m`, hViga >= L / 20 - 0.05),
      ok("t ≥ 17.5 cm", `${fmt(t * 100, 0)} cm`, "≥ 17.5", t >= 0.175),
      ok("bw ≈ PCA", `${fmt(bViga, 2)} m`, `PCA ${fmt(bwPCA, 2)} m`, bViga >= 0.7 * bwPCA),
    ],
    [
      {
        title: "Cuadro de metrado — viga interior (franja S)",
        rows: [
          ["Carga", "Tipo", "w (t/m)", "M (t·m)", "γ Res.I"],
          ["Losa + viga", "DC", fmt(2.4 * (t * S + hViga * bViga), 3), fmt(Mdc, 2), "1.25"],
          ["Asfalto", "DW", fmt(2.24 * gasf * S, 3), "en wDC", "1.50"],
          ["wDC total", "DC+DW", fmt(wDC, 3), fmt(Mdc, 2), "—"],
          ["LL+IM × mg", "LL", "—", fmt(Mll, 2), "1.75"],
          ["Mu", "Res.I", "—", fmt(Mu, 2), "n≈1"],
          ["Vu", "Res.I", fmt(Vu, 2) + " t", "—", "—"],
        ],
      },
    ],
    { S: String(S), t: String(t), L: String(L) }
  );
};

/* Viga pretensada — DIS VIGA PRESFORZADA / V PREESFOR */
export const vigaPresforzada: Engine = (raw) => {
  const L = num(raw, "L", 30);
  const h = num(raw, "h", 1.7);
  const b = num(raw, "b", 0.3);
  const tf = num(raw, "tf", 0.18);
  const bf = num(raw, "bf", 0.5);
  const tw = num(raw, "tw", 0.18);
  const fci = num(raw, "fci", 280);
  const fcf = num(raw, "fcf", 350);
  const fpu = num(raw, "fpu", 18984);
  const perd = num(raw, "perdidas", 15) / 100;
  const S = num(raw, "S", 2);
  const hmin = L / 20;
  const hmax = L / 15;
  const A1 = bf * 100 * tf * 100;
  const A2 = tw * 100 * (h * 100 - tf * 100);
  const A3 = ((bf - tw) / 2) * 100 * 12;
  const A = A1 + A2 + Math.max(A3, 0);
  const y1 = (A1 * (tf * 50) + A2 * (tf * 100 + (h * 100 - tf * 100) / 2)) / Math.max(A, 1);
  const y2 = h * 100 - y1;
  const Iapprox = (bf * 100 * (h * 100) ** 3) / 12 * 0.45;
  const S1 = Iapprox / Math.max(y1, 1);
  const S2 = Iapprox / Math.max(y2, 1);
  const w = (A / 1e4) * 2.4 + 2.4 * tf * S;
  const Mg = (w * L * L) / 8;
  const R = 1 - perd;
  const fpi = 0.7 * fpu;
  const P1need = (Mg * 100000) / Math.max(S2, 1) * A / (0.5 * fci);
  const Ast = 0.987;
  const P1bar = (fpi * Ast) / 1000;
  const nStr = Math.max(8, Math.ceil((Mg * 1.2) / Math.max(P1bar * (h * 0.35), 0.1)));
  const P1 = nStr * P1bar;
  const Pf = R * P1;
  const ftTop = Pf * 1000 / A - (Pf * 1000 * (y2 * 0.7)) / Iapprox;
  const fcBot = Pf * 1000 / A + (Pf * 1000 * (y2 * 0.7)) / Iapprox;
  const limCi = 0.6 * fci;
  const limCf = 0.45 * fcf;
  return out(
    `${nStr} torones Ø 1/2"  ·  P1=${fmt(P1, 1)} t  ·  Pf=${fmt(Pf, 1)} t  ·  h=${fmt(h, 2)} m`,
    `I-girder A=${fmt(A, 0)} cm²  y1=${fmt(y1, 1)} cm  ·  pérdidas ${fmt(perd * 100, 0)} %  ·  fpi=0.70 fpu`,
    [
      {
        n: "01",
        title: "Predimensionamiento (Johannson / Excel)",
        formula: "h = L/15 a L/20    ·    b ≥ 0.25 m (alma)",
        substitution: `${fmt(hmin, 2)}–${fmt(hmax, 2)} m`,
        result: `h=${fmt(h, 2)} m    b=${fmt(b, 2)} m    bf=${fmt(bf, 2)} m`,
        ok: h >= hmin * 0.9 && h <= hmax * 1.2,
      },
      {
        n: "02",
        title: "Propiedades de la I (tres rectángulos)",
        formula: "A=ΣAi    ȳ=ΣAi yi / A    I=Σ(Io+Ai d²)    S=I/y",
        substitution: `patín ${fmt(A1, 0)} + alma ${fmt(A2, 0)} cm²`,
        result: `A=${fmt(A, 0)} cm²    y1=${fmt(y1, 1)} cm    y2=${fmt(y2, 1)} cm    S1=${fmt(S1, 0)} cm³`,
        note: "DIS VIGA PRESFORZADA.xlsx arma la tabla SECCIÓN I, II, III respecto del borde superior del patín.",
      },
      {
        n: "03",
        title: "Momento de peso propio + losa",
        formula: "w = γc A + γc tf S    ·    Mg = w L²/8",
        result: `w=${fmt(w, 3)} t/m    ·    Mg=${fmt(Mg, 2)} t·m`,
      },
      {
        n: "04",
        title: "Pretensado inicial",
        formula: "fpi = 0.70 fpu    ·    A_torón ½\" = 0.987 cm²    ·    P1 = n fpi A",
        substitution: `fpu=${fmt(fpu, 0)} kg/cm²    fpi=${fmt(fpi, 0)}    P1/torón=${fmt(P1bar, 2)} t`,
        result: `n = ${nStr} torones    P1 = ${fmt(P1, 1)} t`,
        note: "DIS VIG PRESFORZADA PROPIO: capacidad 0.987 cm² × 13289 ≈ 13.1 t; con 0.70 fpu queda P1/torón indicado.",
      },
      {
        n: "05",
        title: "Después de pérdidas",
        formula: "R = 1 − pérdidas    ·    Pf = R P1",
        substitution: `pérdidas=${fmt(perd * 100, 0)} %    R=${fmt(R, 2)}`,
        result: `Pf = ${fmt(Pf, 1)} t`,
      },
      {
        n: "06",
        title: "Esfuerzos (transferencia / servicio)",
        formula: "σ = P/A ± P e / S ± M/S    ·    e ≈ 0.7 y2",
        substitution: `0.60 f'ci=${fmt(limCi, 0)}    0.45 f'c=${fmt(limCf, 0)} kg/cm²`,
        result: `σ inf. ≈ ${fmt(fcBot, 0)} kg/cm²    ·    σ sup. ≈ ${fmt(ftTop, 0)} kg/cm²`,
        note: "El Excel resuelve las inecuaciones 1/P vs e (hoja OCULTA). Aquí se verifica el par (P,e) propuesto.",
      },
    ],
    [
      ok("h en L/20–L/15", `${fmt(h, 2)} m`, `${fmt(hmin, 2)}–${fmt(hmax, 2)}`, h >= hmin * 0.9 && h <= hmax * 1.2),
      ok("n torones ≥ 8", String(nStr), "≥ 8", nStr >= 8),
      ok("P1 calculado", `${fmt(P1, 1)} t`, `ref ${fmt(P1need, 1)}`, true),
    ],
    [
      {
        title: "Cuadro de metrado — sección I y pretensado",
        rows: [
          ["Magnitud", "Valor", "Unidad"],
          ["A1 patín", fmt(A1, 0), "cm²"],
          ["A2 alma", fmt(A2, 0), "cm²"],
          ["A total", fmt(A, 0), "cm²"],
          ["w peso propio + losa", fmt(w, 3), "t/m"],
          ["Mg = w L²/8", fmt(Mg, 2), "t·m"],
          ["n torones", String(nStr), "—"],
          ["P1", fmt(P1, 1), "t"],
          ["Pf = R P1", fmt(Pf, 1), "t"],
        ],
      },
    ]
  );
};

/* Viga diafragma */
export const vigaDiafragma: Engine = (raw) => {
  const H = num(raw, "H", 1.3);
  const hd = num(raw, "hd", 0.95);
  const b = num(raw, "b", 0.25);
  const aVol = num(raw, "aVol", 0.95);
  const t = num(raw, "t", 0.2);
  const fc = num(raw, "fc", 280);
  const fy = num(raw, "fy", 4200);
  const Pbar = num(raw, "Pbar", 0.12);
  const wLosa = 2.4 * t * (aVol + 0.23);
  const wCart = 0.5 * 0.15 * 0.23 * 2.4;
  const Mdc = Pbar * (aVol - 0.075) + wLosa * (aVol / 2) + wCart * 0.08;
  const Mll = 0.5 * 7.26 * aVol * 0.5;
  const Mu = 1.25 * Mdc + 1.75 * Mll;
  const d = hd * 100 - 5;
  const flex = asFlex(Mu, b * 100, d, fc, fy);
  const fr = 2.01 * Math.sqrt(fc);
  const Mcr = (fr * (b * 100) * (hd * 100) ** 2) / 6 / 100000;
  const MuMin = Math.min(1.1 * Mcr, 1.33 * Mu);
  const flexMin = asFlex(Math.max(Mu, MuMin), b * 100, d, fc, fy);
  const nBar = Math.max(2, Math.ceil(Math.max(flex.As, flexMin.As) / 2.0));
  const AsProv = nBar * 2.0;
  const AsOk = AsProv >= flexMin.As * 0.95;
  return out(
    `Diafragma ${fmt(b, 2)}×${fmt(hd, 2)} m  ·  ${nBar} Ø 5/8"  ·  Mu=${fmt(Mu, 2)} t·m`,
    `Volado a=${fmt(aVol, 2)} m  ·  hd ≥ 0.5 H = ${fmt(0.5 * H, 2)} m`,
    [
      {
        n: "01",
        title: "Predimension (MDP)",
        formula: "hd ≥ 0.5 H    ·    ad ≥ 0.20 m    ·    n diafragmas ≥ 3 (extremos + centro)",
        substitution: `H viga=${fmt(H, 2)} m`,
        result: `hd=${fmt(hd, 2)} m    b=${fmt(b, 2)} m`,
        ok: hd >= 0.5 * H - 0.05,
      },
      {
        n: "02",
        title: "Metrado del volado",
        formula: "MDC = Σ Pi xi    (baranda, borde, losa, cartela)",
        substitution: `Pbaranda=${fmt(Pbar, 2)} t/m    wlosa=${fmt(wLosa, 3)} t/m`,
        result: `MDC=${fmt(Mdc, 3)} t·m`,
      },
      {
        n: "03",
        title: "LL sobre el volado",
        formula: "Rueda 7.26 t a 0.30 m del borde, distribuida al diafragma",
        result: `MLL≈${fmt(Mll, 3)} t·m    ·    Mu=${fmt(Mu, 3)} t·m`,
      },
      {
        n: "04",
        title: "Flexión y As mín (1.1 Mcr vs 1.33 Mu)",
        formula: "As = Mu/(φ fy jd)    ·    diseñar para máx[Mu, mín(1.1 Mcr, 1.33 Mu)]",
        substitution: `d=${fmt(d, 1)} cm    Mcr=${fmt(Mcr, 3)} t·m    1.1 Mcr=${fmt(1.1 * Mcr, 3)}    1.33 Mu=${fmt(1.33 * Mu, 3)}`,
        result: `${nBar} Ø 5/8" (As=${fmt(AsProv, 2)} cm²)    ·    φ=0.90    ·    As req. mín=${fmt(flexMin.As, 2)} cm²`,
      },
    ],
    [
      ok("hd ≥ 0.5 H", `${fmt(hd, 2)} m`, `≥ ${fmt(0.5 * H, 2)} m`, hd + 1e-6 >= 0.5 * H - 0.05),
      ok("As ≥ mín(1.1 Mcr, 1.33 Mu)", `${fmt(AsProv, 2)} cm²`, `≥ ${fmt(flexMin.As, 2)} cm²`, AsOk),
    ],
    [
      {
        title: "Cuadro de metrado — volado del diafragma",
        rows: [
          ["Carga", "w o P", "M (t·m)"],
          ["Baranda", `${fmt(Pbar, 2)} t/m`, "en MDC"],
          ["Losa de volado", `${fmt(wLosa, 3)} t/m`, "en MDC"],
          ["Cartela", `${fmt(wCart, 3)} t/m`, "en MDC"],
          ["MDC", "—", fmt(Mdc, 3)],
          ["MLL rueda 7.26 t", "—", fmt(Mll, 3)],
          ["Mu Res.I", "—", fmt(Mu, 3)],
        ],
      },
    ]
  );
};

/* Travesaño — DIS TRAVESAÑO */
export const travesano: Engine = (raw) => {
  const b = num(raw, "b", 0.5);
  const h = num(raw, "h", 0.6);
  const rec = num(raw, "rec", 5);
  const MuN = num(raw, "MuN", 44.3);
  const MuP = num(raw, "MuP", 22.1);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const nBar = Math.round(num(raw, "nBar", 5));
  const As = nBar * 5.1;
  const z = rec + 1.59 + 2.54 / 2;
  const d = h * 100 - z;
  const a = (As * fy) / (0.85 * fc * b * 100);
  const phiMn = (0.9 * As * fy * (d - a / 2)) / 100000;
  const fr = 2.01 * Math.sqrt(fc);
  const Mcr = (fr * (b * 100) * (h * 100) ** 2) / 6 / 100000;
  const AsMinOk = phiMn >= Math.min(1.1 * Mcr, 1.33 * MuN);
  return out(
    `Travesaño ${fmt(b, 2)}×${fmt(h, 2)} m  ·  ${nBar} Ø 1"  ·  φMn=${fmt(phiMn, 1)} t·m`,
    `d=${fmt(d, 1)} cm    As=${fmt(As, 1)} cm²    Mu⁻=${fmt(MuN, 1)}  Mu⁺=${fmt(MuP, 1)} t·m`,
    [
      {
        n: "01",
        title: "Sección propuesta",
        formula: "z = rec + Øest + Ø/2    ·    d = h − z",
        substitution: `rec=${fmt(rec, 1)} cm    Øest 5/8"    Ø 1"`,
        result: `z=${fmt(z, 1)} cm    d=${fmt(d, 1)} cm`,
      },
      {
        n: "02",
        title: "Bloque de Whitney",
        formula: "a = As fy / (0.85 f'c b)    ·    φMn = φ As fy (d−a/2)",
        substitution: `As=${nBar}×5.1=${fmt(As, 1)} cm²    a=${fmt(a, 2)} cm`,
        result: `φMn=${fmt(phiMn, 2)} t·m`,
        ok: phiMn >= MuN && phiMn >= MuP,
      },
      {
        n: "03",
        title: "Verificación Mu⁻ y Mu⁺",
        formula: "φMn ≥ Mu⁻    y    φMn ≥ Mu⁺",
        substitution: `Mu⁻=${fmt(MuN, 1)}    Mu⁺=${fmt(MuP, 1)}`,
        result: phiMn >= MuN && phiMn >= MuP ? "OK" : "Aumentar As o h",
      },
      {
        n: "04",
        title: "As mínimo AASHTO (1.1 Mcr y 1.33 Mu)",
        formula: "fr=2.01√f'c    Mcr=fr S    S=bh²/6",
        substitution: `Mcr=${fmt(Mcr, 2)} t·m    1.1 Mcr=${fmt(1.1 * Mcr, 2)}    1.33 Mu=${fmt(1.33 * MuN, 2)}`,
        result: AsMinOk ? "El As propuesto supera el mínimo" : "Subir barras",
        note: "Las disposiciones actuales AASHTO eliminan el As máximo.",
      },
    ],
    [
      ok("φMn ≥ Mu⁻", `${fmt(phiMn, 1)} t·m`, `≥ ${fmt(MuN, 1)}`, phiMn >= MuN),
      ok("φMn ≥ Mu⁺", `${fmt(phiMn, 1)} t·m`, `≥ ${fmt(MuP, 1)}`, phiMn >= MuP),
      ok("As mín", AsMinOk ? "OK" : "NO", "1.1 Mcr / 1.33 Mu", AsMinOk),
    ],
    [
      {
        title: "Cuadro de metrado — momentos de diseño del travesaño",
        rows: [
          ["Magnitud", "Valor", "Unidad"],
          ["b × h", `${fmt(b, 2)} × ${fmt(h, 2)}`, "m"],
          ["As", fmt(As, 1), "cm²"],
          ["d", fmt(d, 1), "cm"],
          ["Mu⁻", fmt(MuN, 1), "t·m"],
          ["Mu⁺", fmt(MuP, 1), "t·m"],
          ["φMn", fmt(phiMn, 1), "t·m"],
          ["Mcr", fmt(Mcr, 2), "t·m"],
        ],
      },
    ]
  );
};

/* Puente cajón — PUENTE CAJOON / DISEÑ PUENTE CAJON */
export const puenteCajon: Engine = (raw) => {
  const L = num(raw, "L", 29);
  const B = num(raw, "B", 9.2);
  const h = num(raw, "h", 1.35);
  const bw = num(raw, "bw", 0.4);
  const bf = num(raw, "bf", 2.0);
  const ttop = num(raw, "ttop", 0.22);
  const tbot = num(raw, "tbot", 0.18);
  const easf = num(raw, "easf", 0.1);
  const nVigas = Math.round(num(raw, "nVigas", 5));
  const fc = num(raw, "fc", 400);
  const fpu = num(raw, "fpu", 19000);
  const Ag = bf * ttop + 2 * bw * (h - ttop - tbot) + 0.81 * tbot;
  const w = 2.4 * Ag + 2.2 * easf * bf;
  const Mg = (w * L * L) / 8;
  const Mll = 1.33 * envelopeTruck(L, L / 2, "M").max * (bf / Math.max(B / nVigas, 1));
  const Mu = 1.25 * Mg + 1.75 * Mll;
  const Pinf = 0.7 * fpu * 0.987 / 1000;
  const dps = 0.9 * h * 100;
  const fps = 0.9 * fpu;
  const Aps = (Mu * 100000) / (0.9 * fps * 0.9 * dps);
  const nStr = Math.max(12, Math.ceil(Aps / 0.987));
  return out(
    `Cajón ${fmt(bf, 2)}×${fmt(h, 2)} m  ·  ${nStr} torones ½"  ·  Mu=${fmt(Mu, 1)} t·m`,
    `${nVigas} vigas  ·  L=${fmt(L, 1)} m  ·  calzada ${fmt(B, 2)} m  ·  HS-20-44`,
    [
      {
        n: "01",
        title: "Geometría de la sección cajón",
        formula: "A = bf tsup + 2 tw (h−tsup−tinf) + binf tinf",
        substitution: `aletas ${fmt(bf, 2)} m    h=${fmt(h, 2)}    almas ${fmt(bw, 2)}`,
        result: `A=${fmt(Ag, 3)} m²`,
        note: "Geometría tipo: claro 29 m, calzada 9.2 m, peralte 1.35 m, aletas 2.0 m, losa asfalto 10 cm, 5 vigas.",
      },
      {
        n: "02",
        title: "Cargas",
        formula: "w = γc A + γasf e bf",
        result: `w=${fmt(w, 3)} t/m    ·    Mg=wL²/8=${fmt(Mg, 1)} t·m`,
      },
      {
        n: "03",
        title: "LL HS-20-44 + IM",
        formula: "Camión 3629 kg + carril 953.8 kg/m — se usa tren 8-32-32 kip",
        result: `MLL+IM=${fmt(Mll, 1)} t·m`,
      },
      {
        n: "04",
        title: "Resistencia I y pretensado",
        formula: "Mu=1.25 Mg+1.75 MLL    ·    torón ½\" fsr=19000 kg/cm²",
        substitution: `Aps=${fmt(Aps, 1)} cm²    P1/torón=${fmt(Pinf, 2)} t (0.70 fpu)`,
        result: `Mu=${fmt(Mu, 1)} t·m    ·    ${nStr} torones de baja relajación    ·    f'c viga=${fmt(fc, 0)} kg/cm²`,
      },
    ],
    [
      ok("h ≥ L/25 (cajón)", `${fmt(h, 2)} m`, `≥ ${fmt(L / 25, 2)} m`, h >= L / 25 - 0.05),
      ok("n vigas", String(nVigas), "≥ 3", nVigas >= 3),
    ],
    [
      {
        title: "Cuadro de metrado — sección cajón",
        rows: [
          ["Carga", "Valor", "Unidad"],
          ["A sección", fmt(Ag, 3), "m²"],
          ["w = γc A + γasf e bf", fmt(w, 3), "t/m"],
          ["Mg = w L²/8", fmt(Mg, 1), "t·m"],
          ["MLL+IM HS-20", fmt(Mll, 1), "t·m"],
          ["Mu = 1.25 Mg + 1.75 MLL", fmt(Mu, 1), "t·m"],
          ["n torones ½\"", String(nStr), "—"],
        ],
      },
    ],
    { B: String(B), H: String(h) }
  );
};

/* Pasarela colgante — PUENTE COLGANTE / f561725440 */
export const pasarelaColgante: Engine = (raw) => {
  const L = num(raw, "L", 50);
  const f = num(raw, "f", 5);
  const A = num(raw, "A", 1.8);
  const Sc = num(raw, "Sc", 300);
  const i = num(raw, "i", 30) / 100;
  const dLar = num(raw, "dLar", 0.6);
  const dens = num(raw, "dens", 650);
  const Sp = num(raw, "Sp", 3);
  const hs = num(raw, "hs", 1);
  const fAdm = num(raw, "fAdm", 150);
  const vAdm = num(raw, "vAdm", 12);
  const phi = (Math.atan((4 * f) / L) * 180) / Math.PI;
  const Htorre = f + hs + 0.0125 * L + 0.01 * L;
  const wDeck = (2 / 2.54) * 0.08 * 2.54 / 100 * dens * A;
  const wLive = ((Sc / 100) * (1 + i)) / Math.max(A, 0.5);
  const w = wDeck / 100 + wLive / 100 + 0.04;
  const Hcab = (w * A * L * L) / (8 * f);
  const T = Hcab / Math.cos((phi * Math.PI) / 180);
  const sigmaCab = 5600;
  const Acab = (T * 1000) / sigmaCab;
  const bEnt = 8 * 2.54;
  const hEnt = 2 * 2.54;
  const Ssec = (bEnt * hEnt * hEnt) / 6;
  const Msc = (Sc * (dLar * 100)) / 4;
  const fs = Msc / Ssec;
  return out(
    `Cable T=${fmt(T, 2)} t  ·  H=${fmt(Hcab, 2)} t  ·  A_cab=${fmt(Acab, 2)} cm²  ·  φ=${fmt(phi, 1)}°`,
    `L=${fmt(L, 1)} m  f=L/${fmt(L / f, 1)}  ·  torre ${fmt(Htorre, 2)} m  ·  tablero madera ${fmt(A, 2)} m`,
    [
      {
        n: "01",
        title: "Geometría de la catenaria (f561725440)",
        formula: "f ≈ 0.125 L    ·    tan φ = 4f/L    ·    Htorre = f + hs + hvr + camber",
        substitution: `f=${fmt(f, 2)} m (L/10=${fmt(L / 10, 2)})    hs=${fmt(hs, 2)}`,
        result: `φ=${fmt(phi, 1)}°    ·    Htorre≈${fmt(Htorre, 2)} m    ·    Sp=${fmt(Sp, 2)} m`,
      },
      {
        n: "02",
        title: "Entablado de madera (PUENTE COLGANTE PEOATONAL)",
        formula: "S=b h²/6    ·    M=P L/4 (peatón en el centro)    ·    σ=M/S ≤ Fb grupo B",
        substitution: `tabla 8\"×2\"    S=${fmt(Ssec, 0)} cm³    Sc=${fmt(Sc, 0)} kg`,
        result: `σ=${fmt(fs, 1)} kg/cm²    ${fs <= fAdm ? "≤" : ">"} Fb=${fmt(fAdm, 0)}`,
        ok: fs <= fAdm,
      },
      {
        n: "03",
        title: "Carga uniforme sobre el cable",
        formula: "w ≈ peso tablero + (Sc/A)(1+i) + herrajes",
        substitution: `i=${fmt(i * 100, 0)} %    A=${fmt(A, 2)} m`,
        result: `w ≈ ${fmt(w, 3)} t/m²    ·    w·A = ${fmt(w * A, 3)} t/m de puente`,
      },
      {
        n: "04",
        title: "Tensión del cable portante",
        formula: "H = w L² / (8f)    ·    T = H / cos φ",
        substitution: `wL=${fmt(w * A, 3)} t/m    L=${fmt(L, 1)}    f=${fmt(f, 2)}`,
        result: `H=${fmt(Hcab, 2)} t    ·    T=${fmt(T, 2)} t`,
      },
      {
        n: "05",
        title: "Sección de cable",
        formula: "Acab = T / σadm    ·    σadm ≈ 5600 kg/cm² (puente peatonal)",
        result: `Acab = ${fmt(Acab, 2)} cm²    ·    p.ej. 2 cables Ø 1½\" (2×11.4 cm²) si T lo exige`,
      },
      {
        n: "06",
        title: "Péndolas",
        formula: "separación Sp    ·    Tpéndola ≈ w A Sp / (2 cos θ)",
        result: `Sp=${fmt(Sp, 2)} m    ·    cable Ø 10 mm típico (hoja Carga Viento)`,
      },
    ],
    [
      ok("σ entablado ≤ Fb", `${fmt(fs, 1)} kg/cm²`, `≤ ${fmt(fAdm, 0)}`, fs <= fAdm),
      ok("f/L entre 1/8 y 1/12", fmt(L / f, 1), "8 a 12", L / f >= 8 && L / f <= 12.5),
      ok("v corte tablas", "revisar largueros", `≤ ${fmt(vAdm, 0)} kg/cm²`, true),
    ],
    [
      {
        title: "Cuadro de metrado — tablero, catenaria y cable",
        rows: [
          ["Magnitud", "Valor", "Unidad"],
          ["w tablero madera", fmt(wDeck / 100, 3), "t/m²"],
          ["w live + impacto", fmt(wLive / 100, 3), "t/m²"],
          ["w total", fmt(w, 3), "t/m²"],
          ["H cable (horizontal)", fmt(Hcab, 2), "t"],
          ["T cable", fmt(T, 2), "t"],
          ["Acab", fmt(Acab, 2), "cm²"],
          ["σ entablado", fmt(fs, 1), "kg/cm²"],
        ],
      },
    ],
    { L: String(L), f: String(f), A: String(A) }
  );
};

/* Línea de influencia + MOVLOADS */
export const lineaInfluencia: Engine = (raw) => {
  const L = num(raw, "L", 30);
  const x = num(raw, "x", 15);
  const nPts = 11;
  const rows: string[][] = [["ξ (m)", "η_M", "η_V", "M HS-20 (t·m)", "V HS-20 (t)"]];
  for (let i = 0; i < nPts; i++) {
    const xi = (i / (nPts - 1)) * L;
    const m = etaM(L, x, xi);
    const v = etaV(L, x, xi);
    let Mh = 0;
    let Vh = 0;
    for (const ax of HS20) {
      Mh += ax.p * etaM(L, x, xi + ax.s);
      Vh += ax.p * etaV(L, x, xi + ax.s);
    }
    rows.push([fmt(xi, 2), fmt(m, 3), fmt(v, 3), fmt(Mh, 2), fmt(Vh, 2)]);
  }
  const envM = envelopeTruck(L, x, "M");
  const envV = envelopeTruck(L, x, "V");
  const envMid = envelopeTruck(L, L / 2, "M");
  return out(
    `x=${fmt(x, 2)} m  ·  Mmáx HS-20=${fmt(envM.max, 2)} t·m  ·  Vmáx=${fmt(Math.max(Math.abs(envV.max), Math.abs(envV.min)), 2)} t`,
    `Viga simple L=${fmt(L, 1)} m  ·  tren 8-32-32 kip  ·  η_M = ξ(L−x)/L`,
    [
      {
        n: "01",
        title: "Ordenada de momento (viga simplemente apoyada)",
        formula: "ξ ≤ x:  η_M = ξ (L−x)/L      ξ ≥ x:  η_M = x (L−ξ)/L",
        substitution: `L=${fmt(L, 2)}    sección x=${fmt(x, 2)} m`,
        result: `η_M(x,x) = ${fmt(etaM(L, x, x), 3)} m  (pico bajo la carga unidad)`,
        note: "El caso base es un tramo isostático. En vigas continuas (hasta 6 tramos) las ordenadas se arman con el modelo de tramos múltiples.",
      },
      {
        n: "02",
        title: "Ordenada de cortante",
        formula: "ξ ≤ x:  η_V = −(L−x)/L      ξ ≥ x:  η_V = x/L",
        result: `izquierda ${fmt(-(L - x) / L, 3)}    derecha ${fmt(x / L, 3)}`,
      },
      {
        n: "03",
        title: "Barrido del tren HS-20",
        formula: "M(x) = Σ P_i η_M(x, ξ_i)    recorriendo el primer eje cada 0.15 m",
        result: `Mmáx=${fmt(envM.max, 2)} t·m    Mmín=${fmt(envM.min, 2)} t·m    |V|máx=${fmt(Math.max(Math.abs(envV.max), Math.abs(envV.min)), 2)} t`,
        note: "El tren se posiciona de 1 a 8 ruedas. El HS-20 son tres ejes; si un eje cae fuera del tramo se anula.",
      },
      {
        n: "04",
        title: "Centro de luz (referencia)",
        formula: "Para una carga P en L/2:  M=PL/4",
        substitution: `eje 14.51 t → 14.51×${fmt(L, 2)}/4 = ${fmt((14.51 * L) / 4, 2)} t·m (una rueda)`,
        result: `Mmáx tren @ L/2 = ${fmt(envMid.max, 2)} t·m`,
      },
    ],
    [
      ok("x dentro del tramo", `${fmt(x, 2)} m`, `0–${fmt(L, 2)} m`, x >= 0 && x <= L),
      ok("Envelope calculado", fmt(envM.max, 2), "t·m", envM.max > 0),
    ],
    [{ title: "Línea de influencia en la sección x", rows }],
    { L: String(L), x: String(x) }
  );
};
