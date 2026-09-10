import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string };

export function FullSelect({
  value,
  options,
  onChange,
  onFocus,
  title,
  className,
  variant = "ficha",
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  onFocus?: () => void;
  title?: string;
  className?: string;
  variant?: "ficha" | "field";
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, y: 0, moved: false });
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 160, maxH: 280 });
  const current = options.find((o) => o.value === value)?.label ?? value;

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const maxH = Math.min(320, window.innerHeight - pad * 2);
    const spaceBelow = window.innerHeight - r.bottom - pad;
    const spaceAbove = r.top - pad;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove - 4 : spaceBelow - 4);
    const needed = Math.max(r.width, menuRef.current?.scrollWidth ?? 0, 240);
    const width = Math.min(needed, window.innerWidth - pad * 2);
    let left = r.right - width;
    if (left < pad) left = pad;
    if (left + width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pad - width);
    const top = openUp ? Math.max(pad, r.top - height - 4) : r.bottom + 4;
    setBox({ top, left, width, maxH: Math.max(120, height) });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div className={`full-select full-select-${variant}${className ? ` ${className}` : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className={variant === "ficha" ? "ficha-input full-select-btn" : "full-select-btn"}
        title={title || current}
        aria-haspopup="listbox"
        aria-expanded={open}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          if (Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 8) {
            drag.current.moved = true;
          }
        }}
        onClick={() => {
          if (drag.current.moved) return;
          onFocus?.();
          setOpen((v) => !v);
        }}
      >
        {current}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="full-select-menu"
              role="listbox"
              style={{ top: box.top, left: box.left, minWidth: box.width, width: "max-content", maxHeight: box.maxH }}
            >
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`full-select-opt${o.value === value ? " on" : ""}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
