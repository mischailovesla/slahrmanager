-- Stap 4: log van automatische checks (scheduled functions + handmatige runs)
create table if not exists hr_signaleringen (
  id bigint generated always as identity primary key,
  tijdstip timestamptz not null default now(),
  "check" text not null,          -- sync-formulieren, loonheffing-herinneringen, ...
  bron text not null,             -- 'schedule' of 'handmatig:<email>'
  droog boolean not null default true,
  gevonden int not null default 0,
  verstuurd int not null default 0,
  fouten int not null default 0,
  details jsonb
);
create index if not exists hr_signaleringen_tijd on hr_signaleringen (tijdstip desc);
alter table hr_signaleringen enable row level security;
-- alleen de service role (functions) leest/schrijft; geen policies voor anon/authenticated
