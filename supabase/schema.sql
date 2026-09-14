-- Optional persistence for InNet Version 1.
-- Run this in the Supabase SQL editor, then add the project URL and anon key to .env.local.

create extension if not exists "pgcrypto";

create table if not exists public.care_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  plan_name text not null,
  specialty text not null,
  zip_code text not null check (zip_code ~ '^\d{5}$'),
  remaining_deductible numeric not null check (remaining_deductible >= 0),
  plan_rules jsonb not null
);

alter table public.care_searches enable row level security;

-- Version 1 uses anonymous demo searches. Replace this with authenticated user policies
-- before storing real insurance or member information.
create policy "Allow anonymous demo inserts"
on public.care_searches for insert
to anon
with check (true);

-- There is intentionally no anonymous SELECT policy.
