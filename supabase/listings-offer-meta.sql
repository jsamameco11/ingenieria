-- Metadatos de vitrina: servicio/artículo y estado del bien.
alter table public.listings
  add column if not exists offer_kind text,
  add column if not exists item_condition text;

comment on column public.listings.offer_kind is 'servicio | articulo';
comment on column public.listings.item_condition is 'nuevo | usado | reacondicionado (solo articulo)';

update public.listings
set offer_kind = 'servicio', item_condition = null
where offer_kind is distinct from 'servicio'
  and (
    lower(coalesce(name, '')) ~ 'academia\\s*pre|miacademia|mi\\s*academia\\s*pre'
    or category in ('Educación', 'Servicios', 'Legal', 'Promociones', 'Empresas')
  );

update public.listings
set offer_kind = 'articulo'
where offer_kind is null and coalesce(kind, 'product') <> 'ad';
