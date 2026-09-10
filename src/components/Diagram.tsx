import { createContext, useContext, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { figuraMomento } from "./MomentoZona";
import { e030Curve } from "../lib/engines/estructuras";
import { decodeBeam, planDespiece } from "../lib/beam2d";
import { decodeDemands, decodePts } from "../lib/colpro";
import { barByName } from "../lib/types";
import { buildSection, describeForma, encodeBars, encodePoly, parseBarsText, parseHolesText, parsePolyText, resolvePmForma, steelZonesFor } from "../lib/pmSections";
import { ReservorioApoyadoCroquis, TanqueElevadoColumnasCroquis, TanqueElevadoFusteCroquis } from "./DiagramTanques";

const DimLive = createContext<{
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
  onChange?: (k: string, v: string) => void;
} | null>(null);

type DimProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  side?: number;
  field?: string;
  value?: string;
  unit?: string;
  em?: number;
  active?: string | null;
  onFocus?: (key: string) => void;
  onChange?: (key: string, value: string) => void;
};

function CotaTick({ x, y, size = 7 }: { x: number; y: number; size?: number }) {
  const h = size * 0.48;
  return (
    <line
      className="cota-stroke"
      x1={x - h}
      y1={y + h}
      x2={x + h}
      y2={y - h}
      stroke="#1a4473"
      strokeWidth="1.05"
      strokeLinecap="square"
    />
  );
}

const COTA_EM = 11;

function cotaPad(side: number, em = COTA_EM, chars = 8) {
  const d = Math.abs(side);
  return Math.ceil(d + em * 2.4 + chars * em * 0.42);
}

