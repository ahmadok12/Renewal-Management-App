-- Renewal Reminder App V1 — Supabase schema
-- Run this entire file once in Supabase SQL Editor.

create table if not exists public.renewal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  category text not null,
  due_date date not null,
  start_date date,
  amount numeric(14,2) check (amount is null or amount >= 0),
  currency text not null default 'PKR' check (currency in ('PKR', 'USD')),
  recurring boolean not null default false,
  frequency text not null default 'Once',
  reminder_days integer[] not null default '{}',
  reminders jsonb not null default '[]'::jsonb,
  person text not null default 'Me',
  notes text,
  renewal_rule text not null default 'ask' check (renewal_rule in ('ask', 'fixed', 'actual')),
  accent text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.renewal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.renewal_items(id) on delete cascade,
  scheduled_date date not null,
  actual_date date not null,
  next_date date not null,
  amount_paid numeric(14,2) check (amount_paid is null or amount_paid >= 0),
  rule text not null,
  created_at timestamptz not null default now()
);

create index if not exists renewal_items_user_due_idx on public.renewal_items(user_id, due_date);
create index if not exists renewal_items_user_category_idx on public.renewal_items(user_id, category);
create index if not exists renewal_events_user_item_idx on public.renewal_events(user_id, item_id, actual_date desc);

alter table public.renewal_items enable row level security;
alter table public.renewal_events enable row level security;

drop policy if exists "Users read own renewal items" on public.renewal_items;
create policy "Users read own renewal items" on public.renewal_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create own renewal items" on public.renewal_items;
create policy "Users create own renewal items" on public.renewal_items for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own renewal items" on public.renewal_items;
create policy "Users update own renewal items" on public.renewal_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own renewal items" on public.renewal_items;
create policy "Users delete own renewal items" on public.renewal_items for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users read own renewal history" on public.renewal_events;
create policy "Users read own renewal history" on public.renewal_events for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create own renewal history" on public.renewal_events;
create policy "Users create own renewal history" on public.renewal_events for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.renewal_items i
    where i.id = item_id and i.user_id = (select auth.uid())
  )
);

create or replace function public.record_renewal(
  p_item_id uuid,
  p_scheduled_date date,
  p_actual_date date,
  p_next_date date,
  p_amount_paid numeric,
  p_rule text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item public.renewal_items;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_item from public.renewal_items
  where id = p_item_id and user_id = v_user_id;
  if not found then raise exception 'Renewal item not found'; end if;

  insert into public.renewal_events(user_id, item_id, scheduled_date, actual_date, next_date, amount_paid, rule)
  values (v_user_id, p_item_id, p_scheduled_date, p_actual_date, p_next_date, p_amount_paid, p_rule);

  update public.renewal_items
  set due_date = p_next_date, renewal_rule = p_rule, updated_at = now()
  where id = p_item_id and user_id = v_user_id
  returning * into v_item;

  return to_jsonb(v_item);
end;
$$;

revoke all on function public.record_renewal(uuid, date, date, date, numeric, text) from public, anon;
grant execute on function public.record_renewal(uuid, date, date, date, numeric, text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.renewal_items to authenticated;
grant select, insert on public.renewal_events to authenticated;

