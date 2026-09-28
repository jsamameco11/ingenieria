import { useId } from "react";
import { barByName } from "../lib/types";

const LONG = "#9a2b1f";
const EST = "#1d4e89";
const INK = "#163a63";
const PAPER = "#f4efe4";

const BARRAS = ['1 3/8"', '1 1/2"', '1 1/4"', '3/4"', '5/8"', '1/2"', '3/8"', '1"'];

export type JaulaKind = "viga" | "circulo" | "malla";

export type JaulaProps = {
  titulo: string;
  kind: JaulaKind;
  /** Ancho de viga o espesor de muro/losa, en cm. */
  bCm?: number;
  /** Peralte de viga, en cm. */
  hCm?: number;
  /** Diámetro de columna, en cm. */
  dCm?: number;
  recCm?: number;
  /** Longitudinales: "10 Ø 3/4\" (5 sup. + 5 inf.)" o "Ø 1/2\" @ 20 cm". */
  longText: string;
  /** Otra cara, si el lecho superior no es igual al inferior. */
  supText?: string;
  /** Estribo o acero transversal: "estribos Ø 3/8\" @ 15 cm" o "Ø 1/2\" @ 20 cm". */
  estText?: string;
  nombreLong?: string;
  nombreTrans?: string;
};

type Lecho = { n: number; barra: string; s: number; nSup: number; nInf: number };

function barraDe(text: string) {
  for (const k of BARRAS) if (text.includes(k)) return k;
  return '1/2"';
}

function numDe(text: string, re: RegExp, fb: number) {
  const m = text.match(re);
  return m ? Number(m[1]) : fb;
}

function leerLecho(text: string, fbN = 6): Lecho {
  const barra = barraDe(text);
  const s = numDe(text, /@\s*(\d+(?:[.,]\d+)?)/, 0);
  const nTxt = numDe(text, /(\d+)\s*Ø/, 0);
  const nSupTxt = numDe(text, /(\d+)\s*sup/i, 0);
  const nInfTxt = numDe(text, /(\d+)\s*inf/i, 0);
  let n = nTxt;
  if (!n && s > 0) n = Math.max(2, Math.round(100 / s));
  if (!n) n = fbN;
  let nSup = nSupTxt;
  let nInf = nInfTxt;
  if (!nSup && !nInf) {
    nSup = Math.floor(n / 2);
    nInf = n - nSup;
  } else if (!nSup) nSup = Math.max(0, n - nInf);
  else if (!nInf) nInf = Math.max(0, n - nSup);
  if (nSup + nInf !== n && nSupTxt && nInfTxt) n = nSup + nInf;
  return { n, barra, s, nSup, nInf };
}

function leerEstribo(text: string | undefined) {
  const raw = text || 'Ø 3/8" @ 15';
  return { barra: barraDe(raw), s: numDe(raw, /@\s*(\d+(?:[.,]\d+)?)/, 15) };
}

function rBar(db: number, sc: number) {
  return Math.max(3.1, Math.min(8.5, (db * sc) / 2));
}

function ptsLine(x0: number, x1: number, y: number, n: number) {
  if (n <= 0) return [];
  if (n === 1) return [{ x: (x0 + x1) / 2, y }];
  return Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y }));
}

function Barra({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x + 0.4} cy={y + 0.5} r={r + 0.4} fill="#1a0c0c" opacity="0.16" />
      <circle cx={x} cy={y} r={r} fill={LONG} stroke="#2a0c08" strokeWidth="0.7" />
      <circle cx={x - r * 0.22} cy={y - r * 0.28} r={Math.max(0.6, r * 0.22)} fill="#f6e7d4" opacity="0.9" />
    </g>
  );
}

