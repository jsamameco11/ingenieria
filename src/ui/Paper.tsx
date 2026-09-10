import type { ReactNode } from "react";
import type { Block, MemoriaDoc } from "../lib/memoria";

type PhotoBlock = Extract<Block, { type: "photo" }>;
type TableBlock = Extract<Block, { type: "table" }>;

export function Paper({
  doc,
  extra,
  renderFigure,
  fieldValues,
  fieldByLabel,
  onEditField,
}: {
  doc: MemoriaDoc;
  extra?: ReactNode;
  renderFigure?: (part: string) => ReactNode;
  /** Valores actuales para edición en hoja */
  fieldValues?: Record<string, string>;
  /** Mapa etiqueta → clave de campo */
  fieldByLabel?: Record<string, string>;
  onEditField?: (key: string, value: string) => void;
}) {
  const isTas = doc.codigo.startsWith("TAS");
  const [cover, ...rest] = doc.blocks;
  const splitIdx = isTas
    ? rest.findIndex(
        (b) =>
          b.type === "h2" &&
          (b.text === "Ficha del inmueble" || /^1\./.test(b.text))
      )
    : -1;
  const front = splitIdx >= 0 ? rest.slice(0, splitIdx) : [];
  const body = splitIdx >= 0 ? rest.slice(splitIdx) : rest;
  const edit = onEditField && fieldByLabel ? { fieldValues, fieldByLabel, onEditField } : undefined;

  return (
    <div className="paper-wrap">
      <div className="print-running print-running-top" aria-hidden>
        <span>{isTas ? "Informe de tasación" : "Memoria de cálculo"}</span>
        <strong>{doc.titulo}</strong>
        <span>{doc.norma}</span>
      </div>
      <article className={isTas ? "paper paper-tas" : "paper"} spellCheck={false}>
        {isTas ? (
          <div className="doc-front">
            <div className="doc-letterhead">
              <div>
                <strong>MemoriaCalc</strong>
                <span>Peritaje y valuación de inmuebles</span>
              </div>
              <div>
                <span>{doc.codigo}</span>
                <span>{doc.norma}</span>
              </div>
            </div>
            {cover ? <BlockView b={cover} tas /> : null}
            {extra}
            {renderBlocks(front, renderFigure, true, edit)}
          </div>
        ) : (
          <>
            {cover ? <BlockView b={cover} /> : null}
            {extra}
          </>
        )}
        {renderBlocks(isTas ? body : rest, renderFigure, isTas, edit)}
      </article>
      <div className="print-running print-running-bottom" aria-hidden>
        <span>MemoriaCalc</span>
        <span>{isTas ? "R.M. 172-2016-Vivienda · Verificar contra la edición vigente" : `Verificar contra la edición vigente de ${doc.norma}`}</span>
        <span>{isTas ? "Informe de valuación" : "Documento de ingeniería"}</span>
      </div>
    </div>
  );
}

type EditCtx = {
  fieldValues?: Record<string, string>;
  fieldByLabel: Record<string, string>;
  onEditField: (key: string, value: string) => void;
};

function renderBlocks(
  blocks: Block[],
  renderFigure: ((part: string) => ReactNode) | undefined,
  tas: boolean,
  edit?: EditCtx
) {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "photo") {
      const photos: PhotoBlock[] = [];
      while (i < blocks.length && blocks[i].type === "photo") {
        photos.push(blocks[i] as PhotoBlock);
        i++;
      }
      if (photos.length > 1) {
        out.push(
          <div className="tas-gallery" key={`gal-${i}`}>
            {photos.map((p, j) => (
              <PhotoFigure key={j} b={p} />
            ))}
          </div>
        );
      } else {
        out.push(<PhotoFigure key={`ph-${i}`} b={photos[0]} />);
      }
      continue;
    }
    out.push(<BlockView key={i} b={b} renderFigure={renderFigure} tas={tas} edit={edit} />);
    i++;
  }
  return out;
}

function LeyendaFoto({ caption }: { caption: string }) {
  const m = caption.match(/^(Imagen\s+\d{2}\.|Fig\.\s+\d{2}\.)\s*(.*)$/i);
  if (!m) return <>{caption}</>;
  return (
    <>
      <span className="tas-photo-code">{m[1]}</span> <span className="tas-photo-title">{m[2]}</span>
    </>
  );
}

function PhotoFigure({ b }: { b: PhotoBlock }) {
  return (
    <figure className="tas-photo">
      {b.src ? <img src={b.src} alt={b.caption} /> : <div className="tas-photo-ph">{b.placeholder ?? "Inserte la fotografía"}</div>}
      <figcaption>
        <LeyendaFoto caption={b.caption} />
      </figcaption>
    </figure>
  );
}

function tableClass(b: TableBlock) {
  const v = b.variant ?? (b.headers.length >= 8 ? "wide" : b.headers.length >= 5 ? "valores" : undefined);
  return ["data", v ? `data-${v}` : ""].filter(Boolean).join(" ");
}

