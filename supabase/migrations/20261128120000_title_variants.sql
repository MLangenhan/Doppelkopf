-- Titel in zwei Formen (z. B. Stichsammler / Stichsammlerin): gekauft wird der Titel, getragen werden darf
-- jede Form. Die weibliche Form steht im Profil als „key:f“.
create or replace function public.set_showcase(p_badges text[], p_title text, p_show_badges boolean, p_show_title boolean)
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
  if p_title is not null and (
    split_part(p_title, ':', 2) not in ('', 'f')
    or not exists (select 1 from public.user_titles where user_id = v_uid and key = split_part(p_title, ':', 1))
  ) then
    raise exception 'Diesen Titel hast du noch nicht.';
  end if;
  update public.profiles
  set showcase = coalesce(p_badges, '{}'), title = p_title, show_badges = p_show_badges, show_title = p_show_title
  where id = v_uid;
end;
$$;

create or replace function public.refund_title(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  delete from public.user_titles
  where user_id = v_uid and key = p_key and bought_at > now() - interval '15 seconds';
  if not found then
    raise exception 'Der Kauf lässt sich nicht mehr rückgängig machen.';
  end if;
  -- Trug man den Titel (in einer der beiden Formen) schon, wird er wieder abgelegt
  update public.profiles set title = null where id = v_uid and split_part(title, ':', 1) = p_key;
end;
$$;
