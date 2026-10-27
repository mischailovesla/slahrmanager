-- v0.33.0: Contract op maat — de medewerker ondertekent digitaal; het getekende contract komt in hr_uploads met soort 'contract'.
-- De soort-controle op hr_uploads opnieuw zetten met alle soorten uit _lib/uploads.js (SOORTEN).
-- NOT VALID: bestaande rijen worden niet opnieuw gecontroleerd, alleen nieuwe.
alter table hr_uploads drop constraint if exists hr_uploads_soort_check;
alter table hr_uploads add constraint hr_uploads_soort_check
  check (soort in ('loon','ontslag','korting','oproep','overplaatsing','waarschuwing','beschikbaarheid','contract')) not valid;
