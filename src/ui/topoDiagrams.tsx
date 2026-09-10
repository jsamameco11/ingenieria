import type { PuntoTopo, TopoResult } from "../lib/topo/taquimetria";
import { fmt } from "../lib/num";

const ink = "#0b1f33";
const brass = "#8a6a32";
const paper = "#f7f1e4";
const est = "#8b1e1e";
const vis = "#1f4e79";

function niceStep(span: number) {
  if (!(span > 0)) return 10;
  const e = Math.pow(10, Math.floor(Math.log10(span)));
  const m = span / e;
  if (m <= 1.5) return e / 2;
  if (m <= 3) return e;
  if (m <= 7) return 2 * e;
  return 5 * e;
}

export function TopoPlanSvg({ r }: { r: TopoResult }) {
  const pts = r.puntos.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const nodes: { x: number; y: number; name: string; kind: "est" | "pt" }[] = [
    ...r.estaciones.map((e) => ({ x: e.x, y: e.y, name: e.nombre, kind: "est" as const })),
    ...pts.map((p) => ({ x: p.x, y: p.y, name: p.pv, kind: p.esEstacion ? ("est" as const) : ("pt" as const) })),
  ];
  if (!nodes.length) {
    return (
      <div className="diagram">
        <svg viewBox="0 0 520 280">
          <text x="20" y="40" fill={brass} fontSize="13">
            Sin puntos para dibujar el plano.
          </text>
        </svg>
      </div>
    );
  }
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(8, maxX - minX);
  const spanY = Math.max(8, maxY - minY);
  const pad = 48;
  const W = 560;
  const H = 420;
  const s = Math.min((W - 2 * pad) / spanX, (H - 2 * pad - 16) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const X = (x: number) => W / 2 + (x - cx) * s;
  const Y = (y: number) => H / 2 - 8 - (y - cy) * s;
  const step = niceStep(Math.max(spanX, spanY) / 4);
  const gx0 = Math.floor(minX / step) * step;
  const gy0 = Math.floor(minY / step) * step;
  const grid: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = gx0; x <= maxX + step * 0.01; x += step) grid.push({ x1: x, y1: minY, x2: x, y2: maxY });
  for (let y = gy0; y <= maxY + step * 0.01; y += step) grid.push({ x1: minX, y1: y, x2: maxX, y2: y });

  const rays: { a: PuntoTopo; ex: number; ey: number }[] = [];
  for (const p of pts) {
    const e = r.estaciones.find((st) => st.nombre === p.est);
    if (e) rays.push({ a: p, ex: e.x, ey: e.y });
  }

  const barM = step;
  const barW = barM * s;

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect x="0" y="0" width={W} height={H} fill={paper} />
        <text x="16" y="22" fill={ink} fontSize="12.5" fontFamily="IBM Plex Sans" fontWeight="600">
          Plano local — radiación taquimétrica
        </text>
        <text x="16" y="38" fill={brass} fontSize="10.5" fontFamily="IBM Plex Sans">
          X este · Y norte · Az desde el norte, horario
        </text>
        {grid.map((g, i) => (
          <line key={i} x1={X(g.x1)} y1={Y(g.y1)} x2={X(g.x2)} y2={Y(g.y2)} stroke="#e4dccb" strokeWidth="0.8" />
        ))}
        {rays.map((ray, i) => (
          <line
            key={`r${i}`}
            x1={X(ray.ex)}
            y1={Y(ray.ey)}
            x2={X(ray.a.x)}
            y2={Y(ray.a.y)}
            stroke="#b7c4b0"
            strokeWidth="0.9"
            strokeDasharray="3 3"
          />
        ))}
        {pts.map((p) => (
          <g key={p.id}>
            <circle cx={X(p.x)} cy={Y(p.y)} r={p.esEstacion ? 4.5 : 3.2} fill={p.esEstacion ? est : vis} />
            <text x={X(p.x) + 6} y={Y(p.y) - 6} fontSize="9" fill={ink} fontFamily="IBM Plex Sans">
              {p.pv}
            </text>
          </g>
        ))}
        {r.estaciones.map((e) => {
          const x = X(e.x);
          const y = Y(e.y);
          return (
            <g key={`e-${e.nombre}`}>
              <polygon points={`${x},${y - 8} ${x + 7},${y + 5} ${x - 7},${y + 5}`} fill={est} />
              <text x={x + 8} y={y + 14} fontSize="10" fontWeight="700" fill={est} fontFamily="IBM Plex Sans">
                {e.nombre}
              </text>
            </g>
          );
        })}
        <polygon points="520,48 526,68 514,68" fill={ink} />
        <line x1="520" y1="68" x2="520" y2="92" stroke={ink} strokeWidth="1.4" />
        <text x="520" y="42" textAnchor="middle" fontSize="10" fill={ink} fontFamily="IBM Plex Sans">
          N
        </text>
        <line x1="16" y1={H - 22} x2={16 + barW} y2={H - 22} stroke={ink} strokeWidth="2" />
        <line x1="16" y1={H - 26} x2="16" y2={H - 18} stroke={ink} />
        <line x1={16 + barW} y1={H - 26} x2={16 + barW} y2={H - 18} stroke={ink} />
        <text x={16 + barW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          {fmt(barM, 0)} m
        </text>
      </svg>
    </div>
  );
}

