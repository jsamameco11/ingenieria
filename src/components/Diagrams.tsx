"use client";

import type { FC } from "react";
import { fmt, num, type Inputs } from "@/lib/engineering";

type Props = {
  inputs: Inputs;
  onChange: (key: string, value: number | string) => void;
};

function Dim({
  x,
  y,
  value,
  field,
  unit,
  onChange,
  anchor = "middle",
}: {
  x: number;
  y: number;
  value: number;
  field: string;
  unit: string;
  onChange: Props["onChange"];
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <foreignObject x={x - 46} y={y - 12} width={92} height={24}>
      <div className="flex items-center justify-center gap-0.5" style={{ textAlign: anchor }}>
        <input
          className="dim-label w-[58px] rounded border border-copper/50 bg-white px-1 py-0.5 text-center text-[11px] text-navy outline-none focus:border-navy"
          value={Number.isFinite(value) ? String(value) : ""}
          onChange={(e) => onChange(field, e.target.value === "" ? 0 : Number(e.target.value))}
        />
        <span className="text-[10px] text-steel">{unit}</span>
      </div>
    </foreignObject>
  );
}

function lineH(x1: number, x2: number, y: number) {
  return (
    <>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#1f4a73" strokeWidth="0.8" />
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} stroke="#1f4a73" strokeWidth="0.8" />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} stroke="#1f4a73" strokeWidth="0.8" />
    </>
  );
}

function lineV(x: number, y1: number, y2: number) {
  return (
    <>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#1f4a73" strokeWidth="0.8" />
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} stroke="#1f4a73" strokeWidth="0.8" />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} stroke="#1f4a73" strokeWidth="0.8" />
    </>
  );
}

export function EstriboDiagram({ inputs, onChange }: Props) {
  const H = num(inputs.H, 7);
  const B = num(inputs.B, 5.1);
  const D = num(inputs.D, 1.1);
  const Lp = num(inputs.Lpunta, 1.1);
  const ts = num(inputs.tsup, 0.3);
  const ti = num(inputs.tinf, 0.9);
  const s = 70;
  const x0 = 90;
  const yBase = 340;
  const yTop = yBase - H * s;
  const xPunta = x0;
  const xPant = x0 + Lp * s;
  const xTalon = x0 + B * s;
  const xTopL = xPant;
  const xTopR = xPant + ts * s;
  const xBotL = xPant;
  const xBotR = xPant + ti * s;
  const yZap = yBase - D * s;
  const path = `M ${xPunta} ${yBase} L ${xTalon} ${yBase} L ${xTalon} ${yZap} L ${xBotR} ${yZap} L ${xTopR} ${yTop} L ${xTopL} ${yTop} L ${xBotL} ${yZap} L ${xPunta} ${yZap} Z`;
  return (
    <svg viewBox="0 0 640 420" className="h-auto w-full">
      <rect width="640" height="420" fill="#fbf8f1" />
      <text x="24" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">
        Estribo — cotas vivas
      </text>
      <path d={path} fill="#c9d6cf" stroke="#16324f" strokeWidth="1.6" />
      <path d={`M ${xTalon + 8} ${yTop} L ${xTalon + 70} ${yTop} L ${xTalon + 70} ${yZap} L ${xBotR} ${yZap}`} fill="#e8dcc4" opacity="0.85" />
      {lineH(xPunta, xTalon, yBase + 28)}
      <Dim x={(xPunta + xTalon) / 2} y={yBase + 44} value={B} field="B" unit="m" onChange={onChange} />
      {lineH(xPunta, xPant, yBase + 58)}
      <Dim x={(xPunta + xPant) / 2} y={yBase + 74} value={Lp} field="Lpunta" unit="m" onChange={onChange} />
      {lineV(x0 - 28, yTop, yBase)}
      <Dim x={x0 - 28} y={(yTop + yBase) / 2} value={H} field="H" unit="m" onChange={onChange} />
      {lineV(xTalon + 86, yZap, yBase)}
      <Dim x={xTalon + 86} y={(yZap + yBase) / 2} value={D} field="D" unit="m" onChange={onChange} />
      {lineH(xTopL, xTopR, yTop - 18)}
      <Dim x={(xTopL + xTopR) / 2} y={yTop - 32} value={ts} field="tsup" unit="m" onChange={onChange} />
      {lineH(xBotL, xBotR, yZap - 14)}
      <Dim x={(xBotL + xBotR) / 2 + 20} y={yZap - 28} value={ti} field="tinf" unit="m" onChange={onChange} />
    </svg>
  );
}

