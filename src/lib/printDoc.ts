import { noteExport } from "./exportAd";
import { cleanPrintLabel, fetchPrintPolicy, type PrintPolicy } from "./printPolicy";

type PrintOpts = {
  titulo?: string;
  printClass?: string;
  watermark: boolean;
};

let chooserOpen = false;

function printTitle(titulo?: string) {
  const raw = titulo?.trim() ?? "";
  if (!raw) return "MemoriaCalc";
  if (/^especificaciones|^presupuesto/i.test(raw) || raw.includes("—")) return raw;
  return `Memoria de cálculo — ${raw}`;
}

/** Imprime el documento A4. El título sustituye al de la pestaña para que no salga la URL. */
export function printMemoria(titulo?: string, printClass?: string) {
  void openPrintChooser(titulo, printClass);
}

function openPrintChooser(titulo?: string, printClass?: string) {
  if (chooserOpen) return;
  chooserOpen = true;
  const host = document.createElement("div");
  host.className = "mc-print-back no-print";
  host.setAttribute("role", "presentation");
  document.body.appendChild(host);

  const close = () => {
    chooserOpen = false;
    host.remove();
    window.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", onKey);

  host.innerHTML = `
    <div class="mc-print-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-print-title">
      <header>
        <p class="mc-print-kicker">MemoriaCalc · Impresión</p>
        <h3 id="mc-print-title">¿Cómo desea el PDF?</h3>
        <p class="mc-print-lead">Elija si la memoria sale con marca de agua de trabajo o como documento limpio. El diálogo del sistema le permitirá guardar en PDF.</p>
      </header>
      <div class="mc-print-cards" id="mc-print-cards">
        <p class="mc-print-wait">Consultando la política de impresión…</p>
      </div>
      <div class="mc-print-actions">
        <button type="button" class="btn secondary" data-print-cancel>Cancelar</button>
      </div>
    </div>
  `;
  host.addEventListener("click", (e) => {
    if (e.target === host) close();
  });
  host.querySelector("[data-print-cancel]")?.addEventListener("click", close);

  void fetchPrintPolicy().then((policy) => {
    if (!host.isConnected) return;
    renderCards(host, policy, () => close(), titulo, printClass);
  });
}

function renderCards(
  host: HTMLElement,
  policy: PrintPolicy,
  close: () => void,
  titulo?: string,
  printClass?: string,
) {
  const cards = host.querySelector("#mc-print-cards");
  if (!cards) return;
  const clean = cleanPrintLabel(policy);
  const cleanGratis = clean === "Gratis";
  cards.innerHTML = `
    <button type="button" class="mc-print-card" data-print-mode="wm">
      <span class="mc-print-preview" aria-hidden="true">
        <i></i><i></i><i></i>
        <em>MEMORIACALC</em>
        <small>COPIA GRATUITA</small>
      </span>
      <span class="mc-print-card-kicker">Copia de trabajo</span>
      <strong>Con marca de agua</strong>
      <span class="mc-print-badge free">Gratis</span>
      <p>Diagonal profesional en cada hoja. Sirve para revisar, compartir y archivar el cálculo sin presentarlo como expediente final.</p>
    </button>
    <button type="button" class="mc-print-card" data-print-mode="clean">
      <span class="mc-print-preview clean" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      <span class="mc-print-card-kicker">Documento de expediente</span>
      <strong>Sin marca de agua</strong>
      <span class="mc-print-badge ${cleanGratis ? "free" : "pay"}">${clean}</span>
      <p>${
        cleanGratis
          ? "Hoja limpia, lista para firmar o anexar al expediente. Por ahora no tiene costo."
          : `Hoja limpia, lista para firmar o anexar al expediente. Precio publicado: ${clean}.`
      }</p>
    </button>
  `;
  cards.querySelectorAll<HTMLButtonElement>("[data-print-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const watermark = btn.dataset.printMode === "wm";
      close();
      runPrint({ titulo, printClass, watermark });
    });
  });
}

function runPrint({ titulo, printClass, watermark }: PrintOpts) {
  const prev = document.title;
  document.title = printTitle(titulo);
  (document.activeElement as HTMLElement | null)?.blur?.();
  document.documentElement.classList.add("is-printing");
  if (watermark) document.documentElement.classList.add("print-watermark");
  if (printClass) document.documentElement.classList.add(printClass);

  const mark = document.createElement("div");
  mark.className = "mc-print-watermark";
  mark.setAttribute("aria-hidden", "true");
  if (watermark) document.body.appendChild(mark);

  let done = false;
  const restore = (count: boolean) => {
    if (done) return;
    done = true;
    document.title = prev;
    document.documentElement.classList.remove("is-printing", "print-watermark");
    if (printClass) document.documentElement.classList.remove(printClass);
    mark.remove();
    window.removeEventListener("afterprint", onPrinted);
    if (count) noteExport();
  };
  const onPrinted = () => restore(true);
  window.addEventListener("afterprint", onPrinted);
  requestAnimationFrame(() => {
    window.print();
  });
  window.setTimeout(() => restore(false), 120000);
}
