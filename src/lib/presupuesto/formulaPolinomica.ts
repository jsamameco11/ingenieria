import { calcularPresupuesto } from "./engine";
import { codigoIU, IU_BY_CODIGO, LETRAS_MONOMIO, nombreIU, simboloIU } from "./indicesUnificados";
import type { FormulaPolinomicaState, PresupuestoState } from "./types";

export type IncidenciaIU = {
  iu: number;
  nombre: string;
  simbolo: string;
  monto: number;
  pct: number;
  absorbido: boolean;
  destino: number;
  destinoNombre: string;
  letra?: string;
  manual: boolean;
};

export type Monomio = {
  letra: string;
  iu: number;
  nombre: string;
  simbolo: string;
  coeficiente: number;
  io: number;
  ir: number;
  ratio: number;
  aporte: number;
  monto: number;
};

export type FormulaResultado = {
  costoDirecto: number;
  incidencias: IncidenciaIU[];
  monomios: Monomio[];
  k: number;
  texto: string;
  textoExpandido: string;
  sumaCoef: number;
  valorizacion: number;
  reajustado: number;
  diferencial: number;
  creada: boolean;
  paramsDesfasados: boolean;
  nuevasIncidencias: number;
  topeAplicado: boolean;
};

export function r3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function r4(n: number) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export function incidenciasPorIU(state: PresupuestoState) {
  const calc = calcularPresupuesto(state);
  const montos = new Map<number, number>();
  for (const l of calc.lineas) {
    for (const rec of l.apu.recursos) {
      const iu = rec.insumo.iu || 39;
      montos.set(iu, (montos.get(iu) ?? 0) + rec.parcial * l.linea.metrado);
    }
  }
  const cd = calc.costoDirecto;
  const incidencias: IncidenciaIU[] = [...montos.entries()]
    .map(([iu, monto]) => ({
      iu,
      nombre: nombreIU(iu),
      simbolo: simboloIU(iu),
      monto,
      pct: cd > 0 ? (monto / cd) * 100 : 0,
      absorbido: false,
      destino: iu,
      destinoNombre: nombreIU(iu),
      manual: false,
    }))
    .sort((a, b) => b.monto - a.monto);
  return { calc, incidencias, costoDirecto: cd };
}

function maxNDe(formula: FormulaPolinomicaState) {
  return Math.min(8, Math.max(1, formula.maxMonomios | 0));
}

/** Mapa IU origen → destino según umbral y tope de monomios (D.S. 011-79-VC). */
export function destinosAutomaticos(
  incidencias: IncidenciaIU[],
  costoDirecto: number,
  formula: FormulaPolinomicaState
): Record<string, number> {
  const umbral = Math.max(0, formula.umbralPct) / 100;
  const tagged = incidencias.map((x) => ({
    iu: x.iu,
    monto: x.monto,
    dest: costoDirecto > 0 && x.monto / costoDirecto < umbral && x.iu !== 39 ? 39 : x.iu,
  }));
  return aplicarTopeMonomios(tagged, maxNDe(formula));
}

function aplicarTopeMonomios(
  tagged: { iu: number; monto: number; dest: number }[],
  maxN: number
): Record<string, number> {
  const buckets = new Map<number, number>();
  for (const x of tagged) buckets.set(x.dest, (buckets.get(x.dest) ?? 0) + x.monto);
  if (buckets.size > maxN) {
    const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
    const keep = new Set(ranked.slice(0, maxN - 1).map(([iu]) => iu));
    for (const x of tagged) {
      if (!keep.has(x.dest)) x.dest = 39;
    }
  }
  const out: Record<string, number> = {};
  for (const x of tagged) out[String(x.iu)] = x.dest;
  return out;
}

function destinosEfectivos(
  incidencias: IncidenciaIU[],
  costoDirecto: number,
  formula: FormulaPolinomicaState
): { dest: Record<string, number>; topeAplicado: boolean; nuevas: number } {
  const auto = destinosAutomaticos(incidencias, costoDirecto, formula);
  if (!formula.creada || !formula.destino || Object.keys(formula.destino).length === 0) {
    return { dest: auto, topeAplicado: false, nuevas: 0 };
  }
  let nuevas = 0;
  const tagged = incidencias.map((x) => {
    const key = String(x.iu);
    const tiene = Object.prototype.hasOwnProperty.call(formula.destino, key);
    if (!tiene) nuevas += 1;
    return {
      iu: x.iu,
      monto: x.monto,
      dest: tiene ? formula.destino[key] : auto[key] ?? x.iu,
    };
  });
  const before = tagged.map((x) => x.dest);
  const dest = aplicarTopeMonomios(tagged, maxNDe(formula));
  const topeAplicado = tagged.some((x, i) => x.dest !== before[i]);
  return { dest, topeAplicado, nuevas };
}

