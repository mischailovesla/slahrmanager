-- ============================================================
-- SLA HR Dashboard (Netlify) - migratie 0001: toegang
-- Draai dit in de Supabase SQL Editor van het NIEUWE HR-project.
-- Tegenhanger van Toegang.gs: allowlist + toegangslog (AVG).
-- ============================================================

-- Allowlist: wie mag het dashboard in. Alleen Google-accounts
-- van het SLA-domein worden sowieso toegelaten door de login;
-- deze tabel is de tweede sleutel (per persoon aan/uit).
create table if not exists public.hr_toegang (
  email        text primary key,
  naam         text,
  rol          text not null default 'hr',          -- 'hr' | 'admin'
  actief       boolean not null default true,
  aangemaakt   timestamptz not null default now(),
  aangemaakt_door text
);

-- Toegangslog: elke geslaagde en geweigerde login + elke data-opvraag
-- (zelfde doel als de tab "Toegangslog" in Apps Script).
create table if not exists public.hr_toegangslog (
  id           bigint generated always as identity primary key,
  tijdstip     timestamptz not null default now(),
  email        text not null,
  actie        text not null,          -- 'login' | 'geweigerd' | 'overzicht' | 'dossier' | ...
  details      text,
  ip           text,
  user_agent   text
);
create index if not exists hr_toegangslog_tijdstip_idx on public.hr_toegangslog (tijdstip desc);
create index if not exists hr_toegangslog_email_idx    on public.hr_toegangslog (email);

-- RLS aan: de browser (anon key) mag NIETS direct lezen of schrijven.
-- Alle toegang loopt via de Netlify Functions met de service key.
alter table public.hr_toegang    enable row level security;
alter table public.hr_toegangslog enable row level security;
-- (geen policies = geen toegang voor anon/authenticated; service_role omzeilt RLS)

-- Seed: het HR-team. Pas aan naar wens.
insert into public.hr_toegang (email, naam, rol, aangemaakt_door) values
  ('mischa@ilovesla.com', 'Mischa Kamstra',   'admin', 'migratie 0001'),
  ('jodi@ilovesla.com',   'Jodi',             'hr',    'migratie 0001'),
  ('jop@ilovesla.com',    'Jop van de Graaf', 'hr',    'migratie 0001'),
  ('hr@ilovesla.com',     'HR (gedeeld)',     'hr',    'migratie 0001')
on conflict (email) do nothing;

-- Handig overzicht: laatste 200 logregels
create or replace view public.hr_toegangslog_recent as
  select tijdstip, email, actie, details
  from public.hr_toegangslog
  order by tijdstip desc
  limit 200;
