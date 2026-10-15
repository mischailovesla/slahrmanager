// ============================================================
// Google Sheets lezen via service account (ALLEEN LEZEN in stap 1).
// Apps Script blijft de enige die schrijft, zodat beide systemen
// veilig naast elkaar kunnen draaien.
// Rechtstreeks op de Sheets REST API met google-auth-library
// (het volledige googleapis-pakket is te zwaar voor Netlify Functions).
// ============================================================
const { JWT } = require('google-auth-library');
const { SHEETS } = require('./config');
const { normNaam, toDownloadUrl, vindKolommen } = require('./util');

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
let _jwt = null;
function jwt() {
  if (_jwt) return _jwt;
  const raw = String(process.env.GOOGLE_SA_JSON_B64 || '').trim();
  if (!raw) throw new Error('GOOGLE_SA_JSON_B64 ontbreekt (service account)');
  // Accepteert base64 (bedoeld) én per ongeluk geplakte ruwe JSON; witruimte/regeleinden worden genegeerd
  let creds;
  try {
    const txt = raw.startsWith('{') ? raw : Buffer.from(raw.replace(/\s+/g, ''), 'base64').toString('utf8');
    creds = JSON.parse(txt);
  } catch (e) {
    throw new Error('GOOGLE_SA_JSON_B64 is geen geldige base64-JSON (begint met "' + raw.slice(0, 6) + '…", lengte ' + raw.length + '). Verwacht: begint met "ewog" en is ±3000 tekens.');
  }
  if (!creds.client_email || !creds.private_key) throw new Error('Service-account-JSON mist client_email/private_key');
  _jwt = new JWT({ email: creds.client_email, key: creds.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  return _jwt;
}
async function gapi(pad) {
  const { token } = await jwt().getAccessToken();
  const r = await fetch(API + pad, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg += ' - ' + ((j.error && j.error.message) || JSON.stringify(j)); } catch (e) { /* noop */ }
    if (r.status === 403) msg += ' (is de sheet gedeeld met het service account als Lezer?)';
    if (r.status === 404) msg += ' (sheet-ID of tabnaam onbekend)';
    throw new Error('Sheets API: ' + msg);
  }
  return r.json();
}

// Eenvoudige in-memory cache per function-instance (60 s)
const _cache = new Map();
async function lees(spreadsheetId, range, ttlMs) {
  const key = spreadsheetId + '|' + range;
  const hit = _cache.get(key);
  if (hit && hit.t > Date.now()) return hit.v;
  const r = await gapi(encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(range) + '?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING');
  const v = (r && r.values) || [];
  _cache.set(key, { v, t: Date.now() + (ttlMs || 60000) });
  return v;
}

// Eerste tab + tabnaam opzoeken (Apps Script gebruikt getSheets()[0])
const _meta = new Map();
async function tabNamen(spreadsheetId) {
  if (_meta.has(spreadsheetId)) return _meta.get(spreadsheetId);
  const r = await gapi(encodeURIComponent(spreadsheetId) + '?fields=' + encodeURIComponent('sheets(properties(sheetId,title,index))'));
  const tabs = (r.sheets || []).map(s => s.properties).sort((a, b) => a.index - b.index);
  _meta.set(spreadsheetId, tabs);
  return tabs;
}
async function eersteTab(spreadsheetId) { return (await tabNamen(spreadsheetId))[0].title; }
async function tabBijGid(spreadsheetId, gid) {
  const t = (await tabNamen(spreadsheetId)).find(s => String(s.sheetId) === String(gid));
  return t ? t.title : null;
}

const q = t => "'" + String(t).replace(/'/g, "''") + "'";
const cel = (r, i) => String((r && r[i]) || '').trim();
const isJa = v => String(v || '').trim().toUpperCase() === 'JA';

// Header-rij vinden: eerste rij waarvan kolom A 'Naam' is (zoals in Code.gs)
function headerRij(data, label) {
  for (let i = 0; i < data.length; i++) if (cel(data[i], 0) === (label || 'Naam')) return i;
  return -1;
}

// --- Formulier-responses: upload-links per naam/e-mail --------------------
async function loonDocLinks() {
  const tab = await tabBijGid(SHEETS.loonheffing.id, SHEETS.loonheffing.responsesGid);
  if (!tab) return { byNaam: {}, byEmail: {} };
  const data = await lees(SHEETS.loonheffing.id, q(tab));
  if (data.length < 2) return { byNaam: {}, byEmail: {} };
  const kol = vindKolommen(data[0], { naam: ['naam'], email: ['mail'], loon: ['loonbelast'], indienst: ['indienst'] });
  const byNaam = {}, byEmail = {};
  for (let i = 1; i < data.length; i++) {
    const e = { loon: kol.loon > -1 ? toDownloadUrl(cel(data[i], kol.loon)) : '', indienst: kol.indienst > -1 ? toDownloadUrl(cel(data[i], kol.indienst)) : '' };
    if (!e.loon && !e.indienst) continue;
    const n = kol.naam > -1 ? normNaam(cel(data[i], kol.naam)) : '';
    const em = kol.email > -1 ? cel(data[i], kol.email).toLowerCase() : '';
    if (n) byNaam[n] = { loon: e.loon || (byNaam[n] || {}).loon || '', indienst: e.indienst || (byNaam[n] || {}).indienst || '' };
    if (em) byEmail[em] = { loon: e.loon || (byEmail[em] || {}).loon || '', indienst: e.indienst || (byEmail[em] || {}).indienst || '' };
  }
  return { byNaam, byEmail };
}
async function ontslagDocLinks() {
  const tab = await tabBijGid(SHEETS.ontslag.id, SHEETS.ontslag.responsesGid);
  if (!tab) return { byNaam: {}, byEmail: {} };
  const data = await lees(SHEETS.ontslag.id, q(tab));
  if (data.length < 2) return { byNaam: {}, byEmail: {} };
  const kol = vindKolommen(data[0], { naam: ['naam'], email: ['mail'], doc: ['upload', 'column 2'] });
  if (kol.doc === -1) { // fallback: eerste kolom met drive-link
    for (let c = 0; c < data[0].length && kol.doc === -1; c++) {
      if (c === kol.naam || c === kol.email) continue;
      for (let i = 1; i < Math.min(data.length, 50); i++) if (cel(data[i], c).indexOf('drive.google.com') > -1) { kol.doc = c; break; }
    }
  }
  const byNaam = {}, byEmail = {};
  for (let i = 1; i < data.length; i++) {
    const d = kol.doc > -1 ? cel(data[i], kol.doc) : '';
    if (!d) continue;
    const url = toDownloadUrl(d);
    const n = kol.naam > -1 ? normNaam(cel(data[i], kol.naam)) : '';
    const em = kol.email > -1 ? cel(data[i], kol.email).toLowerCase() : '';
    if (n) byNaam[n] = url;
    if (em) byEmail[em] = url;
  }
  return { byNaam, byEmail };
}
function zoekDoc(dl, naam, email) {
  const em = String(email || '').trim().toLowerCase();
  if (em && dl.byEmail[em]) return dl.byEmail[em];
  const n = normNaam(naam);
  return (n && dl.byNaam[n]) || null;
}

// --- Loonheffing (kolommen A..K zoals getLoonheffingData) ------------------
async function getLoonheffing() {
  const id = SHEETS.loonheffing.id;
  const data = await lees(id, q(await eersteTab(id)));
  const h = headerRij(data); if (h === -1) return [];
  const dl = await loonDocLinks();
  const out = [];
  for (let i = h + 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0)) continue;
    const d = zoekDoc(dl, cel(r, 0), cel(r, 1)) || {};
    out.push({
      rij: i + 1, naam: cel(r, 0), email: cel(r, 1), deadline: cel(r, 2), status: cel(r, 3), verzenddatum: cel(r, 4),
      ontvangen: isJa(r[5]) ? 'Ja' : 'Nee', taal: cel(r, 6).toUpperCase() || 'NL', herinnering: cel(r, 7),
      aantalHer: parseInt(cel(r, 8), 10) || 0, mahdia: isJa(r[9]) ? 'Ja' : 'Nee', salaris: cel(r, 10),
      docUrl: d.loon || '', docUrl2: d.indienst || ''
    });
  }
  return out;
}

