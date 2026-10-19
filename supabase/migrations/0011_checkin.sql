-- Fase 3a (20-10-2026): check-in na 30 en 60 dagen in dienst. Eén rij per uitnodiging (medewerker × moment);
-- de link (token) verwijst naar deze rij, invullen kan één keer. Niet anoniem: HR volgt lage scores op.
create table if not exists hr_checkin (
  id uuid primary key default gen_random_uuid(),
  medewerker_id text,
  naam text not null default '',
  email text not null default '',
  winkel text not null default '',
  bv text not null default '',
  indienst text not null default '',           -- dd-mm-jjjj (eerste contract in Shiftbase)
  moment smallint not null,                     -- 30 | 60 (dagen in dienst)
  bron text not null default 'schedule',        -- schedule | handmatig
  verstuurd_op timestamptz not null default now(),
  verstuurd_door text not null default '',
  herinnerd_op timestamptz,
  ingevuld_op timestamptz,
  taal text not null default 'NL',
  antwoorden jsonb not null default '{}'::jsonb,
  score numeric(3,1),                           -- gemiddelde van de schaalvragen (1–5)
  laag boolean not null default false,
  laag_reden text not null default '',
  opmerking text not null default '',
  opgevolgd_op timestamptz,
  opgevolgd_door text not null default '',
  opvolg_notitie text not null default ''
);
create unique index if not exists hr_checkin_uniek on hr_checkin (medewerker_id, moment) where medewerker_id is not null;
create index if not exists hr_checkin_verstuurd on hr_checkin (verstuurd_op desc);
alter table hr_checkin enable row level security;
-- Start gepauzeerd: vragen eerst doornemen, dan aanzetten in Instroom → Check-in 30/60.
insert into hr_instellingen (sleutel, waarde, bijgewerkt_door) values ('checkin_actief', 'false'::jsonb, 'migratie 0011') on conflict (sleutel) do nothing;
