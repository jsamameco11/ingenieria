import { useEffect, useRef, useState } from "react";

/**
 * Casilla de la ficha: un clic o un deslizamiento baja la página.
 * Solo el doble clic (o doble toque) abre la edición.
 */
export function FichaInput({
  value,
  onChange,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!edit) return;
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, [edit]);

  return (
    <input
      ref={ref}
      className="ficha-input"
      type="text"
      inputMode="decimal"
      readOnly={!edit}
      value={value}
      onPointerDown={(e) => {
        if (!edit && e.pointerType === "mouse") e.preventDefault();
      }}
      onDoubleClick={() => {
        setEdit(true);
        onFocus();
      }}
      onFocus={() => {
        if (edit) onFocus();
      }}
      onBlur={() => setEdit(false)}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          setEdit(false);
          ref.current?.blur();
        }
      }}
    />
  );
}
