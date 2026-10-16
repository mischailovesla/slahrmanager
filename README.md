# SLA HR Dashboard — Netlify-versie

Herbouw van het SLA HR Dashboard (Google Apps Script) als Netlify-app.
Wordt **naast** het bestaande Apps Script-dashboard gebouwd; dat blijft leidend tot een module volledig is overgezet.

## Status: stap 3 afgerond — alle mails en brieven draaien in Netlify

| Werkt | Nog in Apps Script |
|---|---|
| Google-login (alleen @ilovesla.com + allowlist) | Automatische herinneringen en signaleringen (triggers) |
| Toegangslog + actielog in Supabase (AVG) | Formulierstatus syncen (`syncFormulierStatus`) |
| Overzicht: werklijst, stats, aanzeg-alerts, open dossiers | Documenten doorsturen naar salarisadministratie |
| Medewerkersdossier: Shiftbase-zoekveld, contract(type), verlof, alle log-tabs (incl. Brieven) | Waarschuwing, Proeftijd, Korting, Beschikbaarheid, Vastloners, Vakantieplanner, Verloop |
| **Vinkjes**: Naar salaris (loonheffing + ontslag), Sommatie verwerkt, Overplaatsing ondertekend | |
| **Archiveren**: rij naar tab "Archief" (loonheffing, ontslag, sommatie, onboarding) | |
| **Loonheffing-tab** + mail: uitnodiging en herinnering (NL/EN) via Resend, SLA-huisstijl, persoonlijke upload-link, logging in de sheet (D/E resp. H/I) | Automatische herinneringen (`checkLoonheffingHerinneringen`, 09:00) |
| **Vrije brieven-tab**: brief in SLA-huisstijl (templates: ontslagname per direct, gemaakte afspraken, mededeling), Shiftbase-zoekveld, mail via Resend met optionele **PDF-brief als bijlage** (pdf-lib, zelfde briefopmaak als de Docs-versie), PDF downloaden, printbrief, logging in tab `Brieven` (A–I) |  |
| **Ontslag & aanzegging-tab** + mail: ontslagbevestiging + PDF, herinnering ondertekening, aanzegging NL/EN + PDF. De brieftekst staat in `_lib/brieftemplates.js` (1-op-1 uit de Docs-templates overgenomen) en wordt met pdf-lib als PDF opgebouwd. Aanzeg-knop in de 42-dagen-alert, aanzegplicht-check (30 dagen) in het modal | Automatische herinneringen (`checkOntslagHerinneringen`), `syncOntslagFormulieren`, Drive-archief van brieven |
| **Sommaties-tab** + modal: oproepbrief, 1e/2e/finale sommatie, ontslag op staande voet — mail in huisstijl (kleur per type), aanvullende tekst (kolom J), printbare aangetekende brief, logging A–H met kleur per type | Drive-archief |
| **Overplaatsing-tab** + modal: overplaatsing (art. 6:159 BW) of standplaatswijziging (art. 7:613 BW, automatisch bepaald op BV), NL/EN, PDF-brief uit `brieftemplates.js`, logging tab Overplaatsing A–L + P | |

**De Google Sheets blijven de enige waarheid** zolang Apps Script draait. Vinkjes en archiveren schrijven in exact dezelfde cellen (en kleuren) als Code.gs, dus beide dashboards blijven consistent. Supabase bevat alleen toegang en het actielog (`hr_acties`), geen HR-data.

## Stack

- **Frontend**: `public/` — één `index.html` + `app.js` + `styles.css`, vanilla JS, SLA-huisstijl
- **Backend**: `netlify/functions/` — Node (Netlify Functions). Alle secrets blijven server-side.
- **Auth**: Supabase Auth (Google OAuth) + tabel `hr_toegang` als allowlist, `hr_toegangslog` als audit-log
- **Data**: Google Sheets (service account, lees+schrijf), Shiftbase API
- **Mail/PDF**: Resend (REST) voor mail, `pdf-lib` voor alle brief-PDF's (puur JS; geen Google Drive/Docs nodig)

