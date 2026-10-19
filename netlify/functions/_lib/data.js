// ============================================================
// Supabase-datalaag (stap 6): vervangt sheets-google.js, met DEZELFDE functies en
// handtekeningen, zodat endpoints en signaleringen ongewijzigd blijven.
// De sheet-begrippen (sheet-id, tabnaam, rij, kolomnummer) worden hier
// vertaald naar tabel + rij (primaire sleutel) + kolomnaam via tabellen.js.
// Kleuren (achtergrond van cellen) bestaan niet meer: de UI leidt de status
// al af uit de waarden. Alle waarden blijven tekst, precies zoals de sheet.
// ============================================================
const { admin } = require('./auth');
const C = require('./config');
const { SHEETS, TAB_KORTING, TAB_NOTITIES, TAB_WAARSCHUWINGEN, TAB_BESCHIKBAARHEID } = C;
const T = require('./tabellen');
const { normNaam, toDownloadUrl } = require('./util');

const KLEUR = { groen: '#d9ead3', geel: '#fff2cc', blauw: '#cfe2f3', wit: '#ffffff' };
const cel = (r, i) => String((r && r[i]) || '').trim();
const isJa = v => String(v || '').trim().toUpperCase() === 'JA';
const db = () => admin();
function fout(e, wat) { throw new Error('Database (' + wat + '): ' + (e.message || e)); }

