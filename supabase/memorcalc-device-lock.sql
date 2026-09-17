-- Hasta N equipos simultáneos por cuenta (N = profiles.device_limit, por defecto 2).
-- El equipo N+1 que intente entrar recibe un mensaje para cerrar sesión en otro
-- equipo activo o para entrar con otra cuenta de Google. El panel Control puede
-- cerrar todas las sesiones de una cuenta (deja la cuenta sin ningún equipo anclado).

create table if not exists public.memorcalc_device_lock (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  session_epoch integer not null default 1,
  device_label text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Migración desde el esquema anterior (una sola fila por usuario, PK en user_id):
-- se reemplaza por la PK compuesta (user_id, device_id) para admitir varias
-- filas por usuario, una por equipo activo. Las filas "vacías" que dejaba el
-- mecanismo antiguo de revocación (device_id = '') ya no se usan y se limpian.
do $$
begin
  if exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
     where t.relname = 'memorcalc_device_lock'
       and c.contype = 'p'
       and array_length(c.conkey, 1) = 1
  ) then
    alter table public.memorcalc_device_lock drop constraint memorcalc_device_lock_pkey;
    delete from public.memorcalc_device_lock where coalesce(device_id, '') = '';
    alter table public.memorcalc_device_lock add constraint memorcalc_device_lock_pkey primary key (user_id, device_id);
  end if;
end $$;

-- profiles.device_limit ya existe (lo leen server/culqi-server.mjs y el panel
-- Control); se le pone DEFAULT 2 para que una cuenta nueva arranque en 2 equipos
-- sin que el backend deba enviarlo en cada login (lo que pisaría cualquier valor
-- que el titular haya fijado a mano para una cuenta puntual).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'device_limit'
  ) then
    execute 'alter table public.profiles alter column device_limit set default 2';
  end if;
end $$;

alter table public.memorcalc_device_lock enable row level security;

grant select, insert, update, delete on public.memorcalc_device_lock to authenticated;
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
  lim integer;
  active_count integer;
  existing_epoch integer;
begin
  if uid is null then
    raise exception 'Debe iniciar sesión.';
  end if;
  if coalesce(trim(p_device_id), '') = '' then
    raise exception 'Falta el identificador del equipo.';
  end if;

  select greatest(coalesce(device_limit, 2), 1) into lim from public.profiles where id = uid;
  if lim is null then
    lim := 2;
  end if;

  -- ¿Este equipo ya es uno de los activos? Solo se refresca la etiqueta/fecha.
  select session_epoch into existing_epoch
    from public.memorcalc_device_lock
   where user_id = uid and device_id = p_device_id
   for update;

  if found then
    update public.memorcalc_device_lock
       set device_label = coalesce(p_label, ''),
           updated_at = now()
     where user_id = uid and device_id = p_device_id;
    return existing_epoch;
  end if;

  select count(*) into active_count from public.memorcalc_device_lock where user_id = uid;

  if active_count >= lim then
    raise exception 'Esta cuenta ya tiene % equipos con sesión activa (máximo %). Cierre sesión en uno de ellos o ingrese con otra cuenta de Google.', active_count, lim;
  end if;

  insert into public.memorcalc_device_lock (user_id, device_id, session_epoch, device_label, updated_at)
  values (uid, p_device_id, 1, coalesce(p_label, ''), now());
  return 1;
end;
$$;

-- Cualquier usuario puede cerrar SUS PROPIAS sesiones (autoservicio); cerrar las
-- de otra cuenta requiere ser el titular (public.memorcalc_is_owner(), definida
-- en memorcalc-admin.sql — por eso ese script debe aplicarse junto a este).
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
  if p_user_id <> auth.uid() and not (
    exists (select 1 from pg_proc where proname = 'memorcalc_is_owner')
    and public.memorcalc_is_owner()
  ) then
    raise exception 'Solo el titular cierra sesiones de otra cuenta.';
  end if;

  delete from public.memorcalc_device_lock where user_id = p_user_id;
end;
$$;

grant execute on function public.memorcalc_claim_device(text, text) to authenticated;
grant execute on function public.memorcalc_revoke_sessions(uuid) to authenticated;
