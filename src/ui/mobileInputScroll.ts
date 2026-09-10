/**
 * En móvil, un deslizamiento que empieza sobre un input no baja el informe/panel.
 * Dejamos los campos en solo-lectura hasta un toque corto (tap) para editar;
 * si el gesto es scroll, el contenedor padre se mueve con normalidad.
 */
const COARSE = "(hover: none) and (pointer: coarse)";
const MOVE_PX = 10;

function isEditable(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  return (
    (el instanceof HTMLInputElement && el.type !== "checkbox" && el.type !== "radio" && el.type !== "file" && el.type !== "button" && el.type !== "submit" && el.type !== "reset" && el.type !== "hidden") ||
    el instanceof HTMLTextAreaElement
  );
}

function inScrollSurface(el: Element) {
  return Boolean(el.closest(".paper-wrap, .panel, .plaza-shell, .pre-pane, .pre-sheet, .xls-shell, .workspace"));
}

export function installMobileInputScroll(root: ParentNode = document) {
  if (typeof window === "undefined") return () => undefined;
  if (!window.matchMedia(COARSE).matches) return () => undefined;

  let startX = 0;
  let startY = 0;
  let arm: HTMLInputElement | HTMLTextAreaElement | null = null;
  let scrolling = false;

  const lock = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (el.classList.contains("ficha-input")) return;
    if (el.dataset.mScroll === "edit") return;
    if (document.activeElement === el) return;
    if (!el.readOnly) el.dataset.mScroll = "1";
    el.readOnly = true;
  };

  const unlock = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (el.dataset.mScroll === "1" || el.dataset.mScroll === "edit") {
      el.readOnly = false;
      el.dataset.mScroll = "edit";
    }
  };

  const relock = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (el.dataset.mScroll !== "edit" && el.dataset.mScroll !== "1") return;
    el.blur();
    el.readOnly = true;
    el.dataset.mScroll = "1";
  };

  const sweep = () => {
    root.querySelectorAll("input, textarea").forEach((node) => {
      if (!isEditable(node) || !inScrollSurface(node)) return;
      if (node.classList.contains("ficha-input")) return;
      lock(node);
    });
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.target;
    if (!isEditable(t) || !inScrollSurface(t)) {
      arm = null;
      return;
    }
    startX = e.touches[0]?.clientX ?? 0;
    startY = e.touches[0]?.clientY ?? 0;
    scrolling = false;
    arm = t;
    if (document.activeElement !== t) lock(t);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!arm) return;
    const x = e.touches[0]?.clientX ?? startX;
    const y = e.touches[0]?.clientY ?? startY;
    if (Math.abs(x - startX) > MOVE_PX || Math.abs(y - startY) > MOVE_PX) {
      scrolling = true;
      if (document.activeElement === arm) arm.blur();
      lock(arm);
    }
  };

  const onTouchEnd = () => {
    if (!arm) return;
    const el = arm;
    arm = null;
    if (scrolling) {
      relock(el);
      return;
    }
    unlock(el);
    if (document.activeElement !== el) {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }
  };

  const onFocusIn = (e: FocusEvent) => {
    const t = e.target;
    if (isEditable(t) && inScrollSurface(t)) unlock(t);
  };

  const onFocusOut = (e: FocusEvent) => {
    const t = e.target;
    if (isEditable(t) && inScrollSurface(t)) {
      window.setTimeout(() => {
        if (document.activeElement !== t) relock(t);
      }, 0);
    }
  };

  sweep();
  const mo = new MutationObserver(() => sweep());
  if (root instanceof Node) mo.observe(root, { childList: true, subtree: true });

  const touchStart = onTouchStart as EventListener;
  const touchMove = onTouchMove as EventListener;
  const touchEnd = onTouchEnd as EventListener;
  const focusIn = onFocusIn as EventListener;
  const focusOut = onFocusOut as EventListener;

  root.addEventListener("touchstart", touchStart, { capture: true, passive: true });
  root.addEventListener("touchmove", touchMove, { capture: true, passive: true });
  root.addEventListener("touchend", touchEnd, { capture: true, passive: true });
  root.addEventListener("touchcancel", touchEnd, { capture: true, passive: true });
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);

  return () => {
    mo.disconnect();
    root.removeEventListener("touchstart", touchStart, true);
    root.removeEventListener("touchmove", touchMove, true);
    root.removeEventListener("touchend", touchEnd, true);
    root.removeEventListener("touchcancel", touchEnd, true);
    root.removeEventListener("focusin", focusIn);
    root.removeEventListener("focusout", focusOut);
  };
}
