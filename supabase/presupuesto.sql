-- Presupuestos CALIA · pegar en SQL Editor de Supabase.
-- Tabla JSONB (fuente de verdad) + bucket Storage de respaldo.

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
