# SLA HR Dashboard — Netlify-versie

Herbouw van het SLA HR Dashboard (Google Apps Script) als Netlify-app.
Wordt **naast** het bestaande Apps Script-dashboard gebouwd; dat blijft leidend tot een module volledig is overgezet.

## Status: stap 1 — alleen lezen

| Werkt | Nog in Apps Script |
|---|---|
| Google-login (alleen @ilovesla.com + allowlist) | Mails versturen, brieven/PDF's maken |
| Toegangslog in Supabase (AVG) | Afvinken (Mahdia, ondertekend, verwerkt) |
| Overzicht: werklijst, stats, aanzeg-alerts, open dossiers | Alle schrijfacties naar de sheets |
| Medewerkersdossier: Shiftbase-zoekveld, contract, verlof, alle log-tabs | Waarschuwing, Proeftijd, Vrije brieven, Korting, Beschikbaarheid, Vastloners, Vakantieplanner, Verloop |

**Schrijft nergens naar de Google Sheets.** Apps Script en Netlify kijken naar dezelfde sheets, dus er is geen migratie van data nodig in deze stap.

## Stack

- **Frontend**: `public/` — één `index.html` + `app.js` + `styles.css`, vanilla JS, SLA-huisstijl
- **Backend**: `netlify/functions/` — Node (Netlify Functions). Alle secrets blijven server-side.
- **Auth**: Supabase Auth (Google OAuth) + tabel `hr_toegang` als allowlist, `hr_toegangslog` als audit-log
- **Data**: Google Sheets (service account, read-only scope), Shiftbase API

```
sla-hr-dashboard/
├─ public/                  index.html, app.js, styles.css
├─ netlify/functions/
│  ├─ _lib/                 auth.js, config.js, sheets.js, shiftbase.js, util.js
│  ├─ config.js             GET /api/config      publieke config voor de browser
│  ├─ ik.js                 GET /api/ik          wie ben ik + toegang (logt 'login')
│  ├─ overzicht.js          GET /api/overzicht   open dossiers + werklijst
│  ├─ medewerkers.js        GET /api/medewerkers Shiftbase-lijst (?ververs=1)
│  └─ dossier.js            GET /api/dossier     ?id= | ?naam=&email=
├─ supabase/migrations/0001_toegang.sql
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
2. **SQL Editor** → plak `supabase/migrations/0001_toegang.sql` → Run. Controleer de seed-e-mails in `hr_toegang`.
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
4. Deel de vier sheets met het service-account-e-mailadres (`hr-dashboard-reader@...iam.gserviceaccount.com`) als **Lezer**:
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
3. Deploy. Open de site, log in met je Google-account.

### 5. Controle
- Login werkt → in Supabase **Table Editor → hr_toegangslog** staat een regel `login`.
- Overzicht toont dezelfde open dossiers als het Apps Script-dashboard.
- Dossier: zoek jezelf of een collega; contract en verlof komen uit Shiftbase.

## Lokaal draaien
```bash
npm install
cp .env.example .env   # invullen
npx netlify dev        # http://localhost:8888
```

## Toegang beheren
Allowlist = tabel `hr_toegang` in Supabase (Table Editor). `actief=false` zet iemand uit zonder de regel te verwijderen. Alle opvragen worden gelogd in `hr_toegangslog`; de view `hr_toegangslog_recent` toont de laatste 200.

## Extra dossier-tabs
`DOSSIER_EXTRA_TABS` in `netlify/functions/_lib/config.js` — per tab sheet-ID, tabnaam en de kolomindex van naam/e-mail/datum. Zodra Waarschuwing.gs, Proeftijd.gs, VrijeBrief.gs, Korting.gs en Beschikbaarheid.gs zijn aangeleverd worden die hier ingevuld.

## Roadmap
1. ✅ Shell + login + Overzicht/Dossier (lezen)
2. Logging naar Supabase (eenmalige import van de sheets) + eerste schrijfacties (afvinken)
3. Brieven één voor één: Vrije brieven → Ontslag/Aanzegging → Waarschuwing → Proeftijd → Overplaatsing (HTML→PDF, mail via Resend)
4. Signaleringen als Netlify Scheduled Functions; per module de Apps Script-trigger uit
5. Apps Script uit, oude exec-URL doorverwijzen
