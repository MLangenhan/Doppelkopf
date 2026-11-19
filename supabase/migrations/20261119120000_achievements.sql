-- Achievements: werden ausschließlich von der Edge Function vergeben (Service Role), sichtbar für alle Angemeldeten.
create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  earned_at timestamptz not null default now(),
  game_id uuid references public.games (id) on delete set null,
  table_id uuid references public.tables (id) on delete set null,
  primary key (user_id, key)
);

create index user_achievements_table_idx on public.user_achievements (table_id);

alter table public.user_achievements enable row level security;

create policy "Erfolge sind für angemeldete Nutzer sichtbar"
  on public.user_achievements for select to authenticated using (true);

-- Zähler über alle Spiele (z. B. gefangene Füchse), ebenfalls nur von der Edge Function geschrieben
create table public.user_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  value int not null default 0,
  primary key (user_id, key)
);

alter table public.user_counters enable row level security;

create policy "Zähler sind für angemeldete Nutzer sichtbar"
  on public.user_counters for select to authenticated using (true);

-- Neue Erfolge live an den Tisch melden
alter publication supabase_realtime add table public.user_achievements;