export function Dim({ x1, y1, x2, y2, label, side = 18, field, value, unit, em: emProp, active, onFocus, onChange }: DimProps) {
  const ctx = useContext(DimLive);
  const liveOnChange = onChange ?? ctx?.onChange;
  const liveOnFocus = onFocus ?? ctx?.onFocus;
  const liveActive = active ?? ctx?.active ?? null;
  const liveValue = value ?? (field && ctx ? ctx.values[field] : undefined);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const s = Math.sign(side) || 1;
  const ox = nx * s;
  const oy = ny * s;
  const d = Math.abs(side);
  const gap = Math.min(2.4, d * 0.12);
  const over = 3.2;
  const a1x = x1 + ox * d;
  const a1y = y1 + oy * d;
  const a2x = x2 + ox * d;
  const a2y = y2 + oy * d;
  const mx = (a1x + a2x) / 2;
  const my = (a1y + a2y) / 2;
  const em = emProp ?? COTA_EM;
  const hot = Boolean(field && liveActive === field);
  const raw = String(liveValue ?? label ?? "").trim();
  const stripped = raw.replace(/^[A-Za-z']+=/, "").trim();
  const shown = stripped || raw || "—";
  const text = unit && shown !== "—" && !shown.endsWith(unit) ? `${shown} ${unit}` : shown;
  const labelOff = em * 0.85 + 6;
  const lx = mx + ox * labelOff;
  const ly = my + oy * labelOff;
  const boxW = Math.max(56, Math.min(96, 12 + text.length * 6.4));
  const boxH = Math.max(16, em + 5);
  const editable = Boolean(field && liveOnChange);
  return (
    <g className={`cota${editable ? " cota-edit" : ""}`} onClick={() => field && liveOnFocus?.(field)}>
      <line className="cota-stroke" x1={x1 + ox * gap} y1={y1 + oy * gap} x2={x1 + ox * (d + over)} y2={y1 + oy * (d + over)} stroke="#1a4473" strokeWidth="0.8" />
      <line className="cota-stroke" x1={x2 + ox * gap} y1={y2 + oy * gap} x2={x2 + ox * (d + over)} y2={y2 + oy * (d + over)} stroke="#1a4473" strokeWidth="0.8" />
      <line className="cota-stroke" x1={a1x} y1={a1y} x2={a2x} y2={a2y} stroke="#1a4473" strokeWidth="0.9" />
      <CotaTick x={a1x} y={a1y} size={em * 0.62} />
      <CotaTick x={a2x} y={a2y} size={em * 0.62} />
      {editable && hot ? (
        <>
          <foreignObject className="no-print" x={lx - boxW / 2} y={ly - boxH / 2} width={boxW} height={boxH}>
            <div className="cota-edit-box">
              <input
                className="cota-input"
                type="text"
                inputMode="decimal"
                value={liveValue ?? value ?? stripped}
                autoFocus
                onFocus={() => liveOnFocus?.(field!)}
                onChange={(e) => liveOnChange!(field!, e.target.value.replace(",", "."))}
                onBlur={() => liveOnFocus?.("")}
              />
              {unit ? <span>{unit}</span> : null}
            </div>
          </foreignObject>
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="cota-label cota-print-fallback"
            fontSize={em}
          >
            {text}
          </text>
        </>
      ) : (
        <text
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="middle"
          className={`cota-label${hot ? " is-hot" : ""}`}
          fontSize={em}
        >
          {label && unit && !label.endsWith(unit) ? `${label} ${unit}` : label || text}
        </text>
      )}
    </g>
  );
}

function SvgDefs() {
  return (
    <defs>
      <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#1d5aa6" />
      </marker>
      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#8a7a5a" strokeWidth="1" />
      </pattern>
      <pattern id="conc" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#d9d2c3" />
        <circle cx="2" cy="3" r="0.6" fill="#6b6458" />
        <circle cx="6" cy="6" r="0.5" fill="#6b6458" />
      </pattern>
      <pattern id="soil" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#cbb892" />
        <path d="M0 10 Q5 4 10 10" fill="none" stroke="#8a7344" strokeWidth="0.7" />
      </pattern>
      <pattern id="water" width="14" height="10" patternUnits="userSpaceOnUse">
        <rect width="14" height="10" fill="#c9dce8" />
        <path d="M0 5 Q3.5 2 7 5 T14 5" fill="none" stroke="#4a7a96" strokeWidth="0.9" />
      </pattern>
    </defs>
  );
}

export function SvgFrame({
  children,
  caption,
  heading = "Geometría",
  viewBox = "0 0 520 340",
  compact = false,
  clip = false,
  part,
  layers,
  toolbar,
  ribbon,
}: {
  children?: ReactNode;
  caption: string;
  heading?: string;
  viewBox?: string;
  compact?: boolean;
  /** Recorta el SVG al viewBox para que cotas y sombras no tapen el pie de figura. */
  clip?: boolean;
  part?: string;
  /** Varios croquis apilados (planta + corte, etc.) con un solo pie al fondo del contenedor. */
  layers?: { viewBox: string; children: ReactNode }[];
  toolbar?: ReactNode;
  ribbon?: ReactNode;
}) {
  const panes = layers?.length ? layers : [{ viewBox, children: children ?? null }];
  const stacked = panes.length > 1;
  return (
    <div className={`croquis${compact ? " croquis-compact" : ""}`} data-fig-part={part || undefined}>
      <div className="croquis-head">
        {toolbar ?? <p>{heading}</p>}
      </div>
      {ribbon}
      <div className={`croquis-stage${stacked ? " croquis-stage-stack" : ""}`}>
        {panes.map((pane, i) => {
          const [, , vw = "520", vh = "340"] = pane.viewBox.split(" ");
          return (
            <svg
              key={i}
              className={clip ? "croquis-svg-clip" : undefined}
              viewBox={pane.viewBox}
              preserveAspectRatio="xMidYMid meet"
              overflow={clip ? "hidden" : "visible"}
            >
              {i === 0 ? <SvgDefs /> : null}
              <rect x="0" y="0" width={vw} height={vh} fill={part === "estribo" || heading.startsWith("1 parapeto") ? "#fbf6ea" : "#fbf8f1"} />
              {pane.children}
            </svg>
          );
        })}
      </div>
      <p className="croquis-cap">{caption}</p>
    </div>
  );
}

function n(v: Record<string, string>, k: string, fb: number) {
  const s = String(v[k] ?? "").trim();
  if (s === "") return fb;
  const x = Number(s.replace(",", "."));
  return Number.isFinite(x) ? x : fb;
}

export function Diagram({
  kind,
  values,
  active,
  onFocus,
  onChange,
  part,
}: {
  kind: string;
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
  onChange?: (k: string, v: string) => void;
  part?: string;
}) {
  const p = { active, onFocus };
  const momento = figuraMomento(kind, part, values);
  if (momento) return momento;
  const inner = (() => {
    switch (kind) {
    case "columna":
      return <Columna values={values} {...p} />;
    case "vigaSeccion":
    case "vigaEstribos":
      return <VigaSeccion values={values} {...p} />;
    case "zapata":
      return <Zapata values={values} {...p} />;
    case "zapataComb":
      return <ZapataComb values={values} {...p} />;
    case "zapataCorrida":
      return <ZapataCorrida values={values} {...p} />;
    case "platea":
      return <PlateaGrid values={values} {...p} />;
    case "escalera":
      return <Escalera values={values} {...p} />;
    case "aligerado":
      return <Aligerado values={values} part={part} {...p} />;
    case "estribo":
      return <Estribo values={values} {...p} />;
    case "estriboG":
      return <EstriboG values={values} {...p} />;
    case "tablero":
      return <Tablero values={values} {...p} />;
    case "placa":
      return <Placa values={values} {...p} />;
    case "terzaghi":
      return <Terzaghi values={values} part={part} {...p} />;
    case "lab":
      return <LabHumedad values={values} {...p} />;
    case "curva":
      return <CurvaGranulo values={values} />;
    case "casagrande":
      return <FlujoCasagrande values={values} />;
    case "mohr":
      return <MohrCoulomb values={values} />;
    case "asiento":
      return <AsientoSketch values={values} {...p} />;
    case "cbr":
      return <CbrSketch values={values} />;
    case "empuje":
      return <Empuje values={values} {...p} />;
    case "muroContencion":
      return <MuroContencion values={values} {...p} />;
    case "reservorioApoyado":
      return <ReservorioApoyadoCroquis values={values} />;
    case "tanqueElevadoColumnas":
      return <TanqueElevadoColumnasCroquis values={values} />;
    case "tanqueElevadoFuste":
      return <TanqueElevadoFusteCroquis values={values} />;
    case "cajon":
      return <Cajon values={values} {...p} />;
    case "septico":
      return <Septico values={values} {...p} />;
    case "interaccion":
      return <InteraccionSeccion values={values} active={p.active} onFocus={p.onFocus} onChange={onChange} part={part} />;
    case "ptar":
      return <Ptar values={values} {...p} />;
    case "tableroElec":
      return <TableroElec values={values} {...p} />;
    case "dotacion":
      return <Dotacion values={values} part={part} {...p} />;
    case "pavimento":
      return <Pavimento values={values} {...p} />;
    case "diagramasMV":
      return <MV values={values} {...p} />;
    case "apoyo":
      return <Apoyo values={values} {...p} />;
    case "placaAcero":
      return <PlacaAcero values={values} {...p} />;
    case "cajonPuente":
      return <CajonPuente values={values} {...p} />;
    case "colgante":
      return <Colgante values={values} {...p} />;
    case "lineaInf":
      return <LineaInf values={values} {...p} />;
    case "diafragma":
      return <Diafragma values={values} {...p} />;
    case "portico":
      return <Portico values={values} {...p} />;
    case "losa":
    case "losa2d":
      return <LosaPaño values={values} {...p} />;
    case "espectro":
      return <Espectro values={values} />;
    case "mezcla":
      return <MezclaBatch values={values} />;
    default:
      return (
        <SvgFrame caption="Esquema del procedimiento">
          <rect x="80" y="70" width="360" height="200" fill="url(#conc)" stroke="#1a4473" />
          <text x="260" y="175" textAnchor="middle" fontSize="13" fill="#1a4473">
            Memoria de cálculo
          </text>
        </SvgFrame>
      );
    }
  })();
  return (
    <DimLive.Provider value={{ values, active, onFocus, onChange }}>
      <div className="fig-host" data-fig-part={part || undefined}>
        {inner}
      </div>
    </DimLive.Provider>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 0.2;
  const pads = v * 1.12;
  if (pads <= 0.1) return Math.ceil(pads * 50) / 50;
  if (pads <= 0.25) return Math.ceil(pads * 20) / 20;
  if (pads <= 0.5) return Math.ceil(pads * 10) / 10;
  return Math.ceil(pads * 4) / 4;
}

function Espectro({ values }: { values: Record<string, string> }) {
  const curve = e030Curve(values);
  const tMax = 3;
  const saMax = niceCeil(Math.max(...curve.points.map((p) => p.sa), curve.Sa));
  const L = 58;
  const R = 502;
  const top = 22;
  const B = 292;
  const xOf = (t: number) => L + (t / tMax) * (R - L);
  const yOf = (sa: number) => B - (sa / saMax) * (B - top);
  const poly = curve.points.map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.sa).toFixed(1)}`).join(" ");
  const xTicks = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const ySteps = 4;
  const yTicks = Array.from({ length: ySteps + 1 }, (_, i) => (saMax * i) / ySteps);
  const tMark = Math.min(Math.max(curve.T, 0), tMax);
  return (
    <SvgFrame compact viewBox="0 0 520 340" caption={`Espectro Sa(T) · E.030 2026  ·  Tp = ${curve.Tp.toFixed(2)} s  ·  TL = ${curve.Tl.toFixed(2)} s`}>
      {yTicks.map((sa) => (
        <g key={`hy-${sa}`}>
          <line x1={L} y1={yOf(sa)} x2={R} y2={yOf(sa)} stroke="#1a4473" strokeOpacity="0.12" strokeWidth="0.8" />
          <text x={L - 7} y={yOf(sa) + 3.5} textAnchor="end" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
            {sa.toFixed(2)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`vx-${t}`}>
          <line x1={xOf(t)} y1={top} x2={xOf(t)} y2={B} stroke="#1a4473" strokeOpacity="0.12" strokeWidth="0.8" />
          <text x={xOf(t)} y={B + 16} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      <line x1={L} y1={top} x2={L} y2={B} stroke="#1a4473" strokeWidth="1.4" />
      <line x1={L} y1={B} x2={R} y2={B} stroke="#1a4473" strokeWidth="1.4" />
      <line
        x1={xOf(curve.Tp)}
        y1={top}
        x2={xOf(curve.Tp)}
        y2={B}
        stroke="#1a4473"
        strokeDasharray="4 3"
        strokeWidth="1"
      />
      <line
        x1={xOf(curve.Tl)}
        y1={top}
        x2={xOf(curve.Tl)}
        y2={B}
        stroke="#1a4473"
        strokeDasharray="4 3"
        strokeWidth="1"
      />
      <text x={xOf(curve.Tp)} y={top + 12} textAnchor="middle" fontSize="9" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        Tp
      </text>
      <text x={xOf(curve.Tl)} y={top + 12} textAnchor="middle" fontSize="9" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        TL
      </text>
      <polyline points={poly} fill="none" stroke="#8b1e1e" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
      {curve.points.map((p) => (
        <circle key={p.t} cx={xOf(p.t)} cy={yOf(p.sa)} r="2.15" fill="#8b1e1e" stroke="#fbf8f1" strokeWidth="0.6" />
      ))}
      <line
        x1={xOf(tMark)}
        y1={yOf(curve.Sa)}
        x2={xOf(tMark)}
        y2={B}
        stroke="#8b1e1e"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      <circle cx={xOf(tMark)} cy={yOf(curve.Sa)} r="4" fill="#fbf8f1" stroke="#8b1e1e" strokeWidth="1.6" />
      <text x={12} y={16} fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        Sa
      </text>
      <text x={R} y={B + 30} textAnchor="end" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        T (s)
      </text>
      <text x={L + 8} y={top + 14} fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
        Sa = Z·U·C·S / R
      </text>
    </SvgFrame>
  );
}

/** Barras longitudinales de columna: esquinas siempre + extras repartidos en caras (sin amontonar). */
function rectColumnBars(
  nBar: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { cx: number; cy: number }[] {
  const n = Math.max(4, Math.round(nBar));
  const pts: { cx: number; cy: number }[] = [];
  const add = (cx: number, cy: number) => {
    if (!pts.some((p) => Math.hypot(p.cx - cx, p.cy - cy) < 0.8)) pts.push({ cx, cy });
  };
  add(x0, y0);
  add(x1, y0);
  add(x1, y1);
  add(x0, y1);
  let rem = n - 4;
  if (rem <= 0) return pts;
  const bw = Math.max(x1 - x0, 1);
  const bh = Math.max(y1 - y0, 1);
  const longVert = bh >= bw;
  const order: Array<"left" | "right" | "top" | "bottom"> = longVert
    ? ["left", "right", "top", "bottom"]
    : ["top", "bottom", "left", "right"];
  const extras: Record<"left" | "right" | "top" | "bottom", number> = { left: 0, right: 0, top: 0, bottom: 0 };
  for (let i = 0; rem > 0; i++, rem--) extras[order[i % order.length]] += 1;
  const onEdge = (face: keyof typeof extras, count: number) => {
    for (let k = 1; k <= count; k++) {
      const t = k / (count + 1);
      if (face === "top") add(x0 + t * bw, y0);
      else if (face === "bottom") add(x0 + t * bw, y1);
      else if (face === "left") add(x0, y0 + t * bh);
      else add(x1, y0 + t * bh);
    }
  };
  (Object.keys(extras) as Array<keyof typeof extras>).forEach((f) => onEdge(f, extras[f]));
  return pts;
}

function circDots(nBar: number, cx: number, cy: number, r: number): { cx: number; cy: number }[] {
  const n = Math.max(6, Math.round(nBar));
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a) };
  });
}

function Columna({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const b = n(values, "b", n(values, "bAdopt", n(values, "bMin", 25)));
  const h = n(values, "h", n(values, "hAdopt", 40));
  const nBar = Math.max(4, Math.round(n(values, "nBar", b >= h * 0.55 ? 8 : 6)));
  const shape = values.shape ?? values.forma ?? "rect";
  const rec = n(values, "rec", 4);
  const dest = n(values, "dest", 0.95);
  const barLong = String(values.bar ?? values.barLong ?? '5/8"');
  const barEst = String(values.barEst ?? '3/8"');
  const widthField =
    values.b !== undefined && values.b !== ""
      ? "b"
      : values.bAdopt !== undefined && values.bAdopt !== ""
        ? "bAdopt"
        : values.bMin !== undefined
          ? "bMin"
          : "b";
  const heightField =
    values.h !== undefined && values.h !== ""
      ? "h"
      : values.hAdopt !== undefined && values.hAdopt !== ""
        ? "hAdopt"
        : undefined;
  const showRecDim = values.rec !== undefined && values.rec !== "";
  const sideB = 28;
  const sideH = 34;
  const sideR = 30;
  const padL = cotaPad(sideH) + 12;
  const padT = 20;
  const padR = (showRecDim ? cotaPad(sideR) : 14) + 8;
  const padB = cotaPad(sideB) + 8;
  const sConf = n(values, "sConf", 0);
  const sRest = n(values, "sRest", sConf);
  const loCm = n(values, "lo", 0);
  const LuCm = n(values, "Lu", 0);
  const arregloCol = values.arreglo ?? "";
  const showElevCol = sConf > 0 && LuCm > 0;
  const elevW = showElevCol ? 118 : 0;
  const sc = Math.min(7.2, 248 / Math.max(h, 1), 168 / Math.max(b, 1));
  const w = Math.max(36, b * sc);
  const ht = Math.max(48, h * sc);
  const sx = padL;
  const sy = padT;
  const vbW = Math.ceil(padL + w + padR + (showElevCol ? elevW + 16 : 0));
  const vbH = Math.max(Math.ceil(padT + ht + padB), showElevCol ? 236 : 0);
  const recFace = Math.max(4, rec * sc);
  const destPx = Math.max(1.4, dest * sc);
  const dbLong = barByName(barLong).db;
  const rBar = Math.max(3.4, Math.min(7.2, (dbLong / 2) * sc));
  const tEst = destPx;
  const recPx = recFace;
  const e = Math.max(12, Math.min(w, ht) * 0.36);
  const cx = sx + w / 2;
  const cy = sy + ht / 2;
  const rCirc = Math.min(w, ht) / 2;
  const stOff = recFace + destPx / 2;
  const barOff = recFace + destPx + rBar;
  const stX0 = sx + stOff;
  const stY0 = sy + stOff;
  const stX1 = sx + w - stOff;
  const stY1 = sy + ht - stOff;
  const x0 = sx + barOff;
  const y0 = sy + barOff;
  const x1 = sx + w - barOff;
  const y1 = sy + ht - barOff;
  const dots =
    shape === "circ"
      ? circDots(nBar, cx, cy, Math.max(8, rCirc - recFace - destPx - rBar))
      : rectColumnBars(nBar, x0, y0, x1, y1);
  const steelHint = values.steel?.trim() || `${nBar} Ø ${barLong}`;
  const cap =
    shape === "circ"
      ? `Ø ${b.toFixed(0)} cm · ${steelHint} · est. Ø ${barEst}${arregloCol ? ` · ${arregloCol}` : ""}`
      : shape === "L"
        ? `L ${b.toFixed(0)} × ${h.toFixed(0)} cm · ${steelHint} · est. Ø ${barEst}`
        : shape === "T"
          ? `T ${b.toFixed(0)} × ${h.toFixed(0)} cm · ${steelHint} · est. Ø ${barEst}`
          : `${b.toFixed(0)} × ${h.toFixed(0)} cm · ${steelHint} · est. Ø ${barEst}${arregloCol ? ` · ${arregloCol}` : ""}`;
  const wx = sx + (w - e) / 2;
  const midTies: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (shape !== "circ" && shape !== "L" && shape !== "T") {
    const left = dots.filter((d) => Math.abs(d.cx - x0) < 0.8 && d.cy > y0 + 1 && d.cy < y1 - 1).sort((a, b) => a.cy - b.cy);
    const right = dots.filter((d) => Math.abs(d.cx - x1) < 0.8 && d.cy > y0 + 1 && d.cy < y1 - 1).sort((a, b) => a.cy - b.cy);
    const top = dots.filter((d) => Math.abs(d.cy - y0) < 0.8 && d.cx > x0 + 1 && d.cx < x1 - 1).sort((a, b) => a.cx - b.cx);
    const bot = dots.filter((d) => Math.abs(d.cy - y1) < 0.8 && d.cx > x0 + 1 && d.cx < x1 - 1).sort((a, b) => a.cx - b.cx);
    const nPair = Math.min(left.length, right.length);
    for (let i = 0; i < nPair; i++) midTies.push({ x1: stX0, y1: left[i].cy, x2: stX1, y2: right[i].cy });
    const nPairH = Math.min(top.length, bot.length);
    for (let i = 0; i < nPairH; i++) midTies.push({ x1: top[i].cx, y1: stY0, x2: bot[i].cx, y2: stY1 });
  }
  return (
    <SvgFrame compact viewBox={`0 0 ${vbW} ${vbH}`} caption={cap}>
      {shape === "circ" ? (
        <circle cx={cx} cy={cy} r={rCirc} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.55" />
      ) : shape === "L" ? (
        <path
          d={`M${sx} ${sy} h${e} v${ht - e} h${w - e} v${e} h${-w} z`}
          fill="url(#conc)"
          stroke="#1a4473"
          strokeWidth="1.55"
        />
      ) : shape === "T" ? (
        <path
          d={`M${sx} ${sy} h${w} v${e} H${wx + e} V${sy + ht} H${wx} V${sy + e} H${sx} Z`}
          fill="url(#conc)"
          stroke="#1a4473"
          strokeWidth="1.55"
        />
      ) : (
        <rect x={sx} y={sy} width={w} height={ht} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.55" />
      )}
      {shape === "circ" ? (
        <circle
          cx={cx}
          cy={cy}
          r={Math.max(8, rCirc - recFace - destPx / 2)}
          fill="none"
          stroke="#8b1e1e"
          strokeWidth={tEst}
        />
      ) : shape === "L" || shape === "T" ? null : (
        <g>
          <rect
            x={stX0}
            y={stY0}
            width={Math.max(10, stX1 - stX0)}
            height={Math.max(10, stY1 - stY0)}
            fill="none"
            stroke="#8b1e1e"
            strokeWidth={tEst}
            rx={Math.max(3, rBar + destPx / 2)}
          />
          <path
            d={`M ${stX0 + Math.min(16, (stX1 - stX0) * 0.22)} ${stY0 + Math.min(12, (stY1 - stY0) * 0.12)} L ${stX0} ${stY0} L ${stX0} ${stY0 + Math.min(18, (stY1 - stY0) * 0.18)}`}
            fill="none"
            stroke="#8b1e1e"
            strokeWidth={tEst}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {midTies.map((t, i) => (
        <line
          key={`tie-${i}`}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="#8b1e1e"
          strokeWidth={Math.max(1.2, tEst * 0.72)}
          strokeLinecap="round"
          opacity="0.92"
        />
      ))}
      {dots.map((d, i) => (
        <circle key={`b-${i}`} cx={d.cx} cy={d.cy} r={rBar} fill="#8b1e1e" stroke="#3b0d0d" strokeWidth="0.6" />
      ))}
      <Dim x1={sx} y1={sy + ht} x2={sx + w} y2={sy + ht} label={`${b.toFixed(0)}`} field={widthField} unit="cm" side={sideB} active={active} onFocus={onFocus} />
      <Dim
        x1={sx}
        y1={sy}
        x2={sx}
        y2={sy + ht}
        label={`${h.toFixed(0)}`}
        field={heightField}
        unit="cm"
        side={sideH}
        active={active}
        onFocus={onFocus}
      />
      {showRecDim && shape !== "circ" && shape !== "L" && shape !== "T" ? (
        <Dim
          x1={sx + w}
          y1={sy + ht - recPx}
          x2={sx + w}
          y2={sy + ht}
          label={`${rec.toFixed(0)}`}
          field="rec"
          unit="cm"
          side={-sideR}
          active={active}
          onFocus={onFocus}
        />
      ) : null}
      {showElevCol ? (() => {
        const ex = sx + w + padR + 10;
        const ew = 46;
        const eh = 188;
        const ey = 28;
        const loF = Math.min(0.42, Math.max(0.16, loCm / Math.max(LuCm, 1)));
        const ticks: { y: number; dense: boolean }[] = [];
        const first = 5 / Math.max(LuCm, 1);
        const stepA = Math.max(0.03, sConf / Math.max(LuCm, 1));
        const stepC = Math.max(0.04, sRest / Math.max(LuCm, 1));
        ticks.push({ y: ey + eh - first * eh, dense: true });
        ticks.push({ y: ey + first * eh, dense: true });
        for (let t = first + stepA; t <= loF + 1e-6; t += stepA) {
          ticks.push({ y: ey + eh - t * eh, dense: true });
          ticks.push({ y: ey + t * eh, dense: true });
        }
        for (let t = loF + stepC; t < 1 - loF; t += stepC) {
          ticks.push({ y: ey + eh - t * eh, dense: false });
        }
        return (
          <g>
            <text x={ex + ew / 2} y={ey - 8} textAnchor="middle" fontSize="8.5" fill="#8a6a32" fontFamily="IBM Plex Sans, sans-serif">
              Elevación
            </text>
            <rect x={ex} y={ey} width={ew} height={eh} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.2" />
            <rect x={ex} y={ey} width={ew} height={eh * loF} fill="#8b1e1e" opacity="0.08" />
            <rect x={ex} y={ey + eh - eh * loF} width={ew} height={eh * loF} fill="#8b1e1e" opacity="0.08" />
            {ticks.map((t, i) => (
              <line key={`ce-${i}`} x1={ex + 3} y1={t.y} x2={ex + ew - 3} y2={t.y} stroke="#8b1e1e" strokeWidth={t.dense ? 1.5 : 0.95} />
            ))}
            <text x={ex + ew + 4} y={ey + 10} fontSize="7.5" fill="#8b1e1e" fontFamily="ui-monospace, monospace">
              ℓo @{sConf.toFixed(0)}
            </text>
            <text x={ex + ew + 4} y={ey + eh / 2} fontSize="7.5" fill="#1a4473" fontFamily="ui-monospace, monospace">
              @{sRest.toFixed(0)}
            </text>
            <text x={ex + ew + 4} y={ey + eh - 4} fontSize="7.5" fill="#8b1e1e" fontFamily="ui-monospace, monospace">
              ℓo @{sConf.toFixed(0)}
            </text>
          </g>
        );
      })() : null}
    </SvgFrame>
  );
}

function VigaSeccion({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const b0 = n(values, "b", 25);
  const h0 = n(values, "h", 50);
  const b = b0 < 10 ? b0 * 100 : b0;
  const h = h0 < 10 ? h0 * 100 : h0;
  const rec = n(values, "rec", 5);
  const dest = n(values, "dest", 0.95);
  const sideH = 28;
  const sideB = 28;
  const sideR = 36;
  const padL = cotaPad(sideH) + 14;
  const padT = 12;
  const padR = cotaPad(sideR) + 8;
  const padB = cotaPad(sideB) + 8;
  const sc = Math.min(5.4, 200 / Math.max(h, 1), 150 / Math.max(b, 1));
  const w = Math.max(40, b * sc);
  const ht = Math.max(56, h * sc);
  const sx = padL;
  const sy = padT;
  const recFace = Math.max(6, rec * sc);
  const destPx = Math.max(1.5, dest * sc);
  const barR = Math.max(4.2, Math.min(6.5, w * 0.055));
  const tEst = destPx;
  const recPx = recFace;
  const stOff = recFace + destPx / 2;
  const barOff = recFace + destPx + barR;
  const sAp = n(values, "sApoyo", n(values, "sAd", 0));
  const sMidN = n(values, "sCentro", n(values, "sMid", sAp));
  const L = n(values, "L", 6);
  const Lzona = n(values, "Lzona", Math.min(L / 4, (2 * h) / 100));
  const sAd = values.sAd ?? values.sApoyo;
  const sMid = values.sMid ?? values.sCentro;
  const barEst = values.barEst ?? '3/8"';
  const arreglo = values.arreglo ?? "";
  const showElev = sAp > 0;
  const elevW = showElev ? 340 : 0;
  const vbW = Math.ceil(padL + w + padR + (showElev ? elevW + 12 : 0));
  const vbH = Math.max(Math.ceil(padT + ht + padB), showElev ? 228 : 0);
  const cap = sAd
    ? `Estribos ${barEst} ${values.nRamas ?? "2"}R  ·  ${arreglo || `@ ${sAd} / ${sMid ?? sAd} cm`}`
    : `Sección ${b.toFixed(0)} × ${h.toFixed(0)} cm — recubrimiento y armado`;
  const x0 = padL + w + padR + 8;
  const x1 = vbW - 18;
  const yTop = 38;
  const yBot = 96;
  const ticks: { x: number; dense: boolean }[] = [];
  const zFrac = Math.min(0.42, Math.max(0.14, Lzona / Math.max(L, 0.2)));
  if (showElev) {
    const span = Math.max(40, x1 - x0);
    const first = 5 / Math.max(L * 100, 1);
    const stepA = Math.max(0.028, sAp / Math.max(L * 100, 1));
    const stepC = Math.max(0.04, sMidN / Math.max(L * 100, 1));
    ticks.push({ x: x0 + first * span, dense: true });
    ticks.push({ x: x1 - first * span, dense: true });
    for (let t = first + stepA; t <= zFrac + 1e-6; t += stepA) {
      ticks.push({ x: x0 + t * span, dense: true });
      ticks.push({ x: x1 - t * span, dense: true });
    }
    for (let t = zFrac + stepC; t < 1 - zFrac; t += stepC) {
      ticks.push({ x: x0 + t * span, dense: false });
    }
  }
  return (
    <SvgFrame compact viewBox={`0 0 ${vbW} ${vbH}`} caption={cap}>
      <rect x={sx} y={sy} width={w} height={ht} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
      <rect
        x={sx + stOff}
        y={sy + stOff}
        width={Math.max(8, w - 2 * stOff)}
        height={Math.max(8, ht - 2 * stOff)}
        fill="none"
        stroke="#8b1e1e"
        strokeWidth={tEst}
        rx={Math.max(3, barR + destPx / 2)}
      />
      {[0.24, 0.5, 0.76].map((px) => (
        <circle key={`inf-${px}`} cx={sx + w * px} cy={sy + ht - barOff} r={barR} fill="#8b1e1e" />
      ))}
      {[0.24, 0.76].map((px) => (
        <circle key={`sup-${px}`} cx={sx + w * px} cy={sy + barOff} r={barR * 0.82} fill="#8b1e1e" />
      ))}
      <Dim x1={sx} y1={sy + ht} x2={sx + w} y2={sy + ht} label={`${b.toFixed(0)}`} field="b" unit="cm" side={sideB} active={active} onFocus={onFocus} />
      <Dim x1={sx} y1={sy} x2={sx} y2={sy + ht} label={`${h.toFixed(0)}`} field="h" unit="cm" side={sideH} active={active} onFocus={onFocus} />
      <Dim x1={sx + w} y1={sy + ht - recPx} x2={sx + w} y2={sy + ht} label={`${rec.toFixed(0)}`} field="rec" unit="cm" side={-sideR} active={active} onFocus={onFocus} />
      {showElev ? (
        <g>
          <text x={(x0 + x1) / 2} y="16" textAnchor="middle" fontSize="10" fill="#8a6a32" fontFamily="IBM Plex Sans, sans-serif">
            Elevación — despiece de estribos
          </text>
          <polygon points={`${x0},${yBot + 4} ${x0 - 9},${yBot + 16} ${x0 + 9},${yBot + 16}`} fill="#1a4473" />
          <polygon points={`${x1},${yBot + 4} ${x1 - 9},${yBot + 16} ${x1 + 9},${yBot + 16}`} fill="#1a4473" />
          <rect x={x0} y={yTop} width={x1 - x0} height={yBot - yTop} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.3" />
          <rect x={x0} y={yTop} width={(x1 - x0) * zFrac} height={yBot - yTop} fill="#8b1e1e" opacity="0.06" />
          <rect x={x1 - (x1 - x0) * zFrac} y={yTop} width={(x1 - x0) * zFrac} height={yBot - yTop} fill="#8b1e1e" opacity="0.06" />
          {ticks.map((t, i) => (
            <line key={i} x1={t.x} y1={yTop + 2} x2={t.x} y2={yBot - 2} stroke="#8b1e1e" strokeWidth={t.dense ? 1.7 : 1} />
          ))}
          <text x={x0 + 6} y={yTop - 5} fontSize="8.5" fill="#8b1e1e" fontFamily="ui-monospace, monospace">
            1@5 + @{sAp.toFixed(0)}
          </text>
          <text x={x1 - 6} y={yTop - 5} textAnchor="end" fontSize="8.5" fill="#8b1e1e" fontFamily="ui-monospace, monospace">
            1@5 + @{sAp.toFixed(0)}
          </text>
          <text x={x0 + (x1 - x0) * zFrac * 0.5} y={yBot + 22} textAnchor="middle" fontSize="8" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
            ℓo
          </text>
          <text x={(x0 + x1) / 2} y={yBot + 22} textAnchor="middle" fontSize="8" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
            resto @{sMidN.toFixed(0)} · L={L.toFixed(2)} m
          </text>
          <text x={x1 - (x1 - x0) * zFrac * 0.5} y={yBot + 22} textAnchor="middle" fontSize="8" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
            ℓo
          </text>
          {arreglo ? (
            <text x={(x0 + x1) / 2} y={yBot + 38} textAnchor="middle" fontSize="8" fill="#8b1e1e" fontFamily="ui-monospace, monospace">
              {arreglo}
            </text>
          ) : null}
        </g>
      ) : null}
    </SvgFrame>
  );
}

function Zapata({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const t1 = n(values, "t1", 0.4);
  const t2 = n(values, "t2", 0.4);
  const B = n(values, "B", Math.max(2.4, t1 + 1.6));
  const L = n(values, "L", Math.max(2.4, t2 + 1.6));
  const hf = n(values, "hf", n(values, "hAd", 0.5));
  const Df = n(values, "Df", 1.5);
  const ex = n(values, "ex", 0);
  const ey = n(values, "ey", 0);
  const FX = n(values, "FX", 0);
  const FY = n(values, "FY", 0);
  const FZ = n(values, "FZ", n(values, "PD", 80) + n(values, "PL", 30));
  const sc = 200 / Math.max(B, L, 2.2);
  const ox = 46;
  const oy = 42;
  const w = L * sc;
  const h = B * sc;
  const cw = t2 * sc;
  const ch = t1 * sc;
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  const rx = cx + ex * sc;
  const ry = cy - ey * sc;
  const elevX = ox + w + 54;
  const elevW = 118;
  const soilY = 250;
  const colW = Math.max(14, t1 * 36);
  return (
    <SvgFrame compact viewBox="0 0 520 340" caption="Planta XY — columna, resultante y cortes FX, FY">
      <rect x={ox} y={oy} width={w} height={h} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
      <rect x={cx - cw / 2} y={cy - ch / 2} width={cw} height={ch} fill="#c4d4e8" stroke="#1a4473" strokeWidth="1.3" />
      <line x1={ox - 8} y1={cy} x2={ox + w + 18} y2={cy} stroke="#1a4473" strokeWidth="0.9" markerEnd="url(#arr)" />
      <line x1={cx} y1={oy + h + 8} x2={cx} y2={oy - 16} stroke="#1a4473" strokeWidth="0.9" markerEnd="url(#arr)" />
      <text x={ox + w + 22} y={cy + 4} fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">X</text>
      <text x={cx + 6} y={oy - 20} fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">Y</text>
      <circle cx={cx} cy={cy} r="2.4" fill="#1a4473" />
      <circle cx={rx} cy={ry} r="4.2" fill="#fbf8f1" stroke="#8b1e1e" strokeWidth="1.5" />
      <text x={rx + 8} y={ry - 8} fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
        R (ex, ey)
      </text>
      {FX !== 0 ? (
        <line x1={cx} y1={cy} x2={cx + Math.sign(FX) * 36} y2={cy} stroke="#8b1e1e" strokeWidth="1.4" markerEnd="url(#arr)" />
      ) : null}
      {FY !== 0 ? (
        <line x1={cx} y1={cy} x2={cx} y2={cy - Math.sign(FY) * 36} stroke="#8b1e1e" strokeWidth="1.4" markerEnd="url(#arr)" />
      ) : null}
      <text x={cx} y={oy + h + 28} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        L = {L.toFixed(2)} m
      </text>
      <text x={ox - 10} y={cy} textAnchor="end" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {`B=${B.toFixed(2)}`}
      </text>
      <text x={ox} y={28} fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
        {`FZ=${FZ.toFixed(1)} t   ex=${ex.toFixed(2)} m   ey=${ey.toFixed(2)} m`}
      </text>
      <rect x={elevX} y={soilY} width={elevW} height="48" fill="url(#soil)" />
      <rect x={elevX + 12} y={soilY - hf * 70} width={elevW - 24} height={hf * 70} fill="url(#conc)" stroke="#1a4473" />
      <rect x={elevX + elevW / 2 - colW / 2} y={70} width={colW} height={soilY - hf * 70 - 70} fill="url(#conc)" stroke="#1a4473" />
      <text x={elevX + elevW / 2} y={62} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        Df={Df.toFixed(2)} m
      </text>
      <Dim
        x1={ox}
        y1={oy + h}
        x2={ox + w}
        y2={oy + h}
        label={L.toFixed(2)}
        unit="m"
        side={22}
        active={active}
        onFocus={onFocus}
      />
    </SvgFrame>
  );
}

function ZapataComb({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const L = n(values, "Lz", n(values, "L", 7.2));
  const B = n(values, "b", n(values, "B", 2.4));
  const tA1 = n(values, "tA1", 0.4);
  const tA2 = n(values, "tA2", 0.4);
  const tB1 = n(values, "tB1", 0.5);
  const tB2 = n(values, "tB2", 0.5);
  const xA = n(values, "xA", 0.4);
  const xB = n(values, "xB", 5.4);
  const xR = n(values, "xR", L / 2);
  const hf = n(values, "hf", n(values, "hAd", 0.6));
  const Df = n(values, "Df", 1.5);
  const sc = 200 / Math.max(L, 4);
  const ox = 40;
  const oy = 48;
  const w = L * sc;
  const h = B * sc;
  const toX = (x: number) => ox + x * sc;
  const midY = oy + h / 2;
  return (
    <SvgFrame
      compact
      heading="Geometría"
      caption={`Planta — columnas A y B, resultante y vuelos · Corte Df = ${Df.toFixed(2)} m · hf = ${hf.toFixed(2)} m`}
      layers={[
        {
          viewBox: "0 0 520 300",
          children: (
            <>
              <rect x={ox} y={oy} width={w} height={h} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
              <rect
                x={toX(xA) - (tA2 * sc) / 2}
                y={midY - (tA1 * sc) / 2}
                width={tA2 * sc}
                height={tA1 * sc}
                fill="#c4d4e8"
                stroke="#1a4473"
                strokeWidth="1.3"
              />
              <rect
                x={toX(xB) - (tB2 * sc) / 2}
                y={midY - (tB1 * sc) / 2}
                width={tB2 * sc}
                height={tB1 * sc}
                fill="#c4d4e8"
                stroke="#1a4473"
                strokeWidth="1.3"
              />
              <text x={toX(xA)} y={midY + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
                A
              </text>
              <text x={toX(xB)} y={midY + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
                B
              </text>
              <circle cx={toX(xR)} cy={midY} r="4.2" fill="#fbf8f1" stroke="#8b1e1e" strokeWidth="1.5" />
              <text x={toX(xR) + 8} y={oy + 14} fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
                R
              </text>
              <Dim x1={ox} y1={oy + h} x2={ox + w} y2={oy + h} label={L.toFixed(2)} field="Lz" unit="m" side={22} active={active} onFocus={onFocus} />
              <Dim x1={ox} y1={oy} x2={ox} y2={oy + h} label={B.toFixed(2)} field="b" unit="m" side={28} active={active} onFocus={onFocus} />
              <Dim x1={toX(xA)} y1={oy} x2={toX(xB)} y2={oy} label={(xB - xA).toFixed(2)} field="eje" unit="m" side={-18} active={active} onFocus={onFocus} />
            </>
          ),
        },
        {
          viewBox: "0 0 520 220",
          children: (
            <>
              <rect x="160" y="150" width="200" height="44" fill="url(#soil)" />
              <rect x="176" y={150 - hf * 90} width="168" height={hf * 90} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.5" />
              <text x="260" y="48" textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
                Df = {Df.toFixed(2)} m
              </text>
              <Dim
                x1={176}
                y1={150 - hf * 90}
                x2={176}
                y2={150}
                label={hf.toFixed(2)}
                field="hf"
                unit="m"
                side={-22}
                active={active}
                onFocus={onFocus}
              />
            </>
          ),
        },
      ]}
    />
  );
}

function ZapataCorrida({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const B = n(values, "B", 1.6);
  const hf = n(values, "hf", 0.45);
  const tw = n(values, "tw", 0.25);
  const t1 = n(values, "t1", 0.3);
  const tipo = String(values.tipo ?? "muro");
  const c = tipo === "columnas" ? t1 : tw;
  const Df = n(values, "Df", 1.5);
  const sc = 180 / Math.max(B, 1.2);
  const ox = 70;
  const oy = 90;
  const w = B * sc;
  const cw = c * sc;
  return (
    <SvgFrame compact viewBox="0 0 520 300" caption={tipo === "columnas" ? "Sección — corrida de columnas" : "Sección — zapata corrida de muro"}>
      <rect x={ox} y={oy + 90} width={w} height="50" fill="url(#soil)" />
      <rect x={ox} y={oy + 90 - hf * 80} width={w} height={hf * 80} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.5" />
      <rect x={ox + w / 2 - cw / 2} y={50} width={cw} height={oy + 90 - hf * 80 - 50} fill="url(#conc)" stroke="#1a4473" />
      <text x={ox + w / 2} y={42} textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {tipo === "columnas" ? "Columna" : "Muro"}
      </text>
      <Dim x1={ox} y1={oy + 90} x2={ox + w} y2={oy + 90} label={B.toFixed(2)} field="B" unit="m" side={28} active={active} onFocus={onFocus} />
      <Dim x1={ox + w / 2 - cw / 2} y1={oy + 90 - hf * 80} x2={ox + w / 2 + cw / 2} y2={oy + 90 - hf * 80} label={c.toFixed(2)} field={tipo === "columnas" ? "t1" : "tw"} unit="m" side={-16} active={active} onFocus={onFocus} />
      <text x={ox + w + 16} y={oy + 40} fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        h={hf.toFixed(2)} m
      </text>
      <text x={ox + w + 16} y={oy + 56} fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        Df={Df.toFixed(2)} m
      </text>
    </SvgFrame>
  );
}

function PlateaGrid({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const nBayX = Math.max(1, Math.round(n(values, "nBayX", 3)));
  const nBayY = Math.max(1, Math.round(n(values, "nBayY", 3)));
  const Sx = n(values, "Sx", 5);
  const Sy = n(values, "Sy", 5);
  const ox = n(values, "ox", 0.5);
  const oy = n(values, "oy", 0.5);
  const Lx = n(values, "Lx", nBayX * Sx + 2 * ox);
  const Ly = n(values, "Ly", nBayY * Sy + 2 * oy);
  const t = n(values, "t", 0.45);
  const c = n(values, "c", 0.4);
  const nColX = nBayX + 1;
  const nColY = nBayY + 1;
  const px = 48;
  const py = 40;
  const sc = Math.min(400 / Math.max(Lx, 1), 240 / Math.max(Ly, 1));
  const w = Lx * sc;
  const h = Ly * sc;
  return (
    <SvgFrame compact viewBox="0 0 520 340" caption="Planta — malla de columnas y franja interior X">
      <rect x={px} y={py} width={w} height={h} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
      <rect x={px} y={py + (oy + Sy - Sy / 2) * sc} width={w} height={Sy * sc} fill="#8b1e1e" fillOpacity="0.08" stroke="#8b1e1e" strokeWidth="0.8" strokeDasharray="4 3" />
      {Array.from({ length: nColY }, (_, j) =>
        Array.from({ length: nColX }, (_, i) => {
          const x = px + (ox + i * Sx) * sc;
          const y = py + (oy + j * Sy) * sc;
          const cs = Math.max(5, c * sc);
          const edge = i === 0 || j === 0 || i === nColX - 1 || j === nColY - 1;
          return <rect key={`${i}-${j}`} x={x - cs / 2} y={y - cs / 2} width={cs} height={cs} fill={edge ? "#c4d4e8" : "#1a4473"} stroke="#1a4473" strokeWidth="1" />;
        })
      )}
      <Dim x1={px} y1={py + h} x2={px + w} y2={py + h} label={Lx.toFixed(2)} field="Sx" unit="m" side={22} active={active} onFocus={onFocus} />
      <Dim x1={px} y1={py} x2={px} y2={py + h} label={Ly.toFixed(2)} field="Sy" unit="m" side={28} active={active} onFocus={onFocus} />
      <text x={px + 8} y={py + 14} fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
        Franja int. X · t={t.toFixed(2)} m
      </text>
      <text x={px + w - 4} y={py - 8} textAnchor="end" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {nColX} × {nColY} cols
      </text>
    </SvgFrame>
  );
}

type IsoO = { ox: number; oy: number; sx: number; sz: number };
type IsoPt = [number, number, number];
type IsoFace = { pts: IsoPt[]; fill: string; depth: number };

function isoXY(x: number, y: number, z: number, o: IsoO) {
  const c30 = Math.sqrt(3) / 2;
  const s30 = 0.5;
  return {
    x: o.ox + (x - y) * c30 * o.sx,
    y: o.oy + (x + y) * s30 * o.sx - z * o.sz,
  };
}

function isoPts(pts: IsoPt[], o: IsoO) {
  return pts
    .map(([x, y, z]) => {
      const p = isoXY(x, y, z, o);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

/** Escala y centra un isométrico dejando margen interno en el viewBox. */
function fitIso(pts: IsoPt[], targetW: number, targetH: number, margin: number): IsoO {
  const probe: IsoO = { ox: 0, oy: 0, sx: 50, sz: 56 };
  const xy = pts.map(([x, y, z]) => isoXY(x, y, z, probe));
  const minX = Math.min(...xy.map((p) => p.x));
  const maxX = Math.max(...xy.map((p) => p.x));
  const minY = Math.min(...xy.map((p) => p.y));
  const maxY = Math.max(...xy.map((p) => p.y));
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const k = Math.min((targetW - 2 * margin) / bw, (targetH - 2 * margin) / bh);
  return {
    ox: margin + (targetW - 2 * margin - bw * k) / 2 - minX * k,
    oy: margin + (targetH - 2 * margin - bh * k) / 2 - minY * k,
    sx: 50 * k,
    sz: 56 * k,
  };
}

function shadeHex(hex: string, lit: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Math.round(Math.min(255, Math.max(0, parseInt(n.slice(0, 2), 16) * lit)));
  const g = Math.round(Math.min(255, Math.max(0, parseInt(n.slice(2, 4), 16) * lit)));
  const b = Math.round(Math.min(255, Math.max(0, parseInt(n.slice(4, 6), 16) * lit)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Cara opaca con iluminación y profundidad para painter's algorithm (isométrico). */
function pushIsoFace(out: IsoFace[], pts: IsoPt[], base: string) {
  if (pts.length < 3) return;
  const a = pts[0];
  const b = pts[1];
  const c = pts[2];
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  // Cámara isométrica aproximada (mira desde +X/+Y/+Z)
  const facing = (nx * 0.55 + ny * 0.55 + nz * 0.75) / len;
  if (facing <= 0.02) return;
  const lit = 0.52 + 0.48 * Math.min(1, Math.max(0, facing));
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const p of pts) {
    sx += p[0];
    sy += p[1];
    sz += p[2];
  }
  const n = pts.length;
  // Mayor profundidad = más lejos (se dibuja primero)
  const depth = (sx + sy) / n - 0.42 * (sz / n);
  out.push({ pts, fill: shadeHex(base, lit), depth });
}

function pushIsoBox(
  out: IsoFace[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  pal: { top: string; bot: string; xLo: string; xHi: string; yLo: string; yHi: string }
) {
  // top / bottom
  pushIsoFace(out, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], pal.top);
  pushIsoFace(out, [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], pal.bot);
  // X faces
  pushIsoFace(out, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], pal.xLo);
  pushIsoFace(out, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], pal.xHi);
  // Y faces
  pushIsoFace(out, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], pal.yLo);
  pushIsoFace(out, [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], pal.yHi);
}

function buildEscaleraIsoFaces(
  L: number,
  a: number,
  dLand: number,
  H1: number,
  n1: number,
  n2: number,
  dx1: number,
  dx2: number,
  c: number,
  e: number
): IsoFace[] {
  const faces: IsoFace[] = [];
  const th = Math.max(e, 0.08);
  const conc = {
    top: "#e6ddd0",
    bot: "#9a8f7a",
    xLo: "#c4b79a",
    xHi: "#b5a88c",
    yLo: "#d2c6ae",
    yHi: "#bfb294",
  };
  const riser = {
    top: "#d8cfc0",
    bot: "#8f8572",
    xLo: "#a89878",
    xHi: "#b9ad93",
    yLo: "#cfc4ae",
    yHi: "#b9ad93",
  };

  // —— Tramo 1 (y = 0…a): huella + contrapaso macizos ——
  for (let i = 0; i < n1; i++) {
    const x0 = i * dx1;
    const x1 = (i + 1) * dx1;
    const z0 = i * c;
    const z1 = (i + 1) * c;
    // contrapaso
    pushIsoBox(faces, x0, Math.min(x0 + Math.min(th, dx1 * 0.45), x1), 0, a, z0, z1, riser);
    // huella
    pushIsoBox(faces, x0, x1, 0, a, z1 - th, z1, conc);
  }

  // —— Descanso macizo ——
  pushIsoBox(faces, L, L + dLand, 0, 2 * a, H1 - th, H1, {
    top: "#ddd4c4",
    bot: "#8a806c",
    xLo: "#c4b79a",
    xHi: "#b5a88c",
    yLo: "#d0c4ae",
    yHi: "#beb294",
  });

  // —— Tramo 2 (y = a…2a, retorno): huella + contrapaso ——
  for (let i = 0; i < n2; i++) {
    const x0 = L - i * dx2;
    const x1 = L - (i + 1) * dx2;
    const z0 = H1 + i * c;
    const z1 = H1 + (i + 1) * c;
    const xa = Math.min(x0, x1);
    const xb = Math.max(x0, x1);
    // contrapaso en el borde alto (x0)
    pushIsoBox(faces, Math.max(xa, x0 - Math.min(th, dx2 * 0.45)), x0, a, 2 * a, z0, z1, riser);
    // huella
    pushIsoBox(faces, xa, xb, a, 2 * a, z1 - th, z1, conc);
  }

  faces.sort((u, v) => u.depth - v.depth);
  return faces;
}

function Escalera({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const H = n(values, "H", 3);
  const L = n(values, "L", 3.2);
  const nTot = Math.max(4, Math.round(n(values, "nC", 16)));
  const n1 = Math.ceil(nTot / 2);
  const n2 = Math.max(1, nTot - n1);
  const bCm = n(values, "bHuella", 25);
  const a = n(values, "a", 1.2);
  const eCm = n(values, "e", 15);
  const e = eCm / 100;
  const c = H / nTot;
  const H1 = n1 * c;
  const dx1 = L / n1;
  const dx2 = L / n2;
  const dLand = a;
  const p = { active, onFocus };
  const font = "IBM Plex Sans, sans-serif";
  const mono = "ui-monospace, monospace";

  const geomW = L + dLand;
  const geomH = 2 * a;
  const sideA = -24;
  const sideLpl = 20;
  const padPl = cotaPad(sideA, COTA_EM, 5) + 28;
  const padPr = 40;
  const padPt = 38;
  const padPb = cotaPad(sideLpl, COTA_EM, 6) + 42;
  const scP = Math.min(460 / Math.max(geomW, 0.5), 250 / Math.max(geomH, 0.5));
  const PX = (x: number) => padPl + x * scP;
  const PY = (y: number) => padPt + (geomH - y) * scP;
  const plantaW = Math.ceil(padPl + geomW * scP + padPr);
  const plantaH = Math.ceil(padPt + geomH * scP + padPb);
  const treads1 = Array.from({ length: Math.max(0, n1 - 1) }, (_, i) => PX((i + 1) * dx1));
  const treads2 = Array.from({ length: Math.max(0, n2 - 1) }, (_, i) => PX((i + 1) * dx2));

  const walkLen = L + dLand + L;
  const slab = e;
  const sideH = -22;
  const sideC = 18;
  const padCl = cotaPad(sideH, COTA_EM, 5) + 26;
  const padCr = cotaPad(sideC, COTA_EM, 5) + 32;
  const padCt = 42;
  const padCb = cotaPad(18, COTA_EM, 6) + 30;
  const scX = 500 / Math.max(walkLen, 0.5);
  const scZ = 200 / Math.max(H + slab, 0.4);
  const CX = (s: number) => padCl + s * scX;
  const CZ = (z: number) => padCt + (H - z) * scZ;
  const ySoffit0 = CZ(0) + slab * scZ;
  const corteW = Math.ceil(padCl + walkLen * scX + padCr);
  const corteH = Math.ceil(ySoffit0 + padCb);
  const run1 = L / n1;
  const run2 = L / n2;
  const walkPts: string[] = [`${CX(0)},${CZ(0)}`];
  for (let i = 0; i < n1; i++) {
    walkPts.push(`${CX(i * run1)},${CZ((i + 1) * c)}`);
    walkPts.push(`${CX((i + 1) * run1)},${CZ((i + 1) * c)}`);
  }
  walkPts.push(`${CX(L + dLand)},${CZ(H1)}`);
  for (let i = 0; i < n2; i++) {
    const s0 = L + dLand + i * run2;
    walkPts.push(`${CX(s0)},${CZ(H1 + (i + 1) * c)}`);
    walkPts.push(`${CX(s0 + run2)},${CZ(H1 + (i + 1) * c)}`);
  }
  const soffitPts = [
    [CX(0), CZ(0) + slab * scZ],
    [CX(L), CZ(H1) + slab * scZ],
    [CX(L + dLand), CZ(H1) + slab * scZ],
    [CX(walkLen), CZ(H) + slab * scZ],
  ] as const;
  const soffit = [...soffitPts].reverse().map((pt) => pt.join(",")).join(" ");
  const recM = n(values, "rec", 2.5) / 100;
  const recPx = recM * scZ;
  const steelBot = [
    [CX(0), CZ(0) + (slab - recM) * scZ],
    [CX(L), CZ(H1) + (slab - recM) * scZ],
    [CX(L + dLand), CZ(H1) + (slab - recM) * scZ],
    [CX(walkLen), CZ(H) + (slab - recM) * scZ],
  ];
  const steelTopLand: [number, number][] = [
    [CX(L * 0.72), CZ(H1) - recPx],
    [CX(L + dLand + L * 0.18), CZ(H1) - recPx],
  ];
  const asT1 = values.asT1 || "As inf. T1";
  const asT2 = values.asT2 || "As inf. T2";
  const asD = values.asD || "As descanso";
  const asNeg = values.asNeg || "As sup.";
  const asDist = values.asTransv || values.asDist || "As transv.";

  const isoW = 580;
  const isoH = 420;
  const faces = buildEscaleraIsoFaces(L, a, dLand, H1, n1, n2, dx1, dx2, c, e);
  const o = fitIso(faces.flatMap((f) => f.pts), isoW, isoH, 48);

  return (
    <div className="fig-stack fig-stack-escalera">
      <SvgFrame clip heading="Planta" caption="Emplazamiento: tramo 1, descanso intermedio y tramo 2 (ida y retorno)" viewBox={`0 0 ${plantaW} ${plantaH}`}>
        <rect x={PX(0)} y={PY(2 * a)} width={L * scP} height={a * scP} fill="#f3eee3" stroke="#1a4473" strokeWidth="1.3" />
        <rect x={PX(0)} y={PY(a)} width={L * scP} height={a * scP} fill="#e7dfd0" stroke="#1a4473" strokeWidth="1.3" />
        <rect x={PX(L)} y={PY(2 * a)} width={dLand * scP} height={2 * a * scP} fill="#d9d0bd" stroke="#1a4473" strokeWidth="1.4" />
        {treads1.map((x, i) => (
          <line key={`t1-${i}`} x1={x} y1={PY(a)} x2={x} y2={PY(0)} stroke="#8a7344" strokeWidth="0.8" />
        ))}
        {treads2.map((x, i) => (
          <line key={`t2-${i}`} x1={x} y1={PY(2 * a)} x2={x} y2={PY(a)} stroke="#8a7344" strokeWidth="0.8" />
        ))}
        <polygon points={`${PX(L * 0.42)},${PY(a * 0.5) + 10} ${PX(L * 0.58)},${PY(a * 0.5)} ${PX(L * 0.42)},${PY(a * 0.5) - 10}`} fill="#1a4473" />
        <polygon points={`${PX(L * 0.58)},${PY(a * 1.5) - 10} ${PX(L * 0.42)},${PY(a * 1.5)} ${PX(L * 0.58)},${PY(a * 1.5) + 10}`} fill="#1a4473" />
        <text x={PX(L / 2)} y={PY(a * 0.5) + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily={font}>
          Tramo 1 · {n1} contrapasos
        </text>
        <text x={PX(L / 2)} y={PY(a * 0.5) + 16} textAnchor="middle" fontSize="8.5" fill="#7a3b2e" fontFamily={mono}>
          {asT1}
        </text>
        <text x={PX(L / 2)} y={PY(a * 1.5) + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily={font}>
          Tramo 2 · {n2} contrapasos
        </text>
        <text x={PX(L / 2)} y={PY(a * 1.5) + 16} textAnchor="middle" fontSize="8.5" fill="#7a3b2e" fontFamily={mono}>
          {asT2}
        </text>
        <text x={PX(L + dLand / 2)} y={PY(a) + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily={font}>
          Descanso
        </text>
        <text x={PX(L + dLand / 2)} y={PY(a) + 16} textAnchor="middle" fontSize="8" fill="#7a3b2e" fontFamily={mono}>
          {asD}
        </text>
        <text x={PX(0.12)} y={PY(0) - 10} fontSize="9" fill="#6b6458" fontFamily={font}>Piso N</text>
        <text x={PX(0.12)} y={PY(2 * a) + 14} fontSize="9" fill="#6b6458" fontFamily={font}>Piso N+1</text>
        <Dim x1={PX(0)} y1={PY(0) + 8} x2={PX(L)} y2={PY(0) + 8} label={`${L.toFixed(2)}`} field="L" unit="m" side={sideLpl} {...p} />
        <Dim x1={PX(0) - 6} y1={PY(a)} x2={PX(0) - 6} y2={PY(0)} label={`${a.toFixed(2)}`} field="a" unit="m" side={sideA} {...p} />
        <Dim x1={PX(dx1 * 0.05)} y1={PY(0) - 6} x2={PX(dx1 * 1.05)} y2={PY(0) - 6} label={`${bCm.toFixed(0)}`} field="bHuella" unit="cm" side={-16} {...p} />
        <text x={PX(L / 2)} y={PY(2 * a) + 28} textAnchor="middle" fontSize="8" fill="#6b6458" fontFamily={font}>
          Long. = flexión · Transv. {asDist} = dist. + temp. (no es estribo de corte)
        </text>
      </SvgFrame>

      <SvgFrame clip heading="Corte longitudinal" caption={`T1 + descanso + T2 · c = ${(c * 100).toFixed(1)} cm · e = ${eCm.toFixed(0)} cm · long. inf./sup. · transv. a 90°`} viewBox={`0 0 ${corteW} ${corteH}`}>
        <line x1={CX(0)} y1={CZ(0)} x2={CX(walkLen)} y2={CZ(0)} stroke="#cfc4ae" strokeWidth="1" />
        <polygon points={`${walkPts.join(" ")} ${soffit}`} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.3" />
        <polyline points={walkPts.join(" ")} fill="none" stroke="#1a4473" strokeWidth="1.1" />
        <polyline
          points={steelBot.map((pt) => pt.join(",")).join(" ")}
          fill="none"
          stroke="#8b2e1f"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {steelBot.map((pt, i) => (
          <circle key={`sb-${i}`} cx={pt[0]} cy={pt[1]} r="2.6" fill="#8b2e1f" />
        ))}
        <line
          x1={steelTopLand[0][0]}
          y1={steelTopLand[0][1]}
          x2={steelTopLand[1][0]}
          y2={steelTopLand[1][1]}
          stroke="#1a4473"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={steelTopLand[0][0]} cy={steelTopLand[0][1]} r="2.4" fill="#1a4473" />
        <circle cx={steelTopLand[1][0]} cy={steelTopLand[1][1]} r="2.4" fill="#1a4473" />
        {Array.from({ length: 7 }, (_, i) => {
          const t = (i + 1) / 8;
          const x = steelBot[0][0] + (steelBot[1][0] - steelBot[0][0]) * t;
          const y = steelBot[0][1] + (steelBot[1][1] - steelBot[0][1]) * t;
          return <line key={`d1-${i}`} x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="#8a6a32" strokeWidth="1.1" />;
        })}
        <text x={CX(L / 2)} y={CZ(H1 / 2) + 18} textAnchor="middle" fontSize="9.5" fill="#1a4473" fontFamily={font}>
          Tramo 1
        </text>
        <text x={CX(L / 2)} y={CZ(H1 / 2) + 30} textAnchor="middle" fontSize="8" fill="#8b2e1f" fontFamily={mono}>
          {asT1}
        </text>
        <text x={CX(L + dLand / 2)} y={CZ(H1) - 14} textAnchor="middle" fontSize="9.5" fill="#8a6a32" fontFamily={font}>
          Descanso · {asNeg}
        </text>
        <text x={CX(L + dLand + L / 2)} y={CZ(H1 + (H - H1) / 2) + 18} textAnchor="middle" fontSize="9.5" fill="#1a4473" fontFamily={font}>
          Tramo 2
        </text>
        <text x={CX(L + dLand + L / 2)} y={CZ(H1 + (H - H1) / 2) + 30} textAnchor="middle" fontSize="8" fill="#8b2e1f" fontFamily={mono}>
          {asT2}
        </text>
        <Dim x1={CX(0)} y1={ySoffit0 + 10} x2={CX(L)} y2={ySoffit0 + 10} label={`${L.toFixed(2)}`} field="L" unit="m" side={18} {...p} />
        <Dim x1={CX(0) - 10} y1={CZ(H)} x2={CX(0) - 10} y2={CZ(0)} label={`${H.toFixed(2)}`} field="H" unit="m" side={sideH} {...p} />
        <Dim x1={CX(walkLen) + 12} y1={CZ(c)} x2={CX(walkLen) + 12} y2={CZ(0)} label={`${(c * 100).toFixed(1)}`} unit="cm" side={sideC} {...p} />
        <text x={CX(0)} y={corteH - 10} fontSize="9" fill="#6b6458" fontFamily={mono}>Piso N</text>
        <text x={CX(walkLen) - 4} y={CZ(H) - 10} textAnchor="end" fontSize="9" fill="#6b6458" fontFamily={mono}>
          Piso N+1 · e = {eCm.toFixed(0)} cm
        </text>
      </SvgFrame>

      <SvgFrame
        clip
        heading="Corte de losa (acero)"
        caption={`Franja 1,00 m · e = ${eCm.toFixed(0)} cm · rec = ${(recM * 100).toFixed(1)} cm · transversal ${asDist}`}
        viewBox="0 0 420 168"
      >
        {(() => {
          const slabH = Math.max(44, eCm * 3.2);
          const xL = 48;
          const xR = 348;
          const yTop = 28;
          const yBot = yTop + slabH;
          const recPx = Math.max(7, Math.min(14, (recM / Math.max(e, 0.05)) * slabH));
          const yDist = yTop + recPx;
          const yPrin = yBot - recPx;
          return (
            <>
              <rect x={xL} y={yTop} width={xR - xL} height={slabH} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.3" />
              {/* Longitudinal (principal): cortado por el plano → círculos */}
              {Array.from({ length: 6 }, (_, i) => {
                const x = xL + 28 + i * ((xR - xL - 56) / 5);
                return <circle key={`inf-${i}`} cx={x} cy={yPrin} r="4" fill="#8b2e1f" />;
              })}
              {/* Transversal (distribución + temp.): continuo a 90°, con recubrimiento lateral */}
              <line
                x1={xL + recPx * 0.35}
                y1={yDist}
                x2={xR - recPx * 0.35}
                y2={yDist}
                stroke="#8a6a32"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              {/* Ganchos / remates extremos (continuidad visual de barra) */}
              <circle cx={xL + recPx * 0.35} cy={yDist} r="2.4" fill="#8a6a32" />
              <circle cx={xR - recPx * 0.35} cy={yDist} r="2.4" fill="#8a6a32" />
              <line x1={xL} y1={18} x2={xR} y2={18} stroke="#1a4473" strokeWidth="0.7" />
              <text x={(xL + xR) / 2} y={14} textAnchor="middle" fontSize="9" fill="#1a4473" fontFamily={font}>
                {asDist} (dist. + temp. · continuo a 90°)
              </text>
              <text x={360} y={yPrin + 4} fontSize="9" fill="#8b2e1f" fontFamily={mono}>
                {asT1}
              </text>
              <text x={360} y={yDist + 4} fontSize="9" fill="#8a6a32" fontFamily={mono}>
                {asDist}
              </text>
              <text x={16} y={yTop + slabH / 2} fontSize="10" fill="#1a4473" fontFamily={font}>
                e
              </text>
              <text x={(xL + xR) / 2} y={yBot + 18} textAnchor="middle" fontSize="9" fill="#6b6458" fontFamily={font}>
                Longitudinal al fondo (pendiente) · distribución continua encima, a 90°
              </text>
            </>
          );
        })()}
      </SvgFrame>

      <SvgFrame clip heading="Isométrico" caption="Vista isométrica sólida — tramos, descanso y espesor e (caras ocultas no se dibujan)" viewBox={`0 0 ${isoW} ${isoH}`}>
        {faces.map((f, i) => (
          <polygon
            key={i}
            points={isoPts(f.pts, o)}
            fill={f.fill}
            stroke="#5a4e3a"
            strokeWidth="0.55"
            strokeLinejoin="round"
            strokeOpacity="0.55"
          />
        ))}
        <text x={isoXY(L / 2, a * 0.5, H1 * 0.45, o).x} y={isoXY(L / 2, a * 0.5, H1 * 0.45, o).y} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily={font} fontWeight="600">
          Tramo 1
        </text>
        <text x={isoXY(L / 2, a * 1.5, H1 + (H - H1) * 0.45, o).x} y={isoXY(L / 2, a * 1.5, H1 + (H - H1) * 0.45, o).y} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily={font} fontWeight="600">
          Tramo 2
        </text>
        <text x={isoXY(L + dLand / 2, a, H1 + 0.12, o).x} y={isoXY(L + dLand / 2, a, H1 + 0.12, o).y} textAnchor="middle" fontSize="10" fill="#5c4a28" fontFamily={font} fontWeight="600">
          Descanso
        </text>
      </SvgFrame>
    </div>
  );
}

function AligeradoCorte({
  s,
  e,
  bw,
  rec,
  active,
  onFocus,
}: {
  s: number;
  e: number;
  bw: number;
  rec: number;
  active: string | null;
  onFocus: (k: string) => void;
}) {
  const p = { active, onFocus };
  const nRibs = 3;
  const tLos = e <= 12 ? Math.max(3, e * 0.3) : 5;
  const hLadr = Math.max(1, e - tLos);
  const brickW = Math.max(2, s - bw);
  const geomW = (nRibs - 1) * s + bw;
  const geomH = e;
  const sideE = 30;
  const sideS = 26;
  const sideBw = -22;
  const sideRec = 26;
  const padL = cotaPad(sideE, COTA_EM, 5) + 6;
  const padR = cotaPad(sideRec, COTA_EM, 5) + 8;
  const padT = cotaPad(Math.abs(sideBw), COTA_EM, 5) + 4;
  const padB = cotaPad(sideS, COTA_EM, 5) + 8;
  const availW = 430;
  const availH = 168;
  const sc = Math.min(availW / Math.max(geomW, 1), availH / Math.max(geomH, 1));
  const x0 = padL;
  const y0 = padT;
  const yBot = y0 + e * sc;
  const yLos = y0 + tLos * sc;
  const bwPx = bw * sc;
  const brickPx = brickW * sc;
  const sPx = s * sc;
  const totW = (nRibs - 1) * sPx + bwPx;
  const ribL = (i: number) => x0 + i * sPx;
  const ribC = (i: number) => ribL(i) + bwPx / 2;
  const recPx = Math.max(4, rec * sc);
  const barR = Math.max(3.2, Math.min(6, bwPx * 0.18));
  const barY = yBot - recPx - barR;
  const vbW = Math.ceil(padL + totW + padR);
  const vbH = Math.ceil(padT + e * sc + padB);
  const last = nRibs - 1;
  const concPath = [
    `M${ribL(0)},${yBot}`,
    `L${ribL(0)},${y0}`,
    `L${ribL(last) + bwPx},${y0}`,
    `L${ribL(last) + bwPx},${yBot}`,
    `L${ribL(last)},${yBot}`,
    ...Array.from({ length: nRibs - 1 }, (_, k) => {
      const i = last - k;
      return `L${ribL(i)},${yLos} L${ribL(i - 1) + bwPx},${yLos} L${ribL(i - 1) + bwPx},${yBot}`;
    }),
    "Z",
  ].join(" ");
  return (
    <SvgFrame
      heading="Sección"
      caption={`Módulo de aligerado — ${nRibs} viguetas · loseta ${tLos.toFixed(0)} cm · ladrillo ${hLadr.toFixed(0)} × ${brickW.toFixed(0)} cm`}
      viewBox={`0 0 ${vbW} ${vbH}`}
    >
      {Array.from({ length: nRibs - 1 }).map((_, i) => {
        const bx = ribL(i) + bwPx;
        const nCeldas = Math.max(2, Math.min(3, Math.round(brickW / 12)));
        const gap = brickPx * 0.08;
        const cw = (brickPx - gap * (nCeldas + 1)) / nCeldas;
        const ch = Math.max(8, hLadr * sc - 10);
        const cy = yLos + (hLadr * sc - ch) / 2;
        return (
          <g key={`ladr-${i}`}>
            <rect x={bx} y={yLos} width={brickPx} height={hLadr * sc} fill="#e8d6b0" stroke="#8a7344" strokeWidth="1.1" />
            {Array.from({ length: nCeldas }).map((_, k) => (
              <rect
                key={k}
                x={bx + gap + k * (cw + gap)}
                y={cy}
                width={Math.max(4, cw)}
                height={ch}
                fill="#f4ead4"
                stroke="#c4a574"
                strokeWidth="0.7"
                rx="1.2"
              />
            ))}
          </g>
        );
      })}
      <path d={concPath} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.5" strokeLinejoin="miter" />
      {Array.from({ length: nRibs }).map((_, i) => (
        <g key={`rib-${i}`}>
          <line
            x1={ribC(i)}
            y1={y0 - 2}
            x2={ribC(i)}
            y2={yBot + 4}
            stroke="#1a4473"
            strokeWidth="0.55"
            strokeDasharray="3 2.5"
            opacity="0.45"
          />
          <circle cx={ribC(i)} cy={barY} r={barR} fill="#fbf8f1" stroke="#8b1e1e" strokeWidth="1.2" />
        </g>
      ))}
      <line
        x1={ribL(last)}
        y1={yBot - recPx}
        x2={ribL(last) + bwPx}
        y2={yBot - recPx}
        stroke="#8b1e1e"
        strokeDasharray="3 2"
        strokeWidth="1"
      />
      <Dim x1={ribL(0)} y1={y0} x2={ribL(0)} y2={yBot} label={`${e}`} field="e" unit="cm" side={-sideE} {...p} />
      <Dim x1={ribL(0)} y1={y0} x2={ribL(0) + bwPx} y2={y0} label={`${bw}`} field="bw" unit="cm" side={sideBw} {...p} />
      <Dim x1={ribC(0)} y1={yBot} x2={ribC(1)} y2={yBot} label={`${s}`} field="s" unit="cm" side={sideS} {...p} />
      <Dim
        x1={ribL(last) + bwPx}
        y1={yBot}
        x2={ribL(last) + bwPx}
        y2={yBot - recPx}
        label={`${rec}`}
        field="rec"
        unit="cm"
        side={sideRec}
        {...p}
      />
    </SvgFrame>
  );
}

function Aligerado({ values, active, onFocus, part = "intro" }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void; part?: string }) {
  const s = n(values, "s", 40);
  const e = n(values, "e", n(values, "h", 20));
  const bw = n(values, "bw", 10);
  const rec = n(values, "rec", 3);
  const dCm = n(values, "dCm", rec + 1);
  const maciza = values.slabKind === "maciza";
  const model = decodeBeam(values.modelJson);
  const nodes = model?.nodes?.length ? model.nodes : [0, n(values, "L", 5)];
  const support = model?.support?.length ? model.support : nodes.map(() => true);
  const members = model?.members?.length ? model.members : [{ L: nodes[nodes.length - 1], kind: "span" as const, label: "Paño 1" }];
  const Ltot = Math.max(nodes[nodes.length - 1], 0.8);
  const W = 520;
  const pad = 36;
  const xOf = (x: number) => pad + (x / Ltot) * (W - 2 * pad);
  const yBeam = 78;
  const p = { active, onFocus };

  const xs = model?.x ?? [];
  const absPeak = (...arrs: (number[] | undefined)[]) =>
    Math.max(0.05, ...arrs.flatMap((a) => (a ?? []).map((v) => Math.abs(v))));
  const valAt = (arr: number[] | undefined, x: number) => {
    const vals = arr ?? [];
    if (!xs.length || !vals.length) return 0;
    let best = vals[0] ?? 0;
    let dist = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const di = Math.abs(xs[i] - x);
      if (di < dist) {
        dist = di;
        best = vals[i] ?? 0;
      }
    }
    return best;
  };
  const peakAt = (arr: number[] | undefined, x0: number, x1: number, mode: "max" | "min") => {
    const vals = arr ?? [];
    let bestI = -1;
    let best = mode === "max" ? -Infinity : Infinity;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < x0 - 1e-6 || xs[i] > x1 + 1e-6) continue;
      const v = vals[i];
      if (v == null) continue;
      if (mode === "max" ? v > best : v < best) {
        best = v;
        bestI = i;
      }
    }
    return bestI >= 0 ? { x: xs[bestI], v: best } : null;
  };

  const series = (arr: number[] | undefined, y0: number, h: number, color: string, fill: string, peak: number) => {
    const vals = arr ?? [];
    if (xs.length < 2 || vals.length < 2) return null;
    const pts = xs.map((x, i) => `${xOf(x).toFixed(1)},${(y0 - (vals[i] / peak) * h).toFixed(1)}`);
    const base = `${xOf(xs[0]).toFixed(1)},${y0} ${xOf(xs[xs.length - 1]).toFixed(1)},${y0}`;
  return (
      <g>
        <polygon points={`${pts.join(" ")} ${base}`} fill={fill} />
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.6" />
      </g>
    );
  };

  const odd = model?.patterns?.find((q) => q.id === "odd") ?? model?.patterns?.find((q) => /impares/i.test(q.name));
  const even = model?.patterns?.find((q) => q.id === "even") ?? model?.patterns?.find((q) => /pares/i.test(q.name) && !/impares/i.test(q.name));
  const allPat = model?.patterns?.find((q) => q.id === "all");
  const adjPats = (model?.patterns ?? [])
    .filter((q) => (q.id ?? "").startsWith("adj-"))
    .slice()
    .sort((a, b) => Number((a.id ?? "adj-0").slice(4)) - Number((b.id ?? "adj-0").slice(4)));
  const volIPat = model?.patterns?.find((q) => q.id === "volI");
  const volDPat = model?.patterns?.find((q) => q.id === "volD");
  const spanCount = members.filter((m) => m.kind === "span").length;
  const volOff = members[0]?.kind === "cantilever" ? 1 : 0;

  const loadArrows = (x0: number, x1: number, yTop: number, color: string, key: string) => {
    const w = Math.max(8, x1 - x0);
    const nArr = Math.max(3, Math.min(9, Math.round(w / 18)));
    return Array.from({ length: nArr }, (_, k) => {
      const x = x0 + ((k + 0.5) / nArr) * w;
      return (
        <g key={`${key}-${k}`}>
          <line x1={x} y1={yTop} x2={x} y2={yTop + 11} stroke={color} strokeWidth="1.05" />
          <polygon points={`${x},${yTop + 13} ${x - 2.3},${yTop + 8.2} ${x + 2.3},${yTop + 8.2}`} fill={color} />
        </g>
      );
    });
  };

  const dameroRow = (live: boolean[] | undefined, y: number, title: string, highlightNode?: number) => (
    <g>
      <text
        x={pad}
        y={y - 52}
        fontSize="9"
        fill="#6b6458"
        fontFamily="IBM Plex Sans, sans-serif"
        stroke="#fbf8f1"
        strokeWidth="3"
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {title}
      </text>
      <line x1={xOf(0)} y1={y} x2={xOf(Ltot)} y2={y} stroke="#1a4473" strokeWidth="3.2" strokeLinecap="round" />
      {nodes.map((x, i) =>
        support[i] ? (
          <g key={`ds-${title}-${i}`}>
            <polygon
              points={`${xOf(x)},${y + 2} ${xOf(x) - 6},${y + 13} ${xOf(x) + 6},${y + 13}`}
              fill={highlightNode === i ? "#8b1e1e" : "#1a4473"}
            />
            {highlightNode === i ? (
              <text x={xOf(x)} y={y + 24} textAnchor="middle" fontSize="7.5" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
                Mu−
              </text>
            ) : null}
          </g>
        ) : null
      )}
      {members.map((m, i) => {
        const xa = nodes[i];
        const xb = nodes[i + 1];
        const x0 = xOf(xa);
        const x1 = xOf(xb);
        const on = Boolean(live?.[i]);
        return (
          <g key={`d-${title}-${i}`}>
            <rect x={x0} y={y - 18} width={Math.max(4, x1 - x0)} height="10" fill="#8a6a32" fillOpacity="0.14" />
            {on ? (
              <>
                <rect x={x0} y={y - 18} width={Math.max(4, x1 - x0)} height="10" fill="#8b1e1e" fillOpacity="0.32" />
                {loadArrows(x0, x1, y - 28, "#8b1e1e", `${title}-${i}`)}
              </>
            ) : null}
            <text x={(x0 + x1) / 2} y={y + (highlightNode != null ? 36 : 26)} textAnchor="middle" fontSize="8" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
              {m.label}
              {on ? " · CV" : " · CM"}
            </text>
          </g>
        );
      })}
    </g>
  );

  const ROW = 96;
  const posRows: { live?: boolean[]; title: string }[] = [
    { live: odd?.live, title: "Acero inferior (Mu+) · CV en paños impares 1, 3, 5…" },
    ...(spanCount > 1 ? [{ live: even?.live, title: "Acero inferior (Mu+) · CV en paños pares 2, 4, 6…" }] : []),
  ];
  const negRows: { live?: boolean[]; title: string; highlight?: number }[] = [
    ...adjPats.map((q) => {
      const k = Number((q.id ?? "adj-0").slice(4)) || 0;
      return {
        live: q.live,
        title: `Acero superior (Mu−) · CV en paños ${k + 1} y ${k + 2} · apoyo ${k + 2}`,
        highlight: volOff + k + 1,
      };
    }),
    ...(adjPats.length === 0
      ? [{ live: allPat?.live, title: "Acero superior (Mu−) · CV llena · extremos empotrados o volado" }]
      : []),
    ...(volIPat ? [{ live: volIPat.live, title: "Acero superior (Mu−) · CV en volado izquierdo · primer apoyo", highlight: volOff }] : []),
    ...(volDPat
      ? [{ live: volDPat.live, title: "Acero superior (Mu−) · CV en volado derecho · último apoyo", highlight: nodes.length - 1 - (members[members.length - 1]?.kind === "cantilever" ? 1 : 0) }]
      : []),
  ];

  return (
    <>
      {part === "intro" || !part ? (
    <div className="fig-stack">
      {maciza ? (
      <SvgFrame
        heading="Sección"
        caption={`Losa maciza — franja 1.00 m · h = ${e} cm · rec = ${rec} cm`}
        viewBox="0 0 520 250"
      >
            <rect x="90" y="70" width="340" height={Math.min(140, e * 6)} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.5" />
            <line x1="90" y1={70 + rec * 6} x2="430" y2={70 + rec * 6} stroke="#8b1e1e" strokeDasharray="4 3" />
            <text x="260" y="55" textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
              Franja de diseño 1.00 m
            </text>
            <Dim x1={90} y1={70 + Math.min(140, e * 6)} x2={430} y2={70 + Math.min(140, e * 6)} label="1.00" unit="m" side={22} {...p} />
            <Dim x1={90} y1={70} x2={90} y2={70 + Math.min(140, e * 6)} label={`${e}`} field="h" unit="cm" side={-22} {...p} />
            <Dim x1={430} y1={70} x2={430} y2={70 + rec * 6} label={`${rec}`} field="rec" unit="cm" side={22} {...p} />
      </SvgFrame>
      ) : (
        <AligeradoCorte s={s} e={e} bw={bw} rec={rec} active={active} onFocus={onFocus} />
      )}

      <SvgFrame heading="Apoyos" caption="Modelo 2D: apoyos simples (triángulo) y volados. Cotas = luces de paño." viewBox="0 0 520 160">
        <line x1={xOf(0)} y1={yBeam} x2={xOf(Ltot)} y2={yBeam} stroke="#1a4473" strokeWidth="5" strokeLinecap="round" />
        {nodes.map((x, i) =>
          support[i] ? (
            <polygon
              key={`ap-${i}`}
              points={`${xOf(x)},${yBeam + 2} ${xOf(x) - 9},${yBeam + 20} ${xOf(x) + 9},${yBeam + 20}`}
              fill="#1a4473"
            />
          ) : (
            <circle key={`ap-${i}`} cx={xOf(x)} cy={yBeam} r="3.2" fill="#fbf8f1" stroke="#8a6a32" strokeWidth="1.4" />
          )
        )}
        {members.map((m, i) => (
          <text key={`lb-${i}`} x={(xOf(nodes[i]) + xOf(nodes[i + 1])) / 2} y={yBeam - 12} textAnchor="middle" fontSize="9" fill="#8a6a32" fontFamily="IBM Plex Sans, sans-serif">
            {m.label}
          </text>
        ))}
        {members.map((m, i) => {
          const spanIdx = members.slice(0, i).filter((x) => x.kind === "span").length;
          return m.kind === "span" ? (
            <Dim
              key={`Ln-${i}`}
              x1={xOf(nodes[i])}
              y1={yBeam}
              x2={xOf(nodes[i + 1])}
              y2={yBeam}
              label={m.L.toFixed(2)}
              field={`spanL${spanIdx}`}
              unit="m"
              side={28}
              {...p}
            />
          ) : (
            <Dim
              key={`vol-${i}`}
              x1={xOf(nodes[i])}
              y1={yBeam}
              x2={xOf(nodes[i + 1])}
              y2={yBeam}
              label={m.L.toFixed(2)}
              field={m.label.includes("I") ? "LvolI" : "LvolD"}
              unit="m"
              side={28}
              {...p}
            />
          );
        })}
    </SvgFrame>
    </div>
      ) : null}

      {part === "dameros" ? (
      <div className="fig-stack">
      <SvgFrame
        heading="Dameros Mu+ · acero inferior"
        caption="Patrones de vano (E.060 / ACI 6.4.3). Rojo + flechas = 1.7 CV. Beige = 1.4 CM, siempre. La CV en impares y pares maximiza el momento positivo a midspan (As+)."
        viewBox={`0 0 520 ${56 + posRows.length * ROW}`}
      >
        {posRows.map((row, i) => (
          <g key={`pos-${i}`}>{dameroRow(row.live, 72 + i * ROW, row.title)}</g>
        ))}
      </SvgFrame>
      <SvgFrame
        heading="Dameros Mu− · acero superior"
        caption="Patrones de apoyo: CV en los dos paños que llegan al nudo (triángulo rojo = Mu−). El CM sigue en toda la viga. Gobiernan el acero negativo de cara superior."
        viewBox={`0 0 520 ${56 + Math.max(1, negRows.length) * ROW}`}
      >
        {negRows.map((row, i) => (
          <g key={`neg-${i}`}>{dameroRow(row.live, 72 + i * ROW, row.title, row.highlight)}</g>
        ))}
      </SvgFrame>
      </div>
      ) : null}

      {part === "envolventeM" ? (
      <div className="fig-inline">
      <SvgFrame
        heading="Envolvente M"
        caption={`Momento flector (t·m). Mu+ máx = ${Math.max(0, ...(model?.steel ?? []).map((st) => st.MuPos ?? 0)).toFixed(2)}  ·  Mu− máx = ${Math.max(0, ...(model?.steel ?? []).map((st) => Math.max(st.MuNegL ?? 0, st.MuNegR ?? 0))).toFixed(2)}. Positivo = vano; negativo = apoyo.`}
        viewBox="0 0 520 220"
      >
        {(() => {
          const y0 = 108;
          const hAmp = 74;
          const mPeak = absPeak(model?.Mmax, model?.Mmin);
          return (
            <g>
              <line x1={xOf(0)} y1={y0} x2={xOf(Ltot)} y2={y0} stroke="#1a4473" strokeWidth="1.2" />
              {series(model?.Mmax, y0, hAmp, "#1f6b3a", "rgba(31,107,58,0.16)", mPeak)}
              {series(model?.Mmin, y0, hAmp, "#8b1e1e", "rgba(139,30,30,0.16)", mPeak)}
              {nodes.map((x, i) =>
                support[i] ? <line key={`gM-${i}`} x1={xOf(x)} y1={26} x2={xOf(x)} y2={190} stroke="#1a4473" strokeOpacity="0.15" /> : null
              )}
              <text x={pad} y={20} fontSize="9" fill="#1f6b3a" fontFamily="IBM Plex Sans, sans-serif">Mmáx vano + (t·m)</text>
              <text x={W - pad} y={20} textAnchor="end" fontSize="9" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">Mmín apoyo − (t·m)</text>
              <text x={8} y={y0 - hAmp + 4} fontSize="7.5" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace">{`+${mPeak.toFixed(2)}`}</text>
              <text x={8} y={y0 + 3} fontSize="7.5" fill="#6b6458" fontFamily="IBM Plex Mono, monospace">0</text>
              <text x={8} y={y0 + hAmp + 4} fontSize="7.5" fill="#8b1e1e" fontFamily="IBM Plex Mono, monospace">{`−${mPeak.toFixed(2)}`}</text>
              {(model?.steel ?? []).map((st, i) => {
                const x0 = nodes[i];
                const x1 = nodes[i + 1];
                if (x0 == null || x1 == null || !(st.MuPos && st.MuPos > 0.004)) return null;
                const pk = peakAt(model?.Mmax, x0 + 0.06 * st.Ln, x1 - 0.06 * st.Ln, "max");
                const x = pk?.x ?? (x0 + x1) / 2;
                const y = y0 - (st.MuPos / mPeak) * hAmp;
                return (
                  <text key={`mp-${i}`} x={xOf(x)} y={y - 5} textAnchor="middle" fontSize="8" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace">
                    {`+${st.MuPos.toFixed(2)}`}
                  </text>
                );
              })}
              {nodes.map((x, i) => {
                if (!support[i]) return null;
                const mu = Math.max(model?.steel?.[i - 1]?.MuNegR ?? 0, model?.steel?.[i]?.MuNegL ?? 0);
                if (mu < 0.004) return null;
                const y = y0 + (mu / mPeak) * hAmp;
                return (
                  <text key={`mn-${i}`} x={xOf(x)} y={Math.min(208, y + 12)} textAnchor="middle" fontSize="8" fill="#8b1e1e" fontFamily="IBM Plex Mono, monospace">
                    {`−${mu.toFixed(2)}`}
                  </text>
                );
              })}
            </g>
          );
        })()}
      </SvgFrame>
      </div>
      ) : null}

      {part === "envolventeV" ? (
      <div className="fig-inline">
      <SvgFrame
        heading="Envolvente V"
        caption={`Cortante (t). Vu se toma a d = ${dCm.toFixed(1)} cm de la cara del apoyo. Vu,máx = ${Math.max(0, ...(model?.steel ?? []).flatMap((st) => [st.VuL ?? 0, st.VuR ?? 0])).toFixed(3)} t.`}
        viewBox="0 0 520 210"
      >
        {(() => {
          const y0 = 100;
          const hAmp = 64;
          const vPeak = absPeak(model?.Vmax, model?.Vmin);
          const dM = Math.max(0.02, dCm / 100);
          return (
            <g>
              <line x1={xOf(0)} y1={y0} x2={xOf(Ltot)} y2={y0} stroke="#1a4473" strokeWidth="1.2" />
              {series(model?.Vmax, y0, hAmp, "#16324c", "rgba(22,50,76,0.14)", vPeak)}
              {series(model?.Vmin, y0, hAmp, "#8a6a32", "rgba(138,106,50,0.16)", vPeak)}
              {nodes.map((x, i) =>
                support[i] ? <line key={`gV-${i}`} x1={xOf(x)} y1={24} x2={xOf(x)} y2={176} stroke="#1a4473" strokeOpacity="0.15" /> : null
              )}
              <text x={pad} y={18} fontSize="9" fill="#16324c" fontFamily="IBM Plex Sans, sans-serif">Vmáx (t)</text>
              <text x={W - pad} y={18} textAnchor="end" fontSize="9" fill="#8a6a32" fontFamily="IBM Plex Sans, sans-serif">Vmín (t)</text>
              <text x={8} y={y0 - hAmp + 4} fontSize="7.5" fill="#16324c" fontFamily="IBM Plex Mono, monospace">{`+${vPeak.toFixed(2)}`}</text>
              <text x={8} y={y0 + 3} fontSize="7.5" fill="#6b6458" fontFamily="IBM Plex Mono, monospace">0</text>
              <text x={8} y={y0 + hAmp + 4} fontSize="7.5" fill="#8a6a32" fontFamily="IBM Plex Mono, monospace">{`−${vPeak.toFixed(2)}`}</text>
              {(model?.steel ?? []).map((st, i) => {
                const x0 = nodes[i];
                const x1 = nodes[i + 1];
                if (x0 == null || x1 == null) return null;
                const xL = Math.min(x1 - 0.02, x0 + dM);
                const xR = Math.max(x0 + 0.02, x1 - dM);
                const tags: { x: number; vu: number; vCurve: number }[] = [];
                if ((st.VuL ?? 0) > 0.004) tags.push({ x: xL, vu: st.VuL ?? 0, vCurve: valAt(model?.Vmax, xL) || valAt(model?.Vmin, xL) });
                if ((st.VuR ?? 0) > 0.004) tags.push({ x: xR, vu: st.VuR ?? 0, vCurve: valAt(model?.Vmin, xR) || valAt(model?.Vmax, xR) });
                return tags.map((t, k) => {
                  const y = y0 - (t.vCurve / vPeak) * hAmp;
                  const below = t.vCurve < 0;
                  return (
                    <text
                      key={`vu-${i}-${k}`}
                      x={xOf(t.x)}
                      y={below ? Math.min(198, y + 12) : Math.max(28, y - 5)}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#16324c"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {t.vu.toFixed(2)}
                    </text>
                  );
                });
              })}
            </g>
          );
        })()}
      </SvgFrame>
      </div>
      ) : null}

      {part === "corte" ? (
      <div className="fig-inline">
      <SvgFrame
        heading="Corte de aceros"
        caption="As+ inferior continuo. As− superior con corte: L teórica (inflexión), Lext = máx(Ln/16, d, 12db) y ld."
        viewBox="0 0 520 220"
      >
        <line x1={xOf(0)} y1={92} x2={xOf(Ltot)} y2={92} stroke="#1a4473" strokeWidth="4.5" strokeLinecap="round" />
        {nodes.map((x, i) =>
          support[i] ? (
            <polygon key={`s2-${i}`} points={`${xOf(x)},${94} ${xOf(x) - 8},${112} ${xOf(x) + 8},${112}`} fill="#1a4473" />
          ) : null
        )}
        {/* As+ inferior: una sola barra continua */}
        <line x1={xOf(0)} y1={118} x2={xOf(Ltot)} y2={118} stroke="#1f6b3a" strokeWidth="3.4" strokeLinecap="round" />
        <line x1={xOf(0)} y1={118} x2={xOf(0)} y2={108} stroke="#1f6b3a" strokeWidth="2.2" strokeLinecap="round" />
        <line x1={xOf(Ltot)} y1={118} x2={xOf(Ltot)} y2={108} stroke="#1f6b3a" strokeWidth="2.2" strokeLinecap="round" />
        {(model?.steel ?? []).map((st, i) => {
          const x0 = nodes[i];
          const x1 = nodes[i + 1];
          if (x0 == null || x1 == null) return null;
          return st.AsPos != null ? (
            <text key={`ap-${i}`} x={(xOf(x0) + xOf(x1)) / 2} y={148} textAnchor="middle" fontSize="8" fill="#1f6b3a" fontFamily="IBM Plex Mono, monospace">
              {`As+ ${st.AsPos.toFixed(2)} ${maciza ? "cm²/m" : "cm²"}`}
            </text>
          ) : null;
        })}
        {nodes.map((xs, i) => {
          if (!support[i]) return null;
          const left = model?.steel?.[i - 1];
          const right = model?.steel?.[i];
          const y = 50;
          const segs: { dir: -1 | 1; Lteo: number; Lext: number; Lcorte: number; As?: number }[] = [];
          if (left && left.LcorteNegR > 0.02) {
            segs.push({
              dir: -1,
              Lteo: left.LteoNegR ?? left.LteoNegL ?? left.LcorteNegR * 0.55,
              Lext: left.Lext,
              Lcorte: left.LcorteNegR,
              As: left.AsNegR,
            });
          }
          if (right && right.LcorteNegL > 0.02) {
            segs.push({
              dir: 1,
              Lteo: right.LteoNegL,
              Lext: right.Lext,
              Lcorte: right.LcorteNegL,
              As: right.AsNegL,
            });
          }
          return (
            <g key={`neg-${i}`}>
              {segs.map((sg, k) => {
                const noNeg = sg.Lteo < 0.02;
                const xTeo = xOf(xs + sg.dir * Math.min(sg.Lteo, sg.Lcorte));
                const xAncl = xOf(xs + sg.dir * Math.min(sg.Lteo + sg.Lext, sg.Lcorte));
                const xCut = xOf(xs + sg.dir * sg.Lcorte);
                const xSup = xOf(xs);
                const ldGoverns = noNeg || sg.Lcorte > sg.Lteo + sg.Lext + 0.015;
                const xLd0 = noNeg ? xSup : xAncl;
                return (
                  <g key={`ns-${i}-${k}`}>
                    <line x1={xSup} y1={y} x2={xCut} y2={y} stroke="#8b1e1e" strokeWidth="5" opacity="0.18" />
                    {!noNeg ? (
                      <>
                        <line x1={xSup} y1={y} x2={xTeo} y2={y} stroke="#8b1e1e" strokeWidth="3.3" strokeLinecap="butt" />
                        <line x1={xTeo} y1={y} x2={xAncl} y2={y} stroke="#8a6a32" strokeWidth="3.3" strokeLinecap="butt" />
                      </>
                    ) : null}
                    {ldGoverns ? (
                      <line x1={xLd0} y1={y} x2={xCut} y2={y} stroke="#8b1e1e" strokeWidth="3.1" strokeDasharray="5 2.5" />
                    ) : null}
                    <line x1={xCut} y1={y - 6} x2={xCut} y2={y + 6} stroke="#8b1e1e" strokeWidth="1.3" />
                    {i === 1 && k === 1 ? (
                      <g fontSize="7" fontFamily="IBM Plex Sans, sans-serif">
                        <text x={(xSup + xTeo) / 2} y={y - 8} textAnchor="middle" fill="#8b1e1e">
                          L teór.
                        </text>
                        <text x={(xTeo + xAncl) / 2} y={y - 8} textAnchor="middle" fill="#8a6a32">
                          Lext
                        </text>
                        {ldGoverns ? (
                          <text x={(xAncl + xCut) / 2} y={y - 8} textAnchor="middle" fill="#8b1e1e">
                            ld
                          </text>
                        ) : null}
                      </g>
                    ) : null}
                    <text
                      x={(xSup + xCut) / 2}
                      y={y + 14}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#8b1e1e"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {`L = ${sg.Lcorte.toFixed(2)} m`}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <g fontSize="8.5" fontFamily="IBM Plex Sans, sans-serif">
          <line x1={pad} y1={162} x2={pad + 22} y2={162} stroke="#8b1e1e" strokeWidth="3.2" />
          <text x={pad + 26} y={165} fill="#8b1e1e">
            L teórica
          </text>
          <line x1={pad + 110} y1={162} x2={pad + 132} y2={162} stroke="#8a6a32" strokeWidth="3.2" />
          <text x={pad + 136} y={165} fill="#8a6a32">
            Lext = máx(Ln/16, d, 12db)
          </text>
          <line x1={pad} y1={180} x2={pad + 22} y2={180} stroke="#8b1e1e" strokeWidth="3" strokeDasharray="5 2.5" />
          <text x={pad + 26} y={183} fill="#8b1e1e">
            ld (si gobierna el corte)
          </text>
          <line x1={pad + 200} y1={180} x2={pad + 222} y2={180} stroke="#1f6b3a" strokeWidth="3.2" />
          <text x={pad + 226} y={183} fill="#1f6b3a">
            As+ continuo
          </text>
        </g>
      </SvgFrame>
      </div>
      ) : null}

      {part === "despiece" ? (
      <div className="fig-inline">
      {(() => {
        const bar = barByName(String(values.bar ?? '3/8"'));
        const bApoyo = n(values, "bApoyo", 0.3);
        const recCm = n(values, "rec", 3);
        const plan = planDespiece(nodes, members, model?.steel ?? [], bar, maciza ? "slab" : "joist", bApoyo);
        const yBeam = 78;
        const beamH = 52;
        const cover = Math.max(5, Math.min(8.5, recCm * 1.85));
        const yNeg = yBeam + cover;
        const yPos = yBeam + beamH - cover;
        const yExt = yPos - (plan.extras.length ? 6 : 0);
        const yLab = 38;
        const ySpan = yBeam + beamH + 48;
        const sw = 1.55;
        const hookH = 8.5;
        const hook90 = (x: number, y: number, dir: "up" | "down", color: string) => {
          const y2 = dir === "up" ? y - hookH : y + hookH;
          return (
            <path
              d={`M ${x} ${y} L ${x} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          );
        };
        const pack = (x1: number, x2: number, y: number, nDraw: number, color: string) => {
          const k = Math.max(1, Math.min(4, nDraw));
          return Array.from({ length: k }, (_, i) => {
            const dy = (i - (k - 1) / 2) * 2.4;
            return <line key={`p-${y}-${i}-${x1}`} x1={x1} y1={y + dy} x2={x2} y2={y + dy} stroke={color} strokeWidth={sw} strokeLinecap="butt" />;
          });
        };
        return (
          <SvgFrame
            heading="Despiece de aceros"
            caption={plan.note}
            viewBox="0 0 520 292"
          >
            {nodes.map((x, i) =>
              support[i] ? (
                <g key={`col-${i}`}>
                  <rect x={xOf(x) - 7} y={yBeam - 6} width="14" height={beamH + 24} fill="#d7c4a3" stroke="#8a7344" strokeWidth="0.75" />
                  <polygon points={`${xOf(x)},${yBeam + beamH + 20} ${xOf(x) - 9},${yBeam + beamH + 34} ${xOf(x) + 9},${yBeam + beamH + 34}`} fill="#1a4473" />
                </g>
              ) : null
            )}
            <rect x={xOf(0)} y={yBeam} width={xOf(Ltot) - xOf(0)} height={beamH} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.2" />

            {plan.negs.map((g) => {
              const xC = xOf(g.x);
              const xL = xOf(Math.max(0, g.x - g.Lleft));
              const xR = xOf(Math.min(Ltot, g.x + g.Lright));
              const nDraw = maciza ? 1 : Math.max(1, Math.min(3, g.n));
              return (
                <g key={`negb-${g.node}`}>
                  {pack(xL, xR, yNeg, nDraw, "#8b1e1e")}
                  {g.hookL ? hook90(xL, yNeg, "down", "#8b1e1e") : null}
                  {g.hookR ? hook90(xR, yNeg, "down", "#8b1e1e") : null}
                  <text x={xC} y={yLab} textAnchor="middle" fontSize="7.5" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
                    {g.text}
                  </text>
                </g>
              );
            })}

            {pack(xOf(0), xOf(Ltot), yPos, maciza ? 1 : Math.max(1, Math.min(3, plan.nBase)), "#1f6b3a")}
            {hook90(xOf(0), yPos, "up", "#1f6b3a")}
            {hook90(xOf(Ltot), yPos, "up", "#1f6b3a")}
            <text x={(xOf(0) + xOf(Ltot)) / 2} y={yPos - 7} textAnchor="middle" fontSize="7.5" fill="#1f6b3a" fontFamily="IBM Plex Sans, sans-serif">
              {plan.labelBase}
            </text>

            {plan.extras.map((e) => (
              <g key={`ex-${e.i}`}>
                {pack(xOf(e.x0), xOf(e.x1), yExt, 1, "#8a6a32")}
                <text x={(xOf(e.x0) + xOf(e.x1)) / 2} y={yExt + 11} textAnchor="middle" fontSize="7" fill="#8a6a32" fontFamily="IBM Plex Sans, sans-serif">
                  {e.text} · L = {e.Lbar.toFixed(2)} m
                </text>
              </g>
            ))}

            {members.map((m, i) => (
              <text key={`sp-${i}`} x={(xOf(nodes[i]) + xOf(nodes[i + 1])) / 2} y={ySpan} textAnchor="middle" fontSize="8" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
                {m.label} · {m.L.toFixed(2)} m
              </text>
            ))}

            <g fontSize="7.5" fontFamily="IBM Plex Sans, sans-serif">
              <line x1={pad} y1={258} x2={pad + 20} y2={258} stroke="#8b1e1e" strokeWidth={sw} />
              <text x={pad + 24} y={261} fill="#8b1e1e">
                As− · interiores: L = Lizq + Lder · extremo simple: L = ld · gancho 90° (un doblez) hacia abajo
              </text>
              <line x1={pad} y1={274} x2={pad + 20} y2={274} stroke="#1f6b3a" strokeWidth={sw} />
              <text x={pad + 24} y={277} fill="#1f6b3a">
                As+ continuo · gancho 90° (un doblez) solo en extremos, hacia arriba
              </text>
            </g>
          </SvgFrame>
        );
      })()}
      </div>
      ) : null}
    </>
  );
}

