import { useEffect, useMemo, useState } from "react";
import { fmt } from "../lib/num";
import {
  CRITERIOS,
  HAMMER_DEFAULT,
  MATERIALES,
  QUALITY_DEFAULT,
  SCENARIO_LABEL,
  borrarNodo,
  bombaNueva,
  csvResultados,
  factorEscenario,
  importarLandXmlPuntos,
  importarNodosCsv,
  importarPuntosTopo,
  importarTuberiasCsv,
  inconsistenciaCotas,
  interpolarTin,
  longitudPipe,
  memoriaRdap,
  nextId,
  nodoNuevo,
  normalizarProyecto,
  profundidadDe,
  proyectoDemo,
  proyectoVacio,
  propsPipe,
  renombrarNodo,
  resolverEps,
  resolverEstacionario,
  tuboNuevo,
  validarRed,
  valvulaNueva,
  zTerrenoDePuntos,
  type EpsStep,
  type HeadlossMethod,
  type RdapProject,
  type RdapScenario,
  type RunResult,
  VALVE_LABEL,
  type ValveCommand,
  type ValveKind,
} from "../lib/rdap";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { RdapMap, RdapPerfil, type RdapHit, type RdapTool } from "../ui/rdapView";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";
import { useUndoableState } from "../lib/undoHistory";
import { UndoButtons } from "../ui/UndoButtons";

type Tab = "modelo" | "red" | "equipos" | "mapa" | "resultados" | "memoria";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function descargar(nombre: string, texto: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: mime }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

function corridaEjemploQp(p: RdapProject): RunResult {
  return resolverEstacionario(p, factorEscenario(p, "qp"), null, false, "qp");
}

