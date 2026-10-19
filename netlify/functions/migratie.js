// ============================================================
// /api/migratie  (alleen rol 'admin')  — stap 6: Google Sheets -> Supabase
//   GET            : status (DATA_BRON, tabellen aanwezig?, aantallen per tabel, laatste runs)
//   POST {droog:1} : droogloop — leest alle sheet-tabs, telt, vergelijkt koppen; schrijft niets
//   POST {droog:0} : echte import — upsert op rij (idempotent); archieftabs en Forms-reacties mee
// Leest altijd rechtstreeks uit de sheets (sheets.js), ongeacht DATA_BRON.
// Na de omschakeling (DATA_BRON=supabase) is importeren geblokkeerd, tenzij {forceer:1}:
// anders zou een oude sheet-stand nieuwe dashboarddata overschrijven.
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const C = require('./_lib/config');
const T = require('./_lib/tabellen');
const { vindKolommen } = require('./_lib/util');

const cel = (r, i) => String((r && r[i]) || '').trim();
const q = t => "'" + String(t).replace(/'/g, "''") + "'";

async function tabelBestaat(naam) {
  // '*' en niet 'rij': hr_migratie_log en hr_formulier_reacties hebben 'id' als sleutel
  const { error } = await admin().from(naam).select('*', { count: 'exact', head: true }).limit(1);
  return !error;
}
async function telRijen(naam, kolom) {
  const { count, error } = await admin().from(naam).select(kolom || 'rij', { count: 'exact', head: true });
  return error ? -1 : (count || 0);
}

// Sheet-tab lezen als 2D-array, hoofdtab = eerste tab
async function leesSheetTab(S, sleutel, tabNaam) {
  const id = C.SHEETS[sleutel].id;
  const tab = tabNaam || await S.eersteTabNaam(id);
  try { return { tab, data: await S.lees(id, q(tab), 1) }; }
  catch (e) { if (/tabnaam onbekend|Unable to parse range/i.test(e.message)) return { tab, data: [] }; throw e; }
}
function vindKop(data, kopLabel) {
  for (let i = 0; i < Math.min(data.length, 10); i++) if (cel(data[i], 0).toLowerCase() === String(kopLabel).toLowerCase()) return i;
  return data.length ? 0 : -1;
}

async function upsertChunks(tabel, recs) {
  for (let i = 0; i < recs.length; i += 500) {
    const { error } = await admin().from(tabel).upsert(recs.slice(i, i + 500), { onConflict: 'rij' });
    if (error) throw new Error(tabel + ': ' + error.message);
  }
}

exports.handler = beveiligd('migratie', async (event, g) => {
  if (g.rol !== 'admin') throw new Error('Alleen beheerders kunnen de migratie uitvoeren.');
  const bron = String(process.env.DATA_BRON || '').toLowerCase() === 'supabase' ? 'supabase' : 'sheets';

  if (event.httpMethod === 'GET') {
    const aanwezig = await tabelBestaat('hr_loonheffing') && await tabelBestaat('hr_migratie_log');
    const tabellen = [];
    if (aanwezig) for (const naam of Object.keys(T.TABELLEN)) tabellen.push({ tabel: naam, label: T.TABELLEN[naam].label, rijen: await telRijen(naam) });
    if (aanwezig) tabellen.push({ tabel: T.FORMULIER_TABEL, label: 'Oude Forms-reacties', rijen: await telRijen(T.FORMULIER_TABEL, 'id') });
    let runs = [];
    if (aanwezig) { const { data } = await admin().from('hr_migratie_log').select('created_at,door,droog,tabel,bron,sheet_rijen,db_rijen_voor,db_rijen_na,opmerking').order('id', { ascending: false }).limit(60); runs = data || []; }
    return { bron, migratie0006: aanwezig, tabellen, runs, sheetsBeschikbaar: !!(process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_SA_JSON_B64) };
  }

  if (event.httpMethod !== 'POST') throw new Error('Gebruik GET of POST');
  const p = body(event);
  const droog = !(p.droog === 0 || p.droog === '0' || p.droog === false);
  if (!droog && bron === 'supabase' && !p.forceer) throw new Error('DATA_BRON staat al op supabase: importeren zou nieuwe dashboarddata overschrijven. Alleen met forceer:1.');
  if (!(await tabelBestaat('hr_migratie_log'))) throw new Error('Migratie 0006 is nog niet gedraaid in Supabase (supabase/migrations/0006_sheets_naar_supabase.sql).');
  const S = require('./_lib/sheets-google'); // altijd de echte sheets, ongeacht DATA_BRON
  const rap = { droog, door: g.email, tabellen: [], fouten: [], gestart: new Date().toISOString() };
  const logRegel = async r => { try { await admin().from('hr_migratie_log').insert(Object.assign({ door: g.email, droog }, r)); } catch (e) { /* log is niet kritisch */ } };

  // 1. Alle registertabellen (hoofdtabs + logtabs)
  for (const [tabel, d] of Object.entries(T.TABELLEN)) {
    const item = { tabel, label: d.label, bron: d.sheet + ' / ' + (d.tab || 'hoofdtab'), sheetRijen: 0, dbVoor: await telRijen(tabel), dbNa: null, koppenSheet: [], koppenAfwijkend: [], archiefRijen: 0, opmerking: '' };
    try {
      const { tab, data } = await leesSheetTab(S, d.sheet, d.tab);
      item.bron = d.sheet + ' / ' + tab;
      const h = vindKop(data, d.kopLabel);
      if (h === -1) { item.opmerking = 'tab leeg of niet gevonden'; rap.tabellen.push(item); await logRegel({ tabel, bron: item.bron, sheet_rijen: 0, db_rijen_voor: item.dbVoor, db_rijen_na: item.dbVoor, opmerking: item.opmerking }); continue; }
      item.koppenSheet = (data[h] || []).map(x => String(x || ''));
      const verwacht = T.koppen(tabel);
      verwacht.forEach((k, i) => { const s = (item.koppenSheet[i] || '').trim().toLowerCase(); if (s && s !== k.toLowerCase() && !/^[a-z]$/.test(k.toLowerCase())) item.koppenAfwijkend.push(String.fromCharCode(65 + i) + ': sheet "' + item.koppenSheet[i] + '" ≠ "' + k + '"'); });
      if (item.koppenSheet.length > verwacht.length) item.opmerking += 'sheet heeft ' + (item.koppenSheet.length - verwacht.length) + ' extra kolom(men), die gaan naar "extra". ';
      const recs = [];
      for (let i = h + 1; i < data.length; i++) {
        const r = data[i] || [];
        if (!cel(r, 0) && !cel(r, 1) && !(d.sheet === 'onboarding' && cel(r, 2))) continue;
        const rec = Object.assign({ rij: i + 1 }, naarRecord(tabel, r));
        recs.push(rec);
      }
      item.sheetRijen = recs.length;
      // Archief-tab van dezelfde sheet (alleen hoofdtabellen): rijen erachter plakken met gearchiveerd_*
      let archRecs = [];
      if (d.archief) {
        const arch = await leesSheetTab(S, d.sheet, C.TAB_ARCHIEF);
        if (arch.data.length > 1) {
          if (!droog) { // idempotent: eerder geïmporteerde archiefrijen eerst weg, zodat de nummering niet opschuift
            const { error } = await admin().from(tabel).delete().not('gearchiveerd_op', 'is', null).eq('geimporteerd', true);
            if (error) throw new Error(tabel + ' archief opschonen: ' + error.message);
          }
          let volgend = recs.reduce((m, r) => Math.max(m, r.rij), 1) + 1;
          const dbMax = await maxRij(tabel);
          if (dbMax >= volgend) volgend = dbMax + 1;
          for (let i = 1; i < arch.data.length; i++) {
            const r = arch.data[i] || []; if (!cel(r, 3) && !cel(r, 4)) continue;
            const rec = Object.assign({ rij: volgend++ }, naarRecord(tabel, r.slice(3)), { gearchiveerd_op: cel(r, 0) || '0000-00-00 00:00', gearchiveerd_door: cel(r, 1), gearchiveerd_bron: cel(r, 2) || d.label });
            archRecs.push(rec);
          }
        }
        item.archiefRijen = archRecs.length;
      }
      if (!droog) {
        await upsertChunks(tabel, recs.map(r => Object.assign({ geimporteerd: true }, r)));
        if (archRecs.length) await upsertChunks(tabel, archRecs.map(r => Object.assign({ geimporteerd: true }, r)));
        item.dbNa = await telRijen(tabel);
      } else item.dbNa = item.dbVoor;
    } catch (e) { item.opmerking += 'FOUT: ' + e.message; rap.fouten.push(d.label + ': ' + e.message); }
    rap.tabellen.push(item);
    await logRegel({ tabel, bron: item.bron, sheet_rijen: item.sheetRijen + item.archiefRijen, db_rijen_voor: item.dbVoor, db_rijen_na: item.dbNa == null ? item.dbVoor : item.dbNa, koppen: item.koppenSheet, opmerking: (item.koppenAfwijkend.join('; ') + ' ' + item.opmerking).trim() || null });
  }

  // 2. Oude Google-Forms-reacties (responses-tabs) -> hr_formulier_reacties
  for (const soort of ['loon', 'ontslag']) {
    const sleutel = soort === 'loon' ? 'loonheffing' : 'ontslag';
    const item = { tabel: T.FORMULIER_TABEL + ' (' + soort + ')', label: 'Forms-reacties ' + soort, bron: sleutel + ' / responses-tab', sheetRijen: 0, dbVoor: 0, dbNa: null, koppenSheet: [], koppenAfwijkend: [], archiefRijen: 0, opmerking: '' };
    try {
      const { count } = await admin().from(T.FORMULIER_TABEL).select('id', { count: 'exact', head: true }).eq('soort', soort); item.dbVoor = count || 0;
      const id = C.SHEETS[sleutel].id;
      const tabs = await tabNamenVia(S, id);
      const t = tabs.find(x => String(x.sheetId) === String(C.SHEETS[sleutel].responsesGid));
      if (!t) { item.opmerking = 'responses-tab (gid ' + C.SHEETS[sleutel].responsesGid + ') niet gevonden'; rap.tabellen.push(item); continue; }
      const data = await S.lees(id, q(t.title), 1);
      item.bron = sleutel + ' / ' + t.title;
      item.koppenSheet = (data[0] || []).map(x => String(x || ''));
      const kol = soort === 'loon'
        ? vindKolommen(data[0], { ts: ['tijdstempel', 'timestamp'], naam: ['naam'], email: ['mail'], loon: ['loonbelast'], indienst: ['indienst'] })
        : vindKolommen(data[0], { ts: ['tijdstempel', 'timestamp'], naam: ['naam'], email: ['mail'], doc: ['upload', 'column 2'] });
      if (kol.ts === -1) kol.ts = 0;
      if (soort === 'ontslag' && kol.doc === -1) { for (let c = 0; c < (data[0] || []).length && kol.doc === -1; c++) { if (c === kol.naam || c === kol.email) continue; for (let i = 1; i < Math.min(data.length, 50); i++) if (cel(data[i], c).indexOf('drive.google.com') > -1) { kol.doc = c; break; } } }
      const recs = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i] || [];
        const rec = { soort, rij: i + 1, tijdstempel: cel(r, kol.ts), naam: kol.naam > -1 ? cel(r, kol.naam) : '', email: kol.email > -1 ? cel(r, kol.email).toLowerCase() : '', loon_url: '', indienst_url: '', doc_url: '' };
        if (soort === 'loon') { rec.loon_url = kol.loon > -1 ? cel(r, kol.loon) : ''; rec.indienst_url = kol.indienst > -1 ? cel(r, kol.indienst) : ''; if (!rec.loon_url && !rec.indienst_url) continue; }
        else { rec.doc_url = kol.doc > -1 ? cel(r, kol.doc) : ''; if (!rec.doc_url) continue; }
        recs.push(rec);
      }
      item.sheetRijen = recs.length;
      if (!droog) {
        const { error: e1 } = await admin().from(T.FORMULIER_TABEL).delete().eq('soort', soort); if (e1) throw new Error(e1.message);
        for (let i = 0; i < recs.length; i += 500) { const { error } = await admin().from(T.FORMULIER_TABEL).insert(recs.slice(i, i + 500)); if (error) throw new Error(error.message); }
        const { count: na } = await admin().from(T.FORMULIER_TABEL).select('id', { count: 'exact', head: true }).eq('soort', soort); item.dbNa = na || 0;
      } else item.dbNa = item.dbVoor;
    } catch (e) { item.opmerking += 'FOUT: ' + e.message; rap.fouten.push('Forms ' + soort + ': ' + e.message); }
    rap.tabellen.push(item);
    await logRegel({ tabel: T.FORMULIER_TABEL, bron: item.bron, sheet_rijen: item.sheetRijen, db_rijen_voor: item.dbVoor, db_rijen_na: item.dbNa == null ? item.dbVoor : item.dbNa, koppen: item.koppenSheet, opmerking: item.opmerking || null });
  }

  rap.klaar = new Date().toISOString();
  rap.totaalSheet = rap.tabellen.reduce((n, t) => n + t.sheetRijen + (t.archiefRijen || 0), 0);
  rap.totaalDb = rap.tabellen.reduce((n, t) => n + (t.dbNa == null ? 0 : t.dbNa), 0);
  await logActie({ door: g.email, actie: droog ? 'migratie-droog' : 'migratie-import', bron: 'migratie', details: rap.totaalSheet + ' sheetrijen, ' + rap.fouten.length + ' fouten' });
  return rap;
});

function naarRecord(tabel, arr) {
  const kol = T.kolomNamen(tabel), rec = {};
  kol.forEach((k, i) => { rec[k] = arr[i] == null ? '' : String(arr[i]); });
  const extra = arr.length > kol.length ? arr.slice(kol.length).map(v => v == null ? '' : String(v)) : [];
  while (extra.length && extra[extra.length - 1] === '') extra.pop();
  if (extra.length) rec.extra = extra;
  return rec;
}
async function maxRij(tabel) {
  const { data } = await admin().from(tabel).select('rij').order('rij', { ascending: false }).limit(1);
  return data && data[0] ? Number(data[0].rij) : 1;
}
async function tabNamenVia(S, id) {
  const { token } = await S.jwt().getAccessToken();
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id) + '?fields=' + encodeURIComponent('sheets(properties(sheetId,title,index))'), { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json();
  if (!r.ok) throw new Error('Sheets API: ' + ((j.error && j.error.message) || r.status));
  return (j.sheets || []).map(s => s.properties).sort((a, b) => a.index - b.index);
}
