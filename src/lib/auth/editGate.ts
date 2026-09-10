/**
 * Consulta libre: plantillas, valores de ejemplo e informe se ven sin cuenta.
 * El login se pide al pulsar un casillero, desplegable o control que vaya a cambiar un dato.
 */

const VIEW_ROOT = [
  ".auth-ui",
  ".auth-modal",
  ".sidebar",
  ".mobile-chrome",
  ".drawer-scrim",
  ".home",
  ".ctl-login",
  ".ctl-card",
  ".ctl-app",
  "[data-guest-ok]",
].join(", ");

const VIEW_CHROME = [
  ".xls-tabs",
  ".xls-legend",
  ".pre-tabs",
  ".pre-lib-cats",
  ".pre-lib-rubros",
  ".pre-lib-card",
  ".pre-esp-bar",
  ".pre-menu-vistas",
  ".family-head",
  ".card",
  ".nav-btn",
  ".nav-label",
  ".brand",
  ".burger-btn",
].join(", ");

const MOVE_KEYS = new Set([
  "Tab",
  "Escape",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

const MUTATE_BTN =
  /guardar|agregar|añadir|agrega |quitar|eliminar|borrar|restablecer|reiniciar|usar vu|duplicar|vaciar|insertar|adjuntar|subir foto|nuevo presupuesto|nuevo archivo|\bnuevo\b|ejemplo guía|\bejemplo\b|\bcargar\b|aplicar peaje|aplicar |publicar|publicitar|enviar |pagar|yape|activar|invitar|registrar pago|plan pro|importar|vincular/i;

const VIEW_BTN =
  /imprimir|word|\bpdf\b|exportar|descargar|catálogo|catalogo|cerrar|cancelar|volver|abrir|menú|menu|pestaña|hoja |ver |mostrar|ocultar|filtrar|índice|indices|\bcalcular\b|analizar|resolver|\bmensajes\b|\benviar\b|continuar con google/i;

function textOf(el: Element): string {
  return [
    el.textContent,
    el.getAttribute("aria-label"),
    el.getAttribute("title"),
    el.getAttribute("data-action"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isBrowseField(field: Element): boolean {
  if (field.closest(VIEW_CHROME) || field.closest("[data-guest-ok]")) return true;
  if (field instanceof HTMLInputElement) {
    if (field.type === "search" || field.type === "button" || field.type === "submit") return true;
    const hint = `${field.placeholder} ${field.getAttribute("aria-label") || ""} ${field.className}`.toLowerCase();
    if (/busca|buscar|filtrar|filtro|search/.test(hint)) return true;
  }
  return false;
}

function filePicker(el: Element): boolean {
  if (el.closest("input[type=file]")) return true;
  const label = el.closest("label");
  return Boolean(label?.querySelector('input[type="file"]'));
}

function isMutatingButton(el: Element): boolean {
  const btn = el.closest("button, [role='menuitem']");
  if (!btn) return false;
  if (btn.closest(VIEW_CHROME) || btn.closest("[data-guest-ok]")) return false;
  const t = textOf(btn);
  if (VIEW_BTN.test(t) && !MUTATE_BTN.test(t)) return false;
  if (MUTATE_BTN.test(t)) return true;
  if (btn.classList.contains("chip") && btn.closest(".panel")) return true;
  return false;
}

function wouldType(e: Event): boolean {
  if (e.type === "beforeinput" || e.type === "paste" || e.type === "change") return true;
  if (!(e instanceof KeyboardEvent)) return false;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === "v" || k === "x") return true;
    return false;
  }
  if (e.key === "Backspace" || e.key === "Delete") return true;
  if (e.key === "Enter") {
    const t = e.target;
    return t instanceof HTMLTextAreaElement || (t instanceof Element && Boolean(t.closest("[contenteditable='true']")));
  }
  if (MOVE_KEYS.has(e.key) || e.key === " ") return false;
  return e.key.length === 1;
}

export function isEditAttempt(e: Event): boolean {
  const el = e.target;
  if (!(el instanceof Element)) return false;
  if (el.closest(VIEW_ROOT)) return false;
  if (el.closest("[data-guest-ok]")) return false;

  if (e instanceof KeyboardEvent) {
    if (MOVE_KEYS.has(e.key) && !(e.ctrlKey || e.metaKey)) return false;
    if ((e.ctrlKey || e.metaKey) && ["c", "a", "p", "f", "z", "y"].includes(e.key.toLowerCase())) return false;
  }

  if (el.closest(".full-select-opt")) return true;
  if (filePicker(el) && (e.type === "pointerdown" || e.type === "change")) return true;

  if (e.type === "pointerdown" && el.closest(".full-select-btn, .full-select")) return true;

  const field = el.closest("input, select, textarea, [contenteditable='true']");
  if (field) {
    if (isBrowseField(field)) return false;
    if (e.type === "pointerdown") return true;
    return wouldType(e);
  }

  if (e.type === "pointerdown" && isMutatingButton(el)) return true;
  if (e instanceof KeyboardEvent && (e.key === "Enter" || e.key === " ") && isMutatingButton(el)) return true;
  return false;
}

export function actionLabelOf(el: Element): string {
  return textOf(el).replace(/\s+/g, " ").trim().slice(0, 80);
}
