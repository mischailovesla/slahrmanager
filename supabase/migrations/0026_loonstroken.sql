-- v0.51.0 (17-11-2026): loonstroken uit Exact Online in het HR Dashboard (In dienst -> Loonstroken).
-- Draaien in het HR-project ("SLA HR Manager"). Eenmalig plakken in de SQL-editor en op Run drukken.
--
-- Hoe het werkt:
--  * HR sleept de PDF uit Exact (één PDF per BV met alle medewerkers) in het dashboard. Het origineel gaat via een
--    getekende upload-URL naar de privé bucket 'hr-loonstroken' (map bron/).
--  * /api/loonstroken knipt de PDF per medewerker (map stroken/) en koppelt elke strook aan een Shiftbase-medewerker.
--  * Hier staan ALLEEN kopgegevens (naam, Exact-nr, BV, periode, afdeling). Bedragen, IBAN en adres staan alleen in de PDF.
--  * Alleen de personen met salarisinzage (hr_instellingen 'salaris_inzage') kunnen loonstroken zien, downloaden of mailen.
-- Alleen de service key van de functions leest/schrijft (RLS aan, geen policies).

create table if not exists hr_loonstroken (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),
  -- uit de strook
  bv text not null,                     -- 'SLA Midden B.V.'
  exact_nr text not null,               -- medewerkernummer in Exact (per administratie)
  periode text not null,                -- verwerkingsperiode 'YYYY-MM' (uit de runcode)
  run text not null default '',         -- 'M2026.10.3' (maandelijks, 2026, periode 10, run 3)
  naam_strook text not null,            -- 'Mevrouw J. Loewy'
  afdeling text,
  functie text,
  documenten text[] not null default '{}', -- ['Salarisspecificatie'] of ['Nabetalingsspecificatie', 'Aanvullende salarisspecificatie 2026-08']
  paginas int not null default 1,
  pad text not null,                    -- stroken/<periode>/<bv>/<run>_<nr>_<naam>.pdf in bucket hr-loonstroken
  bron_pad text,                        -- het originele bestand (bron/...)
  bron_naam text,
  -- koppeling aan Shiftbase
  shiftbase_id text,
  naam text,                            -- naam uit Shiftbase (leeg = nog niet gekoppeld)
  email text,
  koppeling text not null default '' check (koppeling in ('', 'vast', 'zeker', 'voorstel', 'handmatig')),
  koppeling_reden text,
  geupload_door text,
  unique (bv, exact_nr, run)
);
create index if not exists hr_loonstroken_periode on hr_loonstroken (periode desc, bv);
create index if not exists hr_loonstroken_sb on hr_loonstroken (shiftbase_id, periode desc);
alter table hr_loonstroken enable row level security;

-- Vaste koppeling Exact-medewerkernummer (per BV) -> Shiftbase. Na één keer koppelen gaat het daarna altijd goed.
create table if not exists hr_exact_koppeling (
  bv text not null,
  exact_nr text not null,
  shiftbase_id text not null,
  naam text,
  door text,
  bijgewerkt_op timestamptz not null default now(),
  primary key (bv, exact_nr)
);
alter table hr_exact_koppeling enable row level security;

-- Privé bucket (alleen PDF, max 25 MB per bestand)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-loonstroken', 'hr-loonstroken', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
