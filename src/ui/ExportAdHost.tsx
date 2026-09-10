import { useEffect, useMemo, useState } from "react";
import {
  EXPORT_AD_EVENT,
  EXPORT_AD_HOLD_S,
  EXPORT_AD_LOCK_S,
  listingPhotos,
  pickExportAd,
} from "../lib/exportAd";
import {
  ITEM_CONDITION_LABEL,
  OFFER_KIND_LABEL,
  listingBlurb,
  listingMoney,
  listingWhatsApp,
  placeLabel,
  resolveCondition,
  resolveOfferKind,
  type Listing,
} from "../lib/mercado";

function Cover({ src, name }: { src: string; name: string }) {
  if (src) return <img src={src} alt={name} />;
  return <span className="xad-ph" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>;
}

export function ExportAdHost() {
  const [item, setItem] = useState<Listing | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    const onAd = (e: Event) => {
      const count = Number((e as CustomEvent<{ count?: number }>).detail?.count || 0);
      void pickExportAd(count).then((row) => {
        setPhoto(0);
        setElapsed(0);
        setItem(row);
      });
    };
    window.addEventListener(EXPORT_AD_EVENT, onAd);
    return () => window.removeEventListener(EXPORT_AD_EVENT, onAd);
  }, []);

  const photos = useMemo(() => (item ? listingPhotos(item) : []), [item]);
  const remain = item ? Math.max(0, EXPORT_AD_LOCK_S - elapsed) : 0;
  const canClose = elapsed >= EXPORT_AD_LOCK_S;

  useEffect(() => {
    if (!item) return;
    const t = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [item]);

  useEffect(() => {
    if (!item || photos.length < 2) return;
    const t = window.setInterval(() => setPhoto((i) => (i + 1) % photos.length), 1000);
    return () => window.clearInterval(t);
  }, [item, photos.length]);

  useEffect(() => {
    if (item && elapsed >= EXPORT_AD_HOLD_S) setItem(null);
  }, [elapsed, item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canClose) setItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, canClose]);

  if (!item) return null;

  const money = listingMoney(item);
  const kind = resolveOfferKind(item);
  const condition = resolveCondition(item);
  const wa = listingWhatsApp(item);
  const hero = photos[photo] || "";

  const close = () => {
    if (canClose) setItem(null);
  };

  const goPlaza = () => {
    if (!canClose) return;
    setItem(null);
    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "compras" } }));
  };

  return (
    <div className="xad-scrim" role="presentation">
      <div className="xad-card" role="dialog" aria-modal="true" aria-labelledby="xad-title" aria-describedby="xad-copy">
        <header className="xad-head">
          <div>
            <p className="xad-kicker">Espacio publicitario · Plaza profesional</p>
            <p className="xad-head-note">Aviso de la vitrina de ingeniería</p>
          </div>
          <div className={`xad-timer${canClose ? " is-ready" : ""}`} aria-live="polite">
            <b>{canClose ? "Listo" : remain}</b>
            <small>{canClose ? "puede cerrar" : "segundos"}</small>
          </div>
        </header>

        <div className="xad-grid">
          <div className="xad-media">
            <div className="xad-hero">
              <Cover src={hero} name={item.name} />
              <div className={`xad-price${money.ask ? " ask" : ""}`}>
                {money.ask ? (
                  <strong>Consultar</strong>
                ) : (
                  <>
                    <em>{money.symbol}</em>
                    <strong>{money.amount}</strong>
                  </>
                )}
              </div>
              {photos.length > 1 ? (
                <span className="xad-frame">{photo + 1} / {photos.length}</span>
              ) : null}
            </div>
            {photos.length > 1 ? (
              <div className="xad-thumbs" aria-label="Fotos del aviso">
                {photos.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
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

          <aside className="xad-body">
            <div className="xad-chips">
              <span>{OFFER_KIND_LABEL[kind]}</span>
              {item.category ? <span>{item.category}</span> : null}
              {condition ? <span>{ITEM_CONDITION_LABEL[condition]}</span> : null}
            </div>
            <h2 id="xad-title">{item.name}</h2>
            <p className="xad-place">{placeLabel(item)}</p>
            <p id="xad-copy" className="xad-copy">{listingBlurb(item, 280)}</p>
            <div className="xad-seller">
              <span aria-hidden>{(item.seller_name || "A").slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{item.seller_name || "Anunciante"}</strong>
                <small>Plaza MemoriaCalc · aviso verificado</small>
              </div>
            </div>
            <div className="xad-actions">
              <button type="button" className="btn" disabled={!canClose} onClick={goPlaza}>
                Ver en la plaza
              </button>
              {wa ? (
                <a className="btn secondary" href={wa} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              ) : null}
              <button type="button" className="btn secondary" disabled={!canClose} onClick={close}>
                {canClose ? "Cerrar" : `Cerrar en ${remain}s`}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