export function LosaDiagram({ inputs, onChange }: Props) {
  const S = num(inputs.S, 2.8);
  const t = num(inputs.t, 0.2);
  const b = num(inputs.bViga ?? inputs.bViga, 0.4);
  const n = Math.max(3, Math.round(num(inputs.nVigas, 4)));
  return (
    <svg viewBox="0 0 640 300" className="h-auto w-full">
      <rect width="640" height="300" fill="#fbf8f1" />
      <text x="24" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">
        Sección transversal — losa sobre vigas
      </text>
      <rect x="40" y="90" width="560" height={t * 220} fill="#d7ddd6" stroke="#16324f" />
      {Array.from({ length: n }).map((_, i) => {
        const x = 80 + i * (480 / Math.max(n - 1, 1));
        return <rect key={i} x={x - (b * 40)} y={90 + t * 220} width={b * 80} height="70" fill="#8fa094" stroke="#16324f" />;
      })}
      {lineH(80, 80 + 480 / Math.max(n - 1, 1), 80)}
      <Dim x={80 + 240 / Math.max(n - 1, 1)} y={64} value={S} field="S" unit="m" onChange={onChange} />
      {lineV(30, 90, 90 + t * 220)}
      <Dim x={30} y={90 + (t * 220) / 2} value={t} field="t" unit="m" onChange={onChange} />
    </svg>
  );
}

export function PuenteVehicularDiagram({ inputs, onChange }: Props) {
  const Btot = num(inputs.Btot, 8.4);
  const h = num(inputs.hViga, 1.4);
  const t = num(inputs.t, 0.2);
  return (
    <svg viewBox="0 0 640 280" className="h-auto w-full">
      <rect width="640" height="280" fill="#fbf8f1" />
      <text x="24" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Sección del tablero</text>
      <rect x="50" y="70" width="40" height="70" fill="#6d7f74" />
      <rect x="90" y="100" width="460" height={t * 180} fill="#d7ddd6" stroke="#16324f" />
      <rect x="550" y="70" width="40" height="70" fill="#6d7f74" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={130 + i * 110} y={100 + t * 180} width="28" height={h * 50} fill="#8fa094" stroke="#16324f" />
      ))}
      {lineH(50, 590, 240)}
      <Dim x={320} y={256} value={Btot} field="Btot" unit="m" onChange={onChange} />
      {lineV(610, 100, 100 + t * 180 + h * 50)}
      <Dim x={610} y={170} value={h} field="hViga" unit="m" onChange={onChange} />
    </svg>
  );
}

export function IGirderDiagram({ inputs, onChange }: Props) {
  const h = num(inputs.h, 1.7);
  const b = num(inputs.b, 0.3);
  const tf = num(inputs.tf, 0.25);
  return (
    <svg viewBox="0 0 420 360" className="h-auto w-full">
      <rect width="420" height="360" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Viga I presforzada</text>
      <path d="M 120 50 H 300 V 90 H 230 V 250 H 300 V 300 H 120 V 250 H 190 V 90 H 120 Z" fill="#cfd6cf" stroke="#16324f" strokeWidth="1.5" />
      {lineV(80, 50, 300)}
      <Dim x={80} y={175} value={h} field="h" unit="m" onChange={onChange} />
      {lineH(120, 300, 320)}
      <Dim x={210} y={336} value={b} field="b" unit="m" onChange={onChange} />
      {lineV(330, 50, 90)}
      <Dim x={330} y={70} value={tf} field="tf" unit="m" onChange={onChange} />
    </svg>
  );
}

