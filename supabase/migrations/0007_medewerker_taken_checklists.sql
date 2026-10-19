-- Fase 1 (19-10-2026): medewerker als kern. medewerker_id = Shiftbase user-id, gevuld door de koppeling
-- (Beheer → Gegevens → Medewerkers koppelen, en automatisch na elke sync-formulieren-run): e-mail → naam.
-- Daarnaast: afgehandelde taken (takenlijst op Overzicht) en on-/offboarding-checklists.

alter table hr_loonheffing add column if not exists medewerker_id text;
create index if not exists hr_loonheffing_mid on hr_loonheffing (medewerker_id);
alter table hr_ontslag add column if not exists medewerker_id text;
create index if not exists hr_ontslag_mid on hr_ontslag (medewerker_id);
alter table hr_sommatie add column if not exists medewerker_id text;
create index if not exists hr_sommatie_mid on hr_sommatie (medewerker_id);
alter table hr_onboarding add column if not exists medewerker_id text;
create index if not exists hr_onboarding_mid on hr_onboarding (medewerker_id);
alter table hr_overplaatsing add column if not exists medewerker_id text;
create index if not exists hr_overplaatsing_mid on hr_overplaatsing (medewerker_id);
alter table hr_brieven add column if not exists medewerker_id text;
create index if not exists hr_brieven_mid on hr_brieven (medewerker_id);
alter table hr_waarschuwingen add column if not exists medewerker_id text;
create index if not exists hr_waarschuwingen_mid on hr_waarschuwingen (medewerker_id);
alter table hr_beschikbaarheid add column if not exists medewerker_id text;
create index if not exists hr_beschikbaarheid_mid on hr_beschikbaarheid (medewerker_id);
alter table hr_korting add column if not exists medewerker_id text;
create index if not exists hr_korting_mid on hr_korting (medewerker_id);
alter table hr_notities add column if not exists medewerker_id text;
create index if not exists hr_notities_mid on hr_notities (medewerker_id);

-- Takenlijst: items die HR bewust heeft afgehandeld/geparkeerd (alleen voor meldingen die niet vanzelf verdwijnen)
create table if not exists hr_taken_afgehandeld (
  sleutel text primary key,          -- '<check>|<naam of id>'
  door text not null,
  op timestamptz not null default now(),
  tot timestamptz not null,          -- tot wanneer verborgen (daarna komt het item terug als het nog speelt)
  opmerking text
);
alter table hr_taken_afgehandeld enable row level security;

-- On-/offboarding-checklists per medewerker
create table if not exists hr_checklists (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('onboarding','offboarding')),
  medewerker_id text,
  naam text not null,
  email text not null default '',
  winkel text not null default '',
  items jsonb not null,              -- [{key,label,klaar:boolean,door,op,opmerking}]
  gestart_door text not null,
  gestart_op timestamptz not null default now(),
  afgerond_op timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists hr_checklists_open on hr_checklists (type) where afgerond_op is null;
create index if not exists hr_checklists_mid on hr_checklists (medewerker_id);
alter table hr_checklists enable row level security;
drop trigger if exists hr_checklists_upd on hr_checklists; create trigger hr_checklists_upd before update on hr_checklists for each row execute function hr_set_updated_at();
