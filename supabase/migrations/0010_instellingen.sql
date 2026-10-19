-- Instellingen die HR zelf in het dashboard aanpast (19-10-2026): exit-survey aan/uit en de vragenlijst.
-- Sleutel/waarde (jsonb); de code valt terug op config.js als een sleutel ontbreekt.
create table if not exists hr_instellingen (
  sleutel text primary key,
  waarde jsonb not null,
  bijgewerkt_op timestamptz not null default now(),
  bijgewerkt_door text not null default ''
);
alter table hr_instellingen enable row level security;
-- Exit-survey start gepauzeerd (Mischa neemt de vragen eerst door met collega's); aanzetten via Uitstroom → Exit-surveys.
insert into hr_instellingen (sleutel, waarde, bijgewerkt_door) values ('exit_actief', 'false'::jsonb, 'migratie 0010') on conflict (sleutel) do nothing;
