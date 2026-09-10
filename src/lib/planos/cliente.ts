import {
  esCategoriaMinsa,
  partidaPermitidaEnCategoria,
  textoCategoriaParaPrompt,
  type CategoriaMinsa,
} from "../presupuesto/categoriasMinsa";
import { ESPECIALIDAD_META, type EspecialidadPre } from "../presupuesto/types";
import { PARTIDAS } from "../presupuesto/partidas";
import type { LecturaGrok, PaginaRaster } from "./types";

export function partidasDeEspecialidad(esp: EspecialidadPre | "todas", categoriaMinsa?: CategoriaMinsa | null) {
  const base = !esp || esp === "todas" ? PARTIDAS : PARTIDAS.filter((p) => p.especialidad === esp);
  if (!categoriaMinsa) return base;
  return base.filter((p) => partidaPermitidaEnCategoria(p.codigo, categoriaMinsa));
}

export function catalogoParaGrok(esp: EspecialidadPre | "todas" = "todas", categoriaMinsa?: CategoriaMinsa | null) {
  const list = partidasDeEspecialidad(esp, categoriaMinsa);
  return {
    n: list.length,
    texto: list.map((p) => `${p.codigo} | ${p.und} | ${p.capitulo} | ${p.descripcion}`).join("\n"),
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function llamarGrok(opts: {
  obra: string;
  cliente: string;
  lugar: string;
  files: string[];
  pages: PaginaRaster[];
  especialidad: EspecialidadPre;
  categoriaMinsa?: CategoriaMinsa | null;
  chargeId: string;
  accessToken: string;
}): Promise<LecturaGrok> {
  const categoria = esCategoriaMinsa(opts.categoriaMinsa) ? opts.categoriaMinsa : null;
  const cat = catalogoParaGrok(opts.especialidad, categoria);
  const res = await fetch("/api/grok/leer-planos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      charge_id: opts.chargeId,
      obra: opts.obra,
      cliente: opts.cliente,
      lugar: opts.lugar,
      files: opts.files,
      especialidad: opts.especialidad,
      especialidad_label: ESPECIALIDAD_META[opts.especialidad].label,
      catalogo_n: cat.n,
      catalogo: cat.texto,
      categoria_minsa: categoria || "",
      categoria_minsa_texto: categoria ? textoCategoriaParaPrompt(categoria) : "",
      pages: opts.pages.map((p) => ({ file: p.file, page: p.page, dataUrl: p.dataUrl })),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<LecturaGrok>;
  if (!res.ok) throw new Error(data.error || `La lectura con IA no respondió (${res.status}).`);
  if (!Array.isArray(data.lineas)) throw new Error("La lectura con IA no devolvió partidas legibles.");
  return {
    obra_leida: data.obra_leida || opts.obra,
    especialidad: data.especialidad || opts.especialidad,
    escala: data.escala || "",
    lineas: data.lineas,
    no_catalogadas: asArray(data.no_catalogadas),
    hallazgos: asArray(data.hallazgos),
    revision: asArray(data.revision),
    pausas_ejecutadas: data.pausas_ejecutadas,
  };
}

export function fusionarLecturas(lecturas: LecturaGrok[]): LecturaGrok {
  const lineas = new Map<string, LecturaGrok["lineas"][number]>();
  const no_catalogadas: LecturaGrok["no_catalogadas"] = [];
  const hallazgos: string[] = [];
  const revision: string[] = [];
  const especialidades: string[] = [];
  for (const lec of lecturas) {
    if (lec.especialidad) especialidades.push(lec.especialidad);
    for (const raw of lec.lineas) {
      const codigo = String(raw.codigo || "").trim();
      if (!codigo) continue;
      const prev = lineas.get(codigo);
      if (!prev) {
        lineas.set(codigo, { ...raw, codigo });
        continue;
      }
      lineas.set(codigo, {
        ...prev,
        metrado: Number(prev.metrado || 0) + Number(raw.metrado || 0),
        nota: [prev.nota, raw.nota].filter(Boolean).join(" · "),
        confianza: prev.confianza === "baja" || raw.confianza === "baja" ? "baja" : prev.confianza,
      });
    }
    no_catalogadas.push(...lec.no_catalogadas);
    if (lec.obra_leida) hallazgos.push(`Rótulo (${lec.especialidad || "?"}): ${lec.obra_leida}`);
    if (lec.escala) hallazgos.push(`Escala (${lec.especialidad || "?"}): ${lec.escala}`);
    hallazgos.push(...lec.hallazgos);
    revision.push(...lec.revision);
    const a1 = lec.pausas_ejecutadas?.a1;
    if (a1?.resultado === "FALLIDA") {
      revision.unshift(`PAUSA A1 fallida en ${lec.especialidad}: catálogo contado ${a1.catalogo_n_contado} ≠ declarado ${a1.catalogo_n_declarado}.`);
    }
  }
  return {
    obra_leida: lecturas.find((l) => l.obra_leida)?.obra_leida || "",
    especialidad: [...new Set(especialidades)].join(" + "),
    escala: lecturas.map((l) => l.escala).filter(Boolean).join(" · "),
    lineas: [...lineas.values()],
    no_catalogadas,
    hallazgos,
    revision,
    pausas_ejecutadas: lecturas.at(-1)?.pausas_ejecutadas,
  };
}
