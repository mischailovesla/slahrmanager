-- Fase 5b (21-10-2026): actieplan na het MTO. Per winkel (of SLA-breed) 2–3 acties met eigenaar en deadline,
-- gekoppeld aan de ronde waarin het probleem zichtbaar werd en (optioneel) een thema. Open acties met een deadline binnen
-- 7 dagen komen in de takenlijst; bij de volgende ronde laat het dashboard zien of de themascore is gestegen.
create table if not exists hr_mto_actie (
  id uuid primary key default gen_random_uuid(),
  ronde_id uuid references hr_mto_ronde(id) on delete set null,   -- aanleiding
  winkel text not null default '',                                 -- '' = SLA-breed
  thema text not null default '',                                  -- themasleutel uit mto-vragen.js, '' = algemeen
  titel text not null,
  toelichting text not null default '',
  eigenaar text not null default '',                               -- naam (vrije tekst), bijv. de store manager
  eigenaar_email text not null default '',
  deadline date,
  status text not null default 'open',                             -- open | bezig | klaar | vervallen
  resultaat text not null default '',                              -- wat is er gedaan / wat leverde het op
  afgerond_op timestamptz,
  aangemaakt_op timestamptz not null default now(),
  aangemaakt_door text not null default '',
  bijgewerkt_op timestamptz not null default now(),
  bijgewerkt_door text not null default ''
);
create index if not exists hr_mto_actie_winkel on hr_mto_actie (winkel, status);
alter table hr_mto_actie enable row level security;