```
sla-hr-dashboard/
├─ public/                  index.html, app.js, styles.css
├─ netlify/functions/
│  ├─ _lib/                 auth.js, config.js, sheets.js, shiftbase.js, util.js, mail.js, sjablonen.js, pdf.js, brieftemplates.js
│  ├─ config.js             GET /api/config      publieke config voor de browser
│  ├─ ik.js                 GET /api/ik          wie ben ik + toegang (logt 'login')
│  ├─ overzicht.js          GET /api/overzicht   open dossiers + werklijst
│  ├─ medewerkers.js        GET /api/medewerkers Shiftbase-lijst (?ververs=1)
│  ├─ dossier.js            GET /api/dossier     ?id= | ?naam=&email=
│  ├─ toggle.js             POST /api/toggle     {type, rij, naam}  vinkje om in de sheet
│  ├─ archiveer.js          POST /api/archiveer  {type, rij, naam}  rij naar tab Archief
│  ├─ loonheffing.js        GET /api/loonheffing alle dossiers + templates
│  ├─ loonheffing-mail.js   POST /api/loonheffing-mail {template,to,naam,deadline,rij,subject,body,preview}
│  ├─ ontslag.js            GET /api/ontslag     alle ontslag/aanzegging-dossiers + templates
│  ├─ ontslag-mail.js       POST /api/ontslag-mail {template,to,naam,bv,adres,datumOpzegging,einddatum,rij,subject,body | preview | alleenPdf}
│  ├─ sommatie.js           GET /api/sommatie    alle sommaties + types/hints
│  ├─ sommatie-mail.js      POST /api/sommatie-mail {type,naam,email,bv,storeManager,datumAfwezig,datumAfspraak,eigenTekst | preview}
│  ├─ overplaatsing.js      GET /api/overplaatsing alle overplaatsingen + winkellijst
│  ├─ overplaatsing-mail.js POST /api/overplaatsing-mail {naam,to,adres,huidigeWinkel,nieuweWinkel,datumIndienst,ingangsdatum,functie,taal,rij | preview | alleenPdf}
│  ├─ brieven.js            GET /api/brieven     verstuurde brieven (tab Brieven) + templates + BV-lijst
│  └─ brief-mail.js         POST /api/brief-mail {naam,email,bv,categorie,onderwerp,tekst,metPdf | preview | alleenPdf}
├─ supabase/migrations/     0001_toegang.sql, 0002_acties.sql, 0003_mails.sql
├─ netlify.toml, package.json, .env.example
```

## Installatie (eenmalig, ±30 min)

### 1. Repo
```bash
git init
git add .
git commit -m "HR Dashboard Netlify - stap 1"
git remote add origin git@github.com:<jouw-account>/sla-hr-dashboard.git
git push -u origin main
```

### 2. Supabase (nieuw project, alleen HR)
1. Nieuw project aanmaken op supabase.com → regio **eu-central-1 (Frankfurt)**.
2. **SQL Editor** → plak `supabase/migrations/0001_toegang.sql` → Run. Controleer de seed-e-mails in `hr_toegang`. Daarna `0002_acties.sql` en `0003_mails.sql` → Run.
3. **Authentication → Providers → Google** aanzetten. Je hebt een Google OAuth Client nodig:
   - Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web application)
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Client ID + secret invullen in Supabase.
4. **Authentication → URL Configuration**: Site URL = je Netlify-URL; Redirect URLs: `https://<site>.netlify.app/**` (en `http://localhost:8888/**` voor lokaal).
5. Noteer uit **Settings → API**: Project URL, `anon` key, `service_role` key.

### 3. Google service account (sheets lezen)
1. Google Cloud Console (zelfde project als de OAuth-client is prima) → **IAM & Admin → Service Accounts → Create**. Naam: `hr-dashboard-reader`.
2. **Keys → Add key → JSON** → download.
3. **APIs & Services → Enable APIs** → *Google Sheets API* aanzetten.
4. Deel de vier sheets met het service-account-e-mailadres (`hr-dashboard-reader@...iam.gserviceaccount.com`) als **Bewerker** (vanaf stap 2; in stap 1 was Lezer genoeg):
   - Loonheffing `1vXelppN0QMsd_sPuzr7Efu3CnBchxEgujTmBMbGJ-Z4`
   - HR-acties / Ontslag / Overplaatsing `150zw8o-3MpjxXX4960qAWV2PsLxv0OTL8mq8FpiYUiQ`
   - Onboarding `1MPOTbng9LbrVlA7eGNilsu8Zhgqh0JHK3HZ7H6sPMLw`
   - Sommaties `1WRu28kAZXnLmjxdXwf53p3CIa_dQNH4Tha08cFz7x_E`
