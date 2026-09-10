import { G, round } from "../num";
import {
  PERIODOS_IDF,
  ZONAS_IILA,
  calcA,
  calcKg,
  curvaIdf,
  intensidad,
  tcKirpich,
  type IdfRow,
} from "./canaleta";
import { geom, manningQ, manningV, tiranteNormal, tiranteCritico, froude } from "./canal";
import type { CanalInput, SeccionTipo } from "./canal";

export type TipoBoca = "escuadra" | "alerones" | "abocinada";

export interface AlcantarillaInput {
  Qforzado: number;
  n: number;
  S: number;
  tipo: "caja" | "circular";
  B: number;
  H: number;
  D: number;
  L: number;
  nBarriles: number;
  TW: number;
  tipoBoca: TipoBoca;
  HW_D_max: number;
  zonaId: string;
  nIila: number;
  tg: number;
  eg: number;
  bParam: number;
  Tret: number;
  Aha: number;
  C: number;
  Lcuenca: number;
  Scuenca: number;
  usarTc: boolean;
  tMin: number;
  estacionSenamhi: string;
  codigoEstacion: string;
  periodoRegistro: string;
  cotaRasante: number;
  cotaFondo: number;
  sesgoDeg: number;
  origenQ: "racional" | "hidrologia" | "aforo" | "impuesto";
  justificacionQ: string;
}

export const BOCA_ALC = [
  { id: "escuadra" as const, label: "Muro de testa a escuadra (90°)", Ke: 0.5, K: 0.51, M: 0.667, c: 0.0408, Y: 0.67 },
  { id: "alerones" as const, label: "Alerones 30°–75°", Ke: 0.4, K: 0.486, M: 0.667, c: 0.0385, Y: 0.64 },
  { id: "abocinada" as const, label: "Boca abocinada / alerones cortos", Ke: 0.2, K: 0.421, M: 0.64, c: 0.0347, Y: 0.81 },
];

export const C_CUENCA_VIA = [
  { C: 0.9, label: "Pavimento asfáltico o concreto" },
  { C: 0.7, label: "Afirmado / zona urbana mixta" },
  { C: 0.55, label: "Cultivos y pastos con pendiente media" },
  { C: 0.5, label: "Cultivos / pastos (cuenca rural típica)" },
  { C: 0.45, label: "Terreno natural, cobertura media" },
  { C: 0.3, label: "Bosque / monte" },
];

export const N_MANNING_ALC = [
  { n: 0.012, label: "Concreto liso, encofrado metálico" },
  { n: 0.013, label: "Concreto ordinario (cajón vaciado)" },
  { n: 0.015, label: "Concreto rugoso o con juntas" },
  { n: 0.024, label: "TMC corrugado" },
];

export const T_RETORNO_VIA = [
  { T: 10, uso: "Trocha / camino vecinal (verificación menor)" },
  { T: 25, uso: "Vía vecinal y departamental — diseño habitual MTC" },
  { T: 50, uso: "Vía nacional / cruce de quebrada importante" },
  { T: 100, uso: "Verificación extraordinaria / infraestructura crítica" },
];

function bocaOf(id: TipoBoca) {
  return BOCA_ALC.find((b) => b.id === id) ?? BOCA_ALC[0];
}

/** Q/(A√D) en unidades inglesas de las cartas FHWA HDS-5. */
function qAdEn(Q: number, A: number, Dref: number) {
  const Qcfs = Q * 35.3146667;
  const Aft = A * 10.7639104;
  const Dft = Dref * 3.2808399;
  if (Aft <= 0 || Dft <= 0) return Infinity;
  return Qcfs / (Aft * Math.sqrt(Dft));
}

