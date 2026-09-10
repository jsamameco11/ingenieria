-- MemoriaCalc · mismos usuarios que Folio PDF (auth.users + profiles)
-- Proyecto: qfvgksstvdrxcugbdwkv
-- No altera plan, rol ni licencias de Folio.

create table if not exists public.memorcalc_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  avatar_url text not null default '',
  google_sub text not null default '',
  profession_id text not null default '',
  profession_label text not null default '',
  professional_title text not null default '',
  cip text not null default '',
  colegiatura text not null default '',
  organization text not null default '',
  workplace_role text not null default '',
  practice_mode text not null default '',
  specialty_focus text[] not null default '{}',
  country text not null default 'Perú',
  country_code text not null default 'PE',
  department text not null default '',
  province text not null default '',
  district text not null default '',
  city text not null default '',
  ubigeo text not null default '',
  age smallint,
  birth_year smallint,
  phone text not null default '',
  sex text not null default '',
  experience_years smallint,
  university text not null default '',
  onboarding_done boolean not null default false,
  app text not null default 'memorcalc',
  last_module text not null default '',
  inferred_role text not null default '',
  inferred_rubros text[] not null default '{}',
  inferred_confidence numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memorcalc_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  session_id text not null default '',
  event_type text not null,
  module_slug text not null default '',
  specialty text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memorcalc_insights (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_guess text not null default '',
  role_scores jsonb not null default '{}'::jsonb,
  rubros jsonb not null default '{}'::jsonb,
  top_modules text[] not null default '{}',
  contractor_score numeric not null default 0,
  designer_score numeric not null default 0,
  summary text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists memorcalc_events_user_idx on public.memorcalc_events (user_id, created_at desc);
create index if not exists memorcalc_profiles_role_idx on public.memorcalc_profiles (workplace_role, inferred_role);
create index if not exists memorcalc_profiles_place_idx on public.memorcalc_profiles (country_code, department, province);

alter table public.memorcalc_profiles enable row level security;
alter table public.memorcalc_events enable row level security;
alter table public.memorcalc_insights enable row level security;

grant select, insert, update on public.memorcalc_profiles to authenticated;
grant select, insert on public.memorcalc_events to authenticated;
grant select, insert, update on public.memorcalc_insights to authenticated;
grant all on public.memorcalc_profiles, public.memorcalc_events, public.memorcalc_insights to service_role;

drop policy if exists memorcalc_profiles_own on public.memorcalc_profiles;
create policy memorcalc_profiles_own on public.memorcalc_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists memorcalc_events_own on public.memorcalc_events;
create policy memorcalc_events_own on public.memorcalc_events
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists memorcalc_events_insert_own on public.memorcalc_events;
create policy memorcalc_events_insert_own on public.memorcalc_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists memorcalc_insights_own on public.memorcalc_insights;
create policy memorcalc_insights_own on public.memorcalc_insights
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.sync_memorcalc_identity(p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  install text;
  age_val integer;
  band text := '';
begin
  if uid is null then
    raise exception 'Debe iniciar sesión.';
  end if;
  install := 'memorcalc:' || uid::text;
  age_val := nullif(p_profile->>'age', '')::integer;

  if age_val is not null then
    band := case
      when age_val < 25 then '18-24'
      when age_val < 35 then '25-34'
      when age_val < 45 then '35-44'
      when age_val < 55 then '45-54'
      when age_val < 65 then '55-64'
      else '65+'
    end;
  end if;

  insert into public.installs (install_id, user_id, email, google_sub, google_email, country, department, province, district, app, last_seen_at)
  values (
    install,
    uid,
    coalesce(p_profile->>'email', ''),
    coalesce(p_profile->>'google_sub', ''),
    coalesce(p_profile->>'email', ''),
    coalesce(p_profile->>'country', ''),
    coalesce(p_profile->>'department', ''),
    coalesce(p_profile->>'province', ''),
    coalesce(p_profile->>'district', ''),
    'memorcalc',
    now()
  )
  on conflict (install_id) do update set
    user_id = excluded.user_id,
    email = excluded.email,
    google_sub = excluded.google_sub,
    google_email = excluded.google_email,
    country = excluded.country,
    department = excluded.department,
    province = excluded.province,
    district = excluded.district,
    app = 'memorcalc',
    last_seen_at = now();

  insert into public.user_identities (
    install_id, user_id, occupation, role_label, profession_id,
    age_band, age_min, age_max, country, department, province, city, district, ubigeo,
    location_source, location_confidence, closeness, updated_at
  ) values (
    install,
    uid,
    coalesce(p_profile->>'profession_label', ''),
    coalesce(p_profile->>'workplace_role', ''),
    coalesce(p_profile->>'profession_id', ''),
    band,
    age_val,
    age_val,
    coalesce(p_profile->>'country', ''),
    coalesce(p_profile->>'department', ''),
    coalesce(p_profile->>'province', ''),
    coalesce(p_profile->>'city', p_profile->>'district', ''),
    coalesce(p_profile->>'district', ''),
    coalesce(p_profile->>'ubigeo', ''),
    'memorcalc-ficha',
    0.95,
    coalesce(nullif(p_profile->>'inferred_confidence','')::numeric, 0.5),
    now()
  )
  on conflict (install_id) do update set
    user_id = excluded.user_id,
    occupation = excluded.occupation,
    role_label = excluded.role_label,
    profession_id = excluded.profession_id,
    age_band = excluded.age_band,
    age_min = excluded.age_min,
    age_max = excluded.age_max,
    country = excluded.country,
    department = excluded.department,
    province = excluded.province,
    city = excluded.city,
    district = excluded.district,
    ubigeo = excluded.ubigeo,
    location_source = excluded.location_source,
    location_confidence = excluded.location_confidence,
    closeness = excluded.closeness,
    updated_at = now();
end;
$$;

revoke all on function public.sync_memorcalc_identity(jsonb) from public;
grant execute on function public.sync_memorcalc_identity(jsonb) to authenticated, service_role;