export function RdapModule() {
  const [result, setResult] = useState<RunResult | null>(() => corridaEjemploQp(proyectoDemo()));
  const [eps, setEps] = useState<EpsStep[] | null>(null);
  const { state: project, setState: setProject, undo, redo, canUndo, canRedo } = useUndoableState(() => proyectoDemo(), {
    onRestore: () => {
      setResult(null);
      setEps(null);
    },
  });
  const [tab, setTab] = useState<Tab>("mapa");
  const [selected, setSelected] = useState("R-01");
  const [from, setFrom] = useState("R-01");
  const [to, setTo] = useState("J-05");
  const [msg, setMsg] = useState("Ejemplo El Mirador calculado en Qp. Edite la red y pulse Calcular en la memoria para actualizar el informe.");
  const [scenario, setScenario] = useState<RdapScenario>("qp");
  const [tool, setTool] = useState<RdapTool>("select");
  const [pipeFrom, setPipeFrom] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(true);

  const set = (next: RdapProject) => {
    setProject(next);
    setResult(null);
    setEps(null);
  };
  const issues = useMemo(() => validarRed(project), [project]);
  const doc = useMemo(() => memoriaRdap(project, result, eps), [project, result, eps]);
  const livePack = useMemo(() => ({ doc, project, result }), [doc, project, result]);
  const { doc: pack, dirty, calcular: publicarMemoria } = useMemoriaOnCalcular(livePack);
  const memoria = pack.doc;

  function calcular(s: RdapScenario = scenario) {
    const scale = factorEscenario(project, s);
    const fire = s === "incendio";
    const r = resolverEstacionario(project, scale, null, fire, s);
    setScenario(s);
    setResult(r);
    setEps(null);
    setMsg(`${SCENARIO_LABEL[s]} · ${r.convergence.message}`);
  }

  function calcularEps() {
    const steps = resolverEps(project, 24);
    const worst = steps.reduce((a, b) => (b.result.dashboard.pMin < a.result.dashboard.pMin ? b : a));
    setEps(steps);
    setResult(worst.result);
    setScenario("custom");
    setMsg(`EPS 24 h. Hora más crítica: ${String(worst.hour).padStart(2, "0")}:00 · Pmín ${fmt(worst.result.dashboard.pMin, 1)} m.c.a.`);
  }

  useEffect(() => {
    const r = resolverEstacionario(project, 1, null, false, "qp");
    setResult(r);
    setMsg(`${SCENARIO_LABEL.qp} · ${r.convergence.message}`);
    // solo al abrir el módulo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.key !== "Escape") return;
      setTool("select");
      setPipeFrom(null);
      setMsg("Seleccionar: clic en el elemento. Las propiedades salen a la derecha.");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function leerArchivo(kind: "nodos" | "tubos" | "topo" | "landxml" | "json") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "json" ? ".json,.rdap.json" : kind === "landxml" ? ".xml,.landxml" : ".csv,.txt,.tsv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (kind === "json") {
        try {
          const next = normalizarProyecto(JSON.parse(text));
          set(next);
          setSelected(next.nodes[0]?.id ?? "");
          setMsg(`Modelo cargado: ${next.meta.proyecto}`);
        } catch {
          setMsg("El archivo JSON no es un modelo AP-09 válido.");
        }
        return;
      }
      const next = clone(project);
      const note =
        kind === "nodos"
          ? importarNodosCsv(text, next)
          : kind === "tubos"
            ? importarTuberiasCsv(text, next)
            : kind === "landxml"
              ? importarLandXmlPuntos(text, next)
              : importarPuntosTopo(text, next);
      set(next);
      setMsg(note);
    };
    input.click();
  }

  function hacerNudo(p: RdapProject, kind: RdapProject["nodes"][0]["kind"], x: number, y: number) {
    const prefix = kind === "reservoir" ? "R" : kind === "tank" ? "T" : kind === "hydrant" ? "H" : "J";
    const id = nextId(prefix, p.nodes.map((n) => n.id));
    const n = nodoNuevo(id, kind);
    const z = interpolarTin(x, y, p.topoPoints) ?? zTerrenoDePuntos(x, y, p.topoPoints) ?? n.ground;
    n.x = Math.round(x * 100) / 100;
    n.y = Math.round(y * 100) / 100;
    n.ground = Math.round(z * 100) / 100;
    if (kind === "junction" || kind === "hydrant") {
      n.cover = n.ground;
      n.invert = n.ground - 1.6;
    }
    if (kind === "reservoir") n.reservoirHgl = n.ground + 2;
    if (kind === "hydrant") n.description = "Hidrante";
    return { p: { ...p, nodes: [...p.nodes, n] }, id, z: n.ground };
  }

  function onHit(hit: RdapHit) {
    if (hit.kind === "node") {
      if (tool === "pipe" || tool === "pump" || tool === "valve") {
        if (!pipeFrom) {
          setPipeFrom(hit.id);
          setSelected(hit.id);
          setMsg(`Origen ${hit.id}. Clic en el destino (o en el plano vacío para crear un nudo).`);
        } else if (pipeFrom !== hit.id) {
          const id =
            tool === "pipe" ? nextId("P", project.pipes.map((t) => t.id))
              : tool === "pump" ? nextId("B", project.pumps.map((t) => t.id))
                : nextId("V", project.valves.map((t) => t.id));
          const next =
            tool === "pipe" ? { ...project, pipes: [...project.pipes, tuboNuevo(id, pipeFrom, hit.id)] }
              : tool === "pump" ? { ...project, pumps: [...project.pumps, bombaNueva(id, pipeFrom, hit.id)] }
                : { ...project, valves: [...project.valves, valvulaNueva(id, pipeFrom, hit.id)] };
          set(next);
          setSelected(id);
          setPipeFrom(null);
          setTool("select");
          setMsg(`${id} creado. Propiedades a la derecha.`);
        }
        return;
      }
      setSelected(hit.id);
      setMsg(`${hit.id} seleccionado. Edite las propiedades a la derecha.`);
      return;
    }
    if (hit.kind !== "empty") {
      setSelected(hit.id);
      setMsg(`${hit.id} seleccionado. Propiedades a la derecha.`);
      return;
    }
    if (tool === "select" || tool === "pan") return;
    if (tool === "pipe" || tool === "pump" || tool === "valve") {
      const made = hacerNudo(project, "junction", hit.x, hit.y);
      if (!pipeFrom) {
        set(made.p);
        setPipeFrom(made.id);
        setSelected(made.id);
        setMsg(`${made.id} creado como origen. Clic en el destino.`);
      } else {
        const id =
          tool === "pipe" ? nextId("P", made.p.pipes.map((t) => t.id))
            : tool === "pump" ? nextId("B", made.p.pumps.map((t) => t.id))
              : nextId("V", made.p.valves.map((t) => t.id));
        const next =
          tool === "pipe" ? { ...made.p, pipes: [...made.p.pipes, tuboNuevo(id, pipeFrom, made.id)] }
            : tool === "pump" ? { ...made.p, pumps: [...made.p.pumps, bombaNueva(id, pipeFrom, made.id)] }
              : { ...made.p, valves: [...made.p.valves, valvulaNueva(id, pipeFrom, made.id)] };
        set(next);
        setSelected(id);
        setPipeFrom(null);
        setTool("select");
        setMsg(`${made.id} y ${id} creados. Z = ${fmt(made.z, 2)} m (TIN).`);
      }
      return;
    }
    if (tool !== "junction" && tool !== "reservoir" && tool !== "tank" && tool !== "hydrant") return;
    const made = hacerNudo(project, tool, hit.x, hit.y);
    set(made.p);
    setSelected(made.id);
    setMsg(`${made.id} colocado. Z = ${fmt(made.z, 2)} m interpolada en la superficie TIN.`);
  }

  const nodeSel = project.nodes.find((n) => n.id === selected);
  const pipeSel = project.pipes.find((t) => t.id === selected);
  const pumpSel = project.pumps.find((b) => b.id === selected);
  const valveSel = project.valves.find((v) => v.id === selected);
  const slug = project.meta.proyecto.replace(/[^\wáéíóúñ]+/gi, "-").slice(0, 40) || "rdap";
  const TOOLS: { id: RdapTool; label: string; hint: string; group: string }[] = [
    { id: "select", label: "Seleccionar", group: "Edición", hint: "Clic en nudo, tubería, bomba o válvula: las propiedades salen a la derecha. Arrastre el nudo para moverlo. Esc vuelve a esta herramienta." },
    { id: "pan", label: "Pan", group: "Edición", hint: "Arrastre para desplazar el plano. Dos dedos en el trackpad también desplazan, sin cambiar la escala." },
    { id: "junction", label: "Nudo", group: "Nudos", hint: "Clic en el plano: nudo de demanda." },
    { id: "reservoir", label: "Reservorio", group: "Nudos", hint: "Fuente de HGL fijo (gravedad)." },
    { id: "tank", label: "Tanque", group: "Nudos", hint: "Almacenamiento con nivel variable." },
    { id: "hydrant", label: "Hidrante", group: "Nudos", hint: "Nudo de servicio para Q incendio." },
    { id: "pipe", label: "Tubería", group: "Tramos", hint: "Clic origen, clic destino." },
    { id: "pump", label: "Bomba", group: "Tramos", hint: "Clic succión, clic descarga." },
    { id: "valve", label: "Válvula", group: "Tramos", hint: "PRV, PSV, FCV, check o aislamiento." },
  ];
  const errN = issues.filter((i) => i.level === "ERROR").length;
  const warnN = issues.filter((i) => i.level === "WARNING").length;
  const demandaBase = project.nodes.reduce((s, n) => s + (n.demandLs || 0), 0);
  const longRed = project.pipes.reduce((s, t) => {
    const a = project.nodes.find((n) => n.id === t.start);
    const b = project.nodes.find((n) => n.id === t.end);
    return s + longitudPipe(t, a, b).L;
  }, 0);
  const toolAct = TOOLS.find((t) => t.id === tool);
  const scenarioHud =
    eps ? `EPS ${String(result?.hour ?? 0).padStart(2, "0")}h`
      : scenario === "qp" ? "Qp"
        : scenario === "qmd" ? "Qmd"
          : scenario === "qmh" ? "Qmh"
            : scenario === "incendio" ? "Incendio"
              : "Custom";
  const hasSelection = Boolean(selected);

  return (
    <div className={`rdap${tab === "mapa" ? " is-plano" : ""}${hasSelection ? " has-selection" : ""}${inspOpen ? " insp-open" : ""}`}>
      <header className="rdap-head">
        <div>
          <p className="kicker">AP-09 · Agua potable · {project.criteria.norma}</p>
          <h1>Diseño de red de agua</h1>
          <p className="rdap-head-meta">
            <span>{project.meta.proyecto}</span>
            <span>{project.meta.ubicacion || "sin ubicación"}</span>
            <span>{project.meta.datum} UTM {project.meta.utmZone}</span>
            <span>{METHOD[project.method]}</span>
            <span>red {project.meta.tipoRed} · {project.meta.tipoSistema}</span>
            <span>{project.meta.profesional || "profesional no asignado"}</span>
          </p>
        </div>
        <div className="rdap-head-actions">
          <UndoButtons undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} className="hist-btns-bar" />
          <div className="rdap-scen" role="group" aria-label="Escenarios de cálculo">
            <CalcularButton onClick={() => calcular(scenario)} dirty={!result} />
            <button type="button" className={scenario === "qp" && !eps ? "on" : ""} onClick={() => calcular("qp")}>Qp</button>
            <button type="button" className={scenario === "qmd" ? "on" : ""} onClick={() => calcular("qmd")}>Qmd ×{fmt(project.qmdFactor, 2)}</button>
            <button type="button" className={scenario === "qmh" ? "on" : ""} onClick={() => calcular("qmh")}>Qmh ×{fmt(project.qmhFactor, 2)}</button>
            <button type="button" className={scenario === "incendio" ? "on" : ""} onClick={() => calcular("incendio")}>Incendio</button>
            <button type="button" className={eps ? "on" : ""} onClick={calcularEps}>EPS 24 h</button>
          </div>
        </div>
      </header>
      <div className="rdap-inventory">
        <span><b>{project.nodes.length}</b> nudos</span>
        <span><b>{project.pipes.length}</b> tramos</span>
        <span><b>{fmt(longRed, 0)}</b> m de red</span>
        <span><b>{fmt(demandaBase, 2)}</b> L/s base</span>
        <span><b>{project.pumps.length}</b> bombas</span>
        <span><b>{project.valves.length}</b> válvulas</span>
        <span><b>{project.topoPoints.length}</b> pts TIN</span>
        <span className={errN ? "bad" : ""}><b>{errN}</b> errores</span>
        <span className={warnN ? "warn" : ""}><b>{warnN}</b> avisos</span>
        {result && (
          <>
            <span><b>{fmt(result.dashboard.pMin, 1)}</b> Pmín</span>
            <span><b>{fmt(result.dashboard.pMax, 1)}</b> Pmáx</span>
            <span><b>{fmt(result.dashboard.vMax, 2)}</b> Vmáx</span>
          </>
        )}
      </div>

      <nav className="rdap-tabs" aria-label="Secciones del modelo">
        {(
          [
            ["mapa", "Plano"],
            ["modelo", "Proyecto"],
            ["red", "Tablas"],
            ["equipos", "Equipos"],
            ["resultados", "Resultados"],
            ["memoria", "Informe"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <p className={`rdap-msg${result && !result.convergence.ok ? " bad" : ""}`}>{msg}</p>

      {tab === "modelo" && (
        <section className="rdap-grid">
          <fieldset>
            <legend>Identificación del expediente</legend>
            <div className="grid-2">
              <Field label="Proyecto"><Text value={project.meta.proyecto} onChange={(v) => set({ ...project, meta: { ...project.meta, proyecto: v } })} /></Field>
              <Field label="Cliente / entidad"><Text value={project.meta.cliente} onChange={(v) => set({ ...project, meta: { ...project.meta, cliente: v } })} /></Field>
              <Field label="Ubicación"><Text value={project.meta.ubicacion} onChange={(v) => set({ ...project, meta: { ...project.meta, ubicacion: v } })} /></Field>
              <Field label="Profesional"><Text value={project.meta.profesional} onChange={(v) => set({ ...project, meta: { ...project.meta, profesional: v } })} /></Field>
              <Field label="Revisor"><Text value={project.meta.revisor} onChange={(v) => set({ ...project, meta: { ...project.meta, revisor: v } })} /></Field>
              <Field label="Fecha"><Text value={project.meta.fecha} onChange={(v) => set({ ...project, meta: { ...project.meta, fecha: v } })} /></Field>
              <Field label="Versión"><Text value={project.meta.version} onChange={(v) => set({ ...project, meta: { ...project.meta, version: v } })} /></Field>
              <Field label="Datum"><Text value={project.meta.datum} onChange={(v) => set({ ...project, meta: { ...project.meta, datum: v } })} /></Field>
              <Field label="Zona UTM"><Text value={project.meta.utmZone} onChange={(v) => set({ ...project, meta: { ...project.meta, utmZone: v } })} /></Field>
              <Field label="Tipo de sistema">
                <select value={project.meta.tipoSistema} onChange={(e) => set({ ...project, meta: { ...project.meta, tipoSistema: e.target.value as RdapProject["meta"]["tipoSistema"] } })}>
                  <option value="gravedad">Gravedad</option>
                  <option value="bombeo">Bombeo</option>
                  <option value="mixto">Mixto</option>
                </select>
              </Field>
              <Field label="Tipo de red">
                <select value={project.meta.tipoRed} onChange={(e) => set({ ...project, meta: { ...project.meta, tipoRed: e.target.value as RdapProject["meta"]["tipoRed"] } })}>
                  <option value="rural">Rural</option>
                  <option value="urbano">Urbana</option>
                  <option value="condominial">Condominial</option>
                  <option value="industrial">Industrial / predial</option>
                </select>
              </Field>
            </div>
            <Field label="Alcance del estudio">
              <textarea rows={3} value={project.meta.alcance} onChange={(e) => set({ ...project, meta: { ...project.meta, alcance: e.target.value } })} />
            </Field>
            <Field label="Notas de proyecto">
              <textarea rows={2} value={project.meta.notas} onChange={(e) => set({ ...project, meta: { ...project.meta, notas: e.target.value } })} />
            </Field>
          </fieldset>
          <fieldset>
            <legend>Motor, escenarios y criterios</legend>
            <div className="grid-2">
              <Field label="Pérdidas de carga">
                <select value={project.method} onChange={(e) => set({ ...project, method: e.target.value as HeadlossMethod })}>
                  <option value="hazen-williams">Hazen–Williams SI (K=10.67)</option>
                  <option value="darcy-weisbach">Darcy–Weisbach + Swamee–Jain</option>
                  <option value="manning">Manning (sección llena)</option>
                </select>
              </Field>
              <Field label="Perfil normativo">
                <select
                  value={project.criteria.id}
                  onChange={(e) => {
                    const c = CRITERIOS.find((x) => x.id === e.target.value);
                    if (c) set({ ...project, criteria: { ...c } });
                  }}
                >
                  {CRITERIOS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="P mín" unit="m.c.a."><Num value={project.criteria.pMinMca} onChange={(n) => set({ ...project, criteria: { ...project.criteria, pMinMca: n } })} /></Field>
              <Field label="P máx" unit="m.c.a."><Num value={project.criteria.pMaxMca} onChange={(n) => set({ ...project, criteria: { ...project.criteria, pMaxMca: n } })} /></Field>
              <Field label="V mín" unit="m/s"><Num value={project.criteria.vMinMs} onChange={(n) => set({ ...project, criteria: { ...project.criteria, vMinMs: n } })} /></Field>
              <Field label="V máx" unit="m/s"><Num value={project.criteria.vMaxMs} onChange={(n) => set({ ...project, criteria: { ...project.criteria, vMaxMs: n } })} /></Field>
              <Field label="i máx" unit="m/km"><Num value={project.criteria.hfMaxMkm} onChange={(n) => set({ ...project, criteria: { ...project.criteria, hfMaxMkm: n } })} /></Field>
              <Field label="DN mín / máx" unit="mm">
                <div className="rdap-inline">
                  <Num value={project.criteria.dnMinMm} onChange={(n) => set({ ...project, criteria: { ...project.criteria, dnMinMm: n } })} />
                  <Num value={project.criteria.dnMaxMm} onChange={(n) => set({ ...project, criteria: { ...project.criteria, dnMaxMm: n } })} />
                </div>
              </Field>
              <Field label="Factor Qmd / Qp"><Num value={project.qmdFactor} onChange={(n) => set({ ...project, qmdFactor: n })} /></Field>
              <Field label="Factor Qmh / Qp"><Num value={project.qmhFactor} onChange={(n) => set({ ...project, qmhFactor: n })} /></Field>
              <Field label="Nudo de incendio">
                <select value={project.fireNodeId} onChange={(e) => set({ ...project, fireNodeId: e.target.value })}>
                  <option value="">— no asignado —</option>
                  {project.nodes.filter((n) => n.kind === "junction").map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
                </select>
              </Field>
              <Field label="Q incendio" unit="L/s"><Num value={project.fireLs} onChange={(n) => set({ ...project, fireLs: n })} /></Field>
              <Field label="Iteraciones máx."><Num value={project.solver.maxIter} onChange={(n) => set({ ...project, solver: { ...project.solver, maxIter: n } })} /></Field>
              <Field label="Tol. carga" unit="m"><Num value={project.solver.tolHeadM} onChange={(n) => set({ ...project, solver: { ...project.solver, tolHeadM: n } })} /></Field>
              <Field label="ν (Darcy)" unit="m²/s"><Num value={project.viscosityM2s} onChange={(n) => set({ ...project, viscosityM2s: n })} /></Field>
            </div>
          </fieldset>
          <fieldset>
            <legend>Calidad de agua (edad + cloro residual)</legend>
            <p className="lead">Mezcla ponderada por caudal y decaimiento de primer orden C = C₀ e^(−k_b t). El residual mínimo se contrasta con OS.100.</p>
            <div className="grid-2">
              <Field label="C₀ en fuente" unit="mg/L"><Num value={(project.quality ?? QUALITY_DEFAULT).sourceClMgL} onChange={(n) => set({ ...project, quality: { ...(project.quality ?? QUALITY_DEFAULT), sourceClMgL: n } })} /></Field>
              <Field label="k_b" unit="1/d"><Num value={(project.quality ?? QUALITY_DEFAULT).kbPerDay} onChange={(n) => set({ ...project, quality: { ...(project.quality ?? QUALITY_DEFAULT), kbPerDay: n } })} /></Field>
              <Field label="Cl mín" unit="mg/L"><Num value={(project.quality ?? QUALITY_DEFAULT).clMinMgL} onChange={(n) => set({ ...project, quality: { ...(project.quality ?? QUALITY_DEFAULT), clMinMgL: n } })} /></Field>
              <Field label="Cl máx" unit="mg/L"><Num value={(project.quality ?? QUALITY_DEFAULT).clMaxMgL} onChange={(n) => set({ ...project, quality: { ...(project.quality ?? QUALITY_DEFAULT), clMaxMgL: n } })} /></Field>
              <Field label="Edad máx" unit="h"><Num value={(project.quality ?? QUALITY_DEFAULT).ageMaxH} onChange={(n) => set({ ...project, quality: { ...(project.quality ?? QUALITY_DEFAULT), ageMaxH: n } })} /></Field>
            </div>
          </fieldset>
          <fieldset>
            <legend>Golpe de ariete (Joukowsky / Michaud)</legend>
            <p className="lead">Celeridad de Korteweg según material y espesor. Si T ≤ 2L/a se usa ΔH = aV/g; si no, ΔH = 2LV/(gT). Se compara P estática + ΔH con el PN del tubo.</p>
            <div className="grid-2">
              <Field label="Tiempo de cierre" unit="s"><Num value={(project.hammer ?? HAMMER_DEFAULT).tCloseS} onChange={(n) => set({ ...project, hammer: { ...(project.hammer ?? HAMMER_DEFAULT), tCloseS: n } })} /></Field>
            </div>
          </fieldset>
          <fieldset>
            <legend>Archivo del modelo e interoperabilidad</legend>
            <p className="lead">Guarde el proyecto en JSON para retomarlo. Importe nudos, tuberías o superficie desde Civil 3D (CSV / LandXML). DWG queda para el módulo CAD.</p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => descargar(`${slug}.rdap.json`, JSON.stringify(project, null, 2), "application/json")}>Guardar JSON</button>
              <button type="button" className="btn secondary" onClick={() => leerArchivo("json")}>Abrir JSON</button>
              <button type="button" className="btn secondary" onClick={() => leerArchivo("topo")}>Puntos topo CSV</button>
              <button type="button" className="btn secondary" onClick={() => leerArchivo("landxml")}>LandXML</button>
              <button type="button" className="btn secondary" onClick={() => leerArchivo("nodos")}>Nudos CSV</button>
              <button type="button" className="btn secondary" onClick={() => leerArchivo("tubos")}>Tuberías CSV</button>
              <button type="button" className="btn secondary" onClick={() => { set(proyectoDemo()); setSelected("R-01"); setFrom("R-01"); setTo("J-05"); setMsg("Ejemplo El Mirador restaurado."); }}>Cargar ejemplo</button>
              <button type="button" className="btn secondary" onClick={() => { set(proyectoVacio()); setSelected(""); setMsg("Proyecto en blanco. Añada nudos y tramos."); }}>Nuevo</button>
            </div>
            <p className="lead">{project.topoPoints.length} puntos · {project.nodes.length} nudos · {project.pipes.length} tramos · {project.pumps.length} bombas · {project.valves.length} válvulas · {issues.filter((i) => i.level === "ERROR").length} errores</p>
          </fieldset>
        </section>
      )}

      {tab === "red" && (
        <section className="rdap-split">
          <div>
            <div className="rdap-table-head">
              <h2>Nudos</h2>
              <div className="actions">
                <button type="button" className="btn secondary" onClick={() => addNode(project, set, setSelected, "junction")}>Nudo</button>
                <button type="button" className="btn secondary" onClick={() => addNode(project, set, setSelected, "hydrant")}>Hidrante</button>
                <button type="button" className="btn secondary" onClick={() => addNode(project, set, setSelected, "reservoir")}>Reservorio</button>
                <button type="button" className="btn secondary" onClick={() => addNode(project, set, setSelected, "tank")}>Tanque</button>
              </div>
            </div>
            <div className="rdap-table-wrap">
              <table className="rdap-table">
                <thead>
                  <tr><th>ID</th><th>Tipo</th><th>X</th><th>Y</th><th>Z</th><th>Qd L/s</th><th>HGL fijo</th></tr>
                </thead>
                <tbody>
                  {project.nodes.map((n) => (
                    <tr key={n.id} className={selected === n.id ? "on" : ""} onClick={() => setSelected(n.id)}>
                      <td>{n.id}</td>
                      <td>{n.kind}</td>
                      <td>{fmt(n.x, 1)}</td>
                      <td>{fmt(n.y, 1)}</td>
                      <td>{fmt(n.ground, 2)}</td>
                      <td>{fmt(n.demandLs, 2)}</td>
                      <td>{n.kind === "junction" ? "—" : fmt(n.reservoirHgl ?? ((n.tankBottom ?? 0) + (n.tankLevel ?? 0)), 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rdap-table-head">
              <h2>Tuberías</h2>
              <button type="button" className="btn secondary" onClick={() => {
                const id = nextId("P", project.pipes.map((t) => t.id));
                const a = project.nodes[0]?.id ?? "J-01";
                const b = project.nodes[1]?.id ?? a;
                set({ ...project, pipes: [...project.pipes, tuboNuevo(id, a, b)] });
                setSelected(id);
              }}>Añadir tramo</button>
            </div>
            <div className="rdap-table-wrap">
              <table className="rdap-table">
                <thead>
                  <tr><th>ID</th><th>Desde</th><th>Hasta</th><th>L</th><th>DN</th><th>ID mm</th><th>C</th><th>Mat.</th></tr>
                </thead>
                <tbody>
                  {project.pipes.map((t) => {
                    const a = project.nodes.find((n) => n.id === t.start);
                    const b = project.nodes.find((n) => n.id === t.end);
                    const { L, origen } = longitudPipe(t, a, b);
                    return (
                      <tr key={t.id} className={selected === t.id ? "on" : ""} onClick={() => setSelected(t.id)}>
                        <td>{t.id}</td>
                        <td>{t.start}</td>
                        <td>{t.end}</td>
                        <td title={origen}>{fmt(L, 1)}</td>
                        <td>{t.dnMm}</td>
                        <td>{fmt(propsPipe(t).idMm, 1)}</td>
                        <td>{fmt(propsPipe(t).C, 0)}</td>
                        <td>{t.materialId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="rdap-props">
            {nodeSel && (
              <>
                <h3>Nudo {nodeSel.id}</h3>
                <Field label="ID del nudo">
                  <Text value={nodeSel.id} onChange={(v) => {
                    const next = renombrarNodo(project, nodeSel.id, v);
                    set(next);
                    if (next !== project) setSelected(v.trim());
                  }} />
                </Field>
                <Field label="Nombre"><Text value={nodeSel.name} onChange={(v) => patchNode(project, set, nodeSel.id, { name: v })} /></Field>
                <Field label="Descripción"><Text value={nodeSel.description} onChange={(v) => patchNode(project, set, nodeSel.id, { description: v })} /></Field>
                <Field label="Tipo">
                  <select value={nodeSel.kind} onChange={(e) => patchNode(project, set, nodeSel.id, { kind: e.target.value as RdapProject["nodes"][0]["kind"] })}>
                    <option value="junction">Nudo de demanda</option>
                    <option value="hydrant">Hidrante</option>
                    <option value="reservoir">Reservorio (HGL fijo)</option>
                    <option value="tank">Tanque</option>
                  </select>
                </Field>
                <div className="grid-2">
                  <Field label="X" unit="m"><Num value={nodeSel.x} onChange={(n) => patchNode(project, set, nodeSel.id, { x: n })} /></Field>
                  <Field label="Y" unit="m"><Num value={nodeSel.y} onChange={(n) => patchNode(project, set, nodeSel.id, { y: n })} /></Field>
                  <Field label="Z terreno" unit="m"><Num value={nodeSel.ground} onChange={(n) => patchNode(project, set, nodeSel.id, { ground: n })} /></Field>
                  <Field label="Cota tapa" unit="m"><Num value={nodeSel.cover ?? nodeSel.ground} onChange={(n) => patchNode(project, set, nodeSel.id, { cover: n })} /></Field>
                  <Field label="Cota fondo" unit="m"><Num value={nodeSel.invert ?? nodeSel.ground - 1.8} onChange={(n) => patchNode(project, set, nodeSel.id, { invert: n })} /></Field>
                  <Field label="Prof. manual" unit="m"><Num value={nodeSel.depthManual ?? 0} onChange={(n) => patchNode(project, set, nodeSel.id, { depthManual: n > 0 ? n : null })} /></Field>
                  <Field label="Demanda base" unit="L/s"><Num value={nodeSel.demandLs} onChange={(n) => patchNode(project, set, nodeSel.id, { demandLs: n })} /></Field>
                  <Field label="Patrón 24 h">
                    <select value={nodeSel.patternId} onChange={(e) => patchNode(project, set, nodeSel.id, { patternId: e.target.value })}>
                      {project.patterns.map((pat) => <option key={pat.id} value={pat.id}>{pat.id} · {pat.name}</option>)}
                    </select>
                  </Field>
                </div>
                <p className="lead">Profundidad = {fmt(profundidadDe(nodeSel) ?? 0, 2)} m{inconsistenciaCotas(nodeSel) ? ` · ${inconsistenciaCotas(nodeSel)}` : ""}</p>
                {nodeSel.kind === "reservoir" && (
                  <Field label="HGL reservorio" unit="m"><Num value={nodeSel.reservoirHgl ?? nodeSel.ground} onChange={(n) => patchNode(project, set, nodeSel.id, { reservoirHgl: n })} /></Field>
                )}
                {nodeSel.kind === "tank" && (
                  <div className="grid-2">
                    <Field label="Fondo tanque" unit="m"><Num value={nodeSel.tankBottom ?? nodeSel.ground} onChange={(n) => patchNode(project, set, nodeSel.id, { tankBottom: n })} /></Field>
                    <Field label="Nivel" unit="m"><Num value={nodeSel.tankLevel ?? 2} onChange={(n) => patchNode(project, set, nodeSel.id, { tankLevel: n })} /></Field>
                    <Field label="Nivel mín" unit="m"><Num value={nodeSel.tankMin ?? 1} onChange={(n) => patchNode(project, set, nodeSel.id, { tankMin: n })} /></Field>
                    <Field label="Nivel máx" unit="m"><Num value={nodeSel.tankMax ?? 4} onChange={(n) => patchNode(project, set, nodeSel.id, { tankMax: n })} /></Field>
                    <Field label="Ø tanque" unit="m"><Num value={nodeSel.tankDiameter ?? 8} onChange={(n) => patchNode(project, set, nodeSel.id, { tankDiameter: n })} /></Field>
                  </div>
                )}
                <button type="button" className="btn secondary" onClick={() => { set(borrarNodo(project, nodeSel.id)); setSelected(project.nodes.find((n) => n.id !== nodeSel.id)?.id ?? ""); }}>Eliminar nudo</button>
              </>
            )}
            {pipeSel && (
              <>
                <h3>Tubería {pipeSel.id}</h3>
                <div className="grid-2">
                  <Field label="Inicio">
                    <select value={pipeSel.start} onChange={(e) => patchPipe(project, set, pipeSel.id, { start: e.target.value })}>
                      {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
                    </select>
                  </Field>
                  <Field label="Fin">
                    <select value={pipeSel.end} onChange={(e) => patchPipe(project, set, pipeSel.id, { end: e.target.value })}>
                      {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
                    </select>
                  </Field>
                  <Field label="DN" unit="mm"><Num value={pipeSel.dnMm} onChange={(n) => patchPipe(project, set, pipeSel.id, { dnMm: n })} /></Field>
                  <Field label="ID override" unit="mm"><Num value={pipeSel.idMm ?? 0} onChange={(n) => patchPipe(project, set, pipeSel.id, { idMm: n > 0 ? n : null })} /></Field>
                  <Field label="Material">
                    <select value={pipeSel.materialId} onChange={(e) => patchPipe(project, set, pipeSel.id, { materialId: e.target.value })}>
                      {MATERIALES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Longitud manual" unit="m"><Num value={pipeSel.lengthM ?? 0} onChange={(n) => patchPipe(project, set, pipeSel.id, { lengthM: n > 0 ? n : null })} /></Field>
                  <Field label="C Hazen–Williams">
                    <select
                      value={pipeSel.cHw ?? ""}
                      onChange={(e) => patchPipe(project, set, pipeSel.id, { cHw: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Según material ({MATERIALES.find((m) => m.id === pipeSel.materialId)?.cHw ?? 150})</option>
                      {[...new Map(MATERIALES.map((m) => [m.cHw, m.name])).entries()]
                        .sort((a, b) => b[0] - a[0])
                        .map(([c, name]) => (
                          <option key={c} value={c}>C = {c} · {name}</option>
                        ))}
                    </select>
                  </Field>
                  <Field label="ε override" unit="mm"><Num value={pipeSel.roughnessMm ?? 0} onChange={(n) => patchPipe(project, set, pipeSel.id, { roughnessMm: n > 0 ? n : null })} /></Field>
                  <Field label="n Manning override"><Num value={pipeSel.manningN ?? 0} onChange={(n) => patchPipe(project, set, pipeSel.id, { manningN: n > 0 ? n : null })} /></Field>
                  <Field label="K menores"><Num value={pipeSel.minorK} onChange={(n) => patchPipe(project, set, pipeSel.id, { minorK: n })} /></Field>
                  <Field label="Longitud 3D">
                    <select value={pipeSel.use3d ? "1" : "0"} onChange={(e) => patchPipe(project, set, pipeSel.id, { use3d: e.target.value === "1" })}>
                      <option value="0">Horizontal (X,Y)</option>
                      <option value="1">3D (X,Y,Z)</option>
                    </select>
                  </Field>
                  <Field label="Estado">
                    <select value={pipeSel.status} onChange={(e) => patchPipe(project, set, pipeSel.id, { status: e.target.value as "open" | "closed" })}>
                      <option value="open">Abierta</option>
                      <option value="closed">Cerrada (falla / sectorización)</option>
                    </select>
                  </Field>
                </div>
                <p className="lead">
                  ID hidráulico {fmt(propsPipe(pipeSel).idMm, 1)} mm · C = {fmt(propsPipe(pipeSel).C, 0)} ·{" "}
                  {longitudPipe(pipeSel, project.nodes.find((n) => n.id === pipeSel.start), project.nodes.find((n) => n.id === pipeSel.end)).origen}
                  {pipeSel.lengthM ? "" : " · deje longitud 0 para calcularla por coordenadas"}
                </p>
                <button type="button" className="btn secondary" onClick={() => { set({ ...project, pipes: project.pipes.filter((t) => t.id !== pipeSel.id) }); setSelected(""); }}>Eliminar tramo</button>
              </>
            )}
            {!nodeSel && !pipeSel && <p className="lead">Seleccione un nudo o un tramo en las tablas.</p>}
          </aside>
        </section>
      )}

      {tab === "equipos" && (
        <section className="rdap-split">
          <div>
            <div className="rdap-table-head">
              <h2>Bombas</h2>
              <button type="button" className="btn secondary" onClick={() => {
                const id = nextId("B", project.pumps.map((b) => b.id));
                const a = project.nodes.find((n) => n.kind === "reservoir")?.id ?? project.nodes[0]?.id ?? "R-01";
                const b = project.nodes.find((n) => n.kind === "junction")?.id ?? project.nodes[1]?.id ?? a;
                set({ ...project, pumps: [...project.pumps, bombaNueva(id, a, b)] });
                setSelected(id);
              }}>Añadir bomba</button>
            </div>
            <div className="rdap-table-wrap">
              <table className="rdap-table">
                <thead><tr><th>ID</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Puntos</th></tr></thead>
                <tbody>
                  {project.pumps.map((b) => (
                    <tr key={b.id} className={selected === b.id ? "on" : ""} onClick={() => setSelected(b.id)}>
                      <td>{b.id}</td><td>{b.start}</td><td>{b.end}</td><td>{b.status}</td><td>{b.curve.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rdap-table-head">
              <h2>Válvulas</h2>
              <button type="button" className="btn secondary" onClick={() => {
                const id = nextId("V", project.valves.map((v) => v.id));
                const a = project.nodes[0]?.id ?? "J-01";
                const b = project.nodes[1]?.id ?? a;
                set({ ...project, valves: [...project.valves, valvulaNueva(id, a, b)] });
                setSelected(id);
              }}>Añadir válvula</button>
            </div>
            <div className="rdap-table-wrap">
              <table className="rdap-table">
                <thead><tr><th>ID</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Consigna</th><th>DN</th><th>Comando</th></tr></thead>
                <tbody>
                  {project.valves.map((v) => (
                    <tr key={v.id} className={selected === v.id ? "on" : ""} onClick={() => setSelected(v.id)}>
                      <td>{v.id}</td><td>{v.kind}</td><td>{v.start}</td><td>{v.end}</td><td>{v.setting}</td><td>{v.dnMm}</td><td>{v.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>Patrones horarios</h2>
            {project.patterns.map((pat, pi) => (
              <fieldset key={pat.id}>
                <legend>{pat.id}</legend>
                <div className="grid-2">
                  <Field label="Nombre"><Text value={pat.name} onChange={(v) => {
                    const patterns = project.patterns.map((x, i) => (i === pi ? { ...x, name: v } : x));
                    set({ ...project, patterns });
                  }} /></Field>
                </div>
                <div className="rdap-pattern">
                  {pat.multipliers.map((m, h) => (
                    <label key={h}>
                      <span>{String(h).padStart(2, "0")}</span>
                      <input
                        type="number"
                        step="any"
                        value={m}
                        onChange={(e) => {
                          const multipliers = [...pat.multipliers];
                          multipliers[h] = parseFloat(e.target.value);
                          const patterns = project.patterns.map((x, i) => (i === pi ? { ...x, multipliers } : x));
                          set({ ...project, patterns });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                const id = nextId("PAT", project.patterns.map((x) => x.id));
                set({
                  ...project,
                  patterns: [...project.patterns, { id, name: "Nuevo patrón", multipliers: Array(24).fill(1) }],
                });
              }}
            >
              Añadir patrón
            </button>
          </div>
          <aside className="rdap-props">
            {pumpSel && (
              <>
                <h3>Bomba {pumpSel.id}</h3>
                <Field label="Nombre"><Text value={pumpSel.name} onChange={(v) => patchPump(project, set, pumpSel.id, { name: v })} /></Field>
                <Field label="Succión">
                  <select value={pumpSel.start} onChange={(e) => patchPump(project, set, pumpSel.id, { start: e.target.value })}>
                    {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
                  </select>
                </Field>
                <Field label="Descarga">
                  <select value={pumpSel.end} onChange={(e) => patchPump(project, set, pumpSel.id, { end: e.target.value })}>
                    {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
                  </select>
                </Field>
                <Field label="Estado">
                  <select value={pumpSel.status} onChange={(e) => patchPump(project, set, pumpSel.id, { status: e.target.value as "on" | "off" })}>
                    <option value="on">En servicio</option>
                    <option value="off">Fuera de servicio</option>
                  </select>
                </Field>
                <p className="lead">Curva Q–H. El motor interpola linealmente. Añada al menos dos puntos.</p>
                {pumpSel.curve.map((c, i) => (
                  <div key={i} className="rdap-inline">
                    <Field label={`Q${i + 1}`} unit="L/s"><Num value={c.qLs} onChange={(n) => patchCurve(project, set, pumpSel.id, i, { qLs: n })} /></Field>
                    <Field label={`H${i + 1}`} unit="m"><Num value={c.hM} onChange={(n) => patchCurve(project, set, pumpSel.id, i, { hM: n })} /></Field>
                  </div>
                ))}
                <div className="actions">
                  <button type="button" className="btn secondary" onClick={() => {
                    const last = pumpSel.curve[pumpSel.curve.length - 1] ?? { qLs: 0, hM: 30 };
                    patchPump(project, set, pumpSel.id, { curve: [...pumpSel.curve, { qLs: last.qLs + 4, hM: Math.max(5, last.hM - 5) }] });
                  }}>Añadir punto</button>
                  <button type="button" className="btn secondary" onClick={() => set({ ...project, pumps: project.pumps.filter((b) => b.id !== pumpSel.id) })}>Eliminar bomba</button>
                </div>
              </>
            )}
            {valveSel && (
              <ValveEditor project={project} set={set} valve={valveSel} result={result} />
            )}
            {!pumpSel && !valveSel && (
              <p className="lead">Seleccione una bomba o una válvula. PRV, PSV y FCV usan control de estados ACTIVE / OPEN / CLOSED (tipo EPANET).</p>
            )}
          </aside>
        </section>
      )}

      {tab === "mapa" && (
        <section className="rdap-plano">
          <p className="rdap-cmd" title={toolAct?.hint}>
            <span>Comando</span>
            <strong>{toolAct?.label ?? "Seleccionar"}{pipeFrom ? ` · ${pipeFrom}` : ""}</strong>
            <em>{toolAct?.hint}</em>
          </p>
          <div className="rdap-cad">
            <aside className={`rdap-tools${toolsOpen ? " is-open" : ""}`} aria-label="Herramientas de diseño">
              <div className="rdap-tools-rail">
                <UndoButtons undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={tool === t.id ? "on" : ""}
                    title={t.hint}
                    aria-label={t.label}
                    onClick={() => { setTool(t.id); setPipeFrom(null); setMsg(t.hint); setToolsOpen(false); }}
                  >
                    <ToolGlyph id={t.id} />
                    <span>{t.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`rdap-tools-toggle${toolsOpen ? " on" : ""}`}
                  aria-expanded={toolsOpen}
                  title="Archivo e interoperabilidad"
                  onClick={() => setToolsOpen((v) => !v)}
                >
                  <span className="rdap-tools-toggle-ico" aria-hidden>···</span>
                  <span>Archivo</span>
                </button>
              </div>
              <div className="rdap-tools-panel">
                <p>Interoperar</p>
                <button type="button" onClick={() => leerArchivo("topo")}>CSV / TXT</button>
                <button type="button" onClick={() => leerArchivo("landxml")}>LandXML</button>
                <button type="button" onClick={() => leerArchivo("json")}>Abrir JSON</button>
                <button type="button" onClick={() => descargar(`${slug}.rdap.json`, JSON.stringify(project, null, 2), "application/json")}>Guardar</button>
                {pipeFrom ? <p className="rdap-tool-hint">Origen: {pipeFrom}</p> : null}
              </div>
            </aside>
            <div className="rdap-cad-main">
              <RdapMap
                project={project}
                result={result}
                selected={selected}
                tool={tool}
                pipeFrom={pipeFrom}
                scenarioLabel={scenarioHud}
                onHit={(hit) => {
                  onHit(hit);
                  if (hit.kind !== "empty") setInspOpen(true);
                }}
                onTool={(t) => {
                  setTool(t);
                  setPipeFrom(null);
                  setMsg(
                    t === "select" ? "Seleccionar: clic en el elemento. Las propiedades salen a la derecha."
                      : t === "pan" ? "Pan: arrastre para desplazar. Un clic corto sigue seleccionando el elemento."
                        : "Seleccionar.",
                  );
                }}
                onMoveNode={(id, x, y) => {
                  const z = interpolarTin(x, y, project.topoPoints) ?? zTerrenoDePuntos(x, y, project.topoPoints);
                  setProject({
                    ...project,
                    nodes: project.nodes.map((n) => (n.id === id ? { ...n, x, y, ground: z ?? n.ground } : n)),
                  });
                }}
              />
              <div className="rdap-profile-bar">
                <h3>Perfil hidráulico</h3>
                <Field label="Desde">
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
                  </select>
                </Field>
                <Field label="Hasta">
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
                  </select>
                </Field>
              </div>
              <RdapPerfil project={project} result={result} from={from} to={to} />
            </div>
            <aside className="rdap-props rdap-inspector">
              <div className="rdap-inspector-head">
                <p className="rdap-inspector-kicker">Inspector</p>
                <button
                  type="button"
                  className="rdap-inspector-close"
                  aria-label={inspOpen ? "Ocultar inspector" : "Mostrar inspector"}
                  onClick={() => setInspOpen((v) => !v)}
                >
                  {inspOpen ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {nodeSel && <NodeInspector project={project} set={set} node={nodeSel} result={result} onSelect={setSelected} />}
              {pipeSel && <PipeInspector project={project} set={set} pipe={pipeSel} result={result} onClear={() => setSelected("")} />}
              {pumpSel && (
                <>
                  <h3>Bomba {pumpSel.id}</h3>
                  <p className="rdap-badge">Equipo · {pumpSel.status === "on" ? "en servicio" : "fuera"}</p>
                  <Field label="Nombre"><Text value={pumpSel.name} onChange={(v) => patchPump(project, set, pumpSel.id, { name: v })} /></Field>
                  {result?.pumps.find((b) => b.id === pumpSel.id) && (
                    <dl className="rdap-hydro">
                      <div><dt>Caudal</dt><dd>{fmt(result.pumps.find((b) => b.id === pumpSel.id)!.qLs, 2)} L/s</dd></div>
                      <div><dt>Altura</dt><dd>{fmt(result.pumps.find((b) => b.id === pumpSel.id)!.headM, 2)} m</dd></div>
                    </dl>
                  )}
                </>
              )}
              {valveSel && <ValveEditor project={project} set={set} valve={valveSel} result={result} />}
              {!nodeSel && !pipeSel && !pumpSel && !valveSel && (
                <div className="rdap-empty-insp">
                  <h3>Sin selección</h3>
                  <p>Pulse Seleccionar (flecha) y haga clic en un nudo, tubería, bomba o válvula. El inspector muestra datos y resultados.</p>
                  <dl className="rdap-hydro">
                    <div><dt>Criterio P</dt><dd>{project.criteria.pMinMca}–{project.criteria.pMaxMca} m.c.a.</dd></div>
                    <div><dt>Criterio V</dt><dd>{project.criteria.vMinMs}–{project.criteria.vMaxMs} m/s</dd></div>
                    <div><dt>i máx</dt><dd>{project.criteria.hfMaxMkm} m/km</dd></div>
                    <div><dt>DN</dt><dd>{project.criteria.dnMinMm}–{project.criteria.dnMaxMm} mm</dd></div>
                  </dl>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {tab === "resultados" && (
        <section>
          {result ? (
            <>
              <div className="rdap-dash">
                <Kpi label="Estado" value={result.convergence.ok ? "CONVERGENTE" : "NO CONVERGE"} />
                <Kpi label="Escenario" value={eps ? `EPS ${String(result.hour ?? 0).padStart(2, "0")}:00` : SCENARIO_LABEL[result.scenario]} />
                <Kpi label="Q demanda / fuente" value={`${fmt(result.dashboard.demandLs, 2)} / ${fmt(result.dashboard.sourceLs, 2)} L/s`} />
                <Kpi label="Balance masa" value={`${fmt(result.dashboard.balanceLs, 4)} L/s`} />
                <Kpi label="P mín / máx" value={`${fmt(result.dashboard.pMin, 1)} / ${fmt(result.dashboard.pMax, 1)}`} />
                <Kpi label="V máx" value={`${fmt(result.dashboard.vMax, 2)} m/s`} />
                <Kpi label="Alertas" value={`${result.dashboard.critical} / ${result.dashboard.warnings}`} />
                <Kpi label="Cl mín / edad" value={`${fmt(result.dashboard.clMin, 2)} mg/L · ${fmt(result.dashboard.ageMaxH, 1)} h`} />
                <Kpi label="ΔH ariete" value={`${fmt(result.dashboard.hammerMaxM, 1)} m`} />
              </div>
              <div className="actions">
                <button type="button" className="btn secondary" onClick={() => {
                  const { nodos, tubos, valvulas, calidad, ariete } = csvResultados(project, result);
                  descargar(`${slug}-nudos.csv`, nodos, "text/csv");
                  descargar(`${slug}-tramos.csv`, tubos, "text/csv");
                  if (valvulas.split("\n").length > 1) descargar(`${slug}-valvulas.csv`, valvulas, "text/csv");
                  descargar(`${slug}-calidad.csv`, calidad, "text/csv");
                  descargar(`${slug}-ariete.csv`, ariete, "text/csv");
                }}>Exportar CSV</button>
              </div>
              {eps && <p className="lead">Mostrando la hora crítica del EPS. La tabla horaria completa entra al informe.</p>}
              <div className="rdap-table-wrap">
                <table className="rdap-table">
                  <thead><tr><th>Nudo</th><th>Qd</th><th>HGL</th><th>P m.c.a.</th><th>Estado</th><th>Trazabilidad</th></tr></thead>
                  <tbody>
                    {result.nodes.map((n) => (
                      <tr key={n.id} className={n.status === "CRITICAL" ? "bad" : n.status === "WARNING" ? "warn" : ""} onClick={() => setSelected(n.id)}>
                        <td>{n.id}</td>
                        <td>{fmt(n.demandLs, 2)}</td>
                        <td>{fmt(n.hgl, 2)}</td>
                        <td>{fmt(n.pressureMca, 2)}</td>
                        <td>{n.status}</td>
                        <td>{n.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rdap-table-wrap">
                <table className="rdap-table">
                  <thead><tr><th>Tramo</th><th>Q L/s</th><th>V</th><th>hf</th><th>m/km</th><th>Estado</th></tr></thead>
                  <tbody>
                    {result.pipes.map((t) => (
                      <tr key={t.id} className={t.status === "CRITICAL" ? "bad" : t.status === "WARNING" ? "warn" : ""} onClick={() => setSelected(t.id)}>
                        <td>{t.id}</td>
                        <td>{fmt(t.qLs, 2)}</td>
                        <td>{fmt(t.velocity, 2)}</td>
                        <td>{fmt(t.hf, 3)}</td>
                        <td>{fmt(t.hfMkm, 2)}</td>
                        <td>{t.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.pumps.length > 0 && (
                <div className="rdap-table-wrap">
                  <table className="rdap-table">
                    <thead><tr><th>Bomba</th><th>Q L/s</th><th>H m</th></tr></thead>
                    <tbody>
                      {result.pumps.map((b) => (
                        <tr key={b.id}><td>{b.id}</td><td>{fmt(b.qLs, 2)}</td><td>{fmt(b.headM, 2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.prvAudit?.length > 0 && (
                <ul className="rdap-causes">{result.prvAudit.map((a) => <li key={a.message}>{a.code} — {a.message}</li>)}</ul>
              )}
              {result.quality?.nodes.length > 0 && (
                <div className="rdap-table-wrap">
                  <table className="rdap-table">
                    <thead><tr><th>Nudo</th><th>Edad h</th><th>Cl mg/L</th><th>Estado</th><th>Trazabilidad</th></tr></thead>
                    <tbody>
                      {result.quality.nodes.map((n) => (
                        <tr key={n.id} className={n.status === "CRITICAL" ? "bad" : n.status === "WARNING" ? "warn" : ""} onClick={() => setSelected(n.id)}>
                          <td>{n.id}</td>
                          <td>{fmt(n.ageH, 2)}</td>
                          <td>{fmt(n.clMgL, 2)}</td>
                          <td>{n.status}</td>
                          <td>{n.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.hammer?.pipes.length > 0 && (
                <div className="rdap-table-wrap">
                  <table className="rdap-table">
                    <thead><tr><th>Tramo</th><th>a m/s</th><th>2L/a s</th><th>Método</th><th>ΔH m</th><th>Ptrans</th><th>PN</th><th>Nota</th></tr></thead>
                    <tbody>
                      {result.hammer.pipes.map((t) => (
                        <tr key={t.id} className={t.ok ? "" : "bad"} onClick={() => setSelected(t.id)}>
                          <td>{t.id}</td>
                          <td>{fmt(t.aMs, 0)}</td>
                          <td>{fmt(t.tCritS, 2)}</td>
                          <td>{t.method}</td>
                          <td>{fmt(t.dHM, 2)}</td>
                          <td>{fmt(t.pTransMca, 1)}</td>
                          <td>{fmt(t.pnMca, 0)}</td>
                          <td>{t.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.valves.length > 0 && (
                <div className="rdap-table-wrap">
                  <table className="rdap-table">
                    <thead><tr><th>Válvula</th><th>Modo</th><th>Q L/s</th><th>ΔH m</th><th>Consigna</th><th>Trazabilidad</th></tr></thead>
                    <tbody>
                      {result.valves.map((v) => (
                        <tr key={v.id} className={v.mode === "CLOSED" ? "warn" : ""} onClick={() => setSelected(v.id)}>
                          <td>{v.id}</td>
                          <td>{v.mode}</td>
                          <td>{fmt(v.qLs, 2)}</td>
                          <td>{fmt(v.headlossM, 2)}</td>
                          <td>{fmt(v.setting, 2)}</td>
                          <td>{v.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!result.convergence.ok && (
                <ul className="rdap-causes">{result.convergence.causes.map((c) => <li key={c}>{c}</li>)}</ul>
              )}
            </>
          ) : (
            <p className="lead">Aún no hay resultados. Pulse Qp, Qmd, Qmh o Incendio.</p>
          )}
        </section>
      )}

      {tab === "memoria" && (
        <div className="rdap-paper">
          <div className="actions">
            <CalcularButton onClick={publicarMemoria} dirty={dirty} />
            <button type="button" className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
            <button type="button" className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
          </div>
          <CalcDirtyNote dirty={dirty} />
          {memoria ? <Paper
            doc={memoria}
            renderFigure={(part) =>
              part === "plano" ? (
                <div className="rdap-figure">
                  <RdapMap project={pack.project} result={pack.result} selected={selected} tool="select" pipeFrom={null} chrome={false} onHit={(h) => { if (h.kind !== "empty") setSelected(h.id); }} />
                </div>
              ) : part === "perfil" ? (
                <div className="rdap-figure">
                  <RdapPerfil project={pack.project} result={pack.result} from={from} to={to} />
                </div>
              ) : null
            }
          /> : <MemoriaPendiente hint="Calcule un escenario hidráulico (Qp, Qmd, Qmh o Incendio) y pulse Calcular para actualizar la memoria." />}
        </div>
      )}
    </div>
  );
}

const METHOD: Record<HeadlossMethod, string> = {
  "hazen-williams": "Hazen–Williams",
  "darcy-weisbach": "Darcy–Weisbach",
  manning: "Manning",
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rdap-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ToolGlyph({ id }: { id: RdapTool }) {
  return <i className={`rdap-glyph rdap-glyph-${id}`} aria-hidden />;
}

function NodeInspector({
  project,
  set,
  node,
  result,
  onSelect,
}: {
  project: RdapProject;
  set: (p: RdapProject) => void;
  node: RdapProject["nodes"][0];
  result: RunResult | null;
  onSelect: (id: string) => void;
}) {
  const nr = result?.nodes.find((n) => n.id === node.id);
  const tipo =
    node.kind === "reservoir" ? "Reservorio"
      : node.kind === "tank" ? "Tanque"
        : node.kind === "hydrant" ? "Hidrante"
          : "Nudo de demanda";
  return (
    <>
      <h3>{tipo} {node.id}</h3>
      <p className={`rdap-badge${nr?.status === "CRITICAL" ? " bad" : nr?.status === "WARNING" ? " warn" : ""}`}>
        {nr ? `${nr.status} · ${nr.note}` : "Sin corrida en este objeto"}
      </p>
      <Field label="ID"><Text value={node.id} onChange={(v) => { const next = renombrarNodo(project, node.id, v); set(next); if (next !== project) onSelect(v.trim()); }} /></Field>
      <Field label="Nombre"><Text value={node.name} onChange={(v) => patchNode(project, set, node.id, { name: v })} /></Field>
      <Field label="Tipo">
        <select value={node.kind} onChange={(e) => patchNode(project, set, node.id, { kind: e.target.value as RdapProject["nodes"][0]["kind"] })}>
          <option value="junction">Nudo de demanda</option>
          <option value="hydrant">Hidrante</option>
          <option value="reservoir">Reservorio</option>
          <option value="tank">Tanque</option>
        </select>
      </Field>
      <div className="grid-2">
        <Field label="X" unit="m"><Num value={node.x} onChange={(n) => patchNode(project, set, node.id, { x: n })} /></Field>
        <Field label="Y" unit="m"><Num value={node.y} onChange={(n) => patchNode(project, set, node.id, { y: n })} /></Field>
        <Field label="Z terreno" unit="m"><Num value={node.ground} onChange={(n) => patchNode(project, set, node.id, { ground: n })} /></Field>
        <Field label="Cota tapa" unit="m"><Num value={node.cover ?? node.ground} onChange={(n) => patchNode(project, set, node.id, { cover: n })} /></Field>
        <Field label="Cota fondo" unit="m"><Num value={node.invert ?? node.ground - 1.8} onChange={(n) => patchNode(project, set, node.id, { invert: n })} /></Field>
        <Field label="Demanda" unit="L/s"><Num value={node.demandLs} onChange={(n) => patchNode(project, set, node.id, { demandLs: n })} /></Field>
      </div>
      {node.kind === "reservoir" && (
        <Field label="HGL" unit="m"><Num value={node.reservoirHgl ?? node.ground} onChange={(n) => patchNode(project, set, node.id, { reservoirHgl: n })} /></Field>
      )}
      {node.kind === "tank" && (
        <div className="grid-2">
          <Field label="Nivel" unit="m"><Num value={node.tankLevel ?? 2} onChange={(n) => patchNode(project, set, node.id, { tankLevel: n })} /></Field>
          <Field label="Ø" unit="m"><Num value={node.tankDiameter ?? 8} onChange={(n) => patchNode(project, set, node.id, { tankDiameter: n })} /></Field>
        </div>
      )}
      {nr && (
        <dl className="rdap-hydro">
          <div><dt>HGL</dt><dd>{fmt(nr.hgl, 2)} m</dd></div>
          <div><dt>Presión</dt><dd>{fmt(nr.pressureMca, 2)} m.c.a.</dd></div>
          <div><dt>Q demanda</dt><dd>{fmt(nr.demandLs, 2)} L/s</dd></div>
          <div><dt>Profundidad</dt><dd>{fmt(profundidadDe(node) ?? 0, 2)} m</dd></div>
        </dl>
      )}
      <button type="button" className="btn secondary" onClick={() => { set(borrarNodo(project, node.id)); onSelect(project.nodes.find((n) => n.id !== node.id)?.id ?? ""); }}>Eliminar</button>
    </>
  );
}

function PipeInspector({
  project,
  set,
  pipe,
  result,
  onClear,
}: {
  project: RdapProject;
  set: (p: RdapProject) => void;
  pipe: RdapProject["pipes"][0];
  result: RunResult | null;
  onClear: () => void;
}) {
  const pr = result?.pipes.find((t) => t.id === pipe.id);
  const a = project.nodes.find((n) => n.id === pipe.start);
  const b = project.nodes.find((n) => n.id === pipe.end);
  const { L, origen } = longitudPipe(pipe, a, b);
  const props = propsPipe(pipe);
  return (
    <>
      <h3>Tubería {pipe.id}</h3>
      <p className={`rdap-badge${pr?.status === "CRITICAL" ? " bad" : pr?.status === "WARNING" ? " warn" : ""}`}>
        {pipe.start} → {pipe.end} · {origen}
      </p>
      <Field label="DN" unit="mm"><Num value={pipe.dnMm} onChange={(n) => patchPipe(project, set, pipe.id, { dnMm: n })} /></Field>
      <Field label="Material">
        <select value={pipe.materialId} onChange={(e) => patchPipe(project, set, pipe.id, { materialId: e.target.value })}>
          {MATERIALES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      <Field label="C HW"><Num value={pipe.cHw ?? props.C} onChange={(n) => patchPipe(project, set, pipe.id, { cHw: n > 0 ? n : null })} /></Field>
      <Field label="Long. manual" unit="m"><Num value={pipe.lengthM ?? 0} onChange={(n) => patchPipe(project, set, pipe.id, { lengthM: n > 0 ? n : null })} /></Field>
      <Field label="Estado">
        <select value={pipe.status} onChange={(e) => patchPipe(project, set, pipe.id, { status: e.target.value as "open" | "closed" })}>
          <option value="open">Abierta</option>
          <option value="closed">Cerrada</option>
        </select>
      </Field>
      <dl className="rdap-hydro">
        <div><dt>Longitud</dt><dd>{fmt(L, 2)} m</dd></div>
        <div><dt>ID hidráulico</dt><dd>{fmt(props.idMm, 1)} mm</dd></div>
        <div><dt>C</dt><dd>{fmt(props.C, 0)}</dd></div>
        {pr && (
          <>
            <div><dt>Caudal</dt><dd>{fmt(pr.qLs, 2)} L/s</dd></div>
            <div><dt>Velocidad</dt><dd>{fmt(pr.velocity, 2)} m/s</dd></div>
            <div><dt>hf</dt><dd>{fmt(pr.hf, 3)} m</dd></div>
            <div><dt>Gradiente</dt><dd>{fmt(pr.hfMkm, 2)} m/km</dd></div>
          </>
        )}
      </dl>
      <button type="button" className="btn secondary" onClick={() => { set({ ...project, pipes: project.pipes.filter((t) => t.id !== pipe.id) }); onClear(); }}>Eliminar</button>
    </>
  );
}

function addNode(
  project: RdapProject,
  set: (p: RdapProject) => void,
  setSelected: (id: string) => void,
  kind: RdapProject["nodes"][0]["kind"],
) {
  const prefix = kind === "reservoir" ? "R" : kind === "tank" ? "T" : kind === "hydrant" ? "H" : "J";
  const id = nextId(prefix, project.nodes.map((n) => n.id));
  const n = nodoNuevo(id, kind);
  const last = project.nodes[project.nodes.length - 1];
  if (last) {
    n.x = last.x + 80;
    n.y = last.y;
    n.ground = last.ground - 0.4;
    n.cover = kind === "junction" || kind === "hydrant" ? n.ground : null;
    n.invert = kind === "junction" || kind === "hydrant" ? n.ground - 1.6 : null;
  }
  set({ ...project, nodes: [...project.nodes, n] });
  setSelected(id);
}

function patchNode(project: RdapProject, set: (p: RdapProject) => void, id: string, patch: Partial<RdapProject["nodes"][0]>) {
  set({ ...project, nodes: project.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
}

function patchPipe(project: RdapProject, set: (p: RdapProject) => void, id: string, patch: Partial<RdapProject["pipes"][0]>) {
  set({ ...project, pipes: project.pipes.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
}

function patchPump(project: RdapProject, set: (p: RdapProject) => void, id: string, patch: Partial<RdapProject["pumps"][0]>) {
  set({ ...project, pumps: project.pumps.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}

function ValveEditor({
  project,
  set,
  valve,
  result,
}: {
  project: RdapProject;
  set: (p: RdapProject) => void;
  valve: RdapProject["valves"][0];
  result: RunResult | null;
}) {
  const vr = result?.valves.find((x) => x.id === valve.id);
  const consigna =
    valve.kind === "fcv" ? "L/s"
      : valve.kind === "tcv" ? "K"
        : "m.c.a.";
  return (
    <>
      <h3>Válvula {valve.id}</h3>
      <Field label="Tipo">
        <select value={valve.kind} onChange={(e) => patchValve(project, set, valve.id, { kind: e.target.value as ValveKind })}>
          {(Object.keys(VALVE_LABEL) as ValveKind[]).map((k) => (
            <option key={k} value={k}>{VALVE_LABEL[k]}</option>
          ))}
        </select>
      </Field>
      <Field label="Nombre"><Text value={valve.name} onChange={(v) => patchValve(project, set, valve.id, { name: v })} /></Field>
      <Field label="Desde (aguas arriba)">
        <select value={valve.start} onChange={(e) => patchValve(project, set, valve.id, { start: e.target.value })}>
          {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
        </select>
      </Field>
      <Field label="Hasta (aguas abajo)">
        <select value={valve.end} onChange={(e) => patchValve(project, set, valve.id, { end: e.target.value })}>
          {project.nodes.map((n) => <option key={n.id}>{n.id}</option>)}
        </select>
      </Field>
      <Field label="Consigna" unit={consigna} note={valve.kind === "prv" ? "Presión máxima aguas abajo" : valve.kind === "psv" ? "Presión mínima aguas arriba" : valve.kind === "fcv" ? "Caudal máximo" : "Pérdida menor K"}>
        <Num value={valve.setting} onChange={(n) => patchValve(project, set, valve.id, { setting: n })} />
      </Field>
      <Field label="DN" unit="mm" note="Diámetro de la válvula (pérdida cuando está OPEN)">
        <Num value={valve.dnMm} onChange={(n) => patchValve(project, set, valve.id, { dnMm: n })} />
      </Field>
      <Field label="Comando" note="Auto = el solver elige ACTIVE / OPEN / CLOSED">
        <select value={valve.status} onChange={(e) => patchValve(project, set, valve.id, { status: e.target.value as ValveCommand })}>
          <option value="auto">Automático (EPANET)</option>
          <option value="open">Forzar abierta</option>
          <option value="closed">Forzar cerrada</option>
        </select>
      </Field>
      {vr && (
        <p className="lead">
          {vr.mode} · Q {fmt(vr.qLs, 2)} L/s · ΔH {fmt(vr.headlossM, 2)} m · {vr.note}
        </p>
      )}
      <button type="button" className="btn secondary" onClick={() => set({ ...project, valves: project.valves.filter((v) => v.id !== valve.id) })}>Eliminar válvula</button>
    </>
  );
}

function patchValve(project: RdapProject, set: (p: RdapProject) => void, id: string, patch: Partial<RdapProject["valves"][0]>) {
  set({ ...project, valves: project.valves.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
}

function patchCurve(project: RdapProject, set: (p: RdapProject) => void, id: string, i: number, patch: { qLs?: number; hM?: number }) {
  set({
    ...project,
    pumps: project.pumps.map((b) =>
      b.id === id ? { ...b, curve: b.curve.map((c, k) => (k === i ? { ...c, ...patch } : c)) } : b,
    ),
  });
}
