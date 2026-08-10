-- HK Split database setup
-- Run this whole file once in Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.hk_friends (
  name text primary key,
  bank_details text not null default '' check (char_length(bank_details) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.hk_cases (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 80),
  case_date date not null,
  participants text[] not null check (cardinality(participants) >= 2),
  expenses jsonb not null default '[]'::jsonb,
  settlements jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hk_friends enable row level security;
alter table public.hk_cases enable row level security;

drop policy if exists "HK Split shared friend directory" on public.hk_friends;
create policy "HK Split shared friend directory"
on public.hk_friends
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "HK Split shared cases" on public.hk_cases;
create policy "HK Split shared cases"
on public.hk_cases
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.hk_friends to anon, authenticated;
grant select, insert, update, delete on public.hk_cases to anon, authenticated;

insert into public.hk_friends (name) values
  ('Bhagya'),
  ('Buddhi'),
  ('Dulan'),
  ('Kasuni'),
  ('Shirantha'),
  ('Udula'),
  ('Umali')
on conflict (name) do nothing;

commit;