export function TopoPerfilSvg({ r }: { r: TopoResult }) {
  const perfil = r.perfil;
  if (perfil.length < 2) {
    return (
      <div className="diagram">
        <svg viewBox="0 0 560 260">
          <text x="20" y="40" fill={brass} fontSize="13">
            Se necesitan al menos dos cotas de eje para el perfil.
          </text>
        </svg>
      </div>
    );
  }
  const W = 560;
  const H = 280;
  const padL = 54;
  const padR = 20;
  const padT = 36;
  const padB = 40;
  const pk0 = Math.min(...perfil.map((p) => p.pk));
  const pk1 = Math.max(...perfil.map((p) => p.pk));
  const z0 = Math.min(...perfil.map((p) => p.z));
  const z1 = Math.max(...perfil.map((p) => p.z));
  const spanPk = Math.max(1, pk1 - pk0);
  const spanZ = Math.max(1, z1 - z0);
  const X = (pk: number) => padL + ((pk - pk0) / spanPk) * (W - padL - padR);
  const Y = (z: number) => padT + (1 - (z - z0) / spanZ) * (H - padT - padB);
  const d = perfil.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.pk)},${Y(p.z)}`).join(" ");
  const ground = `${d} L${X(perfil[perfil.length - 1].pk)},${H - padB} L${X(perfil[0].pk)},${H - padB} Z`;

  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect x="0" y="0" width={W} height={H} fill={paper} />
        <text x="16" y="22" fill={ink} fontSize="12.5" fontFamily="IBM Plex Sans" fontWeight="600">
          Perfil longitudinal del eje
        </text>
        <path d={ground} fill="#e8dfcc" />
        <path d={d} fill="none" stroke={est} strokeWidth="2" />
        {perfil.map((p) => (
          <g key={p.nombre + p.pk}>
            <circle cx={X(p.pk)} cy={Y(p.z)} r="3" fill={vis} />
            <text x={X(p.pk)} y={H - 14} textAnchor="middle" fontSize="8.5" fill={brass} fontFamily="IBM Plex Sans">
              {p.nombre}
            </text>
          </g>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={ink} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={ink} />
        <text x="8" y={Y(z1) + 4} fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          {fmt(z1, 1)}
        </text>
        <text x="8" y={Y(z0) + 4} fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          {fmt(z0, 1)}
        </text>
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="10" fill={brass} fontFamily="IBM Plex Sans">
          Progresiva / distancia desarrollada (m)
        </text>
      </svg>
    </div>
  );
}
