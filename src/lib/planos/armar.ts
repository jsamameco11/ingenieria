import { cronogramaDesdePresupuesto } from "../cronograma/desdePresupuesto";
import { buscarPartidaPorTexto, defaultPresupuesto, partidaPorCodigo, uid } from "../presupuesto/engine";
import {
  aplicarPlantilla,
  identificarPlantilla,
  plantillaPorId,
  type CategoriaPlantilla,
} from "../presupuesto/plantillas";
import { ESPECIALIDADES, type EspecialidadPre, type LineaPresupuesto, type PresupuestoState } from "../presupuesto/types";
import type { LecturaGrok } from "./types";

function metradoOk(n: unknown) {
  const v = typeof n === "number" ? n : parseFloat(String(n ?? ""));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v * 1000) / 1000;
}

function especialidadLectura(s: string): EspecialidadPre | null {
  const t = s.toLowerCase().trim();
  if (!t || t.includes("+") || t.includes("·")) return null;
  return ESPECIALIDADES.find((e) => e === t) ?? null;
}

function textoLectura(lectura: LecturaGrok) {
  return [
    lectura.obra_leida,
    lectura.especialidad,
    ...lectura.hallazgos,
    ...lectura.revision,
    ...lectura.lineas.map((l) => `${l.codigo} ${l.nota || ""}`),
    ...(lectura.no_catalogadas ?? []).map((x) => x.que_se_vio),
  ]
    .filter(Boolean)
    .join(" ");
}

