-- 16-11-2026: laatste openstaande declaratie uit het Google Form overzetten naar het dashboard.
-- Draaien in "SLA HR Manager" NA migratie 0025_declaraties.sql. Opnieuw draaien kan geen kwaad (dubbelcheck).
-- Bron: sheet "SLA Declaratie Formulier (Responses)", rij 190 (ingediend 16-11-2026 14:15:12, PAID = FALSE).
-- E-mail, Academy-id, Shiftbase-id en taal komen uit Academy, zodat Laura hem ook in de app ziet.
-- Het bonnetje blijft in Google Drive (bon.drive); het dashboard opent die link.
insert into hr_declaraties (created_at, email, naam, academy_id, shiftbase_id, winkel, winkel_code, taal,
                            aankoop_datum, leverancier, bedrag, omschrijving, iban, iban_naam, bon, akkoord, status)
select '2026-11-16 14:15:12+01', 'le.janssen2006@gmail.com', 'Laura Janssen', '74a6c691-9308-4357-9116-c35d8ac668af', '1246613',
       'Voorstraat', 'VS', 'en',
       '2026-11-16', 'Albert Heijn', 14.20, 'Tien avocado''s', 'NL79RABO0301541272', 'L.E. Janssen',
       '{"drive": "https://drive.google.com/open?id=1movYykDYuEupHS7ZsbszvO8wbixkKHP2", "naam_orig": "Google Form-upload", "mime": "", "bytes": 0}'::jsonb,
       true, 'ingediend'
where not exists (select 1 from hr_declaraties where email = 'le.janssen2006@gmail.com' and aankoop_datum = '2026-11-16' and bedrag = 14.20);

-- IBAN alvast vooringevuld voor haar volgende declaratie in Academy
insert into hr_declaratie_iban (email, iban, iban_naam) values ('le.janssen2006@gmail.com', 'NL79RABO0301541272', 'L.E. Janssen')
on conflict (email) do nothing;

select naam, winkel_code, aankoop_datum, leverancier, bedrag, status from hr_declaraties order by created_at desc limit 5;