export function ApoyoDiagram({ inputs, onChange }: Props) {
  const W = num(inputs.bViga, 30);
  return (
    <svg viewBox="0 0 420 260" className="h-auto w-full">
      <rect width="420" height="260" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Elastómero laminado</text>
      <rect x="90" y="50" width="240" height="28" fill="#8a9098" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="110" y={90 + i * 22} width="200" height="16" fill={i % 2 ? "#2a3140" : "#c4a574"} />
      ))}
      <rect x="90" y="178" width="240" height="22" fill="#8a9098" />
      {lineH(110, 310, 220)}
      <Dim x={210} y={236} value={W} field="bViga" unit="cm" onChange={onChange} />
    </svg>
  );
}

export function PlacaDiagram({ inputs }: Props) {
  const tipo = String(inputs.tipo ?? "circular");
  return (
    <svg viewBox="0 0 360 260" className="h-auto w-full">
      <rect width="360" height="260" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Placa de apoyo</text>
      {tipo === "circular" ? (
        <circle cx="180" cy="140" r="70" fill="#d9dde0" stroke="#16324f" strokeWidth="1.5" />
      ) : (
        <rect x="110" y="80" width="140" height="140" fill="#d9dde0" stroke="#16324f" strokeWidth="1.5" />
      )}
      <rect x="150" y="110" width="60" height="60" fill="#8fa094" opacity="0.7" />
    </svg>
  );
}

export function TravesanoDiagram({ inputs, onChange }: Props) {
  const b = num(inputs.b, 0.5);
  const h = num(inputs.h, 0.6);
  return (
    <svg viewBox="0 0 360 260" className="h-auto w-full">
      <rect width="360" height="260" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Sección de travesaño</text>
      <rect x="110" y="60" width="140" height="140" fill="#d7ddd6" stroke="#16324f" />
      {lineH(110, 250, 220)}
      <Dim x={180} y={236} value={b} field="b" unit="m" onChange={onChange} />
      {lineV(90, 60, 200)}
      <Dim x={90} y={130} value={h} field="h" unit="m" onChange={onChange} />
    </svg>
  );
}

export function CajonDiagram({ inputs, onChange }: Props) {
  const B = num(inputs.B, 8.4);
  const h = num(inputs.h, 1.6);
  return (
    <svg viewBox="0 0 520 260" className="h-auto w-full">
      <rect width="520" height="260" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Cajón</text>
      <path d="M 60 70 H 460 V 100 H 400 V 180 H 460 V 210 H 60 V 180 H 120 V 100 H 60 Z" fill="#cfd6cf" stroke="#16324f" />
      {lineH(60, 460, 230)}
      <Dim x={260} y={246} value={B} field="B" unit="m" onChange={onChange} />
      {lineV(40, 70, 210)}
      <Dim x={40} y={140} value={h} field="h" unit="m" onChange={onChange} />
    </svg>
  );
}

export function ColumnaDiagram({ inputs, onChange }: Props) {
  const b = num(inputs.b, 40);
  const h = num(inputs.h, 40);
  const n = Math.max(4, Math.round(num(inputs.nBar, 8)));
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full">
      <rect width="360" height="300" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Sección de columna</text>
      <rect x="90" y="50" width="180" height="180" fill="#d7ddd6" stroke="#16324f" />
      {Array.from({ length: n }).map((_, i) => {
        const ang = (Math.PI * 2 * i) / n;
        const cx = 180 + Math.cos(ang) * 70;
        const cy = 140 + Math.sin(ang) * 70;
        return <circle key={i} cx={cx} cy={cy} r="6" fill="#9b2c2c" />;
      })}
      {lineH(90, 270, 250)}
      <Dim x={180} y={266} value={b} field="b" unit="cm" onChange={onChange} />
      {lineV(70, 50, 230)}
      <Dim x={70} y={140} value={h} field="h" unit="cm" onChange={onChange} />
    </svg>
  );
}

