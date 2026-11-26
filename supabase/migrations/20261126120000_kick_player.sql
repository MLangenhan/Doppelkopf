-- Gastgeber kann jemanden vom Tisch entfernen (nicht mitten in einem Spiel, in dem die Person mitspielt)
create or replace function public.kick_player(p_table uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.tables where id = p_table and host_id = v_uid) then
    raise exception 'Nur der Gastgeber kann jemanden vom Tisch nehmen';
  end if;
  if p_user = v_uid then
    raise exception 'Zum Gehen bitte „Tisch verlassen“ nutzen';
  end if;
  if exists (
    select 1 from public.games
    where table_id = p_table and status = 'running' and p_user = any (players)
  ) then
    raise exception 'Erst nach dem laufenden Spiel möglich';
  end if;
  delete from public.table_players where table_id = p_table and user_id = p_user;
  if not found then
    raise exception 'Diese Person sitzt nicht an diesem Tisch';
  end if;
end;
$$;

revoke execute on function public.kick_player(uuid, uuid) from public, anon;
grant execute on function public.kick_player(uuid, uuid) to authenticated;
