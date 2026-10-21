-- Fase 6 (21-10-2026): digitaal ondertekenen van ontslagbevestiging, aanzegging, proeftijdbrieven en overplaatsing.
-- Eenvoudige elektronische handtekening (art. 3:15a BW) met bewijsspoor: persoonlijke link + eenmalige code per mail,
-- getypte naam + akkoord (+ optioneel getekende handtekening), tijdstip, IP, browser en SHA-256 van het document voor en na.
-- Een rij is na het tekenen niet meer te wijzigen (trigger), zodat het bewijsspoor vastligt.
create table if not exists hr_ondertekening (
  id uuid primary key default gen_random_uuid(),
  soort text not null,                         -- upload-soort: ontslag | overplaatsing
  type text not null default '',               -- ontslag | aanzegging | proeftijd | overplaatsing | standplaats
  titel text not null default '',
  naam text not null,
  email text not null default '',
  rij integer,
  taal text not null default 'NL',
  origineel_pad text not null,                 -- storage (bucket hr-documenten)
  origineel_hash text not null,                -- SHA-256 van de verstuurde PDF
  status text not null default 'wacht',        -- wacht | getekend | vervangen | ingetrokken
  aangemaakt_op timestamptz not null default now(),
  aangemaakt_door text not null default '',
  code_hash text,
  code_verstuurd_op timestamptz,
  code_geldig_tot timestamptz,
  codes_verstuurd integer not null default 0,
  code_pogingen integer not null default 0,
  getekend_op timestamptz,
  getekend_naam text,
  getekend_ip text,
  getekend_browser text,
  met_handtekening boolean not null default false,
  getekend_pad text,
  getekend_hash text,
  upload_id uuid
);
create index if not exists hr_ondertekening_naam on hr_ondertekening (soort, naam, status);
alter table hr_ondertekening enable row level security;

-- Na ondertekening ligt de rij vast (alleen nog 'ingetrokken' door HR mag, de rest blijft gelijk)
create or replace function hr_ondertekening_vast() returns trigger language plpgsql as $$
begin
  if old.status = 'getekend' and (new.getekend_op is distinct from old.getekend_op or new.getekend_hash is distinct from old.getekend_hash
     or new.getekend_naam is distinct from old.getekend_naam or new.origineel_hash is distinct from old.origineel_hash or new.getekend_pad is distinct from old.getekend_pad) then
    raise exception 'Ondertekend document kan niet meer worden gewijzigd';
  end if;
  return new;
end $$;
drop trigger if exists hr_ondertekening_vast on hr_ondertekening;
create trigger hr_ondertekening_vast before update on hr_ondertekening for each row execute function hr_ondertekening_vast();
