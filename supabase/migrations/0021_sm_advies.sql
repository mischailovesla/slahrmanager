-- ============================================================
-- SLA HR Dashboard - migratie 0021 (v0.28.0): advies van de store manager over verlengen
-- De store manager geeft via de link in de wekelijkse winkelmail advies (zonder login).
-- Eén advies per medewerker × einddatum huidig contract; HR neemt het over in het besluit (hr_verlenging).
-- ============================================================
create table if not exists hr_sm_advies (
  id uuid primary key default gen_random_uuid(),
  medewerker_id text not null,
  contract_eind text not null,                 -- jjjj-mm-dd, zelfde sleutel als hr_verlenging
  naam text not null default '',
  winkel text not null default '',
  advies text not null check (advies in ('verlengen','niet','twijfel')),
  opmerking text not null default '',
  gegeven_op timestamptz not null default now(),
  ip text,
  unique (medewerker_id, contract_eind)
);
alter table hr_sm_advies enable row level security;
-- alleen de service-role (Netlify functions) leest en schrijft; geen policies voor anon/authenticated
