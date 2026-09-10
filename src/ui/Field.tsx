import type { ReactNode } from "react";

export function Field({
  label,
  unit,
  children,
  note,
  className,
}: {
  label: string;
  unit?: string;
  children: ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label>
        {label}
        {unit ? <span className="unit"> · {unit}</span> : null}
      </label>
      {children}
      {note ? <p className="field-note">{note}</p> : null}
    </div>
  );
}

export function Num({
  value,
  onChange,
  step = "any",
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}

export function Text({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
}

const OTRA = "__otra__";

export type OptTextItem = string | { value: string; label: string };

function optItems(options: OptTextItem[]) {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/** Lista parametrizada con opción «Otra…» para texto libre. */
export function OptText({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (s: string) => void;
  options: OptTextItem[];
}) {
  const items = optItems(options);
  const inList = items.some((o) => o.value === value);
  return (
    <>
      <select
        value={inList ? value : OTRA}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTRA) onChange(inList ? "" : value);
          else onChange(v);
        }}
      >
        {items.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={OTRA}>Otra…</option>
      </select>
      {!inList ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Especificar" />
      ) : null}
    </>
  );
}

/** Lista de valores tabulados (coeficientes, diámetros, dosis). */
export function OptNum({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (n: number) => void;
  options: { value: number; label: string }[];
}) {
  const has = options.some((o) => o.value === value);
  return (
    <select value={Number.isFinite(value) ? String(value) : ""} onChange={(e) => onChange(Number(e.target.value))}>
      {!has && Number.isFinite(value) ? <option value={value}>{value}</option> : null}
      {options.map((o) => (
        <option key={`${o.value}-${o.label}`} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