export function contarDestinos(destino: Record<string, number>, ius: number[]) {
  const set = new Set<number>();
  for (const iu of ius) set.add(destino[String(iu)] ?? iu);
  return set.size;
}

export function puedeConvertirEnMonomio(
  destino: Record<string, number>,
  incidencias: { iu: number }[],
  seleccion: number[],
  maxMonomios: number
) {
  const next = { ...destino };
  for (const iu of seleccion) next[String(iu)] = iu;
  const n = contarDestinos(
    next,
    incidencias.map((x) => x.iu)
  );
  return n <= Math.min(8, Math.max(1, maxMonomios | 0));
}

export function patchDestino(
  destino: Record<string, number>,
  ius: number[],
  destIu: number
): Record<string, number> {
  const next = { ...destino };
  for (const iu of ius) next[String(iu)] = destIu;
  return next;
}

export function estadoAlCrearFormula(
  formula: FormulaPolinomicaState,
  incidencias: IncidenciaIU[],
  costoDirecto: number
): FormulaPolinomicaState {
  const destino = destinosAutomaticos(incidencias, costoDirecto, formula);
  return {
    ...formula,
    creada: true,
    destino,
    coeficientes: {},
    generadaCon: { umbralPct: formula.umbralPct, maxMonomios: formula.maxMonomios },
  };
}

export function estadoAlBorrarFormula(formula: FormulaPolinomicaState): FormulaPolinomicaState {
  return {
    ...formula,
    creada: false,
    destino: {},
    coeficientes: {},
    generadaCon: null,
  };
}

export function armarMonomios(
  incidencias: IncidenciaIU[],
  costoDirecto: number,
  formula: FormulaPolinomicaState
): { incidencias: IncidenciaIU[]; monomios: Monomio[]; topeAplicado: boolean; nuevasIncidencias: number } {
  const auto = destinosAutomaticos(incidencias, costoDirecto, formula);
  const { dest, topeAplicado, nuevas } = destinosEfectivos(incidencias, costoDirecto, formula);

  const buckets = new Map<number, number>();
  for (const x of incidencias) {
    const d = dest[String(x.iu)] ?? x.iu;
    buckets.set(d, (buckets.get(d) ?? 0) + x.monto);
  }

  const rows = [...buckets.entries()]
    .map(([iu, monto]) => ({ iu, monto, pct: costoDirecto > 0 ? monto / costoDirecto : 0 }))
    .sort((a, b) => b.monto - a.monto);

  let coefs = rows.map((r) => {
    const manual = formula.coeficientes?.[String(r.iu)];
    return Number.isFinite(manual) ? r3(manual as number) : r3(r.pct);
  });
  const drift = r3(1 - coefs.reduce((s, c) => s + c, 0));
  if (coefs.length) {
    const locked = new Set(
      rows
        .map((r, i) => (formula.coeficientes && String(r.iu) in formula.coeficientes ? i : -1))
        .filter((i) => i >= 0)
    );
    let iAdj = coefs.reduce((best, c, i) => (c > coefs[best] ? i : best), 0);
    const unlocked = coefs.map((_, i) => i).filter((i) => !locked.has(i));
    if (unlocked.length) {
      iAdj = unlocked.reduce((best, i) => (coefs[i] > coefs[best] ? i : best), unlocked[0]);
    }
    coefs[iAdj] = r3(coefs[iAdj] + drift);
  }

  const monomios: Monomio[] = rows.map((r, i) => {
    const key = String(r.iu);
    const io = formula.indicesIo[key] || IU_BY_CODIGO[r.iu]?.io || 100;
    const ir = formula.indicesIr[key] || IU_BY_CODIGO[r.iu]?.ir || 100;
    const ratio = io > 0 ? ir / io : 1;
    const coeficiente = coefs[i] ?? 0;
    return {
      letra: LETRAS_MONOMIO[i] ?? String.fromCharCode(97 + i),
      iu: r.iu,
      nombre: nombreIU(r.iu),
      simbolo: simboloIU(r.iu),
      coeficiente,
      io,
      ir,
      ratio,
      aporte: coeficiente * ratio,
      monto: r.monto,
    };
  });

  const letraDe = new Map(monomios.map((m) => [m.iu, m.letra]));
  const tagged = incidencias.map((x) => {
    const destino = dest[String(x.iu)] ?? x.iu;
    const manual = Boolean(formula.creada && dest[String(x.iu)] !== auto[String(x.iu)]);
    return {
      ...x,
      destino,
      destinoNombre: nombreIU(destino),
      absorbido: destino !== x.iu,
      letra: letraDe.get(destino),
      manual,
    };
  });

  return { incidencias: tagged, monomios, topeAplicado, nuevasIncidencias: nuevas };
}

