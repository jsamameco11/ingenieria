import { useMemo, useState } from "react";
import {
  addBeam,
  addColumnAt,
  addLoad,
  addReference,
  addSlab,
  addStair,
  addSupportAt,
  addSupportXY,
  addWall,
  analizarEnCliente,
  catalogGroups,
  concreteSelfWeight,
  copyStory,
  defaultSelfWeight,
  ensureCatalogPatterns,
  deleteSelection,
  editNode,
  EcFromFc,
  MAX_STORIES,
  setNodeRestraint,
  setNodeSupport,
  STAIR_TYPES,
  stairClicks,
  proyectoDemo,
  proyectoVacio,
  type AnalysisResult,
  type BuildingProject,
  type DrawTool,
  type LoadKind,
  type NavMode,
  type Selection,
  type SelItem,
  type SeismicReport,
  type StairKind,
  type Support,
  type SupportKind,
  type ViewLayout,
} from "../lib/edificio3d";
import { useUndoableState } from "../lib/undoHistory";
import { UndoButtons } from "../ui/UndoButtons";
import { ICONS, IconBtn } from "../ui/edificio3dIcons";
import { GridModal, LoadModal, SeismicModal } from "../ui/edificio3dModals";
import { EdificioViewport } from "../ui/edificio3dView";
import { Field, Num } from "../ui/Field";

