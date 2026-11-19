-- 0027 (v0.54.0, 19-11-2026): HR kan een los document (pdf/foto) aan een medewerkersdossier toevoegen,
-- bijvoorbeeld de mail met een reactie op een waarschuwing. Opslag als upload-soort 'dossier' in hr_uploads
-- (bucket hr-documenten); omschrijving en uploader staan in hr_uploads.bestanden.
-- Draaien in de SQL Editor van het Supabase-project "SLA HR Manager". Idempotent.
alter table hr_uploads drop constraint if exists hr_uploads_soort_check;
alter table hr_uploads add constraint hr_uploads_soort_check
  check (soort in ('loon','ontslag','korting','oproep','overplaatsing','waarschuwing','beschikbaarheid','contract','dossier')) not valid;