function BlockView({
  b,
  renderFigure,
  tas,
  edit,
}: {
  b: Block;
  renderFigure?: (part: string) => ReactNode;
  tas?: boolean;
  edit?: EditCtx;
}) {
  if (b.type === "cover") {
    const mid = Math.ceil(b.meta.length / 2);
    return (
      <header className={tas ? "doc-cover" : undefined}>
        <div className="doc-kicker">{b.kicker ?? (tas ? "Informe de tasación" : "Memoria de cálculo")}</div>
        <h1 className="doc-title">{b.titulo}</h1>
        <p className="doc-sub">{b.subtitulo}</p>
        <div className="rule" />
        {tas ? (
          <div className="doc-cover-meta">
            <Kv rows={b.meta.slice(0, mid)} />
            <Kv rows={b.meta.slice(mid)} />
          </div>
        ) : (
          <Kv rows={b.meta} />
        )}
      </header>
    );
  }
  if (b.type === "h1") return <h2>{b.text}</h2>;
  if (b.type === "h2") return <h2>{b.text}</h2>;
  if (b.type === "h3") return <h3>{b.text}</h3>;
  if (b.type === "p") return <p>{b.text}</p>;
  if (b.type === "note") return <div className="note">{b.text}</div>;
  if (b.type === "eq")
    return (
      <div className="eq">
        {b.text}
        {b.num ? <span>({b.num})</span> : null}
      </div>
    );
  if (b.type === "kv") return <Kv rows={b.rows} edit={edit} />;
  if (b.type === "kpis") {
    return (
      <div className="doc-kpis">
        {b.items.map((it) => (
          <article key={it.label}>
            <span>{it.label}</span>
            <b>{it.value}</b>
            {it.hint ? <small>{it.hint}</small> : null}
          </article>
        ))}
      </div>
    );
  }
  if (b.type === "firma") {
    return (
      <div className="doc-firma">
        <div>
          <i />
          <strong>{b.perito}</strong>
          <span>Perito tasador</span>
        </div>
      </div>
    );
  }
  if (b.type === "gallery") {
    return (
      <div className="tas-gallery">
        {b.items.map((it, i) => (
          <figure className="tas-photo" key={`${it.caption}-${i}`}>
            {it.src ? <img src={it.src} alt={it.caption} /> : <div className="tas-photo-ph">{it.placeholder ?? "Inserte la fotografía"}</div>}
            <figcaption>
              <LeyendaFoto caption={it.caption} />
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }
  if (b.type === "table") {
    return (
      <div className="table-scroll">
      <table className={tableClass(b)}>
        {b.caption ? <caption>{b.caption}</caption> : null}
        <thead>
          <tr>
            {b.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i} className={r[0] === "◀" ? "is-case" : /total|^Σ/i.test(r[0] ?? "") ? "is-total" : undefined}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    );
  }
  if (b.type === "check") {
    return (
      <div className={`check ${b.ok ? "ok" : "bad"}`}>
        <span className="stamp">{b.ok ? "CUMPLE" : "NO CUMPLE"}</span>
        <span>{b.text}</span>
      </div>
    );
  }
  if (b.type === "list") {
    return (
      <ul>
        {b.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    );
  }
  if (b.type === "paso") {
    const lineas = (b.sustituye ?? "")
      .split(/\s*·\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    const multi = lineas.length > 1;
    return (
      <section className="paso">
        <div className="paso-kicker">Paso {b.n}</div>
        <h4>{b.titulo}</h4>
        {b.formula ? (
          <div className="paso-row">
            <span className="paso-lab">Fórmula</span>
            <div className="eq">{b.formula}</div>
          </div>
        ) : null}
        {b.desarrollo && b.desarrollo.length ? (
          <div className="paso-row">
            <span className="paso-lab">Desarrollo</span>
            <ol className="paso-des">
              {b.desarrollo.map((ln, i) => (
                <li key={i}>{ln}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {b.sustituye ? (
          <div className="paso-row">
            <span className="paso-lab">Sustitución</span>
            {multi ? (
              <ul className="paso-des">
                {lineas.map((ln, i) => (
                  <li key={i}>{ln}</li>
                ))}
              </ul>
            ) : (
              <p>{b.sustituye}</p>
            )}
          </div>
        ) : null}
        <div className="paso-row paso-res">
          <span className="paso-lab">Resultado</span>
          <p>{b.resultado}</p>
        </div>
        {b.interpreta ? (
          <div className="paso-row">
            <span className="paso-lab">Criterio</span>
            <p className="paso-nota">{b.interpreta}</p>
          </div>
        ) : null}
      </section>
    );
  }
  if (b.type === "figure") {
    return <>{renderFigure?.(b.part) ?? null}</>;
  }
  if (b.type === "photo") {
    return <PhotoFigure b={b} />;
  }
  return null;
}

function Kv({
  rows,
  edit,
}: {
  rows: { k: string; v: string; u?: string }[];
  edit?: EditCtx;
}) {
  return (
    <table className={`kv${edit ? " kv-edit" : ""}`}>
      <tbody>
        {rows.map((r) => {
          const key = edit?.fieldByLabel[r.k];
          const live = key && edit?.fieldValues ? edit.fieldValues[key] ?? r.v : r.v;
          return (
            <tr key={r.k}>
              <td className="k">{r.k}</td>
              <td className="v">
                {key && edit ? (
                  <input
                    className="kv-input"
                    value={live}
                    spellCheck={false}
                    aria-label={r.k}
                    onChange={(e) => edit.onEditField(key, e.target.value)}
                  />
                ) : (
                  live
                )}
              </td>
              <td className="u">{r.u ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
