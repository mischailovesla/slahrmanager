-- Stap 6 (19-10-2026): Google Sheets -> Supabase. Eén tabel per sheet-tab, kolommen in sheet-volgorde,
-- alle waarden als tekst (exact zoals de sheet ze toonde). rij = sheet-rijnummer bij import, daarna max+1.
-- Archief = gearchiveerd_op/door/bron op de rij (geen aparte tab meer). Alleen de service role leest/schrijft.

create table if not exists hr_loonheffing (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  deadline text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  ontvangen text not null default '',
  taal text not null default '',
  herinnering text not null default '',
  aantal_herinneringen text not null default '',
  mahdia text not null default '',
  salaris text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_loonheffing_email on hr_loonheffing (lower(email));
create index if not exists hr_loonheffing_actief on hr_loonheffing (rij) where gearchiveerd_op is null;
alter table hr_loonheffing enable row level security;

create table if not exists hr_ontslag (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  opzegging text not null default '',
  einddatum text not null default '',
  kol_e text not null default '',
  bedrijf text not null default '',
  adres text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  ondertekend text not null default '',
  herinnering text not null default '',
  aantal_herinneringen text not null default '',
  kol_m text not null default '',
  mahdia text not null default '',
  salaris text not null default '',
  brief_url text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_ontslag_email on hr_ontslag (lower(email));
create index if not exists hr_ontslag_actief on hr_ontslag (rij) where gearchiveerd_op is null;
alter table hr_ontslag enable row level security;

create table if not exists hr_sommatie (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  bv text not null default '',
  type text not null default '',
  datum_afwezig text not null default '',
  datum_afspraak text not null default '',
  verzenddatum text not null default '',
  status text not null default '',
  verwerkt text not null default '',
  aanvullend text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_sommatie_email on hr_sommatie (lower(email));
create index if not exists hr_sommatie_actief on hr_sommatie (rij) where gearchiveerd_op is null;
alter table hr_sommatie enable row level security;

create table if not exists hr_onboarding (
  rij bigint primary key,
  voornaam text not null default '',
  achternaam text not null default '',
  email text not null default '',
  taal text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  herinnering text not null default '',
  collectie2 text not null default '',
  locatie text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_onboarding_email on hr_onboarding (lower(email));
create index if not exists hr_onboarding_actief on hr_onboarding (rij) where gearchiveerd_op is null;
alter table hr_onboarding enable row level security;

create table if not exists hr_overplaatsing (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  adres text not null default '',
  huidige_bv text not null default '',
  nieuwe_bv text not null default '',
  datum_indienst text not null default '',
  ingangsdatum text not null default '',
  functie text not null default '',
  standplaats text not null default '',
  taal text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  ondertekend text not null default '',
  herinnering text not null default '',
  aantal_herinneringen text not null default '',
  type text not null default '',
  brief_url text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_overplaatsing_email on hr_overplaatsing (lower(email));
create index if not exists hr_overplaatsing_actief on hr_overplaatsing (rij) where gearchiveerd_op is null;
alter table hr_overplaatsing enable row level security;

create table if not exists hr_brieven (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  bv text not null default '',
  categorie text not null default '',
  onderwerp text not null default '',
  tekst text not null default '',
  pdf text not null default '',
  verzenddatum text not null default '',
  status text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_brieven_email on hr_brieven (lower(email));
create index if not exists hr_brieven_actief on hr_brieven (rij) where gearchiveerd_op is null;
alter table hr_brieven enable row level security;

create table if not exists hr_waarschuwingen (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  adres text not null default '',
  winkel text not null default '',
  bv text not null default '',
  datum_overtreding text not null default '',
  regels text not null default '',
  toelichting text not null default '',
  taal text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_waarschuwingen_email on hr_waarschuwingen (lower(email));
create index if not exists hr_waarschuwingen_actief on hr_waarschuwingen (rij) where gearchiveerd_op is null;
alter table hr_waarschuwingen enable row level security;

create table if not exists hr_beschikbaarheid (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  adres text not null default '',
  winkel text not null default '',
  bv text not null default '',
  ingangsdatum text not null default '',
  taal text not null default '',
  onderbouwing text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_beschikbaarheid_email on hr_beschikbaarheid (lower(email));
create index if not exists hr_beschikbaarheid_actief on hr_beschikbaarheid (rij) where gearchiveerd_op is null;
alter table hr_beschikbaarheid enable row level security;

create table if not exists hr_korting (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  keuze text not null default '',
  ingangsdatum text not null default '',
  deadline text not null default '',
  taal text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  retour text not null default '',
  document text not null default '',
  herinnering text not null default '',
  aantal_herinneringen text not null default '',
  salaris text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_korting_email on hr_korting (lower(email));
create index if not exists hr_korting_actief on hr_korting (rij) where gearchiveerd_op is null;
alter table hr_korting enable row level security;

create table if not exists hr_notities (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  datum text not null default '',
  auteur text not null default '',
  tekst text not null default '',
  extra jsonb,                      -- kolommen voorbij de bekende (uit de import), informatief
  geimporteerd boolean not null default false, -- true = uit de sheet-import (idempotent her-importeren)
  gearchiveerd_op text,             -- 'jjjj-mm-dd uu:mm' (Europe/Amsterdam), null = actief
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_notities_email on hr_notities (lower(email));
create index if not exists hr_notities_actief on hr_notities (rij) where gearchiveerd_op is null;
alter table hr_notities enable row level security;

-- Oude Google-Forms-reacties (Drive-links). Nieuwe uploads staan in hr_uploads (migratie 0005).
create table if not exists hr_formulier_reacties (
  id bigserial primary key,
  soort text not null check (soort in ('loon','ontslag')),
  tijdstempel text not null default '',
  naam text not null default '',
  email text not null default '',
  loon_url text not null default '',      -- loonbelastingverklaring (soort loon)
  indienst_url text not null default '',  -- indiensttredingsformulier (soort loon)
  doc_url text not null default '',       -- ondertekend document (soort ontslag)
  rij int,                                -- rijnummer in de responses-tab
  created_at timestamptz not null default now()
);
create index if not exists hr_formulier_reacties_soort on hr_formulier_reacties (soort, lower(email));
alter table hr_formulier_reacties enable row level security;

-- Importlog: per run één regel per tab (droog of echt), voor het vergelijkingsrapport in Beheer.
create table if not exists hr_migratie_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  door text,
  droog boolean not null default true,
  tabel text not null,
  bron text not null,
  sheet_rijen int not null default 0,
  db_rijen_voor int not null default 0,
  db_rijen_na int not null default 0,
  koppen jsonb,
  opmerking text
);
alter table hr_migratie_log enable row level security;

-- updated_at bijhouden
create or replace function hr_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists hr_loonheffing_upd on hr_loonheffing; create trigger hr_loonheffing_upd before update on hr_loonheffing for each row execute function hr_set_updated_at();
drop trigger if exists hr_ontslag_upd on hr_ontslag; create trigger hr_ontslag_upd before update on hr_ontslag for each row execute function hr_set_updated_at();
drop trigger if exists hr_sommatie_upd on hr_sommatie; create trigger hr_sommatie_upd before update on hr_sommatie for each row execute function hr_set_updated_at();
drop trigger if exists hr_onboarding_upd on hr_onboarding; create trigger hr_onboarding_upd before update on hr_onboarding for each row execute function hr_set_updated_at();
drop trigger if exists hr_overplaatsing_upd on hr_overplaatsing; create trigger hr_overplaatsing_upd before update on hr_overplaatsing for each row execute function hr_set_updated_at();
drop trigger if exists hr_brieven_upd on hr_brieven; create trigger hr_brieven_upd before update on hr_brieven for each row execute function hr_set_updated_at();
drop trigger if exists hr_waarschuwingen_upd on hr_waarschuwingen; create trigger hr_waarschuwingen_upd before update on hr_waarschuwingen for each row execute function hr_set_updated_at();
drop trigger if exists hr_beschikbaarheid_upd on hr_beschikbaarheid; create trigger hr_beschikbaarheid_upd before update on hr_beschikbaarheid for each row execute function hr_set_updated_at();
drop trigger if exists hr_korting_upd on hr_korting; create trigger hr_korting_upd before update on hr_korting for each row execute function hr_set_updated_at();
drop trigger if exists hr_notities_upd on hr_notities; create trigger hr_notities_upd before update on hr_notities for each row execute function hr_set_updated_at();
