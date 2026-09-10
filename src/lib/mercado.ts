import { folio } from "./folio";

export const STORE_CATEGORIES = [
  "Construcción",
  "Software",
  "Educación",
  "Servicios",
  "Tecnología",
  "Oficina",
  "Diseño",
  "Inmuebles",
  "Legal",
  "Empresas",
  "Promociones",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];
export type ListingKind = "product" | "ad";
export type OfferKind = "servicio" | "articulo";
export type ItemCondition = "nuevo" | "usado" | "reacondicionado";

export const OFFER_KIND_LABEL: Record<OfferKind, string> = {
  servicio: "Servicio",
  articulo: "Artículo",
};

export const ITEM_CONDITION_LABEL: Record<ItemCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

const SERVICE_CATEGORIES = new Set(["Educación", "Servicios", "Legal", "Promociones", "Empresas"]);

/** Misma vigencia de vitrina que Folio PDF (3 meses). */
export const STORE_VISIBILITY_MONTHS = 3;
export const PLAZA_ORIGIN = "ingenieria" as const;
export const FOLIO_CONTROL_API =
  (import.meta.env.VITE_FOLIO_CONTROL_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://folio-control.miacademiapreu.com";

export const AD_PACKAGES = [
  { id: "ad-500", people: 500, days: 7, soles: 15, label: "500 personas · 7 días · S/ 15" },
  { id: "ad-1500", people: 1500, days: 14, soles: 35, label: "1 500 personas · 14 días · S/ 35" },
  { id: "ad-5000", people: 5000, days: 30, soles: 90, label: "5 000 personas · 30 días · S/ 90" },
] as const;

export type Listing = {
  id: string;
  kind: ListingKind;
  name: string;
  description: string;
  price_label: string;
  category: string;
  city: string;
  country: string;
  country_code: string;
  department: string;
  currency?: string;
  phone: string;
  url: string;
  image: string;
  images: string[];
  active: boolean;
  hidden: boolean;
  seller_name: string;
  seller_email: string;
  user_id: string;
  created_at: string;
  offer_kind?: OfferKind;
  item_condition?: ItemCondition;
  campaign_package?: string;
  paid_soles?: number;
  origin_app?: string;
  visible_until?: string;
  people?: number;
  impressions_cap?: number;
  impressions_used?: number;
  target_families?: string[];
};

export type Thread = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  listing_name: string;
  listing_image: string;
  listing_price: string;
  seller_name: string;
  buyer_name: string;
  last_body: string;
  last_at: string;
  buyer_unread: number;
  seller_unread: number;
};

export type ChatMsg = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function plusMonths(from: Date, months: number) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function listingPublic(row: Listing, now = new Date()): boolean {
  if (!row.active || row.hidden) return false;
  if (row.visible_until && new Date(row.visible_until).getTime() <= now.getTime()) return false;
  if (row.kind === "ad") {
    /* campañas: RLS ya filtra; aquí solo active/hidden */
  }
  return true;
}

function parseOfferKind(raw: unknown): OfferKind | undefined {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "servicio" || v === "service") return "servicio";
  if (v === "articulo" || v === "artículo" || v === "product" || v === "producto") return "articulo";
  return undefined;
}

function parseCondition(raw: unknown): ItemCondition | undefined {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (v === "nuevo" || v === "new") return "nuevo";
  if (v === "usado" || v === "used") return "usado";
  if (v === "reacondicionado" || v === "refurbished") return "reacondicionado";
  return undefined;
}

