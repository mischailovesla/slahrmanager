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

## E. Daarna (apart project)

- Datamigratie Google Sheets → Supabase: één medewerker-tabel met alle stukken eraan gekoppeld, in plaats van naam-matching over tien tabs. Pas starten als de cutover een paar weken stabiel is.
- Google Sheets alleen-lezen zetten voor iedereen behalve het service account, zodat niemand meer "even in de sheet" iets aanpast buiten het dashboard om.