// --- Ontslag (A..P zoals getOntslagData v29.5) ------------------------------
async function getOntslag() {
  const id = SHEETS.ontslag.id;
  const data = await lees(id, q(await eersteTab(id)));
  const h = headerRij(data); if (h === -1) return [];
  const dl = await ontslagDocLinks();
  const out = [];
  for (let i = h + 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0)) continue;
    out.push({
      rij: i + 1, naam: cel(r, 0), email: cel(r, 1), opzegging: cel(r, 2), einddatum: cel(r, 3), bedrijf: cel(r, 5), adres: cel(r, 6),
      status: cel(r, 7), verzenddatum: cel(r, 8), ondertekend: isJa(r[9]) ? 'Ja' : 'Nee', herinnering: cel(r, 10),
      aantalHer: parseInt(cel(r, 11), 10) || 0, mahdia: isJa(r[13]) ? 'Ja' : 'Nee', salaris: cel(r, 14),
      docUrl: zoekDoc(dl, cel(r, 0), cel(r, 1)) || '', briefUrl: cel(r, 15),
      // aanzegging = geen opzegdatum maar wel einddatum (zelfde heuristiek als reconstrueerBrief)
      type: (!cel(r, 2) && cel(r, 3)) ? 'aanzegging' : 'ontslag'
    });
  }
  return out;
}

