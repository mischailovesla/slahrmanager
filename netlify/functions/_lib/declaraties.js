// ============================================================
// v0.49.0 Declaraties via SLA Academy (vervangt het Google Form "SLA Declaratie Formulier").
//  - pure helpers (IBAN-controle, bedrag/datum lezen, dubbel-detectie) -> getest in tests/declaraties.test.js
//  - Academy-sessie controleren (de medewerker is ingelogd in Academy, niet in het HR Dashboard)
//  - opslag: tabel hr_declaraties + hr_declaratie_iban, bucket 'hr-declaraties' (migratie 0025)
// ============================================================
const C = require('./config');

const BUCKET = 'hr-declaraties';
const MAX_BYTES = 10 * 1024 * 1024;
const MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' };
const MAX_BEDRAG = 2500;        // hoger = waarschijnlijk een typfout (komma/punt); groter bedrag loopt via een factuur
const MAX_DAGEN_OUD = 365;      // bonnetjes ouder dan een jaar niet meer via de app
const STATUS = ['ingediend', 'betaald', 'afgewezen'];

// ---------- IBAN ----------
const IBAN_LENGTE = { NL: 18, BE: 16, DE: 22, FR: 27, ES: 24, IT: 27, PT: 25, LU: 20, AT: 20, IE: 22, GB: 22, PL: 28, HU: 28, GR: 27, LT: 20, LV: 21, EE: 20, FI: 18, DK: 18, SE: 24, CZ: 24, SK: 24, SI: 19, HR: 21, RO: 24, BG: 22, CH: 21, NO: 15, MT: 31, CY: 28 };
function normIban(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function mod97(s) { let r = 0; for (const ch of s) { const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch; for (const d of v) r = (r * 10 + Number(d)) % 97; } return r; }
// -> { ok, iban (genormaliseerd), fout }
function controleerIban(s) {
  const iban = normIban(s);
  if (!iban) return { ok: false, iban, fout: 'IBAN ontbreekt.' };
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) return { ok: false, iban, fout: 'Dit lijkt geen IBAN (begint met landcode, bijv. NL12 ABNA ...).' };
  const len = IBAN_LENGTE[iban.slice(0, 2)];
  if (len && iban.length !== len) return { ok: false, iban, fout: 'Een ' + iban.slice(0, 2) + '-IBAN heeft ' + len + ' tekens, deze heeft er ' + iban.length + '.' };
  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) return { ok: false, iban, fout: 'Dit IBAN klopt niet (controlegetal). Controleer op een typfout.' };
  return { ok: true, iban, fout: '' };
}
const ibanMooi = iban => normIban(iban).replace(/(.{4})/g, '$1 ').trim();

// ---------- bedrag / datum ----------
// "12,50" "€ 1.234,56" "12.5" "1,234.56" "24,48 euro" -> 12.5 / 1234.56 / ...  (null = onleesbaar)
function leesBedrag(x) {
  if (typeof x === 'number') return isFinite(x) ? Math.round(x * 100) / 100 : null;
  let s = String(x || '').replace(/eur(o)?|€|\s/gi, '');
  if (!s) return null;
  const k = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (k > -1 && p > -1) s = k > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (k > -1) s = (s.length - k - 1 === 3 && s.indexOf(',') === k && !/^0,/.test(s) ? s.replace(',', '') : s.replace(',', '.'));
  else if (p > -1 && s.length - p - 1 === 3) s = s.replace(/\./g, '');   // 1.234 = duizendtal (NL-notatie)
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return isFinite(n) ? n : null;
}
const isoVandaag = (nu) => { const d = nu || new Date(); const nl = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); return nl.getFullYear() + '-' + String(nl.getMonth() + 1).padStart(2, '0') + '-' + String(nl.getDate()).padStart(2, '0'); };
const dagenTussenIso = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

// Invoer uit de app controleren -> { ok, fouten:[], waarde:{...} }   (fouten tweetalig: nl · en)
function controleerInvoer(p, nu) {
  const f = [], vandaag = isoVandaag(nu);
  const datum = String(p.datum || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) f.push('Datum van aankoop ontbreekt. · Date of purchase is missing.');
  else if (datum > vandaag) f.push('De datum van aankoop ligt in de toekomst. · The date of purchase is in the future.');
  else if (dagenTussenIso(datum, vandaag) > MAX_DAGEN_OUD) f.push('Dit bonnetje is ouder dan een jaar; neem contact op met HR. · This receipt is more than a year old; please contact HR.');
  const leverancier = String(p.leverancier || '').trim().slice(0, 120);
  if (!leverancier) f.push('Vul in waar je het hebt gekocht. · Fill in where you bought it.');
  const bedrag = leesBedrag(p.bedrag);
  if (bedrag == null || bedrag <= 0) f.push('Vul een geldig bedrag in (bijv. 12,50). · Enter a valid amount (e.g. 12.50).');
  else if (bedrag > MAX_BEDRAG) f.push('Bedragen boven € ' + MAX_BEDRAG + ' kunnen niet via de app; neem contact op met HR. · Amounts above € ' + MAX_BEDRAG + ' cannot be claimed in the app; please contact HR.');
  const omschrijving = String(p.omschrijving || '').trim().slice(0, 500);
  if (omschrijving.length < 3) f.push('Beschrijf wat je hebt gekocht en waarvoor. · Describe what you bought and why.');
  const ib = controleerIban(p.iban);
  if (!ib.ok) f.push(ib.fout + ' · Please check your IBAN.');
  const iban_naam = String(p.iban_naam || '').trim().slice(0, 120);
  if (!iban_naam) f.push('Vul de naam van de rekeninghouder in. · Fill in the account holder name.');
  if (p.akkoord !== true) f.push('Bevestig dat de uitgave zakelijk is en het bonnetje klopt. · Confirm that the expense is business-related and the receipt is correct.');
  return { ok: !f.length, fouten: f, waarde: { aankoop_datum: datum, leverancier, bedrag, omschrijving, iban: ib.iban, iban_naam, akkoord: p.akkoord === true } };
}

