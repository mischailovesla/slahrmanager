# SLA HR Dashboard — Netlify-versie

Herbouw van het SLA HR Dashboard (Google Apps Script) als Netlify-app.
Wordt **naast** het bestaande Apps Script-dashboard gebouwd; dat blijft leidend tot een module volledig is overgezet.

## Status: cutover gedaan (19-10-2026) — stap 6 (v0.12.0) Sheets → Supabase; fase 1 (v0.13.0) takenlijst/checklists; fase 2 (v0.14.3) contractketen, verzuim, jeugd, oproepaanbod, uitstroomreden, exit-survey; fase 3a (v0.15.0) check-in 30/60 dagen; fase 3c (v0.16.0) scorekaart per winkel; fase 3b (v0.17.0) gesprekken; fase 4a (v0.18.0) training & certificaten (Academy); fase 4b (v0.19.0) HR-maandrapport; fase 4c (v0.20.0) contractverlenging

| Werkt | Nog in Apps Script |
|---|---|
| Google-login (alleen @ilovesla.com + allowlist) | — (niets meer; alleen de triggers tot de cutover) |
| Toegangslog + actielog in Supabase (AVG) | Formulierstatus syncen (`syncFormulierStatus`) |
| Overzicht: werklijst, stats, aanzeg-alerts, open dossiers | |
| Medewerkersdossier: Shiftbase-zoekveld, contract(type), verlof, alle log-tabs (incl. Brieven, Waarschuwingen, Beschikbaarheid, Korting) | |
| **Vinkjes**: Naar salaris (loonheffing + ontslag), Sommatie verwerkt, Overplaatsing ondertekend | |
| **Archiveren**: rij naar tab "Archief" (loonheffing, ontslag, sommatie, onboarding) | |
| **Loonheffing-tab** + mail: uitnodiging en herinnering (NL/EN) via Resend, SLA-huisstijl, persoonlijke upload-link, logging in de sheet (D/E resp. H/I) |  |
| **Vrije brieven-tab**: brief in SLA-huisstijl (templates: ontslagname per direct, gemaakte afspraken, mededeling), Shiftbase-zoekveld, mail via Resend met optionele **PDF-brief als bijlage** (pdf-lib, zelfde briefopmaak als de Docs-versie), PDF downloaden, printbrief, logging in tab `Brieven` (A–I) |  |
| **Ontslag & aanzegging-tab** + mail: ontslagbevestiging + PDF, herinnering ondertekening, aanzegging NL/EN + PDF. De brieftekst staat in `_lib/brieftemplates.js` (1-op-1 uit de Docs-templates overgenomen) en wordt met pdf-lib als PDF opgebouwd. Aanzeg-knop in de 42-dagen-alert, aanzegplicht-check (30 dagen) in het modal | Drive-archief van brieven |
| **Sommaties-tab** + modal: oproepbrief, 1e/2e/finale sommatie, ontslag op staande voet — mail in huisstijl (kleur per type), aanvullende tekst (kolom J), printbare aangetekende brief, logging A–H met kleur per type | Drive-archief |
| **Overplaatsing-tab** + modal: overplaatsing (art. 6:159 BW) of standplaatswijziging (art. 7:613 BW, automatisch bepaald op BV), NL/EN, PDF-brief uit `brieftemplates.js`, logging tab Overplaatsing A–L + P | |
| **Batch A** (v0.8.0): **Proeftijd** — 4 extra templates in het ontslag-modal (werkgever/werknemer, NL/EN, einddatum verplicht, log als ontslag in de ontslag-sheet). **Ontslag op staande voet** — knop *OoSV + brief* in de Sommaties-kop: brief (art. 7:677/678 BW, optioneel hoor-en-wederhoor-blok) als PDF, mail aan medewerker **cc hr@**, log in de sommatie-sheet (`OoSV verstuurd op …`, `#f4cccc`). **Waarschuwingen-tab** — checklist met de 35 huisregels (woordelijk uit de contractbijlage, per categorie), brief NL/EN + PDF, tab `Waarschuwingen` A–K. **Beschikbaarheid-tab** — kennisgeving weekendbeschikbaarheid NL/EN + PDF; bij het kiezen van een medewerker wordt de **data-onderbouwing** (laatste 8 weekenden: dienst/verlof/doordeweeks) uit het Shiftbase-rooster berekend; tab `Beschikbaarheid` A–J. Beide tabs worden aangemaakt als ze ontbreken. | |
| **Batch B** (v0.9.0): **Loonheffingskorting-tab** (Korting.gs v1.5) — verzoek aan bestaande medewerkers om de korting aan/uit te zetten of zelf te kiezen, NL/EN, ingangsdatum + deadline, tab `Korting` A–M in de loonheffing-sheet; uploads worden op tijdstempel gekoppeld (alleen ná de verzenddatum); dagelijkse herinnering na 3 dagen (K/L). **Documenten → salarisadministratie** (stuurDocsNaarSalaris v29.3) — knop *→ Salaris* bij loonheffing (K), ontslag (O) en korting (M): mailt de geüploade formulieren (Supabase Storage) als bijlage naar `SALARIS_EMAIL`. **Eigen uploadpagina** `upload.html` + `/api/upload` vervangt Google Forms/Drive voor alle nieuwe uploads (zie hieronder). **Contracten & starters-tab** (Contract.gs v3.0) — starters van de laatste 90 dagen uit Shiftbase, contract-PDF in Shiftbase (intern, download), loonheffing/indienst gematcht op e-mail → naam → roepnaam, *→ Salaris* via dezelfde flow. | |
| **Batch C** (v0.10.0): **Vastloners-tab** (Vastloners.gs v30.0) — maandmutaties voor de salarisadministratie: per store manager vakantie (dagen/uren), ziekte met periodes, wachtdag uit Shiftbase, overige verlofsoorten met loonconsequentie (`VL_TYPE_MAP` op absentee_option_id), 4-wekenregel nagerekend, *Kopieer overzicht*. **Vakantieplanner-tab** (Shiftbase.gs v6) — heatmap winkel × week (max. tegelijk met vakantie, goedgekeurd + aangevraagd, drempels 20/30%), stille afwezigen als laag vanaf de huidige week + eigen lijst. **Verloopanalyse-tab** (Verloop.gs v1.3) — verloop% per winkel en organisatie, in-/uitstroom per maand, bestand begin→eind, vroege uitstroom ≤90 dagen, cohortuitval 30/60/90, 12/24 maanden. | |
| **Batch D** (v0.11.0): **Dossiernotities** (tab `Notities`, auteur + datum) en **Dossier als PDF** (volledig dossier incl. notities, pdf-lib; export gelogd) in het medewerkersdossier. **Toegangslog-tab** (Beheer): AVG-verantwoording uit `hr_toegangslog` + `hr_acties` — opvragen/inzagen/exports/geweigerde logins per 30 dagen, per account, laatste 300 regels. **Archief herstellen** (Beheer): gearchiveerde rijen per sheet terugzetten. **Sorteren** op elke kolomkop (datums, getallen, tekst). | |
| **Signaleringen-tab** + 11 scheduled functions: AVG-bewaartermijnen (1e v.d. maand 08:00, verwijdert niets), datakwaliteit Shiftbase (1e v.d. maand 09:00), vakantiepieken (ma 09:00), korting-herinneringen (09:55), weekendbeschikbaarheid (ma 09:45: 3 weekenden geen dienst, wél doordeweeks), formulierstatus syncen (4-uurlijks), loonheffing- en ontslagherinneringen (09:00/09:15), nieuwe medewerkers (09:45), aanzegtermijnen (09:50), stille afwezigen (ma 10:00). **Droogloop** tot `SIGNALERINGEN_ACTIEF=1`; elke run gelogd in `hr_signaleringen` | |

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
│  ├─ _lib/                 auth.js, config.js, sheets.js, shiftbase.js, util.js, mail.js, sjablonen.js, pdf.js, brieftemplates.js, signaleringen.js
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
│  ├─ signalering.js        GET/POST /api/signalering  status + laatste runs / check handmatig draaien (droog of echt)
│  ├─ sched-*.js            6 scheduled functions (cron in UTC), roepen _lib/signaleringen.js aan
│  ├─ brieven.js            GET /api/brieven     verstuurde brieven (tab Brieven) + templates + BV-lijst
│  └─ brief-mail.js         POST /api/brief-mail {naam,email,bv,categorie,onderwerp,tekst,metPdf | preview | alleenPdf}
├─ supabase/migrations/     0001_toegang.sql, 0002_acties.sql, 0003_mails.sql, 0004_signaleringen.sql
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
2. **SQL Editor** → plak `supabase/migrations/0001_toegang.sql` → Run. Controleer de seed-e-mails in `hr_toegang`. Daarna `0002_acties.sql`, `0003_mails.sql` en `0004_signaleringen.sql` → Run.
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
   | `GOOGLE_SA_EMAIL` | `client_email` uit de service-account-JSON |
   | `GOOGLE_SA_KEY` | alleen de base64-body van de private key, zonder BEGIN/END-regels (maak beide met `node scripts/sa-compact.js service-account.json`). De oude `GOOGLE_SA_JSON_B64` werkt nog lokaal, maar is op Netlify te groot: AWS Lambda staat max. 4 KB aan env vars toe |
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
| 0.7.0 | 16-10-2026 | Stap 4: 6 scheduled functions + Signaleringen-tab, droogloop-schakelaar `SIGNALERINGEN_ACTIEF`, log `hr_signaleringen` |
| 0.7.1 | 16-10-2026 | Medewerkers-tab toont standaard de volledige Shiftbase-lijst per winkel (zoekveld filtert), knop "← Alle medewerkers" in het dossier |
| 0.20.1 | 20-10-2026 | **Exit-survey**: (1) per vraag een optioneel **toelichting-veld** eronder (`toelichting: true`, antwoord onder `<key>__toelichting`; standaard aan bij vraag 7 *Zou je weer bij SLA willen werken?*); zichtbaar in de reactietabel en de CSV, en telt als opmerking als er geen open vraag is ingevuld. (2) Vragen met `alleenEigenOntslag: true` (standaard vraag 8 *Wat had SLA anders kunnen doen om je te behouden…*) verschijnen alleen als de medewerker zelf ontslag nam: de link in de brief draagt de soort mee (ontslag / aanzegging / proeftijd-wg / proeftijd-wn); bij een aanzegging of proeftijdontslag door SLA valt de vraag weg (ook server-side genegeerd); bij een handmatige uitnodiging verdwijnt hij zodra als reden *Contract niet verlengd* wordt gekozen. Beide vinkjes in de vragen-editor (Uitstroom → Exit-surveys → Instellingen). Geen migratie. |
| 0.20.0 | 20-10-2026 | **Fase 4c — contractverlenging als proces** (`_lib/verlenging.js`, `/api/verlenging`, check `verlengingen` + `sched-verlengingen` `5 8 * * *`, **migratie 0014** `hr_verlenging`). Voor elk tijdelijk contract dat binnen 60 dagen afloopt (Shiftbase, knips samengevoegd): **besluit** vastleggen — verlengen tijdelijk (nieuwe einddatum, +6/+12 mnd), verlengen vast, niet verlengen, medewerker stopt zelf — met **advies Store Manager** (door HR ingevuld) en notitie; deadline 35 dagen vóór het einde (5 dagen marge op de aanzegtermijn van 1 maand, art. 7:668 BW; contracten < 6 mnd: geen aanzegplicht). Tijdelijk verlengen bij een volle keten vraagt expliciete bevestiging. **Uitvoering gecontroleerd**: verlengen → aansluitend contract in Shiftbase (vast/tijdelijk moet kloppen; > 7 dagen na het besluit = rood), niet verlengen → aanzegging verstuurd, stopt zelf → ontslagbevestiging (ná de start van het huidige contract, ook gearchiveerd). Tegenstrijdigheden (besluit vs. Shiftbase/brief) en *van rechtswege vast* worden rood. **Tabblad In dienst → Contractverlenging** (open/alle, besluit, advies, status, knoppen Besluit/Aanzegging/Ontslagbevestiging); **takenlijst**: één taak per contract (vervangt voor die persoon de losse aanzeg- en ketentaken); **dossier**: besluiten bij Contractketen. `contracten.js`: loonknip op 01-01/01-07 na een hele-maanden-einde telt niet meer als nieuw contract als het contract daarna doorloopt tot een afgesproken einde. |
| 0.19.4 | 20-10-2026 | **Bevestiging uitdiensttreding zonder handtekening** (`_lib/uitdienst.js`, `/api/uitdienst`). Ondertekenen is juridisch niet nodig (opzegging is eenzijdig, een aanzegging moet alleen schriftelijk en op tijd verstuurd zijn), dus i.p.v. eindeloos herinneren: (1) mail aan de medewerker, NL boven / EN onder, met PDF-brief (handtekening i.o. Jop) — einddatum, laatste werkdag + spullen inleveren, eindafrekening met laatste loonstrook, 5 dagen om te reageren, niets te tekenen; tekst per soort uit hr_mails (opzegging medewerker / aanzegging / proeftijd); (2) seintje aan de salarisadministratie met de PDF (alleen als er nog niets naar salaris ging; zet de salaris-stempel); (3) dossier archiveren ('afgerond: uitdiensttreding bevestigd (niet ondertekend)'). **Per rij** knop *✓ Bevestig uitdiensttreding* (elke HR-rol); **automatisch** na de 3e herinnering in de check ontslag-herinneringen als `hr_instellingen` 'uitdienst_bevestiging_actief' aan staat — balk boven Ontslag & aanzegging met *Voorbeeld mail + PDF* en *Aanzetten* (admin). Staat standaard **uit**. Dossiers ouder dan 30 dagen blijven stil archiveren (geen mail aan oud-medewerkers). Geen migratie. |
| 0.19.3 | 20-10-2026 | **Overplaatsing → salaris.** Knop *→ Salaris* bij Overplaatsing & standplaats (tabel en dossier): mail aan de salarisadministratie met de mutatie (medewerker, soort, van BV → naar BV, nieuwe standplaats, ingangsdatum, functie, in dienst sinds) en de ondertekende brief als bijlage; is die er nog niet, dan eerst de vraag of de mutatie alvast door mag ('document volgt'). Tijdstip uit `hr_mails` (bron 'salaris', type 'overplaatsing') — geen nieuwe kolom. **Eigen uploadsoort 'overplaatsing'**: de mail aan de medewerker gebruikt nu een persoonlijke overplaatsing-uploadlink (was de ontslag-link, waardoor een ondertekende overplaatsing bij een ontslagdossier kon belanden); upload zet *Ondertekend* (kolom M) en `docUrl`; 🔗 Uploadlink en ⬆ Zelf uploaden ook hier. **Migratie 0013** (upload-soort 'overplaatsing' toestaan). |
| 0.19.2 | 20-10-2026 | **Niet ondertekend na 30 dagen → automatisch archiveren** (keuze Mischa: wie na 30 dagen niet tekent, doet dat niet meer). De check *ontslag-herinneringen* (dagelijks 09:15) archiveert ontslagbevestigingen en aanzeggingen die `ONTSLAG_ARCHIVEER_DAGEN` (30) dagen na verzending niet ondertekend retour zijn (`gearchiveerd_bron` 'automatisch: niet ondertekend na 30 dagen', gelogd in hr_acties) en stuurt ze geen herinneringen meer; daarvóór max. 3 herinneringen. Alleen met `SIGNALERINGEN_ACTIEF=1` (droog = alleen rapport). Rijen die HR uit het archief terugzet (hr_acties 'herstel') worden niet opnieuw automatisch gearchiveerd. **Archief blijft meetellen**: `getOntslag(true)` geeft ook gearchiveerde rijen (veld `gearchiveerd`) en wordt gebruikt door de aanzegtermijn-check (anders zou een gearchiveerde aanzegging als 'niet verstuurd' terugkomen), de scorekaart (aanzegging op tijd), de uitstroomredenen (verloopanalyse + maandrapport) en het dossier (status '· gearchiveerd …'). Geen migratie. |
| 0.19.1 | 20-10-2026 | **Ketenregeling klopt nu met Shiftbase.** (1) Shiftbase knipt een contract op bij elke loon-/urenwijziging (vrijwel altijd 01-01 en 01-07): `contracten.overeenkomsten()` voegt aansluitende records samen tot één arbeidsovereenkomst, tenzij het vorige deel op een afgesproken einde (hele maanden na de start, ±2 dagen) eindigt of het nieuwe deel een eigen looptijd van hele maanden heeft; bij twijfel telt het als nieuw contract. Gecontroleerd op 13 echte ketentaken (bijv. Julia Andreas: 4 records = 2 contracten). (2) **Verlenging herkend**: staat er al een aansluitend vervolgcontract in Shiftbase, dan verdwijnt de taak; is dat vervolg tijdelijk terwijl de keten vol is → nieuwe rode taak *van rechtswege vast?* (soort `vast`). Contract voorbij → taak weg (zoals al het geval was). (3) **Correctie door HR** in het dossier (*Aantal contracten corrigeren*, `/api/keten-correctie`, opgeslagen in `hr_instellingen` 'keten_correcties', geldt zolang het huidige contract dezelfde start heeft); dossier toont de overeenkomsten met het aantal knips. Proeftijd kijkt naar de eerste overeenkomst (knips samengevoegd). (4) Ontslag-/aanzeggingsherinneringen stoppen na `ONTSLAG_MAX_HERINNERINGEN` (3); de taak blijft rood met de tip om te bellen of zelf te uploaden (er stonden er met 24 en 53 herinneringen). Geen migratie. |
| 0.19.0 | 20-10-2026 | **Fase 4b — HR-maandrapport** (`_lib/maandrapport.js`, `_lib/maandrapport-pdf.js`, `/api/maandrapport`): PDF over een kalendermaand met **SLA totaal** (kerngetallen in dienst/in/uit/netto/verloop 12 mnd/nu ziek, samenvatting in zinnen, alle scorekaart-KPI's deze maand vs vorige maand vs 12 maanden met verschil — groen beter, rood slechter, grijs bij < 3 reacties/medewerkers), trend in-/uitstroom 12 maanden, uitstroomredenen (incl. *niet geregistreerd*), **wat HR deed** (mails per onderwerp uit `hr_mails`, gesprekken per soort, check-ins, exit-surveys), training (stand nu, als Academy gekoppeld is) en **per winkel** over de laatste 3 maanden (kleur t.o.v. SLA, aandachtspunten en wat goed gaat). Automatisch: check `maandrapport` + `sched-maandrapport` (`30 6 1 * *`, 1e van de maand ±08:30) mailt het rapport over de vorige maand naar Mischa, Jodi en Ymke (`SIGNALERING_ONTVANGERS.maandrapport`), één keer per maand (controle in `hr_mails`), alleen met `SIGNALERINGEN_ACTIEF=1`. In het dashboard: **Scorekaart → HR-maandrapport** (maand kiezen, Bekijken, ⬇ PDF, ✉ Mail naar HR). `scorekaart.js`: ophalen gesplitst in `laadBronnen()`; `bereken()` filtert check-ins en exit-surveys zelf op de periode. Geen migratie. |
| 0.18.2 | 20-10-2026 | **Document ophalen zonder (werkende) mail**, bij Ontslag & aanzegging en Loonheffing per rij (in het ⋯-menu): **🔗 Uploadlink** kopieert de persoonlijke uploadlink + korte NL/EN-tekst om zelf via Gmail of WhatsApp te sturen (voor wie nog een oude Google-formulierlink heeft, of als Resend niet verstuurt); **⬆ Zelf uploaden** = HR uploadt het document dat per mail/WhatsApp binnenkwam → dossier op Ondertekend/Ontvangen, daarna → Salaris. `/api/document-upload` kreeg stap `info` (gelogd als 'uploadlink'). Geen migratie. |
| 0.18.1 | 20-10-2026 | **Fix: oude Drive-documenten → Salaris.** Staat een document nog in Google Drive (oud Google-formulier), dan opent *→ Salaris* nu het venster *Document uploaden*: knop *Open in Drive*, bestand kiezen, *Uploaden en naar salaris* — het document gaat in de eigen opslag (`hr_uploads`, gekoppeld op de e-mail van het dossier zodat het de Drive-link vervangt) en direct mee naar HRM Online. Nieuw endpoint `/api/document-upload` (ingelogd, gelogd op naam van HR); *Versturen zonder dit document* blijft mogelijk. `zetVinkje` verhuisd naar `_lib/vinkje.js`. Geen migratie. |
| 0.18.0 | 20-10-2026 | **Fase 4a — training & certificaten uit SLA Academy** (alleen lezen; geen service key van Academy): in het Academy-project één functie `hr_training_status(p_sleutel)` (`supabase/academy/hr_koppeling.sql`, tabel `hr_koppeling` met alleen de sha-256 van de sleutel) die per actieve medewerker een samenvatting geeft — certificaten (Basis voedselveiligheid, HACCP, 6 maanden geldig), welkomstcollectie af/totaal + wat open staat, verplichte observaties (aftekenplicht), laatst ingelogd. Het dashboard roept die aan met de publishable key + `ACADEMY_HR_SLEUTEL` (`_lib/academy.js`, 15 min cache) en koppelt op Shiftbase-id → e-mail → naam. **Tabblad In dienst → Training (Academy)** (`/api/academy`): dekking per winkel (ingelogd, welkomstcollectie af, certificaten geldig, verlopen, aftekenen achter), signalen, medewerkerslijst met filter en CSV. **Takenlijst** (geen extra mails — Academy herinnert zelf): certificaat verlopen (rood) / verloopt ≤ 30 dagen (oranje), welkomstcollectie niet af na 21 dagen (rood na 42), aftekenen te laat / niet geslaagd, per winkel *nooit ingelogd* na 7 dagen (oranje) en *zonder geldig certificaat* (grijs). **Dossier + dossier-PDF**: blok Training & certificaten. **Scorekaart**: KPI's *Welkomstcollectie Academy af* en *Certificaat voedselveiligheid geldig* (stand van nu). Zonder sleutel draait alles door zonder Academy-gegevens. |
| 0.17.0 | 20-10-2026 | **Fase 3b — gesprekken vastleggen** (tabel `hr_gesprekken`, migratie `0012`; `_lib/gesprekken.js`, `/api/gesprek`): één modal *Gesprek vastleggen* (soort: opvolging check-in, proeftijd, verzuim, correctie, functioneren, overig; datum, hoe, gevoerd door, aanleiding, besproken, afspraken, optionele vervolgdatum met +1/+2/+4 weken). Te openen vanuit de takenlijst (proeftijd, Poortwachter-mijlpaal, frequent verzuim, lage check-in — die laatste wordt bij opslaan meteen *opgevolgd*), het dossier en het nieuwe tabblad **Dossier → Gesprekken** (open vervolgafspraken + alle gesprekken, filter op soort, 90 dagen / 12 maanden, CSV). **Vervolg** verschijnt 2 dagen vooraf als taak (grijs → oranje op de dag → rood na 7 dagen) met *Vervolggesprek vastleggen* of *✓ Afvinken*; een vervolggesprek rondt het vorige vervolg af. Gesprekken staan in het dossier en de dossier-PDF (inzage); niet verwijderbaar, bewerken gelogd. Verzuim: hint om géén medische informatie vast te leggen (AVG). Dossier-PDF: scheidingsteken tussen items is nu een witregel. |
| 0.16.0 | 20-10-2026 | **Fase 3c — scorekaart per winkel** (nieuw tabblad *Scorekaart* in de hoofdnavigatie, `/api/scorekaart?maanden=3|6|12`, `_lib/scorekaart.js`): per winkel naast elkaar met de SLA-totaalrij: verloop, vertrek ≤ 90 dagen, uitval nieuwe medewerkers ≤ 90 dagen, check-in score, lage check-ins, onboarding binnen 21 dagen af, verzuim% (kalenderdagen), ziekmeldingen per medewerker per jaar, eNPS exit-survey, aanzegging op tijd (≥ 30 dagen). Kleur t.o.v. het SLA-gemiddelde (rood ≥ 30% slechter bij aantallen / ≥ 15% bij scores / eNPS ≥ 20 punten; grijs bij < 3 reacties of medewerkers), aandachtspunten en sterke punten in tekst met cijfer en factor, trend per maand (in/uit, check-in, ziekmeldingen). **PDF per winkel** (`&winkel=…&pdf=1`, `_lib/scorekaart-pdf.js`) voor het overleg met de Store Manager: alleen geaggregeerd, check-in- en exitcijfers pas vanaf 3 reacties; export gelogd. Geen migratie nodig; `verloop.laadMedewerkers()` gedeeld met de Verloopanalyse. |
| 0.15.0 | 20-10-2026 | **Fase 3a — check-in na 30 en 60 dagen** (Store Managers werken niet in het dashboard; HR stuurt): tabel `hr_checkin` (migratie `0011`, één rij per uitnodiging, token = rij-id), `_lib/checkin.js`, check `checkin` + `sched-checkin` (`40 8 * * *`): uitnodigen op dag 30–36 en 60–66 na het eerste contract, tweetalige mail (NL/EN), één herinnering na 5 dagen. Publieke pagina `checkin.html` + `/api/checkin` (niet anoniem; Store Manager ziet niets). **Lage check-in** (schaalantwoord ≤ 2 of een alarm-optie, standaard *Zie je jezelf over een halfjaar nog bij SLA? → Nee*) = direct mail aan Mischa/Jodi/Ymke + rode/oranje taak *even bellen* met knop ✓ Opgevolgd (notitie). Tabblad **Instroom → Check-in 30/60** (`/api/checkin-admin`): KPI (verstuurd, respons, gemiddelde, laag open), tabel met filter en CSV, gemiddeld per vraag en per winkel, komende 14 dagen, handmatig versturen, vragen-editor (gedeeld met de exit-survey, `_lib/vragenlijst.js`, alarm-opties met `| !`) en aan/uit — **start gepauzeerd**. Dossier toont check-ins. Exit-teksten noemen geen vast aantal vragen meer. |
| 0.14.3 | 19-10-2026 | **Exit-survey beheer:** tabel `hr_instellingen` (migratie `0010`, `_lib/instellingen.js`, 60 s cache). **Aan/uit-schakelaar** `exit_actief` (start **gepauzeerd** via de migratie): uit = geen survey-alinea/-blok/-zin in brieven en mails (`sjablonen.zonderExit`), survey-pagina gesloten, geen uitnodigingen. **Vragen-editor** in Uitstroom → Exit-surveys (admin): volgorde, NL/EN, type keuze/schaal/nps/tekst, opties; opgeslagen als `exit_vragen` (`exit.normaliseerVragen`), standaardlijst terugzetten; reacties-tabel, CSV en Verloopanalyse volgen de actuele vragenlijst; *Voorbeeld NL/EN* opent de pagina in voorbeeldstand (slaat niets op). |
| 0.14.2 | 19-10-2026 | **Tabblad Uitstroom → Exit-surveys:** alle reacties (scores per stelling, aanbeveling, reden, opmerking; anoniem = zonder naam), CSV-export, lijst *Uit dienst* uit Shiftbase (einddatum in de periode, met status ingevuld / uitgenodigd / nog niet) en knop **Survey versturen** voor een handmatige uitnodiging (ook aan wie al uit dienst is; `/api/exit-admin`, mail `exitUitnodigingHtml`, gelogd in `hr_mails` bron `exit`). `shiftbase.getVertrokken()`. |
| 0.14.1 | 19-10-2026 | **Exit-survey** (SLA doet geen exitgesprekken): de alinea *Exitgesprek/Exit interview* in de aanzeggingsbrief is vervangen door een persoonlijke link naar `public/exit.html?t=<token>` (8 vragen NL/EN, ±2 min, optie anoniem); dezelfde link in de ontslagbevestiging (brief) en in de mails ontslag/aanzegging/proeftijd (knop). `/api/exit` (publiek, token-beveiligd zoals de uploadpagina, 90 dagen geldig, één keer per link), tabel `hr_exit` (migratie `0009`), sectie *Exit-survey* in de Verloopanalyse (respons, eNPS, gemiddelde per stelling, redenen, terugkeer, opmerkingen). PDF: lange URL's breken netjes af en zijn klikbaar. |
| 0.14.0 | 19-10-2026 | **Fase 2 (juridische gaten):** `contractketen` (ketenregeling 3 contracten/36 mnd, onderbreking 6 mnd, proeftijd-einde) en `verzuim` (Poortwachter-mijlpalen 42/56/294/364 dagen via Shiftbase-absences, 4-wekenregel, frequent ≥3 meldingen/12 mnd) dagelijks; `jeugd` (verjaardagen ≤20 → minimumjeugdloon, Arbeidstijdenwet <18 op het rooster) en `oproepaanbod` (12-maandsgrens art. 7:628a BW, gemiddelde uren uit roosters) wekelijks; nieuw tabblad *Oproepaanbod* met brief (NL/EN) + PDF + uploadlink + reactie; dossier toont verzuim en keten; uitstroomreden verplicht bij ontslag/aanzegging/proeftijd en uitstroomredenen-verdeling in de Verloopanalyse. Migratie `0008`. |
| 0.13.0 | 19-10-2026 | **Fase 1 (HR-expertreview):** takenlijst *Vandaag te doen* op het Overzicht (`/api/taken`: laatste stand van alle checks + open dossiers + checklists, urgentie rood/oranje/grijs, directe actie, afhandelen), on-/offboarding-checklists per medewerker (`/api/checklist`, sjablonen in config.js), winkel-filter in de header (alle tabellen + taken), compacte rijacties (⋯-menu), `medewerker_id` op alle tabellen (migratie `0007`, `/api/koppel`, automatisch na elke sync). |
| 0.12.0 | 19-10-2026 | **Stap 6:** Google Sheets vervangen door Supabase-tabellen (migratie `0006`). `_lib/data.js` heeft dezelfde API als `_lib/sheets.js`; `_lib/db.js` kiest op `DATA_BRON`. Beheer → *Gegevens & export*: droogloop + import vanuit de sheets (hoofdtabs, logtabs, archieftabs, oude Forms-reacties; rijnummers blijven gelijk), CSV-export per tabel. Zie CUTOVER.md blok F |
| 0.11.3 | 16-10-2026 | Service account als `GOOGLE_SA_EMAIL` + `GOOGLE_SA_KEY` (compact) i.p.v. `GOOGLE_SA_JSON_B64` — de deploy faalde op de 4 KB-limiet van AWS Lambda voor env vars |
| 0.11.2 | 16-10-2026 | Indiensttredingsformulier wordt geserveerd vanuit `public/Indiensttredingsformulier_SLA.xlsx` (welkomstmail stap 1) i.p.v. een Google Drive-exportlink — de laatste Drive-verwijzing in de mails is weg |
| 0.11.1 | 16-10-2026 | Knop *⇅ Sorteer op datum* (nieuw → oud / oud → nieuw / uit) in de Loonheffing- en Ontslag-tab; sortering blijft staan na verversen (SorteerUI.gs-gedrag) |
| 0.11.0 | 16-10-2026 | Batch D: notities (`/api/notitie`), dossier-PDF (`/api/dossier-pdf`), Toegangslog-tab (`/api/toegangslog`), Archief herstellen (`/api/archief`), sorteerbare kolomkoppen, `sched-bewaartermijnen` (1e 08:00) + `sched-data-hygiene` (1e 09:00). Apps Script volledig overgezet. |
| 0.10.0 | 16-10-2026 | Batch C: Vastloners-, Vakantieplanner- en Verloopanalyse-tab (`_lib/vastloners.js`, `_lib/vakantie.js`, `_lib/verloop.js`), scheduled function `sched-vakantiepieken` (ma 09:00). Geen placeholder-tabs meer. |
| 0.9.0 | 16-10-2026 | Batch B: Loonheffingskorting-tab + sync + herinnering (`sched-korting-herinneringen`), eigen uploadpagina + Supabase Storage i.p.v. Google Forms/Drive (`upload.html`, `/api/upload`, `/api/document`, `_lib/uploads.js`, migratie 0005), Documenten → salaris (`/api/salaris-mail`), Contracten & starters-tab (`/api/contract`, `/api/contract-download`) |
| 0.8.0 | 16-10-2026 | Batch A: Proeftijd (4 brieven), Ontslag op staande voet (cc hr@), Waarschuwingen-tab (huisregels), Beschikbaarheid-tab (auto-onderbouwing) + scheduled function weekendbeschikbaarheid, `cc` in mail.js, `_lib/datum.js`, `_lib/weekend.js` |

## Mail (Resend)
Alle mail gaat via Resend vanaf `hr@ilovesla.com`. Eenmalig: Resend → **Domains → Add domain** → `ilovesla.com` → de DNS-records (DKIM/SPF) bij de domeinbeheerder zetten → *Verify*. Zonder verificatie weigert Resend de afzender (het dashboard geeft dan die hint). Elke verzonden mail staat in `hr_mails` (Supabase) en als actie in `hr_acties`.

## Vrije brieven (PDF)
De PDF wordt in de Netlify Function opgebouwd met `pdf-lib` (Helvetica ≈ Arial, A4, marges 56/56/64/64 pt): logo **SLA** groen, categorie in kapitalen, Datum/Aan/BV, *Betreft*, aanhef, alinea's en lijsten (regels met `- `), groet met `AFZENDER_NAAM` + BV, voettekst. Bestandsnaam `Brief_<Naam>.pdf`, gaat als Resend-bijlage mee (base64). Elke verzonden brief komt in tab **Brieven** van de HR-acties-sheet (kolommen A–I, exact als `vbLogBrief_`); de tab wordt aangemaakt als hij ontbreekt. De PDF wordt (nog) niet in Drive bewaard — "⬇ PDF" in het modal downloadt dezelfde PDF lokaal.

## Ontslag & aanzegging (brief-PDF's)
De brieven (ontslagbevestiging, aanzegging NL/EN, proeftijd ×4, waarschuwing NL/EN, beschikbaarheid NL/EN, OoSV, overplaatsing/standplaats) staan als tekst in `netlify/functions/_lib/brieftemplates.js`, letterlijk overgenomen uit de Google Docs-templates. Opmaak: `**vet**`, `*cursief*`, `• ` = opsomming, lege regel = alinea; placeholders `{{Naam}} {{Adres}} {{DatumOpzegging}} {{Einddatum}} {{BV}} {{HuidigeDatum}}`. Brieftekst aanpassen = dit bestand aanpassen en deployen. De ontslagbevestiging bevat de handtekening uit `_lib/assets/handtekening_io_jop.png` (PNG, transparant) op de regel `{{HANDTEKENING}}`, met "i.o. Jop van de Graaf" eronder; vervangen = het PNG-bestand vervangen. Bewust gekozen (16-10-2026) boven de Docs/Drive-route, omdat die domain-wide delegation door de Workspace-beheerder vereist. Gevolg: geen Drive-archief; de PDF zit in de mail en is via **⬇ PDF bekijken** altijd opnieuw te maken. Sheet-logging: H/I (+ nieuwe rij A–G), herinneringen K/L.

## Sommaties & overplaatsing
**Sommatie**: mailtekst per type in `sjablonen.js` (`sommatieHtml/Plain`, 1-op-1 uit Code.gs); de aanvullende tekst komt als extra alinea vóór de groet en in kolom J. De aangetekende printbrief wordt in de browser opgebouwd (knop *Brief* / *Printbrief*). Sheet: nieuwe rij A–H, status 'Verstuurd' met kleur per type (groen / `#fff2cc` 2e / `#fce5cd` finale / `#f4cccc` OoSV).
**Overplaatsing**: zelfde BV voor beide winkels → standplaatswijziging, anders overplaatsing; de vier brieven staan in `brieftemplates.js` (`OVERPL_NL/EN`, `STANDPL_NL/EN`, uit de Docs-templates); winkeladressen in `WINKEL_BV_MAP`. Sheet: tab Overplaatsing A–L + P (type); bij een bestaande rij alleen K/L.

## Automatische checks (stap 4) en de cutover
De zes checks uit `instaleerTriggers()` plus `checkWeekendBeschikbaarheid` (eigen trigger, `instaleerWeekendSignalering`) draaien als Netlify Scheduled Functions (`netlify/functions/sched-*.js`, cron in **UTC**: 07:00 UTC = 09:00 zomertijd / 08:00 wintertijd). Logica staat in `_lib/signaleringen.js`, 1-op-1 uit Code.gs/Shiftbase.gs v9.4 (incl. cooldown 3 dagen, `SIGNALERING_NEGEREN_NAMEN`, indiensttredingsregel bij stille afwezigen).

**Droogloop**: zolang `SIGNALERINGEN_ACTIEF` niet `1` is, mailen en schrijven de checks niets — ze loggen alleen wat ze gedaan zouden hebben (tab Signaleringen → Laatste runs, en per check *Droogloop nu*). Zo kun je een week meekijken of Netlify hetzelfde vindt als Apps Script.

**Cutover:** volledige checklist in [`CUTOVER.md`](CUTOVER.md); doorverwijspagina voor Apps Script in `apps-script/doorverwijzing.gs`. Samengevat:
1. Apps Script-editor → Triggers → alle triggers van `syncFormulierStatus`, `checkLoonheffingHerinneringen`, `checkOntslagHerinneringen`, `checkNieuweMedewerkers`, `checkAanzegtermijnen`, `checkStilleAfwezigen`, `checkWeekendBeschikbaarheid`, `checkKortingHerinneringen`, `checkVakantiepieken`, `stuurDataHygieneRapport`, `bewaartermijnRapport` verwijderen — dat zijn ze allemaal.
2. Netlify → Environment variables → `SIGNALERINGEN_ACTIEF` = `1` → redeploy.
3. Tab Signaleringen toont "ACTIEF"; de eerstvolgende run om 09:00 mailt echt. Terugdraaien = env var weghalen + triggers opnieuw installeren.

## Documenten van medewerkers: eigen uploadpagina (geen Google Forms/Drive)
Besluit 16-10-2026: alles buiten Google Drive om. De mails (loonheffing, ontslag/aanzegging/proeftijd, loonheffingskorting en de herinneringen) bevatten een **persoonlijke upload-link** `https://slahrmanager.netlify.app/upload.html?t=<token>`. Het token is getekend (HMAC, sleutel afgeleid van `SUPABASE_SERVICE_KEY`, of `UPLOAD_SECRET` als die gezet is) en bevat alleen soort + naam; geen login nodig, niet te raden, blijft geldig.
- `public/upload.html`: NL/EN, kies PDF of foto (max. 15 MB), bestand gaat **rechtstreeks** naar Supabase Storage (privé bucket `hr-documenten`, getekende upload-URL — het bestand gaat niet door een function heen).
- `/api/upload` (publiek, token-beveiligd): info → getekende upload-URL → registratie in tabel `hr_uploads` + vinkje in de sheet (loonheffing F, ontslag J, korting I+J) + `hr_acties`.
- In het dashboard verschijnt het document als `sb:<id>:<key>`; klikken opent een tijdelijke link (2 min) via `/api/document` (gelogd). Oude Google-Forms-uploads blijven gewone Drive-links.
- **→ Salaris** (`/api/salaris-mail`) stuurt Supabase-documenten als bijlage naar `SALARIS_EMAIL`; voor een oud Drive-document krijg je de melding dat je het zelf moet doorsturen.
- **Migratie 0005** (`supabase/migrations/0005_uploads.sql`) maakt tabel + bucket aan — eenmalig draaien in de SQL-editor van het HR-Supabase-project.

## Lokaal draaien
```bash
npm install
cp .env.example .env   # invullen
npx netlify dev        # http://localhost:8888
```

## Toegang beheren
Allowlist = tabel `hr_toegang` in Supabase (Table Editor). `actief=false` zet iemand uit zonder de regel te verwijderen. Alle opvragen worden gelogd in `hr_toegangslog`; de view `hr_toegangslog_recent` toont de laatste 200.

## Gegevensbron: Supabase (stap 6) of Google Sheets
`DATA_BRON=supabase` laat alle endpoints en checks via `_lib/data.js` op de tabellen uit migratie `0006` werken; leeg = Google Sheets via `_lib/sheets.js`. Alle code praat alleen met `_lib/db.js`. De import (Beheer → Gegevens & export, alleen rol `admin`) leest de sheets altijd rechtstreeks en is idempotent (upsert op `rij`); na de omschakeling is importeren geblokkeerd. Tabellen en kolommen staan in `_lib/tabellen.js` (kolom A = index 0, alle waarden tekst). Archief = `gearchiveerd_op/door/bron` op de rij. Oude Google-Forms-uploads (Drive-links) staan in `hr_formulier_reacties`; nieuwe uploads in `hr_uploads`.

## Extra dossier-tabs
`DOSSIER_EXTRA_TABS` in `netlify/functions/_lib/config.js` — per tab sheet-ID, tabnaam en de kolomindex van naam/e-mail/datum. Zodra Waarschuwing.gs, Proeftijd.gs, Korting.gs en Beschikbaarheid.gs zijn aangeleverd worden die hier ingevuld (Brieven heeft al een eigen sectie).

## Roadmap
1. ✅ Shell + login + Overzicht/Dossier (lezen)
2. ✅ Afvinken + archiveren in de sheets, actielog in Supabase, contracttype uit Shiftbase
3. ✅ Mail + brieven: 3a mailfundament, 3b loonheffing, 3c vrije brieven, 3d ontslag/aanzegging, 3e sommatie + overplaatsing. (Waarschuwing, Proeftijd, Korting, Beschikbaarheid: aparte modules, nog in Apps Script)
4. ✅ Signaleringen als Netlify Scheduled Functions (droogloop) → cutover: Apps Script-triggers uit + `SIGNALERINGEN_ACTIEF=1`
5. ✅ Cutover 19-10-2026: triggers uit, `SIGNALERINGEN_ACTIEF=1`, Apps Script → `apps-script/doorverwijzing.gs`
6. ✅ Google Sheets → Supabase (v0.12.0): migratie 0006 → Beheer → Gegevens: droogloop → import → `DATA_BRON=supabase` → sheets bevriezen, service account weg
