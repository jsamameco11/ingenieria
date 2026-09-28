/**
 * Lee la cantidad de lotes (y los coeficientes que vengan junto) para la
 * memoria de agua y desagüe. Acepta una columna Lotes, una cantidad por
 * etapa, o el Excel del expediente: la hoja de etapas ya trae el conteo
 * escrito y la hoja de caudal trae densidad, dotación y pozos.
 */
import ExcelJS from "exceljs";

export type CamposAguaImport = {
  densidad?: number;
  k1?: number;
  k2?: number;
  contribucion?: number;
  dotacion?: number;
  horasBombeo?: number;
  infiltracion?: number;
};

export type LecturaAgua = {
  lotes: number[];
  agua: CamposAguaImport;
  pozos: { nombre: string; qb: number }[];
  aviso: string;
};

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

function numCampo(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(/%$/, "");
  if (!t || /[a-zA-Z]/.test(t)) return null;
  const neg = t.startsWith("(") && t.endsWith(")");
  const s = neg ? t.slice(1, -1) : t;
  let n: number;
  if (s.includes(",") && s.includes(".")) n = Number(s.replace(/,/g, ""));
  else if (s.includes(",") && !s.includes(".")) n = Number(s.replace(",", "."));
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = Number(s.replace(/\./g, ""));
  else n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function plano(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function textoCelda(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("formula" in o) return "";
    if ("result" in o && o.result != null && typeof o.result !== "object") return String(o.result);
    if ("text" in o && o.text != null) return String(o.text);
    if (Array.isArray(o.richText)) return o.richText.map((x) => String((x as { text?: string }).text ?? "")).join("");
  }
  return "";
}

function matrizDeHoja(hoja: ExcelJS.Worksheet): string[][] {
  const filas: string[][] = [];
  const hasta = Math.max(hoja.columnCount, 1);
  hoja.eachRow((row) => {
    const linea: string[] = [];
    for (let c = 1; c <= hasta; c++) linea.push(textoCelda(row.getCell(c).value));
    while (linea.length && !linea[linea.length - 1]) linea.pop();
    filas.push(linea);
  });
  return filas;
}

function campoDe(texto: string): keyof CamposAguaImport | null {
  const t = plano(texto);
  if (!t) return null;
  if (/densidad/.test(t)) return "densidad";
  if (/\bk1\b/.test(t) || /variacion diaria/.test(t)) return "k1";
  if (/\bk2\b/.test(t) || /variacion horaria/.test(t)) return "k2";
  if (/contribucion/.test(t)) return "contribucion";
  if (/dotacion/.test(t)) return "dotacion";
  if (/infiltr/.test(t)) return "infiltracion";
  if (/^horas$/.test(t) || /horas de bombeo/.test(t) || /para t/.test(t)) return "horasBombeo";
  return null;
}

function numeroFila(fila: string[], etiqueta: string): number | null {
  const nums = fila.map(numCampo).filter((x): x is number => x !== null);
  if (!nums.length) return null;
  if (campoDe(etiqueta) === "infiltracion") {
    const n = nums[nums.length - 1];
    if (n > 1 && n <= 100) return n / 100;
    return n;
  }
  return nums[nums.length - 1];
}

function pozoDe(fila: string[]): { nombre: string; qb: number } | null {
  const m = fila.join(" ").match(/pozo\s*0*(\d+)/i);
  if (!m) return null;
  const idx = Number(m[1]);
  const nums = fila.map(numCampo).filter((x): x is number => x !== null && x > 0 && x < 500);
  const flujos = nums.filter((x) => x !== idx);
  const qb = flujos.length ? flujos[flujos.length - 1] : null;
  if (qb == null) return null;
  return { nombre: `Pozo ${String(idx).padStart(2, "0")}`, qb };
}

function etapasEnFila(filas: string[][]): number[] | null {
  for (let r = 0; r < Math.min(filas.length, 8); r++) {
    const cols: number[] = [];
    let bloqueHasta = -1;
    filas[r].forEach((c, i) => {
      if (!/etapa/i.test(c) || i <= bloqueHasta) return;
      cols.push(i);
      bloqueHasta = i;
      while (/etapa/i.test(filas[r][bloqueHasta + 1] ?? "")) bloqueHasta++;
    });
    if (cols.length < 2) continue;
    const sums: number[] = [];
    for (const col of cols) {
      let s = 0;
      let n = 0;
      for (let rr = r + 1; rr < filas.length; rr++) {
        const raw = filas[rr][col + 2] ?? "";
        if (/^=?\s*sum\b/i.test(raw)) break;
        const num = numCampo(raw);
        if (num === null || num < 0 || num > 5000) continue;
        s += num;
        n++;
      }
      sums.push(n ? Math.round(s) : 0);
    }
    if (sums.some((x) => x > 0)) {
      while (sums.length > 1 && sums[sums.length - 1] === 0) sums.pop();
      return sums.slice(0, ROMANOS.length);
    }
  }
  return null;
}

function columnaLotes(filas: string[][]): number[] | null {
  for (let r = 0; r < filas.length; r++) {
    const i = filas[r].findIndex((c) => {
      const t = plano(c);
      return t.length > 0 && t.length <= 32 && /(^|\s)lotes$/.test(t) && !/habit/.test(t);
    });
    if (i < 0) continue;
    const nums: number[] = [];
    for (let rr = r + 1; rr < filas.length; rr++) {
      const marca = plano(filas[rr].join(" "));
      if (/\btotal\b/.test(marca) || campoDe(filas[rr].join(" ")) || /pozo/.test(marca)) break;
      const num = numCampo(filas[rr][i] ?? "");
      if (num === null) {
        if (nums.length) break;
        continue;
      }
      if (num < 0 || num > 20000) continue;
      nums.push(Math.round(num));
    }
    if (nums.some((x) => x > 0)) {
      while (nums.length > 1 && nums[nums.length - 1] === 0) nums.pop();
      return nums.slice(0, ROMANOS.length);
    }
  }
  return null;
}

function esEtiquetaEtapa(texto: string) {
  const t = plano(texto);
  if (!t) return false;
  return /etapa/.test(t) || /^(i|ii|iii|iv|v|vi|vii|viii|ix)$/.test(t) || /^[1-9]$/.test(t);
}

function lotesSueltos(filas: string[][], usadas: Set<number>): number[] | null {
  const nums: number[] = [];
  let filasConNumero = 0;
  for (let r = 0; r < filas.length; r++) {
    const fila = filas[r];
    if (fila.every((c) => !c.trim())) continue;
    const valores = fila.map(numCampo).filter((x): x is number => x !== null);
    if (valores.length) filasConNumero++;
    if (usadas.has(r) || valores.length !== 1) continue;
    const n = valores[0];
    if (n < 1 || n > 20000 || Math.abs(n - Math.round(n)) > 0.01) continue;
    const resto = fila.filter((c) => numCampo(c) === null && c.trim());
    if (resto.length && !resto.every(esEtiquetaEtapa)) continue;
    nums.push(Math.round(n));
  }
  if (!nums.length || filasConNumero > nums.length + usadas.size + 2) return null;
  return nums.slice(0, ROMANOS.length);
}

function leerFilas(filas: string[][]): { lotes: number[] | null; agua: CamposAguaImport; pozos: { nombre: string; qb: number }[]; usadas: Set<number> } {
  const agua: CamposAguaImport = {};
  const pozos: { nombre: string; qb: number }[] = [];
  const usadas = new Set<number>();
  filas.forEach((fila, r) => {
    const etiqueta = fila.filter((c) => numCampo(c) === null).join(" ");
    const campo = campoDe(etiqueta) ?? campoDe(fila.join(" "));
    if (campo) {
      const n = numeroFila(fila, etiqueta);
      if (n !== null && n >= 0) {
        agua[campo] = n;
        usadas.add(r);
      }
    }
    const pozo = pozoDe(fila);
    if (pozo) {
      pozos.push(pozo);
      usadas.add(r);
    }
  });
  return { lotes: etapasEnFila(filas) ?? columnaLotes(filas), agua, pozos, usadas };
}

export function leerTextoAgua(texto: string): LecturaAgua {
  const lineas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const filas = lineas.map((l) => {
    const sep = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
    return l.split(sep).map((c) => c.trim());
  });
  return cerrarLectura(filas.length ? [filas] : [], "");
}

function cerrarLectura(hojas: string[][][], origen: string): LecturaAgua {
  const agua: CamposAguaImport = {};
  const pozos: { nombre: string; qb: number }[] = [];
  let lotes: number[] | null = null;
  const sueltos: number[][] = [];
  for (const filas of hojas) {
    const leido = leerFilas(filas);
    if (!lotes && leido.lotes?.length) lotes = leido.lotes;
    for (const [k, val] of Object.entries(leido.agua) as [keyof CamposAguaImport, number][]) {
      if (agua[k] == null) agua[k] = val;
    }
    for (const p of leido.pozos) {
      if (!pozos.some((x) => x.nombre === p.nombre)) pozos.push(p);
    }
    if (!leido.lotes?.length) {
      const s = lotesSueltos(filas, leido.usadas);
      if (s?.length) sueltos.push(s);
    }
  }
  if (!lotes && sueltos.length === 1) lotes = sueltos[0];
  const partes: string[] = [];
  if (lotes?.length) {
    const total = lotes.reduce((s, n) => s + n, 0);
    const det = lotes.map((n, i) => `${ROMANOS[i] ?? i + 1}: ${n.toLocaleString("es-PE")}`).join(", ");
    partes.push(`${lotes.length === 1 ? "1 etapa" : `${lotes.length} etapas`} con ${total.toLocaleString("es-PE")} lotes (${det})`);
  }
  const coef: string[] = [];
  if (agua.densidad != null) coef.push(`densidad ${agua.densidad.toLocaleString("es-PE")} hab/viv`);
  if (agua.dotacion != null) coef.push(`dotación ${agua.dotacion.toLocaleString("es-PE")} L/hab·día`);
  if (agua.k1 != null) coef.push(`k1 ${agua.k1.toLocaleString("es-PE")}`);
  if (agua.k2 != null) coef.push(`k2 ${agua.k2.toLocaleString("es-PE")}`);
  if (agua.contribucion != null) coef.push(`contribución ${agua.contribucion.toLocaleString("es-PE")}`);
  if (agua.infiltracion != null) coef.push(`infiltración ${agua.infiltracion.toLocaleString("es-PE")}`);
  if (agua.horasBombeo != null) coef.push(`${agua.horasBombeo.toLocaleString("es-PE")} h de bombeo`);
  if (pozos.length) coef.push(pozos.map((p) => `${p.nombre} ${p.qb.toLocaleString("es-PE")} L/s`).join(", "));
  const cabeza = origen ? `${origen}: ` : "";
  if (!lotes?.length && !coef.length) {
    return {
      lotes: [],
      agua: {},
      pozos: [],
      aviso: `${cabeza}No se encontró la cantidad de lotes. Use una columna Lotes, una cantidad por fila o el Excel del expediente con la hoja de etapas.`,
    };
  }
  const aviso = [
    cabeza + (partes[0] ? `Se importó ${partes[0]}.` : "Se importaron coeficientes."),
    coef.length ? coef.join(", ") + "." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { lotes: lotes ?? [], agua, pozos, aviso };
}

export async function leerArchivoAgua(file: File): Promise<LecturaAgua> {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".xlsx") || nombre.endsWith(".xls")) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer() as unknown as ExcelJS.Buffer);
      const hojas = wb.worksheets.map(matrizDeHoja).filter((f) => f.length);
      if (!hojas.length) return { lotes: [], agua: {}, pozos: [], aviso: "El libro no tiene hojas con datos." };
      return cerrarLectura(hojas, file.name);
    } catch {
      return {
        lotes: [],
        agua: {},
        pozos: [],
        aviso: "No se pudo leer el libro. Guárdelo como CSV o como Excel .xlsx y vuelva a importarlo.",
      };
    }
  }
  const texto = await file.text();
  const leido = leerTextoAgua(texto);
  return { ...leido, aviso: leido.aviso };
}
