-- Eigene Kartenreihenfolge pro Spieler (gilt für alle Spiele): Liste von Kartenarten, z. B. ["H-10", "C-Q", …]
alter table public.profiles add column if not exists card_order jsonb;