export function VigaRectDiagram({ inputs, onChange }: Props) {
  const b = num(inputs.b, 25);
  const h = num(inputs.h, 45);
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full">
      <rect width="360" height="300" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Sección de viga</text>
      <rect x="130" y="50" width="100" height="180" fill="#d7ddd6" stroke="#16324f" />
      <circle cx="150" cy="210" r="6" fill="#9b2c2c" />
      <circle cx="180" cy="210" r="6" fill="#9b2c2c" />
      <circle cx="210" cy="210" r="6" fill="#9b2c2c" />
      {lineH(130, 230, 250)}
      <Dim x={180} y={266} value={b} field="b" unit={b > 5 ? "cm" : "m"} onChange={onChange} />
      {lineV(110, 50, 230)}
      <Dim x={110} y={140} value={h} field="h" unit={h > 5 ? "cm" : "m"} onChange={onChange} />
    </svg>
  );
}

export function ZapataDiagram({ inputs, onChange }: Props) {
  const T = num(inputs.T, 3);
  const S = num(inputs.S, 2.75);
  const t1 = num(inputs.t1, 0.55);
  const t2 = num(inputs.t2, 0.8);
  return (
    <svg viewBox="0 0 420 320" className="h-auto w-full">
      <rect width="420" height="320" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Zapata aislada — planta</text>
      <rect x="70" y="50" width="280" height="200" fill="#e4ddd0" stroke="#16324f" />
      <rect x="155" y="105" width="110" height="90" fill="#8fa094" stroke="#16324f" />
      {lineH(70, 350, 270)}
      <Dim x={210} y={286} value={T} field="T" unit="m" onChange={onChange} />
      {lineV(50, 50, 250)}
      <Dim x={50} y={150} value={S} field="S" unit="m" onChange={onChange} />
      <text x="210" y="148" textAnchor="middle" fontSize="11" fill="#16324f">{fmt(t1,2)}×{fmt(t2,2)} m</text>
    </svg>
  );
}

export function ZapataCombDiagram({ inputs, onChange }: Props) {
  const Lz = num(inputs.Lz, 7.35);
  const b = num(inputs.b, 2.4);
  return (
    <svg viewBox="0 0 520 240" className="h-auto w-full">
      <rect width="520" height="240" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Zapata combinada</text>
      <rect x="40" y="70" width="440" height="90" fill="#e4ddd0" stroke="#16324f" />
      <rect x="70" y="85" width="50" height="60" fill="#8fa094" />
      <rect x="400" y="80" width="60" height="70" fill="#8fa094" />
      {lineH(40, 480, 180)}
      <Dim x={260} y={196} value={Lz} field="Lz" unit="m" onChange={onChange} />
      {lineV(500, 70, 160)}
      <Dim x={500} y={115} value={b} field="b" unit="m" onChange={onChange} />
    </svg>
  );
}

export function PlateaDiagram({ inputs, onChange }: Props) {
  const Lx = num(inputs.Lx, 20);
  const Ly = num(inputs.Ly, 17.45);
  return (
    <svg viewBox="0 0 420 280" className="h-auto w-full">
      <rect width="420" height="280" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Platea</text>
      <rect x="60" y="50" width="300" height="180" fill="#e4ddd0" stroke="#16324f" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={90 + c * 90} y={75 + r * 50} width="28" height="28" fill="#8fa094" />
        ))
      )}
      {lineH(60, 360, 250)}
      <Dim x={210} y={266} value={Lx} field="Lx" unit="m" onChange={onChange} />
      {lineV(40, 50, 230)}
      <Dim x={40} y={140} value={Ly} field="Ly" unit="m" onChange={onChange} />
    </svg>
  );
}

export function PiloteDiagram({ inputs, onChange }: Props) {
  const D = num(inputs.D, 0.4);
  const L = num(inputs.Df, 6.5);
  return (
    <svg viewBox="0 0 300 340" className="h-auto w-full">
      <rect width="300" height="340" fill="#fbf8f1" />
      <text x="16" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Pilote</text>
      <rect x="110" y="50" width="80" height="40" fill="#8fa094" />
      <rect x="125" y="90" width="50" height="200" fill="#c9d0c8" stroke="#16324f" />
      {lineV(90, 90, 290)}
      <Dim x={90} y={190} value={L} field="Df" unit="m" onChange={onChange} />
      {lineH(125, 175, 310)}
      <Dim x={150} y={326} value={D} field="D" unit="m" onChange={onChange} />
    </svg>
  );
}

