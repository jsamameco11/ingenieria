/**
 * Memoria hidráulica de la habilitación urbana.
 * El número de lotes lo entrega el plano. Cada fórmula sigue el desarrollo
 * del expediente y se verifica contra el criterio de diseño: velocidad,
 * tiempos de retención, clase de tubería y potencia.
 */

export type Accesorio = { nombre: string; km: number; n: number; cual: "d8" | "d10" | "d12" };
export type AccesorioK = { nombre: string; km: number; n: number };
export type Veredicto = { ok: boolean; texto: string };

export type Tubo = {
  nombre: string;
  ext: number;
  int: number;
  e: number;
  pnM: number;
  clase: string;
};

export type DatosAgua = {
  densidad: number;
  k1: number;
  k2: number;
  contribucion: number;
  dotacion: number;
  horasBombeo: number;
  infiltracion: number;
  pozos: { nombre: string; qb: number }[];
  vel: number;
  longPozo: number;
  ks: number;
  nu: number;
  desnivel: number;
  eficBomba: number;
  densidadAgua: number;
  presionSalida: number;
  factorAltura: number;
  eficMotor: number;
  diametros: { d10: number; d12: number; d8: number; d6: number };
  caudalesDia: { q10: number; q12: number; q8: number; q6: number };
  accesorios: Accesorio[];
};

export type DatosDesague = {
  fMin: number;
  pretMax: number;
  pretMin: number;
  /** Valor escrito en la hoja. El diseño usa pretMax / pretMin. */
  relacionA: number;
  volDisenado: number;
  diamCamara: number;
  alturaSeca: number;
  alturaOperativa: number;
  horasBombeo: number;
  fDarcy: number;
  longPvc: number;
  diamNom: number;
  diamInt: number;
  cMetal: number;
  cPvc: number;
  cotaSuccion: number;
  cotaDescarga: number;
  presionSalida: number;
  eficBomba: number;
  factorElec: number;
  factorAltura: number;
  ks: number;
  nu: number;
  densidadAgua: number;
  eficMotor: number;
  accesoriosEq: { nombre: string; n: number; k: number; dMm: number }[];
  accesoriosDarcy: AccesorioK[];
  moduloAgua: number;
  moduloTubo: number;
  espesorAriete: number;
  velValvula: number;
  numBombas: number;
};

export const MOTORES_HP = [0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300];
export const VALVULAS_PULG = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 6, 8];