// ---- Basis: lezen/schrijven per tabel ---------------------------------------
async function alles(tabel, metArchief) {
  const uit = [];
  for (let van = 0; ; van += 1000) {
    let q = db().from(tabel).select('*').order('rij', { ascending: true }).range(van, van + 999);
    if (!metArchief) q = q.is('gearchiveerd_op', null);
    const { data, error } = await q;
    if (error) fout(error, tabel);
    uit.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return uit;
}
async function eenRij(tabel, rij) {
  const { data, error } = await db().from(tabel).select('*').eq('rij', rij).maybeSingle();
  if (error) fout(error, tabel + ' rij ' + rij);
  return data || null;
}
async function volgendeRij(tabel) {
  const { data, error } = await db().from(tabel).select('rij').order('rij', { ascending: false }).limit(1);
  if (error) fout(error, tabel);
  const max = data && data[0] ? Number(data[0].rij) : 1;
  return Math.max(max, 1) + 1; // rij 1 = kopregel in de sheet; data begint bij 2
}
// Positionele rij (zoals een sheet-rij) <-> record
function naarRecord(tabel, arr) {
  const kol = T.kolomNamen(tabel), rec = {};
  kol.forEach((k, i) => { rec[k] = arr[i] == null ? '' : String(arr[i]); });
  if (arr.length > kol.length) rec.extra = arr.slice(kol.length).map(v => v == null ? '' : String(v));
  return rec;
}
function naarArr(tabel, rec) {
  const arr = T.kolomNamen(tabel).map(k => rec[k] == null ? '' : String(rec[k]));
  if (Array.isArray(rec.extra)) arr.push(...rec.extra.map(v => v == null ? '' : String(v)));
  return arr;
}
// "Sheet-weergave": data[0] = koppen, data[rij-1] = waarden (gaten = lege rij). Hiermee blijven de
// bestaande mappers (cel(r, i)) 1-op-1 bruikbaar en klopt het rijnummer met de primaire sleutel.
async function sheetWeergave(tabel, metArchief) {
  const rijen = await alles(tabel, metArchief);
  const data = [T.koppen(tabel)];
  data.mid = {}; // rij -> medewerker_id (Shiftbase), fase 1: medewerker als kern
  for (const r of rijen) { while (data.length < r.rij - 1) data.push([]); data[r.rij - 1] = naarArr(tabel, r); if (r.medewerker_id) data.mid[r.rij] = String(r.medewerker_id); }
  return data;
}
// mid aan een gemapte rij hangen (alle getters): frontend gebruikt het voor winkel-filter en dossier
const metMid = (data, obj) => { if (data.mid && data.mid[obj.rij]) obj.mid = data.mid[obj.rij]; return obj; };
async function upsert(tabel, rec) {
  const { error } = await db().from(tabel).upsert(rec, { onConflict: 'rij' });
  if (error) fout(error, tabel + ' opslaan');
}
async function nieuweRij(tabel, arr) {
  const rij = await volgendeRij(tabel);
  await upsert(tabel, Object.assign({ rij }, naarRecord(tabel, arr)));
  return rij;
}

// ---- Compatibiliteit met de cel-API van sheets.js ---------------------------
function tabelOf(id, tabNaam) {
  const t = T.tabelVoor(id, tabNaam);
  if (!t) throw new Error('Geen tabel voor sheet ' + id + ' / tab ' + (tabNaam || '(hoofd)'));
  return t;
}
async function zetCel(id, tabNaam, rij, kol, waarde /* , kleurHex genegeerd */) {
  const tabel = tabelOf(id, tabNaam);
  rij = parseInt(rij, 10); if (!rij || rij < 2) throw new Error('Ongeldige rij');
  const kolommen = T.kolomNamen(tabel);
  const bestaand = await eenRij(tabel, rij);
  const rec = bestaand ? {} : { rij };
  if (kol <= kolommen.length) rec[kolommen[kol - 1]] = waarde == null ? '' : String(waarde);
  else { const extra = (bestaand && Array.isArray(bestaand.extra)) ? bestaand.extra.slice() : []; while (extra.length < kol - kolommen.length) extra.push(''); extra[kol - kolommen.length - 1] = String(waarde == null ? '' : waarde); rec.extra = extra; }
  if (bestaand) { const { error } = await db().from(tabel).update(rec).eq('rij', rij); if (error) fout(error, tabel + ' rij ' + rij); }
  else await upsert(tabel, rec);
}
async function leesCel(id, tabNaam, rij, kol) {
  const tabel = tabelOf(id, tabNaam);
  const r = await eenRij(tabel, parseInt(rij, 10));
  if (!r) return '';
  return cel(naarArr(tabel, r), kol - 1);
}
async function lees() { throw new Error('lees(range) bestaat niet meer: de data staat in Supabase (DATA_BRON=supabase).'); }
function vergeetCache() { /* geen cache nodig */ }
async function leesRuw(id, tabNaam) { const t = T.tabelVoor(id, tabNaam); return t ? sheetWeergave(t) : []; }
const eersteTabNaam = async () => 'hoofd';
async function zorgTab(id, tabNaam) { return { title: tabNaam, sheetId: 0 }; }
const zorgBrievenTab = () => zorgTab(SHEETS.brieven.id, SHEETS.brieven.tab);
function jwt() { throw new Error('Geen Google-service-account meer in gebruik (DATA_BRON=supabase).'); }

async function vindRijOpEmail(tabel, email) {
  const el = String(email || '').trim().toLowerCase(); if (!el) return 0;
  const { data, error } = await db().from(tabel).select('rij').ilike('email', el).is('gearchiveerd_op', null).order('rij', { ascending: true }).limit(1);
  if (error) fout(error, tabel);
  return data && data[0] ? Number(data[0].rij) : 0;
}
const vindLoonRij = email => vindRijOpEmail('hr_loonheffing', email);
const eersteLegeLoonRij = () => volgendeRij('hr_loonheffing');
const vindOntslagRij = email => vindRijOpEmail('hr_ontslag', email);
const eersteLegeOntslagRij = () => volgendeRij('hr_ontslag');

// Archiveren = markeren (rij blijft bestaan, verdwijnt uit alle lijsten)
function stempelNu() { return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).replace('T', ' ').slice(0, 16); }
async function archiveerRij(id, label, rij, naamCheck, wie, isOnboarding) {
  const tabel = tabelOf(id, null);
  const r = await eenRij(tabel, parseInt(rij, 10));
  if (!r || r.gearchiveerd_op) throw new Error('Rij bestaat niet meer. Ververs het dashboard.');
  let naam = isOnboarding ? ((r.voornaam || '') + ' ' + (r.achternaam || '')).trim() : String(r.naam || '').trim();
  if (!naam) throw new Error('Lege rij - er is niets gearchiveerd.');
  if (naamCheck && normNaam(naam) !== normNaam(naamCheck)) throw new Error('Rij komt niet overeen (database: "' + naam + '", dashboard: "' + naamCheck + '"). Ververs het dashboard en probeer opnieuw.');
  const { error } = await db().from(tabel).update({ gearchiveerd_op: stempelNu(), gearchiveerd_door: wie || '', gearchiveerd_bron: label || '' }).eq('rij', r.rij);
  if (error) fout(error, tabel + ' archiveren');
  return naam;
}
const ARCHIEF_TABEL = { loonheffing: 'hr_loonheffing', ontslag: 'hr_ontslag', sommatie: 'hr_sommatie', onboarding: 'hr_onboarding' };
async function getArchief(type) {
  const tabel = ARCHIEF_TABEL[type]; if (!tabel) throw new Error('Onbekend type: ' + type);
  const { data, error } = await db().from(tabel).select('*').not('gearchiveerd_op', 'is', null).order('gearchiveerd_op', { ascending: false }).limit(2000);
  if (error) fout(error, tabel);
  const kop = T.koppen(tabel);
  const rijen = (data || []).map(r => { const v = naarArr(tabel, r); return { rij: r.rij, gearchiveerd: r.gearchiveerd_op || '', door: r.gearchiveerd_door || '', bron: r.gearchiveerd_bron || '', naam: type === 'onboarding' ? (cel(v, 0) + ' ' + cel(v, 1)).trim() : cel(v, 0), velden: v.slice(0, Math.max(kop.length, 8)) }; });
  return { kop, rijen };
}
async function herstelUitArchief(type, archiefRij) {
  const tabel = ARCHIEF_TABEL[type]; if (!tabel) throw new Error('Onbekend type: ' + type);
  const r = await eenRij(tabel, parseInt(archiefRij, 10));
  if (!r || !r.gearchiveerd_op) throw new Error('Ongeldige archiefrij.');
  const { error } = await db().from(tabel).update({ gearchiveerd_op: null, gearchiveerd_door: null, gearchiveerd_bron: null }).eq('rij', r.rij);
  if (error) fout(error, tabel + ' herstellen');
  return type === 'onboarding' ? ((r.voornaam || '') + ' ' + (r.achternaam || '')).trim() : String(r.naam || '');
}