export function asListing(row: Record<string, unknown>): Listing {
  const images = Array.isArray(row.images) ? row.images.filter((x): x is string => typeof x === "string") : [];
  const image = String(row.image || images[0] || "");
  return {
    id: String(row.id || ""),
    kind: row.kind === "ad" ? "ad" : "product",
    name: String(row.name || "Sin título"),
    description: String(row.description || ""),
    price_label: String(row.price_label || "Consultar"),
    category: String(row.category || "Servicios"),
    city: String(row.city || ""),
    country: String(row.country || "Perú"),
    country_code: String(row.country_code || row.countryCode || "").toUpperCase() || (String(row.country || "") === "Perú" ? "PE" : ""),
    department: String(row.department || ""),
    currency: row.currency ? String(row.currency) : undefined,
    phone: String(row.phone || ""),
    url: String(row.url || ""),
    image,
    images: images.length ? images : image ? [image] : [],
    active: row.active !== false,
    hidden: row.hidden === true,
    seller_name: String(row.seller_name || row.seller_email || "Vendedor"),
    seller_email: String(row.seller_email || ""),
    user_id: String(row.user_id || ""),
    created_at: String(row.created_at || ""),
    offer_kind: parseOfferKind(row.offer_kind ?? row.offerKind ?? row.offer_type ?? row.offerType),
    item_condition: parseCondition(row.item_condition ?? row.itemCondition ?? row.condition),
    campaign_package: row.campaign_package ? String(row.campaign_package) : undefined,
    paid_soles: typeof row.paid_soles === "number" ? row.paid_soles : undefined,
    origin_app: row.origin_app ? String(row.origin_app) : undefined,
    visible_until: row.visible_until ? String(row.visible_until) : undefined,
    people: typeof row.people === "number" ? row.people : Number(row.people || 0) || undefined,
    impressions_cap: typeof row.impressions_cap === "number" ? row.impressions_cap : undefined,
    impressions_used: typeof row.impressions_used === "number" ? row.impressions_used : undefined,
    target_families: Array.isArray(row.target_families) ? row.target_families.map(String) : undefined,
  };
}

/** Academia Preu y categorías de servicio se muestran como Servicio en la vitrina. */
export function isAcademiaPreuListing(item: Pick<Listing, "name" | "description" | "seller_name" | "seller_email" | "category">) {
  const blob = `${item.name} ${item.description} ${item.seller_name} ${item.seller_email} ${item.category}`.toLowerCase();
  return /academia\s*pre\s*u|academia\s*preu|miacademia|mi\s*academia\s*pre/.test(blob);
}

export function resolveOfferKind(item: Listing): OfferKind {
  if (isAcademiaPreuListing(item)) return "servicio";
  if (item.offer_kind) return item.offer_kind;
  if (SERVICE_CATEGORIES.has(item.category)) return "servicio";
  const blob = `${item.name} ${item.description}`.toLowerCase();
  if (/\b(servicio|asesor[ií]a|capacitaci[oó]n|curso|taller|consultor[ií]a|supervisi[oó]n|alquiler de servicio)\b/.test(blob)) {
    return "servicio";
  }
  return "articulo";
}

export function resolveCondition(item: Listing): ItemCondition | null {
  if (resolveOfferKind(item) !== "articulo") return null;
  if (item.item_condition) return item.item_condition;
  const blob = `${item.name} ${item.description}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\breacondicionad/.test(blob)) return "reacondicionado";
  if (/\busado\b|\bsegunda\s*mano\b/.test(blob)) return "usado";
  if (/\bnuevo\b|\bsellado\b/.test(blob)) return "nuevo";
  return "nuevo";
}

export function listingBlurb(item: Pick<Listing, "description">, max = 110) {
  const raw = String(item.description || "")
    .replace(/\s+/g, " ")
    .replace(/juntos,?\s*llegamos m[aá]s lejos\.?\s*🚀?/gi, "")
    .trim();
  if (!raw) return "Sin descripción adicional.";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1).trim()}…`;
}

