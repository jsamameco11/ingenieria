-- MemoriaCalc · ejecutar UNA vez en SQL Editor de Supabase
-- Proyecto: kxiunxdjtaesswgexsij
-- Sin este script, Guardar sigue funcionando en el navegador (localStorage).
-- Con este script, Guardar también sincroniza en la nube.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  location text,
  engineer text,
  code text,
  created_at timestamptz not null default now()
);

create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  module_slug text not null,
  title text not null,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.module_catalog (
  slug text primary key,
  title text not null,
  category text not null,
  norma text,
  source_excel text
);

alter table public.projects enable row level security;
alter table public.calculations enable row level security;
alter table public.module_catalog enable row level security;

drop policy if exists "projects_read" on public.projects;
drop policy if exists "projects_write" on public.projects;
drop policy if exists "calc_read" on public.calculations;
drop policy if exists "calc_write" on public.calculations;
drop policy if exists "catalog_read" on public.module_catalog;

create policy "projects_read" on public.projects for select using (true);
create policy "projects_write" on public.projects for insert with check (true);
create policy "calc_read" on public.calculations for select using (true);
create policy "calc_write" on public.calculations for insert with check (true);
create policy "catalog_read" on public.module_catalog for select using (true);

-- Presupuestos de obra (memoria en disco + JSONB; Storage replica el .ppto.json)
create table if not exists public.presupuesto_archivos (
  id uuid primary key,
  nombre text not null,
  obra text,
  cliente text,
  lugar text,
  fecha_obra date,
  partidas integer not null default 0,
  total numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.presupuesto_archivos enable row level security;

drop policy if exists "ppto_read" on public.presupuesto_archivos;
drop policy if exists "ppto_insert" on public.presupuesto_archivos;
drop policy if exists "ppto_update" on public.presupuesto_archivos;
drop policy if exists "ppto_delete" on public.presupuesto_archivos;

create policy "ppto_read" on public.presupuesto_archivos for select using (true);
create policy "ppto_insert" on public.presupuesto_archivos for insert with check (true);
create policy "ppto_update" on public.presupuesto_archivos for update using (true) with check (true);
create policy "ppto_delete" on public.presupuesto_archivos for delete using (true);

insert into storage.buckets (id, name, public)
values ('presupuestos', 'presupuestos', false)
on conflict (id) do nothing;

drop policy if exists "ppto_objects" on storage.objects;
drop policy if exists "ppto_storage_select" on storage.objects;
drop policy if exists "ppto_storage_insert" on storage.objects;
drop policy if exists "ppto_storage_update" on storage.objects;
drop policy if exists "ppto_storage_delete" on storage.objects;
create policy "ppto_storage_select" on storage.objects for select using (bucket_id = 'presupuestos');
create policy "ppto_storage_insert" on storage.objects for insert with check (bucket_id = 'presupuestos');
create policy "ppto_storage_update" on storage.objects for update using (bucket_id = 'presupuestos');
create policy "ppto_storage_delete" on storage.objects for delete using (bucket_id = 'presupuestos');

insert into public.module_catalog (slug, title, category, norma, source_excel) values
  ('estribo-voladizo', 'Estribo en voladizo', 'puentes', 'AASHTO LRFD · E.060', 'ESTRIBO EN VOLADIZO COMPLETOO'),
  ('estribo-gravedad', 'Estribo de gravedad', 'puentes', 'AASHTO LRFD', 'ESTRIBO DE GRAVEDAD - PROPIO COMPL'),
  ('estribo-pantalla', 'Estribo tipo pantalla', 'puentes', 'AASHTO LRFD', 'DISEÑO-DE-ESTRIBO-PANTALLA'),
  ('losa-puente', 'Losa de puente', 'puentes', 'AASHTO 9.7', 'DISEÑO DE LOSA DE PUENTE'),
  ('puente-vehicular', 'Puente vehicular', 'puentes', 'AASHTO LRFD', 'DIS PUENTE VEHICULAR'),
  ('viga-presforzada', 'Viga presforzada', 'puentes', 'AASHTO 5.9', 'DIS VIGA PRESFORZADA'),
  ('dispositivos-apoyo', 'Dispositivos de apoyo', 'puentes', 'AASHTO 14.7.5', 'DIS DISPOSITIVOS DE APOYO'),
  ('placa-apoyo', 'Placa de apoyo', 'puentes', 'AISC / A36', 'DISEÑ PLAC APOYO'),
  ('travesano', 'Travesaño', 'puentes', 'AASHTO · E.060', 'DIS TRAVESAÑO'),
  ('puente-cajon', 'Puente cajón', 'puentes', 'AASHTO LRFD', 'DISEÑ PUENTE CAJON'),
  ('columnas', 'Columnas', 'edificaciones', 'NTE E.060', 'COL PRO'),
  ('viga-flexion', 'Viga a flexión', 'edificaciones', 'NTE E.060', 'DIS VIGAS FLEXION'),
  ('viga-cortante', 'Viga a cortante', 'edificaciones', 'NTE E.060', 'DISEÑO VIGA X CORTANTE'),
  ('viga-doble-armadura', 'Viga doblemente armada', 'edificaciones', 'NTE E.060', 'VIGAS DOBLEMENTE AS'),
  ('viga-compuesta', 'Viga compuesta', 'edificaciones', 'AISC', 'DISEÑO DE VIGA COMPUESTA'),
  ('zapata-aislada', 'Zapata aislada', 'cimentacion', 'NTE E.060', 'ZAP AIS 3'),
  ('zapata-combinada', 'Zapata combinada', 'cimentacion', 'ACI 318', 'ZAP COMBINADA'),
  ('viga-cimentacion', 'Viga de cimentación', 'cimentacion', 'NTE E.060', 'V. CONEXION Z.CENT 2'),
  ('platea', 'Platea', 'cimentacion', 'NTE E.060', 'LOSA DE CIMENT'),
  ('pilotes', 'Pilotes', 'cimentacion', 'E.050 / E.060', 'DISEÑO DE CIMENTACION Y PILOTES'),
  ('escalera-dos-tramos', 'Escalera dos tramos', 'escaleras', 'E.060 · E.020', 'ESCALERAS - 2 TRAMOS PERFECTO'),
  ('escalera-descanso', 'Escalera con descanso', 'escaleras', 'E.060 · E.020', 'ESCALERA 1 DESCANSO'),
  ('edificio-sismo', 'Análisis sísmico E.030', 'edificio', 'NTE E.030', 'DISEÑO DE ESTRUCTURAS - CORRECTO')
on conflict (slug) do update set title = excluded.title, category = excluded.category;
