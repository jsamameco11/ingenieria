/**
 * Figuras del expediente de muro de sostenimiento en voladizo.
 *
 * Todas leen el JSON que publica `src/lib/engines/muro/engine.ts` en
 * `dims.muroGeom`, `dims.muroFem` y `dims.muroAcero`, de modo que el croquis
 * siempre muestra la corrida vigente y no una interpretación de los datos de
 * entrada.
 *
 * Convenio de ejes, igual que en el modelo FEM: Y crece de la punta de la
 * puntera hacia el talón y Z es la cota sobre el fondo de la zapata.
 */

import type { ReactNode } from "react";
import { desdeSerial, type UnidadesSerial } from "../lib/engines/muro/unidades";

const INK = "#163a63";
const CONC = "#1a4473";
const SOIL = "#8a7344";
const FLEX = "#8b1e1e";
const SEIS = "#7a3e12";
const WATER = "#2f6a8f";
const PASS = "#1f6b3a";
const FONT = "IBM Plex Sans, sans-serif";

type Estrato = { n: string; t: number; g: number; phi: number; c: number };

type Bloque = { n: number; nombre: string; tipo: string; W: number; x: number; y: number };

type Geom = {
  uni?: UnidadesSerial;
  hp: number; hf: number; ttop: number; tbase: number;
  Ltoe: number; Lheel: number; Df: number; B: number; H: number; talud: number;
  q: number; nf: number;
  estratos: Estrato[];
  E: number; Eh: number; Ev: number; ybar: number; pMax: number;
  dPae: number; yS: number; pTop: number; pBot: number;
  W: number; qMax: number; qMin: number; e: number;
  diagrama: { z: number; e: number; s: number }[];
  dcl: {
    bloques: Bloque[];
    N: number; Ev: number; U: number; Fi: number; yFi: number;
    yEh: number; ySismo: number; Ep: number; Kp: number;
    Mr: number; Mo: number; Mrs: number; Mos: number;
    q1: number; q2: number; qMaxSis: number; es: number; Bcomp: number;
    fsDesl: number; fsVolt: number; fsDeslSis: number; fsVoltSis: number;
    fsDeslMin: number; fsVoltMin: number; fsDeslSisMin: number; fsVoltSisMin: number;
    qadm: number; unaProf: number; unaAncho: number;
  };
};

type CeldaZap = { y0: number; y1: number; zona: string; ms: number; mi: number; q: number };
type CeldaFuste = { z0: number; z1: number; t: number; stub: boolean; ms: number; mi: number; q: number };

type Fem = {
  uni?: UnidadesSerial;
  nNodos: number; nElem: number; nEq: number;
  Lpanel: number; nx: number; ks: number; bordeX: string; sinTraccion: boolean;
  B: number; H: number; hp: number; hf: number; Ltoe: number; tbase: number; Lheel: number;
  caraFuste: number; caraPuntera: number; caraTalon: number;
  zapata: CeldaZap[];
  fuste: CeldaFuste[];
  presion: { y: number; lineal: number; fem: number; femSis: number }[];
  servicio: { nombre: string; qMax: number; despegue: number; iter: number };
  sismico: { nombre: string; qMax: number; despegue: number } | null;
  qAdm: number;
};

type Pieza = {
  pos: string;
  el: string;
  desc: string;
  bar: string;
  s: number;
  forma: "recta" | "L" | "U" | "Z";
  L: number;
  /** Polilínea en coordenadas del muro: x desde la punta de la puntera, y desde el fondo. */
  pts: [number, number][];
  tramos: { e: string; L: number }[];
};

type Acero = {
  uni?: UnidadesSerial;
  hp: number; hf: number; ttop: number; tbase: number;
  Ltoe: number; Lheel: number; B: number; H: number;
  recFuste: number; recZap: number;
  fuste: { bar: string; s: number; As: number; Lc: number; ld: number; d: number };
  fusteSup: { bar: string; s: number; As: number };
  puntera: { bar: string; s: number; As: number; ld: number };
  talon: { bar: string; s: number; As: number; ld: number };
  temp: { bar: string; sH: number; sV: number; capas: number };
  una: { prof: number; ancho: number };
  metodo: string;
  peso: number;
  piezas: Pieza[];
};

function leer<T>(values: Record<string, string>, key: string): T | null {
  const raw = values[key];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);

function Marco({
  titulo,
  pie,
  parte,
  ancho,
  alto,
  children,
}: {
  titulo: string;
  pie: string;
  parte: string;
  ancho: number;
  alto: number;
  children: ReactNode;
}) {
  return (
    <div className="croquis" data-fig-part={parte}>
      <div className="croquis-head">
        <p>{titulo}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="ms-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={FLEX} />
            </marker>
            <marker id="ms-arr-w" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={CONC} />
            </marker>
            <marker id="ms-arr-s" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={SEIS} />
            </marker>
            <marker id="ms-arr-p" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={PASS} />
            </marker>
            <pattern id="ms-conc" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#d9d2c3" />
              <circle cx="2.2" cy="3.2" r="0.6" fill="#6b6458" />
              <circle cx="6" cy="6.2" r="0.5" fill="#6b6458" />
            </pattern>
            <pattern id="ms-soil" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="#d8c9a6" />
              <path d="M0 9 Q5 3.5 10 9" fill="none" stroke="#a8925f" strokeWidth="0.6" />
            </pattern>
            <pattern id="ms-water" width="14" height="10" patternUnits="userSpaceOnUse">
              <rect width="14" height="10" fill="#cfe0ea" />
              <path d="M0 5 Q3.5 2 7 5 T14 5" fill="none" stroke={WATER} strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={ancho} height={alto} fill="#fbf8f1" />
          {children}
        </svg>
      </div>
      <p className="croquis-cap">{pie}</p>
    </div>
  );
}

/** Rótulo en caja, para no depender de las cotas editables. */
function Nota({
  x,
  y,
  lineas,
  color = INK,
  anchor = "start",
  size = 9.5,
}: {
  x: number;
  y: number;
  lineas: string[];
  color?: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
}) {
  // Ancho estimado por número de caracteres: hay que pecar de ancho, porque si
  // la caja se queda corta el texto se sale del recuadro y del lienzo.
  const w = Math.max(...lineas.map((l) => l.length)) * size * 0.6 + 16;
  const h = lineas.length * (size + 3.4) + 9;
  const x0 = anchor === "start" ? x : anchor === "middle" ? x - w / 2 : x - w;
  return (
    <g>
      <rect x={x0} y={y} width={w} height={h} rx="3" fill="#fffdf7" stroke={color} strokeWidth="0.7" opacity="0.96" />
      {lineas.map((l, i) => (
        <text key={i} x={x0 + 7} y={y + 13.5 + i * (size + 3.4)} fontSize={size} fill={color} fontFamily={FONT}>
          {l}
        </text>
      ))}
    </g>
  );
}

/**
 * Cota con extremos en aspa. El lado se indica por su nombre y no por el signo
 * de una distancia, porque el signo depende del orden de los extremos y es una
 * fuente constante de cotas colocadas del lado contrario.
 */