// --- Sommatie (A..J) -------------------------------------------------------
async function getSommatie() {
  const id = SHEETS.sommatie.id;
  const data = await lees(id, q(await eersteTab(id)));
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue;
    out.push({
      rij: i + 1, naam: cel(r, 0), email: cel(r, 1), bv: cel(r, 2), type: cel(r, 3), datumAfwezig: cel(r, 4),
      datumAfspraak: cel(r, 5), verzenddatum: cel(r, 6), status: cel(r, 7), verwerkt: cel(r, 8), aanvullend: cel(r, 9)
    });
  }
  return out;
}

// --- Overplaatsing (tab, A..Q) ---------------------------------------------
async function getOverplaatsing() {
  const { id, tab } = SHEETS.overplaatsing;
  let data;
  try { data = await lees(id, q(tab)); } catch (e) { return []; }
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue;
    out.push({
      rij: i + 1, naam: cel(r, 0), email: cel(r, 1), adres: cel(r, 2), huidigeBV: cel(r, 3), nieuweBV: cel(r, 4),
      datumIndienst: cel(r, 5), ingangsdatum: cel(r, 6), functie: cel(r, 7), standplaats: cel(r, 8), taal: cel(r, 9).toUpperCase() || 'NL',
      status: cel(r, 10), verzenddatum: cel(r, 11), ondertekend: isJa(r[12]) ? 'Ja' : 'Nee', herinnering: cel(r, 13),
      aantalHer: parseInt(cel(r, 14), 10) || 0, type: cel(r, 15), briefUrl: cel(r, 16)
    });
  }
  return out;
}

// --- Onboarding (historie; A..I) --------------------------------------------
async function getOnboarding() {
  const id = SHEETS.onboarding.id;
  const data = await lees(id, q(await eersteTab(id)));
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0) && !cel(r, 1) && !cel(r, 2)) continue;
    const vn = cel(r, 0), an = cel(r, 1);
    out.push({ rij: i + 1, naam: (vn + ' ' + an).trim(), email: cel(r, 2), taal: cel(r, 3).toUpperCase() || 'NL', status: cel(r, 4), verzenddatum: cel(r, 5), locatie: cel(r, 8) });
  }
  return out;
}

// --- Extra dossier-tabs (configureerbaar) -----------------------------------
async function getExtraTabs() {
  const { DOSSIER_EXTRA_TABS } = require('./config');
  const res = [];
  for (const t of DOSSIER_EXTRA_TABS) {
    try {
      const data = await lees(t.id, q(t.tab));
      const rijen = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i]; if (!cel(r, t.naamKol)) continue;
        rijen.push({ rij: i + 1, naam: cel(r, t.naamKol), email: t.emailKol >= 0 ? cel(r, t.emailKol) : '', datum: t.datumKol >= 0 ? cel(r, t.datumKol) : '', raw: r });
      }
      res.push({ label: t.label, rijen });
    } catch (e) { res.push({ label: t.label, rijen: [], fout: e.message }); }
  }
  return res;
}

module.exports = { getLoonheffing, getOntslag, getSommatie, getOverplaatsing, getOnboarding, getExtraTabs, lees };