export function armarDesdeLectura(
  lectura: LecturaGrok,
  opts: {
    obra: string;
    cliente: string;
    lugar: string;
    files: string[];
    seedPlantilla?: string;
    tipo?: CategoriaPlantilla | "";
  }
): PresupuestoState {
  const seedId =
    opts.seedPlantilla ||
    identificarPlantilla({
      obra: opts.obra || lectura.obra_leida,
      archivos: opts.files,
      tipo: opts.tipo || "",
      lecturaTexto: textoLectura(lectura),
    });
  const seed =
    aplicarPlantilla(seedId, {
      obra: opts.obra,
      cliente: opts.cliente,
      lugar: opts.lugar,
    }) ?? defaultPresupuesto();
  const pl = plantillaPorId(seedId);

  const byCodigo = new Map<string, LineaPresupuesto>();
  for (const l of seed.lineas) {
    byCodigo.set(l.codigo, { ...l });
  }

  const overlayed: string[] = [];
  const added: string[] = [];
  const rechazadas: string[] = [];
  const extrasMapped: string[] = [];
  const extrasSin: string[] = [];
  const vistosPlano = new Set<string>();

  for (const raw of lectura.lineas) {
    const codigo = String(raw.codigo || "").trim();
    const partida = partidaPorCodigo(codigo);
    const metrado = metradoOk(raw.metrado);
    if (!partida) {
      if (codigo) rechazadas.push(`${codigo} no existe en el catálogo MemoriaCalc`);
      continue;
    }
    if (vistosPlano.has(codigo)) continue;
    vistosPlano.add(codigo);
    const nota = [
      metrado > 0 ? "Metrado del plano" : "",
      raw.fuente ? `Fuente: ${raw.fuente}` : "",
      raw.confianza ? `Confianza: ${raw.confianza}` : "",
      raw.nota,
    ]
      .filter(Boolean)
      .join(" · ");
    const prev = byCodigo.get(codigo);
    if (prev) {
      byCodigo.set(codigo, {
        ...prev,
        metrado: metrado > 0 ? metrado : prev.metrado,
        nota: nota || prev.nota,
      });
      if (metrado > 0) overlayed.push(`${codigo} · ${partida.descripcion}`);
    } else if (metrado > 0) {
      byCodigo.set(codigo, { id: uid(), codigo, metrado, nota });
      added.push(`${codigo} · ${partida.descripcion}`);
    }
  }

  const esp = especialidadLectura(lectura.especialidad);
  for (const item of lectura.no_catalogadas ?? []) {
    const hit = buscarPartidaPorTexto(`${item.que_se_vio} ${item.unidad}`, esp);
    const metrado = metradoOk(item.cantidad);
    if (!hit) {
      extrasSin.push(`${item.que_se_vio} · ${item.cantidad} ${item.unidad} · ${item.por_que_no_entra}`);
      continue;
    }
    const nota = `Partida adicional mapeada desde plano: ${item.que_se_vio}`;
    const prev = byCodigo.get(hit.codigo);
    if (prev) {
      if (metrado > 0 && !(vistosPlano.has(hit.codigo) && prev.metrado > 0)) {
        byCodigo.set(hit.codigo, { ...prev, metrado: metrado > 0 ? metrado : prev.metrado, nota });
      }
      extrasMapped.push(`${hit.codigo} · ${hit.descripcion} ← «${item.que_se_vio}»`);
    } else if (metrado > 0) {
      byCodigo.set(hit.codigo, { id: uid(), codigo: hit.codigo, metrado, nota });
      extrasMapped.push(`${hit.codigo} · ${hit.descripcion} ← «${item.que_se_vio}»`);
    } else {
      extrasSin.push(`${item.que_se_vio} · sin cantidad utilizable (candidato ${hit.codigo})`);
    }
  }

  const seedCodes = new Set(seed.lineas.map((l) => l.codigo));
  const lineas: LineaPresupuesto[] = [
    ...seed.lineas.map((l) => {
      const next = byCodigo.get(l.codigo) ?? l;
      if (!next.nota && !vistosPlano.has(l.codigo)) {
        return { ...next, nota: "Metrado de la plantilla de expediente (no apareció en el PDF)" };
      }
      return next;
    }),
    ...[...byCodigo.values()].filter((l) => !seedCodes.has(l.codigo)),
  ];

  const notas = [
    `Expediente armado desde planos PDF · plantilla ${pl?.nombre || seedId}.`,
    `Archivos: ${opts.files.join("; ")}`,
    lectura.obra_leida ? `Rótulo: ${lectura.obra_leida}` : "",
    lectura.escala ? `Escala: ${lectura.escala}` : "",
    lectura.especialidad ? `Especialidad leída: ${lectura.especialidad}` : "",
    `${lineas.length} partidas en expediente (${seed.lineas.length} de plantilla, ${overlayed.length} con metrado del plano, ${added.length} partidas adicionales del catálogo).`,
    overlayed.length ? `Metrados del plano sobre plantilla:\n- ${overlayed.slice(0, 40).join("\n- ")}${overlayed.length > 40 ? `\n- … ${overlayed.length - 40} más` : ""}` : "",
    added.length ? `Partidas del catálogo no previstas en la plantilla:\n- ${added.join("\n- ")}` : "",
    extrasMapped.length ? `Ítems del plano mapeados a catálogo:\n- ${extrasMapped.join("\n- ")}` : "",
    extrasSin.length ? `Visto en plano sin partida en el programa (no se inventó código):\n- ${extrasSin.join("\n- ")}` : "",
    rechazadas.length ? `Códigos descartados (no existen en catálogo):\n- ${rechazadas.join("\n- ")}` : "",
    lectura.hallazgos.length ? `Hallazgos:\n- ${lectura.hallazgos.join("\n- ")}` : "",
    lectura.revision.length ? `Revisión humana:\n- ${lectura.revision.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const next: PresupuestoState = {
    ...seed,
    obra: opts.obra.trim() || lectura.obra_leida || pl?.obra || "Presupuesto desde planos PDF",
    cliente: opts.cliente.trim() || seed.cliente || "",
    lugar: opts.lugar.trim() || seed.lugar || "",
    plantillaId: seedId,
    lineas,
    observaciones: notas,
  };
  return { ...next, cronograma: cronogramaDesdePresupuesto(next) };
}
