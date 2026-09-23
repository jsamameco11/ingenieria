import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fmtM, nearestEdge, pointAlong, pointInPoly, type V2 } from "../lib/lotizacion/geom";
import { puntosSvg, svgDeTrazos, cajaModelo } from "../lib/lotizacion/dibujo";
import type { Modelo, Trazo } from "../lib/lotizacion/tipos";

type Vista = { minE: number; minN: number; w: number; h: number };

type Props = {
  modelo: Modelo;
  trazos: Trazo[];
  arista: number;
  borrador: { arista: number; distancia: number; ancho: number } | null;
  emitir: boolean;
  viaSel?: string;
  onVia?: (id: string) => void;
  onMundo: (p: { e: number; n: number }) => void;
};

function encuadre(m: Modelo): Vista {
  const c = cajaModelo(m);
  const pad = Math.max(c.w, c.h, 20) * 0.1;
  return { minE: c.minX - pad, minN: c.minY - pad, w: c.w + pad * 2, h: c.h + pad * 2 };
}

export function LotizacionPlano({ modelo, trazos, arista, borrador, emitir, viaSel, onVia, onMundo }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const nVerts = modelo.lindero.length;
  const fit = useMemo(() => encuadre(modelo), [modelo]);
  const view = vista ?? fit;

  useEffect(() => {
    setVista(null);
  }, [nVerts]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(ctm.inverse());
      const este = p.x;
      const norte = -p.y;
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      setVista((cur) => {
        const base = cur ?? encuadre(modelo);
        const w2 = Math.min(base.w * 40, Math.max(base.w * 0.02, base.w * factor));
        const h2 = base.h * (w2 / base.w);
        const rx = (este - base.minE) / base.w;
        const ry = (norte - base.minN) / base.h;
        return { w: w2, h: h2, minE: este - rx * w2, minN: norte - ry * h2 };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [modelo]);

  const mundo = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { e: p.x, n: -p.y };
  };

  const vb = `${view.minE} ${-(view.minN + view.h)} ${view.w} ${view.h}`;
  const sw = view.w / 520;
  const nice = [5, 10, 20, 25, 50, 100, 200, 500, 1000].find((n) => n >= view.w / 5) ?? 2000;
  const sx = view.minE + view.w * 0.05;
  const sy = view.minN + view.h * 0.07;
  const nx = view.minE + view.w * 0.9;
  const ny = view.minN + view.h * 0.86;
  const na = view.h * 0.045;
  const borde = modelo.lindero;
  const aristaPts =
    arista >= 0 && borde.length > arista
      ? [borde[arista], borde[(arista + 1) % borde.length]]
      : null;
  const ghost = borrador && borde.length > borrador.arista ? pointAlong(borde, borrador.arista, borrador.distancia) : null;

  return (
    <div className="lz-board">
      <svg
        ref={svgRef}
        className="lz-svg"
        viewBox={vb}
        onPointerDown={(e) => {
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.hypot(dx, dy) > 4) d.moved = true;
          if (!d.moved) return;
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const wx = (dx / rect.width) * view.w;
          const wy = (dy / rect.height) * view.h;
          d.x = e.clientX;
          d.y = e.clientY;
          setVista((cur) => {
            const base = cur ?? fit;
            return { ...base, minE: base.minE - wx, minN: base.minN + wy };
          });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.moved) return;
          const p = mundo(e);
          if (!p) return;
          if (onVia) {
            const via = (modelo.viasInternas ?? []).find((v) => pointInPoly({ x: p.e, y: p.n }, v.hit));
            if (via) {
              onVia(via.id);
              return;
            }
          }
          onMundo(p);
        }}
      >
        <rect x={view.minE} y={-(view.minN + view.h)} width={view.w} height={view.h} fill="#f7f4ee" />
        <g dangerouslySetInnerHTML={{ __html: svgDeTrazos(trazos) }} />
        {(modelo.viasInternas ?? []).filter((v) => v.id === viaSel).map((v) => (
          <polygon key={v.id} points={puntosSvg(v.hit)} fill="rgba(138,106,50,0.18)" stroke="#8a6a32" strokeWidth={sw * 1.6} />
        ))}
        {aristaPts ? (
          <polyline
            points={puntosSvg(aristaPts)}
            fill="none"
            stroke="#8a6a32"
            strokeWidth={sw * 3.2}
            strokeLinecap="round"
          />
        ) : null}
        {ghost && borrador ? (
          <g>
            <circle cx={ghost.pt.x} cy={-ghost.pt.y} r={sw * 4} fill="#8a6a32" />
            <text x={ghost.pt.x} y={-ghost.pt.y - sw * 8} textAnchor="middle" fontSize={sw * 14} fill="#8a6a32" fontFamily="Arial, sans-serif">
              {fmtM(borrador.distancia, 2)} m
            </text>
          </g>
        ) : null}
        <g>
          <line x1={sx} y1={-sy} x2={sx + nice} y2={-sy} stroke="#1a1a1a" strokeWidth={sw * 1.4} />
          <line x1={sx} y1={-sy - sw * 3} x2={sx} y2={-sy + sw * 3} stroke="#1a1a1a" strokeWidth={sw} />
          <line x1={sx + nice} y1={-sy - sw * 3} x2={sx + nice} y2={-sy + sw * 3} stroke="#1a1a1a" strokeWidth={sw} />
          <text x={sx + nice / 2} y={-sy - sw * 6} textAnchor="middle" fontSize={sw * 12} fill="#1a1a1a" fontFamily="Arial, sans-serif">
            {nice} m
          </text>
        </g>
        <g>
          <polygon points={`${nx},${-(ny + na)} ${nx - na * 0.38},${-ny} ${nx + na * 0.38},${-ny}`} fill="#1a1a1a" />
          <text x={nx} y={-(ny + na * 1.35)} textAnchor="middle" fontSize={na * 0.7} fill="#1a1a1a" fontFamily="Arial, sans-serif">
            N
          </text>
        </g>
        {!emitir && borde.length >= 3 ? (
          <text
            x={view.minE + view.w / 2}
            y={-(view.minN + view.h / 2)}
            textAnchor="middle"
            fontSize={view.w / 18}
            fill="#1a1a1a"
            opacity={0.13}
            fontFamily="Arial, sans-serif"
          >
            PREVISUALIZACIÓN
          </text>
        ) : null}
      </svg>
      {borde.length < 3 ? <p className="lz-empty">Cargue o digite el perímetro para ver la planta.</p> : null}
      <div className="lz-float">
        <button type="button" className="btn secondary" onClick={() => setVista(null)}>
          Encuadrar
        </button>
        <span>{borde.length >= 3 ? `${fmtM(modelo.areaBruta, 0)} m² · ${fmtM(modelo.perimetro, 1)} m` : "Sin perímetro"}</span>
      </div>
    </div>
  );
}

export function aristaCercana(poly: V2[], e: number, n: number) {
  if (poly.length < 2) return null;
  const hit = nearestEdge(poly, { x: e, y: n });
  return { edge: hit.edge, along: hit.along, len: hit.len, distM: hit.distM };
}
