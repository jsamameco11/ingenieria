import { isControlSurface } from "./auth/deviceLock";
import { fetchVitrina, type Listing } from "./mercado";

const KEY = "memorcalc-export-count-v1";
const EVERY = 3;

export const EXPORT_AD_EVENT = "mcd-export-ad";
export const EXPORT_AD_LOCK_S = 5;
export const EXPORT_AD_HOLD_S = 6;

export function exportCount() {
  const n = Number(localStorage.getItem(KEY) || "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function noteExport() {
  if (typeof window === "undefined" || isControlSurface()) return;
  const n = exportCount() + 1;
  localStorage.setItem(KEY, String(n));
  if (n > 0 && n % EVERY === 0) {
    window.dispatchEvent(new CustomEvent(EXPORT_AD_EVENT, { detail: { count: n } }));
  }
}

export function listingPhotos(item: Listing) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of [...(item.images || []), item.image]) {
    const u = String(src || "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function houseAd(): Listing {
  return {
    id: "house-plaza-export",
    kind: "ad",
    name: "Plaza profesional MemoriaCalc",
    description:
      "Publique equipos, servicios y campañas ante ingenieros que exportan memorias, presupuestos e informes todos los días. El aviso aparece en la vitrina compartida con Folio PDF.",
    price_label: "Desde S/ 15",
    category: "Promociones",
    city: "Perú",
    country: "Perú",
    country_code: "PE",
    department: "",
    phone: "",
    url: "",
    image: "",
    images: [],
    active: true,
    hidden: false,
    seller_name: "Plaza MemoriaCalc",
    seller_email: "",
    user_id: "",
    created_at: new Date().toISOString(),
    offer_kind: "servicio",
    campaign_package: "house:export",
    origin_app: "ingenieria",
  };
}

export async function pickExportAd(count: number): Promise<Listing> {
  const ads = await fetchVitrina("ad");
  const pool = ads.length ? ads : await fetchVitrina("product");
  if (!pool.length) return houseAd();
  const withPhotos = pool.filter((row) => listingPhotos(row).length > 0);
  const use = withPhotos.length ? withPhotos : pool;
  const slot = Math.max(0, Math.floor(count / EVERY) - 1);
  return use[slot % use.length];
}
