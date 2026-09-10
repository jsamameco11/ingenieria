-- Ficha publicitaria, telemetría y cupos gratuitos (0–6) por motor.
-- Incremental sobre memorcalc-users.sql. Proyecto Folio: qfvgksstvdrxcugbdwkv

alter table public.memorcalc_profiles
  add column if not exists craft_family text not null default '';

alter table public.memorcalc_profiles
  add column if not exists ad_segment text not null default '';

create table if not exists public.memorcalc_quota_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  engine_id text not null,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, engine_id)
);

create index if not exists memorcalc_events_type_idx
  on public.memorcalc_events (event_type, created_at desc);

create index if not exists memorcalc_quota_uses_user_idx
  on public.memorcalc_quota_uses (user_id);

alter table public.memorcalc_quota_uses enable row level security;

grant select, insert, update on public.memorcalc_quota_uses to authenticated;
grant all on public.memorcalc_quota_uses to service_role;

drop policy if exists memorcalc_quota_uses_own on public.memorcalc_quota_uses;
create policy memorcalc_quota_uses_own on public.memorcalc_quota_uses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
