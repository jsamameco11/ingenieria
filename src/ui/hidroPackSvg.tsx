export function DesarenadorSvg({ B, H, L }: { B: number; H: number; L: number }) {
  const W = 640;
  const Hs = 280;
  const s = 140 / Math.max(H + 0.4, 1);
  const b = Math.min(220, B * s * 0.45);
  const h = H * s;
  const len = Math.min(280, L * s * 0.12);
  return (
    <svg viewBox={`0 0 ${W} ${Hs}`} className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-06 · Planta y corte del desarenador</text>
      <rect x="40" y="50" width={len + 80} height="90" fill="#dce8f2" stroke="#1b3650" />
      <rect x="40" y="50" width="28" height="90" fill="#8fa8bc" stroke="#1b3650" />
      <text x="46" y="100" fontSize="10" fill="#0b1f33">ent.</text>
      <rect x={40 + len + 52} y="50" width="28" height="90" fill="#c4a056" stroke="#1b3650" />
      <text x={48 + len + 52} y="100" fontSize="10" fill="#0b1f33">vert.</text>
      <text x="80" y="80" fontSize="11">L = {L.toFixed(2)} m</text>
      <text x="80" y="122" fontSize="11">B = {B.toFixed(2)} m</text>
      <path d={`M 40 200 h ${b + 40} v ${-h} h ${-b - 40} z`} fill="#c5d6e4" stroke="#1b3650" transform="translate(360,20)" />
      <line x1="400" y1="220" x2="400" y2={220 - h} stroke="#8a6a32" strokeDasharray="3 3" />
      <text x="408" y={220 - h / 2} fontSize="11">H = {H.toFixed(2)} m</text>
    </svg>
  );
}

export function BocatomaSvg({ b, P }: { b: number; P: number }) {
  return (
    <svg viewBox="0 0 640 260" className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-07 · Ventana, barraje y desripiador</text>
      <path d="M40 200 L200 200 L260 120 L400 120 L460 200 L600 200" fill="none" stroke="#1b3650" strokeWidth="2" />
      <rect x="250" y="70" width="120" height="50" fill="#9eb4c6" stroke="#0b1f33" />
      <text x="262" y="100" fontSize="11">ventana b={b.toFixed(2)} m</text>
      <rect x="430" y="150" width="70" height={Math.min(50, P * 28)} fill="#6e7f8d" stroke="#0b1f33" />
      <text x="430" y="240" fontSize="11">azud P={P.toFixed(2)} m</text>
      <path d="M40 200 Q160 170 260 200" fill="#7ea0b8" opacity="0.45" />
    </svg>
  );
}

export function RapidaSvg({ y1, y2, L }: { y1: number; y2: number; L: number }) {
  const h1 = Math.max(18, y1 * 40);
  const h2 = Math.max(28, y2 * 28);
  return (
    <svg viewBox="0 0 640 260" className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-08 · Rápida, trayectoria y resalto</text>
      <path d="M40 80 L220 80 L420 190 L600 190" fill="none" stroke="#1b3650" strokeWidth="2" />
      <path d="M220 80 Q320 90 420 190" fill="none" stroke="#8a6a32" strokeDasharray="4 3" />
      <rect x="430" y={190 - h1} width="50" height={h1} fill="#7ea0b8" opacity="0.7" />
      <rect x="500" y={190 - h2} width="70" height={h2} fill="#4a6f88" opacity="0.55" />
      <text x="428" y="230" fontSize="11">y₁={y1.toFixed(2)}</text>
      <text x="502" y="230" fontSize="11">y₂={y2.toFixed(2)}</text>
      <text x="300" y="250" fontSize="11">L resalto ≈ {L.toFixed(2)} m</text>
    </svg>
  );
}

export function AliviaderoSvg({ L, h }: { L: number; h: number }) {
  return (
    <svg viewBox="0 0 640 240" className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-09 · Aliviadero lateral</text>
      <rect x="60" y="70" width="400" height="90" fill="#d7e4ee" stroke="#1b3650" />
      <rect x="60" y="70" width="400" height="22" fill="#c4a056" />
      <text x="80" y="86" fontSize="11">cresta L={L.toFixed(1)} m · h={h.toFixed(2)} m</text>
      <path d="M460 90 Q520 70 580 130" fill="none" stroke="#1b3650" />
      <text x="500" y="160" fontSize="11">evacuación</text>
    </svg>
  );
}

export function AcueductoSvg({ L, V }: { L: number; V: number }) {
  return (
    <svg viewBox="0 0 640 240" className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-10 · Acueducto sobre depresión</text>
      <path d="M40 70 Q320 160 600 70" fill="none" stroke="#8a6a32" strokeWidth="2" />
      <rect x="200" y="95" width="240" height="18" rx="4" fill="#4a6f88" />
      <line x1="80" y1="70" x2="80" y2="200" stroke="#1b3650" />
      <line x1="560" y1="70" x2="560" y2="200" stroke="#1b3650" />
      <text x="220" y="88" fontSize="11">L={L.toFixed(1)} m · V={V.toFixed(2)} m/s</text>
    </svg>
  );
}

export function RiegoSvg({ metodo }: { metodo: string }) {
  return (
    <svg viewBox="0 0 640 220" className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-11 · Red de {metodo}</text>
      <rect x="40" y="50" width="560" height="140" fill="#e8f0e4" stroke="#3d5a3a" />
      <line x1="80" y1="70" x2="80" y2="170" stroke="#1b3650" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1="80" y1={80 + i * 20} x2="560" y2={80 + i * 20} stroke="#4a6f88" />
          <circle cx={160 + (i % 3) * 120} cy={80 + i * 20} r="4" fill="#c4a056" />
        </g>
      ))}
    </svg>
  );
}

export function OrificioSvg({ H, D }: { H: number; D: number }) {
  return (
    <svg viewBox="0 0 640 240" className="diagram" aria-hidden>
      <text x="24" y="28" fontSize="13" fill="#5c4a3a">HID-12 · Orificio</text>
      <rect x="80" y="50" width="160" height="160" fill="#c5d6e4" stroke="#1b3650" />
      <circle cx="240" cy="150" r={Math.max(8, D * 40)} fill="#0b1f33" />
      <path d="M248 150 Q360 170 420 200" fill="none" stroke="#4a6f88" strokeWidth="2" />
      <text x="90" y="80" fontSize="11">H = {H.toFixed(2)} m</text>
    </svg>
  );
}