export function calcularFormula(state: PresupuestoState): FormulaResultado {
  const { incidencias: raw, costoDirecto } = incidenciasPorIU(state);
  const formula = state.formula;
  const { incidencias, monomios, topeAplicado, nuevasIncidencias } = armarMonomios(raw, costoDirecto, formula);
  const oficial = Boolean(formula.creada);
  const usados = oficial ? monomios : [];
  const k = r4(usados.reduce((s, m) => s + m.aporte, 0));
  const sumaCoef = r3(usados.reduce((s, m) => s + m.coeficiente, 0));
  const texto =
    !oficial || usados.length === 0
      ? "Fórmula no generada"
      : `K = ${usados.map((m) => `${m.coeficiente.toFixed(3)} (${m.simbolo}r/${m.simbolo}o)`).join(" + ")}`;
  const textoExpandido =
    !oficial
      ? "Cree la fórmula polinómica a partir de las incidencias del costo directo."
      : usados.length === 0
        ? "Sin costo directo. Cargue partidas para armar la fórmula."
        : `K = ${usados
            .map(
              (m) =>
                `${m.letra}(${m.simbolo}r/${m.simbolo}o)    ${m.letra} = ${m.coeficiente.toFixed(3)}  ·  IU ${codigoIU(m.iu)} ${m.nombre}`
            )
            .join("\n")}`;
  const val = formula.valorizacion > 0 ? formula.valorizacion : costoDirecto;
  const kUse = oficial && usados.length ? k : 1;
  const reajustado = r4(val * kUse);
  const paramsDesfasados = Boolean(
    oficial &&
      formula.generadaCon &&
      (formula.generadaCon.umbralPct !== formula.umbralPct || formula.generadaCon.maxMonomios !== formula.maxMonomios)
  );
  return {
    costoDirecto,
    incidencias,
    monomios: oficial ? monomios : [],
    k: kUse,
    texto,
    textoExpandido,
    sumaCoef: oficial ? sumaCoef : 0,
    valorizacion: val,
    reajustado,
    diferencial: r4(reajustado - val),
    creada: oficial,
    paramsDesfasados,
    nuevasIncidencias,
    topeAplicado,
  };
}

export function textoTrato(x: IncidenciaIU, creada: boolean) {
  if (!creada) {
    return x.absorbido
      ? `Sugerido · absorber en IU ${codigoIU(x.destino)}`
      : `Sugerido · monomio ${x.letra ?? ""}`.trim();
  }
  if (x.absorbido) {
    return `Agrupado en IU ${codigoIU(x.destino)} (${simboloIU(x.destino)})`;
  }
  return `Monomio ${x.letra ?? ""}`.trim();
}

/** Destinos editables de una incidencia: monomio propio, IU 39 y monomios ya formados. */
export function opcionesAgrupacion(x: IncidenciaIU, monomios: Monomio[]) {
  const opts: { iu: number; label: string }[] = [
    { iu: x.iu, label: `Monomio propio · IU ${codigoIU(x.iu)} (${x.simbolo})` },
  ];
  const seen = new Set<number>([x.iu]);
  const push = (iu: number, label: string) => {
    if (seen.has(iu)) return;
    seen.add(iu);
    opts.push({ iu, label });
  };
  push(39, "IU 39 · I · Índice general (absorción)");
  for (const m of monomios) {
    push(m.iu, `Monomio ${m.letra} · IU ${codigoIU(m.iu)} · ${m.simbolo} · ${m.nombre}`);
  }
  if (!seen.has(x.destino)) {
    push(x.destino, `IU ${codigoIU(x.destino)} · ${simboloIU(x.destino)} · ${nombreIU(x.destino)}`);
  }
  return opts;
}

export function mesTexto(ym: string) {
  const [y, m] = (ym || "").split("-").map(Number);
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "setiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  if (!y || !m) return ym || "—";
  return `${meses[m - 1]} de ${y}`;
}