async function syncControlListing(payload: Record<string, unknown>) {
  try {
    await fetch(`${FOLIO_CONTROL_API}/api/v1/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* Control es espejo opcional; Supabase es la fuente de verdad compartida */
  }
}

function asControlListing(row: Record<string, unknown>): Listing {
  return asListing({
    ...row,
    price_label: row.price_label || row.priceLabel,
    seller_name: row.seller_name || row.sellerName || "Vendedor",
    seller_email: row.seller_email || row.sellerEmail,
    user_id: row.user_id || row.userId,
    origin_app: row.origin_app || (row.origin === "local" || row.source === "control" ? "folio-pdf" : row.origin) || "folio-pdf",
    created_at: row.created_at || row.createdAt,
    visible_until: row.visible_until || row.visibleUntil,
  });
}

/** Misma fuente pública que Folio PDF (Control une store.json + Supabase). */
export async function fetchControlStore(): Promise<Listing[]> {
  try {
    const res = await fetch(`${FOLIO_CONTROL_API}/api/v1/store`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Record<string, unknown>[] };
    return (data.items ?? []).map(asControlListing).filter((row) => listingPublic(row) && row.kind !== "ad");
  } catch {
    return [];
  }
}

export async function fetchVitrina(kind: ListingKind | "all" = "product"): Promise<Listing[]> {
  let q = folio.from("listings").select("*").eq("active", true).eq("hidden", false).order("created_at", { ascending: false }).limit(200);
  if (kind !== "all") q = q.eq("kind", kind);
  const [{ data, error }, control] = await Promise.all([q, kind === "ad" ? Promise.resolve([]) : fetchControlStore()]);
  const cloud = error || !data
    ? []
    : (data as Record<string, unknown>[]).map(asListing);
  const merged = new Map<string, Listing>();
  for (const row of control) {
    if (row.id) merged.set(row.id, row);
  }
  for (const row of cloud) {
    if (row.id) merged.set(row.id, row);
  }
  return [...merged.values()]
    .filter((row) => listingPublic(row) && !(row.kind === "ad" && String(row.campaign_package || "").startsWith("house:")))
    .filter((row) => kind === "all" || row.kind === kind)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function fetchMine(userId: string): Promise<Listing[]> {
  const { data, error } = await folio.from("listings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(asListing);
}

export async function publishListing(input: {
  userId: string;
  email: string;
  sellerName: string;
  token?: string;
  kind: ListingKind;
  name: string;
  description: string;
  price_label: string;
  category: string;
  city: string;
  department: string;
  phone: string;
  image?: string;
  packageId?: string;
  offerKind?: OfferKind;
  itemCondition?: ItemCondition;
}): Promise<Listing> {
  const pack = AD_PACKAGES.find((p) => p.id === input.packageId);
  const now = new Date();
  const ends = pack ? new Date(now.getTime() + pack.days * 86400000) : null;
  const phoneDigits = input.phone.replace(/\D/g, "").replace(/^51/, "");
  const wa = phoneDigits ? `https://wa.me/51${phoneDigits}` : "";
  const offerKind = input.offerKind || (SERVICE_CATEGORIES.has(input.category) ? "servicio" : "articulo");
  const itemCondition = offerKind === "articulo" ? input.itemCondition || "nuevo" : undefined;
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    kind: input.kind,
    name: input.name.trim(),
    description: input.description.trim(),
    price_label: input.price_label.trim() || "Consultar",
    currency: "PEN",
    city: input.city.trim() || "Perú",
    country: "Perú",
    country_code: "PE",
    department: input.department.trim(),
    category: input.category,
    phone: input.phone.trim(),
    url: wa,
    image: input.image || "",
    images: input.image ? [input.image] : [],
    active: true,
    hidden: false,
    seller_email: input.email,
    seller_name: input.sellerName,
    origin_app: PLAZA_ORIGIN,
    visible_until: plusMonths(now, STORE_VISIBILITY_MONTHS).toISOString(),
    visibility_source: input.kind === "ad" ? "campaign" : "donation",
    offer_kind: offerKind,
    item_condition: itemCondition || null,
    // Compatibilidad con Folio PDF (mismas columnas legacy).
    offer_type: offerKind,
    condition: itemCondition || null,
  };
  if (input.kind === "ad" && pack && ends) {
    payload.campaign_package = pack.id;
    payload.campaign_starts_at = now.toISOString();
    payload.campaign_ends_at = ends.toISOString();
    payload.visible_until = ends.toISOString();
    payload.visibility_source = "campaign";
    payload.impressions_cap = pack.people;
    payload.paid_soles = pack.soles;
    payload.people = pack.people;
  }

  let { data, error } = await folio.from("listings").insert(payload).select("*").maybeSingle();
  if (error && /offer_kind|item_condition|offer_type|\bcondition\b/i.test(error.message || "")) {
    const { offer_kind: _ok, item_condition: _ic, offer_type: _ot, condition: _c, ...withoutMeta } = payload;
    ({ data, error } = await folio.from("listings").insert(withoutMeta).select("*").maybeSingle());
  }
  if (error && /origin_app/i.test(error.message || "")) {
    const { origin_app: _o, offer_kind: _ok2, item_condition: _ic2, offer_type: _ot2, condition: _c2, ...withoutOrigin } = payload;
    ({ data, error } = await folio.from("listings").insert(withoutOrigin).select("*").maybeSingle());
  }
  if (error || !data) throw new Error(error?.message || "No se pudo publicar. Entre con Google e inténtelo de nuevo.");

  const listing = asListing({
    ...(data as Record<string, unknown>),
    offer_kind: (data as Record<string, unknown>).offer_kind ?? offerKind,
    item_condition: (data as Record<string, unknown>).item_condition ?? itemCondition,
  });
  void syncControlListing({
    id: listing.id,
    name: listing.name,
    description: listing.description,
    priceLabel: listing.price_label,
    currency: "PEN",
    city: listing.city,
    country: listing.country,
    countryCode: "PE",
    department: listing.department,
    category: listing.category,
    url: listing.url,
    phone: listing.phone,
    image: listing.image,
    images: listing.images,
    sellerEmail: listing.seller_email,
    sellerName: listing.seller_name,
    sellerSub: listing.user_id,
    source: PLAZA_ORIGIN,
    kind: listing.kind,
    active: true,
    offerKind: listing.offer_kind || offerKind,
    itemCondition: listing.item_condition || itemCondition,
  });
  return listing;
}

export async function hideListing(id: string, hidden: boolean) {
  const { error } = await folio.from("listings").update({ hidden, active: !hidden }).eq("id", id);
  if (error) throw new Error(error.message);
}

export function unreadCount(threads: Thread[], userId: string) {
  return threads.reduce((n, t) => n + Math.max(0, t.buyer_id === userId ? t.buyer_unread : t.seller_unread), 0);
}

function asThread(row: Record<string, unknown>): Thread {
  return {
    id: String(row.id || ""),
    listing_id: String(row.listing_id || ""),
    buyer_id: String(row.buyer_id || ""),
    seller_id: String(row.seller_id || ""),
    listing_name: String(row.listing_name || "Aviso"),
    listing_image: String(row.listing_image || ""),
    listing_price: String(row.listing_price || ""),
    seller_name: String(row.seller_name || "Anunciante"),
    buyer_name: String(row.buyer_name || "Interesado"),
    last_body: String(row.last_body || ""),
    last_at: String(row.last_at || row.created_at || ""),
    buyer_unread: Number(row.buyer_unread || 0),
    seller_unread: Number(row.seller_unread || 0),
  };
}

export function threadPeer(t: Thread, userId: string) {
  return t.buyer_id === userId ? t.seller_name : t.buyer_name;
}

export async function fetchThreads(userId: string): Promise<Thread[]> {
  if (!userId) return [];
  const { data, error } = await folio
    .from("listing_threads")
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("last_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message || "No se pudieron cargar los mensajes.");
  return ((data as Record<string, unknown>[]) || []).map(asThread).filter((row) => row.id);
}

export async function openThread(listingId: string): Promise<string> {
  const rpc = await folio.rpc("open_listing_thread", { p_listing_id: listingId });
  if (rpc.error) throw new Error(rpc.error.message);
  const id = String(rpc.data || "");
  if (!id) throw new Error("No se pudo abrir el chat. Entre con Google.");
  return id;
}

const THREAD_KEY = "mcd-thread";
let lastThread: string | null = null;

/** El hilo se guarda porque InboxView aún no está montado cuando se dispara mcd-go. */
export function rememberThread(id: string) {
  if (!id) return;
  lastThread = id;
  try {
    sessionStorage.setItem(THREAD_KEY, id);
  } catch {
    /* ignore */
  }
}

export function lastOpenThread() {
  if (lastThread) return lastThread;
  try {
    return sessionStorage.getItem(THREAD_KEY);
  } catch {
    return null;
  }
}

export async function fetchMessages(threadId: string): Promise<ChatMsg[]> {
  const { data, error } = await folio
    .from("listing_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    thread_id: String(row.thread_id),
    sender_id: String(row.sender_id),
    body: String(row.body || ""),
    created_at: String(row.created_at || ""),
  }));
}

