import { useEffect, useMemo, useState } from "react";
import { CanaletaModule } from "./modules/CanaletaModule";
import { CanalModule } from "./modules/CanalModule";
import { SifonModule } from "./modules/SifonModule";
import { AlcantarillaModule } from "./modules/AlcantarillaModule";
import { CunetaModule } from "./modules/CunetaModule";
import { HidroPackModule } from "./modules/HidroPackModule";
import type { HidroPackKind } from "./lib/hidro/pack";
import { HidrologicoModule } from "./modules/HidrologicoModule";
import { TasacionModule } from "./modules/TasacionModule";
import { ExcelCalcModule } from "./modules/ExcelCalcModule";
import { AcbCaminosModule } from "./modules/AcbCaminosModule";
import { PresupuestoModule } from "./modules/PresupuestoModule";
import { CronogramaModule } from "./modules/CronogramaModule";
import { ValorizacionesModule } from "./modules/ValorizacionesModule";
import { EspecificacionesModule } from "./modules/EspecificacionesModule";
import { ManoObraModule } from "./modules/ManoObraModule";
import { PresupuestoPdfModule } from "./modules/PresupuestoPdfModule";
import { PresupuestosHubPage } from "./modules/PresupuestosHubPage";
import { parsePresuPath, presuHref, type PresuTab } from "./lib/presupuestosHub";
import { RevitVincularModule } from "./modules/RevitVincularModule";
import { MisPresupuestosModule } from "./modules/MisPresupuestosModule";
import { MovTierrasModule } from "./modules/MovTierrasModule";
import { TopoModule } from "./modules/TopoModule";
import { PotableModule } from "./modules/PotableModule";
import { RdapModule } from "./modules/RdapModule";
import { Edificio3dModule } from "./modules/Edificio3dModule";
import { MercadoModule } from "./modules/MercadoModule";
import { PlanesModule } from "./modules/PlanesModule";
import { MODULES, SPECIALTIES } from "./lib/catalog";
import type { PotableKind } from "./lib/saneamiento/potable";
import { AuthBar } from "./ui/AuthBar";
import { AuthModals } from "./ui/AuthModals";
import { ExtractionDebugPanel } from "./ui/ExtractionDebugPanel";
import { ExportAdHost } from "./ui/ExportAdHost";
import { useAuth } from "./ui/AuthProvider";
import { installMobileInputScroll } from "./ui/mobileInputScroll";
import { fetchThreads, unreadCount, subscribePlazaInbox } from "./lib/mercado";

const HIDROLOGIA = [
  { id: "hidro-estudio", code: "HID-13", title: "Estudio general", blurb: "Informe multi-método SENAMHI: avenida, estiaje y entrega profesional." },
  { id: "hidro-puente", code: "HID-13A", title: "Puente / obra de arte", blurb: "Qmáx T=100, N.A.M.E., tirante, velocidad y cota de intradós." },
  { id: "hidro-defensa", code: "HID-13B", title: "Defensa ribereña", blurb: "Qmáx T=50 y N.A.M.E. para enrocado, gaviones o muro." },
  { id: "hidro-baden", code: "HID-13C", title: "Badén / alcantarilla", blurb: "Caudal T=25 y tirante para luz y altura libre." },
  { id: "hidro-mineria", code: "HID-13D", title: "Minería aurífera", blurb: "Qavenida + Qestiaje vs demanda de lavado/beneficio (L/s y m³/día)." },
  { id: "hidro-bocatoma-est", code: "HID-13E", title: "Bocatoma / riego", blurb: "Avenida de protección y caudal capturable en estiaje para concesión." },
  { id: "hidro-industrial", code: "HID-13F", title: "Captación industrial", blurb: "Oferta en estiaje vs demanda operativa de campamento o planta." },
] as const;

