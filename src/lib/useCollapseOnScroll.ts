import { useRef, useState, type UIEvent } from "react";

/** Oculta el chrome auxiliar al bajar; lo muestra de nuevo al subir o al volver arriba. */
export function useCollapseOnScroll(threshold = 10) {
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);

  const onScroll = (e: UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    const prev = lastY.current;
    lastY.current = y;
    if (y <= threshold) {
      setCollapsed(false);
      return;
    }
    if (y > prev + 4) setCollapsed(true);
    else if (y < prev - 6) setCollapsed(false);
  };

  return { collapsed, onScroll };
}
