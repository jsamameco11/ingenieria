import { useEffect, useMemo, useState } from "react";
import type { FieldDef, ModuleDef } from "../lib/types";
import { SPECIALTIES } from "../lib/catalog";
import { runEngine } from "../lib/engines";
import type { MemoriaDoc } from "../lib/memoria";
import { Field } from "../ui/Field";
import { FullSelect } from "../ui/FullSelect";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { Diagram, ColumnaPM } from "../components/Diagram";
import { PmExportPanel } from "../components/PmExportPanel";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";
import { saveCalculation } from "../lib/supabase";
import { capturePaperGraphics } from "../lib/captureGraphics";
import { colproById, nBarsSteel, sectionAs } from "../lib/colpro";
import { firstTipoId, opcionesColumna, resolveSection } from "../lib/columnaTipos";
import { predimEstriboG } from "../lib/engines/estriboGravedad";
import { e030EnrichField, e030FieldNote, resolveE030, syncE030 } from "../lib/e030/resolve";
import { fmt, barByName } from "../lib/types";
import { seedDesigner } from "../lib/pmSections";
import { elemObra } from "../lib/mezclaObra";
import { applyPlacaRows, parseEtabsForceTable, placaRowsFromValues, serializeEtabsForceTable } from "../lib/etabsTable";
import { EtabsForceTable } from "../ui/EtabsForceTable";
import { FichaInput } from "../ui/FichaInput";
import { useAuth } from "../ui/AuthProvider";

