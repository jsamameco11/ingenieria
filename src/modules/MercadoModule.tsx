import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type FormEvent, type ReactNode } from "react";
import {
  AD_PACKAGES,
  ITEM_CONDITION_LABEL,
  OFFER_KIND_LABEL,
  STORE_CATEGORIES,
  lastOpenThread,
  fetchMine,
  fetchMessages,
  fetchThreads,
  fetchVitrina,
  listingBlurb,
  markThreadRead,
  openThread,
  listingMoney,
  listingWhatsApp,
  originLabel,
  placeLabel,
  publishListing,
  rememberThread,
  resolveCondition,
  resolveOfferKind,
  sendMessage,
  plazaLiveCode,
  subscribePlazaInbox,
  subscribePlazaStatus,
  threadPeer,
  unreadCount,
  uploadListingPhoto,
  type ChatMsg,
  type ItemCondition,
  type Listing,
  type ListingKind,
  type OfferKind,
  type Thread,
} from "../lib/mercado";
import { useAuth } from "../ui/AuthProvider";

export type MercadoVista = "vitrina" | "publicar" | "mios" | "mensajes" | "publicitar";

const AD_FAMILIES = [
  "Ingeniería civil",
  "Construcción",
  "Software y BIM",
  "Oficina técnica",
  "Capacitación",
  "Servicios profesionales",
];

function PriceTag({ item }: { item: Listing }) {
  const p = listingMoney(item);
  return (
    <div className={`mcd-price${p.ask ? " ask" : ""}`} aria-label={p.ask ? "Consultar precio" : `Precio ${p.text}`}>
      {p.ask ? (
        <strong>Consultar</strong>
      ) : (
        <>
          <em>{p.symbol}</em>
          <strong>{p.amount}</strong>
        </>
      )}
    </div>
  );
}

function MetaChips({ item }: { item: Listing }) {
  const kind = resolveOfferKind(item);
  const condition = resolveCondition(item);
  return (
    <div className="mcd-meta-chips">
      <span className={`mcd-chip kind-${kind}`}>{OFFER_KIND_LABEL[kind]}</span>
      {condition ? <span className={`mcd-chip cond-${condition}`}>{ITEM_CONDITION_LABEL[condition]}</span> : null}
      {item.category ? <span className="mcd-chip cat">{item.category}</span> : null}
    </div>
  );
}

function when(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

function Cover({ src, name }: { src: string; name: string }) {
  if (src) return <img src={src} alt={name} />;
  return <span className="mcd-cover-ph" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>;
}

const PLAZA_TABS: { id: string; vista: MercadoVista; label: string }[] = [
  { id: "compras", vista: "vitrina", label: "Vitrina" },
  { id: "compras-publicar", vista: "publicar", label: "Publicar" },
  { id: "compras-mios", vista: "mios", label: "Mis artículos" },
  { id: "mensajes", vista: "mensajes", label: "Mensajes" },
  { id: "publicitar", vista: "publicitar", label: "Publicitar" },
];

function goPlaza(page: string, thread?: string) {
  window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page, thread } }));
}