function TagN({ n, x, y, r = 9.5 }: { n: string; x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke="#1a4473" strokeWidth="1.35" />
      <text x={x} y={y + 3.6} textAnchor="middle" fontSize="10.5" fill="#1a4473" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700">
        {n}
      </text>
    </g>
  );
}

function ForceArrow({
  x1,
  y1,
  x2,
  y2,
  label,
  color = "#8b1e1e",
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  color?: string;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hx = x2 - ux * 8;
  const hy = y2 - uy * 8;
  const px = -uy;
  const py = ux;
  return (
    <g>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth="1.35" />
      <polygon
        points={`${x2},${y2} ${hx + px * 3.2},${hy + py * 3.2} ${hx - px * 3.2},${hy - py * 3.2}`}
        fill={color}
      />
      {label ? (
        <text
          x={x2 + ux * 10 + px * 8}
          y={y2 + uy * 10 + py * 8}
          fontSize="9"
          fill={color}
          fontFamily="Arial, Helvetica, sans-serif"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Estribo({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const H = n(values, "H", 7);
  const B = n(values, "B", 4.7);
  const D = n(values, "D", 1.1);
  const Lp = n(values, "Lp", 1.1);
  const tsup = n(values, "tsup", 0.3);
  const tinf = n(values, "tinf", 0.9);
  const Nseat = n(values, "N", 0.7);
  const hparap = n(values, "hparap", 1.5);
  const bparap = n(values, "bparap", 0.25);
  const e1 = n(values, "e1", 0.4);
  const e2 = n(values, "e2", 0.6);
  const t1 = n(values, "t1", 0.3);
  const t2 = n(values, "t2", 0.35);
  const hviga = n(values, "hviga", 1.5);
  const hz = n(values, "hz", 1.5);
  const hpDef = H <= 3 ? 1.2 : H >= 6 ? 0.6 : 1.2 - ((H - 3) * 0.6) / 3;
  const hp = n(values, "hp", hpDef);
  const hBR = n(values, "hBR", 1.8);
  const hw = n(values, "hw", Math.min(1.1, hz));
  const Ltalon = n(values, "Ltalon", Math.max(0.1, B - Lp - tinf));
  const hCajTop = H - hparap;
  const hCajBot = H - hparap - e1;
  const hChafBot = H - hparap - e1 - e2;
  const sBatterIn = n(values, "sBatter", 0);
  const sBatter =
    sBatterIn > 0.2
      ? sBatterIn
      : (Math.atan(Math.max(tinf - tsup, 0) / Math.max(hChafBot - D, 0.2)) * 180) / Math.PI;

  const padL = 188;
  const padR = 210;
  const padT = 92;
  const padB = 132;
  const vbW = 1180;
  const vbH = 860;
  const sc = Math.min((vbW - padL - padR) / Math.max(B + 1.55, 4), (vbH - padT - padB) / Math.max(H + hp + 0.35, 7));
  const xA = padL + B * sc;
  const yBot = padT + (H + hp) * sc + 8;
  const X = (xa: number) => xA - xa * sc;
  const Y = (h: number) => yBot - h * sc;
  const ff = "Arial, Helvetica, sans-serif";

  const xaBack = Lp + tinf;
  const xaFill = xaBack + t2;
  const xaParapF = xaFill - bparap;
  const xaSeatF = xaFill - bparap - Nseat;
  const xaTrapF = xaBack - tsup;
  const pts = (arr: number[][]) => arr.map((p) => p.join(",")).join(" ");

  const conc = pts([
    [X(0), Y(0)],
    [X(B), Y(0)],
    [X(B), Y(D)],
    [X(xaBack), Y(D)],
    [X(xaBack), Y(hChafBot)],
    [X(xaFill), Y(hCajBot)],
    [X(xaFill), Y(H)],
    [X(xaParapF), Y(H)],
    [X(xaParapF), Y(hCajTop)],
    [X(xaSeatF), Y(hCajTop)],
    [X(xaSeatF), Y(hCajBot)],
    [X(xaTrapF), Y(hChafBot)],
    [X(Lp), Y(D)],
    [X(0), Y(D)],
  ]);

  const soilL = pts([
    [X(B) + 6, Y(0)],
    [X(B) + 6, Y(D)],
    [X(B) + 18, Y(H + hp)],
    [X(xaFill), Y(H + hp)],
    [X(xaFill), Y(H)],
    [X(xaFill), Y(hCajBot)],
    [X(xaBack), Y(hChafBot)],
    [X(xaBack), Y(D)],
    [X(B), Y(D)],
    [X(B), Y(0)],
  ]);

  const ehBase = Math.min(Math.max(Ltalon * 0.38, 0.85), 1.45);
  const triEH = pts([
    [X(xaFill), Y(H)],
    [X(xaFill + ehBase), Y(D)],
    [X(xaFill), Y(D)],
  ]);

  const hzDraw = Math.min(hz, H * 0.55);
  const toeW = 1.42 * sc;
  const soilR = pts([
    [X(0), Y(0)],
    [X(0) + toeW + 10, Y(0)],
    [X(0) + toeW + 10, Y(hzDraw * 0.2)],
    [X(0) + toeW * 0.42, Y(hzDraw)],
    [X(Lp * 0.12), Y(hzDraw)],
    [X(0), Y(Math.min(D, hzDraw))],
  ]);
  const water = pts([
    [X(0) + 22, Y(hw)],
    [X(0) + toeW + 18, Y(hw)],
    [X(0) + toeW + 18, Y(0) + 2],
    [X(0) + 22, Y(0) + 2],
  ]);

  const beamH = Math.max(22, Math.min(hviga * sc * 0.42, 48));
  const beamW = Math.max(Nseat * sc * 0.92, 62);
  const tabX = X(xaSeatF) + 2;
  const tabY = Y(hCajTop) - beamH;
  const tabCx = tabX + beamW / 2;
  const ehCx = X(xaFill + ehBase * 0.42);
  const ehCy = (Y(H) + Y(D)) / 2 + 8;

  return (
    <SvgFrame
      heading="1 parapeto — 2 cajuela — 3 chaflán talón — 4 pantalla — 5 chaflán puntera — 6 talud — 7 zapata"
      caption="Estribo tipo pantalla · DIS ESTRIBO PANTALLA · relleno a la izquierda · A = puntera (aguas)"
      viewBox={`0 0 ${vbW} ${vbH}`}
    >
      <defs>
        <pattern id="estPantConc" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#d0d0d0" />
          <circle cx="1.2" cy="1.8" r="0.42" fill="#6e6e6e" />
          <circle cx="4.3" cy="2.2" r="0.38" fill="#7a7a7a" />
          <circle cx="2.8" cy="4.6" r="0.4" fill="#5f5f5f" />
          <circle cx="5.2" cy="5.1" r="0.32" fill="#808080" />
        </pattern>
        <pattern id="estPantSoil" width="18" height="9" patternUnits="userSpaceOnUse">
          <rect width="18" height="9" fill="#d2b48c" />
          <path d="M0 6.5 Q4.5 3.2 9 6.5 T18 6.5" fill="none" stroke="#9a7344" strokeWidth="0.95" />
          <path d="M0 2.4 Q4.5 -0.4 9 2.4 T18 2.4" fill="none" stroke="#b08a58" strokeWidth="0.7" />
        </pattern>
        <pattern id="estPantEh" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width="8" height="8" fill="#c48a52" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#8a5228" strokeWidth="1.55" />
        </pattern>
        <pattern id="estPantWater" width="16" height="10" patternUnits="userSpaceOnUse">
          <rect width="16" height="10" fill="#c4dced" />
          <path d="M0 3 Q4 0.6 8 3 T16 3" fill="none" stroke="#4a7a9a" strokeWidth="0.95" />
          <path d="M0 7.4 Q4 5 8 7.4 T16 7.4" fill="none" stroke="#5a8aaa" strokeWidth="0.85" />
        </pattern>
      </defs>
      <polygon points={soilL} fill="url(#estPantSoil)" stroke="#8a7344" strokeWidth="0.6" />
      <polygon points={soilR} fill="url(#estPantSoil)" stroke="#8a7344" strokeWidth="0.6" />
      <polygon points={triEH} fill="url(#estPantEh)" stroke="#8a5228" strokeWidth="0.85" />
      <polygon points={water} fill="url(#estPantWater)" stroke="#4a7a9a" strokeWidth="0.8" />
      <line x1={X(0) + 22} y1={Y(hw)} x2={X(0) + toeW + 18} y2={Y(hw)} stroke="#3d6a84" strokeWidth="1.25" />
      <text x={X(0) + toeW - 2} y={Y(hw) - 7} textAnchor="end" fontSize="11" fill="#3d6a84" fontFamily={ff} fontWeight="700">
        aguas
      </text>
      <text x={ehCx} y={ehCy} textAnchor="middle" fontSize="12" fill="#8b1e1e" fontFamily={ff} fontWeight="700">
        EH
      </text>
      <text x={ehCx} y={ehCy + 13} textAnchor="middle" fontSize="10.5" fill="#8b1e1e" fontFamily={ff}>
        LS,x
      </text>
      <polygon points={conc} fill="url(#estPantConc)" stroke="#1a4473" strokeWidth="2" strokeLinejoin="miter" />
      <line x1={X(B) + 28} y1={Y(0)} x2={X(0) + toeW + 16} y2={Y(0)} stroke="#6b5a3a" strokeWidth="1.15" />
      <rect x={tabX} y={tabY} width={beamW} height={beamH} fill="#b7cce0" stroke="#1a4473" strokeWidth="1.35" />
      <text x={tabCx} y={tabY + beamH / 2 - 3} textAnchor="middle" fontSize="9" fill="#8b1e1e" fontFamily={ff} fontWeight="700">
        PDC - PDW - PEQM
      </text>
      <text x={tabCx} y={tabY + beamH / 2 + 10} textAnchor="middle" fontSize="9.5" fill="#1a4473" fontFamily={ff} fontWeight="700">
        tablero
      </text>
      <line x1={X(B) + 10} y1={Y(H + hp)} x2={X(xaFill)} y2={Y(H + hp)} stroke="#6b5a3a" strokeWidth="1.2" strokeDasharray="5 3" />
      <text x={(X(B) + X(xaFill)) / 2} y={Y(H + hp) - 8} textAnchor="middle" fontSize="12" fill="#5a4a28" fontFamily={ff} fontWeight="700">
        {`h' = ${hp.toFixed(2)} m`}
      </text>
      <text x={(X(B) + X(xaFill + ehBase)) / 2} y={Y((H + D) * 0.58)} textAnchor="middle" fontSize="12" fill="#5a4a28" fontFamily={ff}>
        relleno EV
      </text>
      <text x={(X(Lp) + X(0)) / 2} y={(Y(0) + Y(D)) / 2 + 4} textAnchor="middle" fontSize="12" fill="#1a4473" fontFamily={ff} fontWeight="700">
        PUNTERA
      </text>
      <text x={(X(B) + X(xaBack)) / 2} y={(Y(0) + Y(D)) / 2 + 4} textAnchor="middle" fontSize="12" fill="#1a4473" fontFamily={ff} fontWeight="700">
        TALÓN
      </text>
      <text x={(X(xaBack) + X(xaTrapF)) / 2} y={Y(D + (hChafBot - D) * 0.32)} textAnchor="middle" fontSize="11.5" fill="#1a4473" fontFamily={ff} fontWeight="700">
        PANTALLA
      </text>
      <ForceArrow x1={tabCx} y1={tabY - 58} x2={tabCx} y2={tabY + 1} label="" />
      <ForceArrow
        x1={X(xaParapF) - 8}
        y1={tabY - 10}
        x2={X(xaParapF) + 70}
        y2={tabY - 10}
        label={`BR @ +${hBR.toFixed(2)} m`}
      />
      <circle cx={X(0)} cy={Y(0)} r="3.6" fill="#c41e1e" />
      <text x={X(0) + 12} y={Y(0) + 16} fontSize="13" fill="#c41e1e" fontFamily={ff} fontWeight="700">
        A
      </text>
      <text
        x={(X(Lp) + X(xaTrapF)) / 2 + 14}
        y={(Y(D) + Y(hChafBot)) / 2 - 4}
        fontSize="12"
        fill="#1a4473"
        fontFamily={ff}
        fontWeight="700"
      >
        {`s° = ${sBatter.toFixed(2)}°`}
      </text>
      <TagN n="1" x={(X(xaFill) + X(xaParapF)) / 2} y={(Y(H) + Y(hCajTop)) / 2} />
      <TagN n="2" x={(X(xaSeatF) + X(xaParapF)) / 2} y={(Y(hCajTop) + Y(hCajBot)) / 2} />
      <TagN n="3" x={(X(xaBack) + X(xaFill)) / 2} y={(Y(hCajBot) + Y(hChafBot)) / 2} />
      <TagN n="4" x={(X(xaBack) + X(xaTrapF)) / 2} y={Y(D + (hChafBot - D) * 0.58)} />
      <TagN n="5" x={(X(xaSeatF) + X(xaTrapF)) / 2} y={(Y(hCajBot) + Y(hChafBot)) / 2} />
      <TagN n="6" x={(X(Lp) + X(xaTrapF)) / 2 - 4} y={(Y(D) + Y(hChafBot)) / 2 + 16} />
      <TagN n="7" x={X(B * 0.52)} y={(Y(0) + Y(D)) / 2} />
      <Dim x1={X(B)} y1={Y(0)} x2={X(0)} y2={Y(0)} label={B.toFixed(2)} field="B" unit="m" side={34} active={active} onFocus={onFocus} />
      <Dim x1={X(Lp)} y1={Y(0)} x2={X(0)} y2={Y(0)} label={Lp.toFixed(2)} field="Lp" unit="m" side={62} active={active} onFocus={onFocus} />
      <Dim x1={X(B)} y1={Y(0)} x2={X(xaBack)} y2={Y(0)} label={Ltalon.toFixed(2)} unit="m" side={62} />
      <Dim x1={X(xaBack)} y1={Y(D)} x2={X(Lp)} y2={Y(D)} label={tinf.toFixed(2)} field="tinf" unit="m" side={-20} active={active} onFocus={onFocus} />
      <Dim x1={X(B)} y1={Y(H)} x2={X(B)} y2={Y(0)} label={H.toFixed(2)} field="H" unit="m" side={52} active={active} onFocus={onFocus} />
      <Dim x1={X(0)} y1={Y(hzDraw)} x2={X(0)} y2={Y(0)} label={hz.toFixed(2)} field="hz" unit="m" side={-72} active={active} onFocus={onFocus} />
      <Dim x1={X(0) + toeW + 8} y1={Y(hw)} x2={X(0) + toeW + 8} y2={Y(0)} label={hw.toFixed(2)} unit="m" side={-28} />
      <Dim x1={X(xaParapF)} y1={Y(H)} x2={X(xaFill)} y2={Y(H)} label={bparap.toFixed(2)} field="bparap" unit="m" side={-26} active={active} onFocus={onFocus} />
      <Dim x1={X(xaSeatF)} y1={Y(hCajTop)} x2={X(xaParapF)} y2={Y(hCajTop)} label={Nseat.toFixed(2)} field="N" unit="m" side={20} active={active} onFocus={onFocus} />
      <Dim x1={X(xaFill)} y1={Y(H)} x2={X(xaFill)} y2={Y(hCajTop)} label={hparap.toFixed(2)} field="hparap" unit="m" side={30} active={active} onFocus={onFocus} />
      <Dim x1={X(xaTrapF)} y1={Y(hChafBot)} x2={X(xaBack)} y2={Y(hChafBot)} label={tsup.toFixed(2)} field="tsup" unit="m" side={14} active={active} onFocus={onFocus} />
      <Dim x1={X(xaSeatF)} y1={Y(hCajTop)} x2={X(xaSeatF)} y2={Y(hCajBot)} label={e1.toFixed(2)} field="e1" unit="m" side={18} active={active} onFocus={onFocus} />
      <Dim x1={X(xaSeatF)} y1={Y(hCajBot)} x2={X(xaTrapF)} y2={Y(hCajBot)} label={t1.toFixed(2)} field="t1" unit="m" side={16} active={active} onFocus={onFocus} />
      <Dim x1={X(xaFill)} y1={Y(hCajBot)} x2={X(xaFill)} y2={Y(hChafBot)} label={e2.toFixed(2)} field="e2" unit="m" side={-16} active={active} onFocus={onFocus} />
      <Dim x1={X(xaBack)} y1={Y(hCajBot)} x2={X(xaFill)} y2={Y(hCajBot)} label={t2.toFixed(2)} field="t2" unit="m" side={-22} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function EstriboG({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const H = n(values, "H", 4);
  const B = n(values, "B", 2.5);
  const a = n(values, "a", 0.3);
  const bTalon = n(values, "bTalon", 0.3);
  const h = n(values, "h", 0.5);
  const hz = n(values, "hz", 1);
  const Ndim = n(values, "N", 0.5);
  const tBack = n(values, "tBack", 0.5);
  const e = n(values, "e", 0.8);
  const eLosa = n(values, "eLosa", 0.3);
  const stem = Math.max(0.05, n(values, "stem", B - tBack - a - bTalon - Ndim));
  const Sdeg = n(values, "S", 0);
  const xSeat = a + stem;
  const xBack = a + stem + Ndim;
  const xHeel = a + stem + Ndim + tBack;

  const padL = 168;
  const padR = 154;
  const padT = 118;
  const padB = 108;
  const vbW = 1020;
  const vbH = 740;
  const sc = Math.min((vbW - padL - padR) / Math.max(B, 1.8), (vbH - padT - padB) / Math.max(H, hz, 2.8));
  const X = (m: number) => padL + m * sc;
  const Y = (m: number) => padT + H * sc - m * sc;

  const conc = [
    [0, 0],
    [B, 0],
    [B, h],
    [xHeel, h],
    [xHeel, H],
    [xBack, H],
    [xBack, H - e],
    [xSeat, H - e],
    [a, h],
    [0, h],
  ]
    .map(([xm, zm]) => `${X(xm)},${Y(zm)}`)
    .join(" ");
  const soilBack = [
    [xHeel, h],
    [B + 0.12, h],
    [B + 0.12, H + eLosa],
    [xHeel, H],
  ]
    .map(([xm, zm]) => `${X(xm)},${Y(zm)}`)
    .join(" ");
  const soilToe = [
    [-0.22, 0],
    [0, 0],
    [0, h],
    [a, h],
    [a, hz],
    [-0.22, hz],
  ]
    .map(([xm, zm]) => `${X(xm)},${Y(zm)}`)
    .join(" ");

  const ehW = Math.max(40, Math.min(62, (X(B) - X(xHeel)) * 0.55 + 36));
  const triEH = `${X(xHeel)},${Y(H)} ${X(xHeel) + ehW},${Y(h)} ${X(xHeel)},${Y(h)}`;
  const tabW = Math.max(X(xBack) - X(xSeat), 36) + 24;
  const tabH = Math.max(e * sc * 0.55, 28);
  const tabX = X(xSeat) - 12;
  const tabY = Y(H) - tabH;

  return (
    <SvgFrame
      heading="Sección transversal — franja 1.00 m"
      caption="Estribo de gravedad · A a la izquierda (aguas) · relleno y EH a la derecha. Cotas editables."
      viewBox={`0 0 ${vbW} ${vbH}`}
    >
      <polygon points={soilBack} fill="url(#soil)" opacity="0.94" />
      <polygon points={soilToe} fill="url(#soil)" opacity="0.82" />
      <polygon points={triEH} fill="#c45c4a" opacity="0.32" stroke="#8b1e1e" strokeWidth="0.9" />
      <text x={X(xHeel) + ehW * 0.55} y={(Y(H) + Y(h)) / 2} textAnchor="middle" fontSize="12" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
        EH
      </text>
      <rect x={X(xHeel)} y={Y(H + eLosa)} width={Math.max(X(B) - X(xHeel), 8)} height={eLosa * sc} fill="#c4d4e8" stroke="#1a4473" strokeWidth="1" />
      <polygon points={conc} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.7" strokeLinejoin="round" />
      <rect x={tabX} y={tabY} width={tabW} height={tabH} fill="#b7c6d8" stroke="#1a4473" strokeWidth="1.2" />
      <text x={tabX + tabW / 2} y={tabY + tabH / 2 + 4} textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {`tablero e = ${e.toFixed(2)} m`}
      </text>
      <text x={(X(xHeel) + X(B)) / 2} y={Y((H + h) * 0.55)} textAnchor="middle" fontSize="11" fill="#5a4a28" fontFamily="IBM Plex Sans, sans-serif">
        relleno EV
      </text>
      {Sdeg > 0.2 ? (
        <text x={X(a + stem * 0.45)} y={Y(h + (H - e - h) * 0.45)} fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
          {`S = ${Sdeg.toFixed(2)}°`}
        </text>
      ) : null}
      <TagN n="1" x={X(a + stem * 0.55)} y={Y(h + (H - e - h) * 0.4)} />
      <TagN n="2" x={(X(xSeat) + X(xBack)) / 2} y={Y(H - e * 0.45)} />
      <TagN n="3" x={(X(xBack) + X(xHeel)) / 2} y={Y((H + h) / 2)} />
      <TagN n="4" x={X(B / 2)} y={(Y(0) + Y(h)) / 2} />
      <circle cx={X(0)} cy={Y(0)} r="3.2" fill="#8b1e1e" />
      <text x={X(0) + 14} y={Y(0) + 16} fontSize="12" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600">
        A
      </text>
      <text x={X(a / 2)} y={(Y(0) + Y(h)) / 2 + 4} textAnchor="middle" fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif" fontWeight="700">
        PUNTERA
      </text>
      <text x={(X(xHeel) + X(B)) / 2} y={(Y(0) + Y(h)) / 2 + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif" fontWeight="700">
        TALÓN
      </text>
      <text x={X(-0.12)} y={Y(hz * 0.45)} textAnchor="end" fontSize="10" fill="#3d6a84" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600">
        aguas
      </text>
      <Dim x1={X(0)} y1={Y(0)} x2={X(B)} y2={Y(0)} label={B.toFixed(2)} field="B" unit="m" side={36} active={active} onFocus={onFocus} />
      <Dim x1={X(0)} y1={Y(H)} x2={X(0)} y2={Y(0)} label={H.toFixed(2)} field="H" unit="m" side={42} active={active} onFocus={onFocus} />
      <Dim x1={X(-0.22)} y1={Y(hz)} x2={X(-0.22)} y2={Y(0)} label={hz.toFixed(2)} field="hz" unit="m" side={70} active={active} onFocus={onFocus} />
      <Dim x1={X(0)} y1={Y(h)} x2={X(a)} y2={Y(h)} label={a.toFixed(2)} field="a" unit="m" side={-24} active={active} onFocus={onFocus} />
      <Dim x1={X(xSeat)} y1={Y(H - e)} x2={X(xBack)} y2={Y(H - e)} label={Ndim.toFixed(2)} field="N" unit="m" side={26} active={active} onFocus={onFocus} />
      <Dim x1={X(xBack)} y1={Y(H)} x2={X(xHeel)} y2={Y(H)} label={tBack.toFixed(2)} field="tBack" unit="m" side={-32} active={active} onFocus={onFocus} />
      <Dim x1={X(xHeel)} y1={Y(h)} x2={X(B)} y2={Y(h)} label={bTalon.toFixed(2)} field="bTalon" unit="m" side={-24} active={active} onFocus={onFocus} />
      <Dim x1={X(B)} y1={Y(h)} x2={X(B)} y2={Y(0)} label={h.toFixed(2)} field="h" unit="m" side={-40} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function Tablero({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const kind = String(values.pavKind ?? "");
  const isSlab = kind === "losaPuente" || (values.Bvia != null && values.Bvia !== "" && !(Number(values.S) > 0));
  const L = n(values, "L", isSlab ? 9.75 : 24);
  const S = n(values, "S", 2.8);
  const t = n(values, "t", isSlab ? 0.55 : 0.2);
  const tw = n(values, "tw", 0.4);
  const nVigas = Math.max(3, Math.round(n(values, "nVigas", 5)));
  const Bvia = n(values, "Bvia", 3.6);
  const Btot = n(values, "Btot", isSlab ? 4.1 : 13.2);
  const voladoL = n(values, "voladoL", 1);
  const sNeg = n(values, "sNeg", 25);
  const sPos = n(values, "sPos", 23);
  const barNeg = String(values.barNeg ?? '5/8"');
  const barPos = String(values.barPos ?? '5/8"');
  const barP = String(values.barP ?? '1"');
  const sP = n(values, "sP", 12);
  const sD = n(values, "sD", 20);
  const barD = String(values.barD ?? '1/2"');
  const bsard = n(values, "bsard", 0.25);
  const hsard = n(values, "hsard", 0.62);
  const gasf = n(values, "gasf", 0.05);

  if (isSlab) {
    const tPx = Math.max(52, Math.min(96, t * 140));
    const y0 = 78;
    const x0 = 64;
    const W = 392;
    const sardW = Math.max(16, bsard * 55);
    const sardH = Math.max(22, hsard * 40);
  return (
      <SvgFrame heading="Sección transversal" caption={`Puente losa — t = ${t.toFixed(2)} m · L = ${L.toFixed(2)} m · As // tráfico`}>
        <rect x={x0} y={y0} width={W} height={tPx} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
        <rect x={x0} y={y0 - 8} width={W} height={8} fill="#3d3d3d" opacity="0.85" />
        <rect x={x0} y={y0 - sardH} width={sardW} height={sardH + tPx * 0.12} fill="url(#conc)" stroke="#1a4473" />
        <rect x={x0 + W - sardW} y={y0 - sardH} width={sardW} height={sardH + tPx * 0.12} fill="url(#conc)" stroke="#1a4473" />
        <line x1={x0 + sardW + 8} y1={y0 + tPx - 12} x2={x0 + W - sardW - 8} y2={y0 + tPx - 12} stroke="#8b1e1e" strokeWidth="2.6" />
        <line x1={x0 + sardW + 8} y1={y0 + 12} x2={x0 + W - sardW - 8} y2={y0 + 12} stroke="#1a4473" strokeWidth="1.7" strokeDasharray="5 4" />
        {[0.22, 0.4, 0.58, 0.76].map((p) => (
          <line key={p} x1={x0 + W * p} y1={y0 + 10} x2={x0 + W * p} y2={y0 + tPx - 10} stroke="#6b1a1a" strokeWidth="1.1" opacity="0.7" />
        ))}
        <Dim x1={x0} y1={y0} x2={x0} y2={y0 + tPx} label={`${t.toFixed(2)}`} field="t" unit="m" side={-28} active={active} onFocus={onFocus} />
        <Dim x1={x0} y1={y0 + tPx} x2={x0 + W} y2={y0 + tPx} label={`${Btot.toFixed(2)}`} field="Btot" unit="m" side={28} active={active} onFocus={onFocus} />
        <Dim x1={x0 + sardW} y1={y0 - 8} x2={x0 + W - sardW} y2={y0 - 8} label={`${Bvia.toFixed(2)}`} field="Bvia" unit="m" side={-22} active={active} onFocus={onFocus} />
        <text x="260" y={y0 + tPx + 56} textAnchor="middle" fontSize="11" fill="#1a4473">
          Asp Ø {barP} @ {sP} cm inf. // tráfico · Asr Ø {barD} @ {sD} cm · asfalto {gasf.toFixed(2)} m
        </text>
      </SvgFrame>
    );
  }

  const tPx = Math.max(26, Math.min(46, t * 180));
  const gH = 92;
  const x0 = 42;
  const W = 436;
  const y0 = 86;
  const overhang = Math.max(18, Math.min(48, voladoL * 28));
  const inner = W - 2 * overhang;
  return (
    <SvgFrame heading="Sección transversal" caption={`Losa de tablero sobre ${nVigas} vigas — S' = ${S.toFixed(2)} m · As ⊥ tráfico`}>
      <rect x={x0} y={y0 - 7} width={W} height={7} fill="#3d3d3d" opacity="0.8" />
      <rect x={x0} y={y0} width={W} height={tPx} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.4" />
      <line x1={x0 + 10} y1={y0 + 8} x2={x0 + W - 10} y2={y0 + 8} stroke="#1a4473" strokeWidth="1.7" strokeDasharray="5 4" />
      <line x1={x0 + 10} y1={y0 + tPx - 8} x2={x0 + W - 10} y2={y0 + tPx - 8} stroke="#8b1e1e" strokeWidth="2.3" />
      {Array.from({ length: nVigas }, (_, i) => {
        const x = x0 + overhang + i * (inner / Math.max(nVigas - 1, 1));
        const bw = Math.max(16, Math.min(32, tw * 55));
        return (
          <g key={i}>
            <rect x={x - bw / 2} y={y0 + tPx} width={bw} height={gH} fill="url(#conc)" stroke="#1a4473" />
            <text x={x} y={y0 + tPx + gH + 14} textAnchor="middle" fontSize="9" fill="#6b6458">
              V{i + 1}
            </text>
          </g>
        );
      })}
      <Dim
        x1={x0 + overhang}
        y1={y0}
        x2={x0 + overhang + inner / Math.max(nVigas - 1, 1)}
        y2={y0}
        label={`${S.toFixed(2)}`}
        field="S"
        unit="m"
        side={-26}
        active={active}
        onFocus={onFocus}
      />
      {voladoL > 0.05 && (
        <Dim
          x1={x0}
          y1={y0 + tPx + gH}
          x2={x0 + overhang}
          y2={y0 + tPx + gH}
          label={`${voladoL.toFixed(2)}`}
          field="voladoL"
          unit="m"
          side={18}
          active={active}
          onFocus={onFocus}
        />
      )}
      <Dim x1={x0} y1={y0} x2={x0} y2={y0 + tPx} label={`${t.toFixed(2)}`} field="t" unit="m" side={-26} active={active} onFocus={onFocus} />
      <text x={x0 + W / 2} y={y0 + tPx + gH + 36} textAnchor="middle" fontSize="11" fill="#1a4473">
        As⁻ Ø {barNeg} @ {sNeg} cm sup. · As⁺ Ø {barPos} @ {sPos} cm inf. · b viga {tw.toFixed(2)} m
      </text>
      <text x={x0 + W / 2} y={28} textAnchor="middle" fontSize="11" fill="#6b6458">
        {nVigas} vigas · L = {L.toFixed(1)} m · franja 1.00 m · E⁻=1.22+0.25S
      </text>
    </SvgFrame>
  );
}

function Placa({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const lw = n(values, "lw", 1.45);
  const t = n(values, "t", 0.3);
  const hw = n(values, "hw", 12.55);
  const hm = n(values, "hm", 3.55);
  const Le = n(values, "Le", Math.max(2 * t, 0.1 * lw));
  const needBE = n(values, "needBE", 1) > 0.5;
  const nBorde = n(values, "nBorde", 8);
  const barBorde = String(values.barBorde ?? '3/4"');
  const barMalla = String(values.barMalla ?? '3/8"');
  const sHcm = n(values, "sHcm", 18);
  const sVcm = n(values, "sVcm", 18);

  const planW = 210;
  const planH = Math.max(26, Math.min(72, planW * (t / Math.max(lw, 0.08))));
  const xP = 78;
  const yP = 44;
  const lePx = Math.max(14, (Le / Math.max(lw, 0.08)) * planW);

  const elH = 310;
  const scaleV = elH / Math.max(hw, 0.1);
  const elW = Math.max(64, Math.min(120, lw * scaleV * 2.4));
  const xE = 400;
  const yE = 44;
  const leEl = Math.max(10, (Le / Math.max(lw, 0.08)) * elW);
  const nStory = Math.max(1, Math.round(hw / Math.max(hm, 0.4)));

  return (
    <SvgFrame viewBox="0 0 640 448" caption={`Planta lw×t a escala y alzado hw=${hw.toFixed(2)} m (altura a escala). Núcleos ℓe rayados; cotas fuera del dibujo.`}>
      <text x={xP + planW / 2} y={22} textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        Planta
      </text>
      <rect x={xP} y={yP} width={planW} height={planH} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
      {needBE ? (
        <>
          <rect x={xP} y={yP} width={lePx} height={planH} fill="url(#hatch)" stroke="#8b1e1e" strokeWidth="1.1" />
          <rect x={xP + planW - lePx} y={yP} width={lePx} height={planH} fill="url(#hatch)" stroke="#8b1e1e" strokeWidth="1.1" />
          <text x={xP + lePx / 2} y={yP - 6} textAnchor="middle" fontSize="9" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
            ℓe
          </text>
          <text x={xP + planW - lePx / 2} y={yP - 6} textAnchor="middle" fontSize="9" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
            ℓe
          </text>
        </>
      ) : null}
      <Dim x1={xP} y1={yP + planH} x2={xP + planW} y2={yP + planH} label={`${lw.toFixed(2)}`} field="lw" unit="m" side={24} active={active} onFocus={onFocus} />
      <Dim x1={xP} y1={yP} x2={xP} y2={yP + planH} label={`${t.toFixed(2)}`} field="t" unit="m" side={28} active={active} onFocus={onFocus} />

      <text x={xE + elW / 2} y={22} textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        Alzado
      </text>
      <rect x={xE} y={yE} width={elW} height={elH} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
      {needBE ? (
        <>
          <rect x={xE} y={yE} width={leEl} height={elH} fill="url(#hatch)" stroke="#8b1e1e" strokeWidth="1.1" />
          <rect x={xE + elW - leEl} y={yE} width={leEl} height={elH} fill="url(#hatch)" stroke="#8b1e1e" strokeWidth="1.1" />
        </>
      ) : null}
      {Array.from({ length: Math.max(0, nStory - 1) }, (_, i) => {
        const y = yE + elH - ((i + 1) * hm * scaleV);
        if (y < yE + 8 || y > yE + elH - 8) return null;
        return (
          <g key={`piso-${i}`}>
            <line x1={xE} y1={y} x2={xE + elW} y2={y} stroke="#1a4473" strokeDasharray="4 3" strokeWidth="1" />
          </g>
        );
      })}
      <Dim x1={xE} y1={yE} x2={xE} y2={yE + elH} label={`${hw.toFixed(2)}`} field="hw" unit="m" side={36} active={active} onFocus={onFocus} />
      <Dim
        x1={xE + elW}
        y1={yE + elH - Math.min(hm, hw) * scaleV}
        x2={xE + elW}
        y2={yE + elH}
        label={`${hm.toFixed(2)}`}
        field="hm"
        unit="m"
        side={-28}
        active={active}
        onFocus={onFocus}
      />
      <Dim x1={xE} y1={yE + elH} x2={xE + elW} y2={yE + elH} label={`${lw.toFixed(2)}`} field="lw" unit="m" side={22} active={active} onFocus={onFocus} />
      <text x={320} y={436} textAnchor="middle" fontSize="11" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        {needBE ? `${nBorde} Ø ${barBorde} c/núcleo` : "sin núcleo especial"} · {barMalla} @ {sHcm}/{sVcm} cm
      </text>
    </SvgFrame>
  );
}

function Terzaghi({
  values,
  active,
  onFocus,
  part,
}: {
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
  part?: string;
}) {
  const B = n(values, "B", 1.5);
  const Df = n(values, "Df", 2.2);
  const NF = n(values, "NF", 2.6);
  const bw = Math.min(220, Math.max(90, B * 70));
  const x0 = 260 - bw / 2;
  const yG = 70;
  const yF = yG + 26;
  const soilH = 230;
  const yNF = NF > 0 ? yF + Math.min(soilH - 20, (NF / Math.max(Df + B, 1)) * 140) : -1;
  if (part === "spt") return <SptPhiChart />;
  if (part === "sowers") return <SowersChart />;
  return (
    <SvgFrame heading="Cimentación" caption={`Zapata B = ${B.toFixed(2)} m · Df = ${Df.toFixed(2)} m${NF > 0 ? ` · NF = ${NF.toFixed(2)} m` : " · sin napa"}`}>
      <rect x="40" y={yF} width="440" height={soilH} fill="url(#soil)" />
      <rect x={x0} y={yG} width={bw} height="28" fill="url(#conc)" stroke="#1a4473" strokeWidth="1.4" />
      <polygon
        points={`${x0},${yF} ${x0 + bw / 2},${yF + 150} ${x0 + bw},${yF}`}
        fill="#8b1e1e22"
        stroke="#8b1e1e"
        strokeWidth="1.3"
      />
      <path
        d={`M ${x0 - 70},${yF} Q ${x0 - 20},${yF + 80} ${x0 + bw / 2},${yF + 150} Q ${x0 + bw + 20},${yF + 80} ${x0 + bw + 70},${yF}`}
        fill="none"
        stroke="#1a4473"
        strokeWidth="1.1"
        strokeDasharray="4 3"
      />
      {yNF > yF ? (
        <>
          <line x1="40" y1={yNF} x2="480" y2={yNF} stroke="#1d5aa6" strokeWidth="1.4" strokeDasharray="6 4" />
          <text x="48" y={yNF - 6} fontSize="10" fill="#1d5aa6" fontFamily="IBM Plex Sans, sans-serif">
            NF
          </text>
        </>
      ) : null}
      <Dim x1={x0} y1={yG} x2={x0 + bw} y2={yG} label={`${B.toFixed(2)}`} field="B" unit="m" side={-16} active={active} onFocus={onFocus} />
      <Dim x1={x0} y1={yG} x2={x0} y2={yF + Math.min(120, Df * 40)} label={`${Df.toFixed(2)}`} field="Df" unit="m" side={-28} active={active} onFocus={onFocus} />
      <text x="260" y={yF + 200} textAnchor="middle" fontSize="10" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
        Cuña de Terzaghi · qu = sc c Nc + γ Df Nq + sγ γ B Nγ
      </text>
    </SvgFrame>
  );
}

function SptPhiChart() {
  const L = 70;
  const R = 470;
  const T = 36;
  const Btm = 280;
  const nMax = 80;
  const pMin = 28;
  const pMax = 46;
  const pts: [number, number][] = [
    [0, 28], [4, 29], [10, 30.5], [20, 33.5], [30, 36], [40, 39], [50, 42], [60, 44], [80, 46],
  ];
  const xOf = (N: number) => L + (N / nMax) * (R - L);
  const yOf = (p: number) => Btm - ((p - pMin) / (pMax - pMin)) * (Btm - T);
  const poly = pts.map(([N, p]) => `${xOf(N).toFixed(1)},${yOf(p).toFixed(1)}`).join(" ");
  const bands = [
    { n0: 0, n1: 4, lab: "Muy floja" },
    { n0: 4, n1: 10, lab: "Floja" },
    { n0: 10, n1: 30, lab: "Media" },
    { n0: 30, n1: 50, lab: "Densa" },
    { n0: 50, n1: 80, lab: "Muy densa" },
  ];
  return (
    <SvgFrame heading="Carter y Bentley (1991)" caption="Fig. Relación N(SPT) – φ′ de arenas. A la derecha: Dr según Ncorr (tabla C5).">
      {bands.map((b) => (
        <rect key={b.lab} x={xOf(b.n0)} y={T} width={xOf(b.n1) - xOf(b.n0)} height={Btm - T} fill="#1a4473" fillOpacity="0.04" />
      ))}
      <line x1={L} y1={Btm} x2={R} y2={Btm} stroke="#1a4473" />
      <line x1={L} y1={T} x2={L} y2={Btm} stroke="#1a4473" />
      <polyline points={poly} fill="none" stroke="#8b1e1e" strokeWidth="2" />
      {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((N) => (
        <g key={N}>
          <line x1={xOf(N)} y1={Btm} x2={xOf(N)} y2={Btm + 4} stroke="#1a4473" />
          <text x={xOf(N)} y={Btm + 16} textAnchor="middle" fontSize="9" fill="#1a4473">
            {N}
          </text>
        </g>
      ))}
      {[28, 32, 36, 40, 44].map((p) => (
        <g key={p}>
          <line x1={L - 4} y1={yOf(p)} x2={L} y2={yOf(p)} stroke="#1a4473" />
          <text x={L - 8} y={yOf(p) + 3} textAnchor="end" fontSize="9" fill="#1a4473">
            {p}°
          </text>
        </g>
      ))}
      <text x={(L + R) / 2} y={318} textAnchor="middle" fontSize="10" fill="#6b6458">
        SPT N-value
      </text>
      <text x="22" y="170" fontSize="10" fill="#6b6458" transform="rotate(-90 22 170)">
        φ′ (°)
      </text>
    </SvgFrame>
  );
}

function SowersChart() {
  const L = 70;
  const R = 470;
  const T = 36;
  const Btm = 280;
  const qMax = 4;
  const nMax = 30;
  const xOf = (q: number) => L + (q / qMax) * (R - L);
  const yOf = (N: number) => Btm - (N / nMax) * (Btm - T);
  const line = (k: number) => {
    const q = Math.min(qMax, nMax / k);
    return `${xOf(0)},${yOf(0)} ${xOf(q)},${yOf(k * q)}`;
  };
  return (
    <SvgFrame heading="Sowers y Sowers" caption="Fig. N(SPT) frente a qu (kg/cm²). C5: arcilla media N = 4 qu · alta N = 1.2 + 5.9 qu.">
      <line x1={L} y1={Btm} x2={R} y2={Btm} stroke="#1a4473" />
      <line x1={L} y1={T} x2={L} y2={Btm} stroke="#1a4473" />
      <polyline points={line(13.33)} fill="none" stroke="#8b1e1e" strokeWidth="1.6" />
      <polyline points={line(7.5)} fill="none" stroke="#1a4473" strokeWidth="1.6" />
      <polyline points={line(6.75)} fill="none" stroke="#8a6a32" strokeWidth="1.6" />
      <polyline points={line(4)} fill="none" stroke="#2e7d4f" strokeWidth="1.6" />
      <text x={xOf(1.6)} y={yOf(13.33 * 1.6) - 6} fontSize="9" fill="#8b1e1e">Baja plasticidad</text>
      <text x={xOf(2.6)} y={yOf(7.5 * 2.6) - 6} fontSize="9" fill="#1a4473">Terzaghi y Peck</text>
      <text x={xOf(3.1)} y={yOf(6.75 * 3.1) + 12} fontSize="9" fill="#8a6a32">Media</text>
      <text x={xOf(3.4)} y={yOf(4 * 3.4) + 14} fontSize="9" fill="#2e7d4f">Alta plasticidad</text>
      {[0, 1, 2, 3, 4].map((q) => (
        <text key={q} x={xOf(q)} y={Btm + 16} textAnchor="middle" fontSize="9" fill="#1a4473">
          {q.toFixed(0)}
        </text>
      ))}
      {[0, 10, 20, 30].map((N) => (
        <text key={N} x={L - 8} y={yOf(N) + 3} textAnchor="end" fontSize="9" fill="#1a4473">
          {N}
        </text>
      ))}
      <text x={(L + R) / 2} y={318} textAnchor="middle" fontSize="10" fill="#6b6458">
        qu (kg/cm²)
      </text>
    </SvgFrame>
  );
}

function LabHumedad({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  return (
    <SvgFrame heading="Ensayo" caption="Tara, muestra húmeda y muestra seca — NTP 339.127">
      <ellipse cx="140" cy="210" rx="70" ry="22" fill="#cbb892" stroke="#1a4473" />
      <rect x="90" y="120" width="100" height="90" fill="#e8e0d0" stroke="#1a4473" />
      <text x="140" y="168" textAnchor="middle" fontSize="11" fill="#1a4473">Húmedo + tara</text>
      <ellipse cx="380" cy="210" rx="70" ry="22" fill="#cbb892" stroke="#1a4473" />
      <rect x="330" y="140" width="100" height="70" fill="#d9d2c3" stroke="#1a4473" />
      <text x="380" y="178" textAnchor="middle" fontSize="11" fill="#1a4473">Seco + tara</text>
      <text x="260" y="70" textAnchor="middle" fontSize="12" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
        w = Ww / Ws
      </text>
      <Dim x1={90} y1={120} x2={190} y2={120} label={n(values, "wht", 45.87).toFixed(2)} field="wht" unit="g" side={-18} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function CurvaGranulo({ values }: { values: Record<string, string> }) {
  const W0 = n(values, "W0", 300);
  const rets = [n(values, "r4", 20.96), n(values, "r10", 6.23), n(values, "r20", 5.15), n(values, "r40", 7.18), n(values, "r60", 22.89), n(values, "r100", 84.42), n(values, "r200", 18.42)];
  const ds = [4.75, 2, 0.85, 0.42, 0.3, 0.15, 0.075];
  let acc = 0;
  const pts = rets.map((W, i) => {
    acc += W0 > 0 ? (W / W0) * 100 : 0;
    return { d: ds[i], p: Math.max(0, 100 - acc) };
  });
  const L = 60;
  const R = 490;
  const T = 30;
  const Btm = 280;
  const xOf = (d: number) => {
    const log = Math.log10(d);
    const a = Math.log10(0.075);
    const b = Math.log10(4.75);
    return L + ((log - a) / (b - a)) * (R - L);
  };
  const yOf = (p: number) => Btm - (p / 100) * (Btm - T);
  const poly = pts.map((pt) => `${xOf(pt.d).toFixed(1)},${yOf(pt.p).toFixed(1)}`).join(" ");
  return (
    <SvgFrame heading="Curva granulométrica" caption="% pasa vs diámetro (eje log). Tamices N°4 a N°200 · peso original C5.">
      <line x1={L} y1={Btm} x2={R} y2={Btm} stroke="#1a4473" />
      <line x1={L} y1={T} x2={L} y2={Btm} stroke="#1a4473" />
      <polyline points={poly} fill="none" stroke="#8b1e1e" strokeWidth="2" />
      {pts.map((pt) => (
        <circle key={pt.d} cx={xOf(pt.d)} cy={yOf(pt.p)} r="3" fill="#1a4473" />
      ))}
      {pts.map((pt) => (
        <text key={`t${pt.d}`} x={xOf(pt.d)} y={Btm + 16} textAnchor="middle" fontSize="8" fill="#1a4473">
          {pt.d}
        </text>
      ))}
      <text x={(L + R) / 2} y={318} textAnchor="middle" fontSize="10" fill="#6b6458">
        d (mm)
      </text>
    </SvgFrame>
  );
}

function FlujoCasagrande({ values }: { values: Record<string, string> }) {
  const ns = [n(values, "n1", 18), n(values, "n2", 25), n(values, "n3", 29)];
  const wOf = (wtK: string, whK: string, wdK: string, wtD: number, whD: number, wdD: number) => {
    const wt = n(values, wtK, wtD);
    const wh = n(values, whK, whD);
    const wd = n(values, wdK, wdD);
    const ws = wd - wt;
    return ws > 0 ? ((wh - wd) / ws) * 100 : 0;
  };
  const ws = [
    wOf("llwt1", "llwh1", "llwd1", 13.95, 41.54, 35.93),
    wOf("llwt2", "llwh2", "llwd2", 13.95, 39.94, 33.61),
    wOf("llwt3", "llwh3", "llwd3", 21.45, 49.08, 41.52),
  ];
  const L = 70;
  const R = 470;
  const T = 36;
  const Btm = 280;
  const n0 = 10;
  const n1 = 40;
  const wMin = Math.min(...ws) - 4;
  const wMax = Math.max(...ws) + 4;
  const xOf = (N: number) => L + ((Math.log10(N) - Math.log10(n0)) / (Math.log10(n1) - Math.log10(n0))) * (R - L);
  const yOf = (w: number) => Btm - ((w - wMin) / Math.max(1, wMax - wMin)) * (Btm - T);
  const poly = ns.map((N, i) => `${xOf(N).toFixed(1)},${yOf(ws[i]).toFixed(1)}`).join(" ");
  return (
    <SvgFrame heading="Curva de flujo" caption="w vs log N (Casagrande). LL = humedad a 25 golpes, por regresión lineal.">
      <line x1={L} y1={Btm} x2={R} y2={Btm} stroke="#1a4473" />
      <line x1={L} y1={T} x2={L} y2={Btm} stroke="#1a4473" />
      <line x1={xOf(25)} y1={T} x2={xOf(25)} y2={Btm} stroke="#8b1e1e" strokeDasharray="4 3" />
      <polyline points={poly} fill="none" stroke="#1a4473" strokeWidth="1.8" />
      {ns.map((N, i) => (
        <circle key={N} cx={xOf(N)} cy={yOf(ws[i])} r="3.5" fill="#8b1e1e" />
      ))}
      <text x={xOf(25)} y={T + 12} textAnchor="middle" fontSize="9" fill="#8b1e1e">
        N = 25
      </text>
    </SvgFrame>
  );
}

function MohrCoulomb({ values }: { values: Record<string, string> }) {
  const s = [n(values, "s1", 0.5), n(values, "s2", 1), n(values, "s3", 1.5)];
  const t = [n(values, "t1", 0.182), n(values, "t2", 0.18), n(values, "t3", 0.283)];
  const L = 70;
  const R = 470;
  const T = 36;
  const Btm = 280;
  const sMax = Math.max(...s, 1.6) * 1.15;
  const tMax = Math.max(...t, 0.3) * 1.25;
  const xOf = (v: number) => L + (v / sMax) * (R - L);
  const yOf = (v: number) => Btm - (v / tMax) * (Btm - T);
  const nP = s.length;
  const sx = s.reduce((a, b) => a + b, 0);
  const sy = t.reduce((a, b) => a + b, 0);
  const sxx = s.reduce((a, b) => a + b * b, 0);
  const sxy = s.reduce((a, b, i) => a + b * t[i], 0);
  const den = nP * sxx - sx * sx;
  const b = den !== 0 ? (nP * sxy - sx * sy) / den : 0;
  const a = (sy - b * sx) / nP;
  return (
    <SvgFrame heading="Envolvente Mohr–Coulomb" caption="τ = c + σ tan φ. Tres especímenes del corte directo saturado (C5).">
      <line x1={L} y1={Btm} x2={R} y2={Btm} stroke="#1a4473" />
      <line x1={L} y1={T} x2={L} y2={Btm} stroke="#1a4473" />
      <line x1={xOf(0)} y1={yOf(a)} x2={xOf(sMax)} y2={yOf(a + b * sMax)} stroke="#8b1e1e" strokeWidth="1.8" />
      {s.map((sv, i) => (
        <circle key={i} cx={xOf(sv)} cy={yOf(t[i])} r="4" fill="#1a4473" />
      ))}
      <text x="260" y="318" textAnchor="middle" fontSize="10" fill="#6b6458">
        σ (kg/cm²)    ·    c = {a.toFixed(3)} kg/cm²
      </text>
    </SvgFrame>
  );
}

function AsientoSketch({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const B = n(values, "B", 1.6);
  const H = n(values, "H", 75) / 100;
  return (
    <SvgFrame heading="Estrato compresible" caption="Zapata, incrementos σz (Fadum) y espesor H del estrato (C5).">
      <rect x="80" y="70" width="360" height="28" fill="url(#conc)" stroke="#1a4473" />
      <rect x="80" y="98" width="360" height="180" fill="url(#soil)" />
      <line x1="80" y1="188" x2="440" y2="188" stroke="#8b1e1e" strokeDasharray="5 3" />
      <text x="260" y="60" textAnchor="middle" fontSize="11" fill="#1a4473">
        q neta
      </text>
      <Dim x1={80} y1={70} x2={80 + Math.min(360, B * 90)} y2={70} label={`${B.toFixed(2)}`} field="B" unit="m" side={-16} active={active} onFocus={onFocus} />
      <Dim x1={440} y1={98} x2={440} y2={98 + Math.min(180, H * 80)} label={`${(H * 100).toFixed(0)}`} field="H" unit="cm" side={22} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function CbrSketch({ values }: { values: Record<string, string> }) {
  const c95 = n(values, "cbr95", 6.18);
  return (
    <SvgFrame heading="Pistón CBR" caption={`CBR 95 % MDS = ${c95.toFixed(2)} %  ·  ASTM D1883`}>
      <rect x="180" y="40" width="40" height="90" fill="#8a8a8a" stroke="#1a4473" />
      <rect x="120" y="130" width="160" height="140" fill="url(#soil)" stroke="#1a4473" />
      <rect x="120" y="130" width="160" height="18" fill="#c2b280" />
      <text x="200" y="300" textAnchor="middle" fontSize="11" fill="#1a4473">
        Molde Proctor · penetración 0.1″ y 0.2″
      </text>
    </SvgFrame>
  );
}

function MuroContencion({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const H = Math.max(0.8, n(values, "H", 4));
  const D = Math.max(0.2, n(values, "D", 0.8));
  const A = Math.max(0.3, n(values, "A", 2));
  const C = Math.max(0.3, n(values, "C", 1.2));
  const F = Math.max(0.2, n(values, "F", 0.4));
  const Bp = Math.min(F, Math.max(0.12, n(values, "Bp", 0.2)));
  const esp = Math.max(0.15, Math.min(H * 0.6, n(values, "esp", 0.4)));
  const beta = n(values, "beta", 10);
  const hSat = Math.max(0, n(values, "hSat", 2));
  const B = A + C + F;
  const B1 = Math.max(0, (F - Bp) / 2);
  const sx = 300 / Math.max(B, 2.4);
  const sy = 200 / Math.max(H, 2.4);
  const x0 = 88;
  const yBot = 318;
  const yTop = yBot - H * sy;
  const yBase = yBot - esp * sy;
  const yFront = yBot - Math.min(D, H) * sy;
  const xP = x0;
  const xSF = x0 + C * sx;
  const xSB = x0 + (C + F) * sx;
  const xH = x0 + B * sx;
  const xTopF = xSF + B1 * sx;
  const xTopB = xSB - B1 * sx;
  const slope = Math.tan((beta * Math.PI) / 180) * sy;
  const xFill = xH + 46;
  const yFill = yBase - slope * ((xFill - xSB) / Math.max(sx, 1)) * (sx / sy);
  const yWater = yBot - Math.min(hSat, H) * sy;
  const wall = `${xP},${yBase} ${xP},${yBot} ${xH},${yBot} ${xH},${yBase} ${xSB},${yBase} ${xTopB},${yTop} ${xTopF},${yTop} ${xSF},${yBase}`;
  const dim = { active, onFocus };
  return (
    <SvgFrame caption="Muro en voladizo — pata, alma, talón y zapata corrida" heading="Cimentación y pantalla" viewBox="0 0 540 400">
      <polygon points={`${xSB},${yBase} ${xH},${yBase} ${xFill},${Math.min(yBase, yFill)} ${xFill},${yTop - 8} ${xTopB},${yTop}`} fill="#c4b48a" opacity="0.55" />
      {hSat > 0.05 ? (
        <polygon
          points={`${xSB},${yBase} ${xH},${yBase} ${xH},${Math.max(yWater, yTop)} ${xSB},${Math.max(yWater, yBase)}`}
          fill="#6a9cc9"
          opacity="0.28"
        />
      ) : null}
      <polygon points={`${xP - 8},${yFront} ${xP},${yFront} ${xP},${yBot} ${xP - 8},${yBot}`} fill="#b9a57a" opacity="0.7" />
      <line x1={xP - 36} y1={yBot} x2={xH + 52} y2={yBot} stroke="#8a7a55" strokeWidth="2" />
      <polygon points={wall} fill="url(#conc)" stroke="#1a4473" strokeWidth="1.6" />
      <polygon points={`${xSB},${yTop + 12} ${xSB + 78},${yTop + 12} ${xSB + 18},${yBase - 8} ${xSB},${yBase - 8}`} fill="#8b1e1e18" stroke="#8b1e1e" strokeWidth="1" />
      <text x={xSB + 38} y={yTop + 48} fontSize="10" fill="#8b1e1e">Pa</text>
      <text x={(xP + xSF) / 2} y={yBase - 8} textAnchor="middle" fontSize="10" fill="#1a4473" fontWeight="700">PATA</text>
      <text x={(xSF + xSB) / 2} y={(yTop + yBase) / 2} textAnchor="middle" fontSize="10" fill="#1a4473" fontWeight="700">ALMA</text>
      <text x={(xSB + xH) / 2} y={yBase - 8} textAnchor="middle" fontSize="10" fill="#1a4473" fontWeight="700">TALÓN</text>
      <text x={(xP + xH) / 2} y={yBot - 8} textAnchor="middle" fontSize="10" fill="#5a4a28">ZAPATA</text>
      <Dim x1={xP} y1={yBot} x2={xSF} y2={yBot} label={`${C.toFixed(2)}`} field="C" unit="m" side={28} {...dim} />
      <Dim x1={xSF} y1={yBot} x2={xSB} y2={yBot} label={`${F.toFixed(2)}`} field="F" unit="m" side={48} {...dim} />
      <Dim x1={xSB} y1={yBot} x2={xH} y2={yBot} label={`${A.toFixed(2)}`} field="A" unit="m" side={28} {...dim} />
      <Dim x1={xP} y1={yTop} x2={xP} y2={yBot} label={`${H.toFixed(2)}`} field="H" unit="m" side={-36} {...dim} />
      <Dim x1={xH} y1={yBase} x2={xH} y2={yBot} label={`${esp.toFixed(2)}`} field="esp" unit="m" side={22} {...dim} />
      <Dim x1={xP - 18} y1={yFront} x2={xP - 18} y2={yBot} label={`${D.toFixed(2)}`} field="D" unit="m" side={-22} {...dim} />
      <Dim x1={xTopF} y1={yTop} x2={xTopB} y2={yTop} label={`${Bp.toFixed(2)}`} field="Bp" unit="m" side={-18} {...dim} />
    </SvgFrame>
  );
}

function Empuje({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const H = n(values, "H", 3.5);
  return (
    <SvgFrame caption="Empuje activo — diagrama triangular ka γ H">
      <rect x="120" y="50" width="36" height="230" fill="url(#conc)" stroke="#1a4473" />
      <polygon points="156,50 156,280 310,280" fill="#8b1e1e22" stroke="#8b1e1e" />
      <text x="230" y="200" fontSize="11" fill="#8b1e1e">σ = ka γ H</text>
      <Dim x1={120} y1={50} x2={120} y2={280} label={`H=${H.toFixed(2)}`} field="H" side={-22} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function Cajon({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const B = n(values, "B", 1.6);
  const H = n(values, "H", 1.4);
  return (
    <SvgFrame caption="Alcantarilla tipo cajón — sección transversal">
      <rect x="80" y="70" width="360" height="40" fill="url(#soil)" />
      <rect x="140" y="110" width={B * 110} height={H * 90} fill="none" stroke="#1a4473" strokeWidth="18" />
      <rect x="140" y="110" width={B * 110} height={H * 90} fill="#9ec5e8" opacity="0.35" />
      <Dim x1={140} y1={110 + H * 90} x2={140 + B * 110} y2={110 + H * 90} label={`${B.toFixed(2)}`} field="B" unit="m" side={28} active={active} onFocus={onFocus} />
      <Dim x1={140} y1={110} x2={140} y2={110 + H * 90} label={`${H.toFixed(2)}`} field="H" unit="m" side={32} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

const SD_SHAPES: { id: string; title: string; icon: ReactNode }[] = [
  { id: "rect", title: "Rectangular", icon: <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" /> },
  { id: "circ", title: "Circular", icon: <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" /> },
  {
    id: "L",
    title: "Sección L",
    icon: <path d="M7 5 v14 h12 v-5 H12 V5 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  },
  {
    id: "T",
    title: "Sección T",
    icon: <path d="M5 5 h14 v5 H14 v9 H10 V10 H5 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  },
  {
    id: "C",
    title: "Sección C",
    icon: <path d="M18 6 H7 v12 h11 M7 12 h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  },
  {
    id: "I",
    title: "Sección I",
    icon: <path d="M6 5 h12 v4 H14 v6 h4 v4 H6 v-4 h4 V9 H6 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  },
  {
    id: "caja",
    title: "Caja hueca",
    icon: (
      <>
        <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="8.5" y="8.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
  },
  {
    id: "muro-be",
    title: "Muro con elementos de borde",
    icon: (
      <>
        <rect x="4" y="8" width="16" height="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <rect x="4" y="8" width="4" height="8" fill="currentColor" opacity="0.35" />
        <rect x="16" y="8" width="4" height="8" fill="currentColor" opacity="0.35" />
      </>
    ),
  },
  { id: "muro", title: "Muro rectangular", icon: <rect x="3" y="9" width="18" height="6" fill="none" stroke="currentColor" strokeWidth="1.6" /> },
  {
    id: "libre",
    title: "Polígono libre",
    icon: <path d="M7 6 L18 8 L16 18 L6 16 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  },
];

const SD_TOOLS: { id: string; title: string; icon: ReactNode }[] = [
  {
    id: "vertice",
    title: "Vértices — clic añade, arrastre mueve",
    icon: (
      <>
        <path d="M6 16 L12 6 L18 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6" cy="16" r="1.8" fill="currentColor" />
        <circle cx="12" cy="6" r="1.8" fill="currentColor" />
        <circle cx="18" cy="16" r="1.8" fill="currentColor" />
      </>
    ),
  },
  {
    id: "hueco",
    title: "Hueco — clic vértices, doble clic cierra",
    icon: (
      <>
        <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.5" />
      </>
    ),
  },
  {
    id: "barra",
    title: "Colocar barra",
    icon: (
      <>
        <circle cx="9" cy="12" r="3.2" fill="#c45c5c" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="16" cy="12" r="3.2" fill="#c45c5c" stroke="currentColor" strokeWidth="0.8" />
      </>
    ),
  },
  {
    id: "borrar",
    title: "Borrar vértice o barra",
    icon: <path d="M8 7 h8 l1 12 H7 Z M10 4 h4 v3 H10 Z M9 11 v5 M12 11 v5 M15 11 v5" fill="none" stroke="currentColor" strokeWidth="1.4" />,
  },
];

function InteraccionSeccion({
  values,
  active,
  onFocus,
  onChange,
  part,
}: {
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
  onChange?: (k: string, v: string) => void;
  part?: string;
}) {
  const edit = part === "designer";
  const change = edit ? onChange : undefined;
  const formaPM = String(values.formaPM ?? "rect");
  const forma = resolvePmForma(String(values.tipoElem ?? "columna"), formaPM, String(values.conBE ?? "si"));
  const libre = forma === "libre";
  const tool = String(values.sdTool ?? "vertice");
  const userPts = parsePolyText(String(values.polyUser ?? ""));
  const holeDraft = parsePolyText(String(values.holeDraft ?? ""));
  const b = n(values, "b", 40);
  const h = n(values, "h", 40);
  const tw = n(values, "tw", 20);
  const tf = n(values, "tf", 20);
  const tWall = n(values, "tWall", 20);
  const bBE = n(values, "bBE", 40);
  const rec = n(values, "rec", 4);
  let outer: { x: number; y: number }[] = [];
  let holes: { x: number; y: number }[][] = [];
  let bars: { x: number; y: number; As: number }[] = [];
  let gCx = 0;
  let gCy = 0;
  if (libre) {
    outer = userPts;
    holes = parseHolesText(String(values.holesUser ?? ""));
    bars = parseBarsText(String(values.barsUser ?? "")).filter((p) => Number.isFinite(p.x));
  } else {
    const preview = buildSection({
      forma,
      b,
      h: forma === "circ" ? b : h,
      tw,
      tf,
      tWall,
      rec,
      dest: barByName(values.dest || '3/8"').db,
      bar: values.bar || '3/4"',
      nBar: n(values, "nBar", 8),
      barBE: values.barBE || values.bar || '3/4"',
      nBarBE: n(values, "nBarBE", 4),
      nBarAlma: n(values, "nBarAlma", 2),
      nBarAla: n(values, "nBarAla", n(values, "nBarAlma", 2)),
      bBE,
      hBE: n(values, "hBE", h),
      barMalla: values.barMalla || '3/8"',
      sMalla: n(values, "sMalla", 20),
      nInner: n(values, "nInner", 0),
    });
    outer = preview.outer;
    holes = preview.holes;
    bars = preview.bars;
    gCx = preview.cx;
    gCy = preview.cy;
  }
  const zones = libre
    ? []
    : steelZonesFor({
        forma,
        b,
        h: forma === "circ" ? b : h,
        tw,
        tf,
        tWall,
        rec,
        dest: barByName(values.dest || '3/8"').db,
        bar: values.bar || '3/4"',
        nBar: n(values, "nBar", 8),
        barBE: values.barBE || values.bar || '3/4"',
        nBarBE: n(values, "nBarBE", 4),
        nBarAlma: n(values, "nBarAlma", 2),
        nBarAla: n(values, "nBarAla", n(values, "nBarAlma", 2)),
        bBE,
        hBE: n(values, "hBE", h),
        barMalla: values.barMalla || '3/8"',
        sMalla: n(values, "sMalla", 20),
        nInner: n(values, "nInner", 0),
      });
  const pts = libre && userPts.length >= 1 ? userPts : outer.length >= 3 ? outer : [
    { x: -b / 2, y: -h / 2 },
    { x: b / 2, y: -h / 2 },
    { x: b / 2, y: h / 2 },
    { x: -b / 2, y: h / 2 },
  ];
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  const all = [...pts, ...holes.flat(), ...holeDraft, ...bars];
  for (const p of all.length ? all : pts) {
    xmin = Math.min(xmin, p.x);
    xmax = Math.max(xmax, p.x);
    ymin = Math.min(ymin, p.y);
    ymax = Math.max(ymax, p.y);
  }
  if (!Number.isFinite(xmin)) {
    xmin = -40;
    xmax = 40;
    ymin = -40;
    ymax = 40;
  }
  const W = Math.max(xmax - xmin, 16);
  const Hgt = Math.max(ymax - ymin, 16);
  const VB_W = 560;
  const VB_H = 360;
  const padX = 78;
  const padY = 58;
  const sc = Math.min((VB_W - 2 * padX) / W, (VB_H - 2 * padY) / Hgt);
  const sx = sc;
  const sy = sc;
  const hitSc = sc;
  const X = (x: number) => VB_W / 2 + (x - (xmin + xmax) / 2) * sx;
  const Y = (y: number) => VB_H / 2 + 4 - (y - (ymin + ymax) / 2) * sy;
  const fromSvg = (svgX: number, svgY: number) => ({
    x: (svgX - VB_W / 2) / sx + (xmin + xmax) / 2,
    y: (ymin + ymax) / 2 - (svgY - (VB_H / 2 + 4)) / sy,
  });
  const dOuter = pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x)} ${Y(p.y)}`).join(" ") + (pts.length >= 3 ? " Z" : "");
  const As = bars.reduce((s, p) => s + (p.As > 0 ? p.As : 0), n(values, "As", 0) && bars.length ? 0 : n(values, "As", 0));
  const asShow = As > 0 ? As : n(values, "As", 0);
  const p = { active, onFocus, onChange: change };
  const drag = useRef<{ kind: "v" | "b"; i: number } | null>(null);
  const [, bump] = useState(0);

  const clientToCm = (e: { currentTarget: EventTarget; clientX: number; clientY: number }) => {
    const el = e.currentTarget as SVGGraphicsElement;
    const svg = (el.ownerSVGElement ?? el) as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const sp = pt.matrixTransform(m.inverse());
    return fromSvg(sp.x, sp.y);
  };

  const writePoly = (next: { x: number; y: number }[]) => change?.("polyUser", encodePoly(next));
  const writeBars = (next: { x: number; y: number; As: number }[]) => change?.("barsUser", encodeBars(next));
  const writeHoles = (next: { x: number; y: number }[][]) => change?.("holesUser", next.map(encodePoly).join("|"));

  const onCanvas = (e: PointerEvent<SVGRectElement>) => {
    if (!libre || !change) return;
    if ((e.target as Element).closest?.("[data-sd-handle]")) return;
    const cm = clientToCm(e);
    if (!cm) return;
    onFocus("polyUser");
    if (tool === "barra") {
      const as1 = barByName(values.bar || '3/4"').as;
      const cur = bars.length ? bars : parseBarsText(String(values.bars ?? ""));
      writeBars([...cur, { x: cm.x, y: cm.y, As: as1 }]);
      return;
    }
    if (tool === "borrar") {
      const hitV = pts.findIndex((q) => Math.hypot(q.x - cm.x, q.y - cm.y) < Math.max(2.2, 8 / hitSc));
      if (hitV >= 0) {
        writePoly(pts.filter((_, i) => i !== hitV));
        return;
      }
      const hitB = bars.findIndex((q) => Math.hypot(q.x - cm.x, q.y - cm.y) < Math.max(2.2, 8 / hitSc));
      if (hitB >= 0) writeBars(bars.filter((_, i) => i !== hitB));
      return;
    }
    if (tool === "hueco") {
      change("holeDraft", encodePoly([...holeDraft, cm]));
      return;
    }
    writePoly([...pts, cm]);
  };

  const onDbl = (e: MouseEvent) => {
    if (!libre || !change) return;
    e.preventDefault();
    if (tool === "hueco" && holeDraft.length >= 3) {
      writeHoles([...holes, holeDraft]);
      change("holeDraft", "");
    }
  };

  const onContext = (e: MouseEvent) => {
    if (!libre || !change) return;
    e.preventDefault();
    if (tool === "hueco" && holeDraft.length) {
      change("holeDraft", encodePoly(holeDraft.slice(0, -1)));
      return;
    }
    if (pts.length) writePoly(pts.slice(0, -1));
  };

  const startDrag = (kind: "v" | "b", i: number) => (e: PointerEvent) => {
    if (!libre || !change) return;
    e.stopPropagation();
    drag.current = { kind, i };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e: PointerEvent) => {
    if (!drag.current || !change) return;
    const cm = clientToCm(e);
    if (!cm) return;
    if (drag.current.kind === "v") {
      const next = pts.map((q, i) => (i === drag.current!.i ? cm : q));
      writePoly(next);
    } else {
      const next = bars.map((q, i) => (i === drag.current!.i ? { ...q, x: cm.x, y: cm.y } : q));
      writeBars(next);
    }
    bump((x) => x + 1);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const pickShape = (id: string) => {
    if (!change || String(values.formaPM) === id) return;
    change("formaPM", id);
  };
  const pickTool = (id: string) => {
    if (!change) return;
    if (!libre) change("formaPM", "libre");
    change("sdTool", id);
  };
  const prop = (field: string, label: string, unit: string) => (
    <label key={field} className={`sd-prop${active === field ? " is-on" : ""}`}>
      <span>{label}</span>
      <input
        value={values[field] ?? ""}
        inputMode="decimal"
        onFocus={() => onFocus(field)}
        onChange={(e) => change?.(field, e.target.value.replace(",", "."))}
      />
      <em>{unit}</em>
    </label>
  );

  const cx = libre ? (xmin + xmax) / 2 : gCx;
  const cy = libre ? (ymin + ymax) / 2 : gCy;
  const caption = libre
    ? `Section Designer · ${tool} · ${pts.length} vértices · ${bars.length} barras · clic añade, arrastre mueve, doble clic cierra hueco`
    : `${describeForma(forma)} · ${bars.length} barras · As = ${asShow.toFixed(2)} cm² · G (${cx.toFixed(1)}; ${cy.toFixed(1)}) cm · rec ${rec.toFixed(1)} cm`;

  const grid: ReactNode[] = [];
  const step = W > 180 ? 50 : W > 80 ? 20 : 10;
  const gx0 = Math.floor(xmin / step) * step;
  const gy0 = Math.floor(ymin / step) * step;
  for (let x = gx0; x <= xmax + 0.01; x += step) {
    grid.push(<line key={`gx${x}`} x1={X(x)} y1={Y(ymin) + 8} x2={X(x)} y2={Y(ymax) - 8} stroke="#d8d0c0" strokeWidth="0.5" pointerEvents="none" />);
  }
  for (let y = gy0; y <= ymax + 0.01; y += step) {
    grid.push(<line key={`gy${y}`} x1={X(xmin) - 8} y1={Y(y)} x2={X(xmax) + 8} y2={Y(y)} stroke="#d8d0c0" strokeWidth="0.5" pointerEvents="none" />);
  }

  const toolbar = (
    <div className="sd-toolbar" role="toolbar" aria-label="Section Designer">
      <span className="sd-toolbar-title">Section Designer</span>
      {SD_SHAPES.map((sh) => (
        <button
          key={sh.id}
          type="button"
          className={formaPM === sh.id || forma === sh.id ? "is-on" : undefined}
          title={sh.title}
          aria-label={sh.title}
          aria-pressed={formaPM === sh.id || forma === sh.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            pickShape(sh.id);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">{sh.icon}</svg>
        </button>
      ))}
      <span className="sd-sep" />
      {SD_TOOLS.map((tl) => (
        <button
          key={tl.id}
          type="button"
          className={libre && tool === tl.id ? "is-on" : undefined}
          title={tl.title}
          aria-label={tl.title}
          aria-pressed={libre && tool === tl.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            pickTool(tl.id);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">{tl.icon}</svg>
        </button>
      ))}
    </div>
  );

  const ribbon = (
    <div className="sd-props">
      {forma === "circ" ? prop("b", "Ø", "cm") : prop("b", "b", "cm")}
      {forma !== "circ" ? prop("h", "h", "cm") : null}
      {["L", "T", "C", "I"].includes(forma) ? prop("tw", "tw", "cm") : null}
      {["L", "T", "C", "I"].includes(forma) ? prop("tf", "tf", "cm") : null}
      {forma === "caja" ? prop("tWall", "e", "cm") : null}
      {["L", "T", "C", "I", "muro-be", "caja"].includes(forma) ? prop("bBE", "bBE", "cm") : null}
      {["L", "T", "C", "I", "muro-be", "caja"].includes(forma) ? prop("nBarBE", "n conf", "") : null}
      {["L", "T", "C", "I"].includes(forma) ? prop("nBarAla", "n ala", "") : null}
      {["L", "T", "C", "I", "muro-be", "muro"].includes(forma) ? prop("nBarAlma", "n alma", "") : null}
      {forma !== "muro-be" && forma !== "muro" && !["L", "T", "C", "I"].includes(forma) ? prop("nBar", "n", "") : null}
      {forma === "muro" || forma === "muro-be" ? prop("sMalla", "s malla", "cm") : null}
      {prop("rec", "rec", "cm")}
    </div>
  );

  return (
    <SvgFrame
      heading={edit ? "Section Designer" : "Sección"}
      caption={edit ? caption : `${describeForma(forma)} · ${bars.length} barras · As = ${asShow.toFixed(2)} cm²`}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      toolbar={edit ? toolbar : undefined}
      ribbon={edit ? ribbon : undefined}
    >
      {grid}
      <line x1={X(cx) - 46} y1={Y(cy)} x2={X(cx) + 46} y2={Y(cy)} stroke="#8a6a32" strokeWidth="0.9" strokeDasharray="4 3" pointerEvents="none" />
      <line x1={X(cx)} y1={Y(cy) - 46} x2={X(cx)} y2={Y(cy) + 46} stroke="#8a6a32" strokeWidth="0.9" strokeDasharray="4 3" pointerEvents="none" />
      <text x={X(cx) + 50} y={Y(cy) + 4} fontSize="9" fill="#8a6a32" pointerEvents="none">3</text>
      <text x={X(cx) + 3} y={Y(cy) - 50} fontSize="9" fill="#8a6a32" pointerEvents="none">2</text>
      <circle cx={X(cx)} cy={Y(cy)} r="3.2" fill="#8a6a32" pointerEvents="none" />
      <text x={X(cx) + 7} y={Y(cy) - 7} fontSize="9" fill="#8a6a32" fontFamily="IBM Plex Sans, sans-serif" pointerEvents="none">
        G
      </text>
      <rect
        x="0"
        y="0"
        width={VB_W}
        height={VB_H}
        fill="transparent"
        pointerEvents={edit && libre ? "all" : "none"}
        style={{ cursor: edit && libre ? "crosshair" : "default" }}
        onPointerDown={onCanvas}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onDoubleClick={onDbl}
        onContextMenu={onContext}
      />
      {pts.length >= 2 ? <path d={dOuter} fill={pts.length >= 3 ? "url(#conc)" : "none"} stroke="#1a4473" strokeWidth="2.2" fillOpacity={pts.length >= 3 ? 1 : 0} pointerEvents="none" /> : null}
      {zones.map((z, i) => {
        const conf = z.kind === "conf";
        return (
          <g key={`z${i}`} pointerEvents="none">
            <rect
              x={X(z.x0)}
              y={Y(z.y1)}
              width={Math.max(2, X(z.x1) - X(z.x0))}
              height={Math.max(2, Y(z.y0) - Y(z.y1))}
              fill={conf ? "#8a7344" : "#1a4473"}
              fillOpacity={conf ? 0.28 : 0.08}
              stroke={conf ? "#5c4a28" : "#1a4473"}
              strokeWidth={conf ? 1.3 : 0.9}
              strokeDasharray={conf ? undefined : "4 3"}
            />
            <text
              x={(X(z.x0) + X(z.x1)) / 2}
              y={(Y(z.y0) + Y(z.y1)) / 2 + 3}
              textAnchor="middle"
              fontSize="8"
              fill={conf ? "#5c4a28" : "#1a4473"}
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {z.label}
            </text>
          </g>
        );
      })}
      {holes.map((hh, i) => (
        <path
          key={`h${i}`}
          d={hh.map((pt, j) => `${j === 0 ? "M" : "L"}${X(pt.x)} ${Y(pt.y)}`).join(" ") + " Z"}
          fill="#fbf8f1"
          stroke="#1a4473"
          strokeWidth="1.6"
          pointerEvents="none"
        />
      ))}
      {holeDraft.length >= 1 ? (
        <polyline
          points={holeDraft.map((pt) => `${X(pt.x)},${Y(pt.y)}`).join(" ")}
          fill="none"
          stroke="#8b1e1e"
          strokeWidth="1.4"
          strokeDasharray="5 3"
          pointerEvents="none"
        />
      ) : null}
      {bars.map((bar, i) => {
        const db = 2 * Math.sqrt(Math.max(bar.As, 0.32) / Math.PI);
        const r = Math.max(1.6, (db / 2) * sc);
        return (
          <g key={`b${i}`} data-sd-handle="1" onPointerDown={startDrag("b", i)} onPointerMove={moveDrag} onPointerUp={endDrag} style={{ cursor: libre ? "grab" : "default" }}>
            <circle cx={X(bar.x)} cy={Y(bar.y)} r={r} fill="#8b1e1e" stroke="#3b0d0d" strokeWidth={Math.min(0.7, r * 0.22)} />
            {r >= 2.4 ? <circle cx={X(bar.x)} cy={Y(bar.y)} r={Math.min(1, r * 0.28)} fill="#f7efe3" /> : null}
          </g>
        );
      })}
      {libre && edit
        ? pts.map((pt, i) => (
            <g key={`v${i}`} data-sd-handle="1" onPointerDown={startDrag("v", i)} onPointerMove={moveDrag} onPointerUp={endDrag} style={{ cursor: "move" }}>
              <circle cx={X(pt.x)} cy={Y(pt.y)} r="5.2" fill="#c4a056" stroke="#0b1f33" strokeWidth="1" />
              <text x={X(pt.x) + 7} y={Y(pt.y) - 6} fontSize="8" fill="#0b1f33">
                {i + 1}
              </text>
            </g>
          ))
        : null}
      {forma === "circ" ? (
        <Dim x1={X(cx - W / 2)} y1={Y(cy)} x2={X(cx + W / 2)} y2={Y(cy)} label={`Ø ${W.toFixed(0)}`} field="b" unit="cm" side={-28} {...p} />
      ) : (
        <>
          <Dim x1={X(xmin)} y1={Y(ymin)} x2={X(xmax)} y2={Y(ymin)} label={W.toFixed(0)} field={libre ? undefined : "b"} unit="cm" side={22} {...p} />
          <Dim x1={X(xmin)} y1={Y(ymin)} x2={X(xmin)} y2={Y(ymax)} label={Hgt.toFixed(0)} field={libre ? undefined : "h"} unit="cm" side={-22} {...p} />
        </>
      )}
      {forma === "muro-be" ? (
        <Dim x1={X(xmin)} y1={Y(ymax)} x2={X(xmin + bBE)} y2={Y(ymax)} label={bBE.toFixed(0)} field="bBE" unit="cm" side={-18} {...p} />
      ) : null}
      {forma === "L" || forma === "C" ? (
        <>
          <Dim x1={X(xmin)} y1={Y(ymin + tf)} x2={X(xmin + tw)} y2={Y(ymin + tf)} label={tw.toFixed(0)} field="tw" unit="cm" side={-16} {...p} />
          <Dim x1={X(xmax)} y1={Y(ymin)} x2={X(xmax)} y2={Y(ymin + tf)} label={tf.toFixed(0)} field="tf" unit="cm" side={16} {...p} />
        </>
      ) : null}
      {forma === "T" || forma === "I" ? (
        <>
          <Dim x1={X(cx - tw / 2)} y1={Y(ymin)} x2={X(cx + tw / 2)} y2={Y(ymin)} label={tw.toFixed(0)} field="tw" unit="cm" side={-16} {...p} />
          <Dim x1={X(xmax)} y1={Y(ymax - tf)} x2={X(xmax)} y2={Y(ymax)} label={tf.toFixed(0)} field="tf" unit="cm" side={16} {...p} />
        </>
      ) : null}
      {forma === "caja" ? (
        <Dim x1={X(xmin)} y1={Y(cy)} x2={X(xmin + tWall)} y2={Y(cy)} label={tWall.toFixed(0)} field="tWall" unit="cm" side={18} {...p} />
      ) : null}
    </SvgFrame>
  );
}

function Septico({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const L = n(values, "L", 6);
  const B = n(values, "B", 2);
  const hu = n(values, "hu", 1.8);
  const BL = n(values, "BL", 0.3);
  const L1 = n(values, "L1", (2 / 3) * L);
  const L2 = n(values, "L2", L - L1);
  const two = values.twoCam !== "no" && L2 > 0.15;
  const Dpozo = n(values, "Dpozo", 2);
  const nPozos = Math.max(1, Math.round(n(values, "nPozos", 1)));
  const Hpozo = n(values, "Hpozo", 2.5);
  const nZanjas = Math.max(0, Math.round(n(values, "nZanjas", 0)));
  const Lzanja = n(values, "Lzanja", 20);
  const bZanja = n(values, "bZanja", 0.9);
  const ladoLecho = n(values, "ladoLecho", 3.6);
  const p = { active, onFocus };
  const H = hu + BL;

  const padL = 90;
  const padR = 64;
  const padT = 54;
  const padB = 58;
  const innerW = 520 - padL - padR;
  const innerH = 268 - padT - padB;
  const sc = Math.min(innerW / Math.max(L, 0.8), innerH / Math.max(B, 0.6));
  const w = L * sc;
  const h = Math.max(58, B * sc);
  const x0 = padL + (innerW - w) / 2;
  const y0 = padT + (innerH - h) / 2;
  const xTab = x0 + (two ? L1 * sc : w);
  const midY = y0 + h / 2;

  const yCut = 196;
  const scH = Math.min(112 / Math.max(H, 1.2), 88);
  const yTop = yCut - H * scH;
  const yWater = yCut - hu * scH;

  const nShowPz = Math.min(nPozos, 4);
  const rPz = nShowPz >= 4 ? 15 : 19;
  const gapPz = 10;
  const spanPz = nShowPz * (2 * rPz) + Math.max(0, nShowPz - 1) * gapPz;
  const pz0 = 28 + (150 - spanPz) / 2;
  const nShowZn = Math.min(Math.max(nZanjas, 0), 3);

  return (
    <div className="fig-stack fig-stack-septico">
      <SvgFrame clip heading="Planta" caption="Cámara de digestión ⅔ L y cámara de descarga ⅓ L (OS.090)" viewBox="0 0 520 268">
        <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="#1a4473" strokeWidth="8" />
        <rect x={x0 + 6} y={y0 + 6} width={Math.max(8, (two ? L1 * sc : w) - 12)} height={h - 12} fill="#9ec5e8" fillOpacity="0.45" />
        {two ? <rect x={xTab + 2} y={y0 + 6} width={Math.max(8, L2 * sc - 10)} height={h - 12} fill="#7eb3d9" fillOpacity="0.45" /> : null}
        {two ? <rect x={xTab - 5} y={y0} width="10" height={h} fill="url(#conc)" stroke="#1a4473" /> : null}
        <path d={`M${x0 - 30} ${midY} H${x0 + 16}`} stroke="#8b1e1e" strokeWidth="2.2" markerEnd="url(#arr)" />
        <rect x={x0 + 12} y={midY - 12} width="8" height="24" fill="#1a4473" />
        <text x={x0 - 14} y={midY - 16} textAnchor="middle" fontSize="8" fill="#8b1e1e">
          Te in
        </text>
        <rect x={x0 + w - 20} y={midY - 12} width="8" height="24" fill="#1a4473" />
        <path d={`M${x0 + w - 16} ${midY} H${x0 + w + 30}`} stroke="#8b1e1e" strokeWidth="2.2" markerEnd="url(#arr)" />
        <text x={x0 + w + 14} y={midY - 16} textAnchor="middle" fontSize="8" fill="#8b1e1e">
          Te out
        </text>
        <text x={x0 + (two ? (L1 * sc) / 2 : w / 2)} y={y0 + h / 2 + 4} textAnchor="middle" fontSize="11" fill="#1a4473">
          {two ? "Cámara 1  ·  ⅔ L" : "Cámara única"}
        </text>
        {two ? (
          <text x={xTab + (L2 * sc) / 2} y={y0 + h / 2 + 4} textAnchor="middle" fontSize="11" fill="#1a4473">
            ⅓ L
          </text>
        ) : null}
        <Dim x1={x0} y1={y0 + h} x2={x0 + w} y2={y0 + h} label={L.toFixed(2)} field="L" unit="m" side={22} {...p} />
        <Dim x1={x0} y1={y0} x2={x0} y2={y0 + h} label={B.toFixed(2)} field="B" unit="m" side={-22} {...p} />
        {two ? <Dim x1={x0} y1={y0} x2={xTab} y2={y0} label={L1.toFixed(2)} unit="m" side={-18} {...p} /> : null}
      </SvgFrame>
      <SvgFrame clip heading="Corte longitudinal" caption={`Altura útil hu + borde libre. H total = ${H.toFixed(2)} m`} viewBox="0 0 520 268">
        <rect x={x0} y={yCut} width={w} height="14" fill="url(#conc)" stroke="#1a4473" />
        <rect x={x0} y={yTop} width="12" height={H * scH} fill="url(#conc)" stroke="#1a4473" />
        <rect x={x0 + w - 12} y={yTop} width="12" height={H * scH} fill="url(#conc)" stroke="#1a4473" />
        <rect x={x0} y={yTop} width={w} height="12" fill="url(#conc)" stroke="#1a4473" />
        <rect x={x0 + 12} y={yWater} width={w - 24} height={hu * scH} fill="#9ec5e8" fillOpacity="0.4" />
        {two ? <rect x={xTab - 5} y={yTop} width="10" height={H * scH} fill="url(#conc)" stroke="#1a4473" /> : null}
        <line x1={x0 + 12} y1={yWater} x2={x0 + w - 12} y2={yWater} stroke="#1a4473" strokeDasharray="4 3" />
        <text x={x0 + w / 2} y={yWater + hu * scH * 0.45} textAnchor="middle" fontSize="10" fill="#1a4473">
          hu líquido
        </text>
        <text x={x0 + w / 2} y={(yTop + 12 + yWater) / 2 + 3} textAnchor="middle" fontSize="9" fill="#8b1e1e">
          borde libre
        </text>
        <path d={`M${x0 - 18} ${yWater + 16} H${x0 + 20} V${yWater - 6}`} fill="none" stroke="#8b1e1e" strokeWidth="2" />
        <path d={`M${x0 + w + 18} ${yWater + 20} H${x0 + w - 20} V${yWater - 6}`} fill="none" stroke="#8b1e1e" strokeWidth="2" />
        <Dim x1={x0} y1={yCut} x2={x0} y2={yWater} label={hu.toFixed(2)} field="hu" unit="m" side={-26} {...p} />
        <Dim x1={x0 + w} y1={yTop} x2={x0 + w} y2={yWater} label={BL.toFixed(2)} field="BL" unit="m" side={26} {...p} />
      </SvgFrame>
      <SvgFrame clip heading="Efluente" caption="Pozos, zanjas de infiltración y lecho de secado (RNE OS.090)" viewBox="0 0 520 268">
        <text x="103" y="26" textAnchor="middle" fontSize="11" fill="#6b6458">
          Pozos
        </text>
        {Array.from({ length: nShowPz }, (_, i) => {
          const cx = pz0 + rPz + i * (2 * rPz + gapPz);
          return (
            <g key={`pz${i}`}>
              <circle cx={cx} cy="88" r={rPz} fill="#cbb892" fillOpacity="0.45" stroke="#1a4473" strokeWidth="2" />
              <circle cx={cx} cy="88" r={Math.max(6, rPz * 0.42)} fill="#9ec5e8" fillOpacity="0.5" stroke="#1a4473" />
            </g>
          );
        })}
        <Dim x1={pz0} y1={88 + rPz + 6} x2={pz0 + 2 * rPz} y2={88 + rPz + 6} label={Dpozo.toFixed(2)} field="Dpozo" unit="m" side={14} {...p} />
        <text x="103" y="208" textAnchor="middle" fontSize="10" fill="#1a4473">
          {nPozos} Ø {Dpozo.toFixed(2)} m
        </text>
        <text x="103" y="224" textAnchor="middle" fontSize="10" fill="#6b6458">
          H útil {Hpozo.toFixed(2)} m
        </text>
        <line x1="186" y1="36" x2="186" y2="236" stroke="#d4cbb8" />
        <text x="268" y="26" textAnchor="middle" fontSize="11" fill="#6b6458">
          Zanjas
        </text>
        {nShowZn > 0 ? (
          Array.from({ length: nShowZn }, (_, i) => (
            <rect key={`z${i}`} x="198" y={48 + i * 26} width="140" height="16" fill="#cbb892" fillOpacity="0.4" stroke="#1a4473" />
          ))
        ) : (
          <text x="268" y="92" textAnchor="middle" fontSize="10" fill="#8a6a32">
            Sin zanjas
          </text>
        )}
        {nShowZn > 0 ? (
          <Dim x1={198} y1={48 + nShowZn * 26} x2={338} y2={48 + nShowZn * 26} label={Lzanja.toFixed(1)} field="Lzanja" unit="m" side={14} {...p} />
        ) : null}
        <text x="268" y="208" textAnchor="middle" fontSize="10" fill="#1a4473">
          {nZanjas} × {Lzanja.toFixed(1)} m
        </text>
        <text x="268" y="224" textAnchor="middle" fontSize="10" fill="#6b6458">
          b = {bZanja.toFixed(2)} m
        </text>
        <line x1="356" y1="36" x2="356" y2="236" stroke="#d4cbb8" />
        <text x="438" y="26" textAnchor="middle" fontSize="11" fill="#6b6458">
          Lecho
        </text>
        <rect x="398" y="52" width="80" height="80" fill="#d8c48a" fillOpacity="0.5" stroke="#1a4473" />
        <text x="438" y="96" textAnchor="middle" fontSize="10" fill="#1a4473">
          secado
        </text>
        <text x="438" y="208" textAnchor="middle" fontSize="10" fill="#1a4473">
          {ladoLecho.toFixed(1)} × {ladoLecho.toFixed(1)} m
        </text>
        <text x="438" y="224" textAnchor="middle" fontSize="10" fill="#6b6458">
          0.10 m²/hab
        </text>
      </SvgFrame>
    </div>
  );
}

function Ptar({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const Btot = n(values, "Btot", 0.8);
  const Dsed = n(values, "Dsed", 12);
  const Hsed = n(values, "Hsed", 3.3);
  const Bdes = n(values, "Bdes", 0.22);
  const nBar = Math.max(3, Math.round(n(values, "nBar", 25)));
  const p = { active, onFocus };
  const r = 68;
  return (
    <SvgFrame heading="Línea de tratamiento" caption="Rejilla → desarenador de canal → sedimentador primario circular" viewBox="0 0 520 280">
      <text x="90" y="28" textAnchor="middle" fontSize="10" fill="#6b6458">Rejilla</text>
      {Array.from({ length: Math.min(nBar, 12) }, (_, i) => (
        <line key={i} x1={50 + i * 7} y1="40" x2={62 + i * 7} y2="110" stroke="#1a4473" strokeWidth="1.6" />
      ))}
      <Dim x1={48} y1={118} x2={48 + Math.min(nBar, 12) * 7} y2={118} label={Btot.toFixed(2)} field="Btot" unit="m" side={16} {...p} />
      <rect x="170" y="48" width="110" height="70" fill="#cbb892" fillOpacity="0.35" stroke="#1a4473" />
      <text x="225" y="82" textAnchor="middle" fontSize="10" fill="#1a4473">Desarenador</text>
      <text x="225" y="98" textAnchor="middle" fontSize="9" fill="#6b6458">B {Bdes.toFixed(2)} m</text>
      <circle cx="390" cy="95" r={r} fill="#9ec5e8" fillOpacity="0.4" stroke="#1a4473" strokeWidth="3" />
      <circle cx="390" cy="95" r="8" fill="#1a4473" />
      <line x1={390 - r} y1="95" x2={390 + r} y2="95" stroke="#8b1e1e" strokeWidth="1.1" strokeDasharray="4 3" />
      <Dim x1={390 - r} y1={95} x2={390 + r} y2={95} label={Dsed.toFixed(2)} field="Dsed" unit="m" side={-18} {...p} />
      <text x="390" y="185" textAnchor="middle" fontSize="10" fill="#1a4473">
        Sedimentador H {Hsed.toFixed(2)} m
      </text>
      <path d="M140 75 L168 75" stroke="#8b1e1e" strokeWidth="1.4" markerEnd="url(#arr)" />
      <path d="M282 75 L318 75" stroke="#8b1e1e" strokeWidth="1.4" markerEnd="url(#arr)" />
      <text x="260" y="240" textAnchor="middle" fontSize="11" fill="#1a4473">
        Qarr · DBO · vs = 30–40 m³/m²·d
      </text>
    </SvgFrame>
  );
}

function TableroElec({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const sis = String(values.sistema ?? "monofásico").toLowerCase();
  const tri = sis.includes("tri");
  const In = n(values, "In", 40);
  const Id = n(values, "Id", 55);
  const Smm = n(values, "Smm", 10);
  const awg = String(values.awg ?? "8 AWG");
  const V = n(values, "V", 220);
  const p = { active, onFocus };
  const phases = tri ? ["L1", "L2", "L3", "N"] : ["L", "N"];
  return (
    <SvgFrame heading="Unifilar del alimentador" caption={`${tri ? "Trifásico" : "Monofásico"} ${V.toFixed(0)} V  ·  K = ${tri ? "√3" : "1"}  ·  THW-90`} viewBox="0 0 520 280">
      <rect x="40" y="36" width="70" height="48" fill="none" stroke="#1a4473" strokeWidth="2" />
      <text x="75" y="58" textAnchor="middle" fontSize="10" fill="#1a4473">Red</text>
      <text x="75" y="74" textAnchor="middle" fontSize="9" fill="#6b6458">{V.toFixed(0)} V</text>
      {phases.map((ph, i) => {
        const y = 110 + i * 28;
        return (
          <g key={ph}>
            <line x1="75" y1="84" x2="75" y2={y} stroke="#1a4473" strokeWidth="1.4" />
            <line x1="75" y1={y} x2="310" y2={y} stroke="#1a4473" strokeWidth="1.8" />
            <text x="88" y={y - 6} fontSize="9" fill="#6b6458">{ph}</text>
          </g>
        );
      })}
      <rect x="310" y="96" width="86" height={tri ? 118 : 62} fill="#d9d2c3" stroke="#1a4473" strokeWidth="2" />
      <text x="353" y={tri ? 158 : 132} textAnchor="middle" fontSize="10" fill="#1a4473">
        Tablero
      </text>
      <text x="430" y="124" fontSize="11" fill="#1a4473">
        L = {String(values.Lcond ?? "12.5")} m
      </text>
      <text x="430" y="146" fontSize="11" fill="#1a4473">
        Iₙ = {In.toFixed(2)} A
      </text>
      <text x="430" y="168" fontSize="11" fill="#1a4473">
        I_d = {Id.toFixed(2)} A
      </text>
      <text x="430" y="190" fontSize="11" fill="#8b1e1e">
        {Smm.toFixed(1)} mm² / {awg}
      </text>
      <Dim x1={75} y1={110 + (phases.length - 1) * 28} x2={310} y2={110 + (phases.length - 1) * 28} label={String(values.Lcond ?? "12.5")} field="Lcond" unit="m" side={22} {...p} />
    </SvgFrame>
  );
}

function Pavimento({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const kind = String(values.pavKind ?? "").trim();
  const isIg = kind === "" && (values.nAuto == null || values.nAuto === "");

  if (isIg) {
  return (
    <SvgFrame caption="Paquete de camino vecinal — carpeta + base + subrasante">
      <rect x="80" y="70" width="360" height="40" fill="#3d3d3d" />
      <rect x="80" y="110" width="360" height="55" fill="#c2b280" />
      <rect x="80" y="165" width="360" height="90" fill="url(#soil)" />
      <text x="260" y="95" textAnchor="middle" fontSize="11" fill="#eee">Carpeta</text>
      <text x="260" y="142" textAnchor="middle" fontSize="11" fill="#1a4473">Base granular</text>
      <text x="260" y="215" textAnchor="middle" fontSize="11" fill="#1a4473">Subrasante  Ig</text>
      <text x="400" y="300" fontSize="10" fill="#1a4473">%200 = {n(values, "F", 77).toFixed(1)}</text>
      </SvgFrame>
    );
  }

  if (kind === "esal") {
    const tpda = n(values, "tpda", 0);
    const w18f = n(values, "W18f", 0);
    const w18r = n(values, "W18r", 0);
    return (
      <SvgFrame heading="Tránsito" caption="Eje simple equivalente de 18 kip (80 kN) — W18 de diseño">
        <text x="260" y="36" textAnchor="middle" fontSize="12" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
          Eje de diseño AASHTO 18 kip
        </text>
        <line x1="90" y1="88" x2="430" y2="88" stroke="#2c2c2c" strokeWidth="6" strokeLinecap="round" />
        <circle cx="150" cy="118" r="28" fill="#2c2c2c" />
        <circle cx="150" cy="118" r="12" fill="#c9c0b0" />
        <circle cx="210" cy="118" r="28" fill="#2c2c2c" />
        <circle cx="210" cy="118" r="12" fill="#c9c0b0" />
        <circle cx="330" cy="118" r="28" fill="#2c2c2c" />
        <circle cx="330" cy="118" r="12" fill="#c9c0b0" />
        <circle cx="390" cy="118" r="28" fill="#2c2c2c" />
        <circle cx="390" cy="118" r="12" fill="#c9c0b0" />
        <text x="180" y="168" textAnchor="middle" fontSize="11" fill="#1a4473">Dual 9 kip</text>
        <text x="360" y="168" textAnchor="middle" fontSize="11" fill="#1a4473">Dual 9 kip</text>
        <text x="260" y="198" textAnchor="middle" fontSize="12" fill="#8b1e1e" fontFamily="IBM Plex Sans, sans-serif">
          TPDA₀ = {tpda.toLocaleString("es-PE", { maximumFractionDigits: 0 })} veh/día
        </text>
        <text x="260" y="228" textAnchor="middle" fontSize="13" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
          W18 flex = {w18f.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
        </text>
        <text x="260" y="252" textAnchor="middle" fontSize="13" fill="#1a4473" fontFamily="IBM Plex Sans, sans-serif">
          W18 ríg = {w18r.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
        </text>
        <text x="260" y="286" textAnchor="middle" fontSize="10" fill="#6b6458">
          W18 = 365 · TPDA · fE · Fd · Fc · GF    ·    carril de diseño
        </text>
      </SvgFrame>
    );
  }

  type Layer = { field: string; hcm: number; fill: string; fg: string; label: string };
  const D1 = n(values, "D1", 10);
  const D2 = n(values, "D2", 20);
  const D3 = n(values, "D3", 25);
  const eArena = n(values, "eArena", 4);
  const CBR = n(values, "CBR", 6);
  const layers: Layer[] = [];
  if (kind === "adoquin") {
    layers.push({ field: "eAdoq", hcm: D1, fill: "#b24a3a", fg: "#fff", label: "Adoquín" });
    layers.push({ field: "eArena", hcm: eArena, fill: "#e4d5a8", fg: "#1a4473", label: "Cama de arena" });
    layers.push({ field: "D2", hcm: D2, fill: "#c4a35a", fg: "#1a4473", label: "Base granular" });
    layers.push({ field: "D3", hcm: D3, fill: "#d8c48a", fg: "#1a4473", label: "Subbase" });
  } else if (kind === "rig") {
    layers.push({ field: "D", hcm: D1, fill: "#d9d2c3", fg: "#1a4473", label: "Losa PCC" });
    if (D2 > 0.5) layers.push({ field: "eBase", hcm: D2, fill: "#c4a35a", fg: "#1a4473", label: "Subbase" });
  } else if (kind === "mixto") {
    layers.push({ field: "eAC", hcm: D1, fill: "#3d3d3d", fg: "#eee", label: "Carpeta AC" });
    layers.push({ field: "D", hcm: D2, fill: "#d9d2c3", fg: "#1a4473", label: "Losa PCC" });
    if (D3 > 0.5) layers.push({ field: "eBase", hcm: D3, fill: "#c4a35a", fg: "#1a4473", label: "Subbase" });
  } else {
    layers.push({ field: "D1", hcm: D1, fill: "#3d3d3d", fg: "#eee", label: "Carpeta AC" });
    layers.push({ field: "D2", hcm: D2, fill: "#c4a35a", fg: "#1a4473", label: "Base granular" });
    layers.push({ field: "D3", hcm: D3, fill: "#d8c48a", fg: "#1a4473", label: "Subbase" });
  }

  const x = 70;
  const w = 300;
  const y0 = 42;
  const soilH = 62;
  const sum = layers.reduce((s, l) => s + Math.max(l.hcm, 0.1), 0);
  const scale = Math.min(4.4, 188 / Math.max(sum, 1));
  const px = layers.map((l) => Math.max(18, l.hcm * scale));
  const captions: Record<string, string> = {
    flex: "Corte del paquete flexible — carpeta, base y subbase",
    rig: "Corte de losa de concreto con pasadores y subbase",
    mixto: "Pavimento mixto nuevo — carpeta sobre losa PCC",
    adoquin: "Pavimento intertrabado — adoquín, arena, base y subbase",
  };

  let y = y0;
  const blocks = layers.map((l, i) => {
    const h = px[i]!;
    const top = y;
    y += h;
    return { ...l, top, h };
  });
  const soilY = y;
  const totalH = soilY + soilH;

  return (
    <SvgFrame heading="Paquete estructural" caption={captions[kind] ?? "Corte del pavimento AASHTO 93"} viewBox={`0 0 520 ${Math.max(340, totalH + 48)}`}>
      <defs>
        <pattern id="pav-gran" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#c4a35a" />
          <circle cx="2" cy="3" r="1.1" fill="#8a7344" />
          <circle cx="6" cy="6" r="0.9" fill="#a89058" />
        </pattern>
        <pattern id="pav-ac" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#3d3d3d" />
          <circle cx="1" cy="2" r="0.5" fill="#5a5a5a" />
          <circle cx="4" cy="4" r="0.4" fill="#2a2a2a" />
        </pattern>
      </defs>
      {blocks.map((b) => (
        <g key={b.field}>
          <rect
            x={x}
            y={b.top}
            width={w}
            height={b.h}
            fill={b.fill === "#c4a35a" || b.fill === "#d8c48a" ? "url(#pav-gran)" : b.fill === "#3d3d3d" ? "url(#pav-ac)" : b.fill}
            stroke="#1a4473"
            strokeWidth="0.8"
          />
          {kind === "adoquin" && b.field === "eAdoq" && (
            <g opacity="0.85">
              {Array.from({ length: Math.max(2, Math.floor(b.h / 7)) }, (_, r) =>
                Array.from({ length: 9 }, (_, c) => (
                  <rect
                    key={`${r}-${c}`}
                    x={x + 4 + c * 32 + (r % 2) * 16}
                    y={b.top + 3 + r * 7}
                    width="28"
                    height="5.5"
                    fill="#9a3d30"
                    stroke="#6e2a22"
                    strokeWidth="0.4"
                  />
                ))
              )}
            </g>
          )}
          {(kind === "rig" || kind === "mixto") && b.field === "D" && (
            <g>
              <line x1={x + w / 2} y1={b.top} x2={x + w / 2} y2={b.top + b.h} stroke="#8b1e1e" strokeWidth="1.2" strokeDasharray="4 3" />
              <line
                x1={x + 18}
                y1={b.top + b.h * 0.72}
                x2={x + w - 18}
                y2={b.top + b.h * 0.72}
                stroke="#4a4a4a"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <text x={x + w - 22} y={b.top + b.h * 0.72 - 7} textAnchor="end" fontSize="8" fill="#4a4a4a">
                pasador
              </text>
            </g>
          )}
          <text x={x + w / 2} y={b.top + (b.field === "D" && (kind === "rig" || kind === "mixto") ? b.h * 0.38 : b.h / 2) + 4} textAnchor="middle" fontSize="11" fill={b.fg} fontFamily="IBM Plex Sans, sans-serif">
            {b.label}
          </text>
          <Dim
            x1={x + w}
            y1={b.top}
            x2={x + w}
            y2={b.top + b.h}
            label={`${b.hcm.toFixed(1)}`}
            field={b.field}
            unit="cm"
            side={28}
            active={active}
            onFocus={onFocus}
          />
        </g>
      ))}
      <rect x={x} y={soilY} width={w} height={soilH} fill="url(#soil)" stroke="#1a4473" strokeWidth="0.8" />
      <text x={x + w / 2} y={soilY + 28} textAnchor="middle" fontSize="11" fill="#1a4473">
        Subrasante
      </text>
      <text x={x + w / 2} y={soilY + 46} textAnchor="middle" fontSize="10" fill="#6b6458">
        CBR = {CBR.toFixed(1)} %
      </text>
    </SvgFrame>
  );
}

function MV({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const L = n(values, "L", 8);
  return (
    <SvgFrame caption="Viga simplemente apoyada — carga y diagramas">
      <line x1="70" y1="80" x2="450" y2="80" stroke="#1a4473" strokeWidth="4" />
      <polygon points="70,80 85,100 55,100" fill="#1a4473" />
      <rect x="438" y="80" width="14" height="20" fill="#1a4473" />
      <Dim x1={70} y1={80} x2={450} y2={80} label={`L=${L.toFixed(2)}`} field="L" side={-28} active={active} onFocus={onFocus} />
      <path d="M70,160 Q260,250 450,160" fill="none" stroke="#8b1e1e" strokeWidth="2" />
      <text x="260" y="280" textAnchor="middle" fontSize="11" fill="#8b1e1e">Diagrama M</text>
    </SvgFrame>
  );
}

function Apoyo({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const W = n(values, "bViga", 30);
  return (
    <SvgFrame caption="Apoyo elastomérico laminado bajo el alma de viga">
      <rect x="160" y="50" width="200" height="70" fill="url(#conc)" stroke="#1a4473" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="190" y={130 + i * 16} width="140" height="12" fill={i % 2 ? "#2c2c2c" : "#4a4a4a"} />
      ))}
      <Dim x1={190} y1={210} x2={330} y2={210} label={`W=${W}`} field="bViga" side={22} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function Portico({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const Ln = n(values, "Ln", 5.6);
  const bCol = Math.max(0.15, n(values, "bCol", 0.3));
  const s = n(values, "s", 4);
  const Lajes = Ln + bCol;
  const innerPx = 268;
  const colPx = Math.max(18, Math.min(44, innerPx * (bCol / Math.max(Ln, 0.8))));
  const xL = 38;
  const innerL = xL + colPx;
  const innerR = innerL + innerPx;
  const xR = innerR + colPx;
  const axisL = xL + colPx / 2;
  const axisR = xR - colPx / 2;
  const y0 = 86;
  const slab = 14;
  const beam = 26;
  const yBeam = y0 + slab;
  const yColTop = y0;
  const colH = slab + beam + 100;
  const yBase = yColTop + colH;
  const font = "IBM Plex Sans, sans-serif";
  return (
    <SvgFrame compact viewBox="0 0 430 292" caption="Luz libre Ln entre caras internas de columna">
      <line x1={axisL} y1={y0 - 6} x2={axisL} y2={yBase + 4} stroke="#1a4473" strokeOpacity="0.28" strokeDasharray="3 3" />
      <line x1={axisR} y1={y0 - 6} x2={axisR} y2={yBase + 4} stroke="#1a4473" strokeOpacity="0.28" strokeDasharray="3 3" />
      <rect x={xL} y={yColTop} width={colPx} height={colH} fill="url(#conc)" stroke="#1a4473" />
      <rect x={innerR} y={yColTop} width={colPx} height={colH} fill="url(#conc)" stroke="#1a4473" />
      <rect x={xL} y={y0} width={xR - xL} height={slab} fill="url(#conc)" stroke="#1a4473" />
      <rect x={xL} y={yBeam} width={xR - xL} height={beam} fill="url(#conc)" stroke="#1a4473" />
      <line x1={innerL} y1={y0 - 4} x2={innerL} y2={yBeam + beam + 10} stroke="#8b1e1e" strokeOpacity="0.5" strokeDasharray="2 2" />
      <line x1={innerR} y1={y0 - 4} x2={innerR} y2={yBeam + beam + 10} stroke="#8b1e1e" strokeOpacity="0.5" strokeDasharray="2 2" />
      <Dim
        x1={innerL}
        y1={y0}
        x2={innerR}
        y2={y0}
        label={`${Ln.toFixed(2)}`}
        field="Ln"
        unit="m"
        em={13}
        side={-36}
        active={active}
        onFocus={onFocus}
      />
      <Dim
        x1={xL}
        y1={yBase}
        x2={innerL}
        y2={yBase}
        label={`${bCol.toFixed(2)}`}
        field="bCol"
        unit="m"
        em={10}
        side={22}
        active={active}
        onFocus={onFocus}
      />
      <text x={(innerL + innerR) / 2} y={yBeam + beam / 2 + 4} textAnchor="middle" fontSize="10" fill="#1a4473" fontFamily={font}>
        Ln cara a cara
      </text>
      <text x={(innerL + innerR) / 2} y={yBeam + beam + 22} textAnchor="middle" fontSize="10.5" fill="#6b6458" fontFamily={font}>
        {s > 0 ? `ancho tributario s = ${s.toFixed(2)} m` : ""}
      </text>
      <text x={(axisL + axisR) / 2} y={yBase + 40} textAnchor="middle" fontSize="9.5" fill="#6b6458" fontFamily={font}>
        {`L ejes = Ln + b = ${Lajes.toFixed(2)} m  ·  no es Ln`}
      </text>
    </SvgFrame>
  );
}

function LosaPaño({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const A = n(values, "A", n(values, "L", 4));
  const B = n(values, "B", 5);
  return (
    <SvgFrame caption="Paño de losa — lados A (corto) y B (largo)">
      <rect x="110" y="70" width="300" height="200" fill="url(#conc)" stroke="#1a4473" strokeWidth="2" />
      <path d="M110,70 L410,270 M410,70 L110,270" stroke="#1a4473" strokeOpacity="0.15" />
      <Dim x1={110} y1={270} x2={410} y2={270} label={`${B.toFixed(2)}`} field="B" unit="m" side={28} active={active} onFocus={onFocus} />
      <Dim x1={110} y1={70} x2={110} y2={270} label={`${A.toFixed(2)}`} field="A" unit="m" side={32} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function PMChart({
  heading,
  caption,
  curve,
  demands,
}: {
  heading: string;
  caption: string;
  curve: [number, number][];
  demands: { p: number; m: number; name?: string }[];
}) {
  const L = 56;
  const R = 318;
  const top = 36;
  const Btm = 228;
  const pts = [...demands].sort((a, b) => Math.abs(b.m) - Math.abs(a.m));
  const mRaw = Math.max(0.5, ...curve.map((p) => Math.abs(p[1])), ...pts.map((d) => Math.abs(d.m)));
  const pHi = Math.max(1, ...curve.map((p) => p[0]), ...pts.map((d) => d.p));
  const pLo = Math.min(-1, ...curve.map((p) => p[0]), ...pts.map((d) => d.p));
  const spanP = Math.max(pHi - pLo, 2);
  const pMax = pHi + 0.14 * spanP;
  const pMin = pLo - 0.10 * spanP;
  const mMax = mRaw * 1.14;
  const xOf = (m: number) => L + (Math.abs(m) / mMax) * (R - L);
  const yOf = (p: number) => Btm - ((p - pMin) / (pMax - pMin)) * (Btm - top);
  const poly = [`${L.toFixed(1)},${yOf(curve[0]?.[0] ?? pMax).toFixed(1)}`, ...curve.map(([p, m]) => `${xOf(m).toFixed(1)},${yOf(p).toFixed(1)}`), `${L.toFixed(1)},${yOf(curve[curve.length - 1]?.[0] ?? pMin).toFixed(1)}`].join(" ");
  const yTicks = [pLo, 0, pHi / 2, pHi];
  const xTicks = [0, mRaw / 2, mRaw];
  const font = "IBM Plex Sans, sans-serif";
  const legendH = Math.max(36, 12 + pts.length * 11);
  const vbH = Math.ceil(Btm + 28 + legendH);
  return (
    <SvgFrame compact viewBox={`0 0 360 ${vbH}`} heading={heading} caption={caption}>
      {yTicks.map((p) => (
        <g key={`y-${heading}-${p}`}>
          <line x1={L} y1={yOf(p)} x2={R} y2={yOf(p)} stroke="#1a4473" strokeOpacity="0.12" strokeWidth="0.8" />
          <text x={L - 6} y={yOf(p) + 3.5} textAnchor="end" fontSize="9" fill="#1a4473" fontFamily={font}>
            {p.toFixed(0)}
          </text>
        </g>
      ))}
      {xTicks.map((m) => (
        <g key={`x-${heading}-${m}`}>
          <line x1={xOf(m)} y1={top} x2={xOf(m)} y2={Btm} stroke="#1a4473" strokeOpacity="0.12" strokeWidth="0.8" />
          <text x={xOf(m)} y={Btm + 16} textAnchor="middle" fontSize="9" fill="#1a4473" fontFamily={font}>
            {m.toFixed(1)}
          </text>
        </g>
      ))}
      <line x1={L} y1={yOf(0)} x2={R} y2={yOf(0)} stroke="#1a4473" strokeWidth="1" />
      <line x1={L} y1={top} x2={L} y2={Btm} stroke="#1a4473" strokeWidth="1.15" />
      <polyline points={poly} fill="#8b1e1e" fillOpacity="0.08" stroke="#8b1e1e" strokeWidth="1.8" />
      {pts.map((d, i) => (
        <g key={`pt-${i}`}>
          <circle
            cx={xOf(d.m)}
            cy={yOf(d.p)}
            r={i === 0 ? 4.4 : 3.3}
            fill={i === 0 ? "#c4a35a" : "#fbf8f1"}
            stroke="#1a4473"
            strokeWidth="1.35"
          />
          <text x={xOf(d.m) + 7} y={yOf(d.p) + 3} fontSize="8" fill="#1a4473" fontFamily={font}>
            {i + 1}
          </text>
        </g>
      ))}
      <text x={L - 4} y={18} textAnchor="end" fontSize="9" fill="#6b6458" fontFamily={font}>
        φPn (t)
      </text>
      <text x={R} y={Btm + 28} textAnchor="end" fontSize="9" fill="#6b6458" fontFamily={font}>
        φMn (t·m)
      </text>
      {pts.map((d, i) => (
        <text key={`lg-${i}`} x={L} y={Btm + 42 + i * 11} fontSize="8.5" fill="#1a4473" fontFamily={font}>
          {i + 1}. {d.name || `Combo ${i + 1}`}  ·  P={d.p.toFixed(1)} t  ·  M={d.m.toFixed(2)} t·m{i === 0 ? "  ·  gobierna" : ""}
        </text>
      ))}
    </SvgFrame>
  );
}

export function ColumnaPM({ dims }: { dims: Record<string, string> }) {
  const m3 = decodePts(dims.pm3);
  const m2 = decodePts(dims.pm2);
  const m3neg = decodePts(dims.pm3neg);
  const m2neg = decodePts(dims.pm2neg);
  const curve3n = m3neg.length >= 2 ? m3neg : m3;
  const curve2n = m2neg.length >= 2 ? m2neg : m2;
  const dem3 = decodeDemands(dims.dem3);
  const dem2 = decodeDemands(dims.dem2);
  const dem3p = decodeDemands(dims.dem3p).length ? decodeDemands(dims.dem3p) : dem3.filter((d) => d.m >= -1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m) }));
  const dem3n = decodeDemands(dims.dem3n).length ? decodeDemands(dims.dem3n) : dem3.filter((d) => d.m <= 1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m) }));
  const dem2p = decodeDemands(dims.dem2p).length ? decodeDemands(dims.dem2p) : dem2.filter((d) => d.m >= -1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m) }));
  const dem2n = decodeDemands(dims.dem2n).length ? decodeDemands(dims.dem2n) : dem2.filter((d) => d.m <= 1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m) }));
  const placa = dims.pmKind === "placa";
  const forma = String(dims.forma ?? "");
  const capM2p =
    forma === "C"
      ? "Compresión hacia las puntas de las alas (sentido +3). En un canal G está hacia el alma: esta rama no coincide con la del alma."
      : "Diagrama de interacción φPn–φMn · momento positivo (P a compresión positivo).";
  const capM2n =
    forma === "C"
      ? "Compresión hacia el alma (sentido −3). Más concreto en el bloque; φMn distinto del de las puntas. Es correcto, no un error."
      : "Diagrama de interacción φPn–φMn · momento negativo (P a compresión positivo).";
  if (m3.length < 2 && m2.length < 2) return null;
  return (
    <div className="pm-quad">
      {m3.length >= 2 ? (
        <PMChart
          heading={placa ? "M3 · plano del muro · SDX +" : forma === "C" ? "M3 · 0°  ·  alas simétricas +" : "M3 · 0°  ·  sismo XX +"}
          caption="Diagrama φPn–φMn (M+). Todos los puntos de las combinaciones E.060. El dorado gobierna por |M|."
          curve={m3}
          demands={dem3p}
        />
      ) : null}
      {curve3n.length >= 2 ? (
        <PMChart
          heading={placa ? "M3 · plano del muro · SDX −" : forma === "C" ? "M3 · 180°  ·  alas simétricas −" : "M3 · 180°  ·  sismo XX −"}
          caption={forma === "C" ? "Misma envolvente que M3+: la C es simétrica arriba/abajo respecto de G." : "Diagrama de interacción φPn–φMn · momento negativo (P a compresión positivo)."}
          curve={curve3n}
          demands={dem3n}
        />
      ) : null}
      {m2.length >= 2 ? (
        <PMChart
          heading={placa ? "M2 · fuera de plano · SDY +" : forma === "C" ? "M2 · 90°  ·  hacia las alas" : "M2 · 90°  ·  sismo YY +"}
          caption={capM2p}
          curve={m2}
          demands={dem2p}
        />
      ) : null}
      {curve2n.length >= 2 ? (
        <PMChart
          heading={placa ? "M2 · fuera de plano · SDY −" : forma === "C" ? "M2 · 270°  ·  hacia el alma" : "M2 · 270°  ·  sismo YY −"}
          caption={capM2n}
          curve={curve2n}
          demands={dem2n}
        />
      ) : null}
    </div>
  );
}

function PlacaAcero({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const tipo = String(values.tipo ?? "cuadrada");
  return (
    <SvgFrame caption={tipo === "circular" ? "Placa de apoyo circular sobre concreto" : "Placa de apoyo cuadrada sobre concreto"}>
      <rect x="90" y="210" width="340" height="70" fill="url(#conc)" stroke="#1a4473" />
      {tipo === "circular" ? (
        <ellipse cx="260" cy="170" rx="70" ry="28" fill="#c9d4e0" stroke="#1a4473" strokeWidth="2" />
      ) : (
        <rect x="185" y="142" width="150" height="56" fill="#c9d4e0" stroke="#1a4473" strokeWidth="2" />
      )}
      <rect x="220" y="70" width="80" height="72" fill="url(#conc)" stroke="#1a4473" />
      <text x="260" y="108" textAnchor="middle" fontSize="11" fill="#1a4473">
        viga
      </text>
      <Dim x1={185} y1={198} x2={335} y2={198} label="lado" field="Pu" side={18} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function CajonPuente({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const B = n(values, "B", 9.2);
  const h = n(values, "h", 1.35);
  return (
    <SvgFrame caption="Viga cajón — sección transversal (aletas + almas + losa inferior)">
      <path
        d="M70,90 L450,90 L430,118 L390,118 L390,220 L130,220 L130,118 L90,118 Z"
        fill="url(#conc)"
        stroke="#1a4473"
        strokeWidth="1.6"
      />
      <rect x="148" y="118" width="224" height="84" fill="#fbf8f1" stroke="#1a4473" />
      <Dim x1={70} y1={90} x2={450} y2={90} label={`${B.toFixed(2)}`} field="B" unit="m" side={-22} active={active} onFocus={onFocus} />
      <Dim x1={130} y1={90} x2={130} y2={220} label={`${h.toFixed(2)}`} field="h" unit="m" side={36} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function Colgante({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const L = n(values, "L", 50);
  const f = n(values, "f", 5);
  return (
    <SvgFrame caption="Pasarela colgante — catenaria, torres y tablero">
      <rect x="70" y="70" width="18" height="190" fill="url(#conc)" stroke="#1a4473" />
      <rect x="432" y="70" width="18" height="190" fill="url(#conc)" stroke="#1a4473" />
      <path d="M88,80 Q260,210 432,80" fill="none" stroke="#8b1e1e" strokeWidth="2.2" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
        const t = i / 8;
        const x = 88 + t * 344;
        const y = 80 + 4 * t * (1 - t) * 130;
        return <line key={i} x1={x} y1={y} x2={x} y2={230} stroke="#1a4473" strokeWidth="0.8" />;
      })}
      <rect x="88" y="228" width="344" height="12" fill="#8a7344" stroke="#1a4473" />
      <Dim x1={88} y1={240} x2={432} y2={240} label={`${L.toFixed(1)}`} field="L" unit="m" side={28} active={active} onFocus={onFocus} />
      <Dim x1={260} y1={80} x2={260} y2={210} label={`${f.toFixed(2)}`} field="f" unit="m" side={-22} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function LineaInf({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const L = n(values, "L", 30);
  const x = n(values, "x", 15);
  const t = Math.min(0.92, Math.max(0.08, x / Math.max(L, 0.1)));
  const px = 70 + t * 380;
  const peakH = (t * (1 - t)) * 4 * 90;
  return (
    <SvgFrame caption="Línea de influencia de momento en la sección x — tren HS-20">
      <line x1="70" y1="70" x2="450" y2="70" stroke="#1a4473" strokeWidth="3" />
      <polygon points="70,70 82,88 58,88" fill="#1a4473" />
      <rect x="438" y="70" width="14" height="18" fill="#1a4473" />
      <line x1={px} y1={70} x2={px} y2={70 + peakH} stroke="#8b1e1e" strokeDasharray="4 3" />
      <path d={`M70,70 L${px},${70 + peakH} L450,70`} fill="#8b1e1e18" stroke="#8b1e1e" strokeWidth="2" />
      <Dim x1={70} y1={70} x2={450} y2={70} label={`${L.toFixed(1)}`} field="L" unit="m" side={-24} active={active} onFocus={onFocus} />
      <Dim x1={70} y1={70 + peakH + 10} x2={px} y2={70 + peakH + 10} label={`${x.toFixed(1)}`} field="x" unit="m" side={22} active={active} onFocus={onFocus} />
      <text x="260" y="310" textAnchor="middle" fontSize="11" fill="#8b1e1e">
        η_M(x, ξ)
      </text>
    </SvgFrame>
  );
}

function Diafragma({ values, active, onFocus }: { values: Record<string, string>; active: string | null; onFocus: (k: string) => void }) {
  const a = n(values, "aVol", 0.95);
  const hd = n(values, "hd", 0.95);
  return (
    <SvgFrame caption="Volado de tablero y diafragma extremo">
      <rect x="80" y="90" width="280" height="28" fill="url(#conc)" stroke="#1a4473" />
      <rect x="360" y="90" width="90" height="28" fill="url(#conc)" stroke="#1a4473" />
      <rect x="330" y="118" width="28" height="110" fill="url(#conc)" stroke="#1a4473" />
      <polygon points="358,118 450,118 450,148 358,148" fill="url(#hatch)" stroke="#1a4473" />
      <Dim x1={360} y1={90} x2={450} y2={90} label={`${a.toFixed(2)}`} field="aVol" unit="m" side={-20} active={active} onFocus={onFocus} />
      <Dim x1={330} y1={118} x2={330} y2={228} label={`${hd.toFixed(2)}`} field="hd" unit="m" side={32} active={active} onFocus={onFocus} />
    </SvgFrame>
  );
}

function Dotacion({
  values,
  part,
  active,
  onFocus,
}: {
  values: Record<string, string>;
  part?: string;
  active: string | null;
  onFocus: (k: string) => void;
}) {
  const p = part || "esquema";
  if (p === "lote") return <DotacionLote values={values} active={active} onFocus={onFocus} />;
  if (p === "ocupacion") return <DotacionOcupacion values={values} />;
  if (p === "almacenamiento") return <DotacionAlmacen values={values} active={active} onFocus={onFocus} />;
  if (p === "hunter") return <DotacionHunter values={values} />;
  return <DotacionEsquema values={values} active={active} onFocus={onFocus} />;
}

function DotacionLote({
  values,
  active,
  onFocus,
}: {
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
}) {
  const A = Math.max(20, n(values, "A_lote", 160));
  const Al = Math.min(A * 0.85, Math.max(0, n(values, "A_libre", 42)));
  const Ab = Math.max(1, A - Al);
  const Cpd = n(values, "Cpd", 1700);
  const Clote = n(values, "C_lote", 1500);
  const ratio = Math.min(0.72, Math.max(0.18, Al / A));
  const W = 360;
  const H = 200;
  const x0 = 70;
  const y0 = 48;
  const wLibre = W * ratio;
  return (
    <SvgFrame heading="Lote" caption={`Área del lote ${A.toFixed(1)} m². La tabla IS.010 2.2.a da ${Clote.toFixed(0)} L/d (doméstico + jardín). Cpd adoptada ${Cpd.toFixed(0)} L/d.`}>
      <rect x={x0} y={y0} width={W} height={H} fill="#e8f1ea" stroke="#1a4473" strokeWidth="2" />
      <rect x={x0 + wLibre} y={y0} width={W - wLibre} height={H} fill="#d9c4a8" stroke="#1a4473" strokeWidth="1.5" />
      <rect x={x0 + wLibre + 18} y={y0 + 28} width={W - wLibre - 36} height={H - 70} fill="#c9b496" stroke="#1a4473" />
      <rect x={x0 + wLibre + 36} y={y0 + 48} width={28} height={36} fill="#9ec5e8" stroke="#1a4473" />
      <rect x={x0 + wLibre + 72} y={y0 + 48} width={22} height={28} fill="#9ec5e8" stroke="#1a4473" />
      <polygon
        points={`${x0 + wLibre + 14},${y0 + 28} ${x0 + wLibre + (W - wLibre - 36) / 2 + 18},${y0 + 8} ${x0 + W - 18},${y0 + 28}`}
        fill="#8b1e1e"
        opacity="0.85"
      />
      <text x={x0 + wLibre / 2} y={y0 + H / 2} textAnchor="middle" fontSize="12" fill="#1a4473">
        Área libre
      </text>
      <text x={x0 + wLibre / 2} y={y0 + H / 2 + 18} textAnchor="middle" fontSize="11" fill="#2d6a4f">
        {Al.toFixed(1)} m²
      </text>
      <text x={x0 + wLibre + (W - wLibre) / 2} y={y0 + H - 18} textAnchor="middle" fontSize="11" fill="#1a4473">
        Área techada {Ab.toFixed(1)} m²
      </text>
      <rect x={x0 - 14} y={y0 + H + 8} width={18} height="10" fill="#d9c4a8" stroke="#1a4473" />
      <text x={x0 + 10} y={y0 + H + 17} fontSize="9" fill="#1a4473">
        edificación
      </text>
      <rect x={x0 + 100} y={y0 + H + 8} width={18} height="10" fill="#e8f1ea" stroke="#1a4473" />
      <text x={x0 + 124} y={y0 + H + 17} fontSize="9" fill="#1a4473">
        jardín (ya incluido en la tabla de lote)
      </text>
      <Dim x1={x0} y1={y0} x2={x0 + W} y2={y0} label={`${A.toFixed(1)}`} field="A_lote" unit="m²" side={-16} active={active} onFocus={onFocus} />
      {wLibre > 40 && (
        <Dim
          x1={x0}
          y1={y0 + H}
          x2={x0 + wLibre}
          y2={y0 + H}
          label={`${Al.toFixed(1)}`}
          field="A_libre"
          unit="m²"
          side={20}
          active={active}
          onFocus={onFocus}
        />
      )}
    </SvgFrame>
  );
}

function DotacionOcupacion({ values }: { values: Record<string, string> }) {
  const Cpd = n(values, "Cpd", 1700);
  type Bar = { k: string; n: number; c: number; fill: string };
  let parsed: Bar[] | null = null;
  if (values.ocupBars) {
    try {
      const raw = JSON.parse(values.ocupBars) as Bar[];
      if (Array.isArray(raw) && raw.length) parsed = raw;
    } catch {
      parsed = null;
    }
  }
  if (parsed) {
    const rows = parsed.filter((r) => r.c > 0 || r.n > 0);
    const maxC = Math.max(Cpd, ...rows.map((r) => r.c), 1);
    const L = 70;
    const R = 470;
    const top = 36;
    const rowH = Math.min(36, 240 / Math.max(rows.length, 1));
    const vbH = Math.max(320, top + rows.length * rowH + 56);
    return (
      <SvgFrame heading={values.ocupHeading || "Dotación por uso"} viewBox={`0 0 520 ${vbH}`} caption={values.ocupCaption || `Cpd = ${Cpd.toFixed(0)} L/d.`}>
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const w = ((R - L - 8) * r.c) / maxC;
          return (
            <g key={`${r.k}-${i}`}>
              <text x={L - 6} y={y + 16} textAnchor="end" fontSize="10" fill="#1a4473">
                {r.k}
              </text>
              <rect x={L} y={y + 4} width={Math.max(4, w)} height={20} fill={r.fill || "#4a90c8"} opacity="0.88" />
              <text x={L + Math.max(8, w) + 6} y={y + 18} fontSize="10" fill="#1a4473">
                {r.n > 0 ? `${r.n} × ` : ""}
                {r.c.toFixed(0)} L/d
              </text>
            </g>
          );
        })}
        <line x1={L} y1={top + rows.length * rowH + 8} x2={R} y2={top + rows.length * rowH + 8} stroke="#1a4473" />
        <text x={260} y={top + rows.length * rowH + 28} textAnchor="middle" fontSize="12" fill="#8b1e1e">
          Total Cpd = {Cpd.toFixed(0)} L/d
        </text>
      </SvgFrame>
    );
  }
  const modo = String(values.modo ?? "uni");
  if (modo === "multi") {
    const n1 = n(values, "n1", 2);
    const n2 = n(values, "n2", 6);
    const n3 = n(values, "n3", 4);
    const n4 = n(values, "n4", 0);
    const n5 = n(values, "n5", 0);
    const nG = n(values, "nGuard", 0);
    const Cj = n(values, "C_jard", 160);
    const Cc = n(values, "C_com", 0);
    const rows = [
      { k: "1 dorm", n: n1, c: n1 * 500, fill: "#4a90c8" },
      { k: "2 dorm", n: n2, c: n2 * 850, fill: "#2d6a4f" },
      { k: "3 dorm", n: n3, c: n3 * 1200, fill: "#c47b2b" },
      { k: "4 dorm", n: n4, c: n4 * 1350, fill: "#8b1e1e" },
      { k: "5 dorm", n: n5, c: n5 * 1500, fill: "#5c4d7a" },
      { k: "portería", n: nG, c: nG * 500, fill: "#6b6458" },
      { k: "jardín", n: 0, c: Cj, fill: "#6b9e6e" },
      { k: "común", n: 0, c: Cc, fill: "#8a7a5a" },
    ].filter((r) => r.c > 0 || r.n > 0);
    const maxC = Math.max(Cpd, ...rows.map((r) => r.c), 1);
    const L = 70;
    const R = 470;
    const top = 36;
    const rowH = Math.min(36, 240 / Math.max(rows.length, 1));
    const vbH = Math.max(320, top + rows.length * rowH + 56);
    return (
      <SvgFrame heading="Dotación por departamento" viewBox={`0 0 520 ${vbH}`} caption={`IS.010 2.2.b: 500 / 850 / 1 200 / 1 350 / 1 500 L/d según dormitorios. Cpd = ${Cpd.toFixed(0)} L/d.`}>
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const w = ((R - L - 8) * r.c) / maxC;
          return (
            <g key={r.k}>
              <text x={L - 6} y={y + 16} textAnchor="end" fontSize="10" fill="#1a4473">
                {r.k}
              </text>
              <rect x={L} y={y + 4} width={Math.max(4, w)} height={20} fill={r.fill} opacity="0.88" />
              <text x={L + Math.max(8, w) + 6} y={y + 18} fontSize="10" fill="#1a4473">
                {r.n > 0 ? `${r.n} × ` : ""}
                {r.c.toFixed(0)} L/d
              </text>
            </g>
          );
        })}
        <line x1={L} y1={top + rows.length * rowH + 8} x2={R} y2={top + rows.length * rowH + 8} stroke="#1a4473" />
        <text x={260} y={top + rows.length * rowH + 28} textAnchor="middle" fontSize="12" fill="#8b1e1e">
          Total Cpd = {Cpd.toFixed(0)} L/d
        </text>
      </SvgFrame>
    );
  }
  const Clote = n(values, "C_lote", 1500);
  const Chab = n(values, "C_hab", 1500);
  const Nhab = n(values, "Nhab", 5);
  const nDorm = n(values, "nDorm", 3);
  const maxC = Math.max(Clote, Chab, Cpd, 1);
  const bar = (y: number, val: number, fill: string, label: string) => {
    const w = (360 * val) / maxC;
    return (
      <g>
        <rect x="120" y={y} width={Math.max(8, w)} height="32" fill={fill} opacity="0.9" />
        <text x="112" y={y + 21} textAnchor="end" fontSize="11" fill="#1a4473">
          {label}
        </text>
        <text x={128 + Math.max(8, w)} y={y + 21} fontSize="11" fill="#1a4473">
          {val.toFixed(0)} L/d
        </text>
      </g>
    );
  };
  return (
    <SvgFrame heading="Criterios de dotación" caption={`Unifamiliar: se adopta el mayor entre tabla de lote y 150 L/hab·d. ${nDorm.toFixed(0)} dormitorios · ${Nhab.toFixed(0)} habitantes.`}>
      {bar(70, Clote, "#4a90c8", "Tabla lote")}
      {bar(118, Chab, "#c47b2b", "N × 150")}
      {bar(166, Cpd, "#2d6a4f", "Cpd")}
      <text x="260" y="230" textAnchor="middle" fontSize="11" fill="#6b6458">
        C_hab = máx(N × 150 ; 1 500)    ·    Cpd = máx(C_lote ; C_hab)
      </text>
      <text x="260" y="258" textAnchor="middle" fontSize="12" fill="#8b1e1e">
        Se grafica en verde el valor que manda
      </text>
    </SvgFrame>
  );
}

function DotacionEsquema({
  values,
  active,
  onFocus,
}: {
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
}) {
  const sistema = String(values.sistema ?? "combinado");
  const niveles = Math.max(1, Math.min(10, Math.round(n(values, "niveles", 4))));
  const Vc = n(values, "VcAdop", 3000);
  const Vte = n(values, "VteAdop", 2500);
  const Cpd = n(values, "Cpd", 5000);
  const He = n(values, "He", 8);
  const hCis = n(values, "hCis", 1.2);
  const Lc = n(values, "Lc", 1.5);
  const Bc = n(values, "Bc", 1.5);
  const Php = n(values, "Php", 0.5);
  const hasCis = sistema !== "elevado";
  const hasTe = sistema !== "cisterna" && sistema !== "hidro";
  const hasPump = sistema !== "elevado";
  const hasHidro = sistema === "hidro";

  const floorH = Math.min(24, Math.max(16, Math.floor(168 / niveles)));
  const roofY = 56;
  const baseY = roofY + niveles * floorH;
  const groundY = baseY + 8;
  const bx = 318;
  const bw = 152;
  const riserX = bx - 14;

  // Cisterna enterrada (corte)
  const cisW = 108;
  const cisH = Math.max(42, Math.min(72, 28 + hCis * 14));
  const cisX = 42;
  const cisY = groundY + 10;
  const waterH = Math.max(14, cisH * 0.72);
  const pumpX = cisX + cisW + 36;
  const pumpY = groundY - 10;
  const meterX = 118;
  const meterY = groundY + 4;
  const teW = 76;
  const teH = 26;
  const teX = bx + (bw - teW) / 2;
  const teY = roofY - teH - 6;
  const vbH = Math.max(360, groundY + (hasCis ? cisH : 36) + 78);

  const caption =
    sistema === "combinado"
      ? `Red → medidor → cisterna ${Vc.toFixed(0)} L → bomba ${Php.toFixed(2)} Hp → TE ${Vte.toFixed(0)} L → bajante por gravedad. Cpd = ${Cpd.toFixed(0)} L/d.`
      : sistema === "hidro"
        ? `Red → medidor → cisterna ${Vc.toFixed(0)} L → equipo hidroneumático. Volumen ≥ Cpd = ${Cpd.toFixed(0)} L/d.`
        : sistema === "elevado"
          ? `Red → medidor → tanque elevado ${Vte.toFixed(0)} L (≥ Cpd). Distribución por gravedad.`
          : `Red → medidor → cisterna ${Vc.toFixed(0)} L (≥ Cpd) con impulsión a la red interna.`;

  return (
    <SvgFrame heading="Esquema hidráulico IS.010" viewBox={`0 0 520 ${vbH}`} caption={caption}>
      {/* Terreno */}
      <line x1="18" y1={groundY} x2="502" y2={groundY} stroke="#6b6458" strokeWidth="1.4" strokeDasharray="5 3" />
      <text x="20" y={groundY - 6} fontSize="8" fill="#6b6458">
        NPT
      </text>

      {/* Red pública + medidor + acometida */}
      <line x1="18" y1={meterY + 28} x2={hasCis ? cisX : meterX + 40} y2={meterY + 28} stroke="#1d5aa6" strokeWidth="5" />
      <text x="20" y={meterY + 18} fontSize="9" fill="#1d5aa6" fontWeight="600">
        Red
      </text>
      <rect x={meterX} y={meterY + 16} width="30" height="24" rx="3" fill="#f4e4c1" stroke="#1a4473" strokeWidth="1.4" />
      <circle cx={meterX + 15} cy={meterY + 28} r="7" fill="#fff" stroke="#1a4473" strokeWidth="1.3" />
      <text x={meterX + 15} y={meterY + 31} textAnchor="middle" fontSize="7" fill="#1a4473">
        M
      </text>
      <text x={meterX + 15} y={meterY + 52} textAnchor="middle" fontSize="8" fill="#1a4473">
        medidor
      </text>
      {hasCis && (
        <path
          d={`M ${meterX + 30} ${meterY + 28} H ${cisX + cisW / 2} V ${cisY}`}
          fill="none"
          stroke="#1d5aa6"
          strokeWidth="2.6"
        />
      )}
      {!hasCis && hasTe && (
        <path
          d={`M ${meterX + 30} ${meterY + 28} H ${riserX} V ${teY + teH / 2} H ${teX}`}
          fill="none"
          stroke="#1d5aa6"
          strokeWidth="2.6"
        />
      )}

      {/* Cisterna enterrada */}
      {hasCis && (
        <g>
          <rect x={cisX - 6} y={cisY - 4} width={cisW + 12} height={cisH + 10} fill="none" stroke="#8b1e1e" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" />
          <rect x={cisX} y={cisY} width={cisW} height={cisH} fill="#eef3f8" stroke="#1a4473" strokeWidth="2.2" />
          <rect x={cisX} y={cisY + cisH - waterH} width={cisW} height={waterH} fill="#6eb5d8" opacity="0.9" />
          <rect x={cisX} y={cisY + cisH - waterH} width={cisW} height="5" fill="#d7eaf4" />
          <text x={cisX + cisW / 2} y={cisY - 10} textAnchor="middle" fontSize="10" fill="#1a4473" fontWeight="600">
            Cisterna {Vc.toFixed(0)} L
          </text>
          <text x={cisX + cisW / 2} y={cisY + cisH - waterH / 2 + 4} textAnchor="middle" fontSize="9" fill="#1a4473">
            {Lc.toFixed(2)} × {Bc.toFixed(2)} m
          </text>
          <Dim
            x1={cisX}
            y1={cisY + cisH + 6}
            x2={cisX + cisW}
            y2={cisY + cisH + 6}
            label={Bc.toFixed(2)}
            field="Bc"
            unit="m"
            side={14}
            active={active}
            onFocus={onFocus}
          />
          <Dim
            x1={cisX + cisW + 4}
            y1={cisY + cisH - waterH}
            x2={cisX + cisW + 4}
            y2={cisY + cisH}
            label={hCis.toFixed(2)}
            field="hCis"
            unit="m"
            side={18}
            active={active}
            onFocus={onFocus}
          />
          <text x={cisX + cisW / 2} y={cisY + cisH + 36} textAnchor="middle" fontSize="8" fill="#6b6458">
            h agua {hCis.toFixed(2)} m · Lc {Lc.toFixed(2)} m
          </text>
        </g>
      )}

      {/* Bomba / hidroneumático */}
      {hasPump && (
        <g>
          {/* Succión cisterna → bomba */}
          {hasCis && (
            <path
              d={`M ${cisX + cisW} ${cisY + cisH * 0.55} H ${pumpX - 14} V ${pumpY}`}
              fill="none"
              stroke="#1d5aa6"
              strokeWidth="2.4"
            />
          )}
          <circle cx={pumpX} cy={pumpY} r="14" fill="#8b1e1e" stroke="#1a4473" strokeWidth="1.4" />
          <text x={pumpX} y={pumpY + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">
            {hasHidro ? "H" : "B"}
          </text>
          <text x={pumpX} y={pumpY + 28} textAnchor="middle" fontSize="9" fill="#8b1e1e">
            {hasHidro ? "Hidroneumático" : `${Php.toFixed(2)} HP`}
          </text>

          {/* Impulsión ortogonal: sube → válvula → horizontal → sube al TE o al edificio */}
          {hasTe ? (
            <>
              <path
                d={`M ${pumpX} ${pumpY - 14} V ${groundY - 36} H ${riserX} V ${teY + teH / 2} H ${teX}`}
                fill="none"
                stroke="#1d5aa6"
                strokeWidth="3"
              />
              {/* Válvula de retención en tramo horizontal */}
              <circle cx={(pumpX + riserX) / 2} cy={groundY - 36} r="8" fill="#fff" stroke="#8b1e1e" strokeWidth="1.6" />
              <text x={(pumpX + riserX) / 2} y={groundY - 33} textAnchor="middle" fontSize="7" fill="#8b1e1e">
                VR
              </text>
              <text x={(pumpX + riserX) / 2} y={groundY - 48} textAnchor="middle" fontSize="7" fill="#6b6458">
                impulsión
              </text>
            </>
          ) : (
            <>
              <path
                d={`M ${pumpX} ${pumpY - 14} V ${groundY - 28} H ${riserX} V ${baseY - 4}`}
                fill="none"
                stroke="#1d5aa6"
                strokeWidth="3"
              />
              <circle cx={(pumpX + riserX) / 2} cy={groundY - 28} r="8" fill="#fff" stroke="#8b1e1e" strokeWidth="1.6" />
              <text x={(pumpX + riserX) / 2} y={groundY - 25} textAnchor="middle" fontSize="7" fill="#8b1e1e">
                VR
              </text>
            </>
          )}
        </g>
      )}

      {/* Edificio */}
      <rect x={bx} y={roofY} width={bw} height={niveles * floorH} fill="#e7d7bf" stroke="#1a4473" strokeWidth="2" />
      {Array.from({ length: niveles }, (_, i) => (
        <g key={i}>
          <line x1={bx} y1={roofY + (i + 1) * floorH} x2={bx + bw} y2={roofY + (i + 1) * floorH} stroke="#1a4473" />
          <rect x={bx + 16} y={roofY + i * floorH + 5} width="13" height="9" fill="#9ec5e8" stroke="#1a4473" />
          <rect x={bx + bw - 30} y={roofY + i * floorH + 5} width="13" height="9" fill="#9ec5e8" stroke="#1a4473" />
          <text x={bx + bw / 2} y={roofY + i * floorH + 14} textAnchor="middle" fontSize="8" fill="#1a4473">
            N{niveles - i}
          </text>
        </g>
      ))}
      <rect x={bx} y={baseY} width={bw} height="12" fill="url(#conc)" stroke="#1a4473" />

      {/* Tanque elevado */}
      {hasTe && (
        <g>
          <rect x={teX} y={teY} width={teW} height={teH} fill="#6eb5d8" stroke="#1a4473" strokeWidth="2" />
          <rect x={teX} y={teY} width={teW} height="7" fill="#d7eaf4" stroke="#1a4473" />
          <text x={teX + teW / 2} y={teY - 6} textAnchor="middle" fontSize="10" fill="#1a4473" fontWeight="600">
            TE {Vte.toFixed(0)} L
          </text>
        </g>
      )}

      {/* Bajante / distribución por gravedad */}
      {(hasTe || !hasPump) && (
        <line
          x1={riserX}
          y1={hasTe ? teY + teH / 2 : roofY + 8}
          x2={riserX}
          y2={baseY}
          stroke="#1d5aa6"
          strokeWidth="2.8"
        />
      )}
      {hasTe &&
        Array.from({ length: Math.min(niveles, 6) }, (_, i) => {
          const y = roofY + (i + 0.55) * floorH;
          return <line key={`br-${i}`} x1={riserX} y1={y} x2={bx + 8} y2={y} stroke="#1d5aa6" strokeWidth="1.6" />;
        })}

      {hasTe && (
        <Dim
          x1={bx + bw + 8}
          y1={roofY}
          x2={bx + bw + 8}
          y2={baseY}
          label={He.toFixed(2)}
          field="He"
          unit="m"
          side={22}
          active={active}
          onFocus={onFocus}
        />
      )}

      {/* Leyenda corta */}
      <g transform={`translate(18, ${vbH - 28})`}>
        <circle cx="6" cy="0" r="5" fill="#fff" stroke="#1a4473" />
        <text x="16" y="3" fontSize="8" fill="#1a4473">
          M medidor
        </text>
        <circle cx="90" cy="0" r="5" fill="#fff" stroke="#8b1e1e" />
        <text x="100" y="3" fontSize="8" fill="#1a4473">
          VR válvula retención
        </text>
        <circle cx="220" cy="0" r="5" fill="#8b1e1e" />
        <text x="230" y="3" fontSize="8" fill="#1a4473">
          B bomba
        </text>
      </g>
    </SvgFrame>
  );
}

function DotacionAlmacen({
  values,
  active,
  onFocus,
}: {
  values: Record<string, string>;
  active: string | null;
  onFocus: (k: string) => void;
}) {
  const VcReq = n(values, "VcReq", 0);
  const VcAdop = n(values, "VcAdop", 0);
  const VteReq = n(values, "VteReq", 0);
  const VteAdop = n(values, "VteAdop", 0);
  const Cpd = n(values, "Cpd", 1);
  const Lc = n(values, "Lc", 1.5);
  const Bc = n(values, "Bc", 1.5);
  const hCis = n(values, "hCis", 1.2);
  const maxV = Math.max(Cpd, VcAdop, VteAdop, 1000);
  const tank = (x: number, req: number, adop: number, title: string, frac: string) => {
    const H = 160;
    const hAd = (adop / maxV) * H;
    const hReq = (req / maxV) * H;
    const y0 = 220;
    return (
      <g>
        <rect x={x} y={y0 - H} width="110" height={H} fill="#eef3f8" stroke="#1a4473" />
        <rect x={x} y={y0 - hAd} width="110" height={hAd} fill="#6eb5d8" opacity="0.85" />
        {req > 0 && (
          <line x1={x} y1={y0 - hReq} x2={x + 110} y2={y0 - hReq} stroke="#8b1e1e" strokeDasharray="5 3" strokeWidth="1.6" />
        )}
        <text x={x + 55} y={y0 - H - 18} textAnchor="middle" fontSize="12" fill="#1a4473">
          {title}
        </text>
        <text x={x + 55} y={y0 - H - 4} textAnchor="middle" fontSize="10" fill="#6b6458">
          {frac}
        </text>
        <text x={x + 55} y={y0 + 16} textAnchor="middle" fontSize="11" fill="#1a4473">
          {adop.toFixed(0)} L
        </text>
        <text x={x + 55} y={y0 + 30} textAnchor="middle" fontSize="9" fill="#8b1e1e">
          req. {req.toFixed(0)} L
        </text>
      </g>
    );
  };
  return (
    <SvgFrame heading="Almacenamiento IS.010 2.4" caption="Línea roja = mínimo de norma (¾ o ⅓ de Cpd, no menor de 1 000 L). El sólido azul es el volumen adoptado (reserva + comercial).">
      {VcAdop > 0 && tank(70, Math.max(VcReq, 1000), VcAdop, "Cisterna", "¾ Cpd")}
      {VteAdop > 0 && tank(250, Math.max(VteReq, 1000), VteAdop, "Tanque elevado", "⅓ Cpd")}
      <rect x="400" y="70" width="90" height="130" fill="#d9e8f4" stroke="#1a4473" />
      <text x="445" y="62" textAnchor="middle" fontSize="10" fill="#1a4473">
        Cisterna
      </text>
      {VcAdop > 0 && (
        <>
          <Dim x1={400} y1={70} x2={490} y2={70} label={`${Lc.toFixed(2)}`} field="Lc" unit="m" side={-14} active={active} onFocus={onFocus} />
          <Dim x1={490} y1={70} x2={490} y2={200} label={`${hCis.toFixed(2)}`} field="hCis" unit="m" side={16} active={active} onFocus={onFocus} />
          <Dim x1={400} y1={200} x2={490} y2={200} label={`${Bc.toFixed(2)}`} field="Bc" unit="m" side={14} active={active} onFocus={onFocus} />
          <text x="445" y="236" textAnchor="middle" fontSize="9" fill="#1a4473">
            {Lc.toFixed(2)} × {Bc.toFixed(2)} × {hCis.toFixed(2)} m
          </text>
        </>
      )}
      <text x="260" y="318" textAnchor="middle" fontSize="10" fill="#6b6458">
        Cpd = {Cpd.toFixed(0)} L/d    ·    mínimo absoluto 1 000 L por depósito
      </text>
    </SvgFrame>
  );
}

function DotacionHunter({ values }: { values: Record<string, string> }) {
  const UH = n(values, "UH", 24);
  const Qmds = n(values, "Qmds", 0.61);
  const pts: [number, number][] = [
    [3, 0.12], [10, 0.35], [20, 0.54], [24, 0.61], [40, 0.91], [50, 1.13], [80, 1.45], [100, 1.67], [150, 2.06], [200, 2.45], [300, 3.32],
  ];
  const L = 70;
  const R = 480;
  const T = 36;
  const Btm = 270;
  const uMax = Math.max(80, UH * 1.25, 40);
  const qMax = Math.max(1.2, Qmds * 1.4, 0.8);
  const xOf = (u: number) => L + (u / uMax) * (R - L);
  const yOf = (q: number) => Btm - (q / qMax) * (Btm - T);
  const vis = pts.filter((p) => p[0] <= uMax * 1.02);
  const poly = vis.map((p) => `${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`).join(" ");
  const xU = xOf(UH);
  const yQ = yOf(Qmds);
  return (
    <SvgFrame heading="Curva de Hunter" caption={`Gasto probable con ${UH.toFixed(1)} UH → Qmds = ${Qmds.toFixed(2)} L/s (curva de ${String(values.descarga ?? "tanque")}, IS.010 2.3).`}>
      <line x1={L} y1={Btm} x2={R} y2={Btm} stroke="#1a4473" />
      <line x1={L} y1={T} x2={L} y2={Btm} stroke="#1a4473" />
      <polyline points={poly} fill="none" stroke="#1d5aa6" strokeWidth="2" />
      {vis.filter((_, i) => i % 2 === 0).map((p) => (
        <circle key={p[0]} cx={xOf(p[0])} cy={yOf(p[1])} r="2.4" fill="#1a4473" />
      ))}
      <line x1={xU} y1={Btm} x2={xU} y2={yQ} stroke="#8b1e1e" strokeDasharray="4 3" />
      <line x1={L} y1={yQ} x2={xU} y2={yQ} stroke="#8b1e1e" strokeDasharray="4 3" />
      <circle cx={xU} cy={yQ} r="5" fill="#8b1e1e" />
      <text x={xU} y={yQ - 10} textAnchor="middle" fontSize="11" fill="#8b1e1e">
        {Qmds.toFixed(2)} L/s
      </text>
      <text x={(L + R) / 2} y={Btm + 22} textAnchor="middle" fontSize="11" fill="#1a4473">
        Unidades Hunter UH
      </text>
      <text x={L - 8} y={T + 8} textAnchor="end" fontSize="10" fill="#1a4473">
        L/s
      </text>
      <text x={xU} y={Btm + 36} textAnchor="middle" fontSize="10" fill="#8b1e1e">
        {UH.toFixed(1)} UH
      </text>
    </SvgFrame>
  );
}

function MezclaBatch({ values }: { values: Record<string, string> }) {
  const C = n(values, "C", 313);
  const arena = n(values, "arena", 874);
  const piedra = n(values, "piedra", 1012);
  const agua = n(values, "agua", 106);
  const fc = n(values, "fc", 240);
  const vol = n(values, "vol", 1);
  const ra = n(values, "ra", arena / Math.max(C, 1));
  const rp = n(values, "rp", piedra / Math.max(C, 1));
  const rw = n(values, "rw", agua / Math.max(C, 1));
  const tipo = String(values.tipoMezcla ?? "");
  const esHorm = tipo === "hormigon" || tipo === "pobre" || tipo === "ciclopeo";
  const bolsas = n(values, "bolsas", C / 42.5);
  const items = esHorm
    ? [
        { label: "Bolsas", v: C, fill: "#8a8f96", text: `${bolsas.toFixed(2)} bolsas` },
        { label: "Hormigón", v: arena, fill: "#c4a35a", text: `${arena.toFixed(0)} kg` },
        ...(n(values, "piedraG", piedra) > 1 ? [{ label: "Piedra gr.", v: n(values, "piedraG", piedra), fill: "#7a6a58", text: `${n(values, "piedraG", piedra).toFixed(0)} kg` }] : []),
        { label: "Agua", v: agua, fill: "#4a7ea8", text: `${agua.toFixed(0)} L` },
      ]
    : [
        { label: "Bolsas", v: C, fill: "#8a8f96", text: `${bolsas.toFixed(2)} bolsas` },
        { label: "Arena", v: arena, fill: "#d4b483", text: `${arena.toFixed(0)} kg` },
        { label: "Piedra", v: piedra, fill: "#7a6a58", text: `${piedra.toFixed(0)} kg` },
        { label: "Agua", v: agua, fill: "#4a7ea8", text: `${agua.toFixed(0)} L` },
      ];
  const max = Math.max(...items.map((it) => it.v), 1);
  return (
    <SvgFrame heading="Dosificación" caption={esHorm ? `1 : ${ra.toFixed(2)} (cemento : hormigón)   ·   f'c ${fc.toFixed(0)} kg/cm²   ·   ${vol.toFixed(2)} m³` : `1 : ${ra.toFixed(2)} : ${rp.toFixed(2)} : ${rw.toFixed(2)}   ·   f'c ${fc.toFixed(0)} kg/cm²   ·   ${vol.toFixed(2)} m³`} viewBox="0 0 520 300">
      {items.map((it, i) => {
        const x = 48 + i * 120;
        const h = 18 + (it.v / max) * 160;
        const y = 230 - h;
        return (
          <g key={it.label}>
            <rect x={x} y={y} width="78" height={h} fill={it.fill} stroke="#1a4473" strokeWidth="1.2" />
            <text x={x + 39} y={y - 8} textAnchor="middle" fontSize="11" fill="#1a4473">
              {it.text}
            </text>
            <text x={x + 39} y="252" textAnchor="middle" fontSize="12" fill="#1a4473">
              {it.label}
            </text>
          </g>
        );
      })}
      <text x="260" y="282" textAnchor="middle" fontSize="11" fill="#6b6458">
        {esHorm ? "Pedido de obra (hormigón de cimientos o ciclópeo)" : "Pesos de obra por metro cúbico (húmedos)"}
      </text>
    </SvgFrame>
  );
}
