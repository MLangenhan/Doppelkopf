-- Titel-Shop: Kauf innerhalb von 10 Sekunden rückgängig machen (Punkte kommen zurück)
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
  -- Trug man den Titel schon, wird er wieder abgelegt
  update public.profiles set title = null where id = v_uid and title = p_key;
end;
$$;

revoke execute on function public.refund_title(text) from public, anon;
grant execute on function public.refund_title(text) to authenticated;

-- Änderungen an Profilen (Titel, Vitrine, Rahmen, Avatar) live an den Tisch melden
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
