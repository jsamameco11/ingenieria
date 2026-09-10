-- Parche: elimina recursión infinita RLS memorcalc_budgets ↔ memorcalc_budget_members

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