type Tab = "prop" | "mat" | "cargas" | "sis" | "res" | "cim";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function Edificio3dModule() {
  const { state: project, setState: setProject, undo, redo, canUndo, canRedo } = useUndoableState(() => proyectoDemo());
  const [storyId, setStoryId] = useState(project.stories[0]?.id ?? "N1");
  const [tool, setTool] = useState<DrawTool>("select");
  const [view, setView] = useState<ViewLayout>("3d");
  const [stairKind, setStairKind] = useState<StairKind>("recta");
  const [stairWidth, setStairWidth] = useState(1.2);
  const [busy, setBusy] = useState(false);
  const [selItems, setSelItems] = useState<SelItem[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([]);
  const [tab, setTab] = useState<Tab>("prop");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [comboId, setComboId] = useState("U1");
  const [showDef, setShowDef] = useState(false);
  const [showSolid, setShowSolid] = useState(true);
  const [navMode, setNavMode] = useState<NavMode>("select");
  const sel: Selection = selItems.length ? selItems[selItems.length - 1]! : { kind: "none" };
  const [colSec, setColSec] = useState("COL30");
  const [beamSec, setBeamSec] = useState("V2550");
  const [wallSec, setWallSec] = useState("M20");
  const [slabSec, setSlabSec] = useState("L15-MEM");
  const [nDiv, setNDiv] = useState(4);
  const [supportKind, setSupportKind] = useState<SupportKind>("movil");
  const [patternId, setPatternId] = useState("CV");
  const [loadW1, setLoadW1] = useState(0.2);
  const [loadW2, setLoadW2] = useState(0.4);
  const [copyTo, setCopyTo] = useState(project.stories[1]?.id ?? "N2");
  const [modal, setModal] = useState<"none" | "grid" | "load" | "seismic">("none");
  const [sisReport, setSisReport] = useState<SeismicReport | null>(null);

  const story = project.stories.find((s) => s.id === storyId) ?? project.stories[0];
  const combo = result?.combos.find((c) => c.comboId === comboId) ?? result?.combos[0];

  const patch = (fn: (p: BuildingProject) => void) => {
    setProject((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
    setResult(null);
  };

  const onPick = (x: number, y: number, hit: Selection, opts?: { additive?: boolean }) => {
    if (storyId === "BASE" && tool !== "select" && tool !== "support") {
      setSelItems(hit.kind === "node" ? [hit] : []);
      return;
    }
    if (tool === "select") {
      if (hit.kind === "none") {
        if (!opts?.additive) setSelItems([]);
        return;
      }
      setSelItems((prev) => {
        const i = prev.findIndex((s) => s.kind === hit.kind && s.id === hit.id);
        if (i >= 0) return prev.filter((_, j) => j !== i);
        return [...prev, hit];
      });
      setTab("prop");
      return;
    }
    if (tool === "column") {
      patch((p) => addColumnAt(p, storyId, x, y, colSec));
      return;
    }
    if (tool === "ref") {
      patch((p) => addReference(p, storyId, x, y));
      return;
    }
    if (tool === "support") {
      if (hit.kind === "node") patch((p) => addSupportAt(p, hit.id, supportKind));
      else if (hit.kind === "frame") {
        const f = project.frames.find((fr) => fr.id === hit.id);
        const n = f ? project.nodes.find((nd) => nd.id === f.nI) ?? project.nodes.find((nd) => nd.id === f.nJ) : undefined;
        patch((p) => addSupportXY(p, n?.x ?? x, n?.y ?? y, supportKind));
      } else patch((p) => addSupportXY(p, x, y, supportKind));
      return;
    }
    if (tool === "loadPoint" || tool === "loadLine" || tool === "loadTri" || tool === "loadTrap" || tool === "loadArea") {
      const kind = tool === "loadPoint" ? "puntual" : tool === "loadLine" ? "lineal" : tool === "loadTri" ? "triangular" : tool === "loadTrap" ? "trapezoidal" : "area";
      if (tool === "loadArea" && hit.kind === "slab") {
        patch((p) => addLoad(p, "area", "slab", hit.id, patternId, "GZ", { w1: -Math.abs(loadW1) }));
        return;
      }
      if (hit.kind === "frame") {
        patch((p) =>
          addLoad(p, kind === "area" ? "lineal" : kind, "frame", hit.id, patternId, "GZ", {
            w1: -Math.abs(loadW1),
            w2: -Math.abs(loadW2),
            P: -Math.abs(loadW1),
            a: 0,
          })
        );
        return;
      }
      if (hit.kind === "node" && tool === "loadPoint") {
        patch((p) => addLoad(p, "puntual", "node", hit.id, patternId, "GZ", { P: -Math.abs(loadW1) }));
        return;
      }
      return;
    }
    const need = tool === "slab" ? 3 : 2;
    const next = [...draft, { x, y }];
    if (tool === "slab" && next.length >= 3) {
      const first = next[0];
      if (Math.hypot(x - first.x, y - first.y) < 0.25 && next.length > 3) {
        const pts = next.slice(0, -1);
        const sec = project.slabSections.find((s) => s.id === slabSec);
        patch((p) => addSlab(p, storyId, pts, slabSec, sec?.kind === "membrane" ? story.diaphragm : "flexible"));
        setDraft([]);
        return;
      }
    }
    if (next.length >= need && tool !== "slab") {
      const [a, b] = next;
      if (tool === "beam") patch((p) => addBeam(p, storyId, a.x, a.y, b.x, b.y, beamSec));
      if (tool === "wall") patch((p) => addWall(p, storyId, a.x, a.y, b.x, b.y, wallSec, nDiv));
      if (tool === "stair") {
        const need = stairClicks(stairKind);
        if (next.length < need) {
          setDraft(next);
          return;
        }
        const i = project.stories.findIndex((s) => s.id === storyId);
        const from = i <= 0 ? "BASE" : project.stories[i - 1].id;
        patch((p) => addStair(p, from, storyId, next, stairKind, stairWidth));
        setDraft([]);
        return;
      }
      setDraft([]);
      return;
    }
    setDraft(next);
  };

  const onBoxSelect = (hits: SelItem[], additive: boolean) => {
    setTab("prop");
    if (!hits.length) {
      if (!additive) setSelItems([]);
      return;
    }
    setSelItems((prev) => {
      if (!additive) return hits;
      const next = [...prev];
      for (const h of hits) {
        if (!next.some((s) => s.kind === h.kind && s.id === h.id)) next.push(h);
      }
      return next;
    });
  };

  const run = () => {
    setBusy(true);
    void analizarEnCliente(project).then((r) => {
      setResult(r);
      setBusy(false);
      if (r.ok) setTab("res");
    });
  };

  const insertLoad = (kind: LoadKind, w1 = loadW1, w2 = loadW2, pat = patternId, dir: "GX" | "GY" | "GZ" = "GZ") => {
    const s1 = dir === "GZ" ? -Math.abs(w1) : w1;
    const s2 = dir === "GZ" ? -Math.abs(w2) : w2;
    const withPat = (fn: (p: BuildingProject) => void) =>
      patch((p) => {
        ensureCatalogPatterns(p);
        fn(p);
      });
    if (sel.kind === "slab") {
      withPat((p) => addLoad(p, kind === "asimetrico" ? "asimetrico" : "area", "slab", sel.id, pat, dir, { w1: s1, w2: s2 }));
      return;
    }
    if (sel.kind === "frame") {
      withPat((p) => addLoad(p, kind === "area" ? "lineal" : kind, "frame", sel.id, pat, dir, { w1: s1, w2: s2, P: s1, a: 0 }));
      return;
    }
    if (sel.kind === "node") {
      withPat((p) => addLoad(p, "puntual", "node", sel.id, pat, dir, { P: s1 }));
    }
  };

  const selectedFrame = sel.kind === "frame" ? project.frames.find((f) => f.id === sel.id) : undefined;
  const selectedWall = sel.kind === "wall" ? project.walls.find((w) => w.id === sel.id) : undefined;
  const selectedNode = sel.kind === "node" ? project.nodes.find((n) => n.id === sel.id) : undefined;
  const selectedSlab = sel.kind === "slab" ? project.slabs.find((s) => s.id === sel.id) : undefined;
  const nodeSupport: Support | undefined = selectedNode ? project.supports.find((s) => s.nodeId === selectedNode.id) : undefined;
  const memberRes = combo && selectedFrame ? combo.members.find((m) => m.id === selectedFrame.id) : undefined;
  const pierRes = combo && selectedWall ? combo.piers.filter((x) => x.pierId === selectedWall.pierId) : [];

  const drawTools: { id: DrawTool; label: string; icon: typeof ICONS.select }[] = [
    { id: "select", label: "Seleccionar", icon: ICONS.select },
    { id: "column", label: "Columna", icon: ICONS.column },
    { id: "beam", label: "Viga", icon: ICONS.beam },
    { id: "wall", label: "Muro pier", icon: ICONS.wall },
    { id: "slab", label: "Losa", icon: ICONS.slab },
    { id: "stair", label: "Escalera", icon: ICONS.stair },
    { id: "support", label: "Apoyo", icon: ICONS.support },
    { id: "ref", label: "Punto ref.", icon: ICONS.ref },
  ];
  const tabs: { id: Tab; label: string }[] = [
    { id: "prop", label: "PROP" },
    { id: "mat", label: "MAT" },
    { id: "cargas", label: "CARGAS" },
    { id: "sis", label: "SIS" },
    { id: "res", label: "RES" },
    { id: "cim", label: "CIM" },
  ];

  const swReport = useMemo(() => concreteSelfWeight(project), [project]);
  const stats = useMemo(
    () => ({
      n: project.nodes.length,
      c: project.frames.filter((f) => f.kind === "column").length,
      b: project.frames.filter((f) => f.kind === "beam" && !f.sectionId.startsWith("__RIGID__")).length,
      w: project.walls.length,
      l: project.slabs.length,
    }),
    [project]
  );

  return (
    <div className="ed3">
      <header className="ed3-head">
        <div>
          <p className="kicker">Análisis estructural · viviendas</p>
          <h1>Modelador 3D de edificaciones</h1>
          <p className="ed3-sub">
            Método de rigideces 3D · hasta {MAX_STORIES} pisos · E = 15 000 √f'c · pórticos, piers, losas y cimentación
          </p>
        </div>
        <div className="ed3-head-actions">
          <UndoButtons undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
          <button type="button" className="btn" onClick={() => setModal("grid")}>Nuevo</button>
          <button type="button" className="btn" onClick={() => { setProject(proyectoDemo()); setResult(null); setStoryId("N1"); }}>
            Ejemplo
          </button>
          <button type="button" className="btn" onClick={() => setModal("seismic")}>Sismo</button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? "Calculando en su PC…" : "Calcular"}
          </button>
        </div>
      </header>

      <div className="ed3-toolbar">
        <span className="ed3-toolbar-label">Vista</span>
        <IconBtn icon={ICONS.planta} label="Planta" on={view === "planta"} onClick={() => setView("planta")} />
        <IconBtn icon={ICONS.view3d} label="3D" on={view === "3d"} onClick={() => setView("3d")} />
        <IconBtn icon={ICONS.ambas} label="2D+3D" on={view === "ambas"} onClick={() => setView("ambas")} />
        <IconBtn icon={ICONS.deformada} label="Deformada" on={showDef} disabled={!combo} onClick={() => setShowDef((v) => !v)} />
        <IconBtn icon={ICONS.volumen} label="Volumen" iconOnly on={showSolid} onClick={() => setShowSolid((v) => !v)} />
        <span className="ed3-sep" />
        <span className="ed3-toolbar-label">Navegar</span>
        <IconBtn
          icon={ICONS.select}
          label="Seleccionar"
          on={navMode === "select"}
          onClick={() => { setNavMode("select"); setTool("select"); setDraft([]); }}
        />
        <IconBtn
          icon={ICONS.orbit}
          label="Órbita"
          on={navMode === "orbit"}
          onClick={() => { setNavMode("orbit"); setTool("select"); setDraft([]); }}
        />
        <IconBtn
          icon={ICONS.pan}
          label="Pan"
          on={navMode === "pan"}
          onClick={() => { setNavMode("pan"); setTool("select"); setDraft([]); }}
        />
      </div>

      <div className="ed3-body">
        <aside className="ed3-rail" aria-label="Herramientas de modelado">
          {drawTools.map((t) => (
            <IconBtn
              key={t.id}
              icon={t.icon}
              label={t.label}
              on={tool === t.id && (t.id !== "select" || navMode === "select")}
              onClick={() => { setTool(t.id); setDraft([]); if (t.id === "select") setNavMode("select"); }}
            />
          ))}
          <span className="ed3-rail-sep" />
          <IconBtn icon={ICONS.cargas} label="Cargas" on={modal === "load"} onClick={() => { setModal("load"); setTab("cargas"); }} />
        </aside>

        <div className="ed3-stage">
          <div className="ed3-storybar">
            <button type="button" className={storyId === "BASE" ? "on" : ""} onClick={() => setStoryId("BASE")}>BASE</button>
            {project.stories.map((s) => (
              <button key={s.id} type="button" className={storyId === s.id ? "on" : ""} onClick={() => setStoryId(s.id)}>
                {s.name}
              </button>
            ))}
            {story ? (
              <>
                <label>
                  h
                  <input
                    type="number"
                    step="0.05"
                    value={story.height}
                    onChange={(e) =>
                      patch((p) => {
                        const st = p.stories.find((x) => x.id === story.id);
                        if (st) st.height = Math.max(2.2, parseFloat(e.target.value) || 2.2);
                        let z = 0;
                        for (const x of p.stories) {
                          z += x.height;
                          x.elevation = z;
                        }
                      })
                    }
                  />
                </label>
                <select
                  value={story.diaphragm}
                  onChange={(e) =>
                    patch((p) => {
                      const st = p.stories.find((x) => x.id === story.id);
                      if (st) st.diaphragm = e.target.value as "rigido" | "flexible";
                    })
                  }
                >
                  <option value="rigido">Rígido</option>
                  <option value="flexible">Flexible</option>
                </select>
                <select value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>
                  {project.stories.filter((s) => s.id !== storyId).map((s) => (
                    <option key={s.id} value={s.id}>Copiar → {s.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => { patch((p) => copyStory(p, storyId, copyTo)); }}>Pegar</button>
              </>
            ) : null}
            <span className="ed3-storybar-stats">{stats.c} col · {stats.b} vig · {stats.w} muros · {stats.l} losas</span>
          </div>
          <div className="ed3-view">
          <EdificioViewport
            project={project}
            storyId={storyId}
            tool={tool}
            view={view}
            sels={selItems}
            draft={draft}
            result={result}
            comboId={comboId}
            showDef={showDef}
            showSolid={showSolid}
            navMode={navMode}
            onPick={onPick}
            onBoxSelect={onBoxSelect}
          />
          </div>
        </div>

        <aside className="ed3-prop">
          <div className="ed3-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? "on" : ""}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === "cargas") setModal("load");
                  if (t.id === "sis") setModal("seismic");
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "prop" && (
            <div className="ed3-panel">
              <h2>Elemento</h2>
              {selItems.length > 1 ? (
                <p className="ed3-mini">
                  {selItems.length} elementos · {selItems.filter((s) => s.kind === "frame").length} barras · {selItems.filter((s) => s.kind === "wall").length} muros · {selItems.filter((s) => s.kind === "slab").length} losas · {selItems.filter((s) => s.kind === "node").length} nudos. Arrastre un recuadro para sumar. Esc limpia.
                </p>
              ) : null}
              {sel.kind === "none" ? (
                <>
                  <p className="ed3-mini">Nada seleccionado. En «Seleccionar», arrastre un recuadro (varios) o haga clic (uno a uno). Órbita y Pan solo navegan.</p>
                  <h2>Dibujo</h2>
                  <Field label="Sección columna">
                    <select value={colSec} onChange={(e) => setColSec(e.target.value)}>
                      {project.frameSections.filter((s) => s.name.startsWith("Columna")).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sección viga">
                    <select value={beamSec} onChange={(e) => setBeamSec(e.target.value)}>
                      {project.frameSections.filter((s) => s.name.startsWith("Viga")).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Muro / pier">
                    <select value={wallSec} onChange={(e) => setWallSec(e.target.value)}>
                      {project.wallSections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Subdivisiones">
                    <Num value={nDiv} onChange={setNDiv} step="1" />
                  </Field>
                  <Field label="Losa">
                    <select value={slabSec} onChange={(e) => setSlabSec(e.target.value)}>
                      {project.slabSections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Escalera">
                    <select value={stairKind} onChange={(e) => { setStairKind(e.target.value as StairKind); setTool("stair"); setDraft([]); }}>
                      {STAIR_TYPES.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ancho escalera" unit="m">
                    <Num value={stairWidth} onChange={setStairWidth} step="0.05" />
                  </Field>
                  <Field label="Apoyo">
                    <select value={supportKind} onChange={(e) => setSupportKind(e.target.value as SupportKind)}>
                      <option value="movil">Móvil (UX UY UZ)</option>
                      <option value="empotrado">Empotrado</option>
                      <option value="nudo">Nudo libre</option>
                      <option value="rodilloX">Rodillo X</option>
                      <option value="rodilloY">Rodillo Y</option>
                    </select>
                  </Field>
                </>
              ) : null}
              {selectedNode ? (
                <>
                  <p><b>Nudo {selectedNode.id}</b></p>
                  <Field label="X" unit="m">
                    <Num value={selectedNode.x} onChange={(n) => patch((p) => editNode(p, selectedNode.id, { x: n }))} step="0.01" />
                  </Field>
                  <Field label="Y" unit="m">
                    <Num value={selectedNode.y} onChange={(n) => patch((p) => editNode(p, selectedNode.id, { y: n }))} step="0.01" />
                  </Field>
                  <Field label="Z" unit="m">
                    <Num value={selectedNode.z} onChange={(n) => patch((p) => editNode(p, selectedNode.id, { z: n }))} step="0.01" />
                  </Field>
                  <Field label="Apoyo / empotramiento">
                    <select
                      value={nodeSupport?.kind ?? "nudo"}
                      onChange={(e) => patch((p) => setNodeSupport(p, selectedNode.id, e.target.value as SupportKind))}
                    >
                      <option value="nudo">Nudo libre</option>
                      <option value="movil">Móvil (UX UY UZ)</option>
                      <option value="empotrado">Empotrado</option>
                      <option value="rodilloX">Rodillo X</option>
                      <option value="rodilloY">Rodillo Y</option>
                      <option value="rodilloZ">Rodillo Z</option>
                    </select>
                  </Field>
                  <p className="ed3-mini">Restricciones por GDL</p>
                  {(["ux", "uy", "uz", "rx", "ry", "rz"] as const).map((d) => (
                    <label key={d} className="ed3-check">
                      <input
                        type="checkbox"
                        checked={!!nodeSupport?.[d]}
                        onChange={(e) => patch((p) => setNodeRestraint(p, selectedNode.id, d, e.target.checked))}
                      />
                      {d.toUpperCase()}
                    </label>
                  ))}
                  <button type="button" className="btn" onClick={() => setModal("load")}>Carga en el nudo…</button>
                </>
              ) : null}
              {selectedFrame ? (
                <>
                  <p>
                    <b>{selectedFrame.id}</b> · {selectedFrame.kind}
                    {selItems.filter((s) => s.kind === "frame").length > 1
                      ? ` · ${selItems.filter((s) => s.kind === "frame").length} barras (la sección se aplica a todas las del mismo tipo)`
                      : ""}
                  </p>
                  <Field label="Sección">
                    <select
                      value={selectedFrame.sectionId}
                      onChange={(e) =>
                        patch((p) => {
                          const ids = new Set(selItems.filter((s) => s.kind === "frame").map((s) => s.id));
                          for (const f of p.frames) if (ids.has(f.id) && f.kind === selectedFrame.kind) f.sectionId = e.target.value;
                        })
                      }
                    >
                      {project.frameSections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ángulo local" unit="°">
                    <Num
                      value={(selectedFrame.angle * 180) / Math.PI}
                      onChange={(n) =>
                        patch((p) => {
                          const ids = new Set(selItems.filter((s) => s.kind === "frame").map((s) => s.id));
                          for (const f of p.frames) if (ids.has(f.id) && f.kind === selectedFrame.kind) f.angle = (n * Math.PI) / 180;
                        })
                      }
                    />
                  </Field>
                  <Field label="End offset i" unit="m">
                    <Num value={selectedFrame.offset.i} onChange={(n) => patch((p) => { const f = p.frames.find((x) => x.id === selectedFrame.id); if (f) f.offset.i = Math.max(0, n); })} step="0.01" />
                  </Field>
                  <Field label="End offset j" unit="m">
                    <Num value={selectedFrame.offset.j} onChange={(n) => patch((p) => { const f = p.frames.find((x) => x.id === selectedFrame.id); if (f) f.offset.j = Math.max(0, n); })} step="0.01" />
                  </Field>
                  <label className="ed3-check">
                    <input
                      type="checkbox"
                      checked={!!selectedFrame.release.i.M3}
                      onChange={(e) => patch((p) => { const f = p.frames.find((x) => x.id === selectedFrame.id); if (f) f.release.i.M3 = e.target.checked; })}
                    />
                    Release M3 en i
                  </label>
                  <label className="ed3-check">
                    <input
                      type="checkbox"
                      checked={!!selectedFrame.release.j.M3}
                      onChange={(e) => patch((p) => { const f = p.frames.find((x) => x.id === selectedFrame.id); if (f) f.release.j.M3 = e.target.checked; })}
                    />
                    Release M3 en j
                  </label>
                  <label className="ed3-check">
                    <input
                      type="checkbox"
                      checked={!!selectedFrame.release.i.M2}
                      onChange={(e) => patch((p) => { const f = p.frames.find((x) => x.id === selectedFrame.id); if (f) f.release.i.M2 = e.target.checked; })}
                    />
                    Release M2 en i
                  </label>
                  <label className="ed3-check">
                    <input
                      type="checkbox"
                      checked={!!selectedFrame.release.j.M2}
                      onChange={(e) => patch((p) => { const f = p.frames.find((x) => x.id === selectedFrame.id); if (f) f.release.j.M2 = e.target.checked; })}
                    />
                    Release M2 en j
                  </label>
                  <button type="button" className="btn" onClick={() => setModal("load")}>Carga en el elemento…</button>
                </>
              ) : null}
              {selectedSlab ? (
                <>
                  <p>
                    <b>Losa {selectedSlab.id}</b>
                  </p>
                  <Field label="Sección">
                    <select
                      value={selectedSlab.sectionId}
                      onChange={(e) =>
                        patch((p) => {
                          const ids = new Set(selItems.filter((s) => s.kind === "slab").map((s) => s.id));
                          for (const s of p.slabs) if (ids.has(s.id)) s.sectionId = e.target.value;
                        })
                      }
                    >
                      {project.slabSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · e={Math.round(s.t * 100)} cm · {s.kind}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Diafragma">
                    <select
                      value={selectedSlab.diaphragm}
                      onChange={(e) =>
                        patch((p) => {
                          const s = p.slabs.find((x) => x.id === selectedSlab.id);
                          if (s) s.diaphragm = e.target.value as "rigido" | "flexible";
                        })
                      }
                    >
                      <option value="rigido">Rígido</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </Field>
                  <p className="ed3-mini">
                    {selectedSlab.nodeIds.length} nudos · e = {Math.round((project.slabSections.find((x) => x.id === selectedSlab.sectionId)?.t ?? 0.15) * 1000)} mm
                  </p>
                  <button type="button" className="btn" onClick={() => setModal("load")}>
                    Carga de área…
                  </button>
                </>
              ) : null}
              {selectedWall ? (
                <>
                  <p><b>{selectedWall.id}</b> · Pier {selectedWall.pierId} · {selectedWall.nDiv} franjas</p>
                  <Field label="Subdivisiones">
                    <Num value={selectedWall.nDiv} onChange={(n) => patch((p) => { const w = p.walls.find((x) => x.id === selectedWall.id); if (w) w.nDiv = Math.max(1, Math.min(12, Math.round(n))); })} step="1" />
                  </Field>
                  <p className="ed3-mini">Cambiar nDiv exige redibujar el muro para regenerar franjas y apoyos.</p>
                </>
              ) : null}
              {selItems.length ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    patch((p) => {
                      for (const s of selItems) deleteSelection(p, s.kind, s.id);
                    });
                    setSelItems([]);
                  }}
                >
                  Eliminar{selItems.length > 1 ? ` (${selItems.length})` : ""}
                </button>
              ) : null}
            </div>
          )}

          {tab === "mat" && (
            <div className="ed3-panel">
              <h2>Concretos por defecto</h2>
              <p className="ed3-mini">E = 15 000 √f'c (kg/cm²) · ν = 0.20 · γ = 2.4 t/m³ · fy = 4 200 kg/cm²</p>
              <table className="ed3-table">
                <thead>
                  <tr><th>f'c</th><th>E</th><th>G</th></tr>
                </thead>
                <tbody>
                  {project.materials.map((m) => (
                    <tr key={m.id}>
                      <td>{m.fc}</td>
                      <td>{fmt(m.E, 0)}</td>
                      <td>{fmt(m.E / (2 * (1 + m.nu)), 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="ed3-mini">Comprobar C210: E = 15000√210 = {fmt(EcFromFc(210), 0)} kg/cm²</p>
              <h2>Secciones</h2>
              {project.frameSections.map((s) => (
                <p key={s.id} className="ed3-mini">{s.name} · {s.materialId} · {fmt(s.b * 100, 0)}×{fmt(s.h * 100, 0)} cm</p>
              ))}
            </div>
          )}

          {tab === "cargas" && (
            <div className="ed3-panel">
              <h2>Peso propio del concreto</h2>
              <p className="ed3-mini">W = γ · V. El volumen sale de la geometría: columnas y vigas b·h·L, muros t·L·h, losas t·A. γ = {fmt(project.materials[0]?.gamma ?? 2.4, 2)} t/m³. Entra al patrón CM.</p>
              <label className="ed3-check">
                <input
                  type="checkbox"
                  checked={Boolean((project.selfWeight ?? defaultSelfWeight()).enabled)}
                  onChange={(e) => patch((p) => { p.selfWeight = { ...defaultSelfWeight(), ...p.selfWeight, enabled: e.target.checked }; })}
                />
                Considerar peso propio
              </label>
              <Field label="Multiplicador">
                <Num
                  value={(project.selfWeight ?? defaultSelfWeight()).multiplier}
                  onChange={(n) => patch((p) => { p.selfWeight = { ...defaultSelfWeight(), ...p.selfWeight, multiplier: n }; })}
                  step="0.05"
                />
              </Field>
              {(["columns", "beams", "walls", "slabs", "stairs"] as const).map((k) => {
                const labels = { columns: "Columnas", beams: "Vigas", walls: "Muros / piers", slabs: "Losas", stairs: "Escaleras" };
                const sw = project.selfWeight ?? defaultSelfWeight();
                return (
                  <label key={k} className="ed3-check">
                    <input
                      type="checkbox"
                      checked={sw[k]}
                      disabled={!sw.enabled}
                      onChange={(e) => patch((p) => { p.selfWeight = { ...defaultSelfWeight(), ...p.selfWeight, [k]: e.target.checked }; })}
                    />
                    {labels[k]}
                  </label>
                );
              })}
              <table className="ed3-table">
                <thead><tr><th>Elemento</th><th>n</th><th>V (m³)</th><th>W (t)</th></tr></thead>
                <tbody>
                  {swReport.rows.map((r) => (
                    <tr key={r.id}><td>{r.label}</td><td>{r.n}</td><td>{fmt(r.volume, 3)}</td><td>{fmt(r.weight, 2)}</td></tr>
                  ))}
                  <tr>
                    <td><b>Total</b></td>
                    <td />
                    <td><b>{fmt(swReport.volume, 3)}</b></td>
                    <td><b>{fmt(swReport.weight, 2)}</b></td>
                  </tr>
                </tbody>
              </table>
              <h2>Tipos de carga</h2>
              <p className="ed3-mini">Puntual, lineal, triangular, trapezoidal y de área se configuran en el modal. Los patrones cubren gravedad, vivas, viento, suelo, temperatura y sismo.</p>
              <button type="button" className="btn btn-primary" onClick={() => setModal("load")}>Nueva carga…</button>
              <h2>Patrones</h2>
              {catalogGroups().map((g) => (
                <div key={g.id}>
                  <p className="ed3-mini"><b>{g.label}</b></p>
                  {g.items.map((q) => (
                    <p key={q.id} className="ed3-mini">{q.name}{q.selfWeight ? " · peso propio" : ""}</p>
                  ))}
                </div>
              ))}
              <table className="ed3-table">
                <thead><tr><th>Id</th><th>Tipo</th><th>Destino</th><th>Patrón</th><th></th></tr></thead>
                <tbody>
                  {project.loads.map((l) => (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td>{l.kind}</td>
                      <td>{l.targetId}</td>
                      <td>{l.patternId}</td>
                      <td><button type="button" className="ed3-link" onClick={() => patch((p) => { p.loads = p.loads.filter((x) => x.id !== l.id); })}>Quitar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2>Combinaciones</h2>
              {project.combinations.map((c) => (
                <p key={c.id} className="ed3-mini">{c.id}: {c.name}</p>
              ))}
            </div>
          )}

          {tab === "sis" && (
            <div className="ed3-panel">
              <h2>Sismo</h2>
              <p className="ed3-mini">{project.seismic.code.toUpperCase()} · Z={fmt(project.seismic.Z, 2)} · {project.seismic.suelo} · U={fmt(project.seismic.U, 2)} · R0={fmt(project.seismic.R0, 1)}</p>
              <p className="ed3-mini">Estático X={fmt(project.seismic.staticFx ?? 1, 2)} Y={fmt(project.seismic.staticFy ?? 1, 2)} · Espectro {project.seismic.spectrumId ?? "e030-2025"}</p>
              <button type="button" className="btn btn-primary" onClick={() => setModal("seismic")}>Parámetros sísmicos…</button>
              {sisReport ? (
                <div className="ed3-box">
                  <p>T = {fmt(sisReport.T, 3)} s · C = {fmt(sisReport.C, 3)} · Sa = {fmt(sisReport.Sa, 3)}</p>
                  <p><b>SEX = {fmt(sisReport.Vx, 2)} t</b> · <b>SEY = {fmt(sisReport.Vy, 2)} t</b></p>
                  <p><b>SDX = {fmt(sisReport.VdynX, 2)} t</b> · <b>SDY = {fmt(sisReport.VdynY, 2)} t</b></p>
                  <p className="ed3-mini">{sisReport.spectrumName}</p>
                  <p className="ed3-mini">{sisReport.note}</p>
                </div>
              ) : <p className="ed3-mini">Genere SEX, SEY, SDX y SDY según el modelo, los factores X/Y y el espectro.</p>}
              <Field label="qadm suelo" unit="t/m²">
                <Num value={project.qAdm} onChange={(n) => patch((p) => { p.qAdm = n; })} step="0.5" />
              </Field>
            </div>
          )}

          {tab === "res" && (
            <div className="ed3-panel">
              <h2>Resultantes</h2>
              {!combo ? <p className="ed3-mini">Analice la estructura para ver P, V, M de columnas, vigas y piers.</p> : (
                <>
                  <Field label="Combinación">
                    <select value={combo.comboId} onChange={(e) => setComboId(e.target.value)}>
                      {result?.combos.map((c) => (
                        <option key={c.comboId} value={c.comboId}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                  <p className="ed3-mini">{combo.nDof} GDL · {combo.nNodes} nudos · {fmt(combo.elapsedMs, 0)} ms</p>
                  {memberRes ? (
                    <div className="ed3-box">
                      <h3>Elemento {memberRes.id}</h3>
                      <p>P = {fmt(memberRes.i.P)} / {fmt(memberRes.j.P)} t</p>
                      <p>V2 = {fmt(memberRes.i.V2)} · V3 = {fmt(memberRes.i.V3)} t</p>
                      <p>M2 = {fmt(memberRes.i.M2)} · M3 = {fmt(memberRes.i.M3)} t·m</p>
                      <p>T = {fmt(memberRes.i.T)} t·m</p>
                    </div>
                  ) : null}
                  {pierRes.length ? (
                    <div className="ed3-box">
                      <h3>Pier {selectedWall?.pierId}</h3>
                      {pierRes.map((r) => (
                        <p key={r.storyId}>
                          {r.storyId}: P={fmt(r.P)} V2={fmt(r.V2)} V3={fmt(r.V3)} M2={fmt(r.M2)} M3={fmt(r.M3)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <h3>Columnas</h3>
                  <table className="ed3-table">
                    <thead><tr><th>Id</th><th>P</th><th>V2</th><th>M3</th></tr></thead>
                    <tbody>
                      {combo.members.filter((m) => m.kind === "column").map((m) => (
                        <tr key={m.id}><td>{m.id}</td><td>{fmt(m.Pmax)}</td><td>{fmt(m.V2max)}</td><td>{fmt(m.M3max)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <h3>Vigas</h3>
                  <table className="ed3-table">
                    <thead><tr><th>Id</th><th>V3</th><th>M2</th><th>M3</th></tr></thead>
                    <tbody>
                      {combo.members.filter((m) => m.kind === "beam" && !m.id.startsWith("R")).slice(0, 24).map((m) => (
                        <tr key={m.id}><td>{m.id}</td><td>{fmt(m.V3max)}</td><td>{fmt(m.M2max)}</td><td>{fmt(m.M3max)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <h3>Piers</h3>
                  <table className="ed3-table">
                    <thead><tr><th>Pier</th><th>Nivel</th><th>P</th><th>V</th><th>M</th></tr></thead>
                    <tbody>
                      {combo.piers.map((r) => (
                        <tr key={`${r.pierId}-${r.storyId}`}><td>{r.name}</td><td>{r.storyId}</td><td>{fmt(r.P)}</td><td>{fmt(r.V2)}</td><td>{fmt(r.M3)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {tab === "cim" && (
            <div className="ed3-panel">
              <h2>Cimentación</h2>
              <p className="ed3-mini">
                Primero se analiza el pórtico. Luego las reacciones de cada apoyo (móvil o empotrado) se transmiten al suelo.
                Muros: zapata corrida con un apoyo en cada extremo y en cada subdivisión.
              </p>
              {!combo ? <p>Analice la estructura para dimensionar zapatas.</p> : (
                <table className="ed3-table">
                  <thead><tr><th>Nudo</th><th>Tipo</th><th>P</th><th>B×L</th><th>qmáx</th><th></th></tr></thead>
                  <tbody>
                    {combo.footings.map((f) => (
                      <tr key={`${f.nodeId}-${f.kind}`}>
                        <td>{f.nodeId}</td>
                        <td>{f.kind}</td>
                        <td>{fmt(f.P)}</td>
                        <td>{fmt(f.B, 2)}×{fmt(f.L, 2)}</td>
                        <td>{fmt(f.qmax)}</td>
                        <td className={f.ok ? "ok" : "bad"}>{f.ok ? "OK" : "NO"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </aside>
      </div>

      {modal === "grid" ? (
        <GridModal
          project={project}
          onClose={() => setModal("none")}
          onApply={(fn) => {
            setProject(() => {
              const next = proyectoVacio(2);
              fn(next);
              return next;
            });
            setResult(null);
            setSisReport(null);
            setStoryId("N1");
            setCopyTo("N2");
            setSelItems([]);
          }}
        />
      ) : null}
      {modal === "load" ? (
        <LoadModal
          project={project}
          hasTarget={sel.kind === "frame" || sel.kind === "node" || sel.kind === "slab"}
          onClose={() => setModal("none")}
          onApply={(kind, w1, w2, pat, dir) => {
            setPatternId(pat);
            setLoadW1(w1);
            setLoadW2(w2);
            insertLoad(kind, w1, w2, pat, dir);
          }}
        />
      ) : null}
      {modal === "seismic" ? (
        <SeismicModal
          project={project}
          onClose={() => setModal("none")}
          onApply={(fn) => {
            let report: SeismicReport | undefined;
            setProject((prev) => {
              const next = clone(prev);
              report = fn(next);
              return next;
            });
            setResult(null);
            if (report) {
              setSisReport(report);
              setTab("sis");
            }
          }}
        />
      ) : null}
    </div>
  );
}