// ---- Documentlinks: oude Forms-reacties (hr_formulier_reacties) + Supabase-uploads (hr_uploads) ----
async function formReacties(soort) {
  const { data, error } = await db().from(T.FORMULIER_TABEL).select('*').eq('soort', soort).order('id', { ascending: true }).limit(5000);
  if (error) { console.warn('hr_formulier_reacties:', error.message); return []; }
  return data || [];
}
async function loonFormLinks() {
  const byNaam = {}, byEmail = {};
  for (const f of await formReacties('loon')) {
    const e = { loon: toDownloadUrl(f.loon_url || ''), indienst: toDownloadUrl(f.indienst_url || '') };
    if (!e.loon && !e.indienst) continue;
    const n = normNaam(f.naam), em = String(f.email || '').toLowerCase();
    if (n) byNaam[n] = { loon: e.loon || (byNaam[n] || {}).loon || '', indienst: e.indienst || (byNaam[n] || {}).indienst || '' };
    if (em) byEmail[em] = { loon: e.loon || (byEmail[em] || {}).loon || '', indienst: e.indienst || (byEmail[em] || {}).indienst || '' };
  }
  return { byNaam, byEmail };
}
async function ontslagFormLinks() {
  const byNaam = {}, byEmail = {};
  for (const f of await formReacties('ontslag')) {
    const url = toDownloadUrl(f.doc_url || ''); if (!url) continue;
    const n = normNaam(f.naam), em = String(f.email || '').toLowerCase();
    if (n) byNaam[n] = url; if (em) byEmail[em] = url;
  }
  return { byNaam, byEmail };
}
async function mergeUploads(dl, soort, maak, combineer) {
  let up; try { up = await require('./uploads').vindUploads(soort); } catch (e) { console.warn('uploads:', e.message); return; }
  for (const k of Object.keys(up.byNaam)) dl.byNaam[k] = combineer(dl.byNaam[k], maak(up.byNaam[k]));
  for (const k of Object.keys(up.byEmail)) dl.byEmail[k] = combineer(dl.byEmail[k], maak(up.byEmail[k]));
}
async function loonDocLinks() { const dl = await loonFormLinks(); await mergeUploads(dl, 'loon', r => ({ loon: r.loon || '', indienst: r.indienst || '' }), (oud, nw) => ({ loon: nw.loon || (oud || {}).loon || '', indienst: nw.indienst || (oud || {}).indienst || '' })); return dl; }
async function ontslagDocLinks() { const dl = await ontslagFormLinks(); await mergeUploads(dl, 'ontslag', r => r.ontslag || '', (oud, nw) => nw || oud || ''); return dl; }
function zoekDoc(dl, naam, email) { const em = String(email || '').trim().toLowerCase(); if (em && dl.byEmail[em]) return dl.byEmail[em]; const n = normNaam(naam); return (n && dl.byNaam[n]) || null; }

