-- Persönliche Anzeige (Kartenrücken, Filz, Konfetti) wandert mit dem Konto
alter table public.profiles add column if not exists personal jsonb not null default '{}'::jsonb;
