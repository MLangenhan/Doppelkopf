-- Etappe 2: Titel (mit Erfolgspunkten kaufbar) und Vitrine im Profil

-- Punkte je Erfolg mitspeichern (die Edge Function trägt sie ein); bestehende nachtragen
alter table public.user_achievements add column if not exists points int not null default 0;
update public.user_achievements set points = case key
    when 'ersterStich' then 10
    when 'erstesSpiel' then 10
    when 'ersterSieg' then 10
    when 'fuchsjaeger' then 10
    when 'ansager' then 10
    when 'doppelkopf' then 10
    when 'gegenDieAlten' then 10
    when 'hochzeit' then 10
    when 'armutszeugnis' then 10
    when 'goenner' then 10
    when 'gastgeber' then 10
    when 'stammgast' then 10
    when 'karlchen' then 25
    when 'fuchsbau' then 25
    when 'solist' then 25
    when 'keine90' then 25
    when 'siegesserie' then 25
    when 'comeback' then 25
    when 'marathon' then 25
    when 'nachteule' then 25
    when 'schweinchen' then 25
    when 'fuchsVerteidigt' then 25
    when 'dulleSticht' then 25
    when 'dreifachKoenig' then 25
    when 'fleischlos' then 50
    when 'keine60' then 50
    when 'doppelterDoko' then 50
    when 'fuchsjagd' then 50
    when 'stillesSolo' then 50
    when 'alleinVorDemAltar' then 50
    when 'absageMeister' then 50
    when 'unaufhaltsam' then 50
    when 'veteran' then 50
    when 'schwarz' then 100
    when 'soloSammler' then 100
    when 'karlchenFuchs' then 100
    when 'gegenDenStrom' then 100
    when 'makellos' then 100
    when 'schwarzMitAnsage' then 250
    when 'soloSchwarz' then 250
    else 0 end;

-- Preise der Titel (wie TITLES in der Engine)
create function public.title_cost(p_key text)
returns int
language sql
immutable
set search_path = ''
as $$
  select cost from (values
    ('pechvogel', 20),
    ('kartenschubser', 30),
    ('stichsammler', 40),
    ('fuchsfluesterer', 50),
    ('karokoenig', 60),
    ('dullenschwinger', 70),
    ('ansagenass', 80),
    ('schweinchenzuechter', 90),
    ('hochzeitsplaner', 100),
    ('kontrarebell', 110),
    ('solokuenstler', 120),
    ('unbestechlich', 130),
    ('schwarzmaler', 250),
    ('grossmeister', 300),
    ('legende', 400)
  ) as t(key, cost) where key = p_key;
$$;

create table public.user_titles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  bought_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_titles enable row level security;

create policy "Titel sind für angemeldete Nutzer sichtbar"
  on public.user_titles for select to authenticated using (true);

-- Was im Profil gezeigt wird
alter table public.profiles
  add column if not exists showcase text[] not null default '{}',
  add column if not exists title text,
  add column if not exists show_badges boolean not null default true,
  add column if not exists show_title boolean not null default true;

-- Titel kaufen: nur mit genug freien Punkten (verdient minus ausgegeben)
create function public.buy_title(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cost int := public.title_cost(p_key);
  v_earned int;
  v_spent int;
begin
  if v_cost is null then
    raise exception 'Diesen Titel gibt es nicht.';
  end if;
  if exists (select 1 from public.user_titles where user_id = v_uid and key = p_key) then
    raise exception 'Den Titel hast du schon.';
  end if;
  select coalesce(sum(points), 0) into v_earned from public.user_achievements where user_id = v_uid;
  select coalesce(sum(public.title_cost(key)), 0) into v_spent from public.user_titles where user_id = v_uid;
  if v_earned - v_spent < v_cost then
    raise exception 'Nicht genug Erfolgspunkte.';
  end if;
  insert into public.user_titles (user_id, key) values (v_uid, p_key);
end;
$$;

-- Vitrine und Titel setzen: nur eigene Erfolge (höchstens 3) und gekaufte Titel
create function public.set_showcase(p_badges text[], p_title text, p_show_badges boolean, p_show_title boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if coalesce(array_length(p_badges, 1), 0) > 3 then
    raise exception 'Höchstens drei Badges.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_badges, '{}')) b
    where not exists (select 1 from public.user_achievements where user_id = v_uid and key = b)
  ) then
    raise exception 'Diesen Erfolg hast du noch nicht.';
  end if;
  if p_title is not null and not exists (select 1 from public.user_titles where user_id = v_uid and key = p_title) then
    raise exception 'Diesen Titel hast du noch nicht.';
  end if;
  update public.profiles
  set showcase = coalesce(p_badges, '{}'), title = p_title, show_badges = p_show_badges, show_title = p_show_title
  where id = v_uid;
end;
$$;

revoke execute on function public.buy_title(text) from public, anon;
revoke execute on function public.set_showcase(text[], text, boolean, boolean) from public, anon;
grant execute on function public.buy_title(text) to authenticated;
grant execute on function public.set_showcase(text[], text, boolean, boolean) to authenticated;