/** NTP ISO 4422-1, PN-10, SDR 21. Interior y espesor en mm. Presión de trabajo 100 m. */
export const PVC_PN10: Tubo[] = [
  { nombre: "Ø 63 mm", ext: 63, int: 57, e: 3, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 75 mm", ext: 75, int: 67.8, e: 3.6, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 90 mm", ext: 90, int: 81.4, e: 4.3, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 110 mm", ext: 110, int: 99.4, e: 5.3, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 140 mm", ext: 140, int: 126.6, e: 6.7, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 160 mm", ext: 160, int: 144.6, e: 7.7, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 200 mm", ext: 200, int: 180.8, e: 9.6, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 250 mm", ext: 250, int: 226.2, e: 11.9, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 315 mm", ext: 315, int: 285, e: 15, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 355 mm", ext: 355, int: 321.2, e: 16.9, pnM: 100, clase: "PN-10" },
  { nombre: "Ø 400 mm", ext: 400, int: 361.8, e: 19.1, pnM: 100, clase: "PN-10" },
];

/** PVC desagüe clase C-7,5. Presión de trabajo 75 m. */
export const PVC_C75: Tubo[] = [
  { nombre: '4"', ext: 110, int: 102, e: 4, pnM: 75, clase: "C-7,5" },
  { nombre: '6"', ext: 160, int: 148.4, e: 5.8, pnM: 75, clase: "C-7,5" },
  { nombre: '8"', ext: 200, int: 185.4, e: 7.3, pnM: 75, clase: "C-7,5" },
  { nombre: '10"', ext: 250, int: 231.8, e: 9.1, pnM: 75, clase: "C-7,5" },
  { nombre: '12"', ext: 315, int: 292.2, e: 11.4, pnM: 75, clase: "C-7,5" },
  { nombre: '14"', ext: 355, int: 329.2, e: 12.9, pnM: 75, clase: "C-7,5" },
  { nombre: '16"', ext: 400, int: 371, e: 14.5, pnM: 75, clase: "C-7,5" },
  { nombre: '18"', ext: 450, int: 417.4, e: 16.3, pnM: 75, clase: "C-7,5" },
];

/** PVC desagüe clase C-10. Misma geometría que el PN-10 de la NTP. Presión de trabajo 100 m. */
export const PVC_C10: Tubo[] = [
  { nombre: '4"', ext: 110, int: 99.4, e: 5.3, pnM: 100, clase: "C-10" },
  { nombre: '6"', ext: 160, int: 144.6, e: 7.7, pnM: 100, clase: "C-10" },
  { nombre: '8"', ext: 200, int: 180.8, e: 9.6, pnM: 100, clase: "C-10" },
  { nombre: '10"', ext: 250, int: 226.2, e: 11.9, pnM: 100, clase: "C-10" },
  { nombre: '12"', ext: 315, int: 285, e: 15, pnM: 100, clase: "C-10" },
  { nombre: '14"', ext: 355, int: 321.2, e: 16.9, pnM: 100, clase: "C-10" },
  { nombre: '16"', ext: 400, int: 361.8, e: 19.1, pnM: 100, clase: "C-10" },
  { nombre: '18"', ext: 450, int: 407, e: 21.5, pnM: 100, clase: "C-10" },
];

const RUGOSIDAD: { material: string; ks: string }[] = [
  { material: "Vidrio", ks: "0,0003" },
  { material: "PVC, CPVC", ks: "0,0015" },
  { material: "Asbesto cemento", ks: "0,03" },
  { material: "GRP", ks: "0,03" },
  { material: "Acero", ks: "0,046" },
  { material: "Hierro forjado", ks: "0,06" },
  { material: "CCP / hierro fundido asfaltado", ks: "0,12" },
  { material: "Hierro galvanizado o fundido", ks: "0,15" },
  { material: "Arcilla vitrificada", ks: "0,15" },
  { material: "Hierro dúctil", ks: "0,25" },
  { material: "Concreto", ks: "0,30 – 3,0" },
];

export function tablaRugosidad() {
  return RUGOSIDAD;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function v(ok: boolean, texto: string): Veredicto {
  return { ok, texto };
}

export function areaMm(dMm: number) {
  return (Math.PI * (dMm * dMm)) / 4e6;
}

export function velocidad(qLps: number, dIntMm: number) {
  const a = areaMm(dIntMm);
  return a > 0 ? qLps / 1000 / a : 0;
}

export function motorComercialHp(hp: number) {
  if (!(hp > 0)) return 0;
  return MOTORES_HP.find((m) => m + 1e-9 >= hp) ?? MOTORES_HP[MOTORES_HP.length - 1];
}

export function valvulaComercial(pulg: number) {
  if (!(pulg > 0)) return 0;
  return VALVULAS_PULG.find((d) => d + 1e-9 >= pulg) ?? VALVULAS_PULG[VALVULAS_PULG.length - 1];
}

/** Colebrook–White. Catorce iteraciones desde f = 0,001, como en la hoja. Si Re ≤ 2 200 el régimen es laminar y f = 64/Re. */
export function colebrook(re: number, ksSobreD: number) {
  if (!(re > 0)) return { f: 0, pasos: [] as { f: number; g: number }[], regimen: "sin flujo" as const };
  if (re <= 2200) return { f: 64 / re, pasos: [] as { f: number; g: number }[], regimen: "laminar" as const };
  let f = 0.001;
  const pasos: { f: number; g: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const g = -2 * Math.log10(ksSobreD / 3.7 + 2.51 / (re * Math.sqrt(f)));
    f = 1 / g ** 2;
    pasos.push({ f, g });
  }
  return { f, pasos, regimen: "turbulento" as const };
}

export function caudalesDe(lotesPorEtapa: number[], d: Pick<DatosAgua, "densidad" | "k1" | "k2" | "contribucion" | "dotacion" | "horasBombeo" | "infiltracion">) {
  const filas = lotesPorEtapa.map((lotes, i) => {
    const hab = Math.round(d.densidad * lotes);
    const qp = r2((d.dotacion * hab) / 86400);
    const qmd = r2(qp * d.k1);
    const qmh = r2(qp * d.k2);
    return {
      etapa: i + 1,
      lotes,
      hab,
      qp,
      qmd,
      qmh,
      qcprom: r2(qp * d.contribucion),
      qcmd: r2(qmd * d.contribucion),
      qcmh: r2(qmh * d.contribucion),
    };
  });
  const sum = (k: keyof (typeof filas)[number]) => filas.reduce((s, f) => s + Number(f[k]), 0);
  const tot = {
    lotes: sum("lotes"),
    hab: sum("hab"),
    qp: r2(sum("qp")),
    qmd: r2(sum("qmd")),
    qmh: r2(sum("qmh")),
    qcprom: r2(sum("qcprom")),
    qcmd: r2(sum("qcmd")),
    qcmh: r2(sum("qcmh")),
  };
  const qInfil = r2(tot.qcmh * d.infiltracion);
  const qDiseno = r2(tot.qcmh + qInfil);
  const qb = d.horasBombeo > 0 ? (tot.qmd * 24) / d.horasBombeo : 0;
  const volDiaMedio = (tot.qp * 86400) / 1000;
  const volDiaMax = (tot.qmd * 86400) / 1000;
  const volReg = 0.25 * volDiaMedio;
  const volRegCelda = volReg * (d.horasBombeo / 24);
  const volRegRotulo = d.horasBombeo > 0 ? volReg * (24 / d.horasBombeo) : 0;
  const volIncendio = 50;
  return { filas, tot, qInfil, qDiseno, qb, volDiaMedio, volDiaMax, volReg, volRegCelda, volRegRotulo, volIncendio, volReservorio: volReg + volIncendio };
}

export function bresse(qbLps: number, horas: number, vel = 1.5) {
  const dEcoM = 1.3 * (horas / 24) ** 0.25 * (qbLps / 1000) ** 0.5;
  const dVelM = 2 * Math.sqrt(qbLps / (vel * Math.PI * 1000));
  const espesorM = dEcoM - dVelM > 0 ? (dEcoM - dVelM) / 2 : 0;
  return {
    dEcoMm: dEcoM * 1000,
    dEcoPulg: (dEcoM * 1000) / 25.4,
    dVelM,
    espesorMm: espesorM * 1000,
  };
}

/** Comercial con velocidad en rango y exterior en el diámetro económico de Bresse o inmediatamente encima. */
export function elegirTuberia(qLps: number, horas: number, tabla: Tubo[], vMin: number, vMax: number) {
  const bre = bresse(qLps, horas);
  if (!(qLps > 0)) return { bre, tubo: null as Tubo | null, v: 0 };
  const conV = tabla
    .map((t) => ({ ...t, v: velocidad(qLps, t.int) }))
    .filter((t) => t.v >= vMin - 1e-9 && t.v <= vMax + 1e-9)
    .sort((a, b) => a.ext - b.ext);
  const sobre = conV.filter((t) => t.ext >= bre.dEcoMm * 0.98);
  const tubo = sobre[0] ?? conV[conV.length - 1] ?? null;
  return { bre, tubo, v: tubo?.v ?? 0 };
}

function perdidaMenor(km: number, n: number, vel: number) {
  return km * n * ((vel * vel) / (2 * 9.82));
}

export function potenciaPozo(d: DatosAgua, qb: number) {
  const q = qb;
  const A = {
    d10: areaMm(d.diametros.d10),
    d12: areaMm(d.diametros.d12),
    d8: areaMm(d.diametros.d8),
    d6: areaMm(d.diametros.d6),
  };
  const V = {
    d10: q / 1000 / A.d10,
    d12: q / 1000 / A.d12,
    d8: q / 1000 / A.d8,
    d6: q / 1000 / A.d6,
  };
  const acc = d.accesorios.map((a) => ({ ...a, h: perdidaMenor(a.km, a.n, V[a.cual]) }));
  const hm = acc.reduce((s, a) => s + a.h, 0);
  const re = (V.d8 * d.diametros.d8) / 1000 / (d.nu / 1e6);
  const ksD = d.ks / d.diametros.d8;
  const { f, pasos, regimen } = colebrook(re, ksD);
  const hf = (f * d.longPozo * V.d8 * V.d8) / (d.diametros.d8 / 1000) / (2 * 9.81);
  const H = (d.desnivel + hf + hm + d.presionSalida) * d.factorAltura;
  const pKw = d.eficBomba > 0 ? (d.densidadAgua * (qb / 1000) * 9.81 * H) / (d.eficBomba / 100) / 1000 : 0;
  const pMotor = d.eficMotor > 0 ? pKw / d.eficMotor : 0;
  const pHp = pKw / 0.746;
  const pMotorHp = pMotor / 0.746;
  const comercial = motorComercialHp(pMotorHp);
  const veredictos: Veredicto[] = q > 0 ? [
    v(re > 2200, `Reynolds ${Math.round(re)} en el interior ${d.diametros.d8} mm. Por encima de 2 200 el régimen es turbulento y corresponde Colebrook–White.`),
    v(V.d8 >= 0.6 && V.d8 <= 2, `Velocidad ${V.d8.toFixed(2)} m/s en la impulsión. El rango de diseño es 0,60 a 2,00 m/s.`),
    v(H <= 150, `Altura manométrica ${H.toFixed(2)} m frente a clase 15 (150 m)${H <= 100 ? " y PN-10 (100 m)" : ""}.`),
  ] : [];
  return { A, V, acc, hm, re, ksD, f, pasos, regimen, hf, H, pKw, pHp, pMotorKw: pMotor, pMotorHp, comercial, veredictos };
}

export function camaraDe(qpAgua: number, des: DatosDesague, k1 = 1.3, k2 = 1.8) {
  const qMaxDiario = qpAgua * k1;
  const qMm = qpAgua * k1 * k2;
  const qMh = qpAgua * k2;
  const qMaxc = qMm;
  const qMinc = des.fMin * qpAgua;
  const hay = qpAgua > 0 && qMinc > 0;
  const K = hay ? qMaxc / qMinc : 0;
  const a = des.pretMin > 0 ? des.pretMax / des.pretMin : des.relacionA;
  const izq = (K * K - a) ** 2;
  const der = 4 * (K - a) * (K - 1) * K * (a + 1);
  const A = K - a;
  const B = a - K * K;
  const C = K * (K - 1) * (a + 1);
  const disc = B * B - 4 * A * C;
  const raiz = disc >= 0 && Math.abs(A) > 1e-9 ? Math.sqrt(disc) : NaN;
  const k1a = Number.isFinite(raiz) ? (-B + raiz) / (2 * A) : NaN;
  const k1b = Number.isFinite(raiz) ? (-B - raiz) / (2 * A) : NaN;
  const K1 = Number.isFinite(k1b) ? k1b : k1a;
  const qb = hay && Number.isFinite(K1) ? K1 * qMinc : 0;
  const denom = K - K1 - 1;
  const vUtil = hay && denom !== 0 ? (des.pretMax * 60 * (K - K1) * qMinc) / (denom * 1000) : 0;
  const t = (num: number, den: number) => (den > 0 ? (num * 1000) / (den * 60) : NaN);
  const tLlenMin = t(vUtil, qMaxc);
  const tLlenMax = t(vUtil, qMinc);
  const tBombMin = t(vUtil, qb - qMinc);
  const tBombMax = t(vUtil, qb - qMaxc);
  const tRetMax = tBombMax + tLlenMax;
  const tRetMin = tBombMin + tLlenMin;
  const area = (Math.PI * des.diamCamara * des.diamCamara) / 4;
  const vAdopt = Math.max(des.volDisenado, Number.isFinite(vUtil) ? vUtil : 0);
  const hUtil = area > 0 ? vAdopt / area : 0;
  const hHoja = area > 0 ? des.volDisenado / area : 0;
  const hTotal = hUtil + des.alturaSeca + des.alturaOperativa;
  const bre = bresse(qb, des.horasBombeo);
  const dEcoCm = bre.dEcoMm / 10;
  const veredictos: Veredicto[] = hay ? [
    v(izq > der, `Condición (K² − a)² = ${izq.toFixed(2)} frente a 4(K − a)(K − 1)K(a + 1) = ${der.toFixed(2)}, con K = ${K.toFixed(3)} y a = ${a.toFixed(2)}.`),
    v(qb > qMaxc, `Caudal de bombeo ${qb.toFixed(2)} L/s frente al caudal máximo de contribución ${qMaxc.toFixed(2)} L/s. El bombeo tiene que ser mayor.`),
    v(des.volDisenado + 1e-6 >= vUtil, `Volumen escrito ${des.volDisenado.toFixed(2)} m³ frente al volumen útil ${vUtil.toFixed(2)} m³. La altura usa ${vAdopt.toFixed(2)} m³.`),
    v(Number.isFinite(tRetMax) && tRetMax <= des.pretMax + 0.05 && tRetMax > 0, `Retención máxima ${Number.isFinite(tRetMax) ? tRetMax.toFixed(1) : "—"} min frente al periodo de ${des.pretMax.toFixed(0)} min.`),
    v(Number.isFinite(tRetMin) && tRetMin + 1e-6 >= des.pretMin, `Retención mínima ${Number.isFinite(tRetMin) ? tRetMin.toFixed(1) : "—"} min frente al periodo de ${des.pretMin.toFixed(0)} min.`),
  ] : [];
  return {
    k1, k2, qMaxDiario, qMm, qMh, qMaxc, qMinc, K, a, izq, der, cumple: hay && izq > der,
    A, B, C, k1a, k1b, K1, qb, vUtil, vAdopt, hHoja,
    tLlenMin, tLlenMax, tBombMin, tBombMax, tRetMax, tRetMin,
    area, hUtil, hTotal, dEcoCm, dEcoPulg: dEcoCm / 2.54, bre, veredictos,
  };
}

/** Hazen–Williams. Q en L/s, D en mm, S en m/m. S = [Q / (278,8 · C · D^2,63)]^(1/0,54). */
export function hazenS(qLps: number, c: number, dMm: number) {
  const d = dMm / 1000;
  const den = 278.8 * c * d ** 2.63;
  if (den <= 0 || qLps <= 0) return 0;
  return (qLps / den) ** (1 / 0.54);
}

export function impulsionaDesague(qb: number, des: DatosDesague, hEstatica: number) {
  const bre = bresse(qb, des.horasBombeo);
  const dVel = 2 * (qb / 1000 / 1.5 / Math.PI) ** 0.5;
  const espesor = (des.diamNom - des.diamInt) / 2;
  const acc = des.accesoriosEq.map((a) => {
    const leq = des.fDarcy > 0 ? (a.k * a.dMm) / (1000 * des.fDarcy) : 0;
    return { ...a, leq, leqTot: leq * a.n, h: perdidaMenor(a.k, a.n, velocidad(qb, des.diamInt)) };
  });
  const leqMetal = acc.reduce((s, a) => s + a.leqTot, 0);
  const sMetal = hazenS(qb, des.cMetal, 200);
  const sPvc = hazenS(qb, des.cPvc, des.diamInt);
  const sPvcExt = hazenS(qb, des.cPvc, des.diamNom);
  const hfMetal = sMetal * leqMetal;
  const hfPvc = sPvc * des.longPvc;
  const hfPvcExt = sPvcExt * des.longPvc;
  const hf = hfMetal + hfPvc;
  const hdt = (hf + hEstatica + des.presionSalida) * des.factorAltura;
  const ef = des.eficBomba > 0 ? des.eficBomba / 100 : 0;
  const hp = ef > 0 && des.factorElec > 0
    ? ((des.densidadAgua * 9.81 * (qb / 1000) * hdt) / (ef * 1000)) * 1.341 / des.factorElec
    : 0;
  const A = areaMm(des.diamInt);
  const V = A > 0 ? qb / 1000 / A : 0;
  const re = (V * des.diamInt) / 1000 / (des.nu / 1e6);
  const ksD = des.ks / des.diamInt;
  const { f, pasos, regimen } = colebrook(re, ksD);
  const hm = acc.reduce((s, a) => s + a.h, 0);
  const accDarcy = des.accesoriosDarcy.map((a) => ({ ...a, h: perdidaMenor(a.km, a.n, V) }));
  const hmHoja = accDarcy.reduce((s, a) => s + a.h, 0);
  const hfDarcy = (f * des.longPvc * V * V) / (des.diamInt / 1000) / (2 * 9.81);
  const H = hEstatica + hfDarcy + hm + des.presionSalida;
  const Hhoja = hEstatica + hfDarcy + hmHoja + des.presionSalida;
  const pKw = ef > 0 ? (des.densidadAgua * (qb / 1000) * 9.81 * H) / ef / 1000 : 0;
  const pKwHoja = ef > 0 ? (des.densidadAgua * (qb / 1000) * 9.81 * Hhoja) / ef / 1000 : 0;
  const pMotorKw = des.eficMotor > 0 ? pKw / des.eficMotor : 0;
  const pMotorHoja = des.eficMotor > 0 ? pKwHoja / des.eficMotor : 0;
  const cEmp = espesor > 0 ? Math.sqrt(2.23e6 / (1 + (0.923 * des.diamInt) / espesor)) : 0;
  const eM = espesor / 1000;
  const Di = des.diamInt / 1000;
  const cMod = eM > 0 ? 1452 / Math.sqrt(1 + (des.moduloAgua * Di) / (des.moduloTubo * eM)) : 0;
  const cDis = Math.max(cEmp, cMod);
  const hAriete = (cEmp * V) / 9.81;
  const hMod = (cMod * V) / 9.81;
  const hDis = (cDis * V) / 9.81;
  const T = cEmp > 0 ? (2 * des.longPvc) / cEmp : 0;
  const pMaxDiseno = hdt + hDis;
  const DeCelda = 3 * 0.025 + 2 * des.espesorAriete;
  const VwCelda = 1452 / Math.sqrt(1 + (des.moduloAgua * DeCelda) / (des.moduloTubo * des.espesorAriete));
  const d8 = 8 * 0.0254;
  const V8 = qb / 1000 / ((Math.PI / 4) * d8 * d8);
  const hCelda = (VwCelda * V8) / 9.81;
  const pMaxCelda = hCelda + hEstatica;
  const dva = qb > 0 ? Math.sqrt((4 * qb) / 1000 / (Math.PI * des.velValvula)) * (100 / 2.54) : 0;
  const dvaCom = valvulaComercial(dva);
  return {
    bre, dVel, espesor, acc, leqMetal, sMetal, sPvc, sPvcExt, hfMetal, hfPvc, hfPvcExt, hf, hEstatica, hdt, hp,
    A, V, re, ksD, f, pasos, regimen, hm, accDarcy, hmHoja, hfDarcy, H, Hhoja,
    pKw, pHp: pKw / 0.746, pKwHoja, pMotorKw, pMotorHp: pMotorKw / 0.746, pMotorHoja,
    cEmp, cMod, cDis, hAriete, hMod, hDis, T, pMaxDiseno,
    VwCelda, V8, hCelda, pMaxCelda, DeCelda, dva, dvaCom,
  };
}

export function lineaDesagueDe(qb: number, des: DatosDesague, hEst: number, libre: boolean) {
  const bre = bresse(qb, des.horasBombeo);
  const manual = tuboDe(des.diamNom, des.diamInt);
  if (!libre || !(qb > 0)) {
    const r = impulsionaDesague(qb, des, hEst);
    return { ...r, tubo: manual, bre, veredictos: veredictosDesague(r, manual, qb) };
  }
  const conV = PVC_C10
    .map((t) => ({ t, v: velocidad(qb, t.int) }))
    .filter((x) => x.v >= 0.6 - 1e-9 && x.v <= 2 + 1e-9)
    .sort((a, b) => a.t.ext - b.t.ext);
  const sobre = conV.filter((x) => x.t.ext >= bre.dEcoMm * 0.98);
  let pick = sobre[0] ?? conV[conV.length - 1] ?? null;
  if (!pick) {
    const r = impulsionaDesague(qb, des, hEst);
    return { ...r, tubo: manual, bre, veredictos: veredictosDesague(r, manual, qb) };
  }
  let r = impulsionaDesague(qb, { ...des, diamNom: pick.t.ext, diamInt: pick.t.int }, hEst);
  if (r.hdt > pick.t.pnM) {
    const mayores = conV.filter((x) => x.t.ext >= pick.t.ext);
    for (const m of mayores) {
      const rm = impulsionaDesague(qb, { ...des, diamNom: m.t.ext, diamInt: m.t.int }, hEst);
      pick = m;
      r = rm;
      if (rm.hdt <= m.t.pnM) break;
    }
  }
  return { ...r, tubo: pick.t, bre, veredictos: veredictosDesague(r, pick.t, qb) };
}

function tuboDe(ext: number, int: number): Tubo {
  const conocido = [...PVC_C10, ...PVC_C75, ...PVC_PN10].find((t) => Math.abs(t.ext - ext) < 0.05 && Math.abs(t.int - int) < 0.2);
  if (conocido) return conocido;
  return { nombre: `Ø ${ext} mm`, ext, int, e: (ext - int) / 2, pnM: 100, clase: "indicado" };
}

function veredictosDesague(r: ReturnType<typeof impulsionaDesague>, tubo: Tubo, qb: number): Veredicto[] {
  if (!(qb > 0)) return [];
  const cubreGolpe = r.pMaxDiseno <= tubo.pnM;
  return [
    v(r.V >= 0.6 && r.V <= 2, `Velocidad ${r.V.toFixed(2)} m/s en el interior ${tubo.int.toFixed(1)} mm (${tubo.nombre} ${tubo.clase}). El rango es 0,60 a 2,00 m/s.`),
    v(r.hdt <= tubo.pnM, `Altura dinámica total ${r.hdt.toFixed(2)} m frente a la clase ${tubo.clase} (${tubo.pnM.toFixed(0)} m).`),
    v(r.re > 2200, `Reynolds ${Math.round(r.re)} frente a 2 200. Por encima de ese valor el régimen es turbulento.`),
    v(cubreGolpe, `Presión con golpe de ariete ${r.pMaxDiseno.toFixed(1)} m frente a ${tubo.pnM.toFixed(0)} m de la clase ${tubo.clase}.${cubreGolpe ? "" : ` Se adopta válvula de alivio de ${r.dvaCom}".`}`),
  ];
}

export function datosAguaBase(qbPozo = 28): DatosAgua {
  return {
    densidad: 4.62,
    k1: 1.3,
    k2: 1.8,
    contribucion: 0.8,
    dotacion: 150,
    horasBombeo: 18,
    infiltracion: 0.1,
    pozos: [
      { nombre: "Pozo 01", qb: 28 },
      { nombre: "Pozo 02", qb: 25 },
      { nombre: "Pozo 03", qb: 25 },
    ],
    vel: 1.5,
    longPozo: 1850,
    ks: 0.0015,
    nu: 1.141,
    desnivel: 52 - 41 + 40,
    eficBomba: 79.7,
    densidadAgua: 999.1,
    presionSalida: 16,
    factorAltura: 1.05,
    eficMotor: 0.835,
    diametros: { d10: 172, d12: 271, d8: 172, d6: 144.6 },
    caudalesDia: { q10: qbPozo, q12: qbPozo, q8: qbPozo, q6: qbPozo },
    accesorios: [
      { nombre: 'Válvula check 8"', km: 3.58, n: 1, cual: "d8" },
      { nombre: 'Válvula compuerta 8"', km: 5.52, n: 1, cual: "d8" },
      { nombre: 'Unión Dresser 8"', km: 0.15, n: 1, cual: "d8" },
      { nombre: 'Codo 8" × 90°', km: 1.13, n: 1, cual: "d8" },
      { nombre: 'Curva 8" × 45°', km: 1.13, n: 2, cual: "d8" },
      { nombre: 'Codo 12" × 90°', km: 0.24, n: 3, cual: "d12" },
      { nombre: 'Curva 10" × 45°', km: 0.24, n: 2, cual: "d10" },
      { nombre: 'Curva 10" × 22,5°', km: 0.07, n: 3, cual: "d10" },
      { nombre: 'T 8"×6"', km: 0.45, n: 1, cual: "d8" },
      { nombre: 'T 12"×10"×6"', km: 0.45, n: 1, cual: "d10" },
      { nombre: 'Transición bridada 12"', km: 1.58, n: 1, cual: "d12" },
      { nombre: 'Reducción 10" a 8"', km: 5.47, n: 1, cual: "d10" },
      { nombre: 'Reducción 12" a 10"', km: 5.47, n: 1, cual: "d12" },
      { nombre: 'Válvula de aire 2"', km: 2.64, n: 2, cual: "d8" },
      { nombre: 'Caudalímetro 8"', km: 3.62, n: 1, cual: "d8" },
    ],
  };
}

export function datosDesagueBase(): DatosDesague {
  return {
    fMin: 0.7,
    pretMax: 30,
    pretMin: 10,
    relacionA: 5,
    volDisenado: 17.03,
    diamCamara: 3.5,
    alturaSeca: 0.1,
    alturaOperativa: 0.33,
    horasBombeo: 6,
    fDarcy: 0.022,
    longPvc: 3451,
    diamNom: 315,
    diamInt: 285,
    cMetal: 100,
    cPvc: 150,
    cotaSuccion: 16.742,
    cotaDescarga: 17.5,
    presionSalida: 2,
    eficBomba: 69.2,
    factorElec: 0.85,
    factorAltura: 1.1,
    ks: 0.0015,
    nu: 1.14,
    densidadAgua: 999.1,
    eficMotor: 0.9,
    accesoriosEq: [
      { nombre: "Codo 200 mm × 90°", n: 2, k: 1.25, dMm: 200 },
      { nombre: "Codo 200 mm × 45°", n: 2, k: 0.42, dMm: 200 },
      { nombre: "Válvula check 200 mm", n: 1, k: 1.86, dMm: 200 },
      { nombre: "Válvula compuerta 200 mm", n: 1, k: 0.19, dMm: 200 },
    ],
    accesoriosDarcy: [
      { nombre: 'Válvula check 8"', km: 3.58, n: 1 },
      { nombre: 'Válvula compuerta 8"', km: 5.52, n: 1 },
      { nombre: 'Unión Dresser 8"', km: 0.15, n: 1 },
      { nombre: 'Codo 8" × 90°', km: 1.13, n: 2 },
      { nombre: 'Y 8"', km: 0.24, n: 1 },
      { nombre: 'Válvula compuerta 8" (2)', km: 5.52, n: 1 },
      { nombre: 'Válvula de aire 2"', km: 2.64, n: 1 },
      { nombre: 'Curva 8" × 45°', km: 0.24, n: 2 },
      { nombre: 'Codo 12" × 90°', km: 1.13, n: 2 },
      { nombre: 'Curva 12" × 45°', km: 0.24, n: 7 },
      { nombre: 'Curva 12" × 22,5°', km: 0.07, n: 23 },
      { nombre: 'Transición bridada 12"', km: 1.58, n: 1 },
      { nombre: 'Reducción 8" a 6"', km: 5.47, n: 1 },
      { nombre: 'Reducción 12" a 8"', km: 5.47, n: 1 },
    ],
    moduloAgua: 2.15e4,
    moduloTubo: 2.47e4,
    espesorAriete: 0.0053,
    velValvula: 6,
    numBombas: 2,
  };
}