5. JSON base64-coderen voor de env var:
   ```bash
   base64 -i hr-dashboard-reader.json | tr -d '\n' | pbcopy
   ```

### 4. Netlify
1. **Add new site → Import from Git** → kies de repo. Build command leeg, publish `public` (staat in `netlify.toml`).
2. **Site configuration → Environment variables** — zie `.env.example`:

   | Variabele | Waarde |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_KEY` | service_role key (**geheim**) |
   | `GOOGLE_SA_JSON_B64` | base64 van de service-account-JSON |
   | `SHIFTBASE_KEY` | dezelfde key als in de Apps Script-scripteigenschappen |
   | `TOEGANG_DOMEIN` | `ilovesla.com` |
   | `RESEND_API_KEY` | Resend → API Keys (**secret**) |
   | `MAIL_FROM` | `SLA HR Team <hr@ilovesla.com>` (optioneel; dit is de default) |
3. Deploy. Open de site, log in met je Google-account.

### 5. Controle
- Login werkt → in Supabase **Table Editor → hr_toegangslog** staat een regel `login`.
- Overzicht toont dezelfde open dossiers als het Apps Script-dashboard.
- Dossier: zoek jezelf of een collega; contract en verlof komen uit Shiftbase.

## Versie
Staat in `public/version.js` (één plek) en is zichtbaar onderin elke pagina en in de header-badge. Bij elke oplevering ophogen; `package.json` volgt dezelfde nummering.

| Versie | Datum | Inhoud |
|---|---|---|
| 0.1.0 | 15-10-2026 | Stap 1: login, Overzicht, Dossier (lezen) |
| 0.2.0 | 15-10-2026 | Stap 2: afvinken + archiveren in de sheets, actielog, contracttype |
| 0.3.0 | 15-10-2026 | Stap 3a/3b: Resend-mail, SLA-sjablonen, Loonheffing-tab met uitnodiging/herinnering |
| 0.4.0 | 15-10-2026 | Stap 3c: Vrije brieven-tab, PDF-brief via pdf-lib, printbrief, tab Brieven, dossier-sectie Brieven |
| 0.5.0 | 16-10-2026 | Stap 3d: Ontslag & aanzegging-tab, mail + PDF (ontslagbevestiging, aanzegging NL/EN) via pdf-lib, aanzeg-knop in het overzicht |
| 0.5.1 | 16-10-2026 | Shiftbase-zoekveld in het ontslag- en loonheffingsmodal (vult naam, e-mail, BV, adres, einddatum) |
| 0.5.2 | 16-10-2026 | Handtekening (i.o. Jop van de Graaf) in de ontslagbevestiging-PDF: `_lib/assets/handtekening_io_jop.png`, meegebundeld via `included_files` |
| 0.6.0 | 16-10-2026 | Stap 3e: Sommaties-tab (mail, printbrief, aanvullende tekst) en Overplaatsing-tab (mail + PDF NL/EN, standplaats vs. overplaatsing) |

## Mail (Resend)
Alle mail gaat via Resend vanaf `hr@ilovesla.com`. Eenmalig: Resend → **Domains → Add domain** → `ilovesla.com` → de DNS-records (DKIM/SPF) bij de domeinbeheerder zetten → *Verify*. Zonder verificatie weigert Resend de afzender (het dashboard geeft dan die hint). Elke verzonden mail staat in `hr_mails` (Supabase) en als actie in `hr_acties`.

## Vrije brieven (PDF)
De PDF wordt in de Netlify Function opgebouwd met `pdf-lib` (Helvetica ≈ Arial, A4, marges 56/56/64/64 pt): logo **SLA** groen, categorie in kapitalen, Datum/Aan/BV, *Betreft*, aanhef, alinea's en lijsten (regels met `- `), groet met `AFZENDER_NAAM` + BV, voettekst. Bestandsnaam `Brief_<Naam>.pdf`, gaat als Resend-bijlage mee (base64). Elke verzonden brief komt in tab **Brieven** van de HR-acties-sheet (kolommen A–I, exact als `vbLogBrief_`); de tab wordt aangemaakt als hij ontbreekt. De PDF wordt (nog) niet in Drive bewaard — "⬇ PDF" in het modal downloadt dezelfde PDF lokaal.

## Ontslag & aanzegging (brief-PDF's)
De drie brieven (ontslagbevestiging, aanzegging NL, aanzegging EN) staan als tekst in `netlify/functions/_lib/brieftemplates.js`, letterlijk overgenomen uit de Google Docs-templates. Opmaak: `**vet**`, `*cursief*`, `• ` = opsomming, lege regel = alinea; placeholders `{{Naam}} {{Adres}} {{DatumOpzegging}} {{Einddatum}} {{BV}} {{HuidigeDatum}}`. Brieftekst aanpassen = dit bestand aanpassen en deployen. De ontslagbevestiging bevat de handtekening uit `_lib/assets/handtekening_io_jop.png` (PNG, transparant) op de regel `{{HANDTEKENING}}`, met "i.o. Jop van de Graaf" eronder; vervangen = het PNG-bestand vervangen. Bewust gekozen (16-10-2026) boven de Docs/Drive-route, omdat die domain-wide delegation door de Workspace-beheerder vereist. Gevolg: geen Drive-archief; de PDF zit in de mail en is via **⬇ PDF bekijken** altijd opnieuw te maken. Sheet-logging: H/I (+ nieuwe rij A–G), herinneringen K/L.

## Sommaties & overplaatsing
**Sommatie**: mailtekst per type in `sjablonen.js` (`sommatieHtml/Plain`, 1-op-1 uit Code.gs); de aanvullende tekst komt als extra alinea vóór de groet en in kolom J. De aangetekende printbrief wordt in de browser opgebouwd (knop *Brief* / *Printbrief*). Sheet: nieuwe rij A–H, status 'Verstuurd' met kleur per type (groen / `#fff2cc` 2e / `#fce5cd` finale / `#f4cccc` OoSV).
**Overplaatsing**: zelfde BV voor beide winkels → standplaatswijziging, anders overplaatsing; de vier brieven staan in `brieftemplates.js` (`OVERPL_NL/EN`, `STANDPL_NL/EN`, uit de Docs-templates); winkeladressen in `WINKEL_BV_MAP`. Sheet: tab Overplaatsing A–L + P (type); bij een bestaande rij alleen K/L.

