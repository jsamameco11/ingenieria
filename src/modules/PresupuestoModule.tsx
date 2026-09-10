import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { printMemoria } from "../lib/printDoc";
import {
  ESPECIALIDAD_META,
  ESPECIALIDADES,
  KIND_META,
  aliasMo,
  catalogoInsumos,
  esInsumoPropio,
  siguienteCodigo,
  KIND_ORDER,
  PARTIDAS,
  partidaCatalogoDeLinea,
  partidaDeLinea,
  clonarLineaPartida,
  siguienteCodigoPartida,
  PLANTILLAS,
  plantillasAgrupadas,
  especialidadesPlantilla,
  libroDePlantilla,
  plantillaPorId,
  type CategoriaPlantilla,
  aplicarPlantilla,
  borrarNube,
  calcularApu,
  calcularPresupuesto,
  codigoIU,
  CATEGORIAS_CAPECO,
  defaultPresupuesto,
  exportarPresupuestoXlsx,
  guardarArchivo,
  JORNADA_BASE,
  leerNube,
  listarNube,
  loadPresupuesto,
  mensajeGuardado,
  money,
  moneyMon,
  MONEDA_META,
  usaJornadaInsumo,
  cuadrillaDe,
  rendimientoDe,
  nombreArchivoSugerido,
  nubeDisponible,
  partidasAgrupadas,
  partesTituloCapitulo,
  claveSubcapitulo,
  etiquetaSubcapitulo,
  savePresupuesto,
  uid,
  type EspecialidadPre,
  type Partida,
  type PresupuestoArchivo,
  type Insumo,
  type RecetaItem,
  type RecursoKind,
} from "../lib/presupuesto";
import { OrganigramaGg } from "./OrganigramaGg";
import { FormulaPolinomicaPanel } from "./FormulaPolinomicaPanel";
import { ArchivoModal, GuardarComoModal, InsumoObraModal, PrintModal, ProyectoModal, aplicarDraft, type ProyectoDraft } from "./PresupuestoDialogs";
import { PresupuestoPrint, type PrintHojaId } from "./PresupuestoPrint";
import { useAuth } from "../ui/AuthProvider";
import { UndoButtons } from "../ui/UndoButtons";
import { useUndoableState } from "../lib/undoHistory";
import { guardarCloudBudget } from "../lib/billing";
import { useCollapseOnScroll } from "../lib/useCollapseOnScroll";
import { MetradosExcelPanel } from "./MetradosExcelPanel";

type Vista = "obra" | "plantillas" | "metrados" | "insumos" | "formula" | "resumen";
type Sel = { kind: "cat"; codigo: string } | { kind: "line"; id: string } | null;
type EspFiltro = EspecialidadPre | "todas";

const VISTAS_MENU: { id: Vista; label: string }[] = [
  { id: "obra", label: "Presupuesto" },
  { id: "plantillas", label: "Plantillas" },
  { id: "metrados", label: "Metrados (Excel)" },
  { id: "insumos", label: "Insumos" },
  { id: "formula", label: "Fórmula polinómica" },
  { id: "resumen", label: "Pie de presupuesto" },
];

