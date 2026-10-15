-- ============================================================
-- SLA HR Dashboard (Netlify) - migratie 0002: actielog
-- Draai dit in de Supabase SQL Editor van het HR-project.
-- Elke schrijfactie vanuit het Netlify-dashboard (vinkje, archiveren)
-- wordt hier vastgelegd. De data zelf blijft in de Google Sheets.
-- ============================================================
create table if not exists public.hr_acties (
  id          bigint generated always as identity primary key,
  tijdstip    timestamptz not null default now(),
  door        text not null,          -- e-mail van de HR-medewerker
  actie       text not null,          -- 'toggle' | 'archiveer'
  bron        text not null,          -- 'loonheffing' | 'ontslag' | 'sommatie' | 'overplaatsing' | 'onboarding'
  veld        text,                   -- 'mahdia' | 'verwerkt' | 'ondertekend' | null
  rij         integer,
  naam        text,                   -- medewerker waar het over gaat
  oud         text,
  nieuw       text,
  details     text
);
create index if not exists hr_acties_tijdstip_idx on public.hr_acties (tijdstip desc);
create index if not exists hr_acties_naam_idx     on public.hr_acties (naam);
alter table public.hr_acties enable row level security;
-- (geen policies: alleen de service key van de functions schrijft/leest)

create or replace view public.hr_acties_recent as
  select tijdstip, door, actie, bron, veld, naam, oud, nieuw
  from public.hr_acties order by tijdstip desc limit 200;
