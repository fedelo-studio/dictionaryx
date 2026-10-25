-- Dictionaryx: one row per game room, its players and their bluffs, synced live through Supabase Realtime.
-- A party game without accounts: anyone who has a room code can play in that room.

create table if not exists public.rooms (
  code text primary key check (code ~ '^[A-Z]{4,6}$'),
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_state_size check (octet_length(state::text) < 200000)
);

create table if not exists public.players (
  room text not null references public.rooms(code) on delete cascade,
  uid uuid not null,
  nick text not null check (char_length(nick) between 1 and 24),
  at bigint not null,
  gone boolean not null default false,
  primary key (room, uid)
);

create table if not exists public.subs (
  room text not null references public.rooms(code) on delete cascade,
  uid uuid not null,
  rk text not null check (char_length(rk) <= 40),
  def text not null default '' check (char_length(def) <= 400),
  vote text check (vote is null or char_length(vote) <= 20),
  at bigint not null,
  primary key (room, uid)
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.subs enable row level security;

drop policy if exists rooms_read on public.rooms;
drop policy if exists rooms_create on public.rooms;
drop policy if exists rooms_play on public.rooms;
drop policy if exists players_play on public.players;
drop policy if exists subs_play on public.subs;

create policy rooms_read on public.rooms for select to anon, authenticated using (true);
create policy rooms_create on public.rooms for insert to anon, authenticated with check (true);
create policy rooms_play on public.rooms for update to anon, authenticated using (true) with check (true);
create policy players_play on public.players for all to anon, authenticated using (true) with check (true);
create policy subs_play on public.subs for all to anon, authenticated using (true) with check (true);

-- Rooms not touched for two days can be removed with: delete from public.rooms where updated_at < now() - interval '2 days';
create index if not exists rooms_updated_at on public.rooms (updated_at);

do $$ begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.subs; exception when duplicate_object then null; end $$;