function Cota({
  x1,
  y1,
  x2,
  y2,
  label,
  lado,
  dist = 20,
  size = 9.5,
  dx = 0,
  dy = 0,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  lado: "izq" | "der" | "arriba" | "abajo";
  dist?: number;
  size?: number;
  /** Desplaza solo el rótulo, para sacarlo del concreto o de otra cota. */
  dx?: number;
  dy?: number;
}) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len = Math.hypot(vx, vy) || 1;
  const objetivo =
    lado === "izq" ? { x: -1, y: 0 } : lado === "der" ? { x: 1, y: 0 } : lado === "arriba" ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const n1 = { x: -vy / len, y: vx / len };
  const n2 = { x: vy / len, y: -vx / len };
  const nm = n1.x * objetivo.x + n1.y * objetivo.y >= n2.x * objetivo.x + n2.y * objetivo.y ? n1 : n2;
  const ox = nm.x;
  const oy = nm.y;
  const d = Math.abs(dist);
  const a1 = { x: x1 + ox * d, y: y1 + oy * d };
  const a2 = { x: x2 + ox * d, y: y2 + oy * d };
  const m = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
  // En cotas verticales el rótulo se saca de lado y se alinea contra la línea;
  // centrado la atravesaría, que es lo que pasaba con «corte a 1.69 m».
  const lateral = Math.abs(ox) >= Math.abs(oy);
  const tick = (p: { x: number; y: number }) => (
    <line x1={p.x - 3} y1={p.y + 3} x2={p.x + 3} y2={p.y - 3} stroke={INK} strokeWidth="1" />
  );
  return (
    <g>
      <line x1={x1 + ox * 2} y1={y1 + oy * 2} x2={x1 + ox * (d + 3)} y2={y1 + oy * (d + 3)} stroke={INK} strokeWidth="0.6" />
      <line x1={x2 + ox * 2} y1={y2 + oy * 2} x2={x2 + ox * (d + 3)} y2={y2 + oy * (d + 3)} stroke={INK} strokeWidth="0.6" />
      <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke={INK} strokeWidth="0.9" />
      {tick(a1)}
      {tick(a2)}
      <text
        x={m.x + ox * (lateral ? 6 : 0) + dx}
        y={m.y + oy * (lateral ? 0 : size * 0.95) + dy}
        textAnchor={lateral ? (ox < 0 ? "end" : "start") : "middle"}
        dominantBaseline="middle"
        fontSize={size}
        fill={INK}
        fontFamily={FONT}
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

/** Paso de retícula redondo en las unidades que ve el usuario. */
function pasoGrafico(maxU: number) {
  if (maxU <= 0) return 1;
  const exp = Math.floor(Math.log10(maxU));
  const base = 10 ** exp;
  const n = maxU / base;
  return n > 8 ? base * 2 : n > 4 ? base : n > 2 ? base / 2 : base / 5;
}

/**
 * Una sola escala en X y en Z. Si se usaran escalas distintas, 1.00 m de
 * desplante parecería cuatro metros al lado de una puntera de 1.00 m.
 */
function pxPorMetro(anchoUtil: number, altoUtil: number, Lx: number, Lz: number) {
  return Math.min(anchoUtil / Math.max(Lx, 1e-6), altoUtil / Math.max(Lz, 1e-6));
}

/** Barra gráfica de 1 m (o 1 pie), para que la escala se lea sin cotas. */
function EscalaGrafica({
  x,
  y,
  sc,
  texto,
}: {
  x: number;
  y: number;
  sc: number;
  texto: string;
}) {
  return (
    <g>
      <line x1={x} y1={y} x2={x + sc} y2={y} stroke={INK} strokeWidth="1.5" />
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={INK} strokeWidth="1.2" />
      <line x1={x + sc} y1={y - 4} x2={x + sc} y2={y + 4} stroke={INK} strokeWidth="1.2" />
      <text x={x + sc / 2} y={y - 8} textAnchor="middle" fontSize="8.5" fill={INK} fontFamily={FONT} fontWeight="600">
        {texto}
      </text>
    </g>
  );
}

type Traza = {
  hp: number; hf: number; ttop: number; tbase: number; Ltoe: number; Lheel: number; B: number;
};

/** Contorno del muro en coordenadas de pantalla. */
function trazaMuro(g: Traza, m: { sx: number; sy: number; x0: number; yBot: number }) {
  const { sx, sy, x0, yBot } = m;
  const Y = (y: number) => x0 + y * sx;
  const Z = (z: number) => yBot - z * sy;
  const xP = Y(0);
  const xSF = Y(g.Ltoe);
  const xSB = Y(g.Ltoe + g.tbase);
  const xH = Y(g.B);
  const yBase = Z(g.hf);
  const yTop = Z(g.hf + g.hp);
  // Cara frontal vertical; el talud del trasdós va hacia el relleno.
  const xTopB = Y(g.Ltoe + g.ttop);
  const wall = `${xP},${yBase} ${xP},${yBot} ${xH},${yBot} ${xH},${yBase} ${xSB},${yBase} ${xTopB},${yTop} ${xSF},${yTop} ${xSF},${yBase}`;
  return { Y, Z, xP, xSF, xSB, xH, xTopB, yBase, yTop, yBot, wall };
}

/* ───────────────────────── 1. Esquema geotécnico ───────────────────────── */

function Esquema({ g }: { g: Geom }) {
  const u = desdeSerial(g.uni);
  const W = 900;
  const Ht = 640;
  /* Gutters: las cotas viven aquí, nunca encima del concreto. */
  const gL = 118;
  const gR = 36;
  const gT = 72;
  const gB = 108;
  const una = g.dcl.unaProf;
  const Lrelleno = Math.max(1.2, 0.45 * g.B);
  const sc = pxPorMetro(W - gL - gR, Ht - gT - gB, g.B + Lrelleno, g.H + una);
  const m = trazaMuro(g, { sx: sc, sy: sc, x0: gL, yBot: Ht - gB - una * sc });
  const { Y, Z, xP, xSF, xSB, xH, xTopB, yBase, yTop, yBot } = m;
  const xRell = Math.min(W - 18, xH + Lrelleno * sc);
  const pend = Math.tan((g.talud * Math.PI) / 180);
  const yRellFar = yTop - (xRell - xH) * pend;
  const yNf = g.nf < g.H ? Z(g.H - g.nf) : null;
  const yKey = yBot + una * sc;
  const xKey0 = Y(g.Ltoe + g.tbase / 2 - Math.max(g.dcl.unaAncho, 0.0001) / 2);
  const xKey1 = Y(g.Ltoe + g.tbase / 2 + Math.max(g.dcl.unaAncho, 0.0001) / 2);
  const frenteW = Math.min(0.70 * sc, 48);
  const yFrente = Z(g.Df);

  let acum = 0;
  const bandas = g.estratos
    .map((e) => {
      const z0 = acum;
      acum += e.t;
      return { ...e, z0, z1: Math.min(acum, g.H) };
    })
    .filter((b) => b.z1 > b.z0 + 1e-6);

  return (
    <Marco
      parte="esquema"
      titulo="1. Geometría, perfil geotécnico y acciones"
      pie={`Muro en voladizo H = ${u.fL(g.H)} · B = ${u.fL(g.B)} · ${bandas.length} estrato(s) · NF ${g.nf < g.H ? `a ${u.fL(g.nf)} bajo la corona` : "por debajo del desplante"} · q = ${u.fP(g.q)}. Escala 1:1 en ambas direcciones.`}
      ancho={W}
      alto={Ht}
    >
      {/* Cielo a la izquierda del fuste, por encima del suelo frontal (cota Df). */}
      <rect x="0" y="0" width={xSF} height={Math.min(yFrente, yBase)} fill="#fbf8f1" />

      {/* Relleno: solo desde el trasdós hacia la derecha. */}
      <polygon
        points={`${xSB},${yBase} ${xH},${yBase} ${xRell},${yBase} ${xRell},${yRellFar} ${xTopB},${yTop}`}
        fill="url(#ms-soil)"
      />
      {bandas.map((b, i) => {
        const za = g.H - b.z0;
        const zb = g.H - b.z1;
        if (Z(za) > yBase) return null;
        return (
          <g key={i}>
            {i > 0 ? <line x1={xTopB} y1={Z(za)} x2={xRell} y2={Z(za)} stroke={SOIL} strokeWidth="1" strokeDasharray="5,3" /> : null}
            <text x={xTopB + 14} y={(Z(za) + Math.max(Z(zb), yBase)) / 2 + 3} fontSize="9" fill="#6b5a2e" fontFamily={FONT}>
              {`${b.n || `Estrato ${i + 1}`} · φ=${f1(b.phi)}°${b.c > 0 ? ` · c=${u.nP(b.c)}` : ""}`}
            </text>
          </g>
        );
      })}
      {yNf != null ? (
        <>
          <polygon points={`${xSB},${yBase} ${xRell},${yBase} ${xRell},${yNf} ${xSB},${yNf}`} fill="url(#ms-water)" opacity="0.5" />
          <line x1={xSB} y1={yNf} x2={xRell + 8} y2={yNf} stroke={WATER} strokeWidth="1.3" strokeDasharray="6,3" />
          <text x={xRell - 6} y={yNf - 5} textAnchor="end" fontSize="9" fill={WATER} fontFamily={FONT}>NF</text>
        </>
      ) : null}

      {g.q > 0.01 ? (
        <g>
          {Array.from({ length: 8 }, (_, i) => {
            const x = xTopB + ((xRell - xTopB) * i) / 7;
            const y = Math.min(yTop, yTop - (x - xH) * pend);
            return <line key={i} x1={x} y1={y - 36} x2={x} y2={y - 6} stroke={FLEX} strokeWidth="1.3" markerEnd="url(#ms-arr)" />;
          })}
          <line x1={xTopB} y1={yTop - 38} x2={xRell} y2={yRellFar - 38} stroke={FLEX} strokeWidth="1.4" />
          <text x={(xTopB + xRell) / 2} y={yTop - 44} textAnchor="middle" fontSize="10" fill={FLEX} fontWeight="700" fontFamily={FONT}>
            {`q = ${u.fP(g.q)}`}
          </text>
        </g>
      ) : null}

      {/* Suelo frontal: sobre la puntera (altura Df − hf) y delante del muro. El
          motor lo pesa como W4 = L_toe·(Df−hf)·γ_front; el croquis no puede omitirlo. */}
      {g.Df > g.hf + 1e-6 && g.Ltoe > 1e-6 ? (
        <polygon
          points={`${xP - frenteW},${yFrente} ${xSF},${yFrente} ${xSF},${yBase} ${xP},${yBase} ${xP},${yBot} ${xP - frenteW},${yBot}`}
          fill="url(#ms-soil)"
          opacity="0.9"
        />
      ) : (
        <polygon
          points={`${xP - frenteW},${yFrente} ${xP},${yFrente} ${xP},${yBot} ${xP - frenteW},${yBot}`}
          fill="url(#ms-soil)"
          opacity="0.9"
        />
      )}
      <line x1={xP - frenteW - 4} y1={yFrente} x2={g.Df > g.hf ? xSF : xP} y2={yFrente} stroke={SOIL} strokeWidth="1.5" />

      <polygon points={m.wall} fill="url(#ms-conc)" stroke={CONC} strokeWidth="1.8" />
      {una > 0.01 ? (
        <polygon points={`${xKey0},${yBot} ${xKey1},${yBot} ${xKey1},${yKey} ${xKey0},${yKey}`} fill="url(#ms-conc)" stroke={CONC} strokeWidth="1.6" />
      ) : null}
      <line x1={xP - frenteW - 8} y1={yBot} x2={xRell + 6} y2={yBot} stroke="#6b5a2e" strokeWidth="1.6" />

      <text x={(xP + xSF) / 2} y={(yBase + yBot) / 2 + 3.5} textAnchor="middle" fontSize="9" fill={CONC} fontWeight="700" fontFamily={FONT}>PUNTERA</text>
      <text x={(xSB + xH) / 2} y={(yBase + yBot) / 2 + 3.5} textAnchor="middle" fontSize="9" fill={CONC} fontWeight="700" fontFamily={FONT}>TALÓN</text>
      {(() => {
        const xF = (xSF + xTopB) / 2;
        const yF = (yTop + yBase) / 2;
        return (
          <text
            x={xF}
            y={yF}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill={CONC}
            fontWeight="700"
            fontFamily={FONT}
            transform={`rotate(-90 ${xF} ${yF})`}
          >
            FUSTE
          </text>
        );
      })()}
      {una > 0.01 ? (
        <text x={(xKey0 + xKey1) / 2} y={(yBot + yKey) / 2 + 3} textAnchor="middle" fontSize="8" fill={FLEX} fontWeight="700" fontFamily={FONT}>UÑA</text>
      ) : null}

      <Cota x1={xSF} y1={yTop} x2={xTopB} y2={yTop} label={u.nL(g.ttop)} lado="arriba" dist={18} />
      <Cota
        x1={xSF}
        y1={yBase}
        x2={xSB}
        y2={yBase}
        label={u.nL(g.tbase)}
        lado="arriba"
        dist={g.Df > g.hf ? yBase - yFrente + 16 : 18}
        dx={-(xSF - xP) * 0.45}
      />
      <Cota x1={xP} y1={yBot} x2={xSF} y2={yBot} label={u.nL(g.Ltoe)} lado="abajo" dist={una > 0.01 ? 52 : 28} />
      <Cota x1={xSB} y1={yBot} x2={xH} y2={yBot} label={u.nL(g.Lheel)} lado="abajo" dist={una > 0.01 ? 52 : 28} />
      <Cota x1={xP} y1={yBot} x2={xH} y2={yBot} label={`B = ${u.fL(g.B)}`} lado="abajo" dist={una > 0.01 ? 80 : 56} />
      <Cota x1={xP} y1={yTop} x2={xP} y2={yBot} label={`H = ${u.fL(g.H)}`} lado="izq" dist={72} />
      <Cota x1={xP - frenteW} y1={yFrente} x2={xP - frenteW} y2={yBot} label={`Df = ${u.fL(g.Df)}`} lado="izq" dist={28} />
      <Cota x1={xH} y1={yBase} x2={xH} y2={yBot} label={`hf = ${u.fL(g.hf)}`} lado="der" dist={22} />
      {una > 0.01 ? <Cota x1={xKey0} y1={yBot} x2={xKey0} y2={yKey} label={u.nL(una)} lado="izq" dist={20} /> : null}

      <EscalaGrafica x={xP} y={18} sc={sc} texto={u.fL(1)} />

      <Nota
        x={W - 14}
        y={yTop + 8}
        anchor="end"
        size={9}
        lineas={[
          `Empuje estático  E = ${u.fF(g.E)}`,
          `  Eh = ${u.nF(g.Eh)}   Ev = ${u.nF(g.Ev)}   ȳ = ${u.fL(g.ybar)}`,
          `σh máx = ${u.fP(g.pMax)} en el fondo`,
          `Incremento sísmico  ΔPae = ${u.fF(g.dPae)} a ${u.fL(g.yS)}`,
          `Peso total  W = ${u.fF(g.W)}`,
          g.talud !== 0 ? `Talud del relleno β = ${f1(g.talud)}°` : "Relleno horizontal (β = 0°)",
        ]}
      />
    </Marco>
  );
}

/* ─────────────────────── 2. Diagramas de presión ─────────────────────── */

function Empujes({ g }: { g: Geom }) {
  const u = desdeSerial(g.uni);
  const W = 720;
  const Ht = 510;
  const yTop = 70;
  const yBot = Ht - 146;
  const hPx = yBot - yTop;
  const xMuro = 320;
  const pts = g.diagrama;
  const pTot = Math.max(...pts.map((p) => p.e + p.s), 1e-6);
  const escala = 290 / pTot;
  const Z = (z: number) => yTop + (hPx * z) / Math.max(g.H, 1e-9);
  const polyE = `${xMuro},${yTop} ${pts.map((p) => `${xMuro + p.e * escala},${Z(p.z)}`).join(" ")} ${xMuro},${yBot}`;
  const yRes = Z(g.H - g.ybar);
  const yResS = Z(g.H - g.yS);
  const xMax = xMuro + pTot * escala;

  return (
    <Marco
      parte="empujes"
      titulo="2. Diagramas de presión lateral — estático y con sismo"
      pie={`Empuje estático Eh = ${u.fF(g.Eh)} a ȳ = ${u.fL(g.ybar)} sobre el fondo · incremento sísmico ΔPae = ${u.fF(g.dPae)} a ${u.fL(g.yS)} (0.6H) · resultante total ${u.fF(g.Eh + g.dPae)}.`}
      ancho={W}
      alto={Ht}
    >
      <rect x={xMuro - 46} y={yTop} width="46" height={hPx} fill="url(#ms-conc)" stroke={CONC} strokeWidth="1.4" />
      <line x1={xMuro - 66} y1={yBot} x2={xMax + 80} y2={yBot} stroke="#6b5a2e" strokeWidth="1.6" />
      {/* Retícula cada metro de profundidad z medida desde la corona. */}
      {Array.from({ length: Math.floor(g.H) }, (_, i) => i + 1).map((i) => (
        <g key={i}>
          <line x1={xMuro} y1={Z(i)} x2={xMax + 20} y2={Z(i)} stroke="#cdbf9d" strokeWidth="0.6" />
          <text x={xMax + 24} y={Z(i) + 3} fontSize="8" fill="#8a7344" fontFamily={FONT}>{`z = ${i} m`}</text>
        </g>
      ))}

      <polygon points={polyE} fill={FLEX} opacity="0.16" stroke={FLEX} strokeWidth="1.6" />
      <polyline
        points={pts.map((p) => `${xMuro + (p.e + p.s) * escala},${Z(p.z)}`).join(" ")}
        fill="none"
        stroke={SEIS}
        strokeWidth="1.8"
        strokeDasharray="7,3"
      />

      <line x1={xMuro - 46} y1={yRes} x2={xMuro - 136} y2={yRes} stroke={FLEX} strokeWidth="2.2" markerEnd="url(#ms-arr)" />
      <text x={xMuro - 140} y={yRes - 6} textAnchor="end" fontSize="10" fill={FLEX} fontWeight="700" fontFamily={FONT}>
        {`Eh = ${u.fF(g.Eh)}`}
      </text>
      {g.dPae > 0.01 ? (
        <>
          <line x1={xMuro - 46} y1={yResS} x2={xMuro - 136} y2={yResS} stroke={SEIS} strokeWidth="2.2" markerEnd="url(#ms-arr-s)" />
          <text x={xMuro - 140} y={yResS - 6} textAnchor="end" fontSize="10" fill={SEIS} fontWeight="700" fontFamily={FONT}>
            {`ΔPae = ${u.fF(g.dPae)}`}
          </text>
        </>
      ) : null}

      <text x={xMuro + g.pMax * escala - 6} y={yBot - 16} textAnchor="end" fontSize="10" fill={FLEX} fontWeight="700" fontFamily={FONT}>
        {`σh = ${u.fP(g.pMax)}`}
      </text>
      {g.pTop > 0.01 ? (
        <text x={xMuro + g.pTop * escala + 8} y={yTop - 8} fontSize="9.5" fill={SEIS} fontFamily={FONT}>
          {`Δσ corona = ${u.fP(g.pTop)}`}
        </text>
      ) : null}

      <Cota x1={xMuro - 46} y1={yTop} x2={xMuro - 46} y2={yBot} label={`H = ${u.fL(g.H)}`} lado="izq" dist={72} />
      <Cota x1={xMuro} y1={yBot} x2={xMuro + g.pMax * escala} y2={yBot} label={`${u.fP(g.pMax)}`} lado="abajo" dist={26} />

      <Nota
        x={16}
        y={yBot + 60}
        size={9}
        lineas={[
          "Trazo continuo: presión estática σh(z) del perfil multicapa",
          "Trazo a rayas: estático + incremento dinámico (envolvente sísmica)",
          `Área estática = ${u.fF(g.Eh)} · área dinámica = ${u.fF(g.dPae)}`,
          `El incremento dinámico se reparte en trapecio para situar su resultante en 0.6H = ${u.fL(g.yS)} sobre el fondo`,
        ]}
      />
    </Marco>
  );
}

/* ───────────────────── 3. Estabilidad y presiones ───────────────────── */

function EstabilidadFig({ g }: { g: Geom }) {
  const u = desdeSerial(g.uni);
  const W = 980;
  const Ht = 640;
  const d = g.dcl;
  const padL = 180;
  const padB = 236;
  const sc = pxPorMetro(340, 320, Math.max(g.B, 1.5), Math.max(g.H, 2));
  const m = trazaMuro(g, { sx: sc, sy: sc, x0: padL, yBot: Ht - padB });
  const { Y, Z, xP, xSF, xH, yBot, yTop, yBase } = m;
  const yFrente = Z(g.Df);

  const yDiag = yBot + 64;
  const pEsc = 78 / Math.max(d.q1, d.q2, 1e-6);
  const p1 = Math.max(d.q1, 0);
  const p2 = Math.max(d.q2, 0);

  return (
    <Marco
      parte="estabilidad"
      titulo="3. Estabilidad externa — cuerpo libre y presiones de contacto"
      pie={`FS deslizamiento ${f2(d.fsDesl)} / ${f2(d.fsDeslSis)} (mín ${f2(d.fsDeslMin)} / ${f2(d.fsDeslSisMin)}) · FS volteo ${f2(d.fsVolt)} / ${f2(d.fsVoltSis)} (mín ${f2(d.fsVoltMin)} / ${f2(d.fsVoltSisMin)}) · e = ${u.fL(g.e)} · q = ${u.fP(d.q1)} / ${u.fP(d.q2)} frente a q_adm = ${u.fP(d.qadm)}.`}
      ancho={W}
      alto={Ht}
    >
      <polygon
        points={`${Y(g.Ltoe + g.tbase)},${Z(g.hf)} ${xH},${Z(g.hf)} ${xH + 92},${Z(g.hf)} ${xH + 92},${yTop - 14} ${Y(g.Ltoe + g.ttop)},${yTop}`}
        fill="url(#ms-soil)"
        opacity="0.8"
      />
      {g.Df > g.hf + 1e-6 && g.Ltoe > 1e-6 ? (
        <polygon
          points={`${xP - 28},${yFrente} ${xSF},${yFrente} ${xSF},${yBase} ${xP},${yBase} ${xP},${yBot} ${xP - 28},${yBot}`}
          fill="url(#ms-soil)"
          opacity="0.8"
        />
      ) : null}
      <polygon points={m.wall} fill="url(#ms-conc)" stroke={CONC} strokeWidth="1.7" />
      {d.unaProf > 0.01 ? (
        <polygon
          points={`${Y(g.Ltoe)},${yBot} ${Y(g.Ltoe + Math.max(d.unaAncho, 0.0001))},${yBot} ${Y(g.Ltoe + Math.max(d.unaAncho, 0.0001))},${yBot + d.unaProf * sc} ${Y(g.Ltoe)},${yBot + d.unaProf * sc}`}
          fill="url(#ms-conc)"
          stroke={CONC}
          strokeWidth="1.5"
        />
      ) : null}
      <line x1={xP - 70} y1={yBot} x2={xH + 100} y2={yBot} stroke="#6b5a2e" strokeWidth="1.6" />

      {d.bloques.map((b) => {
        const x = Y(b.x);
        const y = Z(b.y);
        return (
          <g key={b.n}>
            <circle cx={x} cy={y} r="2.4" fill={CONC} />
            <line x1={x} y1={y} x2={x} y2={y + 30} stroke={CONC} strokeWidth="1.5" markerEnd="url(#ms-arr-w)" />
            <text x={x + 4} y={y - 4} fontSize="8.5" fill={CONC} fontWeight="700" fontFamily={FONT}>{`W${b.n}`}</text>
          </g>
        );
      })}

      <line x1={xH + 84} y1={Z(d.yEh)} x2={xH + 10} y2={Z(d.yEh)} stroke={FLEX} strokeWidth="2.4" markerEnd="url(#ms-arr)" />
      <text x={xH + 88} y={Z(d.yEh) - 5} fontSize="9.5" fill={FLEX} fontWeight="700" fontFamily={FONT}>{`Eh ${u.nF(g.Eh)}`}</text>
      {g.dPae > 0.01 ? (
        <>
          <line x1={xH + 84} y1={Z(d.ySismo)} x2={xH + 10} y2={Z(d.ySismo)} stroke={SEIS} strokeWidth="2.4" markerEnd="url(#ms-arr-s)" />
          <text x={xH + 88} y={Z(d.ySismo) - 5} fontSize="9.5" fill={SEIS} fontWeight="700" fontFamily={FONT}>{`ΔPae ${u.nF(g.dPae)}`}</text>
        </>
      ) : null}
      {d.Fi > 0.01 ? (
        <>
          <line x1={Y(g.Ltoe + g.tbase / 2)} y1={Z(d.yFi)} x2={Y(g.Ltoe + g.tbase / 2) - 70} y2={Z(d.yFi)} stroke={SEIS} strokeWidth="2.2" markerEnd="url(#ms-arr-s)" />
          <text x={Y(g.Ltoe + g.tbase / 2) - 74} y={Z(d.yFi) - 5} textAnchor="end" fontSize="9.5" fill={SEIS} fontWeight="700" fontFamily={FONT}>
            {`Fi = kh·W = ${u.nF(d.Fi)}`}
          </text>
        </>
      ) : null}
      {d.Ep > 0.01 ? (
        <>
          <line x1={xP - 64} y1={Z(g.hf / 2)} x2={xP - 6} y2={Z(g.hf / 2)} stroke={PASS} strokeWidth="2.2" markerEnd="url(#ms-arr-p)" />
          <text x={xP - 68} y={Z(g.hf / 2) - 5} textAnchor="end" fontSize="9.5" fill={PASS} fontWeight="700" fontFamily={FONT}>
            {`Ep = ${u.nF(d.Ep)}`}
          </text>
        </>
      ) : null}

      <polygon
        points={`${xP},${yDiag} ${xH},${yDiag} ${xH},${yDiag + p2 * pEsc} ${xP},${yDiag + p1 * pEsc}`}
        fill={FLEX}
        opacity="0.15"
        stroke={FLEX}
        strokeWidth="1.5"
      />
      <line x1={xP} y1={yDiag} x2={xH} y2={yDiag} stroke={CONC} strokeWidth="1.2" />
      <text x={xP - 8} y={yDiag + p1 * pEsc + 14} textAnchor="end" fontSize="9.5" fill={FLEX} fontWeight="700" fontFamily={FONT}>{`q1 = ${u.fP(d.q1)}`}</text>
      <text x={xH + 8} y={yDiag + p2 * pEsc + 14} fontSize="9.5" fill={FLEX} fontWeight="700" fontFamily={FONT}>{`q2 = ${u.fP(d.q2)}`}</text>
      <text x={(xP + xH) / 2} y={yDiag + 20} textAnchor="middle" fontSize="9" fill={FLEX} fontFamily={FONT}>
        presión de contacto en servicio
      </text>
      <line x1={Y(g.B / 2)} y1={yBot + 6} x2={Y(g.B / 2)} y2={yDiag} stroke={CONC} strokeWidth="0.8" strokeDasharray="4,3" />
      <line x1={Y(g.B / 2 + g.e)} y1={yBot + 6} x2={Y(g.B / 2 + g.e)} y2={yDiag} stroke={FLEX} strokeWidth="1.1" />
      <Cota x1={Y(g.B / 2)} y1={yDiag} x2={Y(g.B / 2 + g.e)} y2={yDiag} label={`e = ${u.nL(g.e)}`} lado="arriba" dist={12} />
      <Cota x1={xP} y1={yDiag + Math.max(p1, p2) * pEsc} x2={xH} y2={yDiag + Math.max(p1, p2) * pEsc} label={`B = ${u.fL(g.B)}`} lado="abajo" dist={30} />

      <Nota
        x={W - 14}
        y={14}
        anchor="end"
        size={9}
        lineas={[
          `Σ W = ${u.fF(g.W)}      N = ${u.fF(d.N)}`,
          `Mr = ${u.nM(d.Mr)}   Mo = ${u.fM(d.Mo)}`,
          `FS deslizamiento ${f2(d.fsDesl)} ≥ ${f2(d.fsDeslMin)} · sismo ${f2(d.fsDeslSis)} ≥ ${f2(d.fsDeslSisMin)}`,
          `FS volteo ${f2(d.fsVolt)} ≥ ${f2(d.fsVoltMin)} · sismo ${f2(d.fsVoltSis)} ≥ ${f2(d.fsVoltSisMin)}`,
          `e = ${u.fL(g.e)} ${Math.abs(g.e) <= g.B / 6 ? "≤" : ">"} B/6 = ${u.fL(g.B / 6)}`,
          `q máx = ${u.fP(g.qMax)} ≤ q_adm = ${u.fP(d.qadm)}`,
          `q máx sismo = ${u.fP(d.qMaxSis)} ≤ 1.25 q_adm = ${u.fP(1.25 * d.qadm)}`,
          d.Ep > 0.01 ? `Pasivo movilizado Ep = ${u.fF(d.Ep)} (Kp = ${f2(d.Kp)})` : "Sin aportar empuje pasivo",
        ]}
      />
      {/* El detalle de bloques va bajo la base, donde el lienzo queda libre. */}
      <Nota
        x={W - 14}
        y={yBot + 36}
        anchor="end"
        size={9}
        lineas={d.bloques.map((b) => `W${b.n} ${b.nombre}: ${u.fF(b.W)} · x = ${u.fL(b.x)} · y = ${u.fL(b.y)}`)}
      />
    </Marco>
  );
}

/* ──────────────────────── 4 y 5. Malla y mapa de calor ──────────────────────── */

function escalaColor(v: number, vMax: number) {
  // Rampa monótona en luminosidad: crema → ámbar → rojo → violeta.
  const t = Math.max(0, Math.min(1, vMax > 1e-9 ? v / vMax : 0));
  const paleta: [number, number, number][] = [
    [247, 243, 232],
    [246, 217, 150],
    [235, 158, 78],
    [199, 76, 54],
    [122, 35, 74],
  ];
  const s = t * (paleta.length - 1);
  const i = Math.min(paleta.length - 2, Math.floor(s));
  const f = s - i;
  const c = paleta[i].map((a, k) => Math.round(a + (paleta[i + 1][k] - a) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function Malla({ fem, calor }: { fem: Fem; calor: boolean }) {
  const u = desdeSerial(fem.uni);
  const W = 730;
  const Ht = 560;
  const padL = 130;
  const padR = 180;
  const padT = calor ? 96 : 44;
  const padB = 124;
  const sc = pxPorMetro(W - padL - padR, Ht - padT - padB, Math.max(fem.B, 1.5), Math.max(fem.H, 2));
  const Y = (y: number) => padL + y * sc;
  const Z = (z: number) => Ht - padB - z * sc;
  const zapBot = Z(0);
  const yEje = fem.Ltoe + fem.tbase / 2;
  const hfPx = fem.hf * sc;

  const activos = fem.fuste.filter((c) => !c.stub);
  const maxFuste = Math.max(...activos.map((c) => Math.max(c.ms, c.mi)), 0);
  const maxZap = Math.max(...fem.zapata.map((c) => Math.max(c.ms, c.mi)), 0);
  const vMax = Math.max(maxFuste, maxZap, 1e-6);

  return (
    <Marco
      parte={calor ? "calor" : "malla"}
      titulo={calor ? "5. Envolvente de Wood & Armer sobre la malla (${u.u.M})" : "4. Malla de elementos finitos y resortes de Winkler"}
      pie={
        calor
          ? `Envolvente de momentos de diseño por elemento; máximo ${u.fM(vMax)}. Cada celda toma el mayor de las cinco combinaciones de rotura, ya corregido por Wood & Armer.`
          : `${fem.nNodos} nodos · ${fem.nElem} láminas MITC4 · ${fem.nEq} ecuaciones · paño de ${u.fL(fem.Lpanel)} con ${fem.nx} divisiones en X y bordes ${fem.bordeX === "simetria" ? "de simetría" : "libres"} · ks = ${u.fK(fem.ks)}${fem.sinTraccion ? " con resortes sin tracción" : " bilaterales"}.`
      }
      ancho={W}
      alto={Ht}
    >
      {fem.zapata.map((c, i) => (
        <rect
          key={`z${i}`}
          x={Y(c.y0)}
          y={zapBot - hfPx / 2}
          width={Math.max(1, Y(c.y1) - Y(c.y0))}
          height={hfPx}
          fill={calor ? escalaColor(Math.max(c.ms, c.mi), vMax) : "url(#ms-conc)"}
          stroke={CONC}
          strokeWidth="0.7"
        />
      ))}
      {fem.fuste.map((c, i) => {
        const t0 = (fem.fuste[Math.max(0, i - 1)]?.t ?? c.t) * sc;
        const t1 = c.t * sc;
        const xc = Y(yEje);
        return (
          <polygon
            key={`f${i}`}
            points={`${xc - t0 / 2},${Z(c.z0)} ${xc + t0 / 2},${Z(c.z0)} ${xc + t1 / 2},${Z(c.z1)} ${xc - t1 / 2},${Z(c.z1)}`}
            fill={c.stub ? "#cfc6ae" : calor ? escalaColor(Math.max(c.ms, c.mi), vMax) : "url(#ms-conc)"}
            stroke={CONC}
            strokeWidth="0.7"
          />
        );
      })}

      <line x1={Y(0)} y1={zapBot} x2={Y(fem.B)} y2={zapBot} stroke={FLEX} strokeWidth="1" strokeDasharray="5,3" opacity="0.7" />
      {!calor ? (
        <>
          {fem.presion.map((p, i) => (
            <g key={`k${i}`}>
              <line x1={Y(p.y)} y1={zapBot + hfPx / 2} x2={Y(p.y)} y2={zapBot + 34} stroke={PASS} strokeWidth="1" />
              <path d={`M${Y(p.y) - 4},${zapBot + 22} l4,-6 l4,6`} fill="none" stroke={PASS} strokeWidth="1" />
              <circle cx={Y(p.y)} cy={zapBot + 34} r="1.7" fill={PASS} />
            </g>
          ))}
          <line x1={Y(0) - 14} y1={zapBot + 34} x2={Y(fem.B) + 14} y2={zapBot + 34} stroke={PASS} strokeWidth="1.4" />
          <text x={Y(fem.B) + 20} y={zapBot + 38} fontSize="9" fill={PASS} fontFamily={FONT}>
            {`kv = ks·A_trib${fem.sinTraccion ? " (sin tracción)" : ""}`}
          </text>
        </>
      ) : null}

      <line x1={Y(0)} y1={Z(fem.caraFuste)} x2={Y(fem.B) + 10} y2={Z(fem.caraFuste)} stroke={SEIS} strokeWidth="1" strokeDasharray="3,3" />
      <text x={Y(fem.B) + 14} y={Z(fem.caraFuste) - 5} fontSize="8.5" fill={SEIS} fontFamily={FONT}>
        {`cara de diseño del fuste (Z = ${u.fL(fem.caraFuste)})`}
      </text>

      {/* Sin resortes que esquivar, la cota puede subir hasta la propia zapata. */}
      <Cota
        x1={Y(0)}
        y1={zapBot + (calor ? hfPx / 2 : 52)}
        x2={Y(fem.B)}
        y2={zapBot + (calor ? hfPx / 2 : 52)}
        label={`B = ${u.fL(fem.B)}`}
        lado="abajo"
        dist={24}
      />
      <Cota x1={Y(0)} y1={Z(fem.hf / 2 + fem.hp)} x2={Y(0)} y2={zapBot} label={`${u.fL(fem.hf / 2 + fem.hp)}`} lado="izq" dist={40} />

      {calor ? (
        <g>
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={W - 178 + i * 4.6} y={26} width="4.8" height="14" fill={escalaColor((i / 29) * vMax, vMax)} />
          ))}
          <rect x={W - 178} y={26} width={138} height="14" fill="none" stroke={CONC} strokeWidth="0.7" />
          <text x={W - 178} y={52} fontSize="8.5" fill={INK} fontFamily={FONT}>0</text>
          <text x={W - 40} y={52} textAnchor="end" fontSize="8.5" fill={INK} fontFamily={FONT}>{`${u.fM(vMax)}`}</text>
        </g>
      ) : null}

      <Nota
        x={W - 14}
        y={calor ? 62 : 16}
        anchor="end"
        size={9}
        lineas={
          calor
            ? [
                "Cada lámina aporta Mxx, Myy y Mxy en su centro; Wood",
                "& Armer los convierte en momentos de armado ortogonal",
                "para la cara superior y la inferior.",
                `Fuste máx = ${u.fM(maxFuste)}`,
                `Zapata máx = ${u.fM(maxZap)}`,
                "El tramo gris del arranque es el nudo embebido: aporta",
                "rigidez pero no recibe peso propio ni empuje.",
              ]
            : [
                `${fem.nNodos} nodos · ${fem.nElem} láminas · ${fem.nEq} ecuaciones`,
                `Paño de ${u.fL(fem.Lpanel)} con ${fem.nx} franjas en X`,
                `Bordes X: ${fem.bordeX === "simetria" ? "simetría (deformación plana)" : "libres"}`,
                `ks = ${u.fK(fem.ks)}${fem.sinTraccion ? " · resortes sin tracción" : " · bilaterales"}`,
                `Servicio: q máx = ${u.fP(fem.servicio.qMax)}`,
                `  ${fem.servicio.despegue} nodo(s) despegado(s) en ${fem.servicio.iter} iteración(es)`,
                "Solver directo LDLᵀ en perfil skyline con reordenamiento RCM",
              ]
        }
      />
    </Marco>
  );
}

/* ───────────── 6. Presión de contacto: lineal frente a Winkler ───────────── */

function Presiones({ fem }: { fem: Fem }) {
  const u = desdeSerial(fem.uni);
  const W = 820;
  const Ht = 540;
  const padL = 116;
  const padR = 132;
  const yTop = 56;
  const yBase = 330;
  const sc = (W - padL - padR) / Math.max(fem.B, 1e-6);
  const Y = (y: number) => padL + y * sc;
  const vMax = Math.max(fem.qAdm, ...fem.presion.map((p) => Math.max(p.lineal, p.fem, p.femSis)));
  const vMaxU = Math.max(u.vP(vMax), 1e-6);
  const P = (v: number) => yBase - ((yBase - yTop) * Math.max(u.vP(v), 0)) / vMaxU;
  const serie = (k: "lineal" | "fem" | "femSis") => fem.presion.map((p) => `${Y(p.y)},${P(p[k])}`).join(" ");
  // Retícula en las unidades del usuario: 245 kPa no puede aparecer como «245 Tnf/m²».
  const paso = pasoGrafico(vMaxU);
  const niveles: number[] = [];
  for (let v = 0; v <= vMaxU + 1e-9; v += paso) niveles.push(v);
  const ult = fem.presion[fem.presion.length - 1];

  return (
    <Marco
      parte="presiones"
      titulo="6. Presión de contacto — reparto lineal frente a resortes de Winkler"
      pie={`Reparto lineal de la vía analítica frente al modelo de suelo del FEM. Servicio ${u.fP(fem.servicio.qMax)} (${fem.servicio.nombre})${fem.sismico ? ` · con sismo ${u.fP(fem.sismico.qMax)} (${fem.sismico.nombre}), ${fem.sismico.despegue} nodo(s) despegado(s)` : ""}.`}
      ancho={W}
      alto={Ht}
    >
      {niveles.map((v, i) => {
        const y = yBase - ((yBase - yTop) * v) / vMaxU;
        return (
          <g key={i}>
            <line x1={Y(0)} y1={y} x2={Y(fem.B)} y2={y} stroke="#ded3ba" strokeWidth="0.6" />
            <text x={Y(0) - 8} y={y + 3} textAnchor="end" fontSize="8.5" fill="#6b5a2e" fontFamily={FONT}>
              {Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1)}
            </text>
          </g>
        );
      })}
      <text x={Y(0) - 8} y={yTop - 14} textAnchor="end" fontSize="9" fill={INK} fontFamily={FONT}>{u.u.P}</text>
      <line x1={Y(0)} y1={yBase} x2={Y(fem.B)} y2={yBase} stroke={CONC} strokeWidth="1.4" />
      <line x1={Y(0)} y1={yTop - 8} x2={Y(0)} y2={yBase} stroke={CONC} strokeWidth="1" />
      <line x1={Y(0)} y1={P(fem.qAdm)} x2={Y(fem.B)} y2={P(fem.qAdm)} stroke={PASS} strokeWidth="1.5" strokeDasharray="8,4" />
      <text x={Y(fem.B) + 6} y={P(fem.qAdm) + 3} fontSize="9" fill={PASS} fontWeight="700" fontFamily={FONT}>{`q_adm = ${u.nP(fem.qAdm)}`}</text>

      <polyline points={serie("lineal")} fill="none" stroke={FLEX} strokeWidth="2" />
      {fem.sismico ? <polyline points={serie("femSis")} fill="none" stroke={SEIS} strokeWidth="1.8" strokeDasharray="7,3" /> : null}
      <polyline points={serie("fem")} fill="none" stroke={CONC} strokeWidth="2.4" />
      {fem.presion.map((p, i) => (
        <circle key={i} cx={Y(p.y)} cy={P(p.fem)} r="1.8" fill={CONC} />
      ))}
      <text x={Y(fem.B) + 6} y={P(ult.lineal) + 3} fontSize="8.5" fill={FLEX} fontFamily={FONT}>{u.nP(ult.lineal)}</text>
      <text x={Y(fem.B) + 6} y={P(ult.fem) + 3} fontSize="8.5" fill={CONC} fontFamily={FONT}>{u.nP(ult.fem)}</text>

      <line x1={Y(fem.caraPuntera)} y1={yTop - 8} x2={Y(fem.caraPuntera)} y2={yBase} stroke={SOIL} strokeWidth="0.8" strokeDasharray="4,3" />
      <line x1={Y(fem.caraTalon)} y1={yTop - 8} x2={Y(fem.caraTalon)} y2={yBase} stroke={SOIL} strokeWidth="0.8" strokeDasharray="4,3" />
      <text x={Y(fem.caraPuntera / 2)} y={yBase + 18} textAnchor="middle" fontSize="9" fill={SOIL} fontFamily={FONT}>puntera</text>
      <text x={Y((fem.caraPuntera + fem.caraTalon) / 2)} y={yBase + 18} textAnchor="middle" fontSize="8.5" fill={SOIL} fontFamily={FONT}>nudo</text>
      <text x={Y((fem.caraTalon + fem.B) / 2)} y={yBase + 18} textAnchor="middle" fontSize="9" fill={SOIL} fontFamily={FONT}>talón</text>

      <Cota x1={Y(0)} y1={yBase + 24} x2={Y(fem.B)} y2={yBase + 24} label={`B = ${u.fL(fem.B)}`} lado="abajo" dist={22} />

      <Nota
        x={16}
        y={yBase + 90}
        size={9}
        lineas={[
          "Rojo: reparto lineal N/B ± 6M/B² de la vía analítica",
          "Azul: reacción de los resortes de Winkler en servicio",
          fem.sismico ? "Ámbar a rayas: envolvente con sismo" : "Sin incremento sísmico",
          `Servicio q máx = ${u.fP(fem.servicio.qMax)} · ${fem.servicio.despegue} nodo(s) sin contacto`,
          fem.sismico ? `Sismo q máx = ${u.fP(fem.sismico.qMax)} · ${fem.sismico.despegue} nodo(s) sin contacto` : "",
          "El lazo de contacto desactiva los resortes que resultarían traccionados y vuelve a resolver.",
        ].filter(Boolean)}
      />
    </Marco>
  );
}