export async function sendMessage(threadId: string, body: string): Promise<ChatMsg | null> {
  const text = body.trim();
  if (!text) return null;
  const { data, error } = await folio.rpc("send_listing_message", { p_thread_id: threadId, p_body: text });
  if (error) throw new Error(error.message);
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  return {
    id: String(row?.id || ""),
    thread_id: String(row?.thread_id || threadId),
    sender_id: String(row?.sender_id || ""),
    body: String(row?.body || text),
    created_at: String(row?.created_at || new Date().toISOString()),
  };
}

export async function markThreadRead(threadId: string) {
  const id = threadId.trim();
  if (!id) return;
  const { error } = await folio.rpc("mark_listing_thread_read", { p_thread_id: id });
  if (error && !/schema cache|does not exist|204|PGRST/i.test(error.message)) {
    /* Folio marca leído; si el RPC aún no está, la bandeja sigue usable. */
  }
}

export type { PlazaLiveHint } from "./plazaLive";
export { subscribePlazaInbox, plazaLiveCode, plazaLiveStatus, subscribePlazaStatus } from "./plazaLive";

export async function fetchAllListings(): Promise<Listing[]> {
  const { data, error } = await folio.from("listings").select("*").order("created_at", { ascending: false }).limit(300);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(asListing);
}