// Mogelijk dubbel: zelfde medewerker + aankoopdatum + bedrag (afgewezen telt niet mee). Zet r.dubbel = true.
function markeerDubbel(rijen) {
  const n = {};
  rijen.forEach(r => { if (r.status !== 'afgewezen') { const k = r.email + '|' + r.aankoop_datum + '|' + Number(r.bedrag).toFixed(2); n[k] = (n[k] || 0) + 1; } });
  rijen.forEach(r => { r.dubbel = r.status !== 'afgewezen' && n[r.email + '|' + r.aankoop_datum + '|' + Number(r.bedrag).toFixed(2)] > 1; });
  return rijen;
}

// ---------- CORS voor de Academy-app ----------
function origins() { return ['https://sla-academy.netlify.app'].concat(String(process.env.DECLARATIE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)); }
function cors(event) {
  const h = (event && event.headers) || {}, o = h.origin || h.Origin || '';
  const toegestaan = origins();
  return { 'Access-Control-Allow-Origin': toegestaan.includes(o) ? o : toegestaan[0], 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
}

// ---------- Academy-sessie ----------
// Token uit de Academy-app -> { email, academy_id, naam, shiftbase_id, winkel, winkel_code, franchise, taal }
// Naam en winkel komen uit Academy zelf (met de sessie van de medewerker, dus via de RLS van Academy), niet uit de invoer.
async function academyGebruiker(token, _fetch) {
  const f = _fetch || fetch;
  if (!token) { const e = new Error('Niet ingelogd in Academy. · Not logged in.'); e.status = 401; throw e; }
  const h = { apikey: C.ACADEMY_KEY, Authorization: 'Bearer ' + token };
  const u = await f(C.ACADEMY_URL + '/auth/v1/user', { headers: h });
  if (!u.ok) { const e = new Error('Je Academy-sessie is verlopen. Log opnieuw in. · Your session has expired. Please log in again.'); e.status = 401; throw e; }
  const user = await u.json();
  const email = String(user.email || '').toLowerCase();
  if (!email) { const e = new Error('Geen e-mailadres in de sessie.'); e.status = 401; throw e; }
  const r = await f(C.ACADEMY_URL + '/rest/v1/employees?select=id,full_name,email,shiftbase_id,location_id,language,active&email=ilike.' + encodeURIComponent(email) + '&limit=1', { headers: h });
  const emp = r.ok ? (await r.json())[0] : null;
  if (!emp || emp.active === false) { const e = new Error('Je staat niet (meer) als actieve medewerker in Academy. Neem contact op met HR. · You are not listed as an active employee.'); e.status = 403; throw e; }
  let loc = null;
  if (emp.location_id != null) {
    const l = await f(C.ACADEMY_URL + '/rest/v1/locations?select=name,code,franchise&id=eq.' + Number(emp.location_id), { headers: h });
    loc = l.ok ? (await l.json())[0] || null : null;
  }
  return { email, academy_id: emp.id, naam: emp.full_name || email, shiftbase_id: emp.shiftbase_id != null ? String(emp.shiftbase_id) : null, winkel: loc ? loc.name : (emp.location_id == null ? 'HQ' : ''), winkel_code: loc ? (loc.code || '') : (emp.location_id == null ? 'HQ' : ''), franchise: !!(loc && loc.franchise), taal: emp.language === 'en' ? 'en' : 'nl' };
}

const veiligeNaam = s => String(s || 'bon').replace(/[^\w.\-]+/g, '_').slice(-60);
const padVoor = (academyId, naam, mime) => academyId + '/' + Date.now() + '_' + veiligeNaam(naam).replace(/\.[^.]*$/, '') + '.' + (MIME[mime] || 'bin');

module.exports = { BUCKET, MAX_BYTES, MIME, MAX_BEDRAG, STATUS, normIban, controleerIban, ibanMooi, leesBedrag, isoVandaag, controleerInvoer, markeerDubbel, cors, academyGebruiker, padVoor };
