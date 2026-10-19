# Cutover: Apps Script → Netlify (stap 5)

Doel: op één moment overschakelen, zonder dubbele mails en zonder dataverlies. Alles staat klaar in v0.11.2; dit document is de checklist. Reken op een uur, op een rustige ochtend ná 10:00 (dan zijn de dagelijkse checks van die dag al gelopen).

## A. Vooraf (kan dagen eerder)

- [ ] **Push v0.11.2** en controleer dat Netlify "Published" toont. Versie onderin het dashboard = v0.11.2.
- [ ] **Migratie 0005** draaien in de SQL-editor van het Supabase-project *SLA HR Manager*: `supabase/migrations/0005_uploads.sql` (tabel `hr_uploads` + bucket `hr-documenten`). Controle: Storage → bucket `hr-documenten` bestaat, privé.
- [ ] **Uploadlink testen**: Loonheffing → Nieuwe mail → naar jezelf. Klik de link, upload een PDF, kijk of het vinkje "Formulier" groen wordt en het document opent via de link in het dashboard.
- [ ] **Indiensttredingsformulier**: klik stap 1 in diezelfde mail; het bestand moet downloaden vanaf slahrmanager.netlify.app.
- [ ] **→ Salaris testen** op dat testdossier (het mailt naar `mafshari@hrmonline.nl` — doe dit dus alleen als je Mahdia even waarschuwt, of zet tijdelijk `SALARIS_EMAIL` in config.js op jezelf).
- [ ] **Droogloop vergelijken** (minimaal 3 werkdagen, liever een week): Signaleringen-tab → per check *Droogloop nu*. Vergelijk met wat Apps Script die dag mailde. Verschil = eerst uitzoeken, niet overschakelen.
- [ ] **Allowlist controleren**: Supabase → `hr_toegang`: Mischa, Jodi, Jop, Ymke, hr@ actief.
- [ ] **Collega's informeren** (Jodi, Ymke, Jop): nieuwe URL, inloggen met Google-account, oude bladwijzer vervalt op datum X.

## B. De cutover zelf (±30 min, in deze volgorde)

1. **Apps Script → Triggers** (klokje links): verwijder **alle** triggers. Dat zijn er elf:
   `syncFormulierStatus`, `checkLoonheffingHerinneringen`, `checkOntslagHerinneringen`, `checkNieuweMedewerkers`, `checkAanzegtermijnen`, `checkStilleAfwezigen`, `checkWeekendBeschikbaarheid`, `checkKortingHerinneringen`, `checkVakantiepieken`, `stuurDataHygieneRapport`, `bewaartermijnRapport`.
   Sneller: plak `verwijderAlleTriggers()` uit `apps-script/doorverwijzing.gs` onderaan `Code.gs` en voer die uit (log: `11 trigger(s) verwijderd. Nu nog: 0`). Triggers van een ander account (hr@) zie je alleen als dat account; draai de functie dan ook daar.
   Controle: de triggerlijst is leeg.
2. **Netlify → Site configuration → Environment variables**: `SIGNALERINGEN_ACTIEF` = `1` → **Deploy → Trigger deploy** (env-wijzigingen vereisen een redeploy).
3. Dashboard → **Signaleringen**: status toont *ACTIEF*. Draai één check echt ("Nu echt draaien" op *sync-formulieren*) en kijk in *Laatste runs* dat `droog = nee`.
4. **Google Forms** (loonheffing-upload en ontslag-upload): Formulier → instellingen → "Reacties accepteren" uit, met als bericht: "Gebruik de persoonlijke uploadlink uit je e-mail van HR." Oude uploads blijven bereikbaar via de Drive-links in het dashboard.
5. **Apps Script-dashboard uit**: vervang de inhoud van `Code.gs` door `apps-script/doorverwijzing.gs` uit deze repo → Implementaties beheren → Nieuwe versie. Open de oude exec-URL: je ziet de verhuispagina en wordt doorgestuurd.
6. Noteer datum + tijd van de cutover in `claude/netlify-migratie.md` (projectnotitie) en in de README-versietabel.

## C. De dag erna

- [ ] Signaleringen → *Laatste runs*: zijn de checks van 09:00–09:55 gelopen met `droog = nee`, zonder fouten?
- [ ] Zijn de verwachte mails binnengekomen (herinneringen, nieuwe medewerkers, aanzegtermijnen)? Precies één per onderwerp — geen dubbele.
- [ ] Toegangslog: logins van de collega's zichtbaar.

## D. Terugdraaien (als het mis gaat)

1. Netlify: `SIGNALERINGEN_ACTIEF` leegmaken → Trigger deploy (checks weer in droogloop; de tabs blijven gewoon werken).
2. Apps Script: Implementaties beheren → vorige versie activeren (dashboard terug).
3. Apps Script-editor: `instaleerTriggers()` draaien + `instaleerWeekendSignalering()`, `installeerKortingTrigger()`, `installeerBewaarTrigger()` (triggers terug).
Dataverlies is uitgesloten: beide dashboards schrijven in dezelfde Google Sheets.

