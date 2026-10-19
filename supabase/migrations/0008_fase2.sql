-- Fase 2 (19-10-2026): uitstroomreden op ontslag/aanzegging, aanbod vaste arbeidsomvang (oproepkrachten), upload-soort 'oproep'.
alter table hr_ontslag add column if not exists uitstroomreden text not null default '';

create table if not exists hr_oproepaanbod (
  rij bigint primary key,
  naam text not null default '',
  email text not null default '',
  adres text not null default '',
  winkel text not null default '',
  bv text not null default '',
  sinds text not null default '',
  gem_uren text not null default '',
  aangeboden_uren text not null default '',
  ingangsdatum text not null default '',
  reactiedatum text not null default '',
  taal text not null default '',
  status text not null default '',
  verzenddatum text not null default '',
  reactie text not null default '',
  reactie_datum text not null default '',
  document text not null default '',
  extra jsonb,
  geimporteerd boolean not null default false,
  medewerker_id text,
  gearchiveerd_op text,
  gearchiveerd_door text,
  gearchiveerd_bron text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_oproepaanbod_email on hr_oproepaanbod (lower(email));
create index if not exists hr_oproepaanbod_mid on hr_oproepaanbod (medewerker_id);
alter table hr_oproepaanbod enable row level security;
drop trigger if exists hr_oproepaanbod_upd on hr_oproepaanbod; create trigger hr_oproepaanbod_upd before update on hr_oproepaanbod for each row execute function hr_set_updated_at();

-- hr_uploads: soort 'oproep' (ondertekend aanbod) toestaan
alter table hr_uploads drop constraint if exists hr_uploads_soort_check;
alter table hr_uploads add constraint hr_uploads_soort_check check (soort in ('loon','ontslag','korting','oproep'));
