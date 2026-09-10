import type { ValorItem } from "./types";
import { uidItem } from "./state";

/** Parser CSV mínimo: soporta comillas, coma/punto y coma/tab como separador y BOM de Excel. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sample = clean.slice(0, 2000);
  const delim = (sample.match(/;/g)?.length || 0) > (sample.match(/,/g)?.length || 0) ? ";" : sample.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toCsvField(v: string | number) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportPeriodoCsv(items: { codigo: string; descripcion: string; und: string; metradoContractual: number; precioUnitario: number; metradoAnterior: number; metradoAcumulado: number; metradoPeriodo: number; montoPeriodo: number; montoAcumulado: number; avancePct: number }[]) {
  const headers = [
    "Codigo",
    "Descripcion",
    "Unidad",
    "Metrado contractual",
    "Precio unitario",
    "Metrado anterior",
    "Metrado periodo",
    "Metrado acumulado",
    "Monto periodo",
    "Monto acumulado",
    "% Avance",
  ];
  const lines = [headers.map(toCsvField).join(",")];
  for (const it of items) {
    lines.push(
      [
        it.codigo,
        it.descripcion,
        it.und,
        it.metradoContractual,
        it.precioUnitario,
        it.metradoAnterior,
        it.metradoPeriodo,
        it.metradoAcumulado,
        it.montoPeriodo,
        it.montoAcumulado,
        it.avancePct.toFixed(2),
      ]
        .map(toCsvField)
        .join(","),
    );
  }
  return "﻿" + lines.join("\n");
}

/** Plantilla en blanco (Código, Descripción, Unidad, Metrado periodo) para llenar en Excel y volver a importar. */
export function exportPlantillaCsv(items: { codigo: string; descripcion: string; und: string }[]) {
  const headers = ["Codigo", "Descripcion", "Unidad", "Metrado periodo"];
  const lines = [headers.map(toCsvField).join(",")];
  for (const it of items) {
    lines.push([it.codigo, it.descripcion, it.und, ""].map(toCsvField).join(","));
  }
  return "﻿" + lines.join("\n");
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

const HEADER_ALIASES: Record<string, string[]> = {
  codigo: ["codigo", "código", "item", "partida"],
  metrado: ["metrado periodo", "metrado ejecutado", "ejecutado", "metrado", "cantidad"],
  descripcion: ["descripcion", "descripción", "partida"],
  und: ["unidad", "und", "ud"],
  pu: ["precio unitario", "p.u.", "pu"],
};

/** Lee un CSV (exportado de Excel) y devuelve el metrado ejecutado por código, para fusionar en el periodo actual. */
export function leerCsvEjecucion(text: string): { codigo: string; metrado: number; descripcion?: string; und?: string; pu?: number }[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map(norm);
  const idx = (aliases: string[]) => header.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
  const iCod = idx(HEADER_ALIASES.codigo);
  const iMet = idx(HEADER_ALIASES.metrado);
  const iDesc = idx(HEADER_ALIASES.descripcion);
  const iUnd = idx(HEADER_ALIASES.und);
  const iPu = idx(HEADER_ALIASES.pu);
  if (iCod < 0 || iMet < 0) return [];
  const out: { codigo: string; metrado: number; descripcion?: string; und?: string; pu?: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const codigo = (r[iCod] || "").trim();
    if (!codigo) continue;
    const metrado = Number(String(r[iMet] || "0").replace(/,/g, "."));
    out.push({
      codigo,
      metrado: Number.isFinite(metrado) ? metrado : 0,
      descripcion: iDesc >= 0 ? r[iDesc] : undefined,
      und: iUnd >= 0 ? r[iUnd] : undefined,
      pu: iPu >= 0 ? Number(String(r[iPu] || "0").replace(/,/g, ".")) || undefined : undefined,
    });
  }
  return out;
}

const HEADER_ALIASES_IR: Record<string, string[]> = {
  ref: ["letra", "monomio", "codigo iu", "código iu", "codigo", "iu", "indice", "índice"],
  ir: ["ir", "indice ir", "índice ir", "ir mes valorizacion", "ir (mes de valorizacion)"],
};

/** Lee un CSV con el índice Ir por monomio (letra, código IU o número de índice), para el reajuste por fórmula polinómica. */
export function leerCsvIndicesIr(text: string): { ref: string; ir: number }[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map(norm);
  const idx = (aliases: string[]) => header.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
  const iRef = idx(HEADER_ALIASES_IR.ref);
  const iIr = idx(HEADER_ALIASES_IR.ir);
  if (iRef < 0 || iIr < 0) return [];
  const out: { ref: string; ir: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const ref = (r[iRef] || "").trim();
    if (!ref) continue;
    const ir = Number(String(r[iIr] || "0").replace(/,/g, "."));
    out.push({ ref, ir: Number.isFinite(ir) ? ir : 0 });
  }
  return out;
}

const HEADER_ALIASES_PROG: Record<string, string[]> = {
  ref: ["periodo", "valorizacion", "valorización", "nombre", "n°", "numero", "número", "item"],
  hasta: ["hasta", "al", "fecha"],
};

/** Lee un CSV con el programado acumulado (% o monto) por periodo, para la curva S sin depender del cronograma (Gantt). */
export function leerCsvProgramado(text: string): { ref?: string; hasta?: string; pct?: number; monto?: number }[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map(norm);
  const idx = (aliases: string[]) => header.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
  const iRef = idx(HEADER_ALIASES_PROG.ref);
  const iHasta = idx(HEADER_ALIASES_PROG.hasta);
  const iPct = header.findIndex((h) => h.includes("%"));
  const iMonto = header.findIndex((h, i) => i !== iPct && (h.includes("monto") || h.includes("s/") || h.includes("soles")));
  if (iPct < 0 && iMonto < 0) return [];
  const num = (s: string) => {
    const n = Number(String(s || "").replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : undefined;
  };
  const out: { ref?: string; hasta?: string; pct?: number; monto?: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const ref = iRef >= 0 ? (r[iRef] || "").trim() : undefined;
    const hasta = iHasta >= 0 ? (r[iHasta] || "").trim() : undefined;
    if (!ref && !hasta) continue;
    out.push({ ref: ref || undefined, hasta: hasta || undefined, pct: iPct >= 0 ? num(r[iPct]) : undefined, monto: iMonto >= 0 ? num(r[iMonto]) : undefined });
  }
  return out;
}

const HEADER_ALIASES_FORMULA: Record<string, string[]> = {
  letra: ["letra", "monomio"],
  codigo: ["codigo iu", "código iu", "iu", "indice", "índice", "codigo"],
  coef: ["coeficiente", "coef", "participacion", "participación", "%"],
  io: ["io", "indice io", "índice io", "io (mes base)"],
};

/** Lee un CSV con la fórmula polinómica completa (letra, código IU, coeficiente, Io) — por ejemplo, copiada del
 *  expediente técnico — para armar la fórmula manual de Valorizaciones sin depender del presupuesto. */
export function leerCsvFormulaManual(text: string): { letra?: string; codigoIU: number; coeficiente: number; io: number }[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map(norm);
  const idx = (aliases: string[]) => header.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
  const iLetra = idx(HEADER_ALIASES_FORMULA.letra);
  const iCodigo = idx(HEADER_ALIASES_FORMULA.codigo);
  const iCoef = idx(HEADER_ALIASES_FORMULA.coef);
  const iIo = idx(HEADER_ALIASES_FORMULA.io);
  if (iCodigo < 0 || iCoef < 0) return [];
  const num = (s: string) => {
    const n = Number(String(s || "0").replace(/%/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  };
  const out: { letra?: string; codigoIU: number; coeficiente: number; io: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const codigoIU = Math.round(num(r[iCodigo]));
    if (!codigoIU) continue;
    let coeficiente = num(r[iCoef]);
    if (coeficiente > 1) coeficiente /= 100;
    out.push({
      letra: iLetra >= 0 ? (r[iLetra] || "").trim() || undefined : undefined,
      codigoIU,
      coeficiente,
      io: iIo >= 0 ? num(r[iIo]) || 100 : 100,
    });
  }
  return out;
}

/** Fusiona lo leído del CSV en los ítems del periodo: si el código existe, actualiza metradoPeriodo; si no, lo agrega. */
export function fusionarEjecucionCsv(items: ValorItem[], leidos: ReturnType<typeof leerCsvEjecucion>): ValorItem[] {
  const byCodigo = new Map(items.map((it) => [it.codigo.trim().toLowerCase(), it]));
  const next = [...items];
  for (const row of leidos) {
    const key = row.codigo.trim().toLowerCase();
    const existente = byCodigo.get(key);
    if (existente) {
      const i = next.findIndex((it) => it.id === existente.id);
      next[i] = { ...next[i], metradoPeriodo: row.metrado };
    } else {
      const nuevo: ValorItem = {
        id: uidItem(),
        codigo: row.codigo,
        descripcion: row.descripcion || row.codigo,
        und: row.und || "und",
        metradoContractual: 0,
        precioUnitario: row.pu || 0,
        metradoAnterior: 0,
        metradoPeriodo: row.metrado,
        tipo: "adicional",
      };
      next.push(nuevo);
      byCodigo.set(key, nuevo);
    }
  }
  return next;
}
