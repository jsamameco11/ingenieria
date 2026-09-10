import type { ReactNode } from "react";

function Svg({ children, title }: { children: ReactNode; title: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <title>{title}</title>
      {children}
    </svg>
  );
}

export const ICONS = {
  select: (
    <Svg title="Seleccionar">
      <path d="M5 3 L5 19 L9.2 15.2 L12.2 22 L14.6 21 L11.5 14.1 L17 14 Z" fill="currentColor" />
    </Svg>
  ),
  column: (
    <Svg title="Columna">
      <rect x="8" y="3" width="8" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 4 H18 M6 20 H18" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  beam: (
    <Svg title="Viga">
      <path d="M3 8 H21 M3 16 H21 M5 8 V16 M19 8 V16" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  wall: (
    <Svg title="Muro pier">
      <rect x="4" y="5" width="16" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 5 V19 M12 5 V19 M16 5 V19" stroke="currentColor" strokeWidth="1.4" />
    </Svg>
  ),
  slab: (
    <Svg title="Losa">
      <path d="M4 16 L9 7 H20 L15 16 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7 L15 16" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  ),
  stair: (
    <Svg title="Escalera">
      <path d="M4 19 H8 V15 H12 V11 H16 V7 H20 V4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  support: (
    <Svg title="Apoyo">
      <path d="M12 5 L20 19 H4 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 21 H20" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  ref: (
    <Svg title="Punto de referencia">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3 V7 M12 17 V21 M3 12 H7 M17 12 H21" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  cargas: (
    <Svg title="Cargas">
      <path d="M12 3 V16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 12 L12 18 L17 12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 21 H19" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  planta: (
    <Svg title="Planta">
      <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12 H20 M12 4 V20" stroke="currentColor" strokeWidth="1.3" />
    </Svg>
  ),
  view3d: (
    <Svg title="3D">
      <path d="M12 3 L21 8 V16 L12 21 L3 16 V8 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3 V21 M3 8 L12 13 L21 8" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  ),
  ambas: (
    <Svg title="2D + 3D">
      <rect x="3" y="4" width="8" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 5 L21 8 V16 L15 19 L13 16 V8 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  ),
  deformada: (
    <Svg title="Deformada">
      <path d="M5 18 V6 M5 18 H19" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <path d="M5 18 C9 8 14 20 19 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  ),
  volumen: (
    <Svg title="Volumen">
      <path d="M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 8 L12 12 L20 8 M12 12 V20" stroke="currentColor" strokeWidth="1.3" />
    </Svg>
  ),
  orbit: (
    <Svg title="Órbita">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.2 9.2 A8 8 0 0 1 18.8 8.5 M18.8 14.8 A8 8 0 0 1 5.2 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path d="M17.2 6.6 L18.9 8.6 L16.4 9.2" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.8 17.4 L5.1 15.4 L7.6 14.8" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  pan: (
    <Svg title="Pan">
      <path
        d="M9 11 V7.2 A1.15 1.15 0 0 1 11.3 7.2 V11 M11.3 10.2 V5.8 A1.15 1.15 0 0 1 13.6 5.8 V11 M13.6 10.4 V6.6 A1.15 1.15 0 0 1 15.9 6.6 V12.2 M15.9 11.2 V8.8 A1.1 1.1 0 0 1 18.1 9.2 C18.1 9.2 18.2 13.2 16.4 16.2 C15.2 18.2 13.6 19.4 11.4 19.4 H10.2 C8.2 19.4 6.6 18 6.4 16 L5.8 12.2 C5.65 11.2 6.4 10.4 7.3 10.5 C8 10.55 8.5 11 8.6 11.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
};

export function IconBtn({
  icon,
  label,
  on,
  onClick,
  disabled,
  iconOnly,
}: {
  icon: ReactNode;
  label: string;
  on?: boolean;
  onClick: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ed3-ico${on ? " on" : ""}${iconOnly ? " icon-only" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={!!on}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );
}
