import { G } from "../num";
import {
  geom,
  manningQ,
  manningV,
  tiranteCritico,
  tiranteNormal,
  pendienteCritica,
  froude,
  bordeLibreUSBR,
} from "./canal";
import type { CanalInput } from "./canal";

export interface SifonInput {
  Q: number;
  nCanal: number;
  nTubo: number;
  Sentrada: number;
  Ssalida: number;
  zTalud: number;
  bEntrada: number;
  bSalida: number;
  cotaFondoEntrada: number;
  /** Cota de fondo del canal de salida medida en campo. Si es 0, se usa la cota teórica. */
  cotaFondoSalida: number;
  Dpulg: number;
  Vdiseno: number;
  thetaEntDeg: number;
  thetaSalDeg: number;
  LinclinadaEnt: number;
  Lhorizontal: number;
  LinclinadaSal: number;
  Stubo: number;
  fDarcy: number;
  Ke: number;
  Ks: number;
  nCodos: number;
  Kcodo: number;
  material: string;
  claseTubo: string;
  recubrimiento: number;
  nAire: number;
  nLimpia: number;
}

export function pulgAmetros(pulg: number) {
  return pulg * 0.0254;
}

export function diametroDesdeV(Q: number, V: number) {
  const A = Q / Math.max(V, 1e-6);
  return Math.sqrt((4 * A) / Math.PI);
}

export function diametroComercialPulg(Dreq: number) {
  const comercial = [6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 36, 42, 48, 54, 60];
  const m = comercial.find((p) => pulgAmetros(p) >= Dreq - 1e-9);
  return m ?? comercial[comercial.length - 1];
}

export function calcularSifon(inp: SifonInput) {
  const canalEnt: CanalInput = {
    Q: inp.Q,
    n: inp.nCanal,
    S: inp.Sentrada,
    tipo: "trapezoidal",
    b: inp.bEntrada,
    z: inp.zTalud,
    D: 0,
  };
  const canalSal: CanalInput = {
    ...canalEnt,
    S: inp.Ssalida,
    b: inp.bSalida,
  };

  const y1 = tiranteNormal(canalEnt);
  const g1 = geom("trapezoidal", y1, inp.bEntrada, inp.zTalud, 0);
  const Q1 = manningQ(g1, inp.nCanal, inp.Sentrada);
  const V1 = manningV(g1, inp.nCanal, inp.Sentrada);
  const yc1 = tiranteCritico(canalEnt);
  const Sc1 = pendienteCritica(canalEnt, yc1);
  const Fr1 = froude(V1, g1.Dhid);
  const BL1 = bordeLibreUSBR(y1, V1);

  const y6 = tiranteNormal(canalSal);
  const g6 = geom("trapezoidal", y6, inp.bSalida, inp.zTalud, 0);
  const Q6 = manningQ(g6, inp.nCanal, inp.Ssalida);
  const V6 = manningV(g6, inp.nCanal, inp.Ssalida);
  const yc6 = tiranteCritico(canalSal);
  const Sc6 = pendienteCritica(canalSal, yc6);
  const Fr6 = froude(V6, g6.Dhid);
  const BL6 = bordeLibreUSBR(y6, V6);

  const Dreq = diametroDesdeV(inp.Q, inp.Vdiseno);
  const Dpulg = inp.Dpulg > 0 ? inp.Dpulg : diametroComercialPulg(Dreq);
  const D = pulgAmetros(Dpulg);
  const At = (Math.PI * D * D) / 4;
  const Vt = At > 0 ? inp.Q / At : 0;
  const ht = (Vt * Vt) / (2 * G);
  const Pt = Math.PI * D;
  const Rt = D / 4;

  const T1 = g1.T;
  const T2 = D;
  const thetaTrans = 12.5 * (Math.PI / 180);
  const LtGeom = Math.abs(T1 - T2) / (2 * Math.tan(thetaTrans));
  const LtAlcant = 4 * D;
  const Lt = Math.max(LtGeom, LtAlcant, 1);

  const selloMin = Math.max(1.1 * ht, 0.075);
  const selloMax = Math.max(1.5 * ht, 0.075);
  const sello = Math.max(selloMin, 0.075);

  const thetaE = (inp.thetaEntDeg * Math.PI) / 180;
  const thetaS = (inp.thetaSalDeg * Math.PI) / 180;
  const hte = inp.LinclinadaEnt * Math.sin(thetaE);
  const hts = inp.LinclinadaSal * Math.sin(thetaS);

  const cotaNA1 = inp.cotaFondoEntrada + y1;
  const cotaFondo2 = cotaNA1 - (sello + ht);
  const cota3 = cotaFondo2 - inp.LinclinadaEnt * Math.sin(thetaE);
  const hfHoriz = inp.Stubo * inp.Lhorizontal;
  const cota4 = cota3 - hfHoriz;
  const cota5Teorica = cota4 + inp.LinclinadaSal * Math.sin(thetaS);
  const usaCotaCampo = inp.cotaFondoSalida > 0;
  const cota5 = usaCotaCampo ? inp.cotaFondoSalida : cota5Teorica;
  const desvioCotaSalida = usaCotaCampo ? inp.cotaFondoSalida - cota5Teorica : 0;

  const PmaxEnt = 0.75 * D;
  const PmaxSal = 0.5 * D;
  const Pentrada = sello + ht;
  const cumpleP = Pentrada <= PmaxEnt + 1e-6;

  const Ltotal = inp.LinclinadaEnt + inp.Lhorizontal + inp.LinclinadaSal;
  const hf = (inp.fDarcy * Ltotal * Vt * Vt) / (D * 2 * G);
  const he = inp.Ke * ht;
  const hs = inp.Ks * ht;
  const hcodos = inp.nCodos * inp.Kcodo * ht;
  const hperd = he + hs + hf + hcodos;
  const hdisp = (inp.cotaFondoEntrada + y1) - (cota5 + y6);
  const hdispTeorico = (inp.cotaFondoEntrada + y1) - (cota5Teorica + y6);
  const cumpleEnergia = hdisp >= hperd;
  const cumpleCotaCampo = !usaCotaCampo || Math.abs(desvioCotaSalida) <= 0.15;
  const Vok = Vt >= 1.2 && Vt <= 3.5;
  const inclinEnt = thetaE > 0 ? 1 / Math.tan(thetaE) : Infinity;
  const inclinSal = thetaS > 0 ? 1 / Math.tan(thetaS) : Infinity;
  const cumpleIncl = inclinEnt >= 2 && inclinSal >= 2;

  return {
    y1, g1, Q1, V1, yc1, Sc1, Fr1, BL1,
    y6, g6, Q6, V6, yc6, Sc6, Fr6, BL6,
    Dreq, Dpulg, D, At, Vt, ht, Pt, Rt,
    T1, LtGeom, LtAlcant, Lt,
    selloMin, selloMax, sello,
    hte, hts,
    cotaNA1, cotaFondo2, cota3, cota4, cota5, cota5Teorica, desvioCotaSalida, usaCotaCampo,
    PmaxEnt, PmaxSal, Pentrada, cumpleP,
    Ltotal, hf, he, hs, hcodos, hperd, hdisp, hdispTeorico, cumpleEnergia, cumpleCotaCampo,
    Vok, inclinEnt, inclinSal, cumpleIncl,
    regimenEnt: Fr1 >= 1 ? "supercrítico (rápido)" : "subcrítico (lento)",
    regimenSal: Fr6 >= 1 ? "supercrítico (rápido)" : "subcrítico (lento)",
  };
}