export async function uploadListingPhoto(userId: string, file: File, bucket: "listings" | "ads" | "listing-photos" = "listing-photos"): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // Folio e Ingeniería comparten el bucket real `listing-photos` (RLS por user_id/).
  const target = bucket === "ads" || bucket === "listings" ? "listing-photos" : bucket;
  const { error } = await folio.storage.from(target).upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  return folio.storage.from(target).getPublicUrl(path).data.publicUrl;
}

export async function fetchProfiles(limit = 80) {
  const master = await folio
    .from("user_profiles")
    .select("user_id,display_name,phone")
    .order("display_name")
    .limit(limit);
  if (!master.error && Array.isArray(master.data) && master.data.length) {
    return master.data.map((row) => ({
      user_id: row.user_id,
      email: "",
      full_name: row.display_name || "",
      profession_label: "",
      organization: "",
      district: "",
      department: "",
      created_at: null,
    })) as Record<string, unknown>[];
  }
  const { data, error } = await folio
    .from("memorcalc_profiles")
    .select("user_id,email,full_name,profession_label,organization,district,department,created_at")
    .order("full_name")
    .limit(limit);
  if (error || !data) return [];
  return data as Record<string, unknown>[];
}

export function waLink(phone: string) {
  const n = phone.replace(/\D/g, "").replace(/^0/, "");
  if (n.length < 8) return "";
  const full = n.startsWith("51") ? n : `51${n}`;
  return `https://wa.me/${full}`;
}

export function originLabel(origin?: string) {
  if (origin === "folio-pdf") return "Publicado en Folio PDF";
  if (origin === "ingenieria") return "Publicado en Ingeniería";
  return "Plaza Folio · Ingeniería";
}

export type ListingCurrency = "PEN" | "USD";

const USD_COUNTRIES = new Set(["US", "EC", "SV", "PA", "PR", "GU", "VI"]);

function isAskPrice(label: string) {
  const text = label.trim().toLowerCase();
  if (!text) return true;
  return /^(a consultar|consultar|cotizar|a convenir)$/.test(text)
    || /\b(a consultar|consultar|cotizar|tratar|conversar|a convenir)\b/.test(text);
}

function parseListingAmount(label: string) {
  const raw = label.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function detectCurrency(label: string, countryCode?: string, hint?: string): ListingCurrency {
  const raw = label || "";
  const hasPen = /s\/|s\s*\/|\bsoles?\b|\bpen\b/i.test(raw);
  const hasUsd = /us\s*\$|usd|\bd[oó]lares?\b/i.test(raw);
  if (hasUsd && !hasPen) return "USD";
  if (hasPen) return "PEN";
  if (/\$/.test(raw) && !hasPen) return "USD";
  if (hint === "USD" || hint === "PEN") return hint;
  return USD_COUNTRIES.has(String(countryCode || "").toUpperCase()) ? "USD" : "PEN";
}

export function listingMoney(item: Pick<Listing, "price_label" | "country" | "country_code" | "currency">) {
  const label = String(item.price_label || "").trim();
  const code = item.country_code || (item.country === "Perú" ? "PE" : "");
  if (!label || isAskPrice(label)) {
    return { text: label || "Consultar", symbol: "", amount: "Consultar", currency: detectCurrency(label, code, item.currency), ask: true as const };
  }
  const n = parseListingAmount(label);
  const currency = detectCurrency(label, code, item.currency);
  const symbol = currency === "USD" ? "US$" : "S/";
  if (n == null) return { text: label, symbol, amount: label, currency, ask: false as const };
  const amount = Number.isInteger(n)
    ? n.toLocaleString("es-PE")
    : n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { text: `${symbol} ${amount}`, symbol, amount, currency, ask: false as const };
}

export function placeLabel(item: Pick<Listing, "city" | "department" | "country">) {
  const skip = new Set(["", "__all__", "__all", "null", "undefined"]);
  const parts = [item.city, item.department, item.country]
    .map((x) => String(x || "").trim())
    .filter((x) => !skip.has(x.toLowerCase()));
  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.toLowerCase() === p.toLowerCase())) uniq.push(p);
  }
  return uniq.join(" · ") || "Perú";
}

export function listingWhatsApp(item: Pick<Listing, "phone" | "url">) {
  const fromPhone = waLink(item.phone);
  if (fromPhone) return fromPhone;
  const url = String(item.url || "");
  return /wa\.me\//i.test(url) ? url : "";
}
