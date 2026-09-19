-- Motor de ficha por sitio + gustos observados (clics, búsquedas, categorías).
-- Una fila de onboarding por (usuario, plataforma). Religión solo vive en answers de CASA_PALABRA.

create table if not exists public.site_onboarding (
  user_id uuid not null references auth.users (id) on delete cascade,
  platform_code text not null,
  answers jsonb not null default '{}'::jsonb,
  email_keywords text[] not null default '{}',
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, platform_code)
);

create table if not exists public.user_behavior_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform_code text not null,
  kind text not null,
  category text,
  query text,
  target text,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists user_behavior_events_user_at on public.user_behavior_events (user_id, created_at desc);
create index if not exists user_behavior_events_plat on public.user_behavior_events (platform_code, category);

create table if not exists public.site_taste_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  platform_code text not null,
  category text not null,
  score numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, platform_code, category)
);

alter table public.site_onboarding enable row level security;
alter table public.user_behavior_events enable row level security;
alter table public.site_taste_scores enable row level security;

drop policy if exists site_onboarding_own on public.site_onboarding;
create policy site_onboarding_own on public.site_onboarding
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_behavior_own on public.user_behavior_events;
create policy user_behavior_own on public.user_behavior_events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists site_taste_own on public.site_taste_scores;
create policy site_taste_own on public.site_taste_scores
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.site_onboarding to authenticated;
grant select, insert on public.user_behavior_events to authenticated;
grant select, insert, update on public.site_taste_scores to authenticated;

create or replace function public.bump_site_taste(
  p_user uuid,
  p_platform_code text,
  p_category text,
  p_weight numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or coalesce(trim(p_category), '') = '' then return; end if;
  insert into public.site_taste_scores (user_id, platform_code, category, score, updated_at)
  values (p_user, p_platform_code, trim(p_category), greatest(p_weight, 0.1), now())
  on conflict (user_id, platform_code, category)
  do update set score = public.site_taste_scores.score + excluded.score, updated_at = now();
end;
$$;

create or replace function public.save_site_onboarding(
  p_platform_code text,
  p_answers jsonb,
  p_email_keywords text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec jsonb;
  cat text;
begin
  if uid is null then raise exception 'Debe iniciar sesión.'; end if;
  insert into public.site_onboarding (user_id, platform_code, answers, email_keywords, completed_at, updated_at)
  values (uid, p_platform_code, coalesce(p_answers, '{}'::jsonb), coalesce(p_email_keywords, '{}'), now(), now())
  on conflict (user_id, platform_code)
  do update set answers = excluded.answers, email_keywords = excluded.email_keywords, updated_at = now();

  if p_answers ? 'categories' then
    for cat in select jsonb_array_elements_text(p_answers -> 'categories')
    loop
      perform public.bump_site_taste(uid, p_platform_code, cat, 8);
    end loop;
  end if;
  if p_answers ? 'rubros' then
    for cat in select jsonb_array_elements_text(p_answers -> 'rubros')
    loop
      perform public.bump_site_taste(uid, p_platform_code, cat, 8);
    end loop;
  end if;
  if p_answers ? 'interests' then
    for cat in select jsonb_array_elements_text(p_answers -> 'interests')
    loop
      perform public.bump_site_taste(uid, p_platform_code, cat, 8);
    end loop;
  end if;
  if p_answers ? 'buy_categories' then
    for cat in select jsonb_array_elements_text(p_answers -> 'buy_categories')
    loop
      perform public.bump_site_taste(uid, p_platform_code, cat, 8);
    end loop;
  end if;
  if p_answers ? 'specialty' and jsonb_typeof(p_answers -> 'specialty') = 'string' then
    perform public.bump_site_taste(uid, p_platform_code, p_answers ->> 'specialty', 6);
  end if;
  if p_answers ? 'industry' then
    perform public.bump_site_taste(uid, p_platform_code, p_answers ->> 'industry', 6);
  end if;
  foreach cat in array coalesce(p_email_keywords, '{}')
  loop
    perform public.bump_site_taste(uid, p_platform_code, cat, 4);
  end loop;

  select to_jsonb(s) into rec from public.site_onboarding s
    where s.user_id = uid and s.platform_code = p_platform_code;
  return rec;
end;
$$;

create or replace function public.record_site_behavior(
  p_platform_code text,
  p_kind text,
  p_category text default null,
  p_query text default null,
  p_target text default null,
  p_weight numeric default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w numeric := coalesce(p_weight, 1);
begin
  if uid is null then return; end if;
  if p_kind = 'search' then w := greatest(w, 3); end if;
  if p_kind = 'category' then w := greatest(w, 2.5); end if;
  if p_kind = 'click' then w := greatest(w, 2); end if;
  insert into public.user_behavior_events (user_id, platform_code, kind, category, query, target, weight)
  values (uid, p_platform_code, p_kind, nullif(trim(coalesce(p_category, '')), ''), nullif(trim(coalesce(p_query, '')), ''), nullif(trim(coalesce(p_target, '')), ''), w);
  if coalesce(trim(p_category), '') <> '' then
    perform public.bump_site_taste(uid, p_platform_code, p_category, w);
  end if;
  if coalesce(trim(p_query), '') <> '' then
    perform public.bump_site_taste(uid, p_platform_code, left(trim(p_query), 48), w * 0.6);
  end if;
end;
$$;

create or replace function public.get_my_site_tastes(p_platform_code text)
returns table (category text, score numeric)
language sql
stable
security definer
set search_path = public
as $$
  select s.category, s.score
  from public.site_taste_scores s
  where s.user_id = auth.uid()
    and s.platform_code = p_platform_code
  order by s.score desc
  limit 24;
$$;

grant execute on function public.save_site_onboarding(text, jsonb, text[]) to authenticated;
grant execute on function public.record_site_behavior(text, text, text, text, text, numeric) to authenticated;
grant execute on function public.get_my_site_tastes(text) to authenticated;
grant execute on function public.bump_site_taste(uuid, text, text, numeric) to authenticated;
