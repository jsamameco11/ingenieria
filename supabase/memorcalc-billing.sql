-- Plan Pro (Culqi: mensual, trimestral, anual), PDF y presupuestos en nube.
-- Proyecto Folio: qfvgksstvdrxcugbdwkv

create table if not exists public.memorcalc_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  plan text not null default 'free',
  paid_until timestamptz,
  last_voucher text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.memorcalc_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  email text not null default '',
  kind text not null,
  amount numeric not null,
  pdf_count integer not null default 0,
  voucher text not null default '',
  status text not null default 'paid',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memorcalc_budgets (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  obra text not null default '',
  cliente text not null default '',
  lugar text not null default '',
  partidas integer not null default 0,
  total numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.memorcalc_budget_members (
  budget_id uuid not null references public.memorcalc_budgets (id) on delete cascade,
  email text not null,
  user_id uuid,
  role text not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (budget_id, email)
);

create table if not exists public.memorcalc_pdf_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  obra text not null default '',
  files jsonb not null default '[]'::jsonb,
  amount numeric not null,
  status text not null default 'queued',
  budget_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists memorcalc_payments_user_idx on public.memorcalc_payments (user_id, created_at desc);
create index if not exists memorcalc_budgets_owner_idx on public.memorcalc_budgets (owner_id, updated_at desc);
create index if not exists memorcalc_members_email_idx on public.memorcalc_budget_members (email);
create index if not exists memorcalc_plans_email_idx on public.memorcalc_plans (email);

alter table public.memorcalc_plans enable row level security;
alter table public.memorcalc_payments enable row level security;
alter table public.memorcalc_budgets enable row level security;
alter table public.memorcalc_budget_members enable row level security;
alter table public.memorcalc_pdf_jobs enable row level security;

grant select, insert, update on public.memorcalc_plans to authenticated;
grant select, insert on public.memorcalc_payments to authenticated;
grant select, insert, update, delete on public.memorcalc_budgets to authenticated;
grant select, insert, delete on public.memorcalc_budget_members to authenticated;
grant select, insert, update on public.memorcalc_pdf_jobs to authenticated;
grant all on public.memorcalc_plans, public.memorcalc_payments, public.memorcalc_budgets,
  public.memorcalc_budget_members, public.memorcalc_pdf_jobs to service_role;

drop policy if exists memorcalc_plans_own on public.memorcalc_plans;
create policy memorcalc_plans_own on public.memorcalc_plans
  for all to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
  with check (user_id = auth.uid());

drop policy if exists memorcalc_payments_own on public.memorcalc_payments;
create policy memorcalc_payments_own on public.memorcalc_payments
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists memorcalc_payments_ins on public.memorcalc_payments;
create policy memorcalc_payments_ins on public.memorcalc_payments
  for insert to authenticated
  with check (user_id = auth.uid());

-- Helpers SECURITY DEFINER: evitan recursión RLS budgets ↔ members.
create or replace function public.memorcalc_is_budget_owner(p_budget_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memorcalc_budgets b
    where b.id = p_budget_id and b.owner_id = auth.uid()
  );
$$;

create or replace function public.memorcalc_is_budget_member(p_budget_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memorcalc_budget_members m
    where m.budget_id = p_budget_id
      and (
        m.user_id = auth.uid()
        or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

grant execute on function public.memorcalc_is_budget_owner(uuid) to authenticated;
grant execute on function public.memorcalc_is_budget_member(uuid) to authenticated;

drop policy if exists memorcalc_budgets_access on public.memorcalc_budgets;
create policy memorcalc_budgets_access on public.memorcalc_budgets
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.memorcalc_is_budget_member(id)
  );

drop policy if exists memorcalc_budgets_owner_w on public.memorcalc_budgets;
create policy memorcalc_budgets_owner_w on public.memorcalc_budgets
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists memorcalc_budgets_owner_u on public.memorcalc_budgets;
create policy memorcalc_budgets_owner_u on public.memorcalc_budgets
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists memorcalc_budgets_owner_d on public.memorcalc_budgets;
create policy memorcalc_budgets_owner_d on public.memorcalc_budgets
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists memorcalc_members_access on public.memorcalc_budget_members;
create policy memorcalc_members_access on public.memorcalc_budget_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.memorcalc_is_budget_owner(budget_id)
  );

drop policy if exists memorcalc_members_owner on public.memorcalc_budget_members;
create policy memorcalc_members_owner on public.memorcalc_budget_members
  for insert to authenticated
  with check (public.memorcalc_is_budget_owner(budget_id));

drop policy if exists memorcalc_members_owner_d on public.memorcalc_budget_members;
create policy memorcalc_members_owner_d on public.memorcalc_budget_members
  for delete to authenticated
  using (public.memorcalc_is_budget_owner(budget_id));

drop policy if exists memorcalc_pdf_own on public.memorcalc_pdf_jobs;
create policy memorcalc_pdf_own on public.memorcalc_pdf_jobs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.memorcalc_plan_activo(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memorcalc_plans
    where lower(email) = lower(trim(p_email))
      and plan = 'pro'
      and paid_until is not null
      and paid_until > now()
  );
$$;

grant execute on function public.memorcalc_plan_activo(text) to authenticated;

create or replace function public.memorcalc_register_payment(
  p_kind text,
  p_amount numeric,
  p_voucher text,
  p_pdf_count integer default 0,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt()->>'email', ''));
  until_at timestamptz;
  pay_id uuid;
  days_n integer := 31;
begin
  if uid is null then
    raise exception 'Debe iniciar sesión.';
  end if;
  if p_kind not in ('pro', 'pdf') then
    raise exception 'Tipo de pago no válido.';
  end if;
  if coalesce(trim(p_voucher), '') = '' then
    raise exception 'Falta el cargo Culqi.';
  end if;

  insert into public.memorcalc_payments (user_id, email, kind, amount, pdf_count, voucher, status, meta)
  values (uid, mail, p_kind, p_amount, coalesce(p_pdf_count, 0), trim(p_voucher), 'paid', coalesce(p_meta, '{}'::jsonb))
  returning id into pay_id;

  if p_kind = 'pro' then
    begin
      days_n := greatest(1, least(400, coalesce(nullif(p_meta->>'days', '')::int, 31)));
    exception when others then
      days_n := 31;
    end;
    until_at := now() + make_interval(days => days_n);
    insert into public.memorcalc_plans (user_id, email, plan, paid_until, last_voucher, updated_at)
    values (uid, mail, 'pro', until_at, trim(p_voucher), now())
    on conflict (user_id) do update set
      email = excluded.email,
      plan = 'pro',
      paid_until = case
        when public.memorcalc_plans.paid_until is not null and public.memorcalc_plans.paid_until > now()
          then public.memorcalc_plans.paid_until + make_interval(days => days_n)
        else now() + make_interval(days => days_n)
      end,
      last_voucher = excluded.last_voucher,
      updated_at = now();
    select paid_until into until_at from public.memorcalc_plans where user_id = uid;
  else
    insert into public.memorcalc_pdf_jobs (user_id, obra, files, amount, status)
    values (
      uid,
      coalesce(p_meta->>'obra', ''),
      coalesce(p_meta->'files', '[]'::jsonb),
      p_amount,
      'paid'
    );
    select paid_until into until_at from public.memorcalc_plans where user_id = uid;
  end if;

  return jsonb_build_object(
    'id', pay_id,
    'plan', case when until_at is not null and until_at > now() then 'pro' else 'free' end,
    'paid_until', until_at
  );
end;
$$;

grant execute on function public.memorcalc_register_payment(text, numeric, text, integer, jsonb) to authenticated;