// ---- Lijsten (zelfde vorm als sheets.js) ------------------------------------
async function getLoonheffing() {
  const data = await sheetWeergave('hr_loonheffing'); const dl = await loonDocLinks(); const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0)) continue;
    const d = zoekDoc(dl, cel(r, 0), cel(r, 1)) || {};
    out.push(metMid(data, { rij: i + 1, naam: cel(r, 0), email: cel(r, 1), deadline: cel(r, 2), status: cel(r, 3), verzenddatum: cel(r, 4), ontvangen: isJa(r[5]) ? 'Ja' : 'Nee', taal: cel(r, 6).toUpperCase() || 'NL', herinnering: cel(r, 7), aantalHer: parseInt(cel(r, 8), 10) || 0, mahdia: isJa(r[9]) ? 'Ja' : 'Nee', salaris: cel(r, 10), docUrl: d.loon || '', docUrl2: d.indienst || '' }));
  }
  return out;
}
async function getOntslag() {
  const data = await sheetWeergave('hr_ontslag'); const dl = await ontslagDocLinks(); const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i]; if (!cel(r, 0)) continue;
    out.push(metMid(data, { rij: i + 1, naam: cel(r, 0), email: cel(r, 1), opzegging: cel(r, 2), einddatum: cel(r, 3), bedrijf: cel(r, 5), adres: cel(r, 6), status: cel(r, 7), verzenddatum: cel(r, 8), ondertekend: isJa(r[9]) ? 'Ja' : 'Nee', herinnering: cel(r, 10), aantalHer: parseInt(cel(r, 11), 10) || 0, mahdia: isJa(r[13]) ? 'Ja' : 'Nee', salaris: cel(r, 14), docUrl: zoekDoc(dl, cel(r, 0), cel(r, 1)) || '', briefUrl: cel(r, 15), uitstroomreden: cel(r, 16), type: (!cel(r, 2) && cel(r, 3)) ? 'aanzegging' : 'ontslag' }));
  }
  return out;
}
async function getSommatie() {
  const data = await sheetWeergave('hr_sommatie'); const out = [];
  for (let i = 1; i < data.length; i++) { const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue; out.push(metMid(data, { rij: i + 1, naam: cel(r, 0), email: cel(r, 1), bv: cel(r, 2), type: cel(r, 3), datumAfwezig: cel(r, 4), datumAfspraak: cel(r, 5), verzenddatum: cel(r, 6), status: cel(r, 7), verwerkt: cel(r, 8), aanvullend: cel(r, 9)  })); }
  return out;
}
async function getOverplaatsing() {
  const data = await sheetWeergave('hr_overplaatsing'); const out = [];
  for (let i = 1; i < data.length; i++) { const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue; out.push(metMid(data, { rij: i + 1, naam: cel(r, 0), email: cel(r, 1), adres: cel(r, 2), huidigeBV: cel(r, 3), nieuweBV: cel(r, 4), datumIndienst: cel(r, 5), ingangsdatum: cel(r, 6), functie: cel(r, 7), standplaats: cel(r, 8), taal: cel(r, 9).toUpperCase() || 'NL', status: cel(r, 10), verzenddatum: cel(r, 11), ondertekend: isJa(r[12]) ? 'Ja' : 'Nee', herinnering: cel(r, 13), aantalHer: parseInt(cel(r, 14), 10) || 0, type: cel(r, 15), briefUrl: cel(r, 16)  })); }
  return out;
}
async function getOnboarding() {
  const data = await sheetWeergave('hr_onboarding'); const out = [];
  for (let i = 1; i < data.length; i++) { const r = data[i]; if (!cel(r, 0) && !cel(r, 1) && !cel(r, 2)) continue; out.push(metMid(data, { rij: i + 1, naam: (cel(r, 0) + ' ' + cel(r, 1)).trim(), email: cel(r, 2), taal: cel(r, 3).toUpperCase() || 'NL', status: cel(r, 4), verzenddatum: cel(r, 5), locatie: cel(r, 8)  })); }
  return out;
}
async function getExtraTabs() { return []; }
async function getBrieven() {
  const data = await sheetWeergave('hr_brieven'); const out = [];
  for (let i = 1; i < data.length; i++) { const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue; out.push(metMid(data, { rij: i + 1, naam: cel(r, 0), email: cel(r, 1), bv: cel(r, 2), categorie: cel(r, 3), onderwerp: cel(r, 4), tekst: String((r && r[5]) || ''), pdf: cel(r, 6) === 'Ja' ? 'Ja' : 'Nee', verzenddatum: cel(r, 7), status: cel(r, 8)  })); }
  return out.reverse();
}
async function leesTab(id, tabNaam, mapper) {
  const t = T.tabelVoor(id, tabNaam); if (!t) return [];
  const data = await sheetWeergave(t); const out = [];
  for (let i = 1; i < data.length; i++) { const r = data[i]; if (!cel(r, 0) && !cel(r, 1)) continue; out.push(metMid(data, mapper(r, i + 1))); }
  return out.reverse();
}
// Rij schrijven (logRij in sheets.js): nieuwe rij, of bij bestaandeRij alleen status + verzenddatum (statusKol 1-based)
async function logRij(id, tabNaam, kop, waarden, bestaandeRij, statusKol, statusTekst, stempelTekst) {
  const tabel = tabelOf(id, tabNaam);
  let rij = parseInt(bestaandeRij, 10) || 0;
  if (!rij) return nieuweRij(tabel, waarden);
  await zetCel(id, tabNaam, rij, statusKol, statusTekst);
  await zetCel(id, tabNaam, rij, statusKol + 1, stempelTekst);
  return rij;
}

