-- Spiele können abgebrochen werden (z. B. wenn jemand gehen muss). Abgebrochene Spiele zählen nicht.
alter table public.games drop constraint if exists games_status_check;
alter table public.games
  add constraint games_status_check check (status in ('running', 'finished', 'redeal', 'aborted'));
