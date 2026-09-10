-- Una sola computadora por cuenta. El panel Control puede cerrar todas las sesiones.

create table if not exists public.memorcalc_device_lock (
  user_id uuid primary key references auth.users (id) on delete cascade,
  device_id text not null default '',
  session_epoch integer not null default 1,
  device_label text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.memorcalc_device_lock enable row level security;

grant select, insert, update on public.memorcalc_device_lock to authenticated;
grant all on public.memorcalc_device_lock to service_role;

drop policy if exists memorcalc_device_lock_own on public.memorcalc_device_lock;
create policy memorcalc_device_lock_own on public.memorcalc_device_lock
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.memorcalc_claim_device(p_device_id text, p_label text default '')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur_device text;
  cur_epoch integer;
begin
  if uid is null then
    raise exception 'Debe iniciar sesión.';
  end if;
  if coalesce(trim(p_device_id), '') = '' then
    raise exception 'Falta el identificador del equipo.';
  end if;

  select device_id, session_epoch
    into cur_device, cur_epoch
    from public.memorcalc_device_lock
   where user_id = uid
   for update;

  if not found then
    insert into public.memorcalc_device_lock (user_id, device_id, session_epoch, device_label, updated_at)
    values (uid, p_device_id, 1, coalesce(p_label, ''), now());
    return 1;
  end if;

  if cur_device is null or cur_device = '' or cur_device = p_device_id then
    update public.memorcalc_device_lock
       set device_id = p_device_id,
           device_label = coalesce(p_label, ''),
           updated_at = now()
     where user_id = uid;
    return cur_epoch;
  end if;

  raise exception 'Esta cuenta ya está activa en otro equipo. Escriba a soporte por WhatsApp al 977 747 979 para que se cierren las sesiones.';
end;
$$;

create or replace function public.memorcalc_revoke_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión.';
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

grant execute on function public.memorcalc_claim_device(text, text) to authenticated;
grant execute on function public.memorcalc_revoke_sessions(uuid) to authenticated;