## E. Daarna

- ✅ Cutover gedaan op 19-10-2026 (v0.11.3). Restpunten: oude service-account-sleutel verwijderen, Google Forms sluiten, Code.gs → doorverwijzing.gs.

## F. Stap 6: Google Sheets → Supabase (v0.12.0) — ±30 min, in deze volgorde

Vooraf: niemand werkt tijdens de omschakeling in het dashboard (kies een rustig moment; alle schrijfacties tussen import en omschakeling zouden anders in de sheets belanden en niet in Supabase).

1. **Migratie 0006** draaien in de SQL-editor van het Supabase-project "SLA HR Manager": `supabase/migrations/0006_sheets_naar_supabase.sql`. Daarna in het dashboard Beheer → **Gegevens & export** → ↻: de tabellen staan er (0 rijen).
2. **Droogloop** klikken. Controleer per tabel: *Rijen in sheet* klopt met wat je in de sheet ziet (lege rijen tellen niet mee), *Archief* = het aantal rijen in de tab Archief, en lees de opmerkingen. "koppen wijken af" is alleen een waarschuwing: de import gaat op kolompositie (A, B, C…), niet op kopnaam. Extra kolommen voorbij de bekende gaan naar `extra`. Een FOUT in de kolom Opmerkingen eerst oplossen.
3. **Importeer uit de sheets** klikken. *In database* moet per tabel gelijk zijn aan sheet + archief (groen vinkje). De import mag herhaald worden (zelfde rijnummers worden overschreven).
4. Netlify → Environment variables → **`DATA_BRON` = `supabase`** (alle scopes) → Deploys → Trigger deploy. Wacht tot v0.12.0 met *Gegevensbron: SUPABASE* in Beheer → Gegevens staat.
5. **Controle (10 min):** Overzicht, Loonheffing, Ontslag, Sommaties, Korting, Waarschuwingen, Beschikbaarheid, Brieven, Overplaatsing, Archief herstellen, een dossier openen (notities, documenten), Signaleringen → sync-formulieren *Droogloop nu* (0 fouten). Zet in één dossier een vinkje aan en weer uit (hr_acties logt het).
6. **Sheets bevriezen:** in elke sheet Delen → het service account (`hr-dashboard-reader@…`) verwijderen, en iedereen behalve jezelf op *Lezer*. Zet in de sheetnaam "(ARCHIEF – niet meer in gebruik sinds 19-10-2026)".
7. **Netlify opschonen:** `GOOGLE_SA_EMAIL` en `GOOGLE_SA_KEY` verwijderen (de import kan daarna niet meer; dat is de bedoeling). In Google Cloud Console de service-account-sleutel verwijderen. Optioneel: het service account zelf.
8. **Terugdraaien** (alleen vóór stap 6/7): `DATA_BRON` leegmaken → Trigger deploy. Alles wat ná stap 4 in Supabase is geschreven staat dan niet in de sheets; vergelijk via Beheer → Gegevens → Export.

Daarna: Beheer → Gegevens → **Export** vervangt "even in de sheet kijken". Elke export wordt gelogd (AVG).

## G. Fase 2 (v0.14.2): juridische checks + exit-survey — ±5 min

1. **Migraties 0008 én 0009** in de Supabase SQL-editor (project *SLA HR Manager*): `0009_exit_survey.sql` maakt `hr_exit` (exit-survey). **Migratie 0008** in de Supabase SQL-editor (project *SLA HR Manager*): `supabase/migrations/0008_fase2.sql` — voegt `uitstroomreden` toe aan `hr_ontslag`, maakt `hr_oproepaanbod` en staat uploadsoort `oproep` toe. Zonder deze migratie geven het tabblad Oproepaanbod en het opslaan van de uitstroomreden een fout; de rest draait gewoon.
2. Commit + push in GitHub Desktop → Netlify bouwt v0.14.2 (badge in de header).
3. De vier nieuwe schedules (`sched-contractketen` 08:00, `sched-verzuim` 08:20 dagelijks; `sched-jeugd` ma 08:15, `sched-oproepaanbod` ma 08:30, UTC = +1/+2 u NL) staan direct **aan** omdat `SIGNALERINGEN_ACTIEF=1` al staat. Wil je ze eerst zien: Signaleringen → "Nu draaien (droog)" per check, of op het Overzicht "↻ Live" bij de takenlijst.
4. Controle eerste week: Shiftbase-contracttypes (keten/proeftijd/oproep herkenning via `OPROEP_TREFWOORDEN` en "onbepaald/vast" in de contractnaam), geboortedatums ingevuld (jeugdcheck meldt hoeveel er ontbreken), ziekmeldingen op status *goedgekeurd* (alleen die tellen mee voor Poortwachter).