function PlazaNav({ current }: { current: MercadoVista }) {
  return (
    <nav className="plaza-tabs" aria-label="Plaza profesional">
      {PLAZA_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.vista === current ? "on" : ""}
          aria-current={t.vista === current ? "page" : undefined}
          onClick={() => goPlaza(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function PlazaEmpty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="plaza-empty">
      <span className="plaza-empty-mark" aria-hidden>MC</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && onAction ? (
        <button type="button" className="btn primary" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

class InboxErrorBoundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: Error) {
    return { err: e.message || "La bandeja no pudo abrirse." };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.warn("Mensajes", e, info.componentStack);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="plaza-desk is-inbox plaza-inbox-fallback" data-guest-ok>
        <PlazaNav current="mensajes" />
        <div className="wa-empty plaza-inbox-crash">
          <span className="plaza-empty-mark" aria-hidden>MC</span>
          <h3>No se pudo abrir Mensajes</h3>
          <p>La bandeja es la misma de Folio PDF. Recargue la página o vuelva a entrar con Google.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

export function MercadoModule({ vista }: { vista: MercadoVista }) {
  if (vista === "mensajes") return <InboxErrorBoundary><InboxView /></InboxErrorBoundary>;
  if (vista === "publicitar") return <PublishView kind="ad" />;
  if (vista === "publicar") return <PublishView kind="product" />;
  if (vista === "mios") return <MineView />;
  return <VitrinaView />;
}

function VitrinaView() {
  const { canEdit, openGoogle, user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [open, setOpen] = useState<Listing | null>(null);
  const [photo, setPhoto] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    void fetchVitrina("product").then(setItems);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== "Todas" && it.category !== cat) return false;
      if (!needle) return true;
      const kind = resolveOfferKind(it);
      const condition = resolveCondition(it);
      return `${it.name} ${it.description} ${it.city} ${it.seller_name} ${OFFER_KIND_LABEL[kind]} ${condition ? ITEM_CONDITION_LABEL[condition] : ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [items, q, cat]);

  async function messageSeller(item: Listing) {
    if (!user) {
      openGoogle();
      return;
    }
    setBusy("Abriendo Mensajes…");
    setErr("");
    try {
      const id = await openThread(item.id);
      rememberThread(id);
      setOpen(null);
      setZoom(null);
      window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "mensajes", thread: id } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo abrir el chat.");
    } finally {
      setBusy("");
    }
  }

  function openZoom(src: string, e?: { stopPropagation: () => void }) {
    e?.stopPropagation();
    if (!src) return;
    setZoom(src);
  }

  return (
    <div className="plaza-shell" data-guest-ok>
      <PlazaNav current="vitrina" />
      <header className="plaza-hero">
        <div>
          <p className="plaza-kicker">Plaza compartida · Folio PDF e Ingeniería</p>
          <h2>Compras</h2>
          <p>
            Misma vitrina que Folio PDF: artículos y servicios publicados en cualquiera de las dos apps aparecen aquí.
            El trato se cierra por Mensajes (bandeja única) o WhatsApp, con la misma cuenta Google.
          </p>
        </div>
        <dl className="plaza-kpis">
          <div>
            <dt>Avisos</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt>Categorías</dt>
            <dd>{STORE_CATEGORIES.length}</dd>
          </div>
        </dl>
      </header>
      <div className="plaza-toolbar">
          <input
            type="search"
            placeholder="Buscar equipo, software, servicio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar en la vitrina"
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
            <option>Todas</option>
            {STORE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
      </div>
      {err ? <p className="mcd-err">{err}</p> : null}
      <div className="mcd-grid">
        {filtered.map((it) => (
          <article key={it.id} className="mcd-card" onClick={() => { setOpen(it); setPhoto(0); }}>
            <div
              className={`mcd-cover${it.image ? " is-clickable" : ""}`}
              onClick={(e) => {
                if (!it.image) return;
                e.stopPropagation();
                openZoom(it.image, e);
              }}
              role={it.image ? "button" : undefined}
              tabIndex={it.image ? 0 : undefined}
              onKeyDown={(e) => {
                if (!it.image) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  openZoom(it.image);
                }
              }}
              aria-label={it.image ? `Ver foto completa de ${it.name}` : undefined}
            >
              <Cover src={it.image} name={it.name} />
              <PriceTag item={it} />
            </div>
            <div className="mcd-card-body">
              <MetaChips item={it} />
              <h3>{it.name}</h3>
              <p className="mcd-card-blurb">{listingBlurb(it)}</p>
              <p className="mcd-card-place">{placeLabel(it)}</p>
              <div className="mcd-card-foot">
                <span>{it.origin_app === "folio-pdf" ? "Folio PDF" : "Ingeniería"}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <PlazaEmpty
          title={items.length ? "Ningún aviso coincide con el filtro" : "Sin avisos visibles"}
          text={
            items.length
              ? "Pruebe otra categoría o quite el texto de búsqueda."
              : "La plaza comparte la misma vitrina y la misma bandeja que Folio PDF. Publique un aviso o recargue si ya hay artículos en Folio."
          }
          action={items.length ? undefined : "Publicar artículo"}
          onAction={items.length ? undefined : () => goPlaza("compras-publicar")}
        />
      ) : null}

      {open ? (
        <div className="mcd-scrim" onClick={() => { setOpen(null); setPhoto(0); }} role="presentation">
          <div className="mcd-modal mcd-modal-detail" role="dialog" aria-labelledby="mcd-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mcd-x" onClick={() => { setOpen(null); setPhoto(0); }} aria-label="Cerrar">
              ×
            </button>
            <div className="mcd-modal-stack">
              <div className="mcd-modal-photo">
                <div
                  className={`mcd-modal-hero${(open.images[photo] || open.image) ? " is-clickable" : ""}`}
                  onClick={() => openZoom(open.images[photo] || open.image)}
                  role={(open.images[photo] || open.image) ? "button" : undefined}
                  tabIndex={(open.images[photo] || open.image) ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openZoom(open.images[photo] || open.image);
                    }
                  }}
                  aria-label={(open.images[photo] || open.image) ? `Ver foto de ${open.name}` : undefined}
                >
                  <Cover src={open.images[photo] || open.image} name={open.name} />
                  <PriceTag item={open} />
                </div>
                {open.images.length > 1 ? (
                  <div className="mcd-thumbs">
                    {open.images.map((src, i) => (
                      <button
                        key={src}
                        type="button"
                        className={i === photo ? "on" : ""}
                        onClick={() => setPhoto(i)}
                        aria-label={`Foto ${i + 1}`}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <aside>
                <MetaChips item={open} />
                <p className="mcd-kicker">
                  {when(open.created_at) ? when(open.created_at) : "Plaza"}
                  {resolveOfferKind(open) === "servicio" ? " · servicio profesional" : ""}
                  {resolveCondition(open) ? ` · ${ITEM_CONDITION_LABEL[resolveCondition(open)!].toLowerCase()}` : ""}
                </p>
                <h3 id="mcd-title">{open.name}</h3>
                <p className="mcd-place">{placeLabel(open)}</p>
                <p className="mcd-copy">{listingBlurb(open, 2000)}</p>
                <div className="mcd-seller">
                  <span className="mcd-seller-mark" aria-hidden>{(open.seller_name || "F").slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{open.seller_name}</strong>
                    <small>{originLabel(open.origin_app)} · anunciante verificado</small>
                  </div>
                </div>
                <div className="mcd-actions">
                  <button
                    type="button"
                    className="btn primary mcd-cta"
                    disabled={Boolean(busy) || open.user_id === user?.id}
                    onClick={() => void messageSeller(open)}
                  >
                    {busy || (canEdit ? "Mensajes" : "Entrar y abrir Mensajes")}
                  </button>
                  {listingWhatsApp(open) ? (
                    <a className="btn secondary" href={listingWhatsApp(open)} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  ) : null}
                </div>
                <p className="mcd-trust">
                  Use Mensajes para escribir al vendedor con la misma cuenta Google. WhatsApp es opcional si el aviso lo publica.
                </p>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {zoom ? (
        <div className="mcd-lightbox" onClick={() => setZoom(null)} role="presentation">
          <div className="mcd-lightbox-panel" role="dialog" aria-label="Foto ampliada" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mcd-lightbox-x" onClick={() => setZoom(null)} aria-label="Cerrar foto">
              ×
            </button>
            <img src={zoom} alt="Foto ampliada del aviso" />
            <p className="mcd-lightbox-hint">Foto completa · pulse fuera o × para cerrar</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PublishView({ kind }: { kind: ListingKind }) {
  const { user, profile, canEdit, openGoogle } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Construcción");
  const [offerKind, setOfferKind] = useState<OfferKind>("articulo");
  const [itemCondition, setItemCondition] = useState<ItemCondition>("nuevo");
  const [city, setCity] = useState(profile?.district || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [pack, setPack] = useState<(typeof AD_PACKAGES)[number]["id"]>("ad-1500");
  const [families, setFamilies] = useState<string[]>(["Ingeniería civil"]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !canEdit) {
      openGoogle();
      return;
    }
    setBusy(kind === "ad" ? "Publicando campaña…" : "Publicando aviso…");
    setErr("");
    setOk("");
    try {
      let image = "";
      if (file) {
        try {
          image = await uploadListingPhoto(user.id, file, "listing-photos");
        } catch (photoErr) {
          throw new Error(
            photoErr instanceof Error
              ? `No se pudo subir la foto: ${photoErr.message}`
              : "No se pudo subir la foto del aviso.",
          );
        }
      }
      await publishListing({
        userId: user.id,
        email: user.email || profile?.email || "",
        sellerName: profile?.full_name || user.email || "Anunciante",
        kind,
        name,
        description: kind === "ad" ? `${description}\n\nAudiencia: ${families.join(", ")}.` : description,
        price_label: kind === "ad" ? "Campaña" : price,
        category,
        city,
        department,
        phone,
        image,
        packageId: kind === "ad" ? pack : undefined,
        offerKind: kind === "product" ? offerKind : undefined,
        itemCondition: kind === "product" && offerKind === "articulo" ? itemCondition : undefined,
      });
      setOk(
        kind === "ad"
          ? "Campaña al aire en la plaza compartida (Folio PDF e Ingeniería)."
          : `${offerKind === "servicio" ? "Servicio" : "Artículo"} publicado. Ya es visible en Folio PDF e Ingeniería, con la misma bandeja de mensajes.`,
      );
      setName("");
      setDescription("");
      setPrice("");
      setFile(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "No se pudo publicar.");
    } finally {
      setBusy("");
    }
  }

  const chosen = AD_PACKAGES.find((p) => p.id === pack);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <div className="plaza-shell" data-guest-ok>
      <PlazaNav current={kind === "ad" ? "publicitar" : "publicar"} />
      <header className="plaza-hero">
        <div>
          <p className="plaza-kicker">{kind === "ad" ? "Alcance profesional" : "Nuevo aviso"}</p>
          <h2>{kind === "ad" ? "Publicitar" : "Publicar artículo"}</h2>
          <p>
            {kind === "ad"
              ? "Campañas de alcance en la plaza compartida Folio PDF · Ingeniería. Elige el paquete; al publicar se pide la misma cuenta Google."
              : "El aviso queda en la misma vitrina de Folio PDF. Misma cuenta, mismos mensajes. Ingeniería no cobra la venta."}
          </p>
        </div>
      </header>

      <div className="plaza-compose">
        <form className="plaza-form" onSubmit={(e) => void onSubmit(e)}>
          <p className="plaza-form-kicker">1 · Datos del aviso</p>
          <label>
            Título
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ej. Estación total, licencia SAP2000, supervisión de obra" />
          </label>
          <label>
            Descripción
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} maxLength={2000} placeholder="Qué ofrece, estado, alcance y condiciones." />
          </label>
          {kind === "product" ? (
            <>
              <label>
                Precio (S/)
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="S/ 1 200 o Consultar" />
              </label>
              <div className="mcd-row">
                <label>
                  Tipo
                  <select
                    value={offerKind}
                    onChange={(e) => {
                      const next = e.target.value as OfferKind;
                      setOfferKind(next);
                      if (next === "servicio" && (category === "Construcción" || category === "Tecnología" || category === "Oficina")) {
                        setCategory("Servicios");
                      }
                    }}
                  >
                    <option value="servicio">Servicio</option>
                    <option value="articulo">Artículo</option>
                  </select>
                </label>
                {offerKind === "articulo" ? (
                  <label>
                    Estado
                    <select value={itemCondition} onChange={(e) => setItemCondition(e.target.value as ItemCondition)}>
                      <option value="nuevo">Nuevo</option>
                      <option value="usado">Usado</option>
                      <option value="reacondicionado">Reacondicionado</option>
                    </select>
                  </label>
                ) : (
                  <label>
                    Estado
                    <input value="No aplica (servicio)" disabled />
                  </label>
                )}
              </div>
            </>
          ) : (
            <fieldset className="mcd-packs">
              <legend>Paquete de alcance</legend>
              {AD_PACKAGES.map((p) => (
                <label key={p.id} className={pack === p.id ? "on" : ""}>
                  <input type="radio" name="pack" checked={pack === p.id} onChange={() => setPack(p.id)} />
                  <span>
                    <b>{p.people.toLocaleString("es-PE")} personas</b>
                    <small>
                      {p.days} días · S/ {p.soles}
                    </small>
                  </span>
                </label>
              ))}
              {chosen ? (
                <p className="mcd-quote">
                  Cotización: {chosen.people.toLocaleString("es-PE")} impresiones · {chosen.days} días ·{" "}
                  <b>S/ {chosen.soles}</b>. Las campañas se cierran por WhatsApp.
                </p>
              ) : null}
            </fieldset>
          )}
          {kind === "ad" ? (
            <fieldset className="mcd-chips">
              <legend>Familias de audiencia</legend>
              {AD_FAMILIES.map((f) => {
                const on = families.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    className={on ? "on" : ""}
                    onClick={() => setFamilies((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))}
                  >
                    {f}
                  </button>
                );
              })}
            </fieldset>
          ) : null}

          <p className="plaza-form-kicker">2 · Ubicación y contacto</p>
          <label>
            Categoría
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {STORE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="mcd-row">
            <label>
              Ciudad / distrito
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chiclayo" />
            </label>
            <label>
              Departamento
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Lambayeque" />
            </label>
          </div>
          <label>
            Celular WhatsApp
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="999 888 777" inputMode="tel" />
          </label>
          <label className="plaza-file">
            Foto
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? <small>{file.name}</small> : <small>JPG o PNG, una imagen de portada</small>}
          </label>
          {err ? <p className="mcd-err">{err}</p> : null}
          {ok ? <p className="mcd-ok">{ok}</p> : null}
          <button type="submit" className="btn primary plaza-submit" disabled={Boolean(busy)}>
            {busy || (kind === "ad" ? "Publicar campaña" : "Publicar en la vitrina")}
          </button>
        </form>

        <aside className="plaza-preview" aria-label="Vista previa">
          <p className="plaza-form-kicker">Vista previa</p>
          <article className="mcd-card plaza-preview-card">
            <div className="mcd-cover">
              <Cover src={previewUrl} name={name || "Aviso"} />
              <PriceTag
                item={{
                  id: "preview",
                  kind: kind === "ad" ? "ad" : "product",
                  name: name || "Aviso",
                  description: description || "",
                  price_label: kind === "ad" ? (chosen ? `S/ ${chosen.soles}` : "Campaña") : price || "Consultar",
                  category,
                  city,
                  country: "Perú",
                  country_code: "PE",
                  department,
                  phone: "",
                  url: "",
                  image: previewUrl,
                  images: previewUrl ? [previewUrl] : [],
                  active: true,
                  hidden: false,
                  seller_name: "Usted",
                  seller_email: "",
                  user_id: "",
                  created_at: "",
                  offer_kind: offerKind,
                  item_condition: offerKind === "articulo" ? itemCondition : undefined,
                }}
              />
            </div>
            <div className="mcd-card-body">
              <MetaChips
                item={{
                  id: "preview",
                  kind: "product",
                  name: name || "Aviso",
                  description: description || "",
                  price_label: price || "Consultar",
                  category,
                  city,
                  country: "Perú",
                  country_code: "PE",
                  department,
                  phone: "",
                  url: "",
                  image: "",
                  images: [],
                  active: true,
                  hidden: false,
                  seller_name: "",
                  seller_email: "",
                  user_id: "",
                  created_at: "",
                  offer_kind: kind === "ad" ? "servicio" : offerKind,
                  item_condition: offerKind === "articulo" ? itemCondition : undefined,
                }}
              />
              <h3>{name || "Título del aviso"}</h3>
              <p className="mcd-card-blurb">{listingBlurb({ description: description || "La descripción aparecerá aquí." })}</p>
              <p className="mcd-card-place">{city || department ? [city, department].filter(Boolean).join(", ") : "Ubicación"}</p>
              <div className="mcd-card-foot">
                <span>Ingeniería</span>
              </div>
            </div>
          </article>
          <p className="plaza-preview-note">
            Así se verá en la vitrina de Ingeniería y de Folio PDF. Puede seguir editando antes de publicar.
          </p>
        </aside>
      </div>
    </div>
  );
}

function statusOf(it: Listing) {
  if (it.hidden) return { label: "Oculto", cls: "mute" };
  if (it.kind === "ad") return { label: "Campaña", cls: "ad" };
  if (it.active) return { label: "Activo", cls: "ok" };
  return { label: "Inactivo", cls: "mute" };
}

function MineView() {
  const { user } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [filtro, setFiltro] = useState<"all" | "product" | "ad">("all");

  useEffect(() => {
    if (!user) return;
    void fetchMine(user.id).then(setItems);
  }, [user]);

  const shown = items.filter((it) => (filtro === "all" ? true : it.kind === filtro));
  const nActivos = items.filter((it) => it.active && !it.hidden && it.kind !== "ad").length;
  const nAds = items.filter((it) => it.kind === "ad").length;

  return (
    <div className="plaza-shell" data-guest-ok>
      <PlazaNav current="mios" />
      <header className="plaza-hero">
        <div>
          <p className="plaza-kicker">Su vitrina</p>
          <h2>Mis artículos</h2>
          <p>
            {user
              ? "Avisos de esta cuenta en la plaza compartida. Lo que publique aquí también se ve en Folio PDF."
              : "Puede revisar la plaza sin clave. Al publicar se pedirá la misma cuenta Google de Folio."}
          </p>
        </div>
        <div className="plaza-hero-side">
          <dl className="plaza-kpis">
            <div>
              <dt>Avisos</dt>
              <dd>{items.length}</dd>
            </div>
            <div>
              <dt>Activos</dt>
              <dd>{nActivos}</dd>
            </div>
            <div>
              <dt>Campañas</dt>
              <dd>{nAds}</dd>
            </div>
          </dl>
          <button type="button" className="btn primary" onClick={() => goPlaza("compras-publicar")}>
            Publicar aviso
          </button>
        </div>
      </header>

      {items.length > 0 ? (
        <div className="plaza-toolbar">
          <div className="plaza-seg">
            <button type="button" className={filtro === "all" ? "on" : ""} onClick={() => setFiltro("all")}>
              Todos
            </button>
            <button type="button" className={filtro === "product" ? "on" : ""} onClick={() => setFiltro("product")}>
              Artículos
            </button>
            <button type="button" className={filtro === "ad" ? "on" : ""} onClick={() => setFiltro("ad")}>
              Campañas
            </button>
          </div>
        </div>
      ) : null}

      {shown.length ? (
        <ul className="plaza-mine">
          {shown.map((it) => {
            const st = statusOf(it);
            return (
              <li key={it.id} className="plaza-mine-item">
                <div className="plaza-mine-cover">
                  <Cover src={it.image} name={it.name} />
                </div>
                <div className="plaza-mine-body">
                  <div className="plaza-mine-top">
                    <small>{it.kind === "ad" ? "Campaña" : it.category}</small>
                    <span className={`plaza-pill ${st.cls}`}>{st.label}</span>
                  </div>
                  <h3>{it.name}</h3>
                  <p>
                    {placeLabel(it)}
                    {when(it.created_at) ? ` · ${when(it.created_at)}` : ""}
                  </p>
                </div>
                <strong className="plaza-mine-price">{listingMoney(it).text}</strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <PlazaEmpty
          title={user ? (items.length ? "Nada en este filtro" : "Aún no tiene avisos") : "Entre para ver su vitrina"}
          text={
            user
              ? items.length
                ? "Cambie el filtro o publique un nuevo aviso."
                : "Publique un artículo o una campaña. Quedará visible en Ingeniería y en Folio PDF."
              : "Con la misma cuenta Google de Folio podrá administrar aquí sus avisos."
          }
          action={user ? "Publicar artículo" : undefined}
          onAction={user ? () => goPlaza("compras-publicar") : undefined}
        />
      )}
    </div>
  );
}

function clock(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function InboxView() {
  const { user, openGoogle } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(() => lastOpenThread());
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const [readyInbox, setReadyInbox] = useState(false);
  const [live, setLive] = useState(false);
  const [link, setLink] = useState({ status: "off" as "off" | "connecting" | "live" | "reconnecting", code: "MC-0000" });
  const [boot, setBoot] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<{ thread?: string }>).detail?.thread;
      if (id) {
        rememberThread(id);
        setActive(id);
      }
    };
    window.addEventListener("mcd-go", go);
    return () => window.removeEventListener("mcd-go", go);
  }, []);

  useEffect(() => {
    if (!user) {
      setThreads([]);
      setReadyInbox(true);
      setLive(false);
      setBoot(false);
      return;
    }
    setLink({ status: "connecting", code: plazaLiveCode(user.id) });
    setBoot(true);
    let alive = true;
    const load = () => {
      void fetchThreads(user.id)
        .then((rows) => {
          if (!alive) return;
          setThreads(rows);
          setReadyInbox(true);
          setErr("");
        })
        .catch((e) => {
          if (!alive) return;
          setReadyInbox(true);
          setErr(e instanceof Error ? e.message : "No se pudieron cargar los mensajes.");
        });
    };
    load();
    const stopLive = subscribePlazaInbox((hint) => {
      const openId = activeRef.current;
      if (hint?.message && openId && hint.message.thread_id === openId) {
        setMsgs((rows) => (rows.some((m) => m.id === hint.message?.id) ? rows : [...rows, hint.message!]));
        void markThreadRead(openId);
      }
      load();
    });
    const stopStatus = subscribePlazaStatus((next, nextCode) => {
      setLink({ status: next, code: nextCode || plazaLiveCode(user.id) });
      setLive(next === "live");
      if (next === "live") setBoot(false);
    });
    const hideBoot = window.setTimeout(() => setBoot(false), 5000);
    return () => {
      alive = false;
      stopLive();
      stopStatus();
      window.clearTimeout(hideBoot);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const tick = () => {
      void fetchThreads(user.id).then(setThreads).catch(() => undefined);
    };
    const poll = window.setInterval(tick, live ? 20000 : active ? 3000 : 12000);
    return () => window.clearInterval(poll);
  }, [user, active, live]);

  useEffect(() => {
    if (!active) {
      setMsgs([]);
      return;
    }
    rememberThread(active);
    let alive = true;
    const load = () => {
      void fetchMessages(active).then((rows) => {
        if (alive) setMsgs(rows);
      });
    };
    load();
    void markThreadRead(active);
    const poll = window.setInterval(load, live ? 12000 : 3000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [active, live]);

  useEffect(() => {
    if (!user) {
      setActive(null);
      return;
    }
    if (!readyInbox) return;
    if (active && threads.length && !threads.some((t) => t.id === active)) {
      const remembered = lastOpenThread();
      if (remembered && threads.some((t) => t.id === remembered)) setActive(remembered);
      return;
    }
    if (!active) {
      const id = lastOpenThread();
      if (id && threads.some((t) => t.id === id)) setActive(id);
    }
  }, [user, readyInbox, threads, active]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, active]);

  const current = threads.find((t) => t.id === active) ?? null;
  const shown = threads.filter((t) => {
    if (!user) return false;
    if (filter === "buy" && t.buyer_id !== user.id) return false;
    if (filter === "sell" && t.seller_id !== user.id) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const peer = threadPeer(t, user.id);
    return `${t.listing_name} ${peer} ${t.last_body}`.toLowerCase().includes(needle);
  });
  const pending = user ? unreadCount(threads, user.id) : 0;

  async function send() {
    if (!user) {
      openGoogle();
      return;
    }
    if (!active || !draft.trim()) return;
    const text = draft.trim();
    const local: ChatMsg = {
      id: `local-${Date.now()}`,
      thread_id: active,
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
    };
    setDraft("");
    setErr("");
    setMsgs((rows) => [...rows, local]);
    try {
      const sent = await sendMessage(active, text);
      setMsgs((rows) => {
        const without = rows.filter((m) => m.id !== local.id && m.id !== sent?.id);
        return sent?.id ? [...without, sent] : without;
      });
      setThreads(await fetchThreads(user.id));
    } catch (e) {
      setMsgs((rows) => rows.filter((m) => m.id !== local.id));
      setDraft(text);
      setErr(e instanceof Error ? e.message : "No se pudo enviar.");
    }
  }

  return (
    <div className="plaza-desk is-inbox" data-guest-ok>
      <PlazaNav current="mensajes" />
      {user && boot && link.status !== "live" && link.status !== "off" ? (
        <div className="wa-boot" role="status" aria-live="polite">
          <p className="plaza-kicker">Enlace seguro · plaza Folio</p>
          <strong className="wa-boot-code">{link.code}</strong>
          <p>
            {link.status === "reconnecting"
              ? "Reconectando el canal en vivo…"
              : "Abriendo el socket autenticado con su sesión Google."}
          </p>
          <i className="wa-boot-bar" aria-hidden />
        </div>
      ) : null}
    <div className={`wa-shell${active && current ? " has-chat" : ""}`}>
      <aside className="wa-list">
        <header className="wa-list-head">
          <div>
            <p className="plaza-kicker">Bandeja única · Folio PDF e Ingeniería</p>
            <h2>Mensajes</h2>
          </div>
          <div className="wa-head-meta">
            <span className={`wa-live${live ? " on" : link.status === "reconnecting" ? " wait" : ""}`}>
              {live ? `En vivo · ${link.code}` : link.status === "reconnecting" ? `Reenlace · ${link.code}` : `Enlace · ${link.code}`}
            </span>
            {pending > 0 ? <span className="wa-badge">{pending}</span> : null}
          </div>
        </header>
        <div className="wa-filters">
          <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
            Todos
          </button>
          <button type="button" className={filter === "buy" ? "on" : ""} onClick={() => setFilter("buy")}>
            Compras
          </button>
          <button type="button" className={filter === "sell" ? "on" : ""} onClick={() => setFilter("sell")}>
            Ventas
          </button>
        </div>
        <input
          className="wa-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar un chat…"
          aria-label="Buscar conversación"
        />
        <div className="wa-threads">
          {!user ? (
            <div className="wa-empty">
              <span className="plaza-empty-mark sm" aria-hidden>MC</span>
              <h3>Inicie sesión para ver sus chats</h3>
              <p>Misma cuenta Google que Folio PDF. Si un interesado escribe desde Folio sobre un aviso de Ingeniería (o al revés), el hilo aparece aquí en vivo.</p>
              <button type="button" className="btn primary" onClick={openGoogle}>
                Continuar con Google
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div className="wa-empty">
              <span className="plaza-empty-mark sm" aria-hidden>MC</span>
              <h3>{err ? "No se pudo cargar la bandeja" : "Sin conversaciones"}</h3>
              <p>{err || "Cuando un interesado escriba desde la vitrina de Ingeniería o de Folio PDF, el chat se abre en esta columna."}</p>
              <button type="button" className="btn secondary" onClick={() => goPlaza("compras")}>
                Ir a la vitrina
              </button>
            </div>
          ) : (
            shown.map((t) => {
              const peer = threadPeer(t, user.id);
              const unread = t.buyer_id === user.id ? t.buyer_unread : t.seller_unread;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`wa-item${t.id === active ? " on" : ""}`}
                  onClick={() => {
                    setActive(t.id);
                    rememberThread(t.id);
                  }}
                >
                  <span className="wa-avatar" aria-hidden>
                    {t.listing_image ? <img src={t.listing_image} alt="" /> : (peer || "C").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="wa-item-body">
                    <strong>{peer || "Contacto"}</strong>
                    <small>{t.listing_name || "Aviso"}</small>
                    <em>{t.last_body || "Sin mensajes"}</em>
                  </span>
                  <span className="wa-item-meta">
                    <time>{clock(t.last_at)}</time>
                    {unread > 0 ? <i>{unread > 9 ? "9+" : unread}</i> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>
      <section className="wa-pane">
        {current && user ? (
          <>
            <header className="wa-pane-head">
              <button type="button" className="wa-back" onClick={() => setActive(null)} aria-label="Volver a chats">
                ←
              </button>
              <span className="wa-avatar sm" aria-hidden>
                {current.listing_image ? (
                  <img src={current.listing_image} alt="" />
                ) : (
                  (threadPeer(current, user.id) || "C").slice(0, 1).toUpperCase()
                )}
              </span>
              <div>
                <strong>{threadPeer(current, user.id) || "Contacto"}</strong>
                <small>
                  {current.listing_name}
                  {current.listing_price ? ` · ${current.listing_price}` : ""}
                  {" · mismo chat que Folio PDF"}
                </small>
              </div>
            </header>
            <div className="wa-msgs">
              {msgs.map((m) => (
                <p key={m.id} className={m.sender_id === user.id ? "mine" : ""}>
                  {m.body}
                  <time>{clock(m.created_at)}</time>
                </p>
              ))}
              <div ref={endRef} />
            </div>
            {err ? <p className="mcd-err wa-err">{err}</p> : null}
            <form
              className="wa-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                placeholder="Escriba un mensaje"
                aria-label="Mensaje"
              />
              <button type="submit" className="btn primary" disabled={!draft.trim()}>
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="wa-pane-empty">
            <span className="plaza-empty-mark" aria-hidden>MC</span>
            <h3>Seleccione un chat</h3>
            <p>Los hilos de Folio PDF e Ingeniería aparecen a la izquierda, en vivo. En el teléfono, pulse un contacto para abrir la conversación.</p>
          </div>
        )}
      </section>
    </div>
    </div>
  );
}
