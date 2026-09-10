import { useEffect, useMemo, useState } from "react";
import { PARTIDAS } from "../lib/presupuesto/partidas";
import { siguienteCodigoPartida } from "../lib/presupuesto/engine";
import type { Partida } from "../lib/presupuesto/types";
import { partidasSimilares } from "../lib/presupuesto/revit/similares";
import {
  PLANTILLAS,
  especialidadesPlantilla,
  plantillaPorId,
  plantillasAgrupadas,
  type CategoriaPlantilla,
} from "../lib/presupuesto/plantillas";
import { ESPECIALIDAD_META } from "../lib/presupuesto/types";
import {
  aplicarVinculosAlPresupuesto,
  CAMPO_LABEL,
  cantidadElemento,
  claveExclusion,
  cruzarPlantilla,
  elementosDeGrupo,
  metradoGrupoCampo,
  paqueteDemoVivienda,
  parsePaquete,
  resumenRol,
  ROL_LABEL,
  semaforo,
  unionesPorPartida,
} from "../lib/presupuesto/revit/engine";
import { ADDIN_RELEASE, REVIT_YEARS, downloadHref, fetchAddinRelease, type AddinRelease, type RevitYear } from "../lib/presupuesto/revit/addinCatalog";
import { estadoEnlaceRevit, generarCodigoRevit, importarElementosRevit, type EnlaceRevit } from "../lib/presupuesto/revit/live";
import type { RevitFila, RevitPaquete, RevitRol } from "../lib/presupuesto/revit/types";
import { savePresupuesto } from "../lib/presupuesto/engine";
import { useAuth } from "../ui/AuthProvider";

type Paso = "plantilla" | "conexion" | "union";
type Override = { codigo: string | null };

const ESTADO: Record<RevitFila["estado"], string> = {
  sugerida: "Lista",
  revisar: "Revisar",
  aceptada: "Unida",
  anexada: "En presupuesto",
  fuera_de_plantilla: "Fuera de plantilla",
  sin_identificar: "Sin partida",
  hueco_plantilla: "Sin elemento",
  hueco_modelo: "Sin metrado",
  conflicto: "Conflicto",
};

function fmt(n: number, und: string) {
  const d = und === "kg" ? 1 : 3;
  return `${n.toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: und === "kg" ? 1 : 3 })} ${und}`;
}

function partidaDe(codigo: string | null, creadas: Partida[] = []) {
  if (!codigo) return undefined;
  return creadas.find((p) => p.codigo === codigo) ?? PARTIDAS.find((p) => p.codigo === codigo);
}

function rolesTxt(roles: RevitRol[]) {
  return roles.map((r) => ROL_LABEL[r].toLowerCase()).join(" y ");
}