const HIDRO = [
  { id: "canaleta", code: "HID-01", title: "Drenaje pluvial", blurb: "Cubiertas y estacionamiento: CE.040, IDF IILA, canaletas con holgura y bajantes." },
  { id: "canal", code: "HID-02", title: "Canal abierto", blurb: "Sección, yn, régimen, borde libre USBR, tracción y sección óptima." },
  { id: "sifon", code: "HID-03", title: "Sifón invertido", blurb: "Pérdidas, velocidad y diámetro del ramal invertido." },
  { id: "alcantarilla-hid", code: "HID-04", title: "Alcantarilla hidráulica", blurb: "Hidrología SENAMHI, Manning y control de entrada/salida FHWA." },
  { id: "cuneta", code: "HID-05", title: "Cuneta", blurb: "Aporte de calzada y talud, IDF SENAMHI y Manning asimétrico." },
  { id: "desarenador", code: "HID-06", title: "Desarenador de riego", blurb: "Cámara de asiento: Vs, planta, vertedero y lavado (Camp / USBR)." },
  { id: "bocatoma", code: "HID-07", title: "Bocatoma", blurb: "Ventana de estiaje y avenida, barraje Creager y remanso." },
  { id: "rapida", code: "HID-08", title: "Rápida y resalto", blurb: "Aproximación, control crítico, rápida, caída escalonada y pozo." },
  { id: "aliviadero", code: "HID-09", title: "Aliviadero lateral", blurb: "Cresta Forchheimer / Weisbach para el excedente del canal." },
  { id: "acueducto", code: "HID-10", title: "Acueducto", blurb: "Canal o tubo sobre depresión; cables si es colgante." },
  { id: "riego", code: "HID-11", title: "Demanda y riego", blurb: "ETo, cédula, caudal de turno y laterales de aspersión, goteo o cinta." },
  { id: "orificio", code: "HID-12", title: "Orificio", blurb: "Gasto libre o sumergido: Torricelli y Cd." },
] as const;

const HIDRO_ESTUDIO: Record<string, import("./lib/hidro/hidrologico").FinalidadEstudio> = {
  "hidro-estudio": "estudio-general",
  "hidro-puente": "puente",
  "hidro-defensa": "defensa-riberena",
  "hidro-baden": "badén-alcantarilla",
  "hidro-mineria": "mineria-aurifera",
  "hidro-bocatoma-est": "bocatoma-riego",
  "hidro-industrial": "captacion-industrial",
};

const HIDRO_PACK: Record<string, HidroPackKind> = {
  desarenador: "desarenador",
  bocatoma: "bocatoma",
  rapida: "rapida",
  aliviadero: "aliviadero",
  acueducto: "acueducto",
  riego: "riego",
  orificio: "orificio",
};

const POTABLE = [
  { id: "ap-dotacion", code: "AP-01", title: "Dotación y caudales", blurb: "Población, Qp, Qmd, Qmh, almacenamiento y contribución al desagüe." },
  { id: "ap-sistema", code: "AP-02", title: "Sistema abierto", blurb: "Fuente, reservorio y conducción Hazen–Williams (OS.100)." },
  { id: "ap-red", code: "AP-09", title: "Diseño de red de agua", blurb: "RDAP mallada o ramificada: plano, superficie TIN, nudos, tuberías, solver e informe." },
  { id: "ap-sedimentador", code: "AP-03", title: "Sedimentador", blurb: "Área AS = Q/VS, L2/B, orificios y vaciado (RNE OS.020)." },
  { id: "ap-prefiltro", code: "AP-04", title: "Prefiltro de grava", blurb: "Tres tramos 3–4 / 2–3 / 1–2 cm y módulo de impedimento." },
  { id: "ap-filtro-lento", code: "AP-05", title: "Filtro lento", blurb: "Área, planta de mínimo costo y corte del lecho." },
  { id: "ap-impulsion", code: "AP-06", title: "Impulsión y bombeo", blurb: "Cisterna, Bresse, Ht y potencia de la bomba." },
  { id: "ap-reservorio", code: "AP-07", title: "Reservorio apoyado", blurb: "Volumen 25 % Qp, b/h y niples IS.010." },
  { id: "ap-cloracion", code: "AP-08", title: "Cloración", blurb: "Hipoclorito, qs, recipiente y orificio de goteo." },
] as const;

const POTABLE_KIND: Record<Exclude<(typeof POTABLE)[number]["id"], "ap-red">, PotableKind> = {
  "ap-dotacion": "dotacion",
  "ap-sistema": "sistema",
  "ap-sedimentador": "sedimentador",
  "ap-prefiltro": "prefiltro",
  "ap-filtro-lento": "filtro-lento",
  "ap-impulsion": "impulsion",
  "ap-reservorio": "reservorio",
  "ap-cloracion": "cloracion",
};

const MOV = [
  { id: "seccion-transversal", code: "MOV-01", title: "Sección transversal", blurb: "Terreno vs rasante, taludes de corte/relleno y áreas por trapecios." },
  { id: "volumenes-tierras", code: "MOV-02", title: "Volúmenes de tierras", blurb: "Áreas medias, esponjamiento, préstamo/desmonte y diagrama de masas." },
] as const;