function nombreProcedimiento(title: string): string {
  const first = title.split(/\s+/)[0] ?? title;
  if (first.length > 1 && first === first.toUpperCase()) return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

function puenteH3(slug: string, n: string): string | null {
  const map: Record<string, Record<string, string>> = {
    "estribo-voladizo": {
      "06": "Metrado de cargas DC — peso propio (franja 1.00 m)",
      "14": "Superestructura, relleno EV y sobrecarga LS1",
      "18": "Empujes horizontales EH, LS2 y frenado BR",
      "22": "Sismo — Mononobe–Okabe y PEQ",
      "27": "Combinaciones AASHTO y estabilidad",
      "38": "Diseño de pantalla, puntera y talón",
    },
    "estribo-gravedad": {
      "09": "Metrado de cargas DC — peso propio (franja 1.00 m)",
      "14": "Superestructura y losa de acercamiento",
      "16": "Presión vertical EV",
      "20": "Empujes EH y sobrecarga LS",
      "26": "Estados límite — Caso I (con puente) y Caso II (sin puente)",
    },
    "cargas-aashto": {
      "01": "Tren HL-93 / HS-20 y factores",
    },
    "losa-puente": {
      "03": "Metrado de cargas DC, DW y LL+IM",
      "06": "Resistencia I y armado",
    },
    "puente-losa": {
      "02": "Metrado de cargas y faja equivalente",
      "06": "Resistencia I y armado",
    },
    "puente-vehicular": {
      "02": "Metrado de cargas por viga interior",
    },
    "puente-cajon": {
      "02": "Metrado de cargas DC, DW y HL-93",
    },
    "viga-presforzada": {
      "02": "Propiedades y metrado de peso propio",
    },
    "viga-diafragma": {
      "02": "Metrado del volado",
    },
    "pasarela-colgante": {
      "02": "Metrado del tablero y cables",
    },
    "demanda-electrica": {
      "01": "Área techada a considerar — CNE 050-110",
      "02": "Alumbrado y tomacorriente por tramos",
      "03": "Cargas especiales y factores de demanda",
      "04": "Cargas adicionales del usuario",
      "05": "Cuadro resumen PI / MD y potencia a contratar",
      "06": "Sistema del alimentador y constante K",
      "07": "Corriente nominal del alimentador",
      "08": "Corriente de diseño y selección THW-90",
      "09": "Caída de tensión del alimentador",
    },
    "diseno-mezcla-aci": {
      "01": "Agua de amasado — Tabla ACI 211.1",
      "02": "Relación a/c y dosis de cemento",
      "03": "Agregado grueso compactado seco",
      "04": "Aire y volumen absoluto de arena",
      "05": "Corrección por humedad y absorción",
      "06": "Dosificación para el volumen de obra",
    },
    "diseno-mezcla-walker": {
      "01": "Resistencia promedio requerida f'cr",
      "02": "Relación a/c y correcciones Kr, Ka",
      "03": "Dosis de cemento Walker y agua",
      "04": "Agregados por volumen absoluto",
      "05": "Corrección por humedad y absorción",
      "06": "Dosificación en peso y en volumen",
    },
    "diseno-mezcla-inverso": {
      "01": "Dosis real y cemento descorregido",
      "02": "Relación a/c desde el asentamiento",
      "03": "Resistencia media estimada",
    },
    "ajuste-triangular": {
      "01": "Desajuste de agua y factor de volumen",
      "02": "Relación triangular (exponente 1.3)",
    },
    "mezcla-ejecucion": {
      "01": "Elemento, calidad y tipo de ejecución",
      "02": "Volumen a vaciar",
      "03": "Tanda de una bolsa y rendimiento",
      "04": "Pedido por 1 m³ de concreto",
      "05": "Pedido total del vaciado",
    },
  };
  return map[slug]?.[n] ?? null;
}

function fillSection(next: Record<string, string>, secId: string) {
  if (!secId || secId === "custom") return;
  const sec = resolveSection(secId) ?? colproById(secId);
  if (!sec) return;
  next.forma = sec.shape === "circ" || sec.shape === "L" || sec.shape === "T" ? sec.shape : next.forma || "rect";
  next.shape = sec.shape;
  next.b = String(sec.b);
  next.h = String(sec.h);
  next.As = String(sectionAs(sec));
  next.nBar = String(Math.max(sec.shape === "circ" ? 6 : 4, nBarsSteel(sec.steel)));
  const barMatch = sec.steel.match(/Ø\s*([\d\s/]+")/);
  if (barMatch) next.bar = barMatch[1].replace(/\s+/g, "");
}

function enrichField(mod: ModuleDef, f: FieldDef, values: Record<string, string>): FieldDef {
  if (mod.slug === "espectro-e030") return e030EnrichField(f, values);
  if (mod.slug === "columna-esbeltez" && f.key === "seccion") {
    return { ...f, options: opcionesColumna(values.forma ?? "rect", values.rhoBand ?? "todas") };
  }
  return f;
}

function seedInput(s: Record<string, string>, forma: string) {
  const n0 = (k: string, fb: number) => Number(String(s[k] ?? fb).replace(",", ".")) || fb;
  return {
    forma,
    b: n0("b", 40),
    h: n0("h", 40),
    tw: n0("tw", 20),
    tf: n0("tf", 20),
    tWall: n0("tWall", 20),
    rec: n0("rec", 4),
    dest: barByName(s.dest || '3/8"').db,
    bar: s.bar || '3/4"',
    nBar: n0("nBar", 8),
    barBE: s.barBE || s.bar || '3/4"',
    nBarBE: n0("nBarBE", 4),
    nBarAlma: n0("nBarAlma", 2),
    nBarAla: n0("nBarAla", n0("nBarAlma", 2)),
    bBE: n0("bBE", 14),
    hBE: n0("hBE", n0("h", 40)),
    barMalla: s.barMalla || '3/8"',
    sMalla: n0("sMalla", 20),
    nInner: n0("nInner", 0),
  };
}

function applyField(mod: ModuleDef, s: Record<string, string>, k: string, v: string): Record<string, string> {
  const next = { ...s, [k]: v };
  if (k === "b" && mod.fields.some((f) => f.key === "bMin") && !mod.fields.some((f) => f.key === "b")) {
    next.bMin = v;
  }
  if (mod.slug === "diagrama-interaccion" && k === "tipoElem") {
    if (v === "caja" || v === "nucleo") {
      next.formaPM = "caja";
      next.b = "240";
      next.h = "320";
      next.tWall = "20";
      next.nBar = "16";
      next.nInner = "8";
      next.bBE = "25";
      next.hBE = "25";
      next.nBarBE = "6";
    }
    if (v === "muro") {
      next.formaPM = (next.conBE ?? "si") === "no" ? "muro" : "muro-be";
      next.b = "350";
      next.h = "25";
      next.bBE = "40";
      next.hBE = "25";
      next.nBarBE = "8";
      next.nBar = "0";
      next.sMalla = "15";
    }
    if (v === "columna" && (s.formaPM === "caja" || s.formaPM === "muro-be" || s.formaPM === "muro")) {
      next.formaPM = "rect";
      next.b = "40";
      next.h = "40";
      next.nBar = "8";
      next.nInner = "0";
    }
  }
  if (mod.slug === "mezcla-ejecucion" && k === "elemento") {
    const el = elemObra(v);
    next.fc = String(el.fc);
    next.tipoMezcla = el.tipo;
    next.geom = el.geom;
    next.propA = String(el.a);
    next.propP = String(el.p);
    next.propH = String(el.h || 8);
    next.pctPG = String(el.pg);
    next.e = el.e;
    next.hcim = el.e;
    next.slump = el.slump;
    if (el.tipo === "concreto") {
      next.nBaldeA = el.a > 0 ? String(el.a * 1.5) : "4";
      next.nBaldeP = el.p > 0 ? String(el.p * 1.5) : "4";
    } else {
      next.nBaldeH = el.h > 0 ? String(el.h * 1.5) : "8";
    }
  }
  if (mod.slug === "diagrama-interaccion" && k === "conBE" && (next.tipoElem ?? "columna") === "muro") {
    next.formaPM = v === "si" ? "muro-be" : "muro";
  }
  if (mod.slug === "diagrama-interaccion" && k === "formaPM") {
    if (["rect", "circ", "L", "T", "C", "I"].includes(v)) next.tipoElem = "columna";
    if (v === "caja") next.tipoElem = "caja";
    if (v === "muro" || v === "muro-be") {
      next.tipoElem = "muro";
      next.conBE = v === "muro-be" ? "si" : "no";
    }
    const dims: Record<string, Record<string, string>> = {
      rect: { b: "40", h: "40", nBar: "8" },
      circ: { b: "45", h: "45", nBar: "8" },
      L: { b: "70", h: "70", tw: "25", tf: "25", nBarBE: "4", nBarAlma: "2", nBarAla: "2", bBE: "14" },
      T: { b: "80", h: "50", tw: "25", tf: "18", nBarBE: "4", nBarAlma: "2", nBarAla: "2", bBE: "14" },
      C: { b: "55", h: "70", tw: "20", tf: "18", nBarBE: "4", nBarAlma: "2", nBarAla: "2", bBE: "14" },
      I: { b: "55", h: "70", tw: "20", tf: "16", nBarBE: "4", nBarAlma: "2", nBarAla: "2", bBE: "14" },
      caja: { b: "240", h: "320", tWall: "20", nBar: "16", nInner: "8" },
      muro: { b: "350", h: "25", nBar: "0", nBarAlma: "6", sMalla: "15" },
      "muro-be": { b: "350", h: "25", bBE: "40", hBE: "25", nBarBE: "8", nBarAlma: "6", nBar: "0", sMalla: "15" },
    };
    if (v !== "libre" && dims[v]) Object.assign(next, dims[v]);
    if (v === "libre") {
      const prev = s.formaPM && s.formaPM !== "libre" ? s.formaPM : "rect";
      const seed = seedDesigner(seedInput(s, prev));
      next.polyUser = seed.polyUser;
      next.holesUser = seed.holesUser;
      next.barsUser = seed.barsUser;
      next.sdTool = next.sdTool || "vertice";
    }
  }
  if (mod.slug === "columna-esbeltez" && (k === "forma" || k === "rhoBand")) {
    const forma = k === "forma" ? v : next.forma || "rect";
    const band = k === "rhoBand" ? v : next.rhoBand || "todas";
    next.shape = forma === "custom" ? "rect" : forma;
    const id = firstTipoId(forma, band);
    next.seccion = id;
    fillSection(next, id);
    if (forma === "custom") next.seccion = "custom";
  }
  if (k === "seccion") fillSection(next, v);
  if (/^spanL\d+$/.test(k)) {
    const idx = Number(k.slice(5));
    const nPanos = Math.max(1, Math.min(8, Math.round(Number(String(s.nPanos ?? "3").replace(",", ".")) || 3)));
    const Ldef = Number(String(s.L ?? "5").replace(",", ".")) || 5;
    const parts = String(s.luces ?? "")
      .split(/[;,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t !== "");
    const lucesStr = Array.from({ length: nPanos }, (_, i) => parts[i] ?? String(Ldef));
    lucesStr[idx] = v.replace(",", ".");
    next.luces = lucesStr.join(", ");
    if (idx === 0) next.L = lucesStr[0];
  }
  if (k === "L" || k === "LvolI" || k === "LvolD") {
    next[k] = v.replace(",", ".");
    if (k === "L") {
      const parts = String(s.luces ?? "")
        .split(/[;,\s]+/)
        .map((t) => Number(t.replace(",", ".")))
        .filter((n) => Number.isFinite(n) && n > 0.3);
      const allEq = parts.length <= 1 || parts.every((n) => Math.abs(n - parts[0]) < 1e-6);
      if (allEq) next.luces = "";
    }
  }
  if (mod.slug === "estribo-gravedad" && (k === "H" || k === "Ltab" || k === "e")) {
    const H = Number(String(next.H ?? "4").replace(",", ".")) || 4;
    const Ltab = Number(String(next.Ltab ?? "12").replace(",", ".")) || 12;
    const e = Number(String(next.e ?? "0.8").replace(",", ".")) || 0.8;
    const p = predimEstriboG(H, Ltab, e);
    next.B = String(p.B);
    next.a = String(p.a);
    next.bTalon = String(p.bTalon);
    next.h = String(p.h);
    next.N = String(p.N);
    next.tBack = String(p.tBack);
  }
  if (mod.slug === "pavimento-intertrabado" && k === "sistema") {
    next.So = v === "mixto" ? "0.35" : "0.45";
  }
  if (mod.slug === "espectro-e030") {
    return syncE030(next, k);
  }
  return next;
}

const FICHA_DEMANDA_LABEL: Record<string, string> = {
  At: "Área techada",
  Asot: "Sótano",
  sistema: "Sistema",
  V: "Tensión",
  cos: "cos φ",
  FS: "FS",
  Lcond: "Longitud L",
  Pcalef: "Calefacción",
  sisCalef: "Sist. calefacción",
  Paa: "Aire acond.",
  sisAa: "Sist. AA",
  Pcocina: "Cocina",
  sisCocina: "Sist. cocina",
  Pcalent: "Calentador",
  sisCalent: "Sist. calentador",
  espNom1: "Adicional 1",
  espW1: "Pi adic. 1",
  espN1: "n adic. 1",
  espNom2: "Adicional 2",
  espW2: "Pi adic. 2",
  espN2: "n adic. 2",
  espNom3: "Adicional 3",
  espW3: "Pi adic. 3",
  espN3: "n adic. 3",
  espNom4: "Adicional 4",
  espW4: "Pi adic. 4",
  espN4: "n adic. 4",
};

function fichaVisible(f: FieldDef, values: Record<string, string>, slug: string) {
  if (!fieldVisible(f, values, true)) return false;
  if (slug !== "demanda-electrica") {
    if (slug === "diagrama-interaccion" && ["etabsPaste", "polyUser", "holesUser", "barsUser", "sdTool", "etabsSign", "formaPM"].includes(f.key)) return false;
    return true;
  }
  const fichaKeys = new Set([
    "At",
    "Asot",
    "sistema",
    "V",
    "cos",
    "FS",
    "Lcond",
    "Pcalef",
    "sisCalef",
    "Paa",
    "sisAa",
    "Pcocina",
    "sisCocina",
    "Pcalent",
    "sisCalent",
    "espNom1",
    "espW1",
    "espN1",
    "espNom2",
    "espW2",
    "espN2",
    "espNom3",
    "espW3",
    "espN3",
    "espNom4",
    "espW4",
    "espN4",
  ]);
  return fichaKeys.has(f.key);
}

function fieldVisible(f: FieldDef, values: Record<string, string>, paraInforme = false) {
  if (f.key === "wAz" && values.azotea === "no") return false;
  if (f.key === "LvolI" && values.voladoI === "no") return false;
  if (f.key === "LvolD" && values.voladoD === "no") return false;
  if (f.key === "bApoyo" && values.medidaLuz === "libre") return false;
  if (f.key === "Lf" && values.tipo !== "rectangular") return false;
  if (values.formaPM) {
    const formaPM = values.formaPM;
    const tipoElem = values.tipoElem || "columna";
    if (formaPM === "circ" && f.key === "h") return false;
    if (formaPM === "libre" && ["b", "h", "tw", "tf", "tWall"].includes(f.key)) return false;
    if (formaPM !== "libre" && ["polyUser", "holesUser", "barsUser", "sdTool"].includes(f.key)) return false;
    if (!["L", "T", "C", "I"].includes(formaPM) && ["tw", "tf"].includes(f.key)) return false;
    if (formaPM !== "caja" && tipoElem !== "caja" && tipoElem !== "nucleo" && ["tWall", "nInner"].includes(f.key)) return false;
    if (!["L", "T", "C", "I", "muro-be", "muro", "caja"].includes(formaPM) && tipoElem !== "muro" && tipoElem !== "caja" && tipoElem !== "nucleo" && ["barBE", "nBarBE", "bBE", "hBE"].includes(f.key)) return false;
    if (!["L", "T", "C", "I", "muro-be", "muro"].includes(formaPM) && tipoElem !== "muro" && f.key === "nBarAlma") return false;
    if (!["L", "T", "C", "I"].includes(formaPM) && f.key === "nBarAla") return false;
    if (["L", "T", "C", "I"].includes(formaPM) && f.key === "nBar") return false;
    if (tipoElem !== "muro" && formaPM !== "muro-be" && formaPM !== "muro" && ["barMalla", "sMalla", "conBE"].includes(f.key)) return false;
  }
  const adoquinKeys = ["eAdoq", "eArena", "D2", "D3", "a2", "a3", "dren2", "dren3", "CBR2", "CBR3"];
  const mixtoKeys = ["fc", "D", "eAC", "eBase", "J", "Cd"];
  if (values.sistema === "mixto" && adoquinKeys.includes(f.key)) return false;
  if (values.sistema === "adoquin" && mixtoKeys.includes(f.key)) return false;
  if (values.elemento || values.tipoMezcla) {
    const tipoM = values.tipoMezcla || "concreto";
    const modoM = values.modoMedida || "proporcion";
    const geomM = values.geom || "volumen";
    const esHorm = tipoM === "hormigon" || tipoM === "pobre" || tipoM === "ciclopeo";
    if (esHorm && ["propA", "propP", "nBaldeA", "nBaldeP"].includes(f.key)) return false;
    if (!esHorm && ["propH", "nBaldeH", "pctPG"].includes(f.key)) return false;
    if (tipoM !== "ciclopeo" && f.key === "pctPG") return false;
    if (modoM === "proporcion" && ["nBaldeA", "nBaldeP", "nBaldeH"].includes(f.key)) return false;
    if (modoM === "baldes" && ["propA", "propP", "propH"].includes(f.key)) return false;
    if (geomM === "volumen" && ["L", "B", "e", "bcim", "hcim", "nZap", "Lz"].includes(f.key)) return false;
    if (geomM === "losa" && ["vol", "bcim", "hcim", "nZap", "Lz"].includes(f.key)) return false;
    if (geomM === "cimiento" && ["vol", "B", "e", "nZap", "Lz"].includes(f.key)) return false;
    if (geomM === "zapata" && ["vol", "bcim", "hcim"].includes(f.key)) return false;
  }
  if (values.tipo === "muro" && ["t1", "t2", "sCol", "nTramos"].includes(f.key)) return false;
  if (values.tipo === "columnas" && ["tw", "eMuro"].includes(f.key)) return false;
  if (values.sistema === "elevado" && ["Lc", "Bc", "dias"].includes(f.key)) return false;
  if ((values.sistema === "cisterna" || values.sistema === "hidro") && f.key === "He") return true;
  if (f.key === "nDormHosp" && values.tipoHosp === "albergue") return false;
  if (f.key === "A_dorm" && values.tipoHosp && values.tipoHosp !== "albergue") return false;
  if (f.key === "A_pista" && values.tipoEsp && values.tipoEsp !== "discoteca") return false;
  if (f.key === "nAsientos" && values.tipoEsp === "discoteca") return false;
  if (f.key === "C_animales" && values.tipoEsp && values.tipoEsp !== "circo") return false;
  if (["Pcalef", "sisCalef"].includes(f.key) && values.hayCalef === "no") return false;
  if (["Paa", "sisAa"].includes(f.key) && values.hayAa === "no") return false;
  if (["Pcocina", "sisCocina"].includes(f.key) && values.hayCocina === "no") return false;
  if (["Pcalent", "sisCalent"].includes(f.key) && values.hayCalent === "no") return false;
  if (f.key === "expo" && values.aire === "no") return false;
  if (paraInforme) {
    if (["hayCalef", "hayAa", "hayCocina", "hayCalent"].includes(f.key)) return false;
    for (const i of [1, 2, 3, 4] as const) {
      if ([`espNom${i}`, `espW${i}`, `espN${i}`].includes(f.key)) {
        const n = Number(String(values[`espN${i}`] ?? "0").replace(",", ".")) || 0;
        if (n <= 0) return false;
      }
    }
  }
  return true;
}

function CroquisBoard({
  mod,
  values,
  dims,
  adoption,
  active,
  onFocus,
  onChange,
}: {
  mod: ModuleDef;
  values: Record<string, string>;
  dims?: Record<string, string>;
  adoption: string;
  active: string | null;
  onFocus: (k: string) => void;
  onChange: (k: string, v: string) => void;
}) {
  const sketch = mod.slug === "diagrama-interaccion" ? { ...values } : { ...values, ...dims };
  return (
    <div className={`croquis-board${mod.diagram === "estribo" || mod.diagram === "estriboG" ? " croquis-board-estribo" : ""}${mod.diagram === "placa" ? " croquis-board-placa" : ""}${mod.diagram === "escalera" ? " croquis-board-escalera" : ""}${mod.diagram === "septico" ? " croquis-board-septico" : ""}${mod.diagram === "tableroElec" ? " croquis-board-tablero" : ""}${mod.slug === "diagrama-interaccion" ? " croquis-board-sd" : ""}`}>
      <Diagram
        kind={mod.diagram}
        part={mod.slug === "diagrama-interaccion" ? "informe" : mod.diagram === "aligerado" ? "intro" : mod.diagram === "dotacion" ? "esquema" : undefined}
        values={sketch}
        active={active}
        onFocus={onFocus}
        onChange={onChange}
      />
      <aside className="ficha">
        <div className="ficha-head">
          <span>Datos del elemento</span>
          <span>{mod.norma}</span>
        </div>
        <div className="ficha-body">
          <table>
            <tbody>
              {mod.fields
                .filter((f) => fichaVisible(f, values, mod.slug))
                .filter((f) => !(mod.slug === "columna-esbeltez" && ["CM (gravedad)", "CV (gravedad)", "Sismo X", "Sismo Y"].includes(f.group)))
                .filter((f) => !(mod.slug === "placa-muro" && /^[4-7]\./.test(f.group)))
                .map((f) => (
                  <tr key={f.key}>
                    <td className="k">{mod.slug === "demanda-electrica" ? (FICHA_DEMANDA_LABEL[f.key] ?? f.label) : f.label}</td>
                    <td className="v">
                      {f.kind === "select" ? (
                        <FullSelect
                          variant="ficha"
                          value={values[f.key] ?? ""}
                          options={enrichField(mod, f, values).options ?? []}
                          onFocus={() => onFocus(f.key)}
                          onChange={(v) => onChange(f.key, v)}
                        />
                      ) : (
                        <FichaInput
                          value={values[f.key] ?? ""}
                          onFocus={() => onFocus(f.key)}
                          onChange={(v) => onChange(f.key, v)}
                        />
                      )}
                    </td>
                    <td className="u">{f.key === "wAz" && values.azotea === "no" ? "" : f.unit ?? ""}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="ficha-adopt">
          <span>{mod.slug === "demanda-electrica" ? "Alimentador" : mod.specialty === "mezclas" ? "Dosificación" : "Sección adoptada"}</span>
          <strong>{adoption}</strong>
        </div>
      </aside>
    </div>
  );
}

export function ExcelCalcModule({ mod }: { mod: ModuleDef }) {
  const { track } = useAuth();
  const [values, setValues] = useState<Record<string, string>>(() =>
    mod.slug === "espectro-e030" ? syncE030({ ...mod.defaults }) : { ...mod.defaults }
  );
  const [active, setActive] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    setValues(mod.slug === "espectro-e030" ? syncE030({ ...mod.defaults }) : { ...mod.defaults });
    setActive(null);
    setSaveMsg("");
  }, [mod.slug, mod.defaults]);

  const liveResult = useMemo(() => runEngine(mod.engine, values), [mod.engine, values]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof mod.fields>();
    for (const f of mod.fields) {
      const field = enrichField(mod, f, values);
      const arr = map.get(field.group) ?? [];
      arr.push(field);
      map.set(field.group, arr);
    }
    return Array.from(map.entries());
  }, [mod.fields, mod.slug, values]);

  const liveDoc: MemoriaDoc = useMemo(() => {
    const result = liveResult;
    const blocks: MemoriaDoc["blocks"] = [
      {
        type: "cover",
        titulo: mod.title,
        subtitulo: result.headline,
        meta: [
          { k: "Norma de referencia", v: mod.norma },
          { k: "Especialidad", v: SPECIALTIES.find((s) => s.slug === mod.specialty)?.title ?? mod.specialty },
        ],
      },
      { type: "h2", text: "1. Objeto y alcance" },
      {
        type: "p",
        text:
          mod.slug === "demanda-electrica"
            ? "Esta memoria determina la potencia instalada (PI), la máxima demanda (MD) y el alimentador de la vivienda según el CNE Utilización: área techada a considerar, alumbrado por tramos, cargas especiales con su factor de demanda, cargas adicionales, corriente nominal, sección THW-90 y caída de tensión."
            : mod.specialty === "mezclas"
              ? `Esta memoria desarrolla el ${nombreProcedimiento(mod.title)} según ${mod.norma}. Cada paso reproduce la hoja de cálculo: fórmula, desarrollo numérico, tabla intermedia y dosificación en peso.`
            : mod.slug === "muro-contencion-sismo"
              ? "Esta memoria desarrolla el muro de contención en voladizo por metro lineal: geometría de la pantalla y de la zapata (pata, alma y talón), empujes Rankine y de agua, sobrecarga de franja, estabilidad estática y sísmica (Mononobe–Okabe) y el diseño estructural E.060 de cada parte."
            : mod.engine === "reservorioApoyado"
              ? "Esta memoria desarrolla el reservorio circular apoyado en el terreno: predimensionamiento por volumen, presión hidrostática, análisis de la pared como lámina cilíndrica empotrada en la base (motor propio, equivalente a las tablas PCA), sismo por el modelo de masas de Housner (componentes impulsiva y convectiva, ACI 350.3-06) y diseño estructural de la pared, la losa de fondo, la cúpula y la viga collarín."
            : mod.engine === "tanqueElevadoColumnas" || mod.engine === "tanqueElevadoFuste"
              ? `Esta memoria desarrolla el tanque elevado tipo INTZE (cúpula de fondo, tronco de cono, pared cilíndrica, cúpula de techo y anillos circulares) sobre ${mod.engine === "tanqueElevadoColumnas" ? "una torre de columnas y vigas de arriostre" : "un fuste cilíndrico continuo de concreto"}: presión hidrostática e hidrodinámica (Housner / ACI 350.3-06), análisis de la pared como lámina cilíndrica (motor propio), diseño de cada elemento de la cuba y de la estructura de soporte, y verificación de la deriva sísmica según E.030 y ACI 371R.`
              : `Esta memoria desarrolla el procedimiento de ${nombreProcedimiento(mod.title)} según ${mod.norma}. Se enuncia cada fórmula, se sustituyen los datos del proyecto y se interpreta el resultado antes de verificar contra los límites de norma.`,
      },
      {
        type: "list",
        items:
          mod.slug === "demanda-electrica"
            ? [
                "Norma aplicable: CNE Utilización (artículo 050-110 y factores de demanda de vivienda).",
                "El unifilar del alimentador se acota con L, Iₙ, I_d y la sección adoptada.",
                "Cada paso reproduce la hoja de cálculo: fórmula, desarrollo, tabla intermedia y resultado.",
                "Las verificaciones sellan MD coherente, sistema trifásico si MD > 8 kW, I_z ≥ I_d y ΔV ≤ 5 %.",
              ]
            : mod.specialty === "mezclas"
              ? [
                  `Norma aplicable: ${mod.norma}.`,
                  "El croquis muestra la dosificación en peso (cemento, arena, piedra y agua).",
                  "Cada paso reproduce la hoja: fórmula, desarrollo, tabla intermedia y resultado.",
                  "Las verificaciones sellan volúmenes, a/c y agua de obra.",
                ]
            : [
                `Norma aplicable: ${mod.norma}.`,
                "La geometría del elemento se representa en sección acotada.",
                "Cada paso muestra fórmula, desarrollo numérico, sustitución, resultado y criterio de norma.",
                "Las verificaciones se sellan CUMPLE / NO CUMPLE para adopción de sección o de acero.",
                ...(mod.engine === "vigaFlexion"
                  ? ["La misma memoria verifica flexión (φMn), cortante (Vu, Vc, Vs) y el despiece de estribos: primer estribo a 5 cm, zona 2h y metrado n = 1 + ⌈(ℓ−5)/s⌉."]
                  : []),
                ...(mod.engine === "columnaEsbeltez" || mod.engine === "predColumnas"
                  ? ["Tras el acero longitudinal se detallan estribos de confinamiento (ℓo, Ash, s) según E.060 21.4, con primer estribo a 5 cm del nudo."]
                  : []),
                ...(mod.engine === "muroContencionSismo"
                  ? [
                      "El croquis acota la pata, el alma, el talón, el peralte de zapata y el desplante D.",
                      "Tras la estabilidad se diseña el acero de pantalla, de la pata (inferior) y del talón (superior).",
                      "Cada zona diseñada incluye el diagrama de momento flector, la fórmula de Mu y el acero adoptado.",
                    ]
                  : []),
                ...(["zapataAislada", "zapataCombinada", "zapataCorrida", "platea", "escalera"].includes(mod.engine)
                  ? ["En cada zona analizada se dibuja el diagrama de momento flector y se indica el acero que lo cubre."]
                  : []),
                ...(mod.engine === "reservorioApoyado" || mod.engine === "tanqueElevadoColumnas" || mod.engine === "tanqueElevadoFuste"
                  ? [
                      "La pared se analiza como una lámina cilíndrica sobre fundación elástica (empotrada en la base, libre en la corona): se resuelve numéricamente la ecuación diferencial que gobierna la tensión de anillo N_θ y el momento vertical M_y, equivalente a las tablas de coeficientes PCA.",
                      "El sismo se modela con las masas impulsiva y convectiva de Housner (ACI 350.3-06): se obtienen los pesos Wi/Wc, las alturas hi/hc, los periodos Ti/Tc y la presión hidrodinámica sobre la pared, que se combina con la hidrostática (SRSS) para la envolvente de diseño.",
                      "Los diagramas de N_θ(y) y M_y(y) se grafican en toda la altura de la pared, junto con el acero horizontal (anillo, método de tensión directa) y vertical (flexión) que los cubre.",
                    ]
                  : []),
              ],
      },
      { type: "h2", text: "2. Datos de entrada" },
      {
        type: "kv",
        rows: mod.fields.filter((f) => fichaVisible(f, values, mod.slug)).map((f) => ({
          k: f.label,
          v: values[f.key] ?? "",
          u: f.unit,
        })),
      },
      { type: "h2", text: mod.engine === "vigaFlexion" ? "3. Flexión" : "3. Procedimiento de cálculo" },
    ];
    const shownTables = new Set<string>();
    result.steps.forEach((s, i) => {
      if (mod.engine === "vigaFlexion" && s.n === "06") {
        blocks.push({ type: "h2", text: "3.b Cortante y estribos" });
      }
      if (mod.engine === "vigaFlexion" && s.n === "12") {
        blocks.push({ type: "h2", text: "3.c Despiece y metrado de estribos" });
      }
      if ((mod.engine === "columnaEsbeltez" && s.n === "10") || (mod.engine === "predColumnas" && s.n === "07")) {
        blocks.push({ type: "h2", text: "3.b Estribos y confinamiento — E.060 21.4" });
      }
      if (mod.engine === "muroContencionSismo" && s.n === "07") {
        blocks.push({ type: "h2", text: "3.b Estabilidad del muro y de la cimentación" });
      }
      if (mod.engine === "muroContencionSismo" && s.n === "11") {
        blocks.push({ type: "h2", text: "3.c Empuje sísmico Mononobe–Okabe" });
      }
      if (mod.engine === "muroContencionSismo" && s.n === "13") {
        blocks.push({ type: "h2", text: "3.d Diseño estructural de la pantalla — E.060" });
      }
      if (mod.engine === "muroContencionSismo" && s.n === "16") {
        blocks.push({ type: "h2", text: "3.e Diseño de la zapata: pata y talón" });
      }
      if (mod.engine === "muroContencionSismo" && s.n === "19") {
        blocks.push({ type: "h2", text: "3.f Cuadro de aceros" });
      }
      if (mod.engine === "reservorioApoyado") {
        if (s.n === "05") blocks.push({ type: "h2", text: "3.b Cargas hidrostáticas" });
        if (s.n === "07") blocks.push({ type: "h2", text: "3.c Análisis sísmico — Housner y ACI 350.3-06" });
        if (s.n === "13") blocks.push({ type: "h2", text: "3.d Diseño de acero de la pared" });
        if (s.n === "15") blocks.push({ type: "h2", text: "3.e Losa de fondo, cúpula y viga collarín" });
        if (s.n === "18") blocks.push({ type: "h2", text: "3.f Estabilidad global y cimentación" });
      }
      if (mod.engine === "tanqueElevadoColumnas" || mod.engine === "tanqueElevadoFuste") {
        if (s.n === "04") blocks.push({ type: "h2", text: "3.b Análisis sísmico de la cuba — Housner y ACI 350.3-06" });
        if (s.n === "07") blocks.push({ type: "h2", text: "3.c Diseño de acero de la cuba (pared, cúpulas, anillos)" });
        if (s.n === "12") blocks.push({ type: "h2", text: mod.engine === "tanqueElevadoColumnas" ? "3.d Torre soportante de columnas" : "3.d Fuste soportante de concreto" });
        if (mod.engine === "tanqueElevadoColumnas" && s.n === "17") blocks.push({ type: "h2", text: "3.e Deriva sísmica y cimentación" });
        if (mod.engine === "tanqueElevadoFuste" && s.n === "17") blocks.push({ type: "h2", text: "3.e Deriva sísmica y cimentación" });
      }
      const h3 = puenteH3(mod.slug, s.n);
      if (h3) blocks.push({ type: "h3", text: h3 });
      blocks.push({
        type: "paso",
        n: s.n || String(i + 1).padStart(2, "0"),
        titulo: s.title,
        formula: s.formula ?? "",
        sustituye: s.substitution || "Se aplican los datos de la tabla precedente.",
        resultado: s.result,
        interpreta: s.note,
        desarrollo: s.desarrollo,
      });
      if (s.table && s.table.headers.length) {
        const cap = s.table.caption || s.title;
        shownTables.add(cap);
        blocks.push({
          type: "table",
          caption: cap,
          headers: s.table.headers,
          rows: s.table.rows,
          variant: "wide",
        });
      }
      if (mod.diagram === "aligerado") {
        if (s.n === "05") {
          blocks.push({ type: "figure", part: "dameros" });
          blocks.push({ type: "figure", part: "envolventeM" });
        }
        if (s.n === "08") blocks.push({ type: "figure", part: "envolventeV" });
        if (s.n === "09") blocks.push({ type: "figure", part: "corte" });
      }
      if (mod.diagram === "terzaghi") {
        if (s.n === "03") blocks.push({ type: "figure", part: "spt" });
        if (s.n === "04") blocks.push({ type: "figure", part: "sowers" });
      }
      if (mod.diagram === "dotacion") {
        if (s.n === "01") blocks.push({ type: "figure", part: mod.slug === "dotacion-unifamiliar" ? "lote" : "ocupacion" });
        if (s.n === "04" && mod.slug === "dotacion-unifamiliar") blocks.push({ type: "figure", part: "ocupacion" });
        if (s.n === "05") blocks.push({ type: "figure", part: "esquema" });
        if (s.n === "07") blocks.push({ type: "figure", part: "almacenamiento" });
        if (s.n === "09") blocks.push({ type: "figure", part: "hunter" });
      }
      if (mod.diagram === "zapata") {
        if (s.n === "15") {
          blocks.push({ type: "figure", part: "mDirL" });
          blocks.push({ type: "figure", part: "mDirB" });
        }
      }
      if (mod.diagram === "zapataComb") {
        if (s.n === "09") blocks.push({ type: "figure", part: "mLong" });
        if (s.n === "10") blocks.push({ type: "figure", part: "mTrans" });
      }
      if (mod.diagram === "zapataCorrida") {
        if (s.n === "05") blocks.push({ type: "figure", part: "mTrans" });
        if (s.n === "07" && values.tipo === "columnas") blocks.push({ type: "figure", part: "mLong" });
      }
      if (mod.diagram === "platea") {
        if (s.n === "06") blocks.push({ type: "figure", part: "mIntX" });
        if (s.n === "07") blocks.push({ type: "figure", part: "mEdgX" });
        if (s.n === "08") {
          blocks.push({ type: "figure", part: "mIntY" });
          blocks.push({ type: "figure", part: "mEdgY" });
        }
      }
      if (mod.diagram === "escalera") {
        if (s.n === "04") blocks.push({ type: "figure", part: "mT1" });
        if (s.n === "06") blocks.push({ type: "figure", part: "mDesc" });
        if (s.n === "08") blocks.push({ type: "figure", part: "mT2" });
      }
      if (mod.diagram === "muroContencion") {
        if (s.n === "14") blocks.push({ type: "figure", part: "mPantalla" });
        if (s.n === "16") blocks.push({ type: "figure", part: "mPata" });
        if (s.n === "17") blocks.push({ type: "figure", part: "mTalon" });
      }
      if (mod.diagram === "reservorioApoyado" && s.n === "12") {
        blocks.push({ type: "figure", part: "mMuro" });
        blocks.push({ type: "figure", part: "mAnillo" });
      }
      if ((mod.diagram === "tanqueElevadoColumnas" || mod.diagram === "tanqueElevadoFuste") && s.n === "07") {
        blocks.push({ type: "figure", part: "mMuro" });
        blocks.push({ type: "figure", part: "mAnillo" });
      }
      if (mod.diagram === "tanqueElevadoColumnas" && s.n === "15") {
        blocks.push({ type: "figure", part: "mColumna" });
      }
      if (mod.diagram === "tanqueElevadoColumnas" && s.n === "16") {
        blocks.push({ type: "figure", part: "mViga" });
      }
    });
    const restExtras = (result.extras ?? []).filter((ex) => !shownTables.has(ex.title));
    if (restExtras.length) {
      blocks.push({ type: "h2", text: "3.b Cuadros de metrado y resumen" });
      restExtras.forEach((ex) => {
        blocks.push({ type: "h3", text: ex.title });
        const headers = ex.rows[0] ?? [];
        blocks.push({ type: "table", caption: ex.title, headers, rows: ex.rows.slice(1), variant: "wide" });
      });
    }
    blocks.push({ type: "h2", text: "4. Verificaciones de norma" });
    if (result.checks.length === 0) {
      blocks.push({
        type: "note",
        text: "Este módulo no tiene chequeos binarios adicionales; la adopción se fundamenta en los pasos anteriores.",
      });
    }
    result.checks.forEach((c) => {
      blocks.push({
        type: "check",
        ok: c.ok,
        text: `${c.label}: valor ${c.value}  ·  límite ${c.limit}.`,
      });
    });
    blocks.push({ type: "h2", text: "5. Adopción y conclusión" });
    blocks.push({ type: "p", text: result.adoption });
    blocks.push({
      type: "note",
      text: `Los resultados deben verificarse contra la edición vigente de ${mod.norma} antes de emitir planos.`,
    });
    if (mod.diagram === "aligerado") {
      blocks.push({ type: "h2", text: "6. Despiece de aceros" });
      blocks.push({
        type: "p",
        text: "Elevación de la vigueta (o franja de 1.00 m). El As+ de la mayoría queda continuo. Si dos o más paños piden más acero que el resto, se uniformiza. Si un solo paño pide más, se añade barra adicional con L = L teórica + 2 ld.",
      });
      blocks.push({ type: "figure", part: "despiece" });
    }
    return { codigo: mod.slug.toUpperCase(), titulo: mod.title, norma: mod.norma, blocks };
  }, [mod, liveResult, values]);

  const livePack = useMemo(
    () => ({ result: liveResult, doc: liveDoc, values }),
    [liveResult, liveDoc, values]
  );
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack, mod.slug);
  const result = pack.result;
  const doc = pack.doc;
  const pubValues = pack.values;
  const calcularConSenal = () => {
    calcular();
    track({
      event_type: "save",
      module_slug: mod.slug,
      specialty: mod.specialty,
      meta: { action: "calculation_completed" },
    });
  };

  const fieldByLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of mod.fields) m[f.label] = f.key;
    return m;
  }, [mod.fields]);

  const patchField = (k: string, v: string) => {
    setActive(k);
    setValues((s) => applyField(mod, s, k, v));
  };

  const exportarConGraficos = async () => {
    if (!doc) return;
    setActive(null);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    const graphics = await capturePaperGraphics();
    await exportarWord(doc, graphics);
    track({
      event_type: "export",
      module_slug: mod.slug,
      specialty: mod.specialty,
      meta: { action: "document_downloaded", format: "word" },
    });
  };

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>{mod.title}</h2>
        <p className="lead">
          {mod.slug === "diagrama-interaccion"
            ? "Defina la sección aquí, complete materiales y demandas, y pulse Calcular para emitir la memoria P–M–M."
            : `${mod.norma}. Ejemplo desarrollado. Edite los datos y pulse Calcular para actualizar el informe. Imprimir y Word incluyen los gráficos.`}
        </p>
        <CalcDirtyNote dirty={dirty} />
        {mod.slug === "diagrama-interaccion" ? (
          <div className="panel-sd">
            <Diagram
              kind="interaccion"
              part="designer"
              values={values}
              active={active}
              onFocus={setActive}
              onChange={patchField}
            />
          </div>
        ) : null}
        {mod.slug === "espectro-e030" ? <E030Resumen values={values} /> : null}
        {groups.map(([group, fields]) => {
          if (mod.slug === "placa-muro" && /^[5-7]\. ETABS/.test(group)) return null;
          if (mod.slug === "placa-muro" && group === "4. ETABS CM (Dead)") {
            return (
              <fieldset key="etabs-placa" className="fieldset">
                <legend>4. ETABS · Pier / Columna</legend>
                <EtabsForceTable
                  fallbackLabel="P1"
                  value={serializeEtabsForceTable(placaRowsFromValues(values))}
                  onFocus={() => setActive("Pcm")}
                  onChange={(raw) => {
                    setActive("Pcm");
                    const parsed = parseEtabsForceTable(raw);
                    setValues((s) => applyPlacaRows(s, parsed.length ? parsed : placaRowsFromValues(s)));
                  }}
                />
              </fieldset>
            );
          }
          const vis = fields.filter((f) => {
            if (mod.slug === "diagrama-interaccion" && (f.key === "etabsPaste" || f.key === "sdTool" || f.key === "formaPM")) return false;
            return fieldVisible(f, values);
          });
          if (!vis.length) return null;
          return (
          <fieldset key={group} className="fieldset">
            <legend>{group}</legend>
            {mod.slug === "diagrama-interaccion" && group === "5. ETABS" ? (
              <EtabsForceTable
                fallbackLabel="C1"
                value={values.etabsPaste ?? ""}
                onFocus={() => setActive("etabsPaste")}
                onChange={(raw) => {
                  setActive("etabsPaste");
                  setValues((s) => applyField(mod, s, "etabsPaste", raw));
                  if (raw.trim().length > 80) {
                    track({
                      event_type: "save",
                      module_slug: mod.slug,
                      specialty: mod.specialty,
                      meta: { tool: "etabs", action: "paste_table" },
                    });
                  }
                }}
              />
            ) : null}
            <div className="grid-2">
              {vis.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  unit={f.unit}
                  className={f.wide ? "field-wide" : undefined}
                  note={mod.slug === "espectro-e030" ? e030FieldNote(f.key, values) : undefined}
                >
                  {f.kind === "select" ? (
                    <FullSelect
                      variant="field"
                      value={values[f.key] ?? ""}
                      options={enrichField(mod, f, values).options ?? []}
                      title={f.hint}
                      onFocus={() => setActive(f.key)}
                      onChange={(v) => {
                        setActive(f.key);
                        setValues((s) => applyField(mod, s, f.key, v));
                      }}
                    />
                  ) : f.kind === "textarea" ? (
                    <textarea
                      rows={6}
                      value={values[f.key] ?? ""}
                      title={f.hint}
                      placeholder={"P\tM2\tM3"}
                      onFocus={() => setActive(f.key)}
                      onChange={(e) => {
                        setActive(f.key);
                        setValues((s) => applyField(mod, s, f.key, e.target.value));
                      }}
                    />
                  ) : (
                    <input
                      type={f.kind === "text" ? "text" : "number"}
                      inputMode={f.unit === "m" || f.unit === "cm" || f.kind === "text" ? "decimal" : undefined}
                      step={f.step ?? (f.unit === "m" ? 0.01 : 1)}
                      value={values[f.key] ?? ""}
                      title={f.hint}
                      onFocus={() => setActive(f.key)}
                      onChange={(e) => {
                        setActive(f.key);
                        setValues((s) => applyField(mod, s, f.key, e.target.value));
                      }}
                    />
                  )}
                </Field>
              ))}
            </div>
          </fieldset>
          );
        })}
        <div className="actions">
          <CalcularButton onClick={calcularConSenal} dirty={dirty} />
          <button className="btn" onClick={() => void exportarConGraficos()} disabled={!doc}>
            Exportar Word
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setActive(null);
              printMemoria(mod.title);
              track({
                event_type: "print",
                module_slug: mod.slug,
                specialty: mod.specialty,
                meta: { action: "document_downloaded", format: "print" },
              });
            }}
            disabled={!doc}
          >
            Imprimir / PDF
          </button>
          <button
            className="btn secondary"
            disabled={!result}
            onClick={async () => {
              if (!result) return;
              setSaveMsg("Guardando…");
              const res = await saveCalculation({
                module_slug: mod.slug,
                title: mod.title,
                inputs: values,
                headline: result.headline,
                adoption: result.adoption,
              });
              setSaveMsg(res.message);
            }}
          >
            Guardar
          </button>
        </div>
        {saveMsg ? <p className="lead">{saveMsg}</p> : null}
      </aside>
      {doc && result ? (
      <Paper
        doc={doc}
        fieldValues={values}
        fieldByLabel={fieldByLabel}
        onEditField={patchField}
        extra={
          <>
            <CroquisBoard
              mod={mod}
              values={mod.slug === "diagrama-interaccion" ? values : pubValues}
              dims={mod.slug === "diagrama-interaccion" ? liveResult.dims : result.dims}
              adoption={mod.slug === "diagrama-interaccion" ? liveResult.adoption : result.adoption}
              active={active}
              onFocus={setActive}
              onChange={patchField}
            />
            {mod.slug === "diagrama-interaccion" && liveResult.dims?.pm3 ? <ColumnaPM dims={liveResult.dims} /> : null}
            {mod.slug === "diagrama-interaccion" && liveResult.extras?.length ? (
              <PmExportPanel sheets={liveResult.extras} headline={liveResult.headline} />
            ) : null}
            {(mod.slug === "columna-esbeltez" || mod.slug === "placa-muro") && result.dims?.pm3 ? <ColumnaPM dims={result.dims} /> : null}
          </>
        }
        renderFigure={(part) => (
          <Diagram
            kind={mod.diagram}
            part={part}
            values={mod.slug === "diagrama-interaccion" ? values : { ...pubValues, ...result.dims }}
            active={active}
            onFocus={setActive}
            onChange={patchField}
          />
        )}
      />
      ) : mod.slug === "diagrama-interaccion" ? (
        <>
          <CroquisBoard
            mod={mod}
            values={values}
            dims={undefined}
            adoption={liveResult.adoption}
            active={active}
            onFocus={setActive}
            onChange={patchField}
          />
          {liveResult.dims?.pm3 ? <ColumnaPM dims={liveResult.dims} /> : null}
          {liveResult.extras?.length ? <PmExportPanel sheets={liveResult.extras} headline={liveResult.headline} /> : null}
          <MemoriaPendiente />
        </>
      ) : (
        <MemoriaPendiente />
      )}
    </>
  );
}

function E030Resumen({ values }: { values: Record<string, string> }) {
  const r = resolveE030(values);
  return (
    <div className="e030-resumen">
      <div>
        <span>Zona sísmica</span>
        <strong>Zona {r.zona}</strong>
        <em>Z = {fmt(r.Z, 2)}</em>
      </div>
      <div>
        <span>Suelo {r.suelo}</span>
        <strong>S = {fmt(r.S, 2)}</strong>
        <em>
          Tp = {fmt(r.Tp, 2)} s · TL = {fmt(r.Tl, 2)} s
        </em>
      </div>
      <div>
        <span>Categoría</span>
        <strong>{r.categoria.replace("-aislado", " aislado")}</strong>
        <em>U = {fmt(r.U, 2)}</em>
      </div>
      <div>
        <span>Reducción</span>
        <strong>R = {fmt(r.R, 2)}</strong>
        <em>
          R0 = {fmt(r.R0, 1)} · Ia = {fmt(r.Ia, 2)} · Ip = {fmt(r.Ip, 2)}
        </em>
      </div>
    </div>
  );
}
