-- Panel Control: solo el titular administra usuarios, planes y plaza.

create or replace function public.memorcalc_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'jrenzosamco@gmail.com',
    'miacademiapreu.pe@gmail.com'
  );
$$;

grant execute on function public.memorcalc_is_owner() to authenticated;

create or replace function public.memorcalc_admin_census()
returns table (
  user_id uuid,
  email text,
  full_name text,
  profession_label text,
  organization text,
  district text,
  department text,
  workplace_role text,
  plan text,
  paid_until timestamptz,
  device_id text,
  device_label text,
  device_updated_at timestamptz,
  listings integer,
  ads integer,
  budgets integer,
  profile_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.memorcalc_is_owner() then
    raise exception 'Panel reservado al titular.';
  end if;

  return query
  with ids as (
    select p.user_id as uid from public.memorcalc_profiles p
    union
    select pl.user_id from public.memorcalc_plans pl
    union
    select d.user_id from public.memorcalc_device_lock d
  )
  select
    i.uid,
    coalesce(nullif(p.email, ''), nullif(pl.email, ''), '')::text,
    coalesce(p.full_name, '')::text,
    coalesce(p.profession_label, '')::text,
    coalesce(p.organization, '')::text,
    coalesce(p.district, '')::text,
    coalesce(p.department, '')::text,
    coalesce(p.workplace_role, '')::text,
    coalesce(pl.plan, 'free')::text,
    pl.paid_until,
    coalesce(d.device_id, '')::text,
    coalesce(d.device_label, '')::text,
    d.updated_at,
    coalesce((select count(*)::int from public.listings l where l.user_id::text = i.uid::text and coalesce(l.kind, 'product') <> 'ad'), 0),
    coalesce((select count(*)::int from public.listings l where l.user_id::text = i.uid::text and l.kind = 'ad'), 0),
    coalesce((select count(*)::int from public.memorcalc_budgets b where b.owner_id = i.uid), 0),
    p.created_at
  from ids i
  left join public.memorcalc_profiles p on p.user_id = i.uid
  left join public.memorcalc_plans pl on pl.user_id = i.uid
  left join public.memorcalc_device_lock d on d.user_id = i.uid
  order by coalesce(p.full_name, pl.email, i.uid::text);
end;
$$;

grant execute on function public.memorcalc_admin_census() to authenticated;

create or replace function public.memorcalc_admin_set_plan(p_user_id uuid, p_email text, p_plan text, p_days integer default 31)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  until_at timestamptz;
  mail text := lower(trim(coalesce(p_email, '')));
  days_n integer := greatest(1, least(800, coalesce(p_days, 31)));
begin
  if not public.memorcalc_is_owner() then
    raise exception 'Panel reservado al titular.';
  end if;
  if p_user_id is null then
    raise exception 'Falta el usuario.';
  end if;
  if p_plan not in ('pro', 'free') then
    raise exception 'El plan solo puede ser pro o free.';
  end if;
  if mail = '' then
    select lower(email) into mail from public.memorcalc_profiles where user_id = p_user_id;
    mail := coalesce(mail, '');
  end if;

  if p_plan = 'free' then
    until_at := null;
    insert into public.memorcalc_plans (user_id, email, plan, paid_until, last_voucher, updated_at)
    values (p_user_id, mail, 'free', null, 'manual-owner', now())
    on conflict (user_id) do update set
      email = excluded.email,
      plan = 'free',
      paid_until = null,
      last_voucher = 'manual-owner',
      updated_at = now();
  else
    until_at := now() + make_interval(days => days_n);
    insert into public.memorcalc_plans (user_id, email, plan, paid_until, last_voucher, updated_at)
    values (p_user_id, mail, 'pro', until_at, 'manual-owner', now())
    on conflict (user_id) do update set
      email = excluded.email,
      plan = 'pro',
      paid_until = until_at,
      last_voucher = 'manual-owner',
      updated_at = now();
  end if;

  insert into public.memorcalc_payments (user_id, email, kind, amount, pdf_count, voucher, status, meta)
  values (
    p_user_id,
    mail,
    'pro',
    0,
    0,
    'manual-owner',
    'paid',
    jsonb_build_object('source', 'control', 'plan', p_plan, 'days', days_n)
  );

  return jsonb_build_object('user_id', p_user_id, 'plan', p_plan, 'paid_until', until_at, 'email', mail);
end;
$$;

grant execute on function public.memorcalc_admin_set_plan(uuid, text, text, integer) to authenticated;

create or replace function public.memorcalc_admin_listings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if not public.memorcalc_is_owner() then
    raise exception 'Panel reservado al titular.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]'::jsonb)
    into payload
    from public.listings l;
  return payload;
end;
$$;

grant execute on function public.memorcalc_admin_listings() to authenticated;

create or replace function public.memorcalc_admin_save_listing(p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if not public.memorcalc_is_owner() then
    raise exception 'Panel reservado al titular.';
  end if;
  if coalesce(trim(p_id), '') = '' then
    raise exception 'Falta el aviso.';
  end if;

  update public.listings
     set name = coalesce(nullif(p_patch->>'name', ''), name),
         description = coalesce(p_patch->>'description', description),
         price_label = coalesce(nullif(p_patch->>'price_label', ''), price_label),
         category = coalesce(nullif(p_patch->>'category', ''), category),
         city = coalesce(p_patch->>'city', city),
         department = coalesce(p_patch->>'department', department),
         phone = coalesce(p_patch->>'phone', phone),
         hidden = coalesce((p_patch->>'hidden')::boolean, hidden),
         active = coalesce((p_patch->>'active')::boolean, active)
   where id::text = p_id;

  if not found then
    raise exception 'No se encontró el aviso.';
  end if;

  select to_jsonb(l) into payload from public.listings l where l.id::text = p_id;
  return payload;
end;
$$;

grant execute on function public.memorcalc_admin_save_listing(text, jsonb) to authenticated;

create or replace function public.memorcalc_admin_delete_listing(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.memorcalc_is_owner() then
    raise exception 'Panel reservado al titular.';
  end if;
  if coalesce(trim(p_id), '') = '' then
    raise exception 'Falta el aviso.';
  end if;
  delete from public.listings where id::text = p_id;
end;
$$;

grant execute on function public.memorcalc_admin_delete_listing(text) to authenticated;

create or replace function public.memorcalc_revoke_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.memorcalc_is_owner() then
    raise exception 'Solo el titular cierra sesiones.';
  end if;
  if p_user_id is null then
    raise exception 'Falta el usuario.';
  end if;

  insert into public.memorcalc_device_lock (user_id, device_id, session_epoch, device_label, updated_at)
  values (p_user_id, '', 1, '', now())
  on conflict (user_id) do update
    set device_id = '',
        session_epoch = public.memorcalc_device_lock.session_epoch + 1,
        device_label = '',
        updated_at = now();
end;
$$;

grant execute on function public.memorcalc_revoke_sessions(uuid) to authenticated;