const TOPO = [
  { id: "taquimetro", code: "TOP-01", title: "Levantamiento taquimétrico", blurb: "Cartera de estadía: Di, ángulos sexagesimales, Dh, Dv, cotas y plano local." },
  { id: "libreta-topo", code: "TOP-02", title: "Libreta de radiación", blurb: "Hilos estadimétricos, radiación, cotas y coordenadas X–Y–Z estación a estación." },
] as const;

type Page = "home" | (typeof HIDROLOGIA)[number]["id"] | (typeof HIDRO)[number]["id"] | (typeof POTABLE)[number]["id"] | (typeof TOPO)[number]["id"] | string;

type HomeChild = { id: string; code: string; title: string; blurb: string };

const HOME_FAMILIES: {
  slug: string;
  title: string;
  kicker: string;
  blurb: string;
  children: HomeChild[];
}[] = [
  {
    slug: "hidrologia",
    title: "Hidrología",
    kicker: "SENAMHI · Manning · SCS · IILA",
    blurb: "Estudios de avenida y estiaje para puente, defensa ribereña, badén, minería, bocatoma e industria. Informe multi-método con hoja de entrega.",
    children: HIDROLOGIA.map((m) => ({ id: m.id, code: m.code, title: m.title, blurb: m.blurb })),
  },
  {
    slug: "hidraulica",
    title: "Hidráulica",
    kicker: "CE.040 · Manning · USBR",
    blurb: "Drenaje pluvial, canales, sifón, alcantarilla, cuneta, desarenador, bocatoma, rápida, aliviadero, acueducto, riego y orificio.",
    children: HIDRO.map((m) => ({ id: m.id, code: m.code, title: m.title, blurb: m.blurb })),
  },
  {
    slug: "agua-potable",
    title: "Agua potable",
    kicker: "RNE OS.100 · OS.020 · OS.030",
    blurb: "Dotación, sistema abierto, diseño de red, sedimentador, prefiltro, filtro lento, impulsión, reservorio y cloración.",
    children: POTABLE.map((m) => ({ id: m.id, code: m.code, title: m.title, blurb: m.blurb })),
  },
  {
    slug: "topografia",
    title: "Topografía",
    kicker: "Taquimetría · radiación",
    blurb: "Cartera de campo, reducción al horizonte, cotas, plano local y perfil del eje.",
    children: TOPO.map((m) => ({ id: m.id, code: m.code, title: m.title, blurb: m.blurb })),
  },
  {
    slug: "mov-tierras",
    title: "Movimiento de tierras",
    kicker: "MTC DG-2018 · áreas medias",
    blurb: "Sección transversal de vía, volúmenes de corte y relleno, y diagrama de masas.",
    children: MOV.map((m) => ({ id: m.id, code: m.code, title: m.title, blurb: m.blurb })),
  },
  {
    slug: "presupuestos",
    title: "Presupuestos",
    kicker: "APU · fórmula polinómica · cronograma",
    blurb: "Análisis de precios unitarios, catálogo CAPECO con índices unificados, reajuste D.S. 011-79-VC y cronograma de obra.",
    children: [
      { id: "hoja-dedicada", code: "PRE", title: "Hoja dedicada", blurb: "Expediente en pantalla propia: pestañas, PDF, Revit, hoja de presupuesto, fórmula, cronograma, EETT y jornales." },
      { id: "presupuesto-pdf", code: "PRE-00", title: "Presupuesto desde PDF", blurb: "PDF por especialidad. El agente revisa primero el catálogo MemoriaCalc y solo entonces metra. No inventa partidas. S/ 4 por hoja (lectura con IA)." },
      { id: "vincular-revit", code: "PRE-0R", title: "Vincular con Revit", blurb: "Elija plantilla, conecte el modelo y una cada elemento con su partida y metrado antes de cargar el presupuesto." },
      { id: "presupuestos", code: "PRE-01", title: "Hoja de Presupuesto", blurb: "Catálogo RN Metrados, APU (MO, materiales, maquinaria y equipos) e insumos con código IU." },
      { id: "mis-presupuestos", code: "PRE-04", title: "Mis presupuestos", blurb: "Biblioteca en la nube e invitaciones a colegas Plan Pro (Culqi: mensual, trimestral o anual)." },
      { id: "formula-polinomica", code: "PRE-02", title: "Fórmula polinómica", blurb: "Incidencias por índice unificado INEI, monomios a–h, factor K y valorización reajustada." },
      { id: "cronograma", code: "PRE-03", title: "Cronograma de obra", blurb: "Desglose de partidas, calendario laboral, feriados, rendimientos: diagrama de Gantt, red PERT-CPM y cronograma valorizado con curva S." },
      { id: "valorizaciones", code: "PRE-07", title: "Valorizaciones", blurb: "Valorizaciones mensuales, bimestrales o trimestrales con adicionales de obra, informe legal del adicional y reajuste por índices unificados." },
      { id: "especificaciones", code: "PRE-05", title: "Especificaciones técnicas", blurb: "Ficha de expediente por partida: descripción del trabajo, alcance, APU, procedimiento, medición, pago y normas. Impresión formal A4." },
      { id: "mano-obra", code: "PRE-06", title: "Mano de obra y jornales", blurb: "Desglose CAPECO–FTCCP del operario, oficial, peón, capataz, topógrafo y operador de maquinaria pesada: BUC, vestimenta, escolaridad, gratificaciones, CTS y aportes." },
    ],
  },
  ...SPECIALTIES.map((s) => ({
    slug: s.slug,
    title: s.title,
    kicker: s.kicker,
    blurb: s.blurb,
    children: MODULES.filter((m) => m.specialty === s.slug).map((m) => ({
      id: m.slug,
      code: m.norma,
      title: m.title,
      blurb: m.short,
    })),
  })),
  {
    slug: "plaza",
    title: "Plaza profesional",
    kicker: "Compras · Mensajes · Publicitar · Planes",
    blurb: "Una sola plaza con Folio PDF: mismos artículos, mismos mensajes, campañas de alcance y Plan Pro.",
    children: [
      { id: "compras", code: "PLA-01", title: "Compras", blurb: "Vitrina compartida con Folio PDF: equipos, software y servicios." },
      { id: "compras-publicar", code: "PLA-02", title: "Publicar", blurb: "Publique aquí y el aviso también aparece en Folio PDF." },
      { id: "mensajes", code: "PLA-03", title: "Mensajes", blurb: "Bandeja única: chats de Folio e Ingeniería en el mismo hilo." },
      { id: "publicitar", code: "PLA-04", title: "Publicitar", blurb: "Campañas de alcance en la plaza compartida Folio · Ingeniería." },
      { id: "planes", code: "PLA-05", title: "Planes", blurb: "Plan Pro mensual, trimestral o anual. Ancla Revit, el add-in y la nube a un solo equipo." },
    ],
  },
];

