-- Fester Zuschauer-Platz: wer zuschaut, sitzt am Tisch, spielt aber nicht mit (höchstens einer pro Tisch)
alter table public.table_players add column if not exists spectator boolean not null default false;

create or replace function public.set_spectator(p_table uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.is_table_member(p_table) then
    raise exception 'Du sitzt nicht an diesem Tisch';
  end if;
  if p_on and exists (
    select 1 from public.table_players where table_id = p_table and spectator and user_id <> v_uid
  ) then
    raise exception 'Es schaut schon jemand zu – der Zuschauerplatz ist besetzt';
  end if;
  -- Gilt ab dem nächsten Spiel; ein laufendes Spiel bleibt, wie es ist
  update public.table_players set spectator = p_on where table_id = p_table and user_id = v_uid;
end;
$$;

revoke execute on function public.set_spectator(uuid, boolean) from public, anon;
grant execute on function public.set_spectator(uuid, boolean) to authenticated;