// ---- Loggers ----------------------------------------------------------------
async function logBrief(b, stempelTekst) {
  return nieuweRij('hr_brieven', [b.naam, b.email, b.bv || '', b.categorie, b.onderwerp, String(b.tekst || ''), b.metPdf ? 'Ja' : 'Nee', stempelTekst, 'Verstuurd']);
}
async function logSommatie(p, stempelTekst, kleurHex, statusTekst) {
  return nieuweRij('hr_sommatie', [p.naam, p.email, p.bv || '', p.type, p.datumAfwezig || '', p.datumAfspraak || '', stempelTekst, statusTekst || 'Verstuurd', '', String(p.eigenTekst || '').trim()]);
}
async function logOverplaatsing(p, huidig, nieuw, isStandpl, stempelTekst) {
  const w = 'Verstuurd op ' + stempelTekst;
  let rij = parseInt(p.rij, 10) || 0;
  if (!rij) return nieuweRij('hr_overplaatsing', [p.naam, p.to, p.adres || '', huidig.bv, nieuw.bv, p.datumIndienst || '', p.ingangsdatum || '', p.functie || '', nieuw.naam, p.taal || 'NL', w, stempelTekst, '', '', '', isStandpl ? 'Standplaatswijziging' : 'Overplaatsing']);
  const { error } = await db().from('hr_overplaatsing').update({ status: w, verzenddatum: stempelTekst }).eq('rij', rij);
  if (error) fout(error, 'hr_overplaatsing rij ' + rij);
  return rij;
}
async function getWaarschuwingen() {
  return leesTab(SHEETS.ontslag.id, TAB_WAARSCHUWINGEN, (r, rij) => ({ rij, naam: cel(r, 0), email: cel(r, 1), adres: cel(r, 2), winkel: cel(r, 3), bv: cel(r, 4), datumOvertreding: cel(r, 5), regels: cel(r, 6), toelichting: cel(r, 7), taal: cel(r, 8) || 'NL', status: cel(r, 9), verzenddatum: cel(r, 10) }));
}
async function logWaarschuwing(p, w, regelTeksten, stempelTekst) {
  const status = 'Verstuurd op ' + stempelTekst;
  return logRij(SHEETS.ontslag.id, TAB_WAARSCHUWINGEN, null, [p.naam, p.to, p.adres || '', w.naam, w.bv, p.datumOvertreding || '', regelTeksten.join(' | '), p.toelichting || '', p.taal || 'NL', status, stempelTekst], p.rij, 10, status, stempelTekst);
}
async function getBeschikbaarheid() {
  return leesTab(SHEETS.ontslag.id, TAB_BESCHIKBAARHEID, (r, rij) => ({ rij, naam: cel(r, 0), email: cel(r, 1), adres: cel(r, 2), winkel: cel(r, 3), bv: cel(r, 4), ingangsdatum: cel(r, 5), taal: cel(r, 6) || 'NL', onderbouwing: cel(r, 7), status: cel(r, 8), verzenddatum: cel(r, 9) }));
}
async function logBeschikbaarheid(p, w, stempelTekst) {
  const status = 'Verstuurd op ' + stempelTekst;
  return logRij(SHEETS.ontslag.id, TAB_BESCHIKBAARHEID, null, [p.naam, p.to, p.adres || '', w.naam, w.bv, p.ingangsdatum || '', p.taal || 'NL', p.onderbouwing || '', status, stempelTekst], p.rij, 9, status, stempelTekst);
}
async function getKorting() {
  return leesTab(SHEETS.loonheffing.id, TAB_KORTING, (r, rij) => ({ rij, naam: cel(r, 0), email: cel(r, 1), keuze: cel(r, 2), ingangsdatum: cel(r, 3), deadline: cel(r, 4), taal: (cel(r, 5) || 'NL').toUpperCase(), status: cel(r, 6), verzenddatum: cel(r, 7), retour: cel(r, 8) === 'Ja' ? 'Ja' : 'Nee', docUrl: cel(r, 9), herinnering: cel(r, 10), aantalHer: parseInt(cel(r, 11), 10) || 0, salaris: cel(r, 12) }));
}
// Oude Forms-uploads koppelen op tijdstempel (alleen NA de verzenddatum); nieuwe uploads komen via /api/upload binnen
async function syncKortingUploads(droog) {
  const rijen = (await getKorting()).filter(r => r.naam && r.retour !== 'Ja' && r.verzenddatum);
  if (!rijen.length) return [];
  const parseTs = s => { const m = String(s || '').match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/); return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null; };
  const uploads = (await formReacties('loon')).filter(f => f.loon_url).map(f => ({ ts: parseTs(f.tijdstempel), naam: normNaam(f.naam), email: String(f.email || '').toLowerCase(), url: toDownloadUrl(f.loon_url) }));
  const gevonden = [];
  for (const r of rijen) {
    const verz = parseTs(r.verzenddatum); if (!verz) continue;
    const em = r.email.toLowerCase(), nn = normNaam(r.naam);
    let hit = null;
    for (const up of uploads) { if (!up.ts || up.ts < verz) continue; if ((em && up.email === em) || (nn && up.naam === nn)) { if (!hit || up.ts > hit.ts) hit = up; } }
    if (!hit) continue;
    gevonden.push({ rij: r.rij, naam: r.naam, url: hit.url });
    if (!droog) { const { error } = await db().from('hr_korting').update({ retour: 'Ja', document: hit.url }).eq('rij', r.rij); if (error) fout(error, 'hr_korting rij ' + r.rij); }
  }
  return gevonden;
}
async function logKorting(p, stempelTekst) {
  const w = 'Verstuurd op ' + stempelTekst, taal = String(p.taal || 'NL').toUpperCase();
  const arr = [p.naam, p.email, p.keuze || '', p.ingangsdatum || '', p.deadline || '', taal, w, stempelTekst, '', '', '', '0', ''];
  let rij = parseInt(p.rij, 10) || 0;
  if (!rij) return nieuweRij('hr_korting', arr);
  await upsert('hr_korting', Object.assign({ rij }, naarRecord('hr_korting', arr))); // dossier weer open (I..M leeg)
  return rij;
}
async function zetSalarisStempel(type, rij, stempelTekst) {
  if (type === 'loonheffing') return zetCel(SHEETS.loonheffing.id, null, rij, C.SALARIS_LOON_KOL, stempelTekst);
  if (type === 'ontslag') return zetCel(SHEETS.ontslag.id, null, rij, C.SALARIS_ONTSLAG_KOL, stempelTekst);
  if (type === 'korting') return zetCel(SHEETS.loonheffing.id, TAB_KORTING, rij, 13, stempelTekst);
  throw new Error('Onbekend type: ' + type);
}
// Fase 2d: aanbod vaste arbeidsomvang (hr_oproepaanbod)
async function getOproepaanbod() {
  return leesTab(SHEETS.ontslag.id, 'Oproepaanbod', (r, rij) => ({ rij, naam: cel(r, 0), email: cel(r, 1), adres: cel(r, 2), winkel: cel(r, 3), bv: cel(r, 4), sinds: cel(r, 5), gemUren: cel(r, 6), aangebodenUren: cel(r, 7), ingangsdatum: cel(r, 8), reactiedatum: cel(r, 9), taal: cel(r, 10) || 'NL', status: cel(r, 11), verzenddatum: cel(r, 12), reactie: cel(r, 13), reactieDatum: cel(r, 14), docUrl: cel(r, 15) }));
}
async function logOproepaanbod(p, w, stempelTekst) {
  return nieuweRij('hr_oproepaanbod', [p.naam, p.to, p.adres || '', w.naam, w.bv, p.sinds || '', String(p.gemUren || ''), String(p.aangebodenUren || ''), p.ingangsdatum || '', p.reactiedatum || '', p.taal || 'NL', 'Verstuurd op ' + stempelTekst, stempelTekst, '', '', '']);
}
async function zetOproepReactie(rij, reactie, door) {
  const { error } = await db().from('hr_oproepaanbod').update({ reactie, reactie_datum: stempelNu() + (door ? ' (' + door + ')' : '') }).eq('rij', rij);
  if (error) fout(error, 'hr_oproepaanbod rij ' + rij);
}
async function getNotities() {
  return leesTab(SHEETS.loonheffing.id, TAB_NOTITIES, (r, rij) => ({ rij, naam: cel(r, 0), email: cel(r, 1), datum: cel(r, 2), auteur: cel(r, 3), tekst: String((r && r[4]) || '') }));
}
async function voegNotitieToe(naam, email, auteur, tekst, stempelTekst) {
  return nieuweRij('hr_notities', [naam, email || '', stempelTekst, auteur, tekst]);
}

