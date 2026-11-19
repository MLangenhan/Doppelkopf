-- Anpassungen fürs Namensschild: Rahmen (an Erfolge gekoppelt), Avatar-Symbol und -Farbe
alter table public.profiles
  add column if not exists frame text,
  add column if not exists avatar text,
  add column if not exists avatar_color text;

-- Rahmen ist freigeschaltet, sobald man einen Erfolg der passenden Stufe hat (erkennbar am Punktwert)
create function public.set_cosmetics(p_frame text, p_avatar text, p_avatar_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_points int := case p_frame
    when 'bronze' then 10 when 'silver' then 25 when 'gold' then 50 when 'holo' then 100 when 'crystal' then 250
    else null end;
begin
  if p_frame is not null and v_points is null then
    raise exception 'Diesen Rahmen gibt es nicht.';
  end if;
  if v_points is not null and not exists (
    select 1 from public.user_achievements where user_id = v_uid and points = v_points
  ) then
    raise exception 'Diesen Rahmen hast du noch nicht freigeschaltet.';
  end if;
  update public.profiles
  set frame = p_frame, avatar = left(p_avatar, 24), avatar_color = left(p_avatar_color, 24)
  where id = v_uid;
end;
$$;

revoke execute on function public.set_cosmetics(text, text, text) from public, anon;
grant execute on function public.set_cosmetics(text, text, text) to authenticated;
