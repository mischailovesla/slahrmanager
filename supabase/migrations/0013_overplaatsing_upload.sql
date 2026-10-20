-- v0.19.3 (20-10-2026): ondertekende overplaatsing/standplaatswijziging via de eigen uploadpagina (soort 'overplaatsing').
-- Voorheen ging die upload via de ontslag-uploadlink (soort 'ontslag') en kon hij bij een ontslagdossier terechtkomen.
alter table hr_uploads drop constraint if exists hr_uploads_soort_check;
alter table hr_uploads add constraint hr_uploads_soort_check check (soort in ('loon','ontslag','korting','oproep','overplaatsing'));