/* ──────────────────────────── 7. Despiece ──────────────────────────── */

/** Un color por posición, para que el cuadro y el dibujo se lean juntos. */
const COLOR_POS: Record<string, string> = {
  "①": "#8b1e1e",
  "②": "#b4560f",
  "③": "#1f6b3a",
  "④": "#2f6a8f",
  "⑤": "#6d1f6b",
  "⑥": "#1a4473",
  "⑦": "#5a6b1f",
  "⑧": "#8a5a00",
};

/**
 * Despiece. Las barras no se dibujan «a ojo»: se trazan las polilíneas que
 * calcula `src/lib/engines/muro/despiece.ts`, con sus patas de anclaje y sus
 * dobleces reales, de modo que el plano y el cuadro de despiece no pueden
 * discrepar. Lo único que añade la figura son las cotas y los rótulos.
 */
/** Croquis de forma de una barra, con cada tramo acotado. */
function FormaBarra({
  pieza,
  x,
  y,
  u,
}: {
  pieza: Pieza;
  x: number;
  y: number;
  u: ReturnType<typeof desdeSerial>;
}) {
  const c = COLOR_POS[pieza.pos] ?? INK;
  const Ls = pieza.tramos.map((t) => Math.max(t.L, 0.05));
  const maxL = Math.max(...Ls, 0.3);
  const esc = 52 / maxL;
  let d = `M${x},${y}`;
  let px = x;
  let py = y;
  // L: pata a la izquierda y luego sube. U: baja, corre, sube. Recta: horizontal.
  if (pieza.forma === "L" && Ls.length >= 2) {
    const pata = Ls[0] * esc;
    const alto = Math.min(36, (Ls[Ls.length - 1] ?? Ls[1]) * esc);
    px = x + 8;
    py = y + 28;
    d = `M${px},${py} L${px + pata},${py} L${px + pata},${py - alto}`;
  } else if (pieza.forma === "U" && Ls.length >= 3) {
    const v = Math.min(28, Ls[0] * esc);
    const h = Math.min(48, Ls[1] * esc);
    px = x + 8;
    py = y + 4;
    d = `M${px},${py} L${px},${py + v} L${px + h},${py + v} L${px + h},${py}`;
  } else {
    const h = Math.min(56, Ls[0] * esc);
    px = x + 8;
    py = y + 16;
    d = `M${px},${py} L${px + h},${py}`;
  }
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <text x={x} y={y - 2} fontSize="7.4" fill={c} fontFamily={FONT}>
        {pieza.tramos.map((t) => u.nL(t.L)).join(" + ")}
      </text>
    </g>
  );
}