## Lokaal draaien
```bash
npm install
cp .env.example .env   # invullen
npx netlify dev        # http://localhost:8888
```

## Toegang beheren
Allowlist = tabel `hr_toegang` in Supabase (Table Editor). `actief=false` zet iemand uit zonder de regel te verwijderen. Alle opvragen worden gelogd in `hr_toegangslog`; de view `hr_toegangslog_recent` toont de laatste 200.

## Extra dossier-tabs
`DOSSIER_EXTRA_TABS` in `netlify/functions/_lib/config.js` — per tab sheet-ID, tabnaam en de kolomindex van naam/e-mail/datum. Zodra Waarschuwing.gs, Proeftijd.gs, Korting.gs en Beschikbaarheid.gs zijn aangeleverd worden die hier ingevuld (Brieven heeft al een eigen sectie).

## Roadmap
1. ✅ Shell + login + Overzicht/Dossier (lezen)
2. ✅ Afvinken + archiveren in de sheets, actielog in Supabase, contracttype uit Shiftbase
3. ✅ Mail + brieven: 3a mailfundament, 3b loonheffing, 3c vrije brieven, 3d ontslag/aanzegging, 3e sommatie + overplaatsing. (Waarschuwing, Proeftijd, Korting, Beschikbaarheid: aparte modules, nog in Apps Script)
4. Signaleringen als Netlify Scheduled Functions; per module de Apps Script-trigger uit
5. Apps Script uit, oude exec-URL doorverwijzen
