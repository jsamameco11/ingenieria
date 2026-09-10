import { fmt } from "../num";
import { paso, type MemoriaDoc } from "../memoria";
import { casoTuberiaSimple } from "./engine";
import { HW_K, HW_N, METHOD_LABEL, pipeHeadloss } from "./headloss";
import { HAMMER_DEFAULT, QUALITY_DEFAULT } from "./criteria";
import { factorEscenario, longitudPipe, profundidadDe, propsPipe, SCENARIO_LABEL } from "./model";
import type { EpsStep, RdapProject, RunResult } from "./types";

const SISTEMA: Record<RdapProject["meta"]["tipoSistema"], string> = {
  gravedad: "por gravedad",
  bombeo: "por bombeo",
  mixto: "mixto (gravedad + impulsión)",
};

const RED: Record<RdapProject["meta"]["tipoRed"], string> = {
  rural: "rural",
  urbano: "urbana",
  condominial: "condominial",
  industrial: "industrial / predial",
};

function nudoCritico(p: RdapProject, r: RunResult) {
  const junc = r.nodes.filter((n) => {
    const nd = p.nodes.find((x) => x.id === n.id);
    return nd?.kind === "junction" || nd?.kind === "hydrant";
  });
  if (!junc.length) return null;
  return junc.reduce((a, b) => (b.pressureMca < a.pressureMca ? b : a));
}

function tramosDe(p: RdapProject, r: RunResult, nodeId: string) {
  return p.pipes
    .filter((t) => t.start === nodeId || t.end === nodeId)
    .map((t) => {
      const pr = r.pipes.find((x) => x.id === t.id);
      const a = p.nodes.find((n) => n.id === t.start);
      const b = p.nodes.find((n) => n.id === t.end);
      const { L, origen } = longitudPipe(t, a, b);
      return { t, pr, L, origen, props: propsPipe(t) };
    });
}

function recomendaciones(p: RdapProject, r: RunResult) {
  const out: string[] = [];
  const crit = nudoCritico(p, r);
  if (crit && crit.pressureMca < p.criteria.pMinMca) {
    out.push(
      `Elevar el HGL de la fuente o aumentar el DN en la ruta hacia ${crit.id} (P = ${fmt(crit.pressureMca, 1)} m.c.a. < ${p.criteria.pMinMca}).`,
    );
  }
  if (r.dashboard.pMax > p.criteria.pMaxMca) {
    out.push(`Presión máxima ${fmt(r.dashboard.pMax, 1)} m.c.a. supera ${p.criteria.pMaxMca}: valorar PRV, sectorización o bajar el HGL del reservorio.`);
  }
  for (const t of r.pipes) {
    if (t.velocity > p.criteria.vMaxMs) out.push(`${t.id}: V = ${fmt(t.velocity, 2)} m/s > ${p.criteria.vMaxMs} — aumentar DN o reducir caudal de punta.`);
    if (t.velocity < p.criteria.vMinMs && Math.abs(t.qLs) > 0.05) {
      out.push(`${t.id}: V = ${fmt(t.velocity, 2)} m/s < ${p.criteria.vMinMs} — valorar reducir DN para mantener autolimpieza.`);
    }
    if (t.hfMkm > p.criteria.hfMaxMkm) out.push(`${t.id}: gradiente ${fmt(t.hfMkm, 1)} m/km > ${p.criteria.hfMaxMkm} — aumentar DN.`);
  }
  if (Math.abs(r.dashboard.balanceLs) > 0.05) {
    out.push(`El desbalance de masa es ${fmt(r.dashboard.balanceLs, 3)} L/s. Revisar conectividad, tuberías cerradas o tolerancia del solver.`);
  }
  const qopt = p.quality ?? QUALITY_DEFAULT;
  const hopt = p.hammer ?? HAMMER_DEFAULT;
  if (r.dashboard.clMin + 1e-9 < qopt.clMinMgL) {
    out.push(`Cloro residual mínimo ${fmt(r.dashboard.clMin, 2)} mg/L < ${qopt.clMinMgL} mg/L: subir C₀, bajar k_b (material/tiempo) o acortar la ruta más larga.`);
  }
  if (r.dashboard.ageMaxH > qopt.ageMaxH) {
    out.push(`Edad máxima ${fmt(r.dashboard.ageMaxH, 1)} h > ${qopt.ageMaxH} h: recircular, vaciar puntas o reducir diámetros muertos.`);
  }
  if (r.hammer.pipes.some((t) => !t.ok)) {
    const bad = r.hammer.pipes.filter((t) => !t.ok);
    out.push(`Golpe de ariete: ${bad.map((t) => t.id).join(", ")} superan el PN. Alargar el cierre (${hopt.tCloseS} s), subir PN o colocar ventosa/anticolpe.`);
  }
  for (const a of r.prvAudit) out.push(a.message);
  if (!out.length) {
    out.push("La red cumple presión, velocidad, gradiente, residual de cloro y PN frente a golpe de ariete. Proceder a metrados y EETT con los DN de esta corrida.");
  }
  return out;
}