// ---- Fase 1: medewerker_id koppelen (backfill) -------------------------------
// Alle rijen zonder medewerker_id in alle tabellen matchen op e-mail, daarna op genormaliseerde naam,
// tegen de Shiftbase-lijst. Idempotent; geeft per tabel het aantal gekoppelde rijen terug.
async function koppelMedewerkers(medewerkers) {
  const byEmail = {}, byNaam = {};
  for (const m of medewerkers || []) { const e = String(m.email || '').trim().toLowerCase(); if (e && !byEmail[e]) byEmail[e] = m.id; const n = normNaam(m.naam); if (n && !byNaam[n]) byNaam[n] = m.id; }
  const uit = {};
  for (const tabel of Object.keys(T.TABELLEN)) {
    // '*' en niet een vaste kolomlijst: hr_onboarding heeft voornaam/achternaam i.p.v. naam
    const { data, error } = await db().from(tabel).select('*').is('medewerker_id', null).limit(5000);
    if (error) { uit[tabel] = 'fout: ' + error.message; continue; }
    let n = 0;
    for (const r of data || []) {
      const e = String(r.email || '').trim().toLowerCase();
      const naam = r.naam != null ? r.naam : ((r.voornaam || '') + ' ' + (r.achternaam || '')).trim();
      const id = (e && byEmail[e]) || byNaam[normNaam(naam)] || null;
      if (!id) continue;
      const { error: e2 } = await db().from(tabel).update({ medewerker_id: String(id) }).eq('rij', r.rij);
      if (!e2) n++;
    }
    uit[tabel] = n;
  }
  return uit;
}

async function zetUitstroomreden(rij, reden) { return zetCel(SHEETS.ontslag.id, null, rij, 17, reden || ''); }
module.exports = { zetUitstroomreden, getOproepaanbod, logOproepaanbod, zetOproepReactie, koppelMedewerkers, jwt, eersteTabNaam, getNotities, voegNotitieToe, getArchief, herstelUitArchief, leesRuw, getKorting, logKorting, syncKortingUploads, zetSalarisStempel, zorgTab, leesTab, logRij, getWaarschuwingen, logWaarschuwing, getBeschikbaarheid, logBeschikbaarheid, logSommatie, logOverplaatsing, getLoonheffing, getOntslag, getSommatie, getOverplaatsing, getOnboarding, getExtraTabs, getBrieven, logBrief, zorgBrievenTab, lees, zetCel, leesCel, archiveerRij, vergeetCache, KLEUR, vindLoonRij, eersteLegeLoonRij, vindOntslagRij, eersteLegeOntslagRij,
  // intern, voor import/export
  _intern: { alles, upsert, naarRecord, naarArr, sheetWeergave, volgendeRij } };