function KindIcon({ kind }: { kind: RecursoKind }) {
  if (kind === "mo") {
    return (
      <svg viewBox="0 0 16 16" className="pre-ico" aria-hidden>
        <circle cx="8" cy="5" r="2.4" fill="currentColor" />
        <path d="M3.2 13.2c.4-2.6 2.2-4 4.8-4s4.4 1.4 4.8 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === "mat") {
    return (
      <svg viewBox="0 0 16 16" className="pre-ico" aria-hidden>
        <path d="M8 2.2 13.4 5v6L8 13.8 2.6 11V5L8 2.2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 2.2v11.6M2.6 5 8 8l5.4-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === "maq") {
    return (
      <svg viewBox="0 0 16 16" className="pre-ico" aria-hidden>
        <rect x="2.2" y="7.2" width="8.2" height="3.4" rx="0.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10.4 8.2h2.6l1.2 2.4H10.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="4.4" cy="12.4" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="11.4" cy="12.4" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="pre-ico" aria-hidden>
      <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 2.4v1.8M8 11.8v1.8M2.4 8h1.8M11.8 8h1.8M4 4l1.3 1.3M10.7 10.7 12 12M12 4l-1.3 1.3M5.3 10.7 4 12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function PresupuestoModule({
  vistaInicial = "obra",
  hojaDedicada = true,
}: { vistaInicial?: Vista; hojaDedicada?: boolean } = {}) {
  const { user, isPro } = useAuth();
  const { state, setState, undo, redo, canUndo, canRedo } = useUndoableState(() => loadPresupuesto());
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [esp, setEsp] = useState<EspFiltro>("todas");
  const [q, setQ] = useState("");
  const [qIns, setQIns] = useState("");
  const [openCaps, setOpenCaps] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Sel>(null);
  const [mobilePane, setMobilePane] = useState<"cat" | "pre" | "apu">("pre");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [apuBusca, setApuBusca] = useState<Partial<Record<RecursoKind, string>>>({});
  const [kindFiltro, setKindFiltro] = useState<RecursoKind | "todos">("todos");
  const [catFiltro, setCatFiltro] = useState<string>("todas");
  const { collapsed: insumosChromeCollapsed, onScroll: onInsumosScroll } = useCollapseOnScroll();
  const [orgSel, setOrgSel] = useState<string | null>("p-res");
  const [archOpen, setArchOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveComo, setSaveComo] = useState(false);
  const [saveNombre, setSaveNombre] = useState("");
  const [printHojas, setPrintHojas] = useState<PrintHojaId[]>(["formacion", "detallado", "resumen"]);
  const [nube, setNube] = useState<PresupuestoArchivo[]>([]);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [proyOpen, setProyOpen] = useState(false);
  const [proyModo, setProyModo] = useState<"nuevo" | "plantilla" | "editar">("editar");
  const [proyPlantilla, setProyPlantilla] = useState<string | null>(null);
  const [proyInicial, setProyInicial] = useState(() => defaultPresupuesto());
  const [libCat, setLibCat] = useState<CategoriaPlantilla | null>(null);
  const [libDetalle, setLibDetalle] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const saltandoEsp = useRef(false);
  const [espBarOculta, setEspBarOculta] = useState(false);
  const [insumoModal, setInsumoModal] = useState<{
    kind: RecursoKind;
    kindLocked: boolean;
    nombre: string;
    incorporarApu: boolean;
    editId?: string;
  } | null>(null);
  const gruposLib = useMemo(() => plantillasAgrupadas(), []);
  const grupoLib = gruposLib.find((g) => g.categoria === libCat) ?? null;
  const plDetalle = libDetalle ? plantillaPorId(libDetalle) : undefined;
  const libroDetalle = useMemo(() => (plDetalle ? libroDePlantilla(plDetalle) : null), [plDetalle]);
  const plObra = state.plantillaId ? plantillaPorId(state.plantillaId) : undefined;
  const libroObra = useMemo(() => (plObra ? libroDePlantilla(plObra) : null), [plObra]);

  useEffect(() => {
    savePresupuesto(state);
  }, [state]);

  const avisar = (t: string) => {
    setMsg(t);
    window.setTimeout(() => setMsg((m) => (m === t ? "" : m)), 5000);
  };

  const irAEspecialidad = (esp: EspecialidadPre) => {
    setMobilePane("pre");
    setEspBarOculta(false);
    saltandoEsp.current = true;
    window.setTimeout(() => {
      const wrap = tableWrapRef.current;
      const row = document.getElementById(`pre-esp-${esp}`);
      if (!wrap || !row) {
        saltandoEsp.current = false;
        return;
      }
      const wrapRect = wrap.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const next = wrap.scrollTop + (rowRect.top - wrapRect.top);
      wrap.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
      window.setTimeout(() => {
        saltandoEsp.current = false;
        lastScrollY.current = wrap.scrollTop;
      }, 520);
    }, 40);
  };

  const refrescarArchivos = async () => {
    try {
      setNube(await listarNube());
    } catch {
      setNube([]);
    }
  };

  useEffect(() => {
    void refrescarArchivos();
  }, []);

  useEffect(() => {
    if (archOpen) void refrescarArchivos();
  }, [archOpen]);

  useEffect(() => {
    if (vista !== "obra") {
      setEspBarOculta(false);
      lastScrollY.current = 0;
    }
  }, [vista]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el || vista !== "obra") return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (saltandoEsp.current) {
        lastScrollY.current = y;
        return;
      }
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 16) {
        setEspBarOculta(false);
        return;
      }
      if (dy > 6) setEspBarOculta(true);
      else if (dy < -6) setEspBarOculta(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [vista, mobilePane]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const aplicarDoc = (stateNext: typeof state) => {
    setState(stateNext);
    setSel(null);
    setOrgSel("p-res");
  };

  const ejecutarGuardar = async (nombre: string, como: boolean) => {
    setOcupado(true);
    try {
      const r = await guardarArchivo(state, { nombre, como });
      setState(r.doc.state);
      if (isPro && user) {
        try {
          await guardarCloudBudget(user.id, r.doc.state, r.doc.nombre);
          avisar("Guardado en la nube Plan Pro.");
        } catch {
          avisar(mensajeGuardado(r) + " Nube Pro no disponible todavía.");
        }
      } else {
        avisar(mensajeGuardado(r) + (user ? " Active Plan Pro para sincronizar la biblioteca." : ""));
      }
      setSaveOpen(false);
      await refrescarArchivos();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  const pedirGuardar = (como: boolean) => {
    setSaveComo(como);
    setSaveNombre(nombreArchivoSugerido(state));
    if (!como && state.archivoId && state.archivoNombre) {
      void ejecutarGuardar(state.archivoNombre, false);
      return;
    }
    setSaveOpen(true);
  };

  const abrirArchivo = async (a: PresupuestoArchivo) => {
    setOcupado(true);
    try {
      const doc = await leerNube(a.id);
      if (!doc) {
        avisar("No se encontró el archivo.");
        return;
      }
      aplicarDoc(doc.state);
      setArchOpen(false);
      avisar(`Abierto: ${doc.nombre}`);
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo abrir.");
    } finally {
      setOcupado(false);
    }
  };

  const borrarArchivo = async (id: string) => {
    if (!window.confirm("¿Eliminar este presupuesto de Supabase?")) return;
    setOcupado(true);
    try {
      await borrarNube(id);
      await refrescarArchivos();
      avisar("Eliminado de Supabase.");
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setOcupado(false);
    }
  };

  const imprimirHojas = () => {
    setPrintOpen(false);
    window.setTimeout(() => printMemoria(state.obra || "Presupuesto"), 50);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && catalogOpen) {
        setCatalogOpen(false);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        pedirGuardar(e.shiftKey);
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPrintOpen(true);
      }
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        setArchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const patch = (p: Partial<typeof state>) => setState((s) => ({ ...s, ...p }));
  const calc = useMemo(() => calcularPresupuesto(state), [state]);

  const grupos = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return partidasAgrupadas(esp)
      .map((g) => ({
        ...g,
        items: needle
          ? g.items.filter(
              (p) =>
                p.codigo.toLowerCase().includes(needle) ||
                p.descripcion.toLowerCase().includes(needle) ||
                p.capitulo.toLowerCase().includes(needle)
            )
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [esp, q]);

  const catalogo = useMemo(() => catalogoInsumos(state.insumosPropios), [state.insumosPropios]);

  const insumosFiltrados = useMemo(() => {
    const needle = qIns.trim().toLowerCase();
    return catalogo.filter((i) => {
      if (kindFiltro !== "todos" && i.kind !== kindFiltro) return false;
      if (catFiltro !== "todas" && i.categoria !== catFiltro) return false;
      if (!needle) return true;
      const iu = codigoIU(i.iu);
      return (
        i.codigo.toLowerCase().includes(needle) ||
        i.nombre.toLowerCase().includes(needle) ||
        i.categoria.toLowerCase().includes(needle) ||
        iu.includes(needle) ||
        KIND_META[i.kind].label.toLowerCase().includes(needle)
      );
    });
  }, [catalogo, qIns, kindFiltro, catFiltro]);

  const insumosPorKind = useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      items: insumosFiltrados.filter((i) => i.kind === kind),
    })).filter((g) => g.items.length > 0);
  }, [insumosFiltrados]);

  const partidaSel: Partida | null = useMemo(() => {
    if (!sel || sel.kind !== "line") return null;
    const linea = state.lineas.find((l) => l.id === sel.id);
    return linea ? partidaDeLinea(linea) : null;
  }, [sel, state.lineas]);

  const lineaSel = sel?.kind === "line" ? state.lineas.find((l) => l.id === sel.id) ?? null : null;

  const apu = useMemo(
    () =>
      partidaSel
        ? calcularApu(partidaSel, state.precios, lineaSel?.receta, state.insumosPropios, state.jornada)
        : null,
    [partidaSel, state.precios, lineaSel?.receta, state.insumosPropios, state.jornada]
  );

  const recetaEditada = Boolean(lineaSel?.receta);
  const rendPartida = apu?.recursos.find((r) => r.usaJornada)?.rendimiento;
  const catPartida = catSel ? PARTIDAS.find((p) => p.codigo === catSel) ?? null : null;
  const catPu = catPartida
    ? calcularApu(catPartida, state.precios, undefined, state.insumosPropios, state.jornada).pu
    : 0;

  const addPartida = (codigo: string) => {
    const id = uid();
    const nueva = { id, codigo, metrado: 1 };
    const idx = sel?.kind === "line" ? state.lineas.findIndex((l) => l.id === sel.id) : -1;
    const lineas = [...state.lineas];
    if (idx >= 0) lineas.splice(idx + 1, 0, nueva);
    else lineas.push(nueva);
    patch({ lineas });
    setSel({ kind: "line", id });
    setMobilePane("pre");
  };

  const recetaDe = (lineaId: string): RecetaItem[] | null => {
    const linea = state.lineas.find((l) => l.id === lineaId);
    if (!linea) return null;
    const partida = partidaCatalogoDeLinea(linea);
    if (!partida) return null;
    return (linea.receta ?? partida.receta).map((r) => ({ ...r }));
  };

  const setRecetaLinea = (lineaId: string, receta: RecetaItem[]) => {
    patch({
      lineas: state.lineas.map((l) => (l.id === lineaId ? { ...l, receta } : l)),
    });
  };

  const setCantidadApu = (insumoId: string, cantidad: number) => {
    if (!lineaSel) return;
    const receta = recetaDe(lineaSel.id);
    if (!receta) return;
    const n = Number.isFinite(cantidad) ? Math.max(0, cantidad) : 0;
    const oficial = aliasMo(insumoId);
    const idx = receta.findIndex((r) => aliasMo(r.insumoId) === oficial);
    const prev = idx >= 0 ? receta[idx] : { insumoId: oficial, cantidad: n };
    const ins = catalogo.find((i) => i.id === oficial) ?? catalogo.find((i) => i.id === insumoId);
    const next: RecetaItem =
      ins && usaJornadaInsumo(ins)
        ? {
            ...prev,
            insumoId: oficial,
            cantidad: n,
            cuadrilla: cuadrillaDe(prev),
            rendimiento: n > 0 ? (cuadrillaDe(prev) * (state.jornada || JORNADA_BASE)) / n : 0,
          }
        : { ...prev, insumoId: oficial, cantidad: n };
    const limpia = receta.filter((r, i) => i === idx || aliasMo(r.insumoId) !== oficial);
    const at = limpia.findIndex((r) => aliasMo(r.insumoId) === oficial);
    if (at >= 0) limpia[at] = next;
    else limpia.push(next);
    setRecetaLinea(lineaSel.id, limpia);
  };

  const setCuadrillaApu = (insumoId: string, cuadrilla: number) => {
    if (!lineaSel) return;
    const receta = recetaDe(lineaSel.id);
    if (!receta) return;
    const idx = receta.findIndex((r) => aliasMo(r.insumoId) === aliasMo(insumoId));
    if (idx < 0) return;
    const prev = receta[idx];
    const cuad = Number.isFinite(cuadrilla) && cuadrilla > 0 ? cuadrilla : 1;
    const rend = rendimientoDe(prev);
    receta[idx] = {
      ...prev,
      cuadrilla: cuad,
      rendimiento: rend,
      cantidad: rend > 0 ? (cuad * (state.jornada || JORNADA_BASE)) / rend : prev.cantidad,
    };
    setRecetaLinea(lineaSel.id, receta);
  };

  const setRendimientoApu = (insumoId: string, rendimiento: number) => {
    if (!lineaSel) return;
    const receta = recetaDe(lineaSel.id);
    if (!receta) return;
    const idx = receta.findIndex((r) => aliasMo(r.insumoId) === aliasMo(insumoId));
    if (idx < 0) return;
    const prev = receta[idx];
    const rend = Number.isFinite(rendimiento) && rendimiento > 0 ? rendimiento : 0;
    const cuad = cuadrillaDe(prev);
    receta[idx] = {
      ...prev,
      cuadrilla: cuad,
      rendimiento: rend,
      cantidad: rend > 0 ? (cuad * (state.jornada || JORNADA_BASE)) / rend : prev.cantidad,
    };
    setRecetaLinea(lineaSel.id, receta);
  };

  const setRendimientoPartida = (rendimiento: number) => {
    if (!lineaSel) return;
    const receta = recetaDe(lineaSel.id);
    if (!receta) return;
    const rend = Number.isFinite(rendimiento) && rendimiento > 0 ? rendimiento : 0;
    const jornada = state.jornada || JORNADA_BASE;
    setRecetaLinea(
      lineaSel.id,
      receta.map((prev) => {
        const ins = catalogo.find((i) => i.id === prev.insumoId);
        if (!ins || !usaJornadaInsumo(ins)) return prev;
        const cuad = cuadrillaDe(prev);
        return {
          ...prev,
          cuadrilla: cuad,
          rendimiento: rend,
          cantidad: rend > 0 ? (cuad * jornada) / rend : prev.cantidad,
        };
      })
    );
  };

  const quitarRecursoApu = (insumoId: string) => {
    if (!lineaSel) return;
    const receta = recetaDe(lineaSel.id);
    if (!receta) return;
    setRecetaLinea(
      lineaSel.id,
      receta.filter((r) => aliasMo(r.insumoId) !== aliasMo(insumoId))
    );
  };

  const agregarRecursoApu = (insumoId: string) => {
    if (!lineaSel) return;
    const receta = recetaDe(lineaSel.id);
    if (!receta) return;
    if (receta.some((r) => aliasMo(r.insumoId) === aliasMo(insumoId))) return;
    const ins = catalogo.find((i) => i.id === insumoId);
    const jornada = state.jornada || JORNADA_BASE;
    if (insumoId === "EQ-HIN") receta.push({ insumoId, cantidad: 5 });
    else if (ins && usaJornadaInsumo(ins)) receta.push({ insumoId, cantidad: 1, cuadrilla: 1, rendimiento: jornada });
    else receta.push({ insumoId, cantidad: 1 });
    setRecetaLinea(lineaSel.id, receta);
  };

  const restablecerReceta = () => {
    if (!lineaSel) return;
    patch({
      lineas: state.lineas.map((l) =>
        l.id === lineaSel.id
          ? {
              id: l.id,
              codigo: l.codigo,
              metrado: l.metrado,
              origenCodigo: l.origenCodigo,
              descripcion: l.descripcion,
              und: l.und,
            }
          : l
      ),
    });
  };

  const setDescripcionLinea = (id: string, descripcion: string) => {
    patch({
      lineas: state.lineas.map((l) => {
        if (l.id !== id) return l;
        const catalog = partidaCatalogoDeLinea(l);
        const catalogDesc = catalog?.descripcion ?? "";
        const yaEsDeObra = Boolean(l.origenCodigo) || Boolean((l.descripcion ?? "").trim());
        if (!yaEsDeObra && catalog && descripcion.trim() !== catalogDesc) {
          const origen = catalog.codigo;
          return {
            ...l,
            codigo: siguienteCodigoPartida(origen, state.lineas),
            origenCodigo: origen,
            receta: (l.receta ?? catalog.receta).map((r) => ({ ...r })),
            descripcion,
          };
        }
        return { ...l, descripcion };
      }),
    });
  };

  const duplicarLinea = (id: string) => {
    const linea = state.lineas.find((l) => l.id === id);
    if (!linea) return;
    const clone = clonarLineaPartida(linea, state.lineas);
    const idx = state.lineas.findIndex((l) => l.id === id);
    const lineas = [...state.lineas];
    lineas.splice(idx < 0 ? lineas.length : idx + 1, 0, clone);
    patch({ lineas });
    setSel({ kind: "line", id: clone.id });
    setMobilePane("apu");
  };

  const setMetrado = (id: string, metrado: number) => {
    patch({
      lineas: state.lineas.map((l) => (l.id === id ? { ...l, metrado: Number.isFinite(metrado) ? Math.max(0, metrado) : 0 } : l)),
    });
  };

  const removeLinea = (id: string) => {
    patch({ lineas: state.lineas.filter((l) => l.id !== id) });
    if (sel?.kind === "line" && sel.id === id) setSel(null);
  };

  const setPrecio = (insumoId: string, precio: number) => {
    patch({
      precios: { ...state.precios, [insumoId]: Number.isFinite(precio) ? Math.max(0, precio) : 0 },
    });
  };

  const abrirNuevoInsumo = (kind: RecursoKind, nombre = "", incorporarApu = false, kindLocked = true) => {
    setInsumoModal({ kind, kindLocked, nombre, incorporarApu });
  };

  const guardarInsumoObra = (insumo: Insumo) => {
    const incorporar = Boolean(insumoModal?.incorporarApu);
    const editId = insumoModal?.editId;
    setState((s) => {
      const propios = s.insumosPropios ?? [];
      const insumosPropios = editId
        ? propios.map((x) => (x.id === editId ? insumo : x))
        : propios.some((x) => x.id === insumo.id)
          ? propios.map((x) => (x.id === insumo.id ? insumo : x))
          : [...propios, insumo];
      const precios = { ...s.precios, [insumo.id]: insumo.precio };
      let lineas = s.lineas;
      if (incorporar && lineaSel) {
        const linea = s.lineas.find((l) => l.id === lineaSel.id);
        const partida = linea ? partidaCatalogoDeLinea(linea) : undefined;
        if (linea && partida) {
          const receta = (linea.receta ?? partida.receta).map((r) => ({ ...r }));
          if (!receta.some((r) => r.insumoId === insumo.id)) {
            receta.push({ insumoId: insumo.id, cantidad: 1 });
            lineas = s.lineas.map((l) => (l.id === lineaSel.id ? { ...l, receta } : l));
          }
        }
      }
      return { ...s, insumosPropios, precios, lineas };
    });
    setApuBusca((s) => ({ ...s, [insumo.kind]: "" }));
    setInsumoModal(null);
  };

  const borrarInsumoPropio = (id: string) => {
    if (!window.confirm("¿Quitar este insumo de la obra? Se retirará de los APU que lo usen. El catálogo no cambia.")) return;
    setState((s) => {
      const precios = { ...s.precios };
      delete precios[id];
      return {
        ...s,
        insumosPropios: (s.insumosPropios ?? []).filter((i) => i.id !== id),
        precios,
        lineas: s.lineas.map((l) => (l.receta ? { ...l, receta: l.receta.filter((r) => r.insumoId !== id) } : l)),
      };
    });
  };

  const nuevo = () => {
    setProyModo("nuevo");
    setProyPlantilla(null);
    setProyInicial(defaultPresupuesto());
    setProyOpen(true);
  };

  const cargarPlantilla = (id: string) => {
    const seed = aplicarPlantilla(id);
    if (!seed) return;
    setProyModo("plantilla");
    setProyPlantilla(id);
    setProyInicial(seed);
    setProyOpen(true);
  };

  const abrirDatosObra = () => {
    setProyModo("editar");
    setProyPlantilla(null);
    setProyInicial(state);
    setProyOpen(true);
  };

  const confirmarProyecto = (d: ProyectoDraft) => {
    if (proyModo === "nuevo") {
      setState(aplicarDraft(defaultPresupuesto(), d));
      setVista("obra");
      setSel(null);
      setOrgSel("p-res");
    } else if (proyModo === "plantilla" && proyPlantilla) {
      const next = aplicarPlantilla(proyPlantilla, d);
      if (next) setState(next);
      setVista("obra");
      setEsp("todas");
      setSel(null);
      setOrgSel("p-res");
    } else {
      patch(d);
    }
    setProyOpen(false);
  };

  const toggleCap = (key: string) => setOpenCaps((s) => ({ ...s, [key]: !s[key] }));
  const capOpen = (key: string) => (q.trim() ? true : Boolean(openCaps[key]));

  const bloques = useMemo(() => {
    let n = 0;
    return calc.especialidades.map((bloque) => ({
      ...bloque,
      capitulos: bloque.capitulos.map((cap) => {
        const numbered = cap.lineas.map((l) => {
          n += 1;
          return { ...l, n };
        });
        const groups = new Map<string, typeof numbered>();
        for (const l of numbered) {
          const key = claveSubcapitulo(l.partida.codigo) || "_";
          const arr = groups.get(key) ?? [];
          arr.push(l);
          groups.set(key, arr);
        }
        const subs = [...groups.entries()].map(([clave, items]) => ({
          clave,
          titulo: etiquetaSubcapitulo(items[0]?.partida.codigo ?? "") || clave,
          parcial: items.reduce((s, x) => s + x.parcial, 0),
          lineas: items,
        }));
        return { ...cap, lineas: numbered, titulo: partesTituloCapitulo(cap.capitulo), subs };
      }),
    }));
  }, [calc.especialidades]);

  const S = (n: number, d = 2) => moneyMon(n, state.moneda, d);
  const plantillaNombre = PLANTILLAS.find((p) => p.id === proyPlantilla)?.nombre;

  return (
    <section className="pre-shell" data-guest-ok>
      <div className="pre-app">
        <header className="pre-top">
          <div className="pre-top-bar">
            <div className="pre-brand">
              <span className="pre-mark">PRE</span>
              <div>
                <strong>Hoja de Presupuesto</strong>
                <p>
                  {state.archivoNombre ? `${state.archivoNombre} · ` : "Sin archivo · "}
                  {MONEDA_META[state.moneda].simbolo} · jornada {state.jornada} h/día · {PARTIDAS.length} partidas
                  {state.insumosPropios.length ? ` · ${state.insumosPropios.length} insumos de esta obra` : ""}
                  {msg ? ` · ${msg}` : ""}
                </p>
              </div>
            </div>
            {hojaDedicada ? (
              <a
                className="pre-hoja-dedicada"
                href="/presupuestos"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("mcd-go-presu", { detail: { tab: "resumen" } }));
                }}
              >
                Hoja dedicada
              </a>
            ) : null}
            <div className="pre-total">
              <span>Presupuesto total</span>
              <b>{S(calc.total)}</b>
              <small>Costo directo {S(calc.costoDirecto)}</small>
            </div>
            <div className="pre-top-tools">
              <UndoButtons undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} className="hist-btns-bar" />
              <div className={`pre-menu${menuOpen ? " is-open" : ""}`} ref={menuRef}>
                <button
                  type="button"
                  className={`pre-menu-btn${menuOpen ? " is-open" : ""}`}
                  aria-label={menuOpen ? "Cerrar opciones" : "Opciones del presupuesto"}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  title="Opciones"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span className={`burger ${menuOpen ? "is-open" : ""}`} aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                </button>
                {menuOpen ? (
                  <div className="pre-menu-drop" role="menu">
                    <button type="button" role="menuitem" className="btn secondary" disabled={ocupado} onClick={() => { setMenuOpen(false); nuevo(); }}>
                      Nuevo
                    </button>
                    <div className="pre-menu-vistas" role="group" aria-label="Vistas del presupuesto">
                      {VISTAS_MENU.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="menuitem"
                          className={`pre-menu-vista${vista === v.id ? " on" : ""}`}
                          onClick={() => {
                            setVista(v.id);
                            setMenuOpen(false);
                            if (v.id === "obra") setMobilePane("pre");
                          }}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" role="menuitem" className="btn secondary" disabled={ocupado} onClick={() => { setMenuOpen(false); abrirDatosObra(); }}>
                      Datos de obra
                    </button>
                    <div className="pre-menu-rest">
                      <button type="button" role="menuitem" className="btn secondary" disabled={ocupado} onClick={() => { setMenuOpen(false); setArchOpen(true); }}>
                        Archivos
                      </button>
                      <button type="button" role="menuitem" className="btn secondary" disabled={ocupado} onClick={() => { setMenuOpen(false); pedirGuardar(false); }}>
                        Guardar
                      </button>
                      <button type="button" role="menuitem" className="btn secondary" disabled={ocupado} onClick={() => { setMenuOpen(false); pedirGuardar(true); }}>
                        Guardar como
                      </button>
                      <button type="button" role="menuitem" className="btn" onClick={() => { setMenuOpen(false); setPrintOpen(true); }}>
                        Imprimir
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="btn"
                        title="Descarga el presupuesto, el APU completo y la relación de insumos en un solo libro .xlsx"
                        onClick={() => { setMenuOpen(false); void exportarPresupuestoXlsx(state); }}
                      >
                        Exportar Excel (.xlsx)
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="pre-meta" id="pre-meta-ficha">
            <label>
              Obra
              <input value={state.obra} onChange={(e) => patch({ obra: e.target.value })} />
            </label>
            <label>
              Lugar
              <input value={state.lugar} onChange={(e) => patch({ lugar: e.target.value })} />
            </label>
            <label>
              Cliente
              <input value={state.cliente} onChange={(e) => patch({ cliente: e.target.value })} />
            </label>
            <label>
              Fecha
              <input type="date" value={state.fecha} onChange={(e) => patch({ fecha: e.target.value })} />
            </label>
            <label>
              {state.ggModo === "organigrama" ? "GG % equiv." : "GG %"}
              {state.ggModo === "organigrama" ? (
                <input readOnly value={money(calc.ggPct, 2)} title="Porcentaje implícito respecto al costo directo" />
              ) : (
                <input type="number" step="0.1" min={0} value={state.gg} onChange={(e) => patch({ gg: parseFloat(e.target.value) || 0 })} />
              )}
            </label>
            <label>
              Util. %
              <input type="number" step="0.1" min={0} value={state.utilidad} onChange={(e) => patch({ utilidad: parseFloat(e.target.value) || 0 })} />
            </label>
            <label>
              IGV %
              <input type="number" step="0.1" min={0} value={state.igv} onChange={(e) => patch({ igv: parseFloat(e.target.value) || 0 })} />
            </label>
          </div>
        </header>

        {vista === "plantillas" ? (
          <div className="pre-lib">
            <div className="pre-col-head">
              <h3>Biblioteca de plantillas</h3>
              <p>
                {PLANTILLAS.length} presupuestos tipo RN Metrados en {gruposLib.length} rubros. Abra una plantilla para ver
                las hojas de metrado (datos, fórmulas y reemplazo, como en Excel). Luego cárguela: se reemplaza la obra
                actual (GG / utilidad / IGV 10 / 8 / 18 %). Puede editar metrados y guardar en este equipo sin cuenta.
              </p>
            </div>
            <div className="pre-lib-rubros" role="tablist" aria-label="Rubros de plantillas">
              {gruposLib.map((g) => (
                <button
                  key={g.categoria}
                  type="button"
                  role="tab"
                  aria-selected={libCat === g.categoria}
                  className={`pre-lib-rubro${libCat === g.categoria ? " on" : ""}`}
                  onClick={() => setLibCat(g.categoria)}
                >
                  <span className={`pre-esp-dot pre-lib-${g.categoria}`}>{g.meta.kicker}</span>
                  <strong>{g.meta.label}</strong>
                  <small>
                    {g.items.length}
                  </small>
                </button>
              ))}
            </div>
            {grupoLib ? (
              <section className="pre-lib-cat" id={`lib-${grupoLib.categoria}`}>
                <header>
                  <span className={`pre-esp-dot pre-lib-${grupoLib.categoria}`}>{grupoLib.meta.kicker}</span>
                  <div>
                    <h3>{grupoLib.meta.label}</h3>
                    <p>{grupoLib.meta.blurb}</p>
                  </div>
                  <small>
                    {grupoLib.items.length} plantilla{grupoLib.items.length === 1 ? "" : "s"}
                  </small>
                </header>
                <div className="pre-lib-grid">
                  {grupoLib.items.map((pl) => (
                    <button key={pl.id} type="button" className="pre-lib-card" onClick={() => setLibDetalle(pl.id)} disabled={ocupado}>
                      <strong>{pl.nombre}</strong>
                      <small>
                        {pl.area} · {pl.lineas.length} partidas · metrados paso a paso
                      </small>
                      <em>{pl.resumen}</em>
                      <div className="pre-lib-kicks">
                        {especialidadesPlantilla(pl).map((e) => (
                          <span key={e} className={`pre-esp-dot pre-esp-${e}`}>
                            {ESPECIALIDAD_META[e].kicker}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <p className="pre-lib-hint">Seleccione un rubro para ver sus plantillas.</p>
            )}
            {libroDetalle && plDetalle ? (
              <div className="pre-xls-scrim" role="dialog" aria-labelledby="pre-xls-title" onClick={() => setLibDetalle(null)}>
                <div className="pre-xls-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="pre-xls-modal-bar">
                    <h3 id="pre-xls-title">Hojas de metrado</h3>
                    <div>
                      <button type="button" className="btn secondary" onClick={() => setLibDetalle(null)}>
                        Cerrar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={ocupado}
                        onClick={() => {
                          cargarPlantilla(plDetalle.id);
                          setLibDetalle(null);
                        }}
                      >
                        Cargar presupuesto
                      </button>
                    </div>
                  </div>
                  <MetradosExcelPanel
                    key={plDetalle.id}
                    libro={libroDetalle}
                    pie="Semilla de expediente. Al cargar puede editar cada metrado en Presupuesto. El plano manda sobre la fórmula."
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {vista === "metrados" ? (
          <div className="pre-lib">
            {libroObra ? (
              <MetradosExcelPanel
                key={state.plantillaId}
                libro={libroObra}
                pie="Esta hoja explica la semilla de la plantilla cargada. Si editó metrados en Presupuesto, el valor de obra puede diferir."
              />
            ) : (
              <div className="plaza-empty">
                <h3>Sin hoja de metrados</h3>
                <p>
                  Cargue una plantilla en <strong>Plantillas</strong> para ver el procedimiento paso a paso (datos, fórmula,
                  reemplazo y metrado), como en el Excel de expediente.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {vista === "obra" ? (
          <>
            <div className="pre-mobile-tabs" aria-label="Paneles">
              <button type="button" className={mobilePane === "pre" ? "on" : ""} onClick={() => setMobilePane("pre")}>
                Partidas
              </button>
              <button type="button" className={mobilePane === "apu" ? "on" : ""} onClick={() => setMobilePane("apu")}>
                APU
              </button>
              <button type="button" onClick={() => setCatalogOpen(true)}>
                {sel?.kind === "line" ? "Agregar debajo" : "Agregar partida"}
              </button>
            </div>
            <div className="pre-body">
              <div className={`pre-col pre-grid ${mobilePane === "pre" ? "is-mobile-on" : ""}`}>
                <div className={`pre-col-head pre-col-head-row${espBarOculta ? " is-hidden" : ""}`} aria-hidden={espBarOculta}>
                  <div>
                    <h3>Presupuesto de obra</h3>
                    <p>
                      {calc.lineas.length} partidas · {calc.especialidades.length} especialidades · metrados editables
                    </p>
                  </div>
                  <button type="button" className="btn" onClick={() => setCatalogOpen(true)}>
                    {sel?.kind === "line" ? "Agregar debajo" : "Agregar partida"}
                  </button>
                </div>
                {calc.especialidades.length > 0 ? (
                  <div className={`pre-esp-bar${espBarOculta ? " is-hidden" : ""}`} aria-hidden={espBarOculta}>
                    {calc.especialidades.map((e) => (
                      <button
                        key={e.especialidad}
                        type="button"
                        className="pre-esp-pill"
                        title={`Ir a ${ESPECIALIDAD_META[e.especialidad].label}`}
                        aria-label={`Ir al inicio de ${ESPECIALIDAD_META[e.especialidad].label}`}
                        onClick={() => irAEspecialidad(e.especialidad)}
                      >
                        <i className={`pre-esp-dot pre-esp-${e.especialidad}`}>{ESPECIALIDAD_META[e.especialidad].kicker}</i>
                        <b>{S(e.parcial, 0)}</b>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="pre-table-wrap" ref={tableWrapRef}>
                  <table className="pre-table">
                    <thead>
                      <tr>
                        <th className="n">#</th>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Und</th>
                        <th className="n">Metrado</th>
                        <th className="n">P.U. S/</th>
                        <th className="n">Parcial S/</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {calc.lineas.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="pre-empty">
                            El presupuesto está vacío. Pulse <strong>Agregar partida</strong> para abrir el catálogo, o cargue una plantilla.
                          </td>
                        </tr>
                      ) : (
                        bloques.map((bloque) => (
                          <Fragment key={bloque.especialidad}>
                            <tr className="pre-row-esp" id={`pre-esp-${bloque.especialidad}`}>
                              <td colSpan={6}>
                                <span className={`pre-esp-dot pre-esp-${bloque.especialidad}`}>
                                  {ESPECIALIDAD_META[bloque.especialidad].kicker}
                                </span>
                                {ESPECIALIDAD_META[bloque.especialidad].label}
                              </td>
                              <td className="n mono">
                                <b>{S(bloque.parcial)}</b>
                              </td>
                              <td />
                            </tr>
                            {bloque.capitulos.map((cap) => (
                              <Fragment key={`${bloque.especialidad}-${cap.capitulo}`}>
                                <tr className="pre-row-cap">
                                  <td className="n" />
                                  <td>
                                    {cap.titulo.num ? <span className="pre-lvl">{cap.titulo.num}</span> : null}
                                  </td>
                                  <td colSpan={4}>{cap.titulo.nombre}</td>
                                  <td className="n mono">{S(cap.parcial)}</td>
                                  <td />
                                </tr>
                                {cap.subs.map((sub) => (
                                  <Fragment key={`${bloque.especialidad}-${cap.capitulo}-${sub.clave}`}>
                                    {cap.subs.length > 1 && sub.clave !== "_" ? (
                                      <tr className="pre-row-sub">
                                        <td className="n" />
                                        <td>
                                          <span className="pre-lvl sub">{sub.clave}</span>
                                        </td>
                                        <td colSpan={4}>{sub.titulo !== sub.clave ? sub.titulo : ""}</td>
                                        <td className="n mono">{S(sub.parcial)}</td>
                                        <td />
                                      </tr>
                                    ) : null}
                                    {sub.lineas.map((l) => (
                                  <tr
                                    key={l.linea.id}
                                    className={sel?.kind === "line" && sel.id === l.linea.id ? "on" : ""}
                                    title={sel?.kind === "line" && sel.id === l.linea.id ? "Pulse de nuevo para abrir el APU" : "Pulse para seleccionar"}
                                    onClick={() => {
                                      const already = sel?.kind === "line" && sel.id === l.linea.id;
                                      if (already) setMobilePane("apu");
                                      else {
                                        setSel({ kind: "line", id: l.linea.id });
                                        setMobilePane("pre");
                                      }
                                    }}
                                  >
                                    <td className="n">{l.n}</td>
                                    <td>
                                      <code>{l.partida.codigo}</code>
                                    </td>
                                    <td>
                                      <input
                                        className="pre-desc-in"
                                        type="text"
                                        value={l.linea.descripcion ?? l.partida.descripcion}
                                        aria-label="Descripción de la partida"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setDescripcionLinea(l.linea.id, e.target.value)}
                                      />
                                    </td>
                                    <td>{l.partida.und}</td>
                                    <td className="n">
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={l.linea.metrado}
                                        className={l.linea.vinculoRevit?.ausenteEnModelo ? "pre-metrado-alerta" : ""}
                                        title={l.linea.vinculoRevit?.ausenteEnModelo ? "Sin metrado: esta partida ya no aparece en el último paquete de Revit vinculado" : undefined}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setMetrado(l.linea.id, parseFloat(e.target.value))}
                                      />
                                      {l.linea.vinculoRevit?.ausenteEnModelo ? <span className="pre-metrado-warn" title="Sin metrado del modelo Revit">⚠</span> : null}
                                    </td>
                                    <td className="n mono">{money(l.apu.pu)}</td>
                                    <td className="n mono">{money(l.parcial)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="pre-dup"
                                        title="Duplicar partida con los mismos insumos"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          duplicarLinea(l.linea.id);
                                        }}
                                      >
                                        ⧉
                                      </button>
                                      <button type="button" className="pre-x" onClick={(e) => { e.stopPropagation(); removeLinea(l.linea.id); }} title="Quitar">
                                        ×
                                      </button>
                                    </td>
                                  </tr>
                                    ))}
                                  </Fragment>
                                ))}
                              </Fragment>
                            ))}
                          </Fragment>
                        ))
                      )}
                    </tbody>
                    {calc.lineas.length > 0 ? (
                      <tfoot>
                        <tr>
                          <td colSpan={6}>Costo directo</td>
                          <td className="n mono">{money(calc.costoDirecto)}</td>
                          <td />
                        </tr>
                        <tr>
                          <td colSpan={6}>
                            Gastos generales (
                            {state.ggModo === "organigrama" ? `${money(calc.ggPct, 2)} % del CD · organigrama` : `${state.gg} %`}
                            )
                          </td>
                          <td className="n mono">{money(calc.gg)}</td>
                          <td />
                        </tr>
                        <tr>
                          <td colSpan={6}>Utilidad ({state.utilidad} %)</td>
                          <td className="n mono">{money(calc.utilidad)}</td>
                          <td />
                        </tr>
                        <tr>
                          <td colSpan={6}>Subtotal</td>
                          <td className="n mono">{money(calc.subtotal)}</td>
                          <td />
                        </tr>
                        <tr>
                          <td colSpan={6}>IGV ({state.igv} %)</td>
                          <td className="n mono">{money(calc.igv)}</td>
                          <td />
                        </tr>
                        <tr className="pre-grand">
                          <td colSpan={6}>Presupuesto total</td>
                          <td className="n mono">{S(calc.total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </div>

              <aside className={`pre-col pre-apu ${mobilePane === "apu" ? "is-mobile-on" : ""}`}>
                <div className="pre-col-head">
                  <h3>Análisis de precio unitario</h3>
                  {partidaSel ? (
                    <p>
                      <span className={`pre-esp-dot pre-esp-${partidaSel.especialidad}`}>
                        {ESPECIALIDAD_META[partidaSel.especialidad].kicker}
                      </span>{" "}
                      <code>{partidaSel.codigo}</code> · {partidaSel.und}
                      {lineaSel?.origenCodigo ? (
                        <>
                          {" "}
                          · partida de obra, desde <code>{lineaSel.origenCodigo}</code>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p>Seleccione una partida del presupuesto para editar su APU.</p>
                  )}
                </div>
                {apu && lineaSel ? (
                  <div className="pre-apu-body">
                    <div className="pre-apu-desc">
                      <label>
                        Descripción
                        <input
                          type="text"
                          value={lineaSel.descripcion ?? partidaSel?.descripcion ?? ""}
                          aria-label="Descripción de la partida"
                          onChange={(e) => setDescripcionLinea(lineaSel.id, e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn secondary"
                        title="Crea otra partida con los mismos insumos. El catálogo no se modifica."
                        onClick={() => duplicarLinea(lineaSel.id)}
                      >
                        Duplicar partida
                      </button>
                    </div>
                    <div className="pre-apu-rend">
                      <label>
                        Rendimiento
                        <span className="pre-apu-rend-field">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={rendPartida != null ? Number(rendPartida.toFixed(4)) : ""}
                            disabled={rendPartida == null}
                            aria-label={`Rendimiento de la partida en ${partidaSel?.und ?? "und"} por día`}
                            onChange={(e) => setRendimientoPartida(parseFloat(e.target.value))}
                          />
                          <small>{partidaSel?.und ?? "und"}/día</small>
                        </span>
                      </label>
                      {recetaEditada ? (
                        <button type="button" className="btn secondary" onClick={restablecerReceta}>
                          Restablecer receta
                        </button>
                      ) : null}
                    </div>
                    {KIND_ORDER.map((kind) => {
                      const block = apu.porKind[kind];
                      const meta = KIND_META[kind];
                      const usados = new Set(apu.recursos.map((r) => r.insumo.id));
                      const busca = (apuBusca[kind] ?? "").trim().toLowerCase();
                      const sugeridos = busca
                        ? catalogo.filter(
                            (i) =>
                              i.kind === kind &&
                              !usados.has(i.id) &&
                              (i.nombre.toLowerCase().includes(busca) || i.codigo.toLowerCase().includes(busca))
                          ).slice(0, 8)
                        : [];
                      const codigoSiguiente = siguienteCodigo(kind, state.insumosPropios);
                      return (
                        <div key={kind} className={`pre-kind ${meta.className}`}>
                          <header>
                            <KindIcon kind={kind} />
                            <strong>{meta.label}</strong>
                            <span className="pre-chip">{meta.corto}</span>
                            <b>{S(block.subtotal)}</b>
                          </header>
                          {block.items.length === 0 ? (
                            <p className="pre-kind-empty">Sin recursos de este tipo. Búsquelos abajo para agregarlos.</p>
                          ) : (
                            <ul className="pre-kind-list">
                              {block.items.map((r) => {
                                const esHin = r.insumo.id === "EQ-HIN";
                                return (
                                  <li key={r.insumo.id} className="pre-kind-row">
                                    <div className="pre-kind-id">
                                      <div className="pre-kind-id-main">
                                        <span className={`pre-chip sm ${meta.className}`}>{meta.corto}</span>
                                        <code className="pre-iu">{codigoIU(r.insumo.iu)}</code>
                                        <span className="pre-kind-name">{r.insumo.nombre}</span>
                                        {esInsumoPropio(r.insumo.id) ? (
                                          <span className="pre-chip-obra">Esta obra</span>
                                        ) : null}
                                      </div>
                                      <span className="pre-kind-und">{esHin ? "%" : r.insumo.und}</span>
                                      <button
                                        type="button"
                                        className="pre-x"
                                        title="Quitar del APU"
                                        onClick={() => quitarRecursoApu(r.insumo.id)}
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <div className="pre-kind-metrics">
                                      <label>
                                        <span>Cuad.</span>
                                        {r.usaJornada ? (
                                          <input
                                            type="number"
                                            min={0.01}
                                            step="0.01"
                                            value={r.cuadrilla}
                                            title="Cuadrilla: personas o equipos de este recurso"
                                            aria-label={`Cuadrilla de ${r.insumo.nombre}`}
                                            onChange={(e) => setCuadrillaApu(r.insumo.id, parseFloat(e.target.value))}
                                          />
                                        ) : (
                                          <em>—</em>
                                        )}
                                      </label>
                                      <label>
                                        <span title={`Rendimiento en ${partidaSel?.und ?? "und"}/día`}>Rend.</span>
                                        {r.usaJornada ? (
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={Number(r.rendimiento.toFixed(4))}
                                            title={`Rendimiento en ${partidaSel?.und ?? "und"} por jornada de ${state.jornada} h`}
                                            aria-label={`Rendimiento de ${r.insumo.nombre}`}
                                            onChange={(e) => setRendimientoApu(r.insumo.id, parseFloat(e.target.value))}
                                          />
                                        ) : (
                                          <em>—</em>
                                        )}
                                      </label>
                                      <label>
                                        <span>Cant.</span>
                                        <input
                                          type="number"
                                          min={0}
                                          step={esHin ? "0.1" : "0.001"}
                                          value={Number(r.cantidad.toFixed(esHin ? 2 : 4))}
                                          aria-label={`Cantidad de ${r.insumo.nombre}`}
                                          onChange={(e) => setCantidadApu(r.insumo.id, parseFloat(e.target.value))}
                                        />
                                      </label>
                                      <label>
                                        <span>P.U.</span>
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={Number(r.precio.toFixed(4))}
                                          readOnly={esHin}
                                          title={esHin ? "Se calcula como porcentaje de la mano de obra" : "Precio de obra"}
                                          aria-label={`Precio de ${r.insumo.nombre}`}
                                          onChange={(e) => {
                                            if (esHin) return;
                                            setPrecio(r.insumo.id, parseFloat(e.target.value));
                                          }}
                                        />
                                      </label>
                                      <label>
                                        <span>Parcial</span>
                                        <output className="mono">{money(r.parcial)}</output>
                                      </label>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <div className="pre-apu-add">
                            <div className="pre-apu-add-bar">
                              <input
                                placeholder={`Agregar ${meta.label.toLowerCase()}…`}
                                value={apuBusca[kind] ?? ""}
                                onChange={(e) => setApuBusca((s) => ({ ...s, [kind]: e.target.value }))}
                              />
                              <button
                                type="button"
                                className="btn secondary"
                                title={`Crear ${meta.label.toLowerCase()} de esta obra (${codigoSiguiente})`}
                                onClick={() =>
                                  abrirNuevoInsumo(kind, apuBusca[kind] ?? "", true, true)
                                }
                              >
                                Nuevo
                              </button>
                            </div>
                            {sugeridos.length > 0 || busca ? (
                              <ul>
                                {sugeridos.map((i) => (
                                  <li key={i.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        agregarRecursoApu(i.id);
                                        setApuBusca((s) => ({ ...s, [kind]: "" }));
                                      }}
                                    >
                                      <code>{i.codigo}</code>
                                      <span>
                                        {i.nombre}
                                        {esInsumoPropio(i.id) ? (
                                          <span className="pre-chip-obra">Obra</span>
                                        ) : null}
                                      </span>
                                      <em>{S(i.precio)}</em>
                                    </button>
                                  </li>
                                ))}
                                <li>
                                  <button
                                    type="button"
                                    className="pre-apu-crear"
                                    onClick={() =>
                                      abrirNuevoInsumo(kind, apuBusca[kind] ?? "", true, true)
                                    }
                                  >
                                    <code>{codigoSiguiente}</code>
                                    <span>
                                      {busca
                                        ? `Crear «${apuBusca[kind]?.trim()}» como insumo de esta obra`
                                        : `Crear ${meta.label.toLowerCase()} de esta obra`}
                                    </span>
                                    <em>Nuevo</em>
                                  </button>
                                </li>
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div className="pre-pu">
                      <span>Precio unitario{recetaEditada ? " · receta de obra" : ""}</span>
                      <b>{S(apu.pu)}</b>
                      <small>por {partidaSel?.und}</small>
                    </div>
                    {sel?.kind === "line" && !apu.recursos.some((r) => r.insumo.id === "EQ-HIN") ? (
                      <button type="button" className="btn secondary" onClick={() => agregarRecursoApu("EQ-HIN")}>
                        Incluir herramientas (5 % MO)
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="pre-apu-empty">
                    <p>
                      Pulse una partida del presupuesto. El APU desglosa cuadrilla, rendimiento (und/día) y cantidad
                      según la jornada de {state.jornada} h. Los materiales se cargan por consumo.
                    </p>
                  </div>
                )}
              </aside>

              {catalogOpen ? (
                <div
                  className="pre-cat-scrim"
                  onClick={() => setCatalogOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setCatalogOpen(false);
                  }}
                >
                  <aside
                    className="pre-cat-drawer"
                    role="dialog"
                    aria-labelledby="pre-cat-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pre-col-head">
                      <div className="pre-col-head-row">
                        <div>
                          <h3 id="pre-cat-title">Catálogo de partidas</h3>
                          <p>Elija la partida y pulse Agregar. El panel permanece abierto para seguir incorporando ítems.</p>
                        </div>
                        <button type="button" className="btn secondary" onClick={() => setCatalogOpen(false)}>
                          Cerrar
                        </button>
                      </div>
                      <input
                        className="pre-search"
                        placeholder="Buscar código o descripción…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        autoFocus
                      />
                      <div className="pre-esp">
                        <button type="button" className={esp === "todas" ? "on" : ""} onClick={() => setEsp("todas")}>
                          Todas
                        </button>
                        {ESPECIALIDADES.map((k) => (
                          <button key={k} type="button" className={esp === k ? "on" : ""} onClick={() => setEsp(k)}>
                            {ESPECIALIDAD_META[k].kicker}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pre-tree">
                      {grupos.map((g) => (
                        <div key={g.key} className="pre-cap">
                          <button type="button" className="pre-cap-btn" onClick={() => toggleCap(g.key)}>
                            <span className={`pre-esp-dot pre-esp-${g.especialidad}`}>{ESPECIALIDAD_META[g.especialidad].kicker}</span>
                            <span>{g.capitulo}</span>
                            <small>
                              {g.items.length} {capOpen(g.key) ? "–" : "+"}
                            </small>
                          </button>
                          {capOpen(g.key)
                            ? g.items.map((p) => (
                                <div
                                  key={p.codigo}
                                  className={`pre-item ${catSel === p.codigo ? "on" : ""}`}
                                  onClick={() => setCatSel(p.codigo)}
                                  onDoubleClick={() => addPartida(p.codigo)}
                                >
                                  <code>{p.codigo}</code>
                                  <span>{p.descripcion}</span>
                                  <em>{p.und}</em>
                                  <button
                                    type="button"
                                    className="pre-add"
                                    title="Agregar al presupuesto"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addPartida(p.codigo);
                                      setCatSel(p.codigo);
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                              ))
                            : null}
                        </div>
                      ))}
                    </div>
                    {catPartida ? (
                      <div className="pre-cat-foot">
                        <div>
                          <strong>{catPartida.descripcion}</strong>
                          <p>
                            {catPartida.codigo} · {catPartida.und} · P.U. {S(catPu)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => addPartida(catPartida.codigo)}
                        >
                          Agregar al presupuesto
                        </button>
                      </div>
                    ) : (
                      <div className="pre-cat-foot mute">
                        <p>Seleccione una partida del listado o pulse + para incorporarla de inmediato.</p>
                      </div>
                    )}
                  </aside>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {vista === "insumos" ? (
          <div className={`pre-insumos${insumosChromeCollapsed ? " is-chrome-collapsed" : ""}`}>
            <div className="pre-insumos-scroll" onScroll={onInsumosScroll}>
              <div className="pre-insumos-chrome">
                <div className="pre-insumos-bar">
                  <h3>Catálogo de insumos · revistas CAPECO</h3>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      abrirNuevoInsumo(kindFiltro === "todos" ? "mat" : kindFiltro, qIns, false, false)
                    }
                  >
                    Nuevo insumo
                  </button>
                </div>
                <div className="pre-insumos-extra" aria-hidden={insumosChromeCollapsed}>
                  {state.insumosPropios.length ? (
                    <span className="pre-modal-hint pre-insumos-hint">
                      {state.insumosPropios.length} insumo{state.insumosPropios.length === 1 ? "" : "s"} propio
                      {state.insumosPropios.length === 1 ? "" : "s"} en esta obra
                    </span>
                  ) : null}
                  <input
                    className="pre-search"
                    placeholder="Buscar por nombre, código, IU o rubro CAPECO…"
                    value={qIns}
                    onChange={(e) => setQIns(e.target.value)}
                  />
                  <div className="pre-esp">
                    <button type="button" className={kindFiltro === "todos" ? "on" : ""} onClick={() => setKindFiltro("todos")}>
                      Todos
                    </button>
                    {KIND_ORDER.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`${kindFiltro === k ? "on" : ""} ${KIND_META[k].className}`}
                        onClick={() => setKindFiltro(k)}
                      >
                        <KindIcon kind={k} />
                        {KIND_META[k].label}
                      </button>
                    ))}
                  </div>
                  <div className="pre-esp pre-cats">
                    <button type="button" className={catFiltro === "todas" ? "on" : ""} onClick={() => setCatFiltro("todas")}>
                      Todos los rubros
                    </button>
                    {CATEGORIAS_CAPECO.map((c) => (
                      <button key={c} type="button" className={catFiltro === c ? "on" : ""} onClick={() => setCatFiltro(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            <div className="pre-table-wrap">
              <table className="pre-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Código</th>
                    <th>IU</th>
                    <th>Descripción</th>
                    <th>Rubro CAPECO</th>
                    <th>Und</th>
                    <th className="n">Precio catálogo</th>
                    <th className="n">Precio obra S/</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {insumosPorKind.map((g) => (
                    <Fragment key={g.kind}>
                      <tr className="pre-row-kind">
                        <td colSpan={9}>
                          <KindIcon kind={g.kind} />
                          {KIND_META[g.kind].label}
                          <small>
                            {g.items.length} ítem{g.items.length === 1 ? "" : "s"}
                          </small>
                        </td>
                      </tr>
                      {g.items.map((ins) => {
                        const meta = KIND_META[ins.kind];
                        const obra = state.precios[ins.id];
                        const propio = esInsumoPropio(ins.id);
                        return (
                          <tr key={ins.id} className={propio ? "pre-row-obra" : undefined}>
                            <td>
                              <span className={`pre-chip ${meta.className}`}>
                                <KindIcon kind={ins.kind} />
                                {meta.corto}
                              </span>
                            </td>
                            <td>
                              <code>{ins.codigo}</code>
                            </td>
                            <td>
                              <code className="pre-iu" title={ins.categoria}>
                                {codigoIU(ins.iu)}
                              </code>
                            </td>
                            <td>
                              {ins.nombre}
                              {propio ? <span className="pre-chip-obra">Esta obra</span> : null}
                            </td>
                            <td>{ins.categoria}</td>
                            <td>{ins.und}</td>
                            <td className="n mono">{money(ins.precio)}</td>
                            <td className="n">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number.isFinite(obra) ? obra : ins.precio}
                                onChange={(e) => setPrecio(ins.id, parseFloat(e.target.value))}
                              />
                            </td>
                            <td className="pre-insumo-acciones">
                              {propio ? (
                                <>
                                  <button
                                    type="button"
                                    className="pre-link"
                                    onClick={() =>
                                      setInsumoModal({
                                        kind: ins.kind,
                                        kindLocked: true,
                                        nombre: ins.nombre,
                                        incorporarApu: false,
                                        editId: ins.id,
                                      })
                                    }
                                  >
                                    Editar
                                  </button>
                                  <button type="button" className="pre-link" onClick={() => borrarInsumoPropio(ins.id)}>
                                    Quitar
                                  </button>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        ) : null}

        {vista === "formula" ? (
          <FormulaPolinomicaPanel state={state} onChange={(formula) => patch({ formula })} />
        ) : null}

        {vista === "resumen" ? (
          <div className="pre-resumen">
            <div className="pre-col-head">
              <h3>Pie de presupuesto</h3>
              <p>
                Lo que va debajo del costo directo, como en S10 y presupuestos.pe: gastos generales, utilidad e IGV. Cada monto se redondea a dos decimales y luego se suma, para que el total cuadre al céntimo.
              </p>
            </div>

            <section className="pre-formacion" aria-label="Formación del presupuesto">
              <ol className="pre-pasos">
                <li>
                  <span className="pre-paso-n">1</span>
                  <div className="pre-paso-body">
                    <h4>Costo directo</h4>
                    <p>Suma de partidas: metrado × precio unitario. Es la base de todo el presupuesto.</p>
                  </div>
                  <div className="pre-paso-val">
                    <small>Suma de obra</small>
                    <b>{S(calc.costoDirecto)}</b>
                  </div>
                </li>
                <li>
                  <span className="pre-paso-n">2</span>
                  <div className="pre-paso-body">
                    <h4>Gastos generales</h4>
                    <p>Personal de residencia, administración y gastos de oficina. Puede calcularlos como un porcentaje del costo directo o desglosarlos en el organigrama.</p>
                    <div className="pre-modo" role="group" aria-label="Modo de gastos generales">
                      <button
                        type="button"
                        className={state.ggModo === "porcentaje" ? "on" : ""}
                        onClick={() => patch({ ggModo: "porcentaje" })}
                      >
                        Porcentaje del costo directo
                      </button>
                      <button
                        type="button"
                        className={state.ggModo === "organigrama" ? "on" : ""}
                        onClick={() => patch({ ggModo: "organigrama" })}
                      >
                        Organigrama (desglose)
                      </button>
                    </div>
                    {state.ggModo === "porcentaje" ? (
                      <label className="pre-inline">
                        GG sobre el costo directo
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={state.gg}
                          onChange={(e) => patch({ gg: parseFloat(e.target.value) || 0 })}
                        />
                        <span>%</span>
                      </label>
                    ) : (
                      <p className="pre-paso-note">
                        Equivale a {money(calc.ggPct, 2)} % del costo directo. Edite cargos y sueldos en el organigrama de abajo.
                      </p>
                    )}
                  </div>
                  <div className="pre-paso-val">
                    <small>{state.ggModo === "organigrama" ? `${money(calc.ggPct, 2)} % del CD` : `${money(state.gg, 2)} % del CD`}</small>
                    <b>{S(calc.gg)}</b>
                  </div>
                </li>
                <li>
                  <span className="pre-paso-n">3</span>
                  <div className="pre-paso-body">
                    <h4>Utilidad del contratista</h4>
                    <p>Ganancia sobre el costo directo. Puede indicar el porcentaje o el monto en soles; ambos se mantienen alineados.</p>
                    <div className="pre-inline-row">
                      <label className="pre-inline">
                        Utilidad
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={state.utilidad}
                          onChange={(e) => patch({ utilidad: parseFloat(e.target.value) || 0 })}
                        />
                        <span>% del CD</span>
                      </label>
                      <label className="pre-inline">
                        Monto
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={calc.utilidad}
                          onChange={(e) => {
                            const monto = parseFloat(e.target.value) || 0;
                            patch({ utilidad: calc.costoDirecto > 0 ? (monto / calc.costoDirecto) * 100 : 0 });
                          }}
                        />
                        <span>S/</span>
                      </label>
                    </div>
                  </div>
                  <div className="pre-paso-val">
                    <small>{money(state.utilidad, 2)} % del CD</small>
                    <b>{S(calc.utilidad)}</b>
                  </div>
                </li>
                <li>
                  <span className="pre-paso-n">4</span>
                  <div className="pre-paso-body">
                    <h4>Subtotal</h4>
                    <p>Costo directo + gastos generales + utilidad. Sobre esta base se calcula el IGV.</p>
                  </div>
                  <div className="pre-paso-val">
                    <small>Base imponible</small>
                    <b>{S(calc.subtotal)}</b>
                  </div>
                </li>
                <li>
                  <span className="pre-paso-n">5</span>
                  <div className="pre-paso-body">
                    <h4>IGV</h4>
                    <p>Impuesto general a las ventas sobre el subtotal. En Perú la tasa usual es 18 %; puede modificarla si el régimen de la obra lo exige.</p>
                    <label className="pre-inline">
                      Tasa IGV
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={state.igv}
                        onChange={(e) => patch({ igv: parseFloat(e.target.value) || 0 })}
                      />
                      <span>%</span>
                    </label>
                  </div>
                  <div className="pre-paso-val">
                    <small>{money(state.igv, 2)} % del subtotal</small>
                    <b>{S(calc.igv)}</b>
                  </div>
                </li>
                <li className="pre-paso-total">
                  <span className="pre-paso-n">6</span>
                  <div className="pre-paso-body">
                    <h4>Presupuesto total</h4>
                    <p>Subtotal + IGV. Es el monto de contrato con impuestos.</p>
                  </div>
                  <div className="pre-paso-val">
                    <small>Total S/</small>
                    <b>{S(calc.total)}</b>
                  </div>
                </li>
              </ol>
            </section>

            <OrganigramaGg
              nodos={state.organigrama ?? []}
              onChange={(organigrama) => patch({ organigrama })}
              selectedId={orgSel}
              onSelect={setOrgSel}
              activo={state.ggModo === "organigrama"}
            />

            <div className="pre-col-head">
              <h3>Resumen por especialidad y capítulo</h3>
              <p>Costo directo agrupado como en un presupuesto de obra (RW7 / S10).</p>
            </div>
            {calc.especialidades.length > 0 ? (
              <div className="pre-cards">
                {calc.especialidades.map((e) => (
                  <article key={e.especialidad} className="pre-card">
                    <span className={`pre-esp-dot pre-esp-${e.especialidad}`}>{ESPECIALIDAD_META[e.especialidad].kicker}</span>
                    <h4>{ESPECIALIDAD_META[e.especialidad].label}</h4>
                    <b>{S(e.parcial)}</b>
                    <small>{calc.costoDirecto ? money((e.parcial / calc.costoDirecto) * 100, 1) : "0.0"} % del CD</small>
                  </article>
                ))}
                {KIND_ORDER.map((k) => (
                  <article key={k} className={`pre-card pre-card-kind ${KIND_META[k].className}`}>
                    <KindIcon kind={k} />
                    <h4>{KIND_META[k].label}</h4>
                    <b>{S(calc.porKindCd[k])}</b>
                    <small>{calc.costoDirecto ? money((calc.porKindCd[k] / calc.costoDirecto) * 100, 1) : "0.0"} % del CD</small>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="pre-table-wrap">
              <table className="pre-table">
                <thead>
                  <tr>
                    <th>Especialidad</th>
                    <th>Capítulo</th>
                    <th className="n">Partidas</th>
                    <th className="n">Parcial S/</th>
                    <th className="n">% CD</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.capitulos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="pre-empty">
                        No hay metrados. Cargue una plantilla o agregue partidas en Presupuesto.
                      </td>
                    </tr>
                  ) : (
                    calc.especialidades.map((e) => (
                      <Fragment key={e.especialidad}>
                        <tr className="pre-row-esp">
                          <td colSpan={3}>
                            <span className={`pre-esp-dot pre-esp-${e.especialidad}`}>{ESPECIALIDAD_META[e.especialidad].kicker}</span>
                            {ESPECIALIDAD_META[e.especialidad].label}
                          </td>
                          <td className="n mono">{money(e.parcial)}</td>
                          <td className="n mono">{calc.costoDirecto ? money((e.parcial / calc.costoDirecto) * 100, 1) : "0.0"} %</td>
                        </tr>
                        {e.capitulos.map((c) => (
                          <tr key={`${c.especialidad}-${c.capitulo}`}>
                            <td />
                            <td>{c.capitulo}</td>
                            <td className="n">{c.lineas.length}</td>
                            <td className="n mono">{money(c.parcial)}</td>
                            <td className="n mono">{calc.costoDirecto ? money((c.parcial / calc.costoDirecto) * 100, 1) : "0.0"} %</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))
                  )}
                </tbody>
                {calc.capitulos.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Costo directo</td>
                      <td className="n mono">{money(calc.costoDirecto)}</td>
                      <td className="n mono">100.0 %</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        Gastos generales
                        {state.ggModo === "organigrama" ? ` (${money(calc.ggPct, 2)} % del CD)` : ` (${money(state.gg, 2)} %)`}
                      </td>
                      <td className="n mono">{money(calc.gg)}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={3}>Utilidad ({money(state.utilidad, 2)} %)</td>
                      <td className="n mono">{money(calc.utilidad)}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={3}>Subtotal</td>
                      <td className="n mono">{money(calc.subtotal)}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={3}>IGV ({money(state.igv, 2)} %)</td>
                      <td className="n mono">{money(calc.igv)}</td>
                      <td />
                    </tr>
                    <tr className="pre-grand">
                      <td colSpan={3}>Total</td>
                      <td className="n mono">{S(calc.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <PresupuestoPrint state={state} calc={calc} hojas={printHojas} />

      <ArchivoModal
        open={archOpen}
        onClose={() => setArchOpen(false)}
        nube={nube}
        actualId={state.archivoId}
        mensaje={msg}
        ocupado={ocupado}
        configurada={nubeDisponible()}
        onAbrir={abrirArchivo}
        onBorrar={borrarArchivo}
        onNuevo={() => {
          setArchOpen(false);
          pedirGuardar(false);
        }}
      />
      <PrintModal
        open={printOpen}
        seleccion={printHojas}
        onToggle={(id) => setPrintHojas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
        onSet={setPrintHojas}
        onClose={() => setPrintOpen(false)}
        onPrint={imprimirHojas}
      />
      <GuardarComoModal
        open={saveOpen}
        valor={saveNombre}
        onChange={setSaveNombre}
        onClose={() => setSaveOpen(false)}
        onOk={() => void ejecutarGuardar(saveNombre, saveComo)}
      />
      <InsumoObraModal
        open={Boolean(insumoModal)}
        kindInit={insumoModal?.kind ?? "mat"}
        kindLocked={insumoModal?.kindLocked ?? false}
        nombreInit={insumoModal?.nombre ?? ""}
        propios={state.insumosPropios ?? []}
        edit={
          insumoModal?.editId
            ? state.insumosPropios.find((i) => i.id === insumoModal.editId)
            : undefined
        }
        incorporarApu={Boolean(insumoModal?.incorporarApu)}
        onClose={() => setInsumoModal(null)}
        onSave={guardarInsumoObra}
      />
      <ProyectoModal
        open={proyOpen}
        modo={proyModo}
        plantillaNombre={plantillaNombre}
        aviso={
          proyModo !== "editar" && state.lineas.length
            ? "Se reemplazará el presupuesto que está abierto. Gastos generales, utilidad, IGV, moneda y jornada quedan como los confirme aquí."
            : undefined
        }
        inicial={proyInicial}
        onClose={() => setProyOpen(false)}
        onConfirm={confirmarProyecto}
      />
    </section>
  );
}