export function memoriaRdap(p: RdapProject, r: RunResult | null, eps: EpsStep[] | null = null): MemoriaDoc {
  const ref = casoTuberiaSimple();
  const escenario = r ? SCENARIO_LABEL[r.scenario] : "sin corrida";
  const scale = r?.scale ?? 1;
  const qBase = p.nodes.filter((n) => n.kind === "junction" || n.kind === "hydrant").reduce((s, n) => s + n.demandLs, 0);
  const crit = r ? nudoCritico(p, r) : null;
  const critNode = crit ? p.nodes.find((n) => n.id === crit.id) : null;
  const incidentes = r && crit ? tramosDe(p, r, crit.id) : [];
  const tuboEj = r
    ? [...r.pipes].sort((a, b) => Math.abs(b.qLs) - Math.abs(a.qLs))[0]
    : null;
  const tuboEjGeom = tuboEj ? p.pipes.find((t) => t.id === tuboEj.id) : null;
  const aEj = tuboEjGeom ? p.nodes.find((n) => n.id === tuboEjGeom.start) : undefined;
  const bEj = tuboEjGeom ? p.nodes.find((n) => n.id === tuboEjGeom.end) : undefined;
  const LEj = tuboEjGeom ? longitudPipe(tuboEjGeom, aEj, bEj) : null;
  const prEj = tuboEjGeom ? propsPipe(tuboEjGeom) : null;
  const hlEj =
    tuboEjGeom && prEj && LEj && tuboEj
      ? pipeHeadloss({
          method: p.method,
          qM3s: tuboEj.qLs / 1000,
          L: LEj.L,
          dM: prEj.dM,
          C: prEj.C,
          epsM: prEj.epsM,
          n: prEj.n,
          kMinor: tuboEjGeom.minorK,
          nu: p.viscosityM2s,
        })
      : null;

  const blocks: MemoriaDoc["blocks"] = [
    {
      type: "cover",
      kicker: "AP-09 · Agua potable · Memoria de cálculo hidráulico",
      titulo: "Diseño de red de distribución de agua potable",
      subtitulo: `${p.meta.proyecto} · red ${RED[p.meta.tipoRed]} ${SISTEMA[p.meta.tipoSistema]} · ${METHOD_LABEL[p.method]}`,
      meta: [
        { k: "Proyecto", v: p.meta.proyecto },
        { k: "Cliente / entidad", v: p.meta.cliente },
        { k: "Ubicación", v: p.meta.ubicacion },
        { k: "Elaborado por", v: p.meta.profesional },
        { k: "Revisado por", v: p.meta.revisor || "—" },
        { k: "Fecha", v: p.meta.fecha },
        { k: "Versión", v: p.meta.version },
        { k: "Software", v: "MemoriaCalc · módulo AP-09" },
        { k: "Sistema de coordenadas", v: `${p.meta.datum} / UTM ${p.meta.utmZone}` },
        { k: "Unidades internas", v: "SI · m, m³/s, m.c.a.  |  presentación L/s, mm" },
        { k: "Escenario de esta memoria", v: r ? `${escenario} · factor ${fmt(scale, 2)}${r.fire ? ` · incendio ${p.fireLs} L/s en ${p.fireNodeId || "—"}` : ""}${r.hour != null ? ` · hora ${String(r.hour).padStart(2, "0")}:00` : ""}` : "Pendiente de cálculo" },
      ],
    },
    { type: "h2", text: "1. Objeto y alcance" },
    {
      type: "p",
      text: p.meta.alcance ||
        "La presente memoria dimensiona y verifica la red de distribución de agua potable (RDAP) como un sistema a presión en régimen permanente. Se resuelven continuidad en nudos y conservación de energía en cada tramo, se contrastan presión, velocidad y gradiente con el perfil normativo del proyecto, y se documenta la trazabilidad de los resultados hasta los datos de entrada.",
    },
    {
      type: "list",
      items: [
        "Modelo topológico de nudos (junction, reservorio, tanque) y tramos (tubería, bomba, válvula).",
        "Demandas de nudo, factores Qmd / Qmh, patrón horario 24 h y caudal de incendio superpuesto.",
        "Pérdidas de carga por el método declarado (Hazen–Williams SI, Darcy–Weisbach o Manning).",
        "Presión de servicio P = HGL − Zterreno, sin confundir cota de tapa ni de fondo con el terreno.",
        "Diámetro hidráulico = ID de catálogo (o override), no el DN comercial.",
        "Verificación de criterios editables (OS.100 u otro perfil) y listado de puntos críticos.",
        "Plano esquemático, perfil terreno–tubería–HGL e informe exportable.",
      ],
    },
    ...(p.meta.notas ? [{ type: "note" as const, text: p.meta.notas }] : []),

    { type: "h2", text: "2. Normativa y bases de cálculo" },
    {
      type: "p",
      text: `Perfil de criterios: ${p.criteria.name}. Norma de referencia: ${p.criteria.norma}. Los límites no están fijos en el código: el proyectista los edita. El motor no sustituye el criterio profesional ni el plano de obra.`,
    },
    {
      type: "kv",
      rows: [
        { k: "Método de pérdidas", v: METHOD_LABEL[p.method] },
        { k: "g", v: `${r?.g ?? 9.81} m/s²` },
        { k: "Viscosidad cinemática ν (Darcy–Weisbach)", v: `${p.viscosityM2s} m²/s (20 °C salvo edición)` },
        { k: "Factor Qmd / Qp", v: fmt(p.qmdFactor, 2) },
        { k: "Factor Qmh / Qp", v: fmt(p.qmhFactor, 2) },
        { k: "Q incendio (si se activa el escenario)", v: `${fmt(p.fireLs, 2)} L/s en ${p.fireNodeId || "nudo no asignado"}` },
      ],
    },
    { type: "eq", text: "Σ Qin − Σ Qout − Qd = 0     (continuidad en cada junction)", num: "2.1" },
    { type: "eq", text: `hf = ${HW_K} · L · Q^${HW_N} / (C^${HW_N} · D^4.87)     (Hazen–Williams SI)`, num: "2.2" },
    { type: "eq", text: "hf = f (L/D) (V² / 2g)     ·     f = Swamee–Jain     (Darcy–Weisbach)", num: "2.3" },
    { type: "eq", text: "hm = K (V² / 2g)     ·     P = HGL − Zterreno     (m.c.a.)", num: "2.4" },
    {
      type: "note",
      text: `Verificación de referencia (tubería simple de control, no es un tramo del proyecto): L = ${ref.L} m, C = ${ref.C}, D = ${ref.dM} m, Q = ${ref.q} m³/s → hf = ${fmt(ref.hf, 3)} m. Cualquier implementación HW SI debe reproducir este valor.`,
    },

    { type: "h2", text: "3. Descripción del sistema" },
    {
      type: "kv",
      rows: [
        { k: "Tipo de sistema", v: SISTEMA[p.meta.tipoSistema] },
        { k: "Tipo de red", v: RED[p.meta.tipoRed] },
        { k: "Nudos / tramos / bombas / válvulas", v: `${p.nodes.length} / ${p.pipes.length} / ${p.pumps.length} / ${p.valves.length}` },
        { k: "Reservorios / tanques", v: `${p.nodes.filter((n) => n.kind === "reservoir").length} / ${p.nodes.filter((n) => n.kind === "tank").length}` },
        { k: "Demanda base de nudos (Qp)", v: `${fmt(qBase, 3)} L/s` },
        { k: "Demanda del escenario", v: r ? `${fmt(r.dashboard.demandLs, 3)} L/s (factor ${fmt(scale, 2)})` : "—" },
        { k: "Patrones horarios", v: p.patterns.map((x) => `${x.id} ${x.name}`).join("; ") || "ninguno" },
      ],
    },
    {
      type: "p",
      text:
        p.pumps.length || p.valves.length
          ? `Equipos: ${p.pumps.map((b) => `${b.id} (${b.status}, ${b.curve.length} puntos Q–H)`).join("; ") || "sin bombas"}. Válvulas: ${p.valves.map((v) => `${v.id} ${v.kind} consigna ${v.setting} (${v.status}, DN ${v.dnMm})`).join("; ") || "sin válvulas"}. El control de PRV/PSV/FCV sigue la lógica de estados de EPANET (Rossman): ACTIVE / OPEN / CLOSED, con bucle exterior hasta que el estado se estabiliza.`
          : "Sistema sin bombas ni válvulas de control en este modelo. La energía proviene de las cargas fijas de reservorio/tanque.",
    },

    { type: "h2", text: "4. Criterios de diseño (editables)" },
    {
      type: "kv",
      rows: [
        { k: "Presión mínima de servicio", v: `${fmt(p.criteria.pMinMca, 1)} m.c.a.` },
        { k: "Presión máxima", v: `${fmt(p.criteria.pMaxMca, 1)} m.c.a.` },
        { k: "Velocidad", v: `${fmt(p.criteria.vMinMs, 2)} – ${fmt(p.criteria.vMaxMs, 2)} m/s` },
        { k: "Gradiente máximo", v: `${fmt(p.criteria.hfMaxMkm, 1)} m/km` },
        { k: "DN admisible", v: `${p.criteria.dnMinMm} – ${p.criteria.dnMaxMm} mm` },
        { k: "Iteraciones / εH / εQ", v: `${p.solver.maxIter} / ${p.solver.tolHeadM} m / ${p.solver.tolFlowM3s} m³/s` },
      ],
    },

    { type: "h2", text: "5. Datos de entrada — nudos" },
    {
      type: "p",
      text: `Sistema ${p.meta.datum} / UTM ${p.meta.utmZone}. Puntos topográficos: ${p.topoPoints.length}. Con ${p.topoPoints.length >= 3 ? "ellos se arma una superficie TIN (Delaunay) y la cota de un nudo nuevo se interpola en el triángulo que lo contiene" : "menos de 3 puntos no hay malla: se usa inverso de la distancia"}. Cota de terreno, tapa, fondo y profundidad se guardan por separado.`,
    },
    {
      type: "table",
      caption: "Nudos — geometría, cotas y demanda base",
      headers: ["ID", "Tipo", "Descripción", "X", "Y", "Z terreno", "Tapa", "Fondo", "Prof. m", "Qd L/s", "Patrón"],
      rows: p.nodes.map((n) => [
        n.id,
        n.kind,
        n.description || n.name,
        fmt(n.x, 2),
        fmt(n.y, 2),
        fmt(n.ground, 2),
        n.cover == null ? "—" : fmt(n.cover, 2),
        n.invert == null ? "—" : fmt(n.invert, 2),
        profundidadDe(n) == null ? "—" : fmt(profundidadDe(n)!, 2),
        fmt(n.demandLs, 3),
        n.patternId || "—",
      ]),
    },

    { type: "h2", text: "6. Datos de entrada — tuberías y equipos" },
    {
      type: "table",
      caption: "Tramos — el motor usa el ID hidráulico, no el DN",
      headers: ["ID", "Desde", "Hasta", "L m", "Origen L", "DN", "ID mm", "Mat.", "C / n / ε", "K"],
      rows: p.pipes.map((t) => {
        const a = p.nodes.find((n) => n.id === t.start);
        const b = p.nodes.find((n) => n.id === t.end);
        const { L, origen } = longitudPipe(t, a, b);
        const pr = propsPipe(t);
        return [
          t.id,
          t.start,
          t.end,
          fmt(L, 2),
          origen,
          String(t.dnMm),
          fmt(pr.idMm, 1),
          pr.mat.name,
          `${fmt(pr.C, 0)} / ${fmt(pr.n, 3)} / ${fmt(pr.epsM * 1000, 3)} mm`,
          fmt(t.minorK, 2),
        ];
      }),
    },
    ...(p.pumps.length
      ? [{
          type: "table" as const,
          caption: "Bombas — curva Q–H (caudal en L/s, altura en m)",
          headers: ["ID", "Desde", "Hasta", "Estado", "Puntos de curva"],
          rows: p.pumps.map((b) => [b.id, b.start, b.end, b.status, b.curve.map((c) => `${c.qLs}/${c.hM}`).join(" · ")]),
        }]
      : []),
    ...(p.valves.length
      ? [{
          type: "table" as const,
          caption: "Válvulas de control (comando del proyectista)",
          headers: ["ID", "Tipo", "Desde", "Hasta", "Consigna", "DN", "Comando"],
          rows: p.valves.map((v) => [v.id, v.kind, v.start, v.end, fmt(v.setting, 2), String(v.dnMm), v.status]),
        }]
      : []),

    { type: "h2", text: "7. Metodología y trazabilidad de esta corrida" },
    {
      type: "p",
      text: "El análisis hidráulico usa Newton nodal (equivalente al Global Gradient Algorithm para redes a demanda prescrita). Las válvulas de control (PRV, PSV, FCV) no son una pérdida local fija: el solver corre un bucle de estado tipo EPANET. En ACTIVE, una PRV fija el HGL del nudo de aguas abajo a Z + consigna y el caudal sale por continuidad; si la carga de aguas arriba no alcanza, pasa a OPEN (pérdida menor del DN); si el flujo se invierte, CLOSED. No se reescriben los datos de entrada. La presión de un reservorio o tanque no entra al criterio de servicio.",
    },
    paso(
      "7.1",
      "Demandas del escenario",
      "Qd = Qbase × factor × patrón(hora)  [+ Qincendio en el nudo declarado]",
      `Qp = ${fmt(qBase, 3)} L/s. Factores del proyecto: Qmd = ${fmt(p.qmdFactor, 2)}, Qmh = ${fmt(p.qmhFactor, 2)}. Escenario: ${escenario}.`,
      r
        ? `Qd total = ${fmt(r.dashboard.demandLs, 3)} L/s     ·     Q fuente = ${fmt(r.dashboard.sourceLs, 3)} L/s     ·     desbalance = ${fmt(r.dashboard.balanceLs, 4)} L/s`
        : "Ejecute el solver para obtener el balance de masa.",
      "El desbalance debe ser del orden de la tolerancia de caudal. Si no, la red está mal condicionada.",
    ),
    paso(
      "7.2",
      "Área y velocidad de un tramo real",
      "A = π D² / 4     ·     V = Q / A     ·     D = ID efectivo",
      tuboEj && prEj && LEj
        ? `${tuboEj.id}: L = ${fmt(LEj.L, 2)} m (${LEj.origen}), DN = ${tuboEjGeom?.dnMm} mm, ID = ${fmt(prEj.idMm, 1)} mm, C = ${fmt(prEj.C, 0)}, Q = ${fmt(tuboEj.qLs, 3)} L/s`
        : "Sin tramo calculado.",
      hlEj && prEj
        ? `A = ${fmt(hlEj.area, 5)} m²     V = ${fmt(Math.abs(hlEj.v), 3)} m/s     hf+hm = ${fmt(Math.abs(hlEj.hf) + Math.abs(hlEj.hm), 3)} m`
        : "—",
      "El ID sale del catálogo del material o del override del tramo. El DN solo etiqueta el comercial.",
    ),
    paso(
      "7.3",
      "Pérdida del tramo de mayor caudal",
      p.method === "hazen-williams"
        ? `hf = ${HW_K} L Q^${HW_N} / (C^${HW_N} D^4.87) + K V²/2g`
        : p.method === "darcy-weisbach"
          ? "hf = f (L/D) (V²/2g) + K V²/2g"
          : "Manning a sección llena + pérdidas menores",
      tuboEj && prEj && LEj
        ? `Datos: L = ${fmt(LEj.L, 2)} m, D = ${fmt(prEj.dM, 4)} m, Q = ${fmt((tuboEj.qLs ?? 0) / 1000, 6)} m³/s`
        : "—",
      tuboEj ? `hf = ${fmt(tuboEj.hf, 3)} m     ·     i = ${fmt(tuboEj.hfMkm, 2)} m/km     ·     sentido ${tuboEj.direction}` : "—",
      "Esta fila debe coincidir con la tabla de resultados del mismo tramo.",
    ),
    paso(
      "7.4",
      "Presión del nudo más desfavorable",
      "P = HGL − Zterreno",
      crit && critNode
        ? `${crit.id} (${critNode.description || critNode.name}): HGL = ${fmt(crit.hgl, 3)} m, Z = ${fmt(critNode.ground, 3)} m`
        : "Sin nudo de servicio.",
      crit ? `P = ${fmt(crit.hgl, 3)} − ${fmt(critNode?.ground ?? 0, 3)} = ${fmt(crit.pressureMca, 2)} m.c.a.     ·     ${crit.status}` : "—",
      !crit
        ? "Ejecute el solver para contrastar la presión de servicio con el perfil del proyecto."
        : crit.pressureMca + 1e-6 >= p.criteria.pMinMca
          ? `Cumple el mínimo de ${p.criteria.pMinMca} m.c.a. del perfil ${p.criteria.name}.`
          : `No cumple el mínimo de ${p.criteria.pMinMca} m.c.a. Ver recomendaciones.`,
    ),
    ...(incidentes.length
      ? [{
          type: "table" as const,
          caption: `Tramos incidentes al nudo crítico ${crit?.id ?? ""}`,
          headers: ["Tramo", "Desde–hasta", "L m", "Q L/s", "V m/s", "hf m", "Nota"],
          rows: incidentes.map((x) => [
            x.t.id,
            `${x.t.start}–${x.t.end}`,
            fmt(x.L, 2),
            x.pr ? fmt(x.pr.qLs, 3) : "—",
            x.pr ? fmt(x.pr.velocity, 2) : "—",
            x.pr ? fmt(x.pr.hf, 3) : "—",
            x.pr?.note ?? "",
          ]),
        }]
      : []),
    paso(
      "7.5",
      "Control de válvulas (PRV / PSV / FCV)",
      "PRV ACTIVA: HGL_abajo = Z_abajo + Pset     ·     Q_PRV = Σcontinuidad del nudo controlado",
      p.valves.length
        ? p.valves.map((v) => `${v.id} ${v.kind} · consigna ${fmt(v.setting, 2)} · DN ${v.dnMm} · comando ${v.status}`).join(" · ")
        : "Este modelo no tiene válvulas de control.",
      r?.valves.length
        ? r.valves.map((v) => `${v.id}: ${v.mode} · Q = ${fmt(v.qLs, 3)} L/s · ΔH = ${fmt(v.headlossM, 2)} m · ${v.note}`).join(" ")
        : "Sin corrida de válvulas.",
      "Si una PRV queda OPEN, la zona baja no necesita reducción (la carga de aguas arriba no llega a la consigna). Si queda CLOSED, hay flujo inverso o el comando la forzó. Dos PRV ACTIVE al mismo nudo: se deja la de menor consigna y se avisa (W032). PRV en serie con consignas invertidas: W033. Oscilación de estado: se congela y se avisa (W034).",
    ),
    paso(
      "7.6",
      "Calidad de agua — edad y cloro residual",
      "C = C₀ e^(−k_b t)     ·     edad_j = Σ Q_in (edad_i + t) / Σ Q_in",
      `C₀ = ${fmt((p.quality ?? QUALITY_DEFAULT).sourceClMgL, 2)} mg/L · k_b = ${fmt((p.quality ?? QUALITY_DEFAULT).kbPerDay, 2)} 1/d · Cl mín ${fmt((p.quality ?? QUALITY_DEFAULT).clMinMgL, 2)} mg/L (OS.100).`,
      r
        ? `Cl mín de servicio = ${fmt(r.dashboard.clMin, 2)} mg/L     ·     edad máx = ${fmt(r.dashboard.ageMaxH, 2)} h`
        : "Ejecute el solver para obtener edad y residual.",
      "No es un modelo de transporte lagrangiano de EPANET; es mezcla ponderada + decaimiento de 1.er orden, suficiente para diseño y para el expediente.",
    ),
    paso(
      "7.7",
      "Golpe de ariete de diseño",
      "a = a₀ / √(1+(K/E)(D/e))     ·     T≤2L/a → ΔH=aV/g     ·     T>2L/a → ΔH=2LV/(gT)",
      `T cierre = ${fmt((p.hammer ?? HAMMER_DEFAULT).tCloseS, 2)} s. Celeridad según material y espesor del catálogo.`,
      r
        ? `ΔH máx = ${fmt(r.dashboard.hammerMaxM, 2)} m en ${r.hammer.worstId || "—"}`
        : "Ejecute el solver.",
      "Se compara P estática + ΔH con el PN del tubo. No sustituye un análisis MOC de transitorios de obra especial.",
    ),

    { type: "h2", text: "8. Plano esquemático y perfil" },
    { type: "figure", part: "plano" },
    { type: "figure", part: "perfil" },
    { type: "note", text: "El plano es esquemático (coordenadas del modelo). El perfil muestra terreno, invert de tubería y HGL de la corrida. No reemplaza el plano de obra." },

    { type: "h2", text: "9. Resultados hidráulicos" },
  ];

  if (!r) {
    blocks.push({ type: "note", text: "Ejecute el solver (Qp, Qmd, Qmh o incendio) para rellenar caudales, HGL y presiones." });
  } else {
    blocks.push({
      type: "kpis",
      items: [
        { label: "Estado", value: r.convergence.ok ? "CONVERGE" : "NO CONVERGE" },
        { label: "Iteraciones", value: String(r.convergence.iterations) },
        { label: "ε continuidad", value: `${fmt(r.convergence.maxContErrLs, 5)} L/s` },
        { label: "Balance masa", value: `${fmt(r.dashboard.balanceLs, 4)} L/s` },
        { label: "P mín / máx", value: `${fmt(r.dashboard.pMin, 1)} / ${fmt(r.dashboard.pMax, 1)} m.c.a.` },
        { label: "V máx", value: `${fmt(r.dashboard.vMax, 2)} m/s` },
      ],
    });
    blocks.push({
      type: "p",
      text: `${r.convergence.message}. Q fuente ${fmt(r.dashboard.sourceLs, 3)} L/s contra demanda ${fmt(r.dashboard.demandLs, 3)} L/s. Factor ${fmt(r.scale, 2)}${r.fire ? `; incendio ${p.fireLs} L/s en ${p.fireNodeId}` : ""}.`,
    });
    blocks.push({
      type: "table",
      caption: "Resultados de nudos (P de servicio solo aplica a junctions)",
      headers: ["ID", "Qd L/s", "HGL m", "P m.c.a.", "Estado", "Trazabilidad"],
      rows: r.nodes.map((n) => [n.id, fmt(n.demandLs, 3), fmt(n.hgl, 2), fmt(n.pressureMca, 2), n.status, n.note]),
    });
    blocks.push({
      type: "table",
      caption: "Resultados de tuberías",
      headers: ["ID", "Q L/s", "V m/s", "hf m", "i m/km", "Sentido", "Estado"],
      rows: r.pipes.map((t) => [t.id, fmt(t.qLs, 3), fmt(t.velocity, 2), fmt(t.hf, 3), fmt(t.hfMkm, 2), t.direction, t.status]),
    });
    if (r.pumps.length) {
      blocks.push({
        type: "table",
        caption: "Punto de operación de bombas",
        headers: ["ID", "Q L/s", "H m"],
        rows: r.pumps.map((b) => [b.id, fmt(b.qLs, 3), fmt(b.headM, 2)]),
      });
    }
    if (r.valves.length) {
      blocks.push({
        type: "table",
        caption: "Estado hidráulico de válvulas (ACTIVE / OPEN / CLOSED)",
        headers: ["ID", "Modo", "Q L/s", "ΔH m", "Consigna", "Trazabilidad"],
        rows: r.valves.map((v) => [v.id, v.mode, fmt(v.qLs, 3), fmt(v.headlossM, 2), fmt(v.setting, 2), v.note]),
      });
    }

    blocks.push({ type: "h2", text: "10. Verificación de cumplimiento" });
    const okPmin = r.dashboard.pMin + 1e-6 >= p.criteria.pMinMca;
    const okPmax = r.dashboard.pMax <= p.criteria.pMaxMca + 1e-6;
    const okV = r.dashboard.vMax <= p.criteria.vMaxMs + 1e-6;
    const okHf = r.dashboard.hfMax <= p.criteria.hfMaxMkm + 1e-6;
    const okBal = Math.abs(r.dashboard.balanceLs) < 0.05;
    blocks.push({
      type: "table",
      caption: "Control de criterios del proyecto",
      headers: ["Control", "Límite", "Resultado", "Cumple"],
      rows: [
        ["Presión mínima (nudos de servicio)", `≥ ${p.criteria.pMinMca} m.c.a.`, `${fmt(r.dashboard.pMin, 2)} m.c.a.`, okPmin ? "Sí" : "No"],
        ["Presión máxima (nudos de servicio)", `≤ ${p.criteria.pMaxMca} m.c.a.`, `${fmt(r.dashboard.pMax, 2)} m.c.a.`, okPmax ? "Sí" : "No"],
        ["Velocidad máxima", `≤ ${p.criteria.vMaxMs} m/s`, `${fmt(r.dashboard.vMax, 2)} m/s`, okV ? "Sí" : "No"],
        ["Gradiente máximo", `≤ ${p.criteria.hfMaxMkm} m/km`, `${fmt(r.dashboard.hfMax, 2)} m/km`, okHf ? "Sí" : "No"],
        ["Balance de masa |Qfuente − Qd|", "< 0.05 L/s", `${fmt(r.dashboard.balanceLs, 4)} L/s`, okBal ? "Sí" : "Revisar"],
        ["Convergencia del solver", "εH y εQ", r.convergence.ok ? `${r.convergence.iterations} iter.` : "No converge", r.convergence.ok ? "Sí" : "No"],
      ],
    });
    if (r.alerts.length) {
      blocks.push({ type: "list", items: r.alerts.map((a) => `${a.level} ${a.code} — ${a.message}`) });
    } else {
      blocks.push({ type: "check", ok: true, text: "Ningún incumplimiento respecto al perfil de criterios de esta corrida." });
    }
    if (!r.convergence.ok) {
      blocks.push({ type: "list", items: r.convergence.causes });
    }

    blocks.push({ type: "h2", text: "11. Simulación extendida (EPS 24 h)" });
    if (eps?.length) {
      const worst = eps.reduce((a, b) => (b.result.dashboard.pMin < a.result.dashboard.pMin ? b : a));
      blocks.push({
        type: "p",
        text: `Se recorrieron ${eps.length} horas con el patrón de cada nudo. Hora más crítica: ${String(worst.hour).padStart(2, "0")}:00 (multiplicador ${fmt(worst.multiplier, 2)}). Pmín = ${fmt(worst.result.dashboard.pMin, 1)} m.c.a.`,
      });
      blocks.push({
        type: "table",
        caption: "EPS — presión mínima de nudos de servicio por hora",
        headers: ["Hora", "Factor", "P mín", "P máx", "V máx", "Estado"],
        rows: eps.map((s) => [
          `${String(s.hour).padStart(2, "0")}:00`,
          fmt(s.multiplier, 2),
          fmt(s.result.dashboard.pMin, 2),
          fmt(s.result.dashboard.pMax, 2),
          fmt(s.result.dashboard.vMax, 2),
          s.result.convergence.ok ? (s.result.dashboard.pMin >= p.criteria.pMinMca ? "OK" : "P<mín") : "NC",
        ]),
      });
    } else {
      blocks.push({
        type: "note",
        text: r.hour != null
          ? `Esta memoria muestra la hora ${String(r.hour).padStart(2, "0")}:00 del EPS (la más crítica). Pulse EPS 24 h de nuevo si desea la tabla horaria completa en el informe.`
          : "El EPS 24 h no se ha ejecutado en esta sesión. El estacionario usa el factor del escenario sin variación horaria.",
      });
    }

    blocks.push({ type: "h2", text: "12. Calidad de agua" });
    blocks.push({
      type: "p",
      text: `C₀ = ${fmt((p.quality ?? QUALITY_DEFAULT).sourceClMgL, 2)} mg/L en reservorio/tanque. Decaimiento k_b = ${fmt((p.quality ?? QUALITY_DEFAULT).kbPerDay, 2)} d⁻¹. Residual de nudos de servicio: mínimo ${fmt(r.dashboard.clMin, 2)} mg/L · edad máxima ${fmt(r.dashboard.ageMaxH, 2)} h.`,
    });
    blocks.push({
      type: "table",
      caption: "Edad hidráulica y cloro residual por nudo",
      headers: ["ID", "Edad h", "Cl mg/L", "Estado", "Trazabilidad"],
      rows: r.quality.nodes.map((n) => [n.id, fmt(n.ageH, 2), fmt(n.clMgL, 2), n.status, n.note]),
    });

    blocks.push({ type: "h2", text: "13. Golpe de ariete" });
    blocks.push({
      type: "p",
      text: `Tiempo de cierre de proyecto T = ${fmt((p.hammer ?? HAMMER_DEFAULT).tCloseS, 2)} s. El tramo más exigente es ${r.hammer.worstId || "—"} con ΔH = ${fmt(r.hammer.maxDH, 2)} m.`,
    });
    blocks.push({
      type: "table",
      caption: "Celeridad, ΔH y verificación de PN",
      headers: ["Tramo", "a m/s", "2L/a s", "Método", "ΔH m", "P est.", "P trans.", "PN", "Cumple"],
      rows: r.hammer.pipes.map((t) => [
        t.id, fmt(t.aMs, 0), fmt(t.tCritS, 2), t.method, fmt(t.dHM, 2),
        fmt(t.pStatMca, 1), fmt(t.pTransMca, 1), fmt(t.pnMca, 0), t.ok ? "Sí" : "No",
      ]),
    });
    if (r.prvAudit.length) {
      blocks.push({ type: "h2", text: "14. Auditoría de PRV en serie" });
      blocks.push({ type: "list", items: r.prvAudit.map((a) => `${a.code} — ${a.message}`) });
    }

    blocks.push({ type: "h2", text: r.prvAudit.length ? "15. Conclusiones y recomendaciones" : "14. Conclusiones y recomendaciones" });
    blocks.push({
      type: "p",
      text: r.convergence.ok
        ? `La red ${RED[p.meta.tipoRed]} ${SISTEMA[p.meta.tipoSistema]} convergió en ${r.convergence.iterations} iteraciones para el escenario ${escenario}. Presión de nudos de servicio entre ${fmt(r.dashboard.pMin, 1)} y ${fmt(r.dashboard.pMax, 1)} m.c.a. Velocidad máxima ${fmt(r.dashboard.vMax, 2)} m/s. Gradiente máximo ${fmt(r.dashboard.hfMax, 1)} m/km. Factor Qmd teórico de este proyecto: ${fmt(factorEscenario(p, "qmd"), 2)}; Qmh: ${fmt(factorEscenario(p, "qmh"), 2)}.`
        : "No hay corrida convergente. Corrija validación (fuente, conectividad, diámetros, curva de bomba) y vuelva a calcular antes de emitir el expediente.",
    });
    blocks.push({ type: "list", items: recomendaciones(p, r) });
  }

  blocks.push({ type: "h2", text: "Anexos" });
  blocks.push({
    type: "list",
    items: [
      "Anexo A — Catálogo de materiales e ID hidráulicos usados en los tramos.",
      "Anexo B — Factores de demanda y patrón horario 24 h.",
      "Anexo C — Plano esquemático y perfil (figuras de esta memoria).",
      "Anexo D — Archivo de modelo (.rdap.json) para reproducción del cálculo.",
    ],
  });
  if (p.patterns[0]) {
    const pat = p.patterns[0];
    blocks.push({
      type: "table",
      caption: `Patrón ${pat.id} · ${pat.name}`,
      headers: ["Hora", ...pat.multipliers.slice(0, 12).map((_, i) => String(i).padStart(2, "0"))],
      rows: [
        ["0–11", ...pat.multipliers.slice(0, 12).map((m) => fmt(m, 2))],
        ["12–23", ...pat.multipliers.slice(12, 24).map((m) => fmt(m, 2))],
      ],
    });
  }
  blocks.push({ type: "firma", perito: p.meta.profesional, fecha: p.meta.fecha, lugar: p.meta.ubicacion });

  return {
    codigo: "AP-09",
    titulo: "Diseño de red de distribución de agua potable",
    norma: `${p.criteria.norma} · ${METHOD_LABEL[p.method]}`,
    blocks,
  };
}
