-- Batch B (16-10-2026): documenten van medewerkers zonder Google Drive.
-- Eigen uploadpagina (/upload.html?t=<token>) -> Supabase Storage (privé bucket) + registratie hieronder.
create table if not exists hr_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  soort text not null check (soort in ('loon','ontslag','korting')),
  naam text not null,                 -- naam uit de upload-link (zoals in de mail/sheet)
  email text,                         -- door de medewerker opgegeven (optioneel)
  rij int,                            -- sheetrij op moment van registratie (informatief)
  bestanden jsonb not null,           -- [{key,label,pad,naam_orig,bytes,mime}]
  ip text
);
create index if not exists hr_uploads_soort_naam on hr_uploads (soort, naam);
create index if not exists hr_uploads_created on hr_uploads (created_at desc);
alter table hr_uploads enable row level security;
-- alleen de service role (functions) leest/schrijft; geen policies voor anon/authenticated

-- Privé bucket; uploads gaan via getekende upload-URL's (createSignedUploadUrl), lezen via getekende links. Geen storage-policies nodig.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-documenten', 'hr-documenten', false, 15728640, array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do nothing;
