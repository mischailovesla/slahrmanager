-- v0.46.0 (05-11-2026): fooiverdeling per maand.
-- Eén rij per maand: de fooi per pot (uit de mail van Jop), eventueel handmatig ingevulde omzet,
-- en bij 'definitief' een bevroren momentopname van de hele verdeling (uren, omzet, sleutel, bedrag per medewerker),
-- zodat latere wijzigingen in Shiftbase de uitbetaalde verdeling niet meer veranderen.
create table if not exists hr_fooi (
  jaar int not null,
  maand int not null check (maand between 1 and 12),
  potten jsonb not null default '{}'::jsonb,           -- { ceintuur: 1142.05, midden: 965.15, AW: 1036.99, ... }
  omzet_handmatig jsonb not null default '{}'::jsonb,  -- { CB: 52234.01, ... } alleen als de omzetkoppeling ontbreekt
  resultaat jsonb,                                     -- momentopname bij status 'definitief'
  status text not null default 'concept' check (status in ('concept', 'definitief')),
  opgeslagen_door text not null default '',
  opgeslagen_op timestamptz not null default now(),
  primary key (jaar, maand)
);
alter table hr_fooi enable row level security;
-- (geen policies: alleen de service key van de functions leest/schrijft)
