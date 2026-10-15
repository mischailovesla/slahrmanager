-- ============================================================
-- SLA HR Dashboard (Netlify) - migratie 0003: verzendlog mails
-- Elke mail die het Netlify-dashboard via Resend verstuurt.
-- ============================================================
create table if not exists public.hr_mails (
  id          bigint generated always as identity primary key,
  tijdstip    timestamptz not null default now(),
  door        text not null,          -- HR-medewerker die verstuurde
  bron        text not null,          -- 'loonheffing' | 'ontslag' | ...
  type        text not null,          -- 'uitnodiging' | 'herinnering' | ...
  naar        text not null,
  naam        text,
  onderwerp   text,
  taal        text,
  rij         integer,                -- rij in de bron-sheet
  resend_id   text,
  status      text not null default 'verstuurd'
);
create index if not exists hr_mails_tijdstip_idx on public.hr_mails (tijdstip desc);
create index if not exists hr_mails_naar_idx     on public.hr_mails (naar);
alter table public.hr_mails enable row level security;
