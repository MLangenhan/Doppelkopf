-- Doppelkopf: Grundschema
-- Spielzustand wird ausschließlich von der Edge Function "game" geschrieben (Service Role).
-- Clients lesen nur, was sie sehen dürfen (RLS), und ändern Tische über RPC-Funktionen.

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profile sind für angemeldete Nutzer sichtbar"
  on public.profiles for select to authenticated using (true);

create policy "Eigenes Profil bearbeiten"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Spieler'), 24)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tische (ein Tisch = ein Spieleabend)
-- ---------------------------------------------------------------------------
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Doppelkopf-Abend',
  host_id uuid not null references public.profiles (id),
  settings jsonb not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Sitzplatz des Gebers für das nächste Spiel
  dealer_seat int not null default 0,
  created_at timestamptz not null default now()
);

create table public.table_players (
  table_id uuid not null references public.tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat int not null check (seat between 0 and 4),
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id),
  unique (table_id, seat)
);

create index table_players_user_idx on public.table_players (user_id);

alter table public.tables enable row level security;
alter table public.table_players enable row level security;

create policy "Tische sind für angemeldete Nutzer sichtbar"
  on public.tables for select to authenticated using (true);

create policy "Sitzplätze sind für angemeldete Nutzer sichtbar"
  on public.table_players for select to authenticated using (true);

