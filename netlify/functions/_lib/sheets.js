// ============================================================
// Google Sheets lezen én schrijven via service account.
// Stap 2: schrijfacties (vinkjes, archiveren) gaan naar DEZELFDE cellen
// als Code.gs, zodat Apps Script en Netlify consistent blijven. De
// sheets zijn de enige waarheid zolang Apps Script draait.
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
  _jwt = new JWT({ email: creds.client_email, key: creds.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return _jwt;
}
async function gapi(pad, method, body) {
  const { token } = await jwt().getAccessToken();
  const r = await fetch(API + pad, {
    method: method || 'GET',
    headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); msg += ' - ' + ((j.error && j.error.message) || JSON.stringify(j)); } catch (e) { /* noop */ }
    if (r.status === 403) msg += ' (is de sheet gedeeld met het service account' + (method && method !== 'GET' ? ' als Bewerker' : '') + '?)';
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

function vergeetCache(spreadsheetId) {
  for (const k of Array.from(_cache.keys())) if (k.startsWith(spreadsheetId + '|')) _cache.delete(k);
}

// ---- Schrijven --------------------------------------------------------------
const KLEUR = { groen: '#d9ead3', geel: '#fff2cc', blauw: '#cfe2f3', wit: '#ffffff' };
function hexNaarRgb(hex) {
  const m = String(hex || '#ffffff').replace('#', '');
  return { red: parseInt(m.slice(0, 2), 16) / 255, green: parseInt(m.slice(2, 4), 16) / 255, blue: parseInt(m.slice(4, 6), 16) / 255 };
}
const kolLetter = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

// Zet één cel (1-based rij/kolom) met waarde + achtergrondkleur, zoals
// sheet.getRange(rij,kol).setValue(v).setBackground(kleur) in Apps Script.
async function zetCel(spreadsheetId, tabNaam, rij, kol, waarde, kleurHex) {
  const tabs = await tabNamen(spreadsheetId);
  const tab = tabs.find(s => s.title === tabNaam) || tabs[0];
  const range = q(tab.title) + '!' + kolLetter(kol) + rij;
  await gapi(encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(range) + '?valueInputOption=USER_ENTERED', 'PUT',
    { range, majorDimension: 'ROWS', values: [[waarde]] });
  if (kleurHex) {
    await gapi(encodeURIComponent(spreadsheetId) + ':batchUpdate', 'POST', { requests: [{
      repeatCell: {
        range: { sheetId: tab.sheetId, startRowIndex: rij - 1, endRowIndex: rij, startColumnIndex: kol - 1, endColumnIndex: kol },
        cell: { userEnteredFormat: { backgroundColor: hexNaarRgb(kleurHex) } },
        fields: 'userEnteredFormat.backgroundColor'
      } }] });
  }
  vergeetCache(spreadsheetId);
}

// Eén cel lezen (ruwe weergavewaarde), zonder cache
async function leesCel(spreadsheetId, tabNaam, rij, kol) {
  const tabs = await tabNamen(spreadsheetId);
  const tab = tabs.find(s => s.title === tabNaam) || tabs[0];
  const range = q(tab.title) + '!' + kolLetter(kol) + rij;
  const r = await gapi(encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(range) + '?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING');
  return String(((r.values || [[]])[0] || [])[0] || '').trim();
}

// Rij archiveren: kopie naar tab "Archief" (met Gearchiveerd op / Door / Bron),
// daarna de rij uit de brontab verwijderen. Port van archiveerRij in Code.gs v29.5.
async function archiveerRij(spreadsheetId, label, rij, naamCheck, wie, isOnboarding) {
  const tabs = await tabNamen(spreadsheetId);
  const bron = tabs[0];
  const data = await lees(spreadsheetId, q(bron.title), 1);
  if (rij < 2 || rij > data.length) throw new Error('Rij bestaat niet meer. Ververs het dashboard.');
  const rowVals = data[rij - 1] || [];
  const breedte = Math.max(data.reduce((m, r) => Math.max(m, r.length), 0), 1);
  let naamInSheet = cel(rowVals, 0);
  if (isOnboarding) naamInSheet = (naamInSheet + ' ' + cel(rowVals, 1)).trim();
  if (!naamInSheet) throw new Error('Lege rij - er is niets gearchiveerd.');
  if (naamCheck && normNaam(naamInSheet) !== normNaam(naamCheck)) {
    throw new Error('Rij komt niet overeen (sheet: "' + naamInSheet + '", dashboard: "' + naamCheck + '"). Ververs het dashboard en probeer opnieuw.');
  }
  // Archief-tab aanmaken als die ontbreekt
  let arch = tabs.find(s => s.title === 'Archief');
  if (!arch) {
    const r = await gapi(encodeURIComponent(spreadsheetId) + ':batchUpdate', 'POST', { requests: [{ addSheet: { properties: { title: 'Archief' } } }] });
    arch = r.replies[0].addSheet.properties;
    _meta.delete(spreadsheetId);
    const hRij = data.findIndex(r => ['naam', 'voornaam'].includes(cel(r, 0).toLowerCase()));
    const kop = ['Gearchiveerd op', 'Door', 'Bron'].concat(hRij > -1 ? data[hRij] : []);
    await gapi(encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(q('Archief') + '!A1') + '?valueInputOption=USER_ENTERED', 'PUT',
      { range: q('Archief') + '!A1', majorDimension: 'ROWS', values: [kop] });
  }
  const stempel = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 16);
  const rijUit = [stempel, wie || '', label].concat(Array.from({ length: breedte }, (_, i) => rowVals[i] === undefined ? '' : rowVals[i]));
  await gapi(encodeURIComponent(spreadsheetId) + '/values/' + encodeURIComponent(q('Archief') + '!A1') + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', 'POST',
    { majorDimension: 'ROWS', values: [rijUit] });
  await gapi(encodeURIComponent(spreadsheetId) + ':batchUpdate', 'POST', { requests: [{
    deleteDimension: { range: { sheetId: bron.sheetId, dimension: 'ROWS', startIndex: rij - 1, endIndex: rij } } }] });
  vergeetCache(spreadsheetId);
  return naamInSheet;
}

// Loonheffing-sheet: rij vinden op e-mail (na de header 'Naam'), of 0
async function vindLoonRij(email) {
  const id = SHEETS.loonheffing.id;
  const data = await lees(id, q(await eersteTab(id)), 1);
  const h = headerRij(data); if (h === -1) return 0;
  const el = String(email || '').trim().toLowerCase();
  if (!el) return 0;
  for (let i = h + 1; i < data.length; i++) if (cel(data[i], 1).toLowerCase() === el) return i + 1;
  return 0;
}
// Eerste lege rij ná de laatste gevulde naam (logVerzonden v25: geen vervuilde rijen)
async function eersteLegeLoonRij() {
  const id = SHEETS.loonheffing.id;
  const data = await lees(id, q(await eersteTab(id)), 1);
  for (let j = data.length - 1; j >= 0; j--) if (cel(data[j], 0)) return j + 2;
  return data.length + 1;
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

// --- Vrije brieven: tab 'Brieven' in de HR-acties-sheet (VrijeBrief.gs v1.2) ----
// Kolommen A Naam, B Email, C BV, D Categorie, E Onderwerp, F Tekst, G PDF (Ja/Nee),
// H Verzenddatum, I Status ('Verstuurd', groen). Nieuwste bovenaan, zoals getVrijeBriefData.
const BRIEF_TAB = 'Brieven';
const BRIEF_KOP = ['Naam', 'Email', 'BV', 'Categorie', 'Onderwerp', 'Tekst', 'PDF', 'Verzenddatum', 'Status'];
async function getBrieven() {
  const id = SHEETS.brieven.id;
  let data;
  try { data = await lees(id, q(BRIEF_TAB)); } catch (e) { if (/tabnaam onbekend|Unable to parse range/i.test(e.message)) return []; throw e; }
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue;
    out.push({ rij: i + 1, naam: cel(r, 0), email: cel(r, 1), bv: cel(r, 2), categorie: cel(r, 3), onderwerp: cel(r, 4), tekst: String((r && r[5]) || ''), pdf: cel(r, 6) === 'Ja' ? 'Ja' : 'Nee', verzenddatum: cel(r, 7), status: cel(r, 8) });
  }
  return out.reverse();
}
// Tab 'Brieven' aanmaken als die ontbreekt (initBriefSheet in Apps Script); geeft tab-properties terug
async function zorgBrievenTab() {
  const id = SHEETS.brieven.id;
  let tab = (await tabNamen(id)).find(s => s.title === BRIEF_TAB);
  if (tab) return tab;
  const r = await gapi(encodeURIComponent(id) + ':batchUpdate', 'POST', { requests: [{ addSheet: { properties: { title: BRIEF_TAB, gridProperties: { frozenRowCount: 1 } } } }] });
  tab = r.replies[0].addSheet.properties;
  _meta.delete(id);
  await gapi(encodeURIComponent(id) + '/values/' + encodeURIComponent(q(BRIEF_TAB) + '!A1') + '?valueInputOption=USER_ENTERED', 'PUT',
    { range: q(BRIEF_TAB) + '!A1', majorDimension: 'ROWS', values: [BRIEF_KOP] });
  await gapi(encodeURIComponent(id) + ':batchUpdate', 'POST', { requests: [{
    repeatCell: { range: { sheetId: tab.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: BRIEF_KOP.length },
      cell: { userEnteredFormat: { backgroundColor: hexNaarRgb('#333d3a'), textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
      fields: 'userEnteredFormat(backgroundColor,textFormat)' } }] });
  return tab;
}
// Brief loggen: eerste lege rij na de laatste gevulde naam (vbLaatsteDataRij_ + 1), status groen
async function logBrief(b, stempelTekst) {
  const id = SHEETS.brieven.id;
  const tab = await zorgBrievenTab();
  vergeetCache(id);
  const data = await lees(id, q(BRIEF_TAB), 1);
  let rij = 2;
  for (let j = data.length - 1; j >= 0; j--) if (cel(data[j], 0)) { rij = j + 2; break; }
  const range = q(BRIEF_TAB) + '!A' + rij + ':I' + rij;
  await gapi(encodeURIComponent(id) + '/values/' + encodeURIComponent(range) + '?valueInputOption=USER_ENTERED', 'PUT',
    { range, majorDimension: 'ROWS', values: [[b.naam, b.email, b.bv || '', b.categorie, b.onderwerp, String(b.tekst || ''), b.metPdf ? 'Ja' : 'Nee', stempelTekst, 'Verstuurd']] });
  await gapi(encodeURIComponent(id) + ':batchUpdate', 'POST', { requests: [{
    repeatCell: { range: { sheetId: tab.sheetId, startRowIndex: rij - 1, endRowIndex: rij, startColumnIndex: 8, endColumnIndex: 9 },
      cell: { userEnteredFormat: { backgroundColor: hexNaarRgb(KLEUR.groen) } }, fields: 'userEnteredFormat.backgroundColor' } }] });
  vergeetCache(id);
  return rij;
}

module.exports = { getLoonheffing, getOntslag, getSommatie, getOverplaatsing, getOnboarding, getExtraTabs, getBrieven, logBrief, zorgBrievenTab, lees, zetCel, leesCel, archiveerRij, vergeetCache, KLEUR, vindLoonRij, eersteLegeLoonRij };
