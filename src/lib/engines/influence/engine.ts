import { type CalcCheck, type CalcOutput, type Engine, fmt, num, str } from "../../types";
import {
  dualAxles,
  dualHs20,
  FLEET,
  fleetById,
  HS20_AXLES,
  multipleAxles,
  specialAxles,
  TANDEM_AXLES,
  W_LANE,
  type Axle,
} from "./vehicles";
import {
  buildInfluence,
  buildUnitField,
  combAlong,
  envelopeAlong,
  envelopeTrain,
  evalTrain,
  forceAlong,
  laneAlong,
  laneBreakdown,
  laneOnIL,
  mergeAlong,
  packXY,
  parseBeam,
  peakAlong,
  scaleAlong,
  emptyAlong,
  type Envelope,
} from "./solver";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>,
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}
function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

function mLane(nCarr: number) {
  if (nCarr <= 1) return 1.2;
  if (nCarr === 2) return 1;
  if (nCarr === 3) return 0.85;
  return 0.65;
}

function axlesOf(id: string, raw: Record<string, string>): Axle[] {
  if (id === "especial") return specialAxles(raw);
  if (id === "multiple") return multipleAxles(num(raw, "gapMult", 15));
  if (id === "hs20" || id === "hl93") return HS20_AXLES;
  if (id === "tandem") return TANDEM_AXLES;
  if (id === "puntual") return [{ p: num(raw, "P", 10), s: 0 }];
  if (id === "carril") return [];
  return fleetById(id).axles;
}

function kindOf(efecto: string, lado: string): "M" | "VL" | "VR" | "R" {
  if (efecto === "R") return "R";
  if (efecto === "V") return lado === "der" ? "VR" : "VL";
  return "M";
}

function unitOf(efecto: string) {
  return efecto === "M" ? "t·m" : "t";
}

function comb(env: Envelope, lane: { pos: number; neg: number }, im: number, withLane: boolean) {
  const f = 1 + im;
  const max = f * env.max + (withLane ? lane.pos : 0);
  const min = f * env.min + (withLane ? lane.neg : 0);
  return { max, min, sMax: env.sMax, sMin: env.sMin };
}