create function public.is_table_member(p_table uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.table_players
    where table_id = p_table and user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Spiele
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  number int not null,
  dealer_seat int not null,
  -- Sitzplatz für die Engine-Positionen 0–3
  seats int[] not null,
  players uuid[] not null,
  -- Öffentlicher Spielzustand (ohne Hände)
  state jsonb not null,
  version int not null default 0,
  status text not null default 'running' check (status in ('running', 'finished', 'redeal')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (table_id, number)
);

create index games_table_idx on public.games (table_id, number desc);

-- Höchstens ein laufendes Spiel pro Tisch
create unique index games_one_running_idx on public.games (table_id) where status = 'running';

-- Vollständiger Zustand inkl. aller Hände: nur für die Edge Function
create table public.game_secrets (
  game_id uuid primary key references public.games (id) on delete cascade,
  state jsonb not null
);

-- Jede Hand ist nur für ihre Besitzerin lesbar
create table public.game_hands (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cards jsonb not null,
  version int not null default 0,
  primary key (game_id, user_id)
);

create table public.game_results (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  points int not null,
  party text not null check (party in ('re', 'kontra')),
  won boolean not null,
  kind text not null,
  solo text,
  is_soloist boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index game_results_user_idx on public.game_results (user_id);
create index game_results_table_idx on public.game_results (table_id);

alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_hands enable row level security;
alter table public.game_results enable row level security;

create policy "Spiele sind für Mitspieler des Tisches sichtbar"
  on public.games for select to authenticated using (public.is_table_member(table_id));

create policy "Nur die eigene Hand ist sichtbar"
  on public.game_hands for select to authenticated using (user_id = (select auth.uid()));

create policy "Ergebnisse sind für angemeldete Nutzer sichtbar"
  on public.game_results for select to authenticated using (true);

-- game_secrets: absichtlich keine Policy → für Clients unsichtbar

-- ---------------------------------------------------------------------------
-- Statistik
-- ---------------------------------------------------------------------------
create view public.player_stats with (security_invoker = true) as
select
  p.id as user_id,
  p.display_name,
  count(r.game_id)::int as games,
  (count(*) filter (where r.won))::int as wins,
  coalesce(sum(r.points), 0)::int as points,
  (count(*) filter (where r.is_soloist))::int as solos,
  (count(*) filter (where r.is_soloist and r.won))::int as solos_won,
  (count(*) filter (where r.party = 're'))::int as re_games,
  (count(*) filter (where r.party = 're' and r.won))::int as re_wins,
  count(distinct r.table_id)::int as evenings
from public.profiles p
left join public.game_results r on r.user_id = p.id
group by p.id, p.display_name;

-- ---------------------------------------------------------------------------
-- RPCs für Clients (Lobby)
-- ---------------------------------------------------------------------------
create function public.create_table(p_settings jsonb, p_name text default null)
returns public.tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
  v_table public.tables;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.tables where code = v_code);
  end loop;

  insert into public.tables (code, name, host_id, settings)
  values (v_code, coalesce(nullif(trim(p_name), ''), 'Doppelkopf-Abend'), v_uid, coalesce(p_settings, '{}'::jsonb))
  returning * into v_table;

  insert into public.table_players (table_id, user_id, seat) values (v_table.id, v_uid, 0);
  return v_table;
end;
$$;

create function public.join_table(p_code text)
returns public.tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_table public.tables;
  v_seat int;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet';
  end if;
  select * into v_table from public.tables where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'Diesen Tisch gibt es nicht';
  end if;
  if exists (select 1 from public.table_players where table_id = v_table.id and user_id = v_uid) then
    return v_table;
  end if;
  if v_table.status <> 'open' then
    raise exception 'Dieser Tisch ist geschlossen';
  end if;
  select s into v_seat
  from generate_series(0, 4) s
  where s not in (select seat from public.table_players where table_id = v_table.id)
  order by s
  limit 1;
  if v_seat is null then
    raise exception 'Der Tisch ist voll (maximal 5 Spieler)';
  end if;
  insert into public.table_players (table_id, user_id, seat) values (v_table.id, v_uid, v_seat);
  return v_table;
end;
$$;

create function public.leave_table(p_table uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if exists (
    select 1 from public.games
    where table_id = p_table and status = 'running' and v_uid = any (players)
  ) then
    raise exception 'Während eines laufenden Spiels kannst du nicht aufstehen';
  end if;
  delete from public.table_players where table_id = p_table and user_id = v_uid;
  -- Gastgeber geht: an den nächsten Spieler übergeben
  update public.tables t
  set host_id = (select user_id from public.table_players where table_id = p_table order by seat limit 1)
  where t.id = p_table and t.host_id = v_uid
    and exists (select 1 from public.table_players where table_id = p_table);
end;
$$;

create function public.take_seat(p_table uuid, p_seat int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_seat < 0 or p_seat > 4 then
    raise exception 'Ungültiger Platz';
  end if;
  if not public.is_table_member(p_table) then
    raise exception 'Du sitzt nicht an diesem Tisch';
  end if;
  if exists (select 1 from public.games where table_id = p_table and status = 'running') then
    raise exception 'Plätze können nur zwischen den Spielen getauscht werden';
  end if;
  if exists (select 1 from public.table_players where table_id = p_table and seat = p_seat) then
    raise exception 'Der Platz ist schon besetzt';
  end if;
  update public.table_players set seat = p_seat where table_id = p_table and user_id = v_uid;
end;
$$;

create function public.update_table_settings(p_table uuid, p_settings jsonb, p_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.tables where id = p_table and host_id = (select auth.uid())) then
    raise exception 'Nur der Gastgeber kann die Regeln ändern';
  end if;
  if exists (select 1 from public.games where table_id = p_table and status = 'running') then
    raise exception 'Regeln können nur zwischen den Spielen geändert werden';
  end if;
  update public.tables
  set settings = p_settings, name = coalesce(nullif(trim(p_name), ''), name)
  where id = p_table;
end;
$$;

revoke execute on function public.create_table(jsonb, text) from public, anon;
revoke execute on function public.join_table(text) from public, anon;
revoke execute on function public.leave_table(uuid) from public, anon;
revoke execute on function public.take_seat(uuid, int) from public, anon;
revoke execute on function public.update_table_settings(uuid, jsonb, text) from public, anon;
grant execute on function public.create_table(jsonb, text) to authenticated;
grant execute on function public.join_table(text) to authenticated;
grant execute on function public.leave_table(uuid) to authenticated;
grant execute on function public.take_seat(uuid, int) to authenticated;
grant execute on function public.update_table_settings(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs für die Edge Function (nur Service Role)
-- ---------------------------------------------------------------------------

-- Legt ein neues Spiel atomar an. p_hands: { "<user_id>": [Karten] }
create function public.create_game(
  p_table uuid,
  p_dealer_seat int,
  p_seats int[],
  p_players uuid[],
  p_public jsonb,
  p_secret jsonb,
  p_hands jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game uuid;
  v_number int;
  v_user text;
begin
  perform 1 from public.tables where id = p_table for update;
  if exists (select 1 from public.games where table_id = p_table and status = 'running') then
    raise exception 'Es läuft bereits ein Spiel';
  end if;
  select coalesce(max(number), 0) + 1 into v_number from public.games where table_id = p_table;

  insert into public.games (table_id, number, dealer_seat, seats, players, state, version)
  values (p_table, v_number, p_dealer_seat, p_seats, p_players, p_public, 0)
  returning id into v_game;

  insert into public.game_secrets (game_id, state) values (v_game, p_secret);

  for v_user in select jsonb_object_keys(p_hands) loop
    insert into public.game_hands (game_id, user_id, cards, version)
    values (v_game, v_user::uuid, p_hands -> v_user, 0);
  end loop;

  return v_game;
end;
$$;

-- Speichert einen neuen Spielzustand, wenn niemand dazwischen gespeichert hat (optimistische Sperre).
-- p_hands enthält nur geänderte Hände. p_results: [{user_id, points, party, won, kind, solo, is_soloist}]
create function public.save_game(
  p_game uuid,
  p_expected_version int,
  p_public jsonb,
  p_secret jsonb,
  p_hands jsonb,
  p_status text,
  p_results jsonb,
  p_next_dealer int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table uuid;
  v_new_version int := p_expected_version + 1;
  v_user text;
  r jsonb;
begin
  update public.games
  set state = p_public,
      version = v_new_version,
      status = p_status,
      finished_at = case when p_status <> 'running' then now() else null end
  where id = p_game and version = p_expected_version and status = 'running'
  returning table_id into v_table;

  if not found then
    return false;
  end if;

  update public.game_secrets set state = p_secret where game_id = p_game;

  for v_user in select jsonb_object_keys(coalesce(p_hands, '{}'::jsonb)) loop
    update public.game_hands
    set cards = p_hands -> v_user, version = v_new_version
    where game_id = p_game and user_id = v_user::uuid;
  end loop;

  if p_results is not null then
    for r in select * from jsonb_array_elements(p_results) loop
      insert into public.game_results (game_id, user_id, table_id, points, party, won, kind, solo, is_soloist)
      values (
        p_game,
        (r ->> 'user_id')::uuid,
        v_table,
        (r ->> 'points')::int,
        r ->> 'party',
        (r ->> 'won')::boolean,
        r ->> 'kind',
        r ->> 'solo',
        coalesce((r ->> 'is_soloist')::boolean, false)
      );
    end loop;
  end if;

  if p_next_dealer is not null then
    update public.tables set dealer_seat = p_next_dealer where id = v_table;
  end if;

  return true;
end;
$$;

revoke execute on function public.create_game(uuid, int, int[], uuid[], jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.save_game(uuid, int, jsonb, jsonb, jsonb, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.create_game(uuid, int, int[], uuid[], jsonb, jsonb, jsonb) to service_role;
grant execute on function public.save_game(uuid, int, jsonb, jsonb, jsonb, text, jsonb, int) to service_role;

revoke execute on function public.is_table_member(uuid) from public, anon;
grant execute on function public.is_table_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.tables;
alter publication supabase_realtime add table public.table_players;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_hands;
