-- Fase 4c (20-10-2026): contractverlenging als proces — één besluit per medewerker × einddatum huidig contract.
create table if not exists hr_verlenging (
  id uuid primary key default gen_random_uuid(),
  medewerker_id text not null,
  naam text not null default '',
  email text not null default '',
  winkel text not null default '',
  contract_start text not null default '',     -- jjjj-mm-dd, start huidige overeenkomst (Shiftbase, knips samengevoegd)
  contract_eind text not null,                 -- jjjj-mm-dd, einde huidige overeenkomst
  besluit text not null check (besluit in ('verlengen-tijdelijk','verlengen-vast','niet-verlengen','zelf-opgezegd')),
  nieuwe_eind text not null default '',        -- jjjj-mm-dd bij verlengen-tijdelijk
  advies_sm text not null default '' check (advies_sm in ('','verlengen','niet','twijfel')),
  advies_opmerking text not null default '',
  notitie text not null default '',
  keten_aantal int,
  keten_maanden numeric,
  besloten_door text not null default '',
  besloten_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),
  unique (medewerker_id, contract_eind)
);
create index if not exists hr_verlenging_eind on hr_verlenging (contract_eind);
alter table hr_verlenging enable row level security;