function cuando(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function textoPlugin(enlace: EnlaceRevit | null, haySesion: boolean) {
  if (!haySesion) return "Inicie sesión para vincular el plugin a su cuenta.";
  if (!enlace) return "Comprobando si el plugin ya se enlazó a esta cuenta…";
  if (enlace.sincronizadoEn) {
    return `Sincronizado · ${enlace.archivo || "modelo Revit"}${enlace.elementos ? ` · ${enlace.elementos} elementos` : ""}`;
  }
  if (enlace.plugin === "conectado") return "Conectado a esta cuenta. En Revit pulse Analizar y Sincronizar.";
  if (enlace.plugin === "esperando") return "Código generado. Péguelo en el panel de Revit y pulse Conectar.";
  return "Plugin desconectado. Genere un código y péguelo en Revit.";
}

export function RevitVincularModule() {
  const { user, session, isPro, plansLive, openGoogle, ready } = useAuth();
  const [paso, setPaso] = useState<Paso>("plantilla");
  const [plantillaId, setPlantillaId] = useState("");
  const [qPlantilla, setQPlantilla] = useState("");
  const [abierta, setAbierta] = useState<CategoriaPlantilla | "">("");
  const [paquete, setPaquete] = useState<RevitPaquete | null>(null);
  const [origen, setOrigen] = useState<"archivo" | "demo" | "">("");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<RevitFila[]>([]);
  const [sel, setSel] = useState("");
  const [zona, setZona] = useState<"unidas" | "libres">("unidas");
  const [selLibre, setSelLibre] = useState("");
  const [unirAbierto, setUnirAbierto] = useState(false);
  const [unirRestantes, setUnirRestantes] = useState(false);
  const [extraidos, setExtraidos] = useState<string[]>([]);
  const [qFila, setQFila] = useState("");
  const [qLibre, setQLibre] = useState("");
  const [qPartida, setQPartida] = useState("");
  const [creadas, setCreadas] = useState<Partida[]>([]);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [crearDesc, setCrearDesc] = useState("");
  const [crearOrigen, setCrearOrigen] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [rel, setRel] = useState<AddinRelease>(ADDIN_RELEASE);
  const [year, setYear] = useState<RevitYear>(2025);
  const [codigoLive, setCodigoLive] = useState("");
  const [liveMsg, setLiveMsg] = useState("");
  const [enlace, setEnlace] = useState<EnlaceRevit | null>(null);
  const [guia, setGuia] = useState(false);
  const [avisoPro, setAvisoPro] = useState(false);

  useEffect(() => {
    void fetchAddinRelease().then(setRel);
  }, []);

  useEffect(() => {
    if (!guia && !avisoPro) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGuia(false);
        setAvisoPro(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guia, avisoPro]);

  const plantilla = plantillaId ? plantillaPorId(plantillaId) : undefined;
  const grupos = useMemo(() => plantillasAgrupadas(), []);
  const plantillasVisibles = useMemo(() => {
    const needle = qPlantilla.trim().toLowerCase();
    return grupos
      .map((g) => ({
        ...g,
        items: g.items.filter((p) => {
          if (!needle) return true;
          return `${p.nombre} ${p.obra} ${p.resumen} ${p.area}`.toLowerCase().includes(needle);
        }),
      }))
      .filter((g) => g.items.length);
  }, [grupos, qPlantilla]);

  function toggleCategoria(id: CategoriaPlantilla) {
    setAbierta((cur) => (cur === id ? "" : id));
  }

  const grupoAbierto = plantillasVisibles.find((g) => g.categoria === abierta) ?? null;

  const base = useMemo(
    () => (paquete && plantillaId ? cruzarPlantilla(paquete, plantillaId, []) : []),
    [paquete, plantillaId],
  );

  const filas = useMemo(() => {
    const skip = new Set(extraidos);
    const mapped = base.map((f) => {
      const g = paquete?.grupos.find((x) => x.grupoId === f.grupoId);
      const o = overrides[f.id];
      const codigo = o ? o.codigo : f.codigo;
      const part = partidaDe(codigo, creadas);
      const metrado = g ? metradoGrupoCampo(g, f.campo, qtyOverrides, skip) : f.metrado;
      const ids = g
        ? elementosDeGrupo(g)
            .filter((el) => !skip.has(claveExclusion(g.grupoId, el.uniqueId, f.campo)))
            .map((el) => el.uniqueId)
        : f.uniqueIds;
      return {
        ...f,
        codigo,
        metrado,
        uniqueIds: ids,
        descripcion: part?.descripcion ?? (codigo ? f.descripcion : "Sin partida"),
        und: part?.und ?? f.und,
        enPlantilla: Boolean(codigo && plantilla?.lineas.some((l) => l.codigo === codigo)),
        estado: (codigo ? (f.estado === "sin_identificar" || f.estado === "conflicto" ? "aceptada" : f.estado) : "sin_identificar") as RevitFila["estado"],
      };
    }).filter((f) => f.metrado > 0 || Boolean(f.codigo));
    return [...mapped, ...extras];
  }, [base, creadas, extras, extraidos, overrides, paquete, plantilla, qtyOverrides]);

  const uniones = useMemo(
    () => (paquete ? unionesPorPartida(filas, paquete, qtyOverrides, extraidos) : []),
    [filas, paquete, qtyOverrides, extraidos],
  );
  const unidasList = useMemo(() => {
    const needle = qFila.trim().toLowerCase();
    return uniones.filter((u) => {
      if (!u.codigo) return false;
      if (!needle) return true;
      return `${u.codigo} ${u.descripcion} ${u.roles.map((r) => ROL_LABEL[r]).join(" ")} ${CAMPO_LABEL[u.campo]}`.toLowerCase().includes(needle);
    });
  }, [uniones, qFila]);
  const elementosLibres = useMemo(() => {
    const needle = qLibre.trim().toLowerCase();
    const rows = uniones
      .filter((u) => !u.codigo)
      .flatMap((u) =>
        u.elementos.map((e) => ({
          key: claveExclusion(e.grupoId, e.uniqueId, u.campo),
          unionKey: u.key,
          campo: u.campo,
          und: u.und,
          rol: u.rol,
          ...e,
        })),
      );
    if (!needle) return rows;
    return rows.filter((e) =>
      `${e.marca} ${e.tipo} ${e.nivel} ${e.uniqueId} ${e.familia} ${ROL_LABEL[e.rol]} ${CAMPO_LABEL[e.campo]}`.toLowerCase().includes(needle),
    );
  }, [uniones, qLibre]);

  const sem = useMemo(() => semaforo(filas), [filas]);
  const activa = uniones.find((u) => u.key === sel) ?? unidasList[0] ?? null;
  const libreActivo = elementosLibres.find((e) => e.key === selLibre) ?? null;
  const grupoLibreRestante = libreActivo ? uniones.find((u) => u.key === libreActivo.unionKey) : null;
  const rolResumen = useMemo(() => (activa ? resumenRol(filas, activa.roles) : []), [filas, activa]);

  const similaresLibre = useMemo(() => {
    if (!libreActivo) return [];
    return partidasSimilares({
      familia: libreActivo.familia,
      tipo: libreActivo.tipo,
      rol: libreActivo.rol,
      campo: libreActivo.campo,
      und: libreActivo.und,
    });
  }, [libreActivo]);

  const partidasCatalogo = useMemo(() => {
    const needle = qPartida.trim().toLowerCase();
    const dePlantilla = new Set(plantilla?.lineas.map((l) => l.codigo) ?? []);
    const pool = PARTIDAS.filter((p) => {
      if (!needle) return dePlantilla.has(p.codigo) || p.especialidad === "estructuras";
      return `${p.codigo} ${p.descripcion} ${p.capitulo}`.toLowerCase().includes(needle);
    });
    return pool.slice(0, 40);
  }, [qPartida, plantilla]);

  function elegirPlantilla(id: string) {
    setPlantillaId(id);
    setErr("");
    setOk("");
    setPaso("conexion");
  }

  function exigirProParaImportar() {
    if (plansLive && !isPro) {
      setAvisoPro(true);
      setErr("Para importar elementos se requiere Plan Pro activo.");
      return false;
    }
    return true;
  }

  async function refrescarEnlace() {
    const token = session?.access_token;
    if (!token) {
      setEnlace(null);
      return;
    }
    try {
      const next = await estadoEnlaceRevit(token);
      setEnlace(next);
      if (next?.code) setCodigoLive(next.code);
    } catch {
      /* el estado se reintenta solo */
    }
  }

  useEffect(() => {
    if (!session?.access_token) {
      setEnlace(null);
      return;
    }
    void refrescarEnlace();
    const t = window.setInterval(() => {
      void refrescarEnlace();
    }, 5000);
    return () => window.clearInterval(t);
  }, [session?.access_token]);

  async function cargarArchivo(file: File) {
    setErr("");
    setOk("");
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const next = parsePaquete(raw);
      if (!next.grupos.length) throw new Error("El archivo no trae grupos de elementos.");
      setPaquete(next);
      setOrigen("archivo");
      setOverrides({});
      setQtyOverrides({});
      setExtras([]);
      setExtraidos([]);
      setCreadas([]);
      setSel("");
      setSelLibre("");
      setZona("unidas");
      setUnirAbierto(false);
      setUnirRestantes(false);
      setPaso("union");
      setOk(`${next.grupos.reduce((s, g) => s + (g.elementos?.length || g.nElementos), 0)} elementos leídos del modelo.`);
    } catch (e) {
      setPaquete(null);
      setErr(e instanceof Error ? e.message : "No se pudo leer el archivo .mcrevit.json.");
    }
  }

  async function pedirCodigo() {
    setErr("");
    setLiveMsg("");
    try {
      const token = session?.access_token;
      if (!token) throw new Error("Inicie sesión con Google para conectar el plugin a su cuenta.");
      const r = await generarCodigoRevit(token);
      setCodigoLive(r.code);
      setLiveMsg("Código listo. En Revit: panel MemoriaCalc → Conectar. El estado de la cuenta se actualiza solo.");
      await refrescarEnlace();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo generar el código.");
    }
  }

  async function importarElementos() {
    setErr("");
    setAvisoPro(false);
    if (!exigirProParaImportar()) return;
    try {
      const token = session?.access_token;
      if (!token) throw new Error("Inicie sesión para importar los elementos de su cuenta.");
      const got = await importarElementosRevit(token);
      if (!got) {
        setLiveMsg("El plugin aún no ha sincronizado un modelo. En Revit: Analizar y Sincronizar.");
        return;
      }
      const next = parsePaquete(got.paquete);
      if (!next.grupos.length) throw new Error("El paquete sincronizado no trae grupos.");
      setPaquete(next);
      setOrigen("archivo");
      setOverrides({});
      setQtyOverrides({});
      setExtras([]);
      setExtraidos([]);
      setCreadas([]);
      setSel("");
      setPaso("union");
      setOk(
        `${next.grupos.reduce((s, g) => s + (g.elementos?.length || g.nElementos), 0)} elementos importados desde Revit.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron importar los elementos.";
      if (msg.toLowerCase().includes("plan pro")) setAvisoPro(true);
      setErr(msg);
    }
  }

  function cargarDemo() {
    const next = paqueteDemoVivienda();
    setPaquete(next);
    setOrigen("demo");
    setOverrides({});
    setQtyOverrides({});
    setExtras([]);
    setExtraidos([]);
    setCreadas([]);
    setSel("");
    setSelLibre("X1|X1-01|area_planta_m2");
    setZona("libres");
    setUnirAbierto(false);
    setUnirRestantes(false);
    setErr("");
    setPaso("union");
    setOk(
      "Modelo de ensayo cargado. Zona 1: elementos ya unidos a una partida. Zona 2: los que el add-in no clasificó — copie al menos dos similares o cree una partida nueva.",
    );
  }

  function patchCodigo(unionKey: string, codigo: string | null) {
    const u = uniones.find((x) => x.key === unionKey);
    if (!u) return;
    setOverrides((prev) => {
      const next = { ...prev };
      for (const f of u.filas) next[f.id] = { codigo };
      return next;
    });
  }

  function patchCantidad(grupoId: string, uniqueId: string, campo: string, valor: number) {
    setQtyOverrides((prev) => ({ ...prev, [`${grupoId}|${uniqueId}|${campo}`]: valor }));
  }

  function anadirPartida(codigo: string) {
    const part = partidaDe(codigo, creadas);
    if (!part || !activa) return;
    if (!activa.codigo || activa.codigo === codigo) {
      patchCodigo(activa.key, codigo);
      setQPartida("");
      setOk(`${part.codigo} recibe el ${CAMPO_LABEL[activa.campo].toLowerCase()} de ${activa.nElementos} elemento${activa.nElementos === 1 ? "" : "s"}.`);
      return;
    }
    const ancla = activa.filas[0];
    const id = `extra-${ancla?.grupoId || "x"}-${codigo}-${Date.now()}`;
    setExtras((prev) => [
      ...prev,
      {
        id,
        grupoId: ancla?.grupoId ?? "",
        campo: activa.campo,
        rol: activa.rol,
        familia: ancla?.familia ?? "",
        tipo: ancla?.tipo ?? "",
        nivel: ancla?.nivel ?? "",
        und: part.und,
        metrado: activa.metrado || 1,
        codigo,
        descripcion: part.descripcion,
        estado: "aceptada",
        motivo: "Partida añadida a mano. El metrado sigue siendo el del modelo.",
        uniqueIds: activa.elementos.map((e) => e.uniqueId),
        enPlantilla: Boolean(plantilla?.lineas.some((l) => l.codigo === codigo)),
      },
    ]);
    setSel(`${codigo}|${activa.campo}`);
    setQPartida("");
    setOk(`${part.codigo} añadida. El metrado es el del modelo.`);
  }

  function unirElementoLibre(codigo: string) {
    if (unirRestantes && grupoLibreRestante && grupoLibreRestante.nElementos > 1) {
      unirGrupoLibre(codigo);
      return;
    }
    const part = partidaDe(codigo, creadas);
    if (!part || !libreActivo || !paquete) return;
    const g = paquete.grupos.find((x) => x.grupoId === libreActivo.grupoId);
    const el = g ? elementosDeGrupo(g).find((x) => x.uniqueId === libreActivo.uniqueId) : undefined;
    const qty = el ? cantidadElemento(el, libreActivo.campo, libreActivo.grupoId, qtyOverrides) : libreActivo.cantidad;
    const clave = claveExclusion(libreActivo.grupoId, libreActivo.uniqueId, libreActivo.campo);
    const id = `extra-${clave}-${codigo}`;
    setExtras((prev) => [
      ...prev.filter((f) => f.id !== id),
      {
        id,
        grupoId: libreActivo.grupoId,
        campo: libreActivo.campo,
        rol: libreActivo.rol,
        familia: libreActivo.familia,
        tipo: libreActivo.tipo,
        nivel: libreActivo.nivel,
        und: part.und,
        metrado: qty,
        codigo,
        descripcion: part.descripcion,
        estado: "aceptada",
        motivo: `Elemento ${libreActivo.marca} unido a mano.`,
        uniqueIds: [libreActivo.uniqueId],
        enPlantilla: Boolean(plantilla?.lineas.some((l) => l.codigo === codigo)),
      },
    ]);
    setExtraidos((prev) => (prev.includes(clave) ? prev : [...prev, clave]));
    setSel(`${codigo}|${libreActivo.campo}`);
    setZona("unidas");
    setUnirAbierto(false);
    setQPartida("");
    setOk(`${libreActivo.marca} quedó unido a ${part.codigo}. El metrado ${fmt(qty, part.und)} entra al cronograma.`);
  }

  function unirGrupoLibre(codigo: string) {
    const part = partidaDe(codigo, creadas);
    if (!part || !grupoLibreRestante) return;
    patchCodigo(grupoLibreRestante.key, codigo);
    setSel(`${codigo}|${grupoLibreRestante.campo}`);
    setZona("unidas");
    setUnirAbierto(false);
    setQPartida("");
    setOk(
      `${part.codigo} recibe ${grupoLibreRestante.nElementos} elemento${grupoLibreRestante.nElementos === 1 ? "" : "s"} restantes (${CAMPO_LABEL[grupoLibreRestante.campo].toLowerCase()}).`,
    );
  }

  function lineasUsadas() {
    return [
      ...creadas.map((c) => ({ id: c.codigo, codigo: c.codigo, metrado: 0 })),
      ...extras.filter((e) => e.codigo).map((e) => ({ id: e.id, codigo: e.codigo as string, metrado: 0 })),
    ];
  }

  function unirElementoLibreCon(part: Partida, origenCodigo?: string) {
    if (!libreActivo || !paquete) return;
    const g = paquete.grupos.find((x) => x.grupoId === libreActivo.grupoId);
    const el = g ? elementosDeGrupo(g).find((x) => x.uniqueId === libreActivo.uniqueId) : undefined;
    const qty = el ? cantidadElemento(el, libreActivo.campo, libreActivo.grupoId, qtyOverrides) : libreActivo.cantidad;
    const clave = claveExclusion(libreActivo.grupoId, libreActivo.uniqueId, libreActivo.campo);
    const id = `extra-${clave}-${part.codigo}`;
    setExtras((prev) => [
      ...prev.filter((f) => f.id !== id),
      {
        id,
        grupoId: libreActivo.grupoId,
        campo: libreActivo.campo,
        rol: libreActivo.rol,
        familia: libreActivo.familia,
        tipo: libreActivo.tipo,
        nivel: libreActivo.nivel,
        und: part.und,
        metrado: qty,
        codigo: part.codigo,
        descripcion: part.descripcion,
        origenCodigo: origenCodigo || part.codigo,
        estado: "aceptada",
        motivo: origenCodigo
          ? `Elemento ${libreActivo.marca} unido a partida de obra copiada de ${origenCodigo}.`
          : `Elemento ${libreActivo.marca} unido a mano.`,
        uniqueIds: [libreActivo.uniqueId],
        enPlantilla: Boolean(plantilla?.lineas.some((l) => l.codigo === part.codigo)),
      },
    ]);
    setExtraidos((prev) => (prev.includes(clave) ? prev : [...prev, clave]));
    setSel(`${part.codigo}|${libreActivo.campo}`);
    setZona("unidas");
    setUnirAbierto(false);
    setCrearAbierto(false);
    setQPartida("");
    setOk(`${libreActivo.marca} quedó unido a ${part.codigo}. El metrado ${fmt(qty, part.und)} entra al cronograma.`);
  }

  function copiarSimilar(origen: Partida) {
    if (!libreActivo) return;
    const codigo = siguienteCodigoPartida(origen.codigo, lineasUsadas());
    const nueva: Partida = { ...origen, codigo, descripcion: origen.descripcion };
    setCreadas((prev) => [...prev.filter((p) => p.codigo !== codigo), nueva]);
    unirElementoLibreCon(nueva, origen.codigo);
  }

  function abrirCrear(origen?: Partida) {
    const base = origen ?? similaresLibre[0];
    setCrearOrigen(base?.codigo ?? "");
    setCrearDesc(base ? `${base.descripcion}` : libreActivo ? `${libreActivo.familia} ${libreActivo.tipo}`.trim() : "");
    setCrearAbierto(true);
    setUnirAbierto(false);
  }

  function confirmarCrearPartida() {
    const origen = partidaDe(crearOrigen, creadas) ?? similaresLibre[0];
    if (!origen || !libreActivo) {
      setErr("Elija una partida similar como base del APU. La partida nueva copia su receta.");
      return;
    }
    const codigo = siguienteCodigoPartida(origen.codigo, lineasUsadas());
    const desc = crearDesc.trim() || origen.descripcion;
    const nueva: Partida = { ...origen, codigo, descripcion: desc, und: libreActivo.und || origen.und };
    setCreadas((prev) => [...prev.filter((p) => p.codigo !== codigo), nueva]);
    unirElementoLibreCon(nueva, origen.codigo);
  }

  function cargarPresupuesto(destino: "cronograma" | "presupuestos" = "cronograma") {
    if (!paquete || !plantillaId) return;
    const next = aplicarVinculosAlPresupuesto(plantillaId, filas, paquete);
    if (paquete.obra?.nombre) next.obra = paquete.obra.nombre;
    savePresupuesto(next);
    const nCrono = next.cronograma?.tasks.filter((t) => t.partidaCodigo).length ?? 0;
    setOk(
      `Presupuesto cargado. El cronograma se armó con ${nCrono} partida${nCrono === 1 ? "" : "s"} que tienen metrado del modelo.`,
    );
    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: destino } }));
  }

  const nElementosModelo = paquete?.grupos.reduce((s, g) => s + (g.elementos?.length || g.nElementos), 0) ?? 0;
  const unidos = uniones.filter((u) => u.codigo && u.metrado > 0).length;

  if (!ready) {
    return (
      <div className="rvt">
        <header className="rvt-head">
          <p className="doc-kicker">PRE-0R · modelo BIM</p>
          <h2>Vincular con Revit</h2>
        </header>
        <p className="rvt-hint" style={{ padding: "24px 32px" }}>Comprobando la cuenta y el plan…</p>
      </div>
    );
  }

  return (
    <div className="rvt">
      <header className="rvt-head">
        <div className="rvt-head-bar">
          <div>
            <p className="doc-kicker">PRE-0R · modelo BIM · RN Metrados</p>
            <h2>Vincular con Revit</h2>
          </div>
          <div className="rvt-addin">
            <label>
              Año de Revit
              <select value={year} onChange={(e) => setYear(Number(e.target.value) as RevitYear)}>
                {REVIT_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <div className="rvt-addin-btns">
              <a className="rvt-btn rvt-addin-dl" href={downloadHref(rel, year)} download="MemoriaCalc.Revit.Setup.exe">
                Descargar instalador
              </a>
              <button type="button" className="rvt-ghost rvt-addin-guide" onClick={() => setGuia(true)}>
                Instalación
              </button>
            </div>
            <small>Plugin {rel.version} para Revit {year}. Cualquiera puede instalarlo; la cuenta se conecta con un código.</small>
          </div>
        </div>
        <p>
          Dos zonas: partidas ya unidas al modelo, y elementos que el add-in no pudo clasificar. Cada pieza suelta se
          une a una partida del catálogo; el cronograma de obra se arma solo con esas partidas y sus metrados reales.
        </p>
        <div className="rvt-nav-row">
          <ol className="rvt-steps" aria-label="Pasos">
            <li className={paso === "plantilla" ? "on" : plantillaId ? "done" : ""}>
              <b>1</b> Plantilla
            </li>
            <li className={paso === "conexion" ? "on" : paquete ? "done" : ""}>
              <b>2</b> Conexión
            </li>
            <li className={paso === "union" ? "on" : ""}>
              <b>3</b> Desglose del modelo
            </li>
          </ol>
          <div className="rvt-link-status" aria-live="polite">
            <div>
              <i className={user ? "on" : ""} />
              <b>Cuenta</b>
              <span>{user?.email || "Sin sesión"}</span>
              {!user ? (
                <button type="button" onClick={openGoogle}>
                  Iniciar sesión
                </button>
              ) : null}
            </div>
            <div>
              <i className={enlace?.plugin === "conectado" || enlace?.sincronizadoEn ? "on" : enlace?.plugin === "esperando" ? "wait" : ""} />
              <b>Plugin</b>
              <span>{textoPlugin(enlace, Boolean(user))}</span>
            </div>
            {enlace?.sincronizadoEn ? (
              <div className="rvt-sync-ok">
                <i className="on" />
                <b>Sincronizado</b>
                <span>
                  {enlace.archivo || "Modelo Revit"}
                  {enlace.elementos ? ` · ${enlace.elementos} elementos` : ""}
                  {cuando(enlace.sincronizadoEn) ? ` · ${cuando(enlace.sincronizadoEn)}` : ""}
                </span>
              </div>
            ) : (
              <div>
                <i />
                <b>Sincronizado</b>
                <span>Aún no. En Revit: Analizar y Sincronizar.</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {err ? <p className="rvt-msg err">{err}</p> : null}
      {ok && paso !== "union" ? <p className="rvt-msg ok">{ok}</p> : null}

      {paso === "plantilla" ? (
        <section className="rvt-lib-page">
          <div className="pre-lib">
            <div className="pre-col-head">
              <h3>Biblioteca de plantillas</h3>
              <p>
                {PLANTILLAS.length} presupuestos tipo RN Metrados en {grupos.length} rubros. Pulse un rubro para ver sus
                plantillas; pulse de nuevo el mismo rubro para plegarlo. Luego elija la ficha: los metrados no salen de
                aquí, salen de Revit.
              </p>
              <input
                className="pre-search"
                value={qPlantilla}
                onChange={(e) => setQPlantilla(e.target.value)}
                placeholder="Buscar: vivienda, colegio, hospital…"
              />
            </div>
            <div className="pre-lib-rubros" role="tablist" aria-label="Rubros de plantillas">
              {plantillasVisibles.map((g) => (
                <button
                  key={g.categoria}
                  type="button"
                  role="tab"
                  aria-selected={abierta === g.categoria}
                  className={`pre-lib-rubro${abierta === g.categoria ? " on" : ""}`}
                  onClick={() => toggleCategoria(g.categoria)}
                >
                  <span className={`pre-esp-dot pre-lib-${g.categoria}`}>{g.meta.kicker}</span>
                  <strong>{g.meta.label}</strong>
                  <small>{g.items.length}</small>
                </button>
              ))}
            </div>
            {grupoAbierto ? (
              <section className="pre-lib-cat" id={`rvt-lib-${grupoAbierto.categoria}`}>
                <header>
                  <span className={`pre-esp-dot pre-lib-${grupoAbierto.categoria}`}>{grupoAbierto.meta.kicker}</span>
                  <div>
                    <h3>{grupoAbierto.meta.label}</h3>
                    <p>{grupoAbierto.meta.blurb}</p>
                  </div>
                  <small>
                    {grupoAbierto.items.length} plantilla{grupoAbierto.items.length === 1 ? "" : "s"}
                  </small>
                </header>
                <div className="pre-lib-grid">
                  {grupoAbierto.items.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className={`pre-lib-card${plantillaId === pl.id ? " on" : ""}`}
                      onClick={() => elegirPlantilla(pl.id)}
                    >
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
          </div>
        </section>
      ) : null}

      {paso === "conexion" && plantilla ? (
        <section className="rvt-pad">
          <div className="rvt-chosen">
            <div>
              <small>Plantilla elegida</small>
              <strong>{plantilla.nombre}</strong>
              <span>
                {plantilla.obra} · {plantilla.lineas.length} partidas de catálogo
              </span>
            </div>
            <button type="button" className="rvt-ghost" onClick={() => setPaso("plantilla")}>
              Cambiar plantilla
            </button>
          </div>
          <div className="rvt-connect">
            <article>
              <p className="doc-kicker">En vivo</p>
              <h3>Conectar el add-in a su cuenta</h3>
              <p>
                El plugin se enlaza a la misma cuenta Google de esta pestaña. Genere el código, péguelo en el panel de
                Revit y pulse Conectar. Arriba verá si la cuenta y el plugin ya están unidos.
              </p>
              {enlace?.sincronizadoEn ? (
                <p className="rvt-sync-banner">Sincronizado · listo para importar elementos</p>
              ) : null}
              {codigoLive && enlace?.plugin !== "conectado" ? (
                <p className="rvt-code-live">
                  Código <strong>{codigoLive}</strong>
                </p>
              ) : null}
              {liveMsg ? <p className="rvt-hint">{liveMsg}</p> : null}
              <div className="rvt-side-actions">
                <button type="button" className="rvt-btn" onClick={() => void pedirCodigo()}>
                  Generar código
                </button>
                <button type="button" className="rvt-ghost" onClick={() => void importarElementos()}>
                  Importar elementos
                </button>
              </div>
            </article>
            <article>
              <p className="doc-kicker">Respaldo</p>
              <h3>Cargar paquete del modelo</h3>
              <p>Arrastre o elija el <code>.mcrevit.json</code> que salió del add-in. No se inventan metrados: se leen los del modelo.</p>
              <label className="rvt-file">
                <input
                  type="file"
                  accept=".json,.mcrevit.json,application/json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void cargarArchivo(f);
                    e.target.value = "";
                  }}
                />
                Elegir archivo .mcrevit.json
              </label>
            </article>
            <article>
              <p className="doc-kicker">Opción C</p>
              <h3>Ensayo con modelo de vivienda</h3>
              <p>Nueve zapatas, columnas, vigas, losas y escalera, cada una con su volumen, encofrado y acero.</p>
              <button type="button" className="rvt-btn" onClick={cargarDemo}>
                Cargar modelo de ensayo
              </button>
            </article>
          </div>
        </section>
      ) : null}

      {paso === "union" && plantilla && paquete ? (
        <section className="rvt-union">
          <aside className="rvt-side">
            <div className="rvt-chosen compact">
              <div>
                <small>Plantilla · catálogo</small>
                <strong>{plantilla.nombre}</strong>
                <span>
                  {origen === "demo" ? "Modelo de ensayo" : paquete.revit?.archivo || "Paquete Revit"} · {nElementosModelo} elementos
                </span>
              </div>
              <div className="rvt-side-actions">
                <button type="button" className="rvt-ghost" onClick={() => setPaso("conexion")}>
                  Cambiar conexión
                </button>
                <button type="button" className="rvt-ghost" onClick={() => setPaso("plantilla")}>
                  Cambiar plantilla
                </button>
              </div>
            </div>
            <dl className="rvt-kpi">
              <div>
                <dt>Partidas unidas</dt>
                <dd>{unidos}</dd>
              </div>
              <div>
                <dt>Elementos</dt>
                <dd>{nElementosModelo}</dd>
              </div>
              <div>
                <dt>Identificados</dt>
                <dd>{sem.identificados}</dd>
              </div>
              <div>
                <dt>Sin partida</dt>
                <dd>{elementosLibres.length}</dd>
              </div>
            </dl>

            <section className={`rvt-zone unidas${zona === "unidas" ? " on" : ""}`}>
              <header>
                <p className="doc-kicker">Zona 1</p>
                <h3>Partidas · elementos unidos</h3>
                <span>{unidasList.length}</span>
              </header>
              <div className="rvt-filters">
                <input value={qFila} onChange={(e) => setQFila(e.target.value)} placeholder="Filtrar partida o rol…" />
              </div>
              <ul className="rvt-list">
                {unidasList.length ? (
                  unidasList.map((u) => (
                    <li key={u.key}>
                      <button
                        type="button"
                        className={`rvt-row ${u.estado}${zona === "unidas" && activa?.key === u.key ? " sel" : ""}`}
                        onClick={() => {
                          setZona("unidas");
                          setSel(u.key);
                          setUnirAbierto(false);
                        }}
                      >
                        <span className="rvt-dot" />
                        <span>
                          <b>{u.codigo}</b>
                          <small>
                            {u.descripcion} · {u.roles.map((r) => ROL_LABEL[r]).join(" · ")} · {CAMPO_LABEL[u.campo]}
                          </small>
                        </span>
                        <em>
                          {u.nElementos} el. · {fmt(u.metrado, u.und)}
                        </em>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="rvt-empty">Aún no hay partidas con metrado del modelo.</li>
                )}
              </ul>
            </section>

            <section className={`rvt-zone libres${zona === "libres" ? " on" : ""}`}>
              <header>
                <p className="doc-kicker">Zona 2</p>
                <h3>Elementos no identificados</h3>
                <span>{elementosLibres.length}</span>
              </header>
              <p className="rvt-zone-hint">Pulse un elemento. Al costado verá partidas similares (copiar) y crear partida.</p>
              <div className="rvt-filters">
                <input value={qLibre} onChange={(e) => setQLibre(e.target.value)} placeholder="Filtrar marca, tipo o UniqueId…" />
              </div>
              <ul className="rvt-list">
                {elementosLibres.length ? (
                  elementosLibres.map((e) => (
                    <li key={e.key}>
                      <button
                        type="button"
                        className={`rvt-row sin_identificar${zona === "libres" && selLibre === e.key ? " sel" : ""}`}
                        onClick={() => {
                          setZona("libres");
                          setSelLibre(e.key);
                          setUnirAbierto(false);
                          setUnirRestantes(false);
                          setCrearAbierto(false);
                          setQPartida("");
                        }}
                      >
                        <span className="rvt-dot" />
                        <span>
                          <b>{e.marca}</b>
                          <small>
                            {e.tipo} · {e.nivel || "sin nivel"} · {CAMPO_LABEL[e.campo]} · {ROL_LABEL[e.rol]}
                          </small>
                        </span>
                        <em>{fmt(e.cantidad, e.und)}</em>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="rvt-empty">Todos los elementos del modelo ya tienen partida.</li>
                )}
              </ul>
            </section>
          </aside>

          <div className="rvt-main">
            {ok ? <p className="rvt-msg ok">{ok}</p> : null}
            {zona === "libres" ? (
              !libreActivo ? (
                <p className="rvt-hint">Elija un elemento no identificado en la zona 2. Luego pulse Unir y asígnelo a una partida del catálogo.</p>
              ) : (
                <div className="rvt-libre-grid">
                  <article className="rvt-compare">
                    <header>
                      <p className="doc-kicker">Elemento sin partida</p>
                      <h3>
                        {libreActivo.marca} · {libreActivo.tipo}
                      </h3>
                      <p className="rvt-didactic">
                        El add-in midió {fmt(libreActivo.cantidad, libreActivo.und)} de {CAMPO_LABEL[libreActivo.campo].toLowerCase()}{" "}
                        y no encontró código RN. Únalo a una partida de esta obra; ese metrado entra al presupuesto y al cronograma.
                      </p>
                    </header>
                    <div className="rvt-bridge">
                      <div>
                        <small>Marca / UniqueId</small>
                        <strong>{libreActivo.marca}</strong>
                        <span>
                          <code>{libreActivo.uniqueId}</code>
                        </span>
                      </div>
                      <i />
                      <div>
                        <small>Metrado del modelo</small>
                        <strong>{fmt(libreActivo.cantidad, libreActivo.und)}</strong>
                        <span>
                          {CAMPO_LABEL[libreActivo.campo]} · {libreActivo.nivel || "sin nivel"}
                        </span>
                      </div>
                      <i />
                      <div>
                        <small>Familia Revit</small>
                        <strong>{libreActivo.familia}</strong>
                        <span>{ROL_LABEL[libreActivo.rol]}</span>
                      </div>
                    </div>
                    {grupoLibreRestante && grupoLibreRestante.nElementos > 1 ? (
                      <p className="rvt-hint">
                        Quedan {grupoLibreRestante.nElementos} piezas del mismo grupo. Puede unir solo esta o las {grupoLibreRestante.nElementos} a la misma partida.
                      </p>
                    ) : null}
                  </article>
                  <aside className="rvt-unir-pane">
                    <p className="doc-kicker">Acción</p>
                    <h3>Compatibilizar</h3>
                    <p>
                      Este UniqueId no trajo código RN. Copie una partida similar (se crea un código de obra y se
                      conserva el APU) o cree una partida nueva. El metrado no se inventa: es el de este elemento.
                    </p>

                    <p className="rvt-subk">Partidas similares · {similaresLibre.length} sugeridas (mínimo 2)</p>
                    <p className="rvt-mini">
                      Misma unidad ({libreActivo.und}) y oficio cercano a {ROL_LABEL[libreActivo.rol].toLowerCase()} /{" "}
                      {libreActivo.familia || "la familia Revit"}. Pulse una para copiar su APU, crear un código de
                      obra y unir este UniqueId. El catálogo RN no se modifica.
                    </p>
                    <ul className="rvt-partidas rvt-similares">
                      {similaresLibre.slice(0, 6).map((p) => (
                        <li key={p.codigo}>
                          <button type="button" onClick={() => copiarSimilar(p)}>
                            <b>{p.codigo}</b>
                            <span>{p.descripcion}</span>
                            <em>
                              {p.und} · copiar similar y unir
                            </em>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {similaresLibre.length < 2 ? (
                      <p className="rvt-hint">No hay dos similares con esta unidad. Use crear partida o busque en el catálogo.</p>
                    ) : null}

                    <div className="rvt-unir-actions">
                      <button type="button" className="rvt-btn" onClick={() => abrirCrear(similaresLibre[0])}>
                        Crear partida
                      </button>
                      <button
                        type="button"
                        className="rvt-ghost"
                        onClick={() => {
                          setUnirAbierto((v) => !v);
                          setCrearAbierto(false);
                        }}
                      >
                        {unirAbierto ? "Cerrar catálogo" : "Unir a otra del catálogo"}
                      </button>
                    </div>

                    {crearAbierto ? (
                      <div className="rvt-crear">
                        <p className="rvt-subk">Nueva partida de obra</p>
                        <p className="rvt-mini">
                          El APU se copia de una similar. Luego puede editar insumos en PRE-01. El catálogo RN no se
                          modifica.
                        </p>
                        <label>
                          Nombre de la partida
                          <input value={crearDesc} onChange={(e) => setCrearDesc(e.target.value)} placeholder="Descripción de obra" />
                        </label>
                        <label>
                          Copiar APU de
                          <select value={crearOrigen} onChange={(e) => setCrearOrigen(e.target.value)}>
                            {similaresLibre.map((p) => (
                              <option key={p.codigo} value={p.codigo}>
                                {p.codigo} · {p.descripcion}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="rvt-mini">
                          Unidad {libreActivo.und} · código nuevo al confirmar (p. ej. {similaresLibre[0]?.codigo}-2)
                        </p>
                        <button type="button" className="rvt-btn" onClick={confirmarCrearPartida}>
                          Crear y unir este elemento
                        </button>
                      </div>
                    ) : null}

                    {unirAbierto ? (
                      <>
                        <input
                          value={qPartida}
                          onChange={(e) => setQPartida(e.target.value)}
                          placeholder="Buscar partida: albañilería, muro, concreto…"
                        />
                        {grupoLibreRestante && grupoLibreRestante.nElementos > 1 ? (
                          <label className="rvt-check">
                            <input type="checkbox" checked={unirRestantes} onChange={(e) => setUnirRestantes(e.target.checked)} />
                            Unir también las {grupoLibreRestante.nElementos} piezas restantes de este grupo
                          </label>
                        ) : null}
                        <ul className="rvt-partidas">
                          {partidasCatalogo.map((p) => (
                            <li key={p.codigo}>
                              <button type="button" onClick={() => unirElementoLibre(p.codigo)}>
                                <b>{p.codigo}</b>
                                <span>{p.descripcion}</span>
                                <em>
                                  {p.und}
                                  {plantilla?.lineas.some((l) => l.codigo === p.codigo) ? " · en plantilla" : ""}
                                </em>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </aside>
                </div>
              )
            ) : !activa ? (
              <p className="rvt-hint">No hay partidas unidas. Revise la zona 2 o cargue de nuevo el modelo.</p>
            ) : (
              <>
                <article className="rvt-compare">
                  <header>
                    <p className="doc-kicker">Partida ← elementos del modelo</p>
                    <h3>{activa.codigo ? `${activa.codigo} · ${activa.descripcion}` : activa.descripcion}</h3>
                    <p className="rvt-didactic">
                      Esta partida recibe el {CAMPO_LABEL[activa.campo].toLowerCase()} de{" "}
                      <strong>
                        {activa.nElementos} elemento{activa.nElementos === 1 ? "" : "s"} ({rolesTxt(activa.roles)})
                      </strong>{" "}
                      del RVT. La plantilla no aporta metrado: solo el código RN.
                    </p>
                  </header>
                  <div className="rvt-bridge">
                    <div>
                      <small>Elementos asociados</small>
                      <strong>
                        {activa.nElementos} elemento{activa.nElementos === 1 ? "" : "s"}
                      </strong>
                      <span>
                        {rolesTxt(activa.roles)}
                        {[...new Set(activa.elementos.map((e) => e.tipo))].length
                          ? ` · ${[...new Set(activa.elementos.map((e) => e.tipo))].join(" · ")}`
                          : ""}
                      </span>
                    </div>
                    <i />
                    <div>
                      <small>Total del modelo</small>
                      <strong>{fmt(activa.metrado, activa.und)}</strong>
                      <span>
                        Suma de {CAMPO_LABEL[activa.campo].toLowerCase()} · este número se carga
                      </span>
                    </div>
                    <i />
                    <div>
                      <small>Partida RN</small>
                      <strong>{activa.codigo ?? "Sin unir"}</strong>
                      <span>{ESTADO[activa.estado]}</span>
                    </div>
                  </div>

                  {rolResumen.length > 1 ? (
                    <div className="rvt-role">
                      <p>
                        Totales del modelo para <strong>{rolesTxt(activa.roles)}</strong>
                      </p>
                      <div>
                        {rolResumen.map((r) => (
                          <button
                            key={r.campo}
                            type="button"
                            className={r.campo === activa.campo ? "on" : ""}
                            onClick={() => {
                              const dest = uniones.find((u) => u.campo === r.campo && u.roles.some((rol) => activa.roles.includes(rol)));
                              if (dest) setSel(dest.key);
                            }}
                          >
                            <small>{r.label}</small>
                            <strong>{fmt(r.metrado, r.und)}</strong>
                            <span>{r.codigo ?? "sin partida"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>

                <article className="rvt-edit">
                  <h3>Desglose de cada elemento</h3>
                  <p className="rvt-hint">
                    Revise el {CAMPO_LABEL[activa.campo].toLowerCase()} de cada elemento. Si
                    el add-in midió mal una pieza, corrija esa línea: el total de la partida se recalcula solo.
                  </p>
                  <div className="rvt-table-wrap">
                    <table className="rvt-els">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Marca</th>
                          <th>Tipo</th>
                          <th>Nivel</th>
                          <th>UniqueId</th>
                          <th>{CAMPO_LABEL[activa.campo]}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activa.elementos.map((e, i) => (
                          <tr key={`${e.grupoId}-${e.uniqueId}`}>
                            <td>{i + 1}</td>
                            <td>{e.marca}</td>
                            <td>{e.tipo}</td>
                            <td>{e.nivel || "—"}</td>
                            <td>
                              <code>{e.uniqueId}</code>
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={e.cantidad}
                                onChange={(ev) => patchCantidad(e.grupoId, e.uniqueId, activa.campo, Number(ev.target.value) || 0)}
                              />{" "}
                              {activa.und}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5}>Total que se conecta a {activa.codigo ?? "la partida"}</td>
                          <td>
                            <strong>{fmt(activa.metrado, activa.und)}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </article>

                <article className="rvt-edit">
                  <h3>Cambiar o añadir partida</h3>
                  <p className="rvt-hint">
                    El total {fmt(activa.metrado, activa.und)} queda unido al código que elija. No se usa el metrado
                    semilla de la plantilla.
                  </p>
                  <label className="rvt-code">
                    Código de partida
                    <input
                      value={activa.codigo ?? ""}
                      onChange={(e) => patchCodigo(activa.key, e.target.value.trim() || null)}
                      placeholder="EST-04.01.01"
                    />
                  </label>
                  <div className="rvt-side-actions" style={{ margin: "10px 0" }}>
                    <button type="button" className="rvt-ghost" onClick={() => patchCodigo(activa.key, null)}>
                      Desvincular partida
                    </button>
                  </div>
                  <input
                    value={qPartida}
                    onChange={(e) => setQPartida(e.target.value)}
                    placeholder="Buscar en catálogo: concreto zapatas, acero columnas…"
                  />
                  <ul className="rvt-partidas">
                    {partidasCatalogo.map((p) => (
                      <li key={p.codigo}>
                        <button type="button" onClick={() => anadirPartida(p.codigo)}>
                          <b>{p.codigo}</b>
                          <span>{p.descripcion}</span>
                          <em>
                            {p.und}
                            {plantilla.lineas.some((l) => l.codigo === p.codigo) ? " · en plantilla" : ""}
                          </em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              </>
            )}
          </div>

          <footer className="rvt-foot">
            <div>
              <strong>
                {unidos} partida{unidos === 1 ? "" : "s"} con metrado del modelo
              </strong>
              <span>
                El cronograma (PRE-03) se crea solo con estas partidas: duración por rendimiento del APU, secuencia de
                obra y sin semilla vacía de plantilla.
              </span>
            </div>
            <div className="rvt-foot-actions">
              <button type="button" className="rvt-ghost" disabled={!unidos} onClick={() => cargarPresupuesto("presupuestos")}>
                Solo presupuesto
              </button>
              <button type="button" className="rvt-btn" disabled={!unidos} onClick={() => cargarPresupuesto("cronograma")}>
                Cargar presupuesto y cronograma
              </button>
            </div>
          </footer>
        </section>
      ) : null}

      {guia ? (
        <div className="rvt-modal-back" role="presentation" onClick={() => setGuia(false)}>
          <div
            className="rvt-modal"
            role="dialog"
            aria-labelledby="rvt-guia-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="doc-kicker">Plugin {rel.version} · Revit {year}</p>
            <h3 id="rvt-guia-title">Instalación del add-in</h3>
            <p>
              Siga este orden. El instalador solo registra el plugin en Revit. La cuenta se conecta después, desde
              esta pestaña, con un código.
            </p>
            <ol className="rvt-ol">
              <li>
                Pulse <strong>Descargar instalador</strong> y elija el año de Revit ({REVIT_YEARS.join(", ")}).
              </li>
              <li>Cierre Autodesk Revit si está abierto. El add-in se carga al iniciar, no en caliente.</li>
              <li>
                Ejecute <code>MemoriaCalc.Revit.Setup.exe</code>. Si Windows SmartScreen pregunta, elija más
                información y ejecutar de todos modos. No pide administrador.
              </li>
              <li>En el instalador pulse <strong>Instalar plugin</strong>. Queda en su perfil de Windows.</li>
              <li>Abra Revit y el archivo <code>.rvt</code> de la obra.</li>
              <li>
                En la cinta <strong>MemoriaCalc</strong> pulse <strong>Mostrar panel</strong>. Debe aparecer el
                Conector BIM a la derecha, en estado desconectado.
              </li>
              <li>Vuelva a esta pestaña, inicie sesión con Google y pulse <strong>Generar código</strong>.</li>
              <li>
                Pegue el código de seis dígitos en el panel de Revit y pulse <strong>Conectar</strong>. Arriba, la
                franja debe pasar a <strong>Plugin · Conectado a esta cuenta</strong>.
              </li>
              <li>
                En Revit: <strong>Analizar modelo</strong> y <strong>Sincronizar</strong>. Esta pestaña mostrará
                <strong> Sincronizado</strong> con el nombre del archivo y la hora.
              </li>
              <li>
                Pulse <strong>Importar elementos</strong> para traer UniqueId y metrados al desglose.
                {plansLive
                  ? " Ese botón es el que exige Plan Pro activo."
                  : " Mientras los planes no operen, importar es gratuito."}
              </li>
            </ol>
            <footer>
              <a className="rvt-btn" href={downloadHref(rel, year)} download="MemoriaCalc.Revit.Setup.exe">
                Descargar instalador
              </a>
              <button type="button" className="rvt-ghost" onClick={() => setGuia(false)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {avisoPro ? (
        <div className="rvt-modal-back" role="presentation" onClick={() => setAvisoPro(false)}>
          <div className="rvt-modal rvt-modal-sm" role="dialog" aria-labelledby="rvt-pro-title" onClick={(e) => e.stopPropagation()}>
            <p className="doc-kicker">Plan Pro</p>
            <h3 id="rvt-pro-title">Importar elementos</h3>
            <p>
              El plugin ya puede estar instalado y conectado a su cuenta. Traer los elementos del modelo a esta
              pestaña queda reservado al Plan Pro cuando los planes operan.
            </p>
            <footer>
              {!user ? (
                <button type="button" className="rvt-btn" onClick={openGoogle}>
                  Iniciar sesión
                </button>
              ) : (
                <button
                  type="button"
                  className="rvt-btn"
                  onClick={() => {
                    setAvisoPro(false);
                    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "planes" } }));
                  }}
                >
                  Ver planes
                </button>
              )}
              <button type="button" className="rvt-ghost" onClick={() => setAvisoPro(false)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