function Despiece({ a }: { a: Acero }) {
  const u = desdeSerial(a.uni);
  const piezas = a.piezas ?? [];
  const filaH = 54;
  const cuadroH = 36 + piezas.length * filaH;
  const W = 980;
  const gL = 88;
  const gR = 28;
  const gT = 44;
  const gB = 88;
  const una = a.una.prof;
  const sc = pxPorMetro(W - gL - gR, 420, Math.max(a.B, 1.5), a.H + una);
  const Ht = gT + Math.max(a.H + una, 2) * sc + gB + cuadroH + 16;
  const m = trazaMuro(a, { sx: sc, sy: sc, x0: gL, yBot: gT + (a.H + una) * sc });
  const { Y, Z, xP, xSF, xH, yBase, yTop, yBot } = m;
  const conTrazo = piezas.filter((p) => p.pts && p.pts.length >= 2);
  const sinTrazo = piezas.filter((p) => !p.pts || p.pts.length < 2);
  const zCorte = Math.min(a.hf + a.hp, Math.max(a.hf, a.fuste.Lc + a.hf));
  const yCuadro = yBot + (una > 0.01 ? una * sc + 70 : 64);

  /** La marca va en el tramo más largo, no en el gancho: ① y ② compartían la pata. */
  const etiqueta = (pts: [number, number][]) => {
    let best = 0;
    let bi = 1;
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (L > best) {
        best = L;
        bi = i;
      }
    }
    const a = pts[bi - 1];
    const b = pts[bi];
    return { x: Y(a[0] + (b[0] - a[0]) * 0.55), y: Z(a[1] + (b[1] - a[1]) * 0.55) };
  };

  return (
    <Marco
      parte="despiece"
      titulo={`7. Despiece del refuerzo — armado gobernado por el ${a.metodo === "fem" ? "FEM" : "cálculo analítico"}`}
      pie={`Barras trazadas con las polilíneas de E.060 (ℓd, ℓdh, patas de 12db). Escala 1:1. Acero ${a.peso.toFixed(1)} kg/m de muro.`}
      ancho={W}
      alto={Ht}
    >
      <polygon points={m.wall} fill="#f3eddf" stroke={CONC} strokeWidth="1.5" />
      {una > 0.01 ? (
        <polygon
          points={`${Y(a.Ltoe + a.tbase / 2 - a.una.ancho / 2)},${yBot} ${Y(a.Ltoe + a.tbase / 2 + a.una.ancho / 2)},${yBot} ${Y(a.Ltoe + a.tbase / 2 + a.una.ancho / 2)},${yBot + una * sc} ${Y(a.Ltoe + a.tbase / 2 - a.una.ancho / 2)},${yBot + una * sc}`}
          fill="#f3eddf"
          stroke={CONC}
          strokeWidth="1.3"
        />
      ) : null}
      <line x1={xP} y1={yBase} x2={xH} y2={yBase} stroke={CONC} strokeWidth="0.6" strokeDasharray="4,3" />

      {conTrazo.map((p) => {
        const d = p.pts.map((q, i) => `${i === 0 ? "M" : "L"}${Y(q[0]).toFixed(1)},${Z(q[1]).toFixed(1)}`).join(" ");
        const c = COLOR_POS[p.pos] ?? FLEX;
        const mid = etiqueta(p.pts);
        return (
          <g key={p.pos}>
            <path d={d} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={mid.x} cy={mid.y} r="7.2" fill="#fffdf7" stroke={c} strokeWidth="1" />
            <text x={mid.x} y={mid.y + 3.2} textAnchor="middle" fontSize="8.5" fill={c} fontWeight="700" fontFamily={FONT}>
              {p.pos}
            </text>
          </g>
        );
      })}

      {sinTrazo.map((p) => {
        const c = COLOR_POS[p.pos] ?? WATER;
        if (p.el === "Fuste") {
          const n = Math.max(3, Math.min(10, Math.round(a.hp / Math.max(p.s / 100, 0.15) / 3)));
          return (
            <g key={p.pos}>
              {Array.from({ length: n }, (_, i) => {
                const z = a.hf + (a.hp * (i + 0.5)) / n;
                const t = a.tbase + ((a.ttop - a.tbase) * (z - a.hf)) / Math.max(a.hp, 1e-9);
                return (
                  <g key={i}>
                    <circle cx={Y(a.Ltoe + a.recFuste)} cy={Z(z)} r="1.8" fill={c} />
                    <circle cx={Y(a.Ltoe + t - a.recFuste)} cy={Z(z)} r="1.8" fill={c} />
                  </g>
                );
              })}
            </g>
          );
        }
        const n = Math.max(4, Math.min(14, Math.round(a.B / Math.max(p.s / 100, 0.15) / 3)));
        return (
          <g key={p.pos}>
            {Array.from({ length: n }, (_, i) => {
              const x = (a.B * (i + 0.5)) / n;
              return (
                <g key={i}>
                  <circle cx={Y(x)} cy={yBot - a.recZap * sc - 2} r="1.7" fill={c} />
                  <circle cx={Y(x)} cy={yBase + a.recZap * sc + 2} r="1.7" fill={c} />
                </g>
              );
            })}
          </g>
        );
      })}

      {conTrazo[0] && conTrazo[0].pts.length >= 2 ? (
        <Cota
          x1={Y(conTrazo[0].pts[0][0])}
          y1={Z(conTrazo[0].pts[0][1])}
          x2={Y(conTrazo[0].pts[1][0])}
          y2={Z(conTrazo[0].pts[1][1])}
          label={`ℓdh ${u.nL(Math.abs(conTrazo[0].pts[1][0] - conTrazo[0].pts[0][0]))}`}
          lado="abajo"
          dist={una > 0.01 ? una * sc + 26 : 22}
        />
      ) : null}
      <Cota x1={xSF} y1={yBase} x2={xSF} y2={Z(zCorte)} label={`corte ${u.fL(a.fuste.Lc)}`} lado="izq" dist={36} />
      <Cota x1={xP} y1={yBot} x2={xH} y2={yBot} label={`B = ${u.fL(a.B)}`} lado="abajo" dist={una > 0.01 ? una * sc + 54 : 50} />
      <Cota x1={xH} y1={yTop} x2={xH} y2={yBot} label={`H = ${u.fL(a.H)}`} lado="der" dist={24} />

      <EscalaGrafica x={xP} y={18} sc={sc} texto={u.fL(1)} />

      {/* Cuadro: marca, Ø, separación, forma acotada, L de corte. */}
      <rect x={16} y={yCuadro} width={W - 32} height={cuadroH} rx="3" fill="#fffdf7" stroke={INK} strokeWidth="0.8" />
      <text x={28} y={yCuadro + 16} fontSize="10" fill={INK} fontWeight="700" fontFamily={FONT}>
        {`Cuadro de despiece · longitudes en ${u.u.L} · ganchos 90° = 12db · doblado 6db [E.060 7.1 y 7.2]`}
      </text>
      {["Pos", "Ø / sep.", "Elemento", "Forma y tramos", "L corte"].map((h, i) => (
        <text key={h} x={[28, 78, 168, 430, W - 100][i]} y={yCuadro + 32} fontSize="8" fill="#6b5a2e" fontFamily={FONT}>
          {h}
        </text>
      ))}
      {piezas.map((p, i) => {
        const yy = yCuadro + 48 + i * filaH;
        const c = COLOR_POS[p.pos] ?? INK;
        return (
          <g key={p.pos}>
            <line x1={22} y1={yy - 16} x2={W - 22} y2={yy - 16} stroke="#e4d8b8" strokeWidth="0.6" />
            <circle cx={36} cy={yy} r="8" fill="#fffdf7" stroke={c} strokeWidth="1.1" />
            <text x={36} y={yy + 3.4} textAnchor="middle" fontSize="9" fill={c} fontWeight="700" fontFamily={FONT}>{p.pos}</text>
            <text x={78} y={yy + 3} fontSize="9" fill="#2a2418" fontFamily={FONT}>
              {`Ø ${p.bar}${p.s > 0 ? ` @ ${u.fS(p.s)}` : ""}`}
            </text>
            <text x={168} y={yy - 2} fontSize="8.4" fill="#3d3323" fontFamily={FONT}>{p.el}</text>
            <text x={168} y={yy + 11} fontSize="7.6" fill="#6b5a2e" fontFamily={FONT}>
              {p.desc.length > 42 ? `${p.desc.slice(0, 40)}…` : p.desc}
            </text>
            <FormaBarra pieza={p} x={430} y={yy - 8} u={u} />
            <text x={W - 100} y={yy + 3} fontSize="9.5" fill={INK} fontWeight="700" fontFamily={FONT}>{u.nL(p.L)}</text>
          </g>
        );
      })}
    </Marco>
  );
}

