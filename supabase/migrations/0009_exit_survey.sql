-- Fase 2f (19-10-2026): exit-survey i.p.v. exitgesprek. Eén rij per ingevulde survey; de link (token) staat in de aanzeggings-/ontslagbrief en -mail.
create table if not exists hr_exit (
  id uuid primary key default gen_random_uuid(),
  naam text not null default '',
  email text not null default '',
  winkel text not null default '',
  bv text not null default '',
  taal text not null default 'NL',
  bron text not null default '',            -- aanzegging | ontslag | proeftijd
  token_datum text not null default '',     -- datum waarop de link is verstuurd (uit het token); naam+token_datum = één survey
  anoniem boolean not null default false,   -- medewerker koos 'verwerk mijn naam niet' (naam wordt dan leeg bewaard)
  antwoorden jsonb not null default '{}'::jsonb,
  nps smallint,
  opmerking text not null default '',
  medewerker_id text,
  ip text,
  ingevuld_op timestamptz not null default now()
);
create index if not exists hr_exit_ingevuld on hr_exit (ingevuld_op desc);
create unique index if not exists hr_exit_token on hr_exit (naam, token_datum) where naam <> '';
alter table hr_exit enable row level security;