function Estribo({ d, sw = 2.3 }: { d: string; sw?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="#0c1c33" strokeWidth={sw + 0.8} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={EST} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

function estriboRect(x0: number, y0: number, x1: number, y1: number, gancho: number) {
  const g = Math.min(gancho, (x1 - x0) * 0.32, (y1 - y0) * 0.28);
  return `M ${x1 - g} ${y0 + g} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} L ${x0} ${y0} L ${x1} ${y0} L ${x1 - g * 0.55} ${y0 + g}`;
}

function cota(x1: number, y1: number, x2: number, y2: number, label: string) {
  const vert = Math.abs(x2 - x1) < Math.abs(y2 - y1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="1.05" />
      <line x1={x1 - (vert ? 4 : 0)} y1={y1 - (vert ? 0 : 4)} x2={x1 + (vert ? 4 : 0)} y2={y1 + (vert ? 0 : 4)} stroke={INK} strokeWidth="1.05" />
      <line x1={x2 - (vert ? 4 : 0)} y1={y2 - (vert ? 0 : 4)} x2={x2 + (vert ? 4 : 0)} y2={y2 + (vert ? 0 : 4)} stroke={INK} strokeWidth="1.05" />
      <text
        x={vert ? x1 - 8 : mx}
        y={vert ? my : y2 + 14}
        textAnchor={vert ? "end" : "middle"}
        fontSize="11"
        fill={INK}
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

function marco(x: number, y: number, w: number, h: number, titulo: string) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fbf7ef" stroke={INK} strokeWidth="1.2" />
      <rect x={x} y={y} width={w} height="22" fill={INK} />
      <text x={x + 12} y={y + 15} fill="#f4efe4" fontSize="11" fontFamily="IBM Plex Sans, sans-serif" fontWeight="700">
        {titulo}
      </text>
    </g>
  );
}

function CorteViga({
  ox, oy, b, h, rec, lecho, est, ganchoDb,
}: {
  ox: number; oy: number; b: number; h: number; rec: number; lecho: Lecho; est: { barra: string; s: number }; ganchoDb: number;
}) {
  const sc = Math.min(200 / Math.max(b, 20), 210 / Math.max(h, 20), 5.4);
  const w = b * sc;
  const ht = h * sc;
  const x = ox + (500 - w) / 2;
  const y = oy + 36 + (230 - ht) / 2;
  const recPx = Math.min(rec * sc, Math.min(w, ht) * 0.22);
  const dbE = barByName(est.barra).db;
  const dbL = barByName(lecho.barra).db;
  const rE = Math.max(1.3, (dbE * sc) / 2);
  const rL = rBar(dbL, sc);
  const x0 = x + recPx + rE;
  const y0 = y + recPx + rE;
  const x1 = x + w - recPx - rE;
  const y1 = y + ht - recPx - rE;
  const inset = rE + rL + 1.2;
  const sup = ptsLine(x0 + inset, x1 - inset, y0 + inset, lecho.nSup);
  const inf = ptsLine(x0 + inset, x1 - inset, y1 - inset, lecho.nInf);
  const gancho = Math.max(12, 6 * ganchoDb * sc);
  return (
    <g>
      <rect x={x} y={y} width={w} height={ht} fill="#e7dcc4" stroke={INK} strokeWidth="1.6" />
      <rect x={x + recPx} y={y + recPx} width={w - 2 * recPx} height={ht - 2 * recPx} fill="none" stroke="#7a6240" strokeDasharray="5 3" strokeWidth="0.9" />
      <Estribo d={estriboRect(x0, y0, x1, y1, gancho)} />
      {sup.map((p, i) => <Barra key={`s${i}`} x={p.x} y={p.y} r={rL} />)}
      {inf.map((p, i) => <Barra key={`i${i}`} x={p.x} y={p.y} r={rL} />)}
      {cota(x, y + ht + 16, x + w, y + ht + 16, `b = ${b.toFixed(0)} cm`)}
      {cota(x - 28, y, x - 28, y + ht, `h = ${h.toFixed(0)} cm`)}
      <text x={x + w / 2} y={y + ht + 48} textAnchor="middle" fontSize="12" fill={LONG} fontFamily="IBM Plex Sans, sans-serif" fontWeight="650">
        {lecho.nSup} sup. + {lecho.nInf} inf. · Ø {lecho.barra}
      </text>
      <text x={x + w / 2} y={y + ht + 64} textAnchor="middle" fontSize="12" fill={EST} fontFamily="IBM Plex Sans, sans-serif" fontWeight="650">
        estribo Ø {est.barra} @ {est.s.toFixed(0)} cm
      </text>
    </g>
  );
}

function ElevViga({
  ox, oy, h, rec, lecho, est,
}: {
  ox: number; oy: number; h: number; rec: number; lecho: Lecho; est: { barra: string; s: number };
}) {
  const tramos = 4;
  const largo = est.s * tramos;
  const scx = 340 / largo;
  const scy = Math.min(200 / Math.max(h, 20), 4.2);
  const w = largo * scx;
  const ht = h * scy;
  const x = ox + Math.max(24, (500 - w) / 2);
  const y = oy + 48;
  const recPx = Math.min(rec * scy, ht * 0.2);
  const ySup = y + recPx + 8;
  const yInf = y + ht - recPx - 8;
  const ties = Array.from({ length: tramos + 1 }, (_, i) => x + 16 + i * est.s * scx);
  return (
    <g>
      <rect x={x} y={y} width={w} height={ht} fill="#e7dcc4" stroke={INK} strokeWidth="1.6" />
      {ties.map((tx, i) => (
        <Estribo key={i} sw={1.8} d={`M ${tx - 7} ${y + recPx + 7} L ${tx} ${y + recPx} L ${tx} ${y + ht - recPx} L ${tx + 7} ${y + ht - recPx - 7}`} />
      ))}
      <line x1={x + 8} y1={ySup} x2={x + w - 8} y2={ySup} stroke={LONG} strokeWidth="3.2" strokeLinecap="round" />
      <line x1={x + 8} y1={yInf} x2={x + w - 8} y2={yInf} stroke={LONG} strokeWidth="3.2" strokeLinecap="round" />
      <line x1={x + 8} y1={ySup + 5} x2={x + w - 8} y2={ySup + 5} stroke={LONG} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      <line x1={x + 8} y1={yInf - 5} x2={x + w - 8} y2={yInf - 5} stroke={LONG} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      {cota(ties[0], y + ht + 16, ties[1], y + ht + 16, `@ ${est.s.toFixed(0)} cm`)}
      <text x={x + 8} y={ySup - 8} fontSize="11" fill={LONG} fontFamily="IBM Plex Sans, sans-serif">{lecho.nSup} Ø {lecho.barra} sup.</text>
      <text x={x + 8} y={yInf + 16} fontSize="11" fill={LONG} fontFamily="IBM Plex Sans, sans-serif">{lecho.nInf} Ø {lecho.barra} inf.</text>
      <text x={x + w - 4} y={y + 16} textAnchor="end" fontSize="11" fill={EST} fontFamily="IBM Plex Sans, sans-serif">estribos</text>
    </g>
  );
}

function CorteCirculo({
  ox, oy, d, rec, lecho, est,
}: {
  ox: number; oy: number; d: number; rec: number; lecho: Lecho; est: { barra: string; s: number };
}) {
  const sc = Math.min(210 / d, 4.6);
  const r = (d / 2) * sc;
  const cx = ox + 264;
  const cy = oy + 150;
  const recPx = rec * sc;
  const dbE = barByName(est.barra).db;
  const dbL = barByName(lecho.barra).db;
  const rEst = r - recPx - (dbE * sc) / 2;
  const rLong = rEst - rBar(dbL, sc) - 1.5;
  const n = Math.max(4, lecho.n);
  const bars = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + rLong * Math.cos(a), y: cy + rLong * Math.sin(a) };
  });
  const arco = Array.from({ length: 40 }, (_, i) => {
    const a = (2 * Math.PI * i) / 39 - Math.PI / 2;
    return `${i === 0 ? "M" : "L"} ${(cx + rEst * Math.cos(a)).toFixed(1)} ${(cy + rEst * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const gancho = Math.max(10, 6 * dbE * sc);
  const hx = cx + rEst;
  const hy = cy - rEst * 0.15;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#e7dcc4" stroke={INK} strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={r - recPx} fill="none" stroke="#7a6240" strokeDasharray="5 3" strokeWidth="0.9" />
      <Estribo d={`${arco} L ${hx - gancho * 0.6} ${hy + gancho}`} />
      {bars.map((p, i) => <Barra key={i} x={p.x} y={p.y} r={rBar(dbL, sc)} />)}
      {cota(cx - r, cy + r + 18, cx + r, cy + r + 18, `Ø = ${d.toFixed(0)} cm`)}
      <text x={cx} y={cy + r + 48} textAnchor="middle" fontSize="12" fill={LONG} fontFamily="IBM Plex Sans, sans-serif" fontWeight="650">
        {n} Ø {lecho.barra}
      </text>
      <text x={cx} y={cy + r + 64} textAnchor="middle" fontSize="12" fill={EST} fontFamily="IBM Plex Sans, sans-serif" fontWeight="650">
        estribo Ø {est.barra} @ {est.s.toFixed(0)} cm
      </text>
    </g>
  );
}

function ElevCirculo({
  ox, oy, d, rec, lecho, est,
}: {
  ox: number; oy: number; d: number; rec: number; lecho: Lecho; est: { barra: string; s: number };
}) {
  const tramos = 4;
  const alto = est.s * tramos;
  const scx = Math.min(120 / d, 2.4);
  const scy = 280 / alto;
  const w = d * scx;
  const ht = alto * scy;
  const x = ox + 90;
  const y = oy + 36;
  const recPx = Math.min(rec * scx, w * 0.18);
  const ties = Array.from({ length: tramos + 1 }, (_, i) => y + 10 + i * est.s * scy);
  return (
    <g>
      <rect x={x} y={y} width={w} height={ht} fill="#e7dcc4" stroke={INK} strokeWidth="1.6" />
      <line x1={x + recPx + 4} y1={y + 6} x2={x + recPx + 4} y2={y + ht - 6} stroke={LONG} strokeWidth="3" />
      <line x1={x + w - recPx - 4} y1={y + 6} x2={x + w - recPx - 4} y2={y + ht - 6} stroke={LONG} strokeWidth="3" />
      {ties.map((ty, i) => (
        <Estribo key={i} sw={1.7} d={`M ${x + recPx} ${ty} L ${x + w - recPx} ${ty}`} />
      ))}
      {cota(x + w + 16, ties[0], x + w + 16, ties[1], `@ ${est.s.toFixed(0)}`)}
      <text x={x + w / 2} y={y + ht + 22} textAnchor="middle" fontSize="12" fill={LONG} fontFamily="IBM Plex Sans, sans-serif">
        {lecho.n} Ø {lecho.barra}
      </text>
      <text x={x + w / 2} y={y + ht + 38} textAnchor="middle" fontSize="12" fill={EST} fontFamily="IBM Plex Sans, sans-serif">
        estribos Ø {est.barra}
      </text>
    </g>
  );
}

function CorteMalla({
  ox, oy, e, rec, a, b, trans,
}: {
  ox: number; oy: number; e: number; rec: number;
  a: Lecho; b: Lecho; trans: Lecho;
}) {
  const L = 100;
  const scx = 300 / L;
  const scy = Math.min(150 / Math.max(e, 12), 4.4);
  const w = L * scx;
  const ht = Math.max(e * scy, 46);
  const x = ox + 36;
  const y = oy + 70;
  const recPx = Math.min(rec * scy, ht * 0.22);
  const rA = rBar(barByName(a.barra).db, Math.max(scy, 2.4));
  const rB = rBar(barByName(b.barra).db, Math.max(scy, 2.4));
  const sA = a.s > 0 ? a.s : 20;
  const n = Math.max(2, Math.min(12, Math.round(L / sA)));
  const paso = w / n;
  const caraA = Array.from({ length: n }, (_, i) => x + paso * (i + 0.5));
  const yA = y + ht - recPx - rA;
  const yB = y + recPx + rB;
  return (
    <g>
      <rect x={x} y={y} width={w} height={ht} fill="#e7dcc4" stroke={INK} strokeWidth="1.6" />
      <line x1={x + 6} y1={yB + rB + 2} x2={x + w - 6} y2={yB + rB + 2} stroke={EST} strokeWidth="2.4" />
      <line x1={x + 6} y1={yA - rA - 2} x2={x + w - 6} y2={yA - rA - 2} stroke={EST} strokeWidth="2.4" />
      {caraA.map((cx, i) => (
        <g key={i}>
          <Barra x={cx} y={yA} r={rA} />
          <Barra x={cx} y={yB} r={rB} />
        </g>
      ))}
      {cota(x, y + ht + 18, x + w, y + ht + 18, "1,00 m")}
      {cota(x - 26, y, x - 26, y + ht, `e = ${e.toFixed(0)} cm`)}
      <text x={x} y={y - 28} fontSize="12" fill={LONG} fontFamily="IBM Plex Sans, sans-serif">
        longitudinal Ø {a.barra} @ {sA.toFixed(0)} cm · 2 caras
      </text>
      <text x={x} y={y - 12} fontSize="12" fill={EST} fontFamily="IBM Plex Sans, sans-serif">
        transversal Ø {trans.barra} @ {(trans.s || sA).toFixed(0)} cm · 2 caras
      </text>
    </g>
  );
}

function ElevMalla({
  ox, oy, a, trans,
}: {
  ox: number; oy: number; a: Lecho; trans: Lecho;
}) {
  const sV = a.s > 0 ? a.s : 20;
  const sH = trans.s > 0 ? trans.s : sV;
  const ancho = 100;
  const alto = Math.max(sH * 4, 80);
  const scx = 320 / ancho;
  const scy = 240 / alto;
  const w = ancho * scx;
  const ht = alto * scy;
  const x = ox + 40;
  const y = oy + 46;
  const nV = Math.max(2, Math.round(ancho / sV));
  const nH = Math.max(2, Math.round(alto / sH));
  const vx = Array.from({ length: nV + 1 }, (_, i) => x + (i * ancho * scx) / nV);
  const hy = Array.from({ length: nH + 1 }, (_, i) => y + (i * alto * scy) / nH);
  return (
    <g>
      <rect x={x} y={y} width={w} height={ht} fill="#f3ead6" stroke={INK} strokeWidth="1.3" />
      {hy.map((yy, i) => (
        <line key={`h${i}`} x1={x} y1={yy} x2={x + w} y2={yy} stroke={EST} strokeWidth="2.1" />
      ))}
      {vx.map((xx, i) => (
        <line key={`v${i}`} x1={xx} y1={y} x2={xx} y2={y + ht} stroke={LONG} strokeWidth="2.1" />
      ))}
      {cota(vx[0], y + ht + 16, vx[1], y + ht + 16, `@ ${sV.toFixed(0)}`)}
      {cota(x + w + 18, hy[0], x + w + 18, hy[1], `@ ${sH.toFixed(0)}`)}
      <text x={x} y={y + ht + 42} fontSize="12" fill={LONG} fontFamily="IBM Plex Sans, sans-serif">vertical Ø {a.barra}</text>
      <text x={x + w} y={y + ht + 42} textAnchor="end" fontSize="12" fill={EST} fontFamily="IBM Plex Sans, sans-serif">horizontal Ø {trans.barra}</text>
    </g>
  );
}

export function AceroJaulaFig(props: JaulaProps) {
  const uid = useId().replace(/:/g, "");
  const rec = props.recCm ?? 4;
  const lecho = leerLecho(props.longText);
  const caraSup = leerLecho(props.supText || props.longText, lecho.n);
  const est = leerEstribo(props.estText);
  const mallaTrans = leerLecho(props.estText || props.longText, 0);
  if (!mallaTrans.s) mallaTrans.s = est.s;
  const W = 560;
  const H = 860;
  const tituloCorte = props.kind === "malla" ? "CORTE — longitudinal cortado, transversal de canto" : "CORTE — longitudinal y estribo";
  const tituloElev = props.kind === "malla" ? "ELEVACIÓN — malla de las dos direcciones" : "ELEVACIÓN — estribos al paso de cálculo";
  return (
    <div className="croquis croquis-steel croquis-jaula" data-fig-part="acero-jaula">
      <div className="croquis-head">
        <p>{props.titulo}</p>
      </div>
      <div className="croquis-stage">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id={`jaula-h-${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#c4b48a" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={PAPER} />
          <rect x="8" y="8" width={W - 16} height={H - 16} fill="none" stroke={INK} strokeWidth="1.3" />
          {marco(16, 16, 528, 390, tituloCorte)}
          {marco(16, 418, 528, 390, tituloElev)}
          {props.kind === "viga" ? (
            <>
              <CorteViga ox={20} oy={18} b={props.bCm ?? 40} h={props.hCm ?? 50} rec={rec} lecho={lecho} est={est} ganchoDb={barByName(est.barra).db} />
              <ElevViga ox={16} oy={418} h={props.hCm ?? 50} rec={rec} lecho={lecho} est={est} />
            </>
          ) : null}
          {props.kind === "circulo" ? (
            <>
              <CorteCirculo ox={20} oy={18} d={props.dCm ?? 50} rec={rec} lecho={lecho} est={est} />
              <ElevCirculo ox={16} oy={418} d={props.dCm ?? 50} rec={rec} lecho={lecho} est={est} />
            </>
          ) : null}
          {props.kind === "malla" ? (
            <>
              <CorteMalla ox={20} oy={18} e={props.bCm ?? 25} rec={rec} a={lecho} b={caraSup} trans={mallaTrans} />
              <ElevMalla ox={16} oy={418} a={lecho} trans={mallaTrans} />
            </>
          ) : null}
          <circle cx="28" cy="828" r="5" fill={LONG} />
          <text x="40" y="832" fontSize="11" fill={INK} fontFamily="IBM Plex Sans, sans-serif">{props.nombreLong ?? "Longitudinal"}</text>
          <line x1="200" y1="828" x2="226" y2="828" stroke={EST} strokeWidth="3" />
          <text x="234" y="832" fontSize="11" fill={INK} fontFamily="IBM Plex Sans, sans-serif">{props.nombreTrans ?? (props.kind === "malla" ? "Transversal" : "Estribo")}</text>
        </svg>
      </div>
    </div>
  );
}