export function EscaleraDiagram({ inputs, onChange }: Props) {
  const p = num(inputs.p, 0.28);
  const cp = num(inputs.cp, 0.175);
  const t = num(inputs.t, 0.15);
  const n = Math.round(num(inputs.n1 ?? inputs.n, 9));
  const steps = Math.min(12, Math.max(4, n));
  let d = "";
  let x = 40;
  let y = 220;
  d += `M ${x} ${y} `;
  for (let i = 0; i < steps; i++) {
    x += 28;
    d += `L ${x} ${y} `;
    y -= 16;
    d += `L ${x} ${y} `;
  }
  return (
    <svg viewBox="0 0 520 280" className="h-auto w-full">
      <rect width="520" height="280" fill="#fbf8f1" />
      <text x="20" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Escalera — cotas vivas</text>
      <path d={d} fill="none" stroke="#16324f" strokeWidth="2" />
      {lineH(40, 40 + 28, 240)}
      <Dim x={54} y={256} value={p} field="p" unit="m" onChange={onChange} />
      {lineV(36, 204, 220)}
      <Dim x={36} y={204} value={cp} field="cp" unit="m" onChange={onChange} />
      <text x="400" y="80" fontSize="12" fill="#4d647c">t = {fmt(t, 2)} m</text>
    </svg>
  );
}

export function SismoDiagram({ inputs, onChange }: Props) {
  const n = Math.max(2, Math.round(num(inputs.nPisos, 4)));
  const h = num(inputs.hPiso, 2.7);
  return (
    <svg viewBox="0 0 360 340" className="h-auto w-full">
      <rect width="360" height="340" fill="#fbf8f1" />
      <text x="16" y="28" className="fill-navy" fontFamily="Fraunces" fontSize="16">Edificio — E.030</text>
      {Array.from({ length: n }).map((_, i) => (
        <rect key={i} x="110" y={280 - (i + 1) * 40} width="140" height="40" fill="#d7ddd6" stroke="#16324f" />
      ))}
      {lineV(90, 280 - n * 40, 280)}
      <Dim x={90} y={280 - (n * 40) / 2} value={h} field="hPiso" unit="m" onChange={onChange} />
      <text x="180" y="320" textAnchor="middle" fontSize="11" fill="#4d647c">{n} pisos</text>
    </svg>
  );
}

export function DiagramFor({ slug, inputs, onChange }: Props & { slug: string }) {
  const map: Record<string, FC<Props>> = {
    "estribo-voladizo": EstriboDiagram,
    "estribo-gravedad": EstriboDiagram,
    "estribo-pantalla": EstriboDiagram,
    "losa-puente": LosaDiagram,
    "puente-vehicular": PuenteVehicularDiagram,
    "viga-presforzada": IGirderDiagram,
    "dispositivos-apoyo": ApoyoDiagram,
    "placa-apoyo": PlacaDiagram,
    travesano: TravesanoDiagram,
    "puente-cajon": CajonDiagram,
    columnas: ColumnaDiagram,
    "viga-flexion": VigaRectDiagram,
    "viga-cortante": VigaRectDiagram,
    "viga-doble-armadura": VigaRectDiagram,
    "viga-compuesta": IGirderDiagram,
    "zapata-aislada": ZapataDiagram,
    "zapata-combinada": ZapataCombDiagram,
    "viga-cimentacion": VigaRectDiagram,
    platea: PlateaDiagram,
    pilotes: PiloteDiagram,
    "escalera-dos-tramos": EscaleraDiagram,
    "escalera-descanso": EscaleraDiagram,
    "edificio-sismo": SismoDiagram,
  };
  const C = map[slug] ?? EstriboDiagram;
  return <C inputs={inputs} onChange={onChange} />;
}