/* ─────────────────── 8. Diagramas de esfuerzos del FEM ─────────────────── */

/**
 * Envolvente de momentos y cortantes que devuelve el modelo de elementos
 * finitos, dibujada como diagrama: a la izquierda el fuste (ordenada = cota
 * sobre la zapata) y a la derecha la zapata (abscisa = distancia desde la punta
 * de la puntera). Ambas cajas comparten la escala de esfuerzos, así que las
 * áreas son comparables de un vistazo.
 */
function Esfuerzos({ fem }: { fem: Fem }) {
  const u = desdeSerial(fem.uni);
  const W = 900;
  const Ht = 640;

  const fuste = fem.fuste.filter((c) => !c.stub);
  const zap = fem.zapata;
  const maxM = Math.max(
    1e-6,
    ...fuste.map((c) => Math.max(c.ms, c.mi)),
    ...zap.map((c) => Math.max(c.ms, c.mi)),
  );
  const maxQ = Math.max(1e-6, ...fuste.map((c) => c.q), ...zap.map((c) => c.q));

  /* ── Caja del fuste: z en vertical, esfuerzo en horizontal ── */
  const fx0 = 96;
  const fy0 = 56;
  const fh = 270;
  const fw = 150;
  const zMax = Math.max(...fuste.map((c) => c.z1), 1e-6);
  const Zf = (z: number) => fy0 + fh - (fh * z) / zMax;
  const Mf = (v: number) => fx0 + (fw * v) / maxM;
  const Qf = (v: number) => fx0 + 250 + (fw * v) / maxQ;

  /* ── Caja de la zapata: x en horizontal, esfuerzo en vertical ── */
  const zx0 = 96;
  const zw = W - 2 * 96;
  const zyM = 540;
  const zAlto = 70;
  const Xz = (x: number) => zx0 + (zw * x) / Math.max(fem.B, 1e-6);
  const Mz = (v: number) => zyM - (zAlto * v) / maxM;

  const areaM = (
    cel: { z0: number; z1: number; ms: number; mi: number }[],
    val: (c: { ms: number; mi: number }) => number,
    esc: (v: number) => number,
  ) =>
    `M${fx0},${Zf(0)} ` +
    cel.map((c) => `L${esc(val(c))},${Zf((c.z0 + c.z1) / 2)}`).join(" ") +
    ` L${fx0},${Zf(zMax)} Z`;

  return (
    <Marco
      parte="esfuerzos"
      titulo="8. Diagramas de esfuerzos del modelo de elementos finitos"
      pie={`Envolvente de las combinaciones de rotura, elemento a elemento. Momentos en ${u.u.M} y cortantes en ${u.u.F}, por metro de ancho de muro. M máx = ${u.fM(maxM)} · V máx = ${u.fF(maxQ)}.`}
      ancho={W}
      alto={Ht}
    >
      {/* ── Fuste: momentos ── */}
      <text x={fx0} y={fy0 - 30} fontSize="10.5" fill={INK} fontWeight="700" fontFamily={FONT}>
        Fuste — momento de envolvente
      </text>
      <line x1={fx0} y1={fy0} x2={fx0} y2={fy0 + fh} stroke={INK} strokeWidth="1.4" />
      <line x1={fx0 - 5} y1={fy0 + fh} x2={fx0 + fw + 14} y2={fy0 + fh} stroke={INK} strokeWidth="1" />
      <path d={areaM(fuste, (c) => c.mi, Mf)} fill={FLEX} opacity="0.2" />
      <polyline
        points={fuste.map((c) => `${Mf(c.mi)},${Zf((c.z0 + c.z1) / 2)}`).join(" ")}
        fill="none"
        stroke={FLEX}
        strokeWidth="2"
      />
      <polyline
        points={fuste.map((c) => `${Mf(c.ms)},${Zf((c.z0 + c.z1) / 2)}`).join(" ")}
        fill="none"
        stroke={SEIS}
        strokeWidth="1.5"
        strokeDasharray="6,3"
      />
      <text x={fx0 + 6} y={fy0 + fh + 15} fontSize="8.6" fill={FLEX} fontFamily={FONT}>
        {`cara del relleno · máx ${u.nM(Math.max(...fuste.map((c) => c.mi)))}`}
      </text>
      <text x={fx0 - 8} y={fy0 + 4} textAnchor="end" fontSize="8.6" fill={INK} fontFamily={FONT}>
        {`z = ${u.nL(zMax)}`}
      </text>
      <text x={fx0 - 8} y={fy0 + fh + 4} textAnchor="end" fontSize="8.6" fill={INK} fontFamily={FONT}>
        z = 0
      </text>

      {/* ── Fuste: cortantes ── */}
      <text x={fx0 + 250} y={fy0 - 30} fontSize="10.5" fill={INK} fontWeight="700" fontFamily={FONT}>
        Fuste — cortante de envolvente
      </text>
      <line x1={fx0 + 250} y1={fy0} x2={fx0 + 250} y2={fy0 + fh} stroke={INK} strokeWidth="1.4" />
      <line x1={fx0 + 245} y1={fy0 + fh} x2={fx0 + 250 + fw + 14} y2={fy0 + fh} stroke={INK} strokeWidth="1" />
      <path
        d={`M${fx0 + 250},${Zf(0)} ${fuste.map((c) => `L${Qf(c.q)},${Zf((c.z0 + c.z1) / 2)}`).join(" ")} L${fx0 + 250},${Zf(zMax)} Z`}
        fill={WATER}
        opacity="0.18"
      />
      <polyline
        points={fuste.map((c) => `${Qf(c.q)},${Zf((c.z0 + c.z1) / 2)}`).join(" ")}
        fill="none"
        stroke={WATER}
        strokeWidth="2"
      />
      <text x={fx0 + 256} y={fy0 + fh + 15} fontSize="8.6" fill={WATER} fontFamily={FONT}>
        {`máx ${u.nF(Math.max(...fuste.map((c) => c.q)))} en el arranque`}
      </text>

      <Nota
        x={fx0 + 470}
        y={fy0 - 10}
        size={9}
        lineas={[
          "Trazo continuo: momento de la cara traccionada por el relleno",
          "Trazo a rayas: momento de la cara opuesta (queda en el mínimo)",
          `El momento crece con z³ porque el empuje crece con z: en el`,
          `arranque vale ${u.fM(Math.max(...fuste.map((c) => c.mi)))} y a media altura`,
          `ya ha caído a una fracción, que es lo que permite cortar barras.`,
          `El cortante máximo, ${u.fF(Math.max(...fuste.map((c) => c.q)))}, se verifica a la`,
          "distancia d de la base [E.060 11.1.3.1].",
        ]}
      />

      {/* ── Zapata ── */}
      <text x={zx0} y={zyM - zAlto - 26} fontSize="10.5" fill={INK} fontWeight="700" fontFamily={FONT}>
        Zapata — momento de envolvente a lo largo de B
      </text>
      <line x1={zx0} y1={zyM} x2={zx0 + zw} y2={zyM} stroke={INK} strokeWidth="1.4" />
      <path
        d={`M${Xz(0)},${zyM} ${zap.map((c) => `L${Xz((c.y0 + c.y1) / 2)},${Mz(Math.max(c.ms, c.mi))}`).join(" ")} L${Xz(fem.B)},${zyM} Z`}
        fill={CONC}
        opacity="0.18"
      />
      <polyline
        points={zap.map((c) => `${Xz((c.y0 + c.y1) / 2)},${Mz(c.mi)}`).join(" ")}
        fill="none"
        stroke={FLEX}
        strokeWidth="1.9"
      />
      <polyline
        points={zap.map((c) => `${Xz((c.y0 + c.y1) / 2)},${Mz(c.ms)}`).join(" ")}
        fill="none"
        stroke={CONC}
        strokeWidth="1.9"
        strokeDasharray="6,3"
      />
      {[
        { x: fem.caraPuntera, t: "cara de la puntera" },
        { x: fem.caraTalon, t: "cara del talón" },
      ].map((s, i) => (
        <g key={i}>
          <line x1={Xz(s.x)} y1={zyM - zAlto - 14} x2={Xz(s.x)} y2={zyM + 30} stroke={SOIL} strokeWidth="0.9" strokeDasharray="4,3" />
          <text x={Xz(s.x)} y={zyM + 42} textAnchor="middle" fontSize="8.4" fill={SOIL} fontFamily={FONT}>
            {s.t}
          </text>
        </g>
      ))}
      <text x={zx0 + 6} y={zyM - zAlto - 8} fontSize="8.6" fill={FLEX} fontFamily={FONT}>
        {`malla inferior (continuo) máx ${u.nM(Math.max(...zap.map((c) => c.mi)))} · malla superior (rayas) máx ${u.nM(Math.max(...zap.map((c) => c.ms)))} ${u.u.M}`}
      </text>
      <Cota x1={Xz(0)} y1={zyM + 52} x2={Xz(fem.B)} y2={zyM + 52} label={`B = ${u.fL(fem.B)}`} lado="abajo" dist={16} />
    </Marco>
  );
}

/* ──────────────────────────── Despachador ──────────────────────────── */

export function MuroSostenimientoFig({
  values,
  part,
}: {
  values: Record<string, string>;
  part?: string;
}) {
  const g = leer<Geom>(values, "muroGeom");
  const fem = leer<Fem>(values, "muroFem");
  const acero = leer<Acero>(values, "muroAcero");

  if (part === "empujes" && g) return <Empujes g={g} />;
  if (part === "estabilidad" && g) return <EstabilidadFig g={g} />;
  if (part === "malla" && fem) return <Malla fem={fem} calor={false} />;
  if (part === "calor" && fem) return <Malla fem={fem} calor />;
  if (part === "presiones" && fem) return <Presiones fem={fem} />;
  if (part === "esfuerzos" && fem) return <Esfuerzos fem={fem} />;
  if (part === "despiece" && acero) return <Despiece a={acero} />;
  if (g) return <Esquema g={g} />;

  return (
    <div className="croquis">
      <div className="croquis-head">
        <p>Muro de sostenimiento en voladizo</p>
      </div>
      <p className="croquis-cap">
        Introduce la geometría y el perfil geotécnico y pulsa calcular: las figuras se dibujan con los resultados de la corrida.
      </p>
    </div>
  );
}