export function calcularAlcantarilla(inp: AlcantarillaInput) {
  const boca = bocaOf(inp.tipoBoca);
  const Ke = boca.Ke;
  const a = round(calcA(inp.tg, inp.nIila, inp.eg), 3);
  const Kfreq = round(calcKg(inp.eg), 3);
  const Tc = Math.max(5, tcKirpich(inp.Lcuenca, inp.Scuenca));
  const tMin = inp.usarTc ? Math.max(10, Tc) : Math.max(10, inp.tMin);
  const I = intensidad(a, Kfreq, inp.Tret, tMin / 60, inp.bParam, inp.nIila);
  const Qrac = (inp.C * I * inp.Aha) / 360;
  const Qd = inp.Qforzado > 0 ? inp.Qforzado : Qrac;
  const idf: IdfRow[] = curvaIdf(a, Kfreq, inp.bParam, inp.nIila);

  const nB = Math.max(1, Math.round(inp.nBarriles) || 1);
  const Qb = Qd / nB;
  const tipo: SeccionTipo = inp.tipo === "caja" ? "rectangular" : "circular";
  const b = inp.tipo === "caja" ? inp.B : 0;
  const Dref = inp.tipo === "caja" ? inp.H : inp.D;
  const canal: CanalInput = { Q: Qb, n: inp.n, S: inp.S, tipo, b, z: 0, D: Dref };

  const yLleno = Dref;
  const gLleno =
    inp.tipo === "caja"
      ? geom("rectangular", inp.H, inp.B, 0, 0)
      : geom("circular", inp.D * 0.99, 0, 0, inp.D);
  const Qlleno1 = manningQ(gLleno, inp.n, inp.S);
  const Qlleno = Qlleno1 * nB;
  const yn = tiranteNormal(canal);
  const yc = tiranteCritico(canal);
  const gn = geom(tipo, Math.min(yn, yLleno * 0.99), b, 0, Dref);
  const Vn = manningV(gn, inp.n, inp.S);
  const Fr = froude(Vn, gn.Dhid);

  const At1 = inp.tipo === "caja" ? inp.B * inp.H : (Math.PI * inp.D * inp.D) / 4;
  const At = At1 * nB;
  const Vt = At1 > 0 ? Qb / At1 : 0;
  const ht = (Vt * Vt) / (2 * G);
  const R = gLleno.R || gn.R || 1e-6;
  const sesgo = (inp.sesgoDeg || 0) * Math.PI / 180;
  const Lefect = inp.L / Math.max(Math.cos(sesgo), 0.5);
  const hf = (inp.n ** 2 * Vt ** 2 * Lefect) / R ** (4 / 3);
  const he = Ke * ht;

  const qAd = qAdEn(Qb, At1, Dref);
  const hwDuns = boca.K * qAd ** boca.M;
  const hwDsub = boca.c * qAd ** 2 + boca.Y;
  const hwDentrada = qAd <= 1.2 ? hwDuns : Math.max(hwDuns, hwDsub);
  const HWentrada = hwDentrada * Dref;

  const Hsal = (1 + Ke + (2 * G * inp.n ** 2 * Lefect) / R ** (4 / 3)) * ht;
  const ho = Math.max(inp.TW, (yc + Dref) / 2);
  const HWsalida = Hsal + ho - Lefect * inp.S;
  const HW = Math.max(HWentrada, HWsalida, 0);
  const HW_D = Dref > 0 ? HW / Dref : Infinity;
  const controlHW = HWentrada >= HWsalida ? "entrada (cartas FHWA HDS-5)" : "salida / fricción (Manning + Ke)";
  const controlYn = yn < yc ? "régimen supercrítico aguas abajo" : "régimen subcrítico aguas abajo";
  const cotaClave = inp.cotaFondo > 0 ? inp.cotaFondo + Dref : 0;
  const cotaNA = inp.cotaFondo > 0 ? inp.cotaFondo + HW : 0;
  const libreRasante = inp.cotaRasante > 0 && cotaNA > 0 ? inp.cotaRasante - cotaNA : 0;
  const cumpleRasante = inp.cotaRasante <= 0 || libreRasante >= 0.30;

  return {
    a,
    Kfreq,
    Tc,
    tMin,
    I: round(I, 2),
    Qrac,
    Qd,
    idf,
    periodos: PERIODOS_IDF,
    nB,
    Qb,
    Qlleno,
    Qlleno1,
    yn,
    yc,
    gn,
    gLleno,
    Vn,
    Fr,
    At,
    At1,
    Vt,
    ht,
    Lefect,
    hf,
    he,
    Ke,
    qAd,
    HWentrada,
    HWsalida,
    HW,
    HW_D,
    controlHW,
    controlYn,
    cotaClave,
    cotaNA,
    libreRasante,
    cumpleRasante,
    cumpleCapacidad: Qlleno >= Qd,
    cumpleHW: HW_D <= inp.HW_D_max && (inp.cotaRasante <= 0 || libreRasante >= 0.30),
    sumergida: yn > 0.8 * yLleno,
    boca,
    zona: ZONAS_IILA.find((z) => z.id === inp.zonaId) ?? null,
  };
}

export type AlcantarillaResult = ReturnType<typeof calcularAlcantarilla>;
