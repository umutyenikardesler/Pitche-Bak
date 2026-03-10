-- Supabase user activity logs table
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Optional: if you previously created analytics_events, drop it.
-- drop table if exists public.analytics_events;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Supabase UI çoğu zaman timestamptz'i UTC gösterir.
  -- TR saatini doğrudan görmek için hesaplanmış sütun:
  created_at_tr timestamp generated always as (created_at at time zone 'Europe/Istanbul') stored,

  user_id uuid null,
  device_id text null,
  session_id uuid null,

  action text not null,
  screen text null,
  message text null,

  platform text null,
  app_version text null,
  locale text null,
  language text null,

  meta jsonb not null default '{}'::jsonb
);

create index if not exists activity_logs_created_at_desc_idx
  on public.activity_logs (created_at desc);

create index if not exists activity_logs_user_created_at_desc_idx
  on public.activity_logs (user_id, created_at desc);

alter table public.activity_logs enable row level security;

-- App should only INSERT. Reads should be done from dashboard / service role.
drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert"
on public.activity_logs
for insert
to anon, authenticated
with check (true);

-- Optional: prevent client-side reads completely (no select policy).

-- Example query (newest -> oldest):
-- select *
-- from public.activity_logs
-- where user_id = '<uuid>'::uuid
-- order by created_at desc
-- limit 200;

-- If you ALREADY created the table earlier with extra columns, run this migration:
-- alter table public.activity_logs
--   add column if not exists created_at_tr timestamp generated always as (created_at at time zone 'Europe/Istanbul') stored;
-- alter table public.activity_logs
--   drop column if exists severity,
--   drop column if exists utm_source,
--   drop column if exists utm_medium,
--   drop column if exists utm_campaign;

