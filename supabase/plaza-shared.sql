-- Plaza compartida Folio PDF ↔ Ingeniería (MemoriaCalc)
-- Un solo catálogo de artículos y una sola bandeja de mensajes.

alter table public.listings
  add column if not exists origin_app text not null default '';

comment on column public.listings.origin_app is
  'App de origen: folio-pdf | ingenieria. La vitrina y los mensajes son compartidos.';

create index if not exists listings_origin_app_idx
  on public.listings (origin_app)
  where origin_app <> '';

-- La política de lectura ya es única (active/hidden/visible_until).
-- No filtrar por origin_app: ambas apps ven y chatean sobre los mismos avisos.
