-- Wer zu fünft aussetzt, darf die Hände der vier Spieler sehen (nur im laufenden Spiel)
create policy "Wer aussetzt, sieht alle Hände"
  on public.game_hands for select to authenticated using (
    exists (
      select 1 from public.games g
      where g.id = game_hands.game_id
        and g.status = 'running'
        and public.is_table_member(g.table_id)
        and not ((select auth.uid()) = any (g.players))
    )
  );
