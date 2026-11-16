-- v0.49.0 (16-11-2026): declaraties via SLA Academy (vervangt het Google Form "SLA Declaratie Formulier").
-- Draaien in het HR-project ("SLA HR Manager"), NIET in Academy. Eenmalig plakken in de SQL-editor en op Run drukken.
--
-- Hoe het werkt:
--  * de medewerker dient in via SLA Academy (eigen login). Academy praat met /api/declaratie-app van het HR Dashboard;
--    die controleert de Academy-sessie en schrijft hier. Bedragen, IBAN's en bonnetjes staan dus in het HR-project,
--    niet in de trainingsdatabase (AVG-scheiding).
--  * het bonnetje gaat via een getekende upload-URL rechtstreeks naar de privé bucket 'hr-declaraties'.
--  * HR ziet en verwerkt alles in het dashboard: In dienst -> Declaraties (ingediend -> betaald / afgewezen).
-- Alleen de service key van de functions leest/schrijft (RLS aan, geen policies).

create table if not exists hr_declaraties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- wie (uit de Academy-sessie, niet door de medewerker in te typen)
  email text not null,
  naam text not null,
  academy_id uuid,
  shiftbase_id text,
  winkel text,
  winkel_code text,
  taal text not null default 'nl',
  -- wat
  aankoop_datum date not null,
  leverancier text not null,            -- winkel waar gekocht (Albert Heijn, NS, ...)
  bedrag numeric(10,2) not null check (bedrag > 0),
  omschrijving text not null,
  iban text not null,                   -- genormaliseerd, zonder spaties
  iban_naam text not null,
  bon jsonb not null,                   -- {pad, naam_orig, mime, bytes}
  akkoord boolean not null default false,
  -- afhandeling
  status text not null default 'ingediend' check (status in ('ingediend', 'betaald', 'afgewezen')),
  betaald_op date,
  afgewezen_reden text,
  verwerkt_door text,
  verwerkt_op timestamptz
);
create index if not exists hr_declaraties_status on hr_declaraties (status, created_at desc);
create index if not exists hr_declaraties_email on hr_declaraties (email, created_at desc);
alter table hr_declaraties enable row level security;

-- IBAN eenmalig bewaren per medewerker (vooringevuld bij de volgende declaratie, aanpasbaar)
create table if not exists hr_declaratie_iban (
  email text primary key,
  iban text not null,
  iban_naam text not null,
  bijgewerkt_op timestamptz not null default now()
);
alter table hr_declaratie_iban enable row level security;

-- Privé bucket voor bonnetjes (max 10 MB; foto's worden in de app al verkleind)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-declaraties', 'hr-declaraties', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do nothing;