export const lineaInfluencia: Engine = (raw) => {
  const model = parseBeam(raw);
  const Ltot = model.spans.reduce((a, b) => a + b, 0);
  const x = Math.min(Ltot, Math.max(0, num(raw, "x", Ltot / 2)));
  const nAp = model.spans.length + 1;
  const efecto = str(raw, "efecto", "M") || "M";
  const flota = str(raw, "flota", "hl93") || "hl93";
  const nCarr = Math.max(1, Math.min(4, Math.round(num(raw, "nCarr", 1))));
  const combinar = str(raw, "combinar", "servicio") || "servicio";
  const IM = (combinar === "fatiga" ? 15 : num(raw, "IM", 33)) / 100;
  const wLane = num(raw, "wLane", W_LANE);
  const apoyoR = Math.max(1, Math.min(nAp, Math.round(num(raw, "apoyoR", 1)))) - 1;
  const m = combinar === "fatiga" ? 1 : mLane(nCarr);
  const gamma = combinar === "resistencia1" ? 1.75 : 1;
  const inf = buildInfluence(model, x);
  const field = buildUnitField(model);
  const k = kindOf(efecto, "izq");
  const item = fleetById(flota);
  const axles = axlesOf(flota, raw);
  const gap = Math.max(4, num(raw, "gapMult", 15));
  const nVehRaw = str(raw, "nVeh", "auto") || "auto";
  const twoVeh = nVehRaw === "2" || (nVehRaw !== "1" && model.spans.length > 1);
  const axles2 = axles.length ? dualAxles(axles, Math.max(15, gap)) : dualHs20(gap);
  const useLane = flota === "hl93" || flota === "carril";
  const imTrain = flota === "carril" || flota === "puntual" ? 0 : IM;

  const envM = envelopeTrain(inf, axles.length ? axles : HS20_AXLES, "M");
  const envVL = envelopeTrain(inf, axles.length ? axles : HS20_AXLES, "VL");
  const envVR = envelopeTrain(inf, axles.length ? axles : HS20_AXLES, "VR");
  const envR = envelopeTrain(inf, axles.length ? axles : HS20_AXLES, "R", apoyoR);
  const envTandem = envelopeTrain(inf, TANDEM_AXLES, k === "R" ? "R" : k, apoyoR);
  const laneM = laneOnIL(inf, wLane, "M");
  const laneV = laneOnIL(inf, wLane, k === "VR" ? "VR" : "VL");
  const laneR = laneOnIL(inf, wLane, "R", apoyoR);
  const laneSel = efecto === "M" ? laneM : efecto === "R" ? laneR : laneV;
  const envSel = efecto === "M" ? envM : efecto === "R" ? envR : Math.abs(envVL.max) > Math.abs(envVR.max) ? envVL : envVR;

  const truckLL = comb(envSel, laneSel, imTrain, flota === "hl93");
  const tandemLL = comb(envTandem, laneSel, IM, true);
  const dual = envelopeTrain(inf, flota === "hl93" || flota === "hs20" ? dualHs20(gap) : axles2, k === "R" ? "R" : k, apoyoR);
  const dualLL = {
    max: 0.9 * (1 + IM) * dual.max + 0.9 * laneSel.pos,
    min: 0.9 * (1 + IM) * dual.min + 0.9 * laneSel.neg,
  };

  let govMax = truckLL.max;
  let govMin = truckLL.min;
  let govName = item.label;
  if (flota === "hl93") {
    const cand = [
      { n: "camión+carril", max: truckLL.max, min: truckLL.min },
      { n: "tándem+carril", max: tandemLL.max, min: tandemLL.min },
    ];
    if (twoVeh) cand.push({ n: "0.90×dos camiones+carril (3.6.1.3.1)", max: dualLL.max, min: dualLL.min });
    govMax = Math.max(...cand.map((c) => c.max));
    govMin = Math.min(...cand.map((c) => c.min));
    govName = cand.find((c) => c.max === govMax)?.n || "HL-93";
  } else if (flota === "carril") {
    govMax = laneSel.pos;
    govMin = laneSel.neg;
  } else if (twoVeh && axles.length) {
    const d = comb(dual, laneSel, imTrain, false);
    if (d.max > govMax) {
      govMax = d.max;
      govName = `2× ${item.label.split("·")[0].trim()}`;
    }
    if (d.min < govMin) govMin = d.min;
  }

  const Mll = m * govMax;
  const MllMin = m * govMin;
  const Mu = gamma * Mll;
  const MuMin = gamma * MllMin;

  const laneF = laneAlong(field, wLane);
  const env1A = envelopeAlong(field, axles.length ? axles : HS20_AXLES);
  const envTandA = envelopeAlong(field, TANDEM_AXLES);
  const env2A = envelopeAlong(field, axles.length ? axles2 : dualHs20(gap));
  let selA = combAlong(env1A, laneF, imTrain, useLane);
  if (flota === "hl93") selA = mergeAlong(selA, combAlong(envTandA, laneF, IM, true));
  if (twoVeh) {
    const k90 = flota === "hl93" || flota === "hs20" ? 0.9 : 1;
    selA = mergeAlong(selA, combAlong(env2A, laneF, imTrain, useLane, k90));
  }
  if (flota === "carril") selA = combAlong(emptyAlong(field.xs), laneF, 0, true);
  selA = scaleAlong(selA, m * gamma);

  let allA = selA;
  for (const f of FLEET) {
    if (!f.axles.length) continue;
    const e = combAlong(envelopeAlong(field, f.axles), laneF, f.id === "puntual" ? 0 : IM, false);
    allA = mergeAlong(allA, scaleAlong(e, m * gamma));
  }
  if (twoVeh) {
    const k90 = 0.9;
    allA = mergeAlong(allA, scaleAlong(combAlong(envelopeAlong(field, dualHs20(gap)), laneF, IM, useLane, k90), m * gamma));
  }

  const pk = peakAlong(selA);
  const pkAll = peakAlong(allA);
  const peakM = inf.etaM.reduce((a, v, i) => (Math.abs(v) > Math.abs(inf.etaM[a]) ? i : a), 0);
  const peakV = inf.etaVL.reduce((a, v, i) => (Math.abs(v) > Math.abs(inf.etaVL[a]) ? i : a), 0);
  const u = unitOf(efecto);
  const izqLab = model.izq === "empotrado" ? "empotrado" : model.izq === "libre" ? "libre" : "simple";
  const derLab = model.der === "empotrado" ? "empotrado" : model.der === "libre" ? "libre" : "simple";
  const spanTxt = model.spans.map((L, i) => `L${i + 1}=${fmt(L, 2)}`).join(" + ");
  const restV = (model.izq === "libre" ? 0 : 1) + (model.der === "libre" ? 0 : 1) + Math.max(0, nAp - 2);
  const restTh = (model.izq === "empotrado" ? 1 : 0) + (model.der === "empotrado" ? 1 : 0);
  const nDof = nAp * 2 - restV - restTh;

  const ilRows: string[][] = [["ξ (m)", "η_M (m)", "η_V izq", "η_V der"]];
  const skip = Math.max(1, Math.floor(inf.xi.length / 16));
  for (let i = 0; i < inf.xi.length; i += skip) {
    ilRows.push([fmt(inf.xi[i], 2), fmt(inf.etaM[i], 3), fmt(inf.etaVL[i], 3), fmt(inf.etaVR[i], 3)]);
  }

  const axleRows: string[][] = [["Eje", "P (t)", "s desde 1º (m)"]];
  axles.forEach((a, i) => axleRows.push([String(i + 1), fmt(a.p, 2), fmt(a.s, 2)]));
  if (!axles.length) axleRows.push(["—", "carril", "—"]);

  const cmpRows: string[][] = [["Tren", "W (t)", `máx ${u}`, `mín ${u}`]];
  for (const f of FLEET) {
    if (!f.axles.length && f.id !== "carril") continue;
    const ax = f.id === "carril" ? [] : f.axles;
    const e = ax.length ? envelopeTrain(inf, ax, k === "R" ? "R" : k, apoyoR) : { max: laneSel.pos, min: laneSel.neg, sMax: 0, sMin: 0 };
    const imF = f.id === "carril" || f.id === "puntual" ? 0 : IM;
    cmpRows.push([f.label.split("·")[0].trim(), fmt(f.W || (f.id === "carril" ? wLane : 0), 1), fmt((1 + imF) * e.max, 2), fmt((1 + imF) * e.min, 2)]);
  }

  const sCrit = twoVeh ? (Math.abs(dual.max) > Math.abs(envSel.max) ? dual.sMax : envSel.sMax) : envSel.sMax;
  const sRaw = String(raw.s0 ?? "").trim().replace(",", ".");
  const sManual = sRaw !== "" && Number.isFinite(Number(sRaw));
  const s0 = sManual ? Number(sRaw) : sCrit;
  const axleUse = twoVeh && axles.length ? axles2 : axles.length ? axles : HS20_AXLES;
  const nAx1 = (axles.length ? axles : HS20_AXLES).length;
  const axlePos = axleUse
    .map((a, i) => `${(s0 + a.s).toFixed(3)},${a.p.toFixed(2)},${twoVeh && i >= nAx1 ? 2 : 1}`)
    .join(";");
  const inst = forceAlong(field, axleUse, s0);
  const eM = evalTrain(inf, axleUse, s0, "M");
  const eVL = evalTrain(inf, axleUse, s0, "VL");
  const eVR = evalTrain(inf, axleUse, s0, "VR");
  const eV = Math.abs(eVL.v) >= Math.abs(eVR.v) ? eVL : eVR;
  const laneBr = laneBreakdown(inf, k === "R" ? "R" : k, wLane, apoyoR);
  const simple = model.spans.length === 1 && model.izq === "simple" && model.der === "simple";
  const closedEta = simple ? (x * (Ltot - x)) / Ltot : inf.etaM[peakM];
  const closedAM = simple ? (x * (Ltot - x)) / 2 : laneBr.Apos;
  const closedAVpos = simple ? ((Ltot - x) * (Ltot - x)) / (2 * Ltot) : Math.max(0, laneBr.Apos);
  const closedAVneg = simple ? -(x * x) / (2 * Ltot) : Math.min(0, laneBr.Aneg);
  const dEtaM_left = simple ? (Ltot - x) / Ltot : NaN;
  const dEtaM_right = simple ? -x / Ltot : NaN;
  const etaV_left_at_x = simple ? -x / Ltot : inf.etaVL[peakV];
  const etaV_right_at_x = simple ? (Ltot - x) / Ltot : inf.etaVR[peakV];
  const trap0 = laneBr.segs[0];
  const trap0Txt = trap0 && Math.abs(trap0.etaA) + Math.abs(trap0.etaB) > 0.02
    ? ` Primer tramo: A = ½(η_a+η_b)(ξ_b−ξ_a) = ½(${fmt(trap0.etaA, 4)}+${fmt(trap0.etaB, 4)})(${fmt(trap0.b, 3)}−${fmt(trap0.a, 3)}) = ${fmt(trap0.area, 4)} m².`
    : "";
  const envSkip = Math.max(1, Math.floor(selA.xs.length / 14));
  const envRows: string[][] = [["x (m)", "M+ (t·m)", "M− (t·m)", "V+ (t)", "V− (t)", "M+ tot", "M− tot"]];
  for (let i = 0; i < selA.xs.length; i += envSkip) {
    envRows.push([
      fmt(selA.xs[i], 2),
      fmt(selA.Mmax[i], 2),
      fmt(selA.Mmin[i], 2),
      fmt(selA.Vmax[i], 2),
      fmt(selA.Vmin[i], 2),
      fmt(allA.Mmax[i], 2),
      fmt(allA.Mmin[i], 2),
    ]);
  }

  const trainRows: string[][] = [["Eje", "P (t)", "ξ_i (m)", "η_M", "P·η_M (t·m)", "η_V", "P·η_V (t)"]];
  eM.rows.forEach((r, i) => {
    const vr = eV.rows[i];
    trainRows.push([String(r.i), fmt(r.p, 2), fmt(r.xi, 2), fmt(r.eta, 4), fmt(r.contrib, 2), fmt(vr?.eta ?? 0, 4), fmt(vr?.contrib ?? 0, 2)]);
  });
  if (eM.rows.length) {
    trainRows.push(["Σ", fmt(axleUse.reduce((a, z) => a + z.p, 0), 2), `s₀=${fmt(s0, 2)}`, "—", fmt(eM.v, 2), "—", fmt(eV.v, 2)]);
  }

  const laneRows: string[][] = [["Zona", "ξ_a (m)", "ξ_b (m)", "η_a", "η_b", "A = ∫η dξ", "w·A"]];
  laneBr.segs.forEach((sg, i) => {
    laneRows.push([
      `${sg.sign}${i + 1}`,
      fmt(sg.a, 2),
      fmt(sg.b, 2),
      fmt(sg.etaA, 3),
      fmt(sg.etaB, 3),
      fmt(sg.area, 4),
      fmt(wLane * sg.area, 3),
    ]);
  });
  if (!laneBr.segs.length) laneRows.push(["—", "0", fmt(Ltot, 2), "0", "0", "0", "0"]);

  const ds = Math.min(0.2, Math.max(0.08, Ltot / 200));

  const steps: CalcOutput["steps"] = [
    {
      n: "01",
      title: "Modelo de la viga",
      formula: "nudos = n apoyos    ·    tramos L_i    ·    apoyos interiores simples    ·    extremos simple / empotrado / libre",
      formulaTex: String.raw`n_{\text{apoyos}}=${nAp}\quad n_{\text{tramos}}=${model.spans.length}\quad \text{izq: ${izqLab}}\quad \text{der: ${derLab}}`,
      substitution: `${spanTxt}    ·    L = ${fmt(Ltot, 2)} m    ·    sección de estudio x = ${fmt(x, 2)} m`,
      result: `${nAp} apoyos · ${model.spans.length} tramo(s) · ${nDof} GDL libres (método de rigideces, EI relativo constante)`,
      note: "Apoyos interiores: v = 0, θ libre (continúa sobre pilas). Empotrado: v = θ = 0. Libre: voladizo. Convención: v hacia abajo, θ horario, M > 0 tracción inferior.",
    },
    {
      n: "02",
      title: "Línea de influencia de momento — Müller-Breslau",
      formula: "η_M(x,ξ) = M(x) por P = 1 t en ξ. Viga simple: dos rectas que forman un triángulo. Continua: rigideces.",
      formulaTex: simple
        ? String.raw`R_A=\dfrac{L-\xi}{L}\qquad\eta_M=\begin{cases}R_A\,x-(x-\xi)=\xi(L-x)/L & \xi\le x\\ R_A\,x=x(L-\xi)/L & \xi\ge x\end{cases}`
        : String.raw`\eta_M(x,\xi)=M(x)\big|_{P=1\text{ en }\xi}\qquad \text{(FEM Euler–Bernoulli, }v\downarrow,\ \theta\circlearrowright)`,
      substitution: simple
        ? `L = ${fmt(Ltot, 2)} m    x = ${fmt(x, 2)} m    →    η_M(x,x) = x(L−x)/L = ${fmt(x, 2)}×${fmt(Ltot - x, 2)}/${fmt(Ltot, 2)} = ${fmt(closedEta, 3)} m`
        : `x = ${fmt(x, 2)} m    ·    pico en ξ = ${fmt(inf.xi[peakM], 2)} m    ·    η_M pico = ${fmt(inf.etaM[peakM], 3)} m`,
      result: `η_M máx = ${fmt(Math.max(...inf.etaM), 3)} m    ·    η_M mín = ${fmt(Math.min(...inf.etaM), 3)} m    ·    unidad: t·m / t`,
      desarrollo: simple
        ? [
            `Reacción en A con P = 1 t en ξ: R_A = (L−ξ)/L = (${fmt(Ltot, 2)}−ξ)/${fmt(Ltot, 2)}.`,
            `Si ξ ≤ x la carga ya pasó la sección: M(x) = R_A·x − 1·(x−ξ) = [(L−ξ)/L]·x − (x−ξ) = ξ(L−x)/L = ξ×${fmt(Ltot - x, 2)}/${fmt(Ltot, 2)} = ${fmt((Ltot - x) / Ltot, 4)} ξ.`,
            `Si ξ ≥ x no hay carga entre 0 y x: M(x) = R_A·x = x(L−ξ)/L = ${fmt(x, 2)}(${fmt(Ltot, 2)}−ξ)/${fmt(Ltot, 2)} = ${fmt(x / Ltot, 4)}(${fmt(Ltot, 2)}−ξ).`,
            `Pico en ξ = x: η_M = x(L−x)/L = ${fmt(x, 2)}×${fmt(Ltot - x, 2)}/${fmt(Ltot, 2)} = ${fmt(closedEta, 3)} m. El FEM da ${fmt(inf.etaM[peakM], 3)} m.`,
          ]
        : [
            "Se introduce P = 1 t en cada estación ξ, se resuelve K u = F y se lee M en la sección x (interpolación en el elemento).",
            "Las ordenadas negativas (tracción superior) aparecen en tramos adyacentes de vigas continuas.",
          ],
      note: "La línea de influencia es propiedad de la viga y de la sección x: no depende del tren. Los vehículos se colocan sobre ella.",
      table: { caption: "Ordenadas η(ξ) en la sección x", headers: ilRows[0], rows: ilRows.slice(1) },
    },
    {
      n: "03",
      title: "Línea de influencia de cortante — derivada respecto de la sección",
      formula: "Equilibrio: V = ∂M/∂x. Luego η_V(x,ξ) = ∂η_M/∂x. En ξ = x hay un salto de valor 1 (P = 1 t atraviesa la sección).",
      formulaTex: simple
        ? String.raw`\eta_V=\dfrac{\partial\eta_M}{\partial x}=\begin{cases}-\xi/L & \xi<x\\ (L-\xi)/L & \xi>x\end{cases}\qquad \eta_V^+-\eta_V^-=1\qquad \dfrac{\partial\eta_M}{\partial\xi}=\begin{cases}(L-x)/L & \xi<x\\ -x/L & \xi>x\end{cases}`
        : String.raw`\eta_V=\dfrac{\partial\eta_M}{\partial x}\qquad \eta_V^+-\eta_V^-=1\quad(\text{salto bajo }P=1)`,
      substitution: simple
        ? `En ξ=x−: η_V = −x/L = −${fmt(x, 2)}/${fmt(Ltot, 2)} = ${fmt(etaV_left_at_x, 4)}    ·    En ξ=x+: η_V = (L−x)/L = ${fmt(Ltot - x, 2)}/${fmt(Ltot, 2)} = ${fmt(etaV_right_at_x, 4)}    ·    salto = ${fmt(etaV_right_at_x - etaV_left_at_x, 3)}`
        : `pico |η_V izq| = ${fmt(Math.max(...inf.etaVL.map(Math.abs)), 3)}    ·    |η_V der| = ${fmt(Math.max(...inf.etaVR.map(Math.abs)), 3)}`,
      result: `|η_V izq|máx = ${fmt(Math.max(...inf.etaVL.map(Math.abs)), 3)}    ·    |η_V der|máx = ${fmt(Math.max(...inf.etaVR.map(Math.abs)), 3)}    ·    pico |η_V| en ξ = ${fmt(inf.xi[peakV], 2)} m`,
      desarrollo: simple
        ? [
            `Derivada de η_M respecto de la sección x (no de ξ). Rama ξ ≤ x: η_M = ξ(L−x)/L → ∂η_M/∂x = −ξ/L.`,
            `Rama ξ ≥ x: η_M = x(L−ξ)/L → ∂η_M/∂x = (L−ξ)/L. Eso es η_V: recta de 0 en A hasta −x/L en x−, salto 1, recta de (L−x)/L en x+ hasta 0 en B.`,
            `Sustitución en x = ${fmt(x, 2)} m: −x/L = ${fmt(etaV_left_at_x, 4)}    y    (L−x)/L = ${fmt(etaV_right_at_x, 4)}. Salto = ${fmt(etaV_right_at_x, 4)}−(${fmt(etaV_left_at_x, 4)}) = 1.`,
            `Derivada respecto de la carga: ∂η_M/∂ξ = (L−x)/L = ${fmt(dEtaM_left, 4)} si ξ<x, y −x/L = ${fmt(dEtaM_right, 4)} si ξ>x. No es η_V; es la pendiente del triángulo de momento.`,
            `Cortante de diseño: V(x) = Σ P_i η_V(ξ_i) tomando la cara más adversa (izq. o der.). En el croquis el salto se dibuja vertical en x.`,
          ]
        : [
            "En cada tramo liso V = ∂M/∂x. El FEM lee V a izquierda y derecha de x; el salto bajo P = 1 t vale 1.",
            "El cortante de diseño toma la cara más adversa: V = Σ P_i η_V^{izq o der}(ξ_i).",
            "En el croquis η_V no es una polilínea continua: a la izquierda de x se usa η_V izq y a la derecha η_V der, con trazo vertical en el salto.",
          ],
      note: "El envelope de cortante recorre ambas caras y se queda con el valor más desfavorable.",
    },
    {
      n: "04",
      title: `Tren de cargas — ${item.label}`,
      formula: "Cada eje i aporta P_i · η(ξ_i). El 1.er eje se ancla en la cota s₀ (manual o crítica).",
      formulaTex: String.raw`M(x)=\sum_i P_i\,\eta_M(x,\xi_i)\qquad V(x)=\sum_i P_i\,\eta_V(x,\xi_i)\qquad \xi_i=s_0+s_i`,
      substitution: item.note,
      result: axles.length
        ? `${axles.length} ejes · W = ${fmt(axles.reduce((a, z) => a + z.p, 0), 2)} t · s₀ crítica del envelope = ${fmt(sCrit, 2)} m`
        : `carril w = ${fmt(wLane, 2)} t/m sobre zonas adversas de η (sin ejes)`,
      note: "Pesos MTC: RNV categorías M/N/O. HL-93: AASHTO 3.6.1 (Manual de Puentes MTC 2018).",
      table: { caption: "Ejes del tren (s medido desde el 1.er eje)", headers: axleRows[0], rows: axleRows.slice(1) },
    },
    {
      n: "05",
      title: `Análisis móvil en s₀ — ${sManual ? "cota indicada" : "posición crítica automática"}`,
      formula: "Se coloca el 1.er eje en s₀ y se evalúa término a término P_i η(ξ_i). Vaciar s₀ restaura la cota que maximiza el efecto.",
      formulaTex: String.raw`s_0=${fmt(s0, 2)}\ \text{m}\qquad M(x)=\sum P_i\eta_M= ${fmt(eM.v, 2)}\ \text{t·m}\qquad V(x)=\sum P_i\eta_V= ${fmt(eV.v, 2)}\ \text{t}`,
      substitution: `s₀ = ${fmt(s0, 2)} m (${sManual ? "manual" : "automática = crítica del envelope"})    ·    s₀ crítica = ${fmt(sCrit, 2)} m    ·    ${twoVeh ? "2 vehículos" : "1 vehículo"}`,
      result: `Con el tren en s₀:  M(x) = ${fmt(eM.v, 2)} t·m    ·    V(x) = ${fmt(eV.v, 2)} t    ·    sección x = ${fmt(x, 2)} m`,
      desarrollo: eM.rows.slice(0, 12).map((r, i) => {
        const vr = eV.rows[i];
        return `Eje ${r.i}: P=${fmt(r.p, 2)} t  en ξ=${fmt(r.xi, 2)} m  →  P·η_M = ${fmt(r.p, 2)}×${fmt(r.eta, 4)} = ${fmt(r.contrib, 2)} t·m    P·η_V = ${fmt(r.p, 2)}×${fmt(vr?.eta ?? 0, 4)} = ${fmt(vr?.contrib ?? 0, 2)} t`;
      }),
      note: "Edite la cota s₀ en datos o en el croquis (1.er eje) y pulse Calcular. El diagrama instantáneo M(x), V(x) corresponde a esta posición, no al envelope.",
      table: { caption: "Superposición eje a eje en la sección x", headers: trainRows[0], rows: trainRows.slice(1) },
    },
    {
      n: "06",
      title: "Barrido e envelope del tren",
      formula: "Se desplaza s₀ cada Δs sobre [−L_tren, L]. El envelope es el máx/mín de Σ P_i η en cada estación de s₀.",
      formulaTex: String.raw`E_{\max}=\max_{s_0}\sum_i P_i\eta(\xi_i)\qquad E_{\min}=\min_{s_0}\sum_i P_i\eta(\xi_i)\qquad \Delta s\approx ${fmt(ds, 2)}\ \text{m}`,
      substitution: `Δs ≈ ${fmt(ds, 2)} m    ·    efecto ${efecto === "R" ? `reacción apoyo ${apoyoR + 1}` : efecto}    ·    s₀ crítica = ${fmt(sCrit, 2)} m`,
      result: `máx = ${fmt(envSel.max, 2)} ${u}    ·    mín = ${fmt(envSel.min, 2)} ${u}    ·    |V|máx izq/der = ${fmt(Math.max(Math.abs(envVL.max), Math.abs(envVL.min), Math.abs(envVR.max), Math.abs(envVR.min)), 2)} t`,
      desarrollo: [
        `M ejes: máx ${fmt(envM.max, 2)}  mín ${fmt(envM.min, 2)} t·m`,
        `V izq: máx ${fmt(envVL.max, 2)}  mín ${fmt(envVL.min, 2)} t`,
        `V der: máx ${fmt(envVR.max, 2)}  mín ${fmt(envVR.min, 2)} t`,
        efecto === "R" ? `R${apoyoR + 1}: máx ${fmt(envR.max, 2)}  mín ${fmt(envR.min, 2)} t` : "",
      ].filter(Boolean),
    },
    {
      n: "07",
      title: "Integral de la faja sobre η — trapecios y ceros",
      formula: "Se parte η en los ceros. En cada [ξ_a, ξ_b] el área es el trapecio ½(η_a+η_b)Δξ. E_carril = w Σ A_adversas. Sin IM.",
      formulaTex: simple && efecto === "M"
        ? String.raw`\int_0^L\eta_M\,d\xi=\int_0^x\dfrac{\xi(L-x)}{L}\,d\xi+\int_x^L\dfrac{x(L-\xi)}{L}\,d\xi=\dfrac{x(L-x)}{2}`
        : simple && efecto === "V"
          ? String.raw`\int_0^x(-\xi/L)\,d\xi=-\dfrac{x^2}{2L}\qquad\int_x^L\dfrac{L-\xi}{L}\,d\xi=\dfrac{(L-x)^2}{2L}`
          : String.raw`A_k=\tfrac12(\eta_a+\eta_b)(\xi_b-\xi_a)\qquad E_{\text{carril}}^+=w\sum_{A_k>0}A_k`,
      substitution: simple && efecto === "M"
        ? `∫η_M = x(L−x)/2 = ${fmt(x, 2)}×${fmt(Ltot - x, 2)}/2 = ${fmt(closedAM, 3)} m²    ·    numérico A+ = ${fmt(laneBr.Apos, 3)} m²    ·    w = ${fmt(wLane, 2)} t/m`
        : simple && efecto === "V"
          ? `A+ = (L−x)²/(2L) = ${fmt(Ltot - x, 2)}²/(2×${fmt(Ltot, 2)}) = ${fmt(closedAVpos, 3)} m    ·    A− = −x²/(2L) = ${fmt(closedAVneg, 3)} m    ·    numérico A+ = ${fmt(laneBr.Apos, 3)}`
          : `w = ${fmt(wLane, 2)} t/m (AASHTO 3.6.1.2.4)    ·    A+ = ${fmt(laneBr.Apos, 3)}    ·    A− = ${fmt(laneBr.Aneg, 3)}`,
      result: `máx carril = ${fmt(laneBr.pos, 2)} ${u}    ·    mín carril = ${fmt(laneBr.neg, 2)} ${u}    ·    A+ = ${fmt(laneBr.Apos, 3)}    A− = ${fmt(laneBr.Aneg, 3)}`,
      desarrollo: [
        `1. Recorrer η(ξ). Si cambia de signo, el cero es ξ_z = ξ_a − η_a Δξ/(η_b−η_a).`,
        `2. Trapecio de signo constante: A = ½(η_a+η_b)(ξ_b−ξ_a).${trap0Txt}`,
        simple && efecto === "M"
          ? `3. Cerrado, rama izquierda: ∫_0^x ξ(L−x)/L dξ = (L−x)/L · x²/2 = ${fmt((Ltot - x) / Ltot, 4)}×${fmt((x * x) / 2, 3)} = ${fmt(((Ltot - x) / Ltot) * (x * x) / 2, 3)} m².`
          : "3. Sumar A>0 (máximo) y A<0 (mínimo).",
        simple && efecto === "M"
          ? `4. Rama derecha: ∫_x^L x(L−ξ)/L dξ = x/L · (L−x)²/2 = ${fmt(x / Ltot, 4)}×${fmt(((Ltot - x) ** 2) / 2, 3)} = ${fmt((x / Ltot) * ((Ltot - x) ** 2) / 2, 3)} m². Suma = ${fmt(closedAM, 3)} m².`
          : simple && efecto === "V"
            ? `4. Cerrado V: ∫_0^x (−ξ/L) dξ = −x²/(2L) = ${fmt(closedAVneg, 3)} m    y    ∫_x^L (L−ξ)/L dξ = (L−x)²/(2L) = ${fmt(closedAVpos, 3)} m.`
            : "4. E_carril = w Σ A_adversas. No se aplica IM a la faja (AASHTO 3.6.2.1).",
        `5. E_carril = w × A = ${fmt(wLane, 2)} × (${fmt(laneBr.Apos, 3)}) = ${fmt(laneBr.pos, 2)} ${u} (máx). Sin IM.`,
      ].filter(Boolean),
      note: "La faja se coloca solo donde η es adversa (mismo signo que el efecto buscado).",
      table: { caption: "Desglose de la integral de faja (trapecios entre ceros)", headers: laneRows[0], rows: laneRows.slice(1) },
    },
    {
      n: "08",
      title: "Combinación HL-93 / LRFD 3.6.1",
      formula: "HL-93 = máx{ (1+IM)·camión + carril  ;  (1+IM)·tándem + carril }. Continuo: 0.90[(1+IM)·2 camiones + carril] (3.6.1.3.1).",
      formulaTex: String.raw`E_{LL}=\max\big[(1{+}IM)E_{\text{cam}}+E_{\text{carril}},\ (1{+}IM)E_{\text{tándem}}+E_{\text{carril}}\big]`,
      substitution: `IM = ${fmt(IM * 100, 0)} %    ·    gobernante: ${govName}`,
      result: `LL máx = ${fmt(govMax, 2)} ${u}    ·    LL mín = ${fmt(govMin, 2)} ${u}`,
      note: "IM = 33 % Resistencia y Servicio, 15 % Fatiga. El tándem suele gobernar luces cortas; el camión, luces medias.",
    },
    {
      n: "09",
      title: "Presencia múltiple m y factor de carga",
      formula: "m = 1.20 / 1.00 / 0.85 / 0.65 para 1, 2, 3, ≥4 carriles. Resistencia I: 1.75 m (LL+IM).",
      formulaTex: String.raw`E_{LL,m}=m\,E_{LL}\qquad E_u=1{,}75\,m\,E_{LL}\ \text{(Resistencia I)}`,
      substitution: `${nCarr} carril(es) → m = ${fmt(m, 2)}    ·    γ = ${fmt(gamma, 2)} (${combinar})`,
      result: `m·LL = ${fmt(Mll, 2)} ${u}    ·    último (${combinar}) = ${fmt(Mu, 2)} ${u} (máx) / ${fmt(MuMin, 2)} ${u} (mín)`,
      note: "m no se aplica a fatiga (un camión). n = nD nR nI se reserva al módulo de cargas AASHTO si se diseña la sección.",
    },
  ];

  if (model.spans.length > 1 && twoVeh && (flota === "hl93" || axles.length > 0)) {
    steps.push({
      n: "10",
      title: "Dos vehículos en el tramo",
      formula: "Holgura mín. 15 m entre eje trasero del primero y eje delantero del segundo. HL-93: 90 % de (trenes + carril).",
      formulaTex: String.raw`E_{2\text{ veh}}=k\big[(1{+}IM)E_{\text{dos trenes}}+E_{\text{carril}}\big]\qquad k=0{,}90\ \text{(HL-93)}`,
      substitution: `holgura = ${fmt(Math.max(15, gap), 1)} m    ·    nVeh = ${twoVeh ? "2" : "1"} (${nVehRaw})`,
      result: flota === "hl93" || flota === "hs20"
        ? `0.90×dos camiones: máx ${fmt(dualLL.max, 2)} ${u}    mín ${fmt(dualLL.min, 2)} ${u}`
        : `2× tren: máx ${fmt(dual.max, 2)} ${u}    mín ${fmt(dual.min, 2)} ${u}`,
      note: "AASHTO 3.6.1.3.1 aplica el 0.90 a dos camiones de diseño. En flota MTC se envuelven dos trenes legales con la holgura indicada.",
    });
  }

  steps.push({
    n: twoVeh ? "11" : "10",
    title: "Envolventes de diseño M(x) y V(x)",
    formula: "En cada sección se barre el tren (1 y/o 2 vehículos) y se toma Mmáx, Mmín, Vmáx, Vmín. La envolvente total cubre todos los trenes del catálogo.",
    formulaTex: String.raw`M^+(x)=\max_{s_0}\sum P_i\eta_M(x,\xi_i)\qquad M^-(x)=\min_{s_0}\sum P_i\eta_M\qquad \text{igual para }V`,
    substitution: `${twoVeh ? "1 y 2 vehículos" : "1 vehículo"}    ·    m = ${fmt(m, 2)}    ·    γ = ${fmt(gamma, 2)}`,
    result: `Diseño  M+ = ${fmt(pkAll.Mplus, 2)} t·m @ ${fmt(pkAll.xMplus, 2)} m    ·    M− = ${fmt(pkAll.Mminus, 2)} t·m @ ${fmt(pkAll.xMminus, 2)} m    ·    |V| = ${fmt(pkAll.Vabs, 2)} t`,
    desarrollo: [
      `Tren adoptado (${twoVeh ? "1–2 veh." : "1 veh."}): M+ ${fmt(pk.Mplus, 2)}  M− ${fmt(pk.Mminus, 2)} t·m   |V| ${fmt(pk.Vabs, 2)} t`,
      `Envolvente de todos los trenes: M+ ${fmt(pkAll.Mplus, 2)}  M− ${fmt(pkAll.Mminus, 2)} t·m   V+ ${fmt(pkAll.Vplus, 2)}  V− ${fmt(pkAll.Vminus, 2)} t`,
      `Instantáneo con s₀ = ${fmt(s0, 2)} m: M(x) = ${fmt(eM.v, 2)} t·m    V(x) = ${fmt(eV.v, 2)} t (no es el envelope)`,
    ],
    note: "M+ (tracción inferior) y M− (tracción superior) son los momentos de diseño de la viga. |V| es el cortante de diseño. Armar con estos valores.",
  });

  const femPeak = inf.etaM[peakM];

  return out(
    `Diseño  M+=${fmt(pkAll.Mplus, 1)} t·m  M−=${fmt(pkAll.Mminus, 1)} t·m  |V|=${fmt(pkAll.Vabs, 1)} t  ·  s₀=${fmt(s0, 1)} m  ·  ${twoVeh ? "2 veh." : "1 veh."}`,
    `${nAp} apoyos (${izqLab}–${derLab})  ·  ${spanTxt}  ·  ${item.label}  ·  ${twoVeh ? "2 vehículos" : "1 vehículo"}  ·  s₀=${fmt(s0, 2)} m (${sManual ? "manual" : "crítica"})  ·  M(x)=${fmt(eM.v, 1)} t·m  V(x)=${fmt(eV.v, 1)} t  ·  m=${fmt(m, 2)}  IM=${fmt(IM * 100, 0)} %`,
    steps,
    [
      ok("x dentro de la viga", `${fmt(x, 2)} m`, `0–${fmt(Ltot, 2)} m`, x >= 0 && x <= Ltot + 1e-6),
      ok("Tramos positivos", spanTxt, "Li ≥ 0.50 m", model.spans.every((L) => L >= 0.5)),
      ok("Extremos no ambos libres", `${izqLab} / ${derLab}`, "al menos un apoyo", !(model.izq === "libre" && model.der === "libre")),
      ok("M+ de diseño", fmt(pkAll.Mplus, 2), "t·m", Number.isFinite(pkAll.Mplus)),
      ok("|V| de diseño", fmt(pkAll.Vabs, 2), "t", Number.isFinite(pkAll.Vabs)),
      ok("Isostático: η_M(x,x)=x(L−x)/L", fmt(femPeak, 3), fmt(closedEta, 3), !simple || Math.abs(femPeak - closedEta) < 0.05),
      ok("Integral faja A+", fmt(laneBr.Apos, 3), simple && efecto === "M" ? fmt(closedAM, 3) : "m²", !simple || efecto !== "M" || Math.abs(laneBr.Apos - closedAM) < 0.08),
    ],
    [
      { title: "Línea de influencia en la sección x", rows: ilRows },
      { title: "Superposición del tren en s₀", rows: trainRows },
      { title: "Integral de faja (trapecios)", rows: laneRows },
      { title: "Envolvente M(x) y V(x) — tren adoptado y total", rows: envRows },
      { title: "Comparación de trenes (1+IM, sin m ni γ)", rows: cmpRows },
    ],
    {
      L: String(Ltot),
      x: String(x),
      nApoyos: String(nAp),
      izq: model.izq,
      der: model.der,
      efecto,
      flota,
      nVeh: twoVeh ? "2" : "1",
      ilM: packXY(inf.xi, inf.etaM),
      ilV: packXY(inf.xi, inf.etaVL),
      ilVL: packXY(inf.xi, inf.etaVL),
      ilVR: packXY(inf.xi, inf.etaVR),
      axles: axlePos,
      sCrit: String(sCrit),
      s0used: fmt(s0, 2),
      sManual: sManual ? "1" : "0",
      Ltot: String(Ltot),
      spans: model.spans.map((L) => L.toFixed(3)).join(","),
      envMmax: packXY(selA.xs, selA.Mmax),
      envMmin: packXY(selA.xs, selA.Mmin),
      envVmax: packXY(selA.xs, selA.Vmax),
      envVmin: packXY(selA.xs, selA.Vmin),
      allMmax: packXY(allA.xs, allA.Mmax),
      allMmin: packXY(allA.xs, allA.Mmin),
      allVmax: packXY(allA.xs, allA.Vmax),
      allVmin: packXY(allA.xs, allA.Vmin),
      instM: packXY(inst.xs, inst.M),
      instV: packXY(inst.xs, inst.V),
      Ms0: fmt(eM.v, 2),
      Vs0: fmt(eV.v, 2),
      Mplus: fmt(pk.Mplus, 2),
      Mminus: fmt(pk.Mminus, 2),
      Vplus: fmt(pk.Vplus, 2),
      Vminus: fmt(pk.Vminus, 2),
      Vabs: fmt(pk.Vabs, 2),
      allMplus: fmt(pkAll.Mplus, 2),
      allMminus: fmt(pkAll.Mminus, 2),
      allVplus: fmt(pkAll.Vplus, 2),
      allVminus: fmt(pkAll.Vminus, 2),
      allVabs: fmt(pkAll.Vabs, 2),
      xMplus: fmt(pkAll.xMplus, 2),
      xMminus: fmt(pkAll.xMminus, 2),
      Mmax: fmt(pkAll.Mplus, 2),
      Vmax: fmt(pkAll.Vabs, 2),
    },
  );
};

