-- Fase 5 (21-10-2026): medewerkertevredenheidsonderzoek (MTO), 2x per jaar voor iedereen.
-- ANONIEM: hr_mto_uitnodiging weet wie er een link kreeg en óf die persoon heeft ingevuld (voor herinneringen en respons),
-- hr_mto_reactie bevat de antwoorden met alleen winkel + groep — zonder medewerker, uitnodiging of tijdstip.
-- Er is dus geen koppeling tussen een persoon en zijn antwoorden. Rapporten tonen een groep pas vanaf 4 reacties (config MTO_MIN_N).
create table if not exists hr_mto_ronde (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  bron text not null default 'dashboard',          -- dashboard | import (nulmeting uit Google Forms)
  gestart_op timestamptz not null default now(),
  gestart_door text not null default '',
  sluit_op timestamptz,                             -- na 21 dagen dicht (sched-mto)
  gesloten_op timestamptz,
  status text not null default 'open',              -- open | gesloten
  opmerking text not null default ''
);
create index if not exists hr_mto_ronde_start on hr_mto_ronde (gestart_op desc);

create table if not exists hr_mto_uitnodiging (
  id uuid primary key default gen_random_uuid(),   -- = token in de link
  ronde_id uuid not null references hr_mto_ronde(id) on delete cascade,
  medewerker_id text,
  naam text not null default '',
  email text not null default '',
  winkel text not null default '',
  groep text not null default 'medewerker',        -- medewerker (SLA maker) | manager ((junior) store manager)
  verstuurd_op timestamptz,                         -- null = nog versturen (grote rondes gaan in delen)
  herinnerd_1 timestamptz,                          -- na 7 dagen
  herinnerd_2 timestamptz,                          -- na 14 dagen
  ingevuld boolean not null default false,          -- bewust geen tijdstip (anders te koppelen aan de reactie)
  fout text not null default ''
);
create unique index if not exists hr_mto_uitnodiging_uniek on hr_mto_uitnodiging (ronde_id, medewerker_id) where medewerker_id is not null;
create index if not exists hr_mto_uitnodiging_ronde on hr_mto_uitnodiging (ronde_id);

create table if not exists hr_mto_reactie (
  id uuid primary key default gen_random_uuid(),
  ronde_id uuid not null references hr_mto_ronde(id) on delete cascade,
  winkel text not null default '',
  groep text not null default 'medewerker',
  taal text not null default 'NL',
  antwoorden jsonb not null default '{}'::jsonb,    -- { w1: 4, w2: 5, ... } (1–5)
  enps smallint,                                    -- 0–10
  prioriteit text not null default '',              -- themasleutel
  opmerking text not null default '',
  bron text not null default 'link'                 -- link | import
);
create index if not exists hr_mto_reactie_ronde on hr_mto_reactie (ronde_id);

alter table hr_mto_ronde enable row level security;
alter table hr_mto_uitnodiging enable row level security;
alter table hr_mto_reactie enable row level security;
