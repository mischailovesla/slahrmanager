-- Fase 3b (20-10-2026): gesprekken vastleggen in het dossier (check-in-opvolging, proeftijd, verzuim, correctie, functioneren, overig),
-- met optionele vervolgdatum → taak op het Overzicht zolang het vervolg niet is afgerond. Niet verwijderbaar (dossier), wel te bewerken (gelogd).
create table if not exists hr_gesprekken (
  id uuid primary key default gen_random_uuid(),
  medewerker_id text,
  naam text not null default '',
  email text not null default '',
  winkel text not null default '',
  soort text not null default 'overig',
  datum date not null default current_date,
  kanaal text not null default '',
  gevoerd_door text not null default '',
  aanleiding text not null default '',
  besproken text not null default '',
  afspraken text not null default '',
  vervolg_datum date,
  vervolg_afgerond_op timestamptz,
  vervolg_afgerond_door text not null default '',
  vervolg_notitie text not null default '',
  bron_ref text not null default '',        -- 'checkin:<id>' of 'vervolg:<gesprek-id>'
  aangemaakt_op timestamptz not null default now(),
  aangemaakt_door text not null default '',
  bijgewerkt_op timestamptz,
  bijgewerkt_door text not null default ''
);
create index if not exists hr_gesprekken_mid on hr_gesprekken (medewerker_id);
create index if not exists hr_gesprekken_naam on hr_gesprekken (lower(naam));
create index if not exists hr_gesprekken_datum on hr_gesprekken (datum desc);
create index if not exists hr_gesprekken_vervolg on hr_gesprekken (vervolg_datum) where vervolg_datum is not null and vervolg_afgerond_op is null;
alter table hr_gesprekken enable row level security;