function Burger({ open }: { open: boolean }) {
  return (
    <span className={`burger ${open ? "is-open" : ""}`} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function specialtyOfPage(page: string, currentSpecialty?: string): string {
  if (currentSpecialty) return currentSpecialty;
  if (HIDROLOGIA.some((m) => m.id === page)) return "hidrologia";
  if (HIDRO.some((m) => m.id === page)) return "hidraulica";
  if (page in POTABLE_KIND || page === "ap-red") return "saneamiento";
  if (TOPO.some((m) => m.id === page)) return "topografia";
  if (MOV.some((m) => m.id === page)) return "mov-tierras";
  if (page === "presupuestos" || page === "formula-polinomica" || page === "cronograma" || page === "valorizaciones" || page === "especificaciones" || page === "mano-obra" || page === "presupuesto-pdf" || page === "mis-presupuestos" || page === "vincular-revit") return "presupuestos";
  if (page === "acb-caminos") return "carreteras";
  if (page === "compras" || page === "compras-publicar" || page === "compras-mios" || page === "mensajes" || page === "publicitar" || page === "planes") return "plaza";
  return "";
}

export default function App() {
  const { canEdit, track, user, plansLive } = useAuth();
  const [page, setPage] = useState<Page>("home");
  const [path, setPath] = useState(() => window.location.pathname);
  const presuTab = parsePresuPath(path);
  const [open, setOpen] = useState<string>("");
  const [homeOpen, setHomeOpen] = useState<string>("");
  const [navOpen, setNavOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const current = useMemo(() => MODULES.find((m) => m.slug === page), [page]);
  const homeFamilies = useMemo(
    () =>
      HOME_FAMILIES.map((s) => {
        if (s.slug !== "plaza") return s;
        return {
          ...s,
          kicker: plansLive ? "Compras · Mensajes · Publicitar · Planes" : "Compras · Mensajes · Publicitar",
          blurb: plansLive
            ? s.blurb
            : "Una sola plaza con Folio PDF: mismos artículos, mismos mensajes y campañas de alcance.",
          children: plansLive ? s.children : s.children.filter((c) => c.id !== "planes"),
        };
      }),
    [plansLive],
  );
  const plaza = page === "compras" || page === "compras-publicar" || page === "compras-mios" || page === "mensajes" || page === "publicitar" || page === "planes";
  const plazaLike = plaza || page === "presupuesto-pdf" || page === "mis-presupuestos" || page === "vincular-revit";
  const fullPage =
    page === "presupuestos" ||
    page === "formula-polinomica" ||
    page === "cronograma" ||
    page === "valorizaciones" ||
    page === "especificaciones" ||
    page === "mano-obra" ||
    page === "presupuesto-pdf" ||
    page === "vincular-revit" ||
    page === "mis-presupuestos" ||
    page === "acb-caminos" ||
    page === "ap-red" ||
    page === "edificio-3d" ||
    plaza;
  const inModule = page !== "home" && !fullPage;
  const drawerOpen = navOpen || panelOpen;

  useEffect(() => {
    if (page === "planes" && !plansLive) {
      setPage("home");
      setNavOpen(false);
      setPanelOpen(false);
    }
  }, [page, plansLive]);

  useEffect(() => {
    track({
      event_type: "view_module",
      module_slug: String(page),
      specialty: specialtyOfPage(String(page), current?.specialty),
    });
    document.documentElement.dataset.mcPage = String(page);
    document.documentElement.dataset.mcSpecialty = specialtyOfPage(String(page), current?.specialty);
  }, [page, current?.specialty, track]);

  useEffect(() => installMobileInputScroll(document), []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let alive = true;
    const load = () => {
      void fetchThreads(user.id)
        .then((rows) => {
          if (alive) setUnread(unreadCount(rows, user.id));
        })
        .catch(() => undefined);
    };
    load();
    const stop = subscribePlazaInbox(() => load());
    const t = window.setInterval(load, 45000);
    return () => {
      alive = false;
      stop();
      window.clearInterval(t);
    };
  }, [user, page]);

  const goPresu = (tab: PresuTab) => {
    const next = presuHref(tab);
    window.history.pushState({}, "", next);
    setPath(next);
    setNavOpen(false);
    setPanelOpen(false);
    setOpen("presupuestos");
    document.title = "Presupuestos · MemoriaCalc";
  };

  const go = (next: Page) => {
    if (next === "home") {
      window.history.pushState({}, "", "/");
      setPath("/");
      document.title = "MemoriaCalc · Memorias de cálculo profesionales";
    }
    setPage(next);
    setNavOpen(false);
    setPanelOpen(false);
    if (next.startsWith("hidro-")) setOpen("hidrologia");
    if (next === "canaleta" || next === "canal" || next === "sifon" || next === "alcantarilla-hid" || next === "cuneta" || next === "desarenador" || next === "bocatoma" || next === "rapida" || next === "aliviadero" || next === "acueducto" || next === "riego" || next === "orificio") {
      setOpen("hidraulica");
    }
    if (next === "compras" || next === "compras-publicar" || next === "compras-mios") setOpen("compras");
    if (next === "presupuesto-pdf" || next === "vincular-revit" || next === "presupuestos" || next === "mis-presupuestos" || next === "formula-polinomica" || next === "cronograma" || next === "valorizaciones" || next === "especificaciones" || next === "mano-obra") {
      setOpen("presupuestos");
    }
  };

  useEffect(() => {
    const onPlaza = (e: Event) => {
      const next = (e as CustomEvent<{ page?: string }>).detail?.page;
      if (next) go(next);
    };
    const onPresu = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: PresuTab }>).detail?.tab;
      if (tab) goPresu(tab);
    };
    window.addEventListener("mcd-go", onPlaza);
    window.addEventListener("mcd-go-presu", onPresu);
    return () => {
      window.removeEventListener("mcd-go", onPlaza);
      window.removeEventListener("mcd-go-presu", onPresu);
    };
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const h = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
      if (!h) return;
      go(h);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1101px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setNavOpen(false);
        setPanelOpen(false);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeDrawers = () => {
    setNavOpen(false);
    setPanelOpen(false);
  };

  if (presuTab) {
    return (
      <>
        <PresupuestosHubPage tab={presuTab} onTab={goPresu} onBack={() => go("home")} />
        <AuthModals />
        <ExtractionDebugPanel />
        <ExportAdHost />
      </>
    );
  }

  return (
    <div className={`app${navOpen ? " nav-open" : ""}${panelOpen ? " panel-open" : ""}${inModule ? " has-module" : ""}${canEdit ? "" : " is-guest"}`}>
      <span className="app-signature" aria-hidden="true">by JRSC</span>
      <header className="mobile-chrome">
        <button
          type="button"
          className={`burger-btn${navOpen ? " is-open" : ""}`}
          aria-label={navOpen ? "Cerrar menú de especialidades" : "Abrir menú de especialidades"}
          aria-expanded={navOpen}
          aria-controls="app-nav"
          onClick={() => {
            setNavOpen((v) => !v);
            setPanelOpen(false);
          }}
        >
          <Burger open={navOpen} />
          <span className="burger-cap">Menú</span>
        </button>
        <button type="button" className="mobile-chrome-title" onClick={() => go("home")}>
          MemoriaCalc
        </button>
        {inModule ? (
          <button
            type="button"
            className={`burger-btn burger-btn-right${panelOpen ? " is-open" : ""}`}
            aria-label={panelOpen ? "Cerrar datos de cálculo" : "Abrir datos de cálculo"}
            aria-expanded={panelOpen}
            aria-controls="app-panel"
            onClick={() => {
              setPanelOpen((v) => !v);
              setNavOpen(false);
            }}
          >
            <span className="burger-cap">Datos</span>
            <Burger open={panelOpen} />
          </button>
        ) : (
          <span className="burger-btn burger-btn-ghost" aria-hidden />
        )}
      </header>

      {drawerOpen ? <button type="button" className="drawer-scrim" aria-label="Cerrar panel" onClick={closeDrawers} /> : null}

      <aside id="app-nav" className="sidebar">
        <button className="brand" onClick={() => go("home")} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", width: "100%" }}>
          <div className="brand-mark">MC</div>
          <div>
            <h1>MemoriaCalc</h1>
            <p>Memorias de cálculo</p>
          </div>
        </button>

        <div>
          <button
            className="nav-label"
            onClick={() => setOpen(open === "hidrologia" ? "" : "hidrologia")}
          >
            Hidrología {open === "hidrologia" ? "–" : "+"}
          </button>
          {open === "hidrologia" &&
            HIDROLOGIA.map((m) => (
              <button key={m.id} className={`nav-btn ${page === m.id ? "active" : ""}`} onClick={() => go(m.id)}>
                {m.title} <small>{m.code}</small>
              </button>
            ))}
        </div>

        <div>
          <button
            className="nav-label"
            onClick={() => setOpen(open === "hidraulica" ? "" : "hidraulica")}
          >
            Hidráulica {open === "hidraulica" ? "–" : "+"}
          </button>
          {open === "hidraulica" &&
            HIDRO.map((m) => (
              <button key={m.id} className={`nav-btn ${page === m.id ? "active" : ""}`} onClick={() => go(m.id)}>
                {m.title} <small>{m.code}</small>
              </button>
            ))}
        </div>

        <div>
          <button
            className="nav-label"
            onClick={() => setOpen(open === "agua-potable" ? "" : "agua-potable")}
          >
            Agua potable {open === "agua-potable" ? "–" : "+"}
          </button>
          {open === "agua-potable" &&
            POTABLE.map((m) => (
              <button key={m.id} className={`nav-btn ${page === m.id ? "active" : ""}`} onClick={() => go(m.id)}>
                {m.title} <small>{m.code}</small>
              </button>
            ))}
        </div>

        <div>
          <button
            className="nav-label"
            onClick={() => setOpen(open === "topografia" ? "" : "topografia")}
          >
            Topografía {open === "topografia" ? "–" : "+"}
          </button>
          {open === "topografia" &&
            TOPO.map((m) => (
              <button key={m.id} className={`nav-btn ${page === m.id ? "active" : ""}`} onClick={() => go(m.id)}>
                {m.title} <small>{m.code}</small>
              </button>
            ))}
        </div>

        <div>
          <button
            className="nav-label"
            onClick={() => setOpen(open === "mov-tierras" ? "" : "mov-tierras")}
          >
            Movimiento de tierras {open === "mov-tierras" ? "–" : "+"}
          </button>
          {open === "mov-tierras" &&
            MOV.map((m) => (
              <button key={m.id} className={`nav-btn ${page === m.id ? "active" : ""}`} onClick={() => go(m.id)}>
                {m.title} <small>{m.code}</small>
              </button>
            ))}
        </div>

        <div>
          <button
            type="button"
            className="nav-label nav-label-white"
            onClick={() => setOpen(open === "presupuestos" ? "" : "presupuestos")}
          >
            Presupuestos {open === "presupuestos" ? "–" : "+"}
          </button>
          {open === "presupuestos" ? (
            <>
              <button className="nav-btn" onClick={() => goPresu("resumen")}>
                Hoja dedicada <small>PRE</small>
              </button>
              <button className={`nav-btn ${page === "presupuesto-pdf" ? "active" : ""}`} onClick={() => go("presupuesto-pdf")}>
                Presupuesto desde PDF <small>PRE-00</small>
              </button>
              <button className={`nav-btn ${page === "vincular-revit" ? "active" : ""}`} onClick={() => go("vincular-revit")}>
                Vincular con Revit <small>PRE-0R</small>
              </button>
              <button className={`nav-btn ${page === "presupuestos" ? "active" : ""}`} onClick={() => go("presupuestos")}>
                Hoja de Presupuesto <small>PRE-01</small>
              </button>
              <button className={`nav-btn ${page === "mis-presupuestos" ? "active" : ""}`} onClick={() => go("mis-presupuestos")}>
                Mis presupuestos <small>PRO</small>
              </button>
              <button className={`nav-btn ${page === "formula-polinomica" ? "active" : ""}`} onClick={() => go("formula-polinomica")}>
                Fórmula polinómica <small>PRE-02</small>
              </button>
              <button className={`nav-btn ${page === "cronograma" ? "active" : ""}`} onClick={() => go("cronograma")}>
                Cronograma de obra <small>PRE-03</small>
              </button>
              <button className={`nav-btn ${page === "valorizaciones" ? "active" : ""}`} onClick={() => go("valorizaciones")}>
                Valorizaciones <small>PRE-07</small>
              </button>
              <button className={`nav-btn ${page === "especificaciones" ? "active" : ""}`} onClick={() => go("especificaciones")}>
                Especificaciones técnicas <small>PRE-05</small>
              </button>
              <button className={`nav-btn ${page === "mano-obra" ? "active" : ""}`} onClick={() => go("mano-obra")}>
                Mano de obra y jornales <small>PRE-06</small>
              </button>
            </>
          ) : null}
        </div>

        {SPECIALTIES.map((s) => (
          <div key={s.slug}>
            <button
              className="nav-label"
              onClick={() => setOpen(open === s.slug ? "" : s.slug)}
            >
              {s.title} {open === s.slug ? "–" : "+"}
            </button>
            {open === s.slug &&
              MODULES.filter((m) => m.specialty === s.slug).map((m) => (
                <button key={m.slug} className={`nav-btn ${page === m.slug ? "active" : ""}`} onClick={() => go(m.slug)}>
                  {m.title}
                </button>
              ))}
          </div>
        ))}

        <div>
          <button
            type="button"
            className="nav-label nav-label-white"
            onClick={() => setOpen(open === "compras" ? "" : "compras")}
          >
            Compras {open === "compras" ? "–" : "+"}
          </button>
          {open === "compras" ? (
            <>
              <button className={`nav-btn ${page === "compras" ? "active" : ""}`} onClick={() => go("compras")}>
                Vitrina <small>PLA-01</small>
              </button>
              <button className={`nav-btn ${page === "compras-publicar" ? "active" : ""}`} onClick={() => go("compras-publicar")}>
                Publicar <small>PLA-02</small>
              </button>
              <button className={`nav-btn ${page === "compras-mios" ? "active" : ""}`} onClick={() => go("compras-mios")}>
                Mis artículos
              </button>
            </>
          ) : null}
        </div>
        <button
          type="button"
          className={`nav-label nav-label-white${page === "mensajes" ? " nav-label-on" : ""}`}
          onClick={() => go("mensajes")}
        >
          <span>Mensajes</span>
          {unread > 0 ? <i className="nav-msg-dot" aria-label={`${unread} mensaje${unread === 1 ? "" : "s"} sin leer`} /> : null}
        </button>
        <button
          type="button"
          className={`nav-label${page === "publicitar" ? " nav-label-on" : ""}`}
          onClick={() => go("publicitar")}
        >
          Publicitar
        </button>
        {plansLive ? (
          <button
            type="button"
            className={`nav-label${page === "planes" ? " nav-label-on" : ""}`}
            onClick={() => go("planes")}
          >
            Planes
          </button>
        ) : null}

        <div className="sidebar-foot">
          <AuthBar />
          <p>Croquis acotado · Word · E.060 / AASHTO / E.030 / NTP.</p>
        </div>
      </aside>

      {page === "home" ? (
        <main className="home">
          <h2>Memorias de cálculo con croquis acotado</h2>
          <p className="lead" style={{ maxWidth: 680 }}>
            Cada módulo desarrolla el procedimiento de cálculo con croquis acotado. Al cambiar un dato, cambian las cotas del
            croquis, la sustitución numérica y las verificaciones CUMPLE / NO CUMPLE.
          </p>
          <div className="cards">
            {homeFamilies.map((s) => {
              const expanded = homeOpen === s.slug;
              return (
                <article key={s.slug} className={`family${expanded ? " open" : ""}`}>
                  <button
                    type="button"
                    className="family-head"
                    aria-expanded={expanded}
                    onClick={() => {
                      const next = expanded ? "" : s.slug;
                      setHomeOpen(next);
                      if (next) setOpen(next);
                    }}
                  >
                    <div className="code">{s.kicker}</div>
                    <h3>{s.title}</h3>
                    <p>{s.blurb}</p>
                    <div className="go">
                      {s.children.length} {s.children.length === 1 ? "módulo" : "módulos"} {expanded ? "–" : "+"}
                    </div>
                  </button>
                  {expanded ? (
                    <div className="family-kids">
                      {s.children.map((m) => (
                        <article
                          key={m.id}
                          className="card child"
                          onClick={() => (m.id === "hoja-dedicada" ? goPresu("resumen") : go(m.id))}
                        >
                          <div className="code">{m.code}</div>
                          <h3>{m.title}</h3>
                          <p>{m.blurb}</p>
                          <div className="go">Abrir módulo →</div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </main>
      ) : (
        <div
          className={`workspace${fullPage ? " workspace-full" : ""}${inModule ? " workspace-sheet" : ""}${plazaLike ? " workspace-plaza" : ""}${page === "mensajes" ? " is-inbox" : ""}`}
          data-mc-page={page}
          {...(plaza ? { "data-guest-ok": "" } : {})}
        >
          {plaza && page === "compras" && <MercadoModule vista="vitrina" />}
          {plaza && page === "compras-publicar" && <MercadoModule vista="publicar" />}
          {plaza && page === "compras-mios" && <MercadoModule vista="mios" />}
          {plaza && page === "mensajes" && <MercadoModule vista="mensajes" />}
          {plaza && page === "publicitar" && <MercadoModule vista="publicitar" />}
          {plaza && page === "planes" && <PlanesModule />}
          {page === "presupuesto-pdf" && <PresupuestoPdfModule />}
          {page === "vincular-revit" && <RevitVincularModule />}
          {page === "mis-presupuestos" && <MisPresupuestosModule />}
          {page === "presupuestos" && <PresupuestoModule />}
          {page === "formula-polinomica" && <PresupuestoModule vistaInicial="formula" />}
          {page === "cronograma" && <CronogramaModule />}
          {page === "valorizaciones" && <ValorizacionesModule />}
          {page === "especificaciones" && <EspecificacionesModule />}
          {page === "mano-obra" && <ManoObraModule />}
          {page === "acb-caminos" && <AcbCaminosModule />}
          {page in HIDRO_ESTUDIO && <HidrologicoModule key={page} finalidad={HIDRO_ESTUDIO[page]} />}
          {page === "canaleta" && <CanaletaModule />}
          {page === "canal" && <CanalModule />}
          {page === "sifon" && <SifonModule />}
          {page === "alcantarilla-hid" && <AlcantarillaModule />}
          {page === "cuneta" && <CunetaModule />}
          {page in HIDRO_PACK && <HidroPackModule kind={HIDRO_PACK[page]} />}
          {page in POTABLE_KIND && <PotableModule kind={POTABLE_KIND[page as keyof typeof POTABLE_KIND]} />}
          {page === "ap-red" && <RdapModule />}
          {page === "edificio-3d" && <Edificio3dModule />}
          {page === "seccion-transversal" && <MovTierrasModule modo="seccion" />}
          {page === "volumenes-tierras" && <MovTierrasModule modo="volumenes" />}
          {page === "taquimetro" && <TopoModule modo="taqui" />}
          {page === "libreta-topo" && <TopoModule modo="libreta" />}
          {page === "tasacion-inmueble" && <TasacionModule modo="vivienda" />}
          {page === "tasacion-terreno" && <TasacionModule modo="terreno" />}
          {current && page !== "tasacion-inmueble" && page !== "tasacion-terreno" && page !== "acb-caminos" && page !== "edificio-3d" && (
            <ExcelCalcModule key={current.slug} mod={current} />
          )}
        </div>
      )}
      <AuthModals />
      <ExtractionDebugPanel />
      <ExportAdHost />
    </div>
  );
}
