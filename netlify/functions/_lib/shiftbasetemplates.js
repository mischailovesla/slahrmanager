// ============================================================
// v0.34.0: Shiftbase-templates per winkel uit het HR Dashboard
// Masters: assets/shiftbase/<soort>.docx — gemaakt uit de Shiftbase-templates van Ceintuurbaan met
// scripts/shiftbase-masters.py. Daarin staan markers die per winkel worden ingevuld:
//   [[BV]] [[ADRES]] [[POSTCODE_PLAATS]] [[STANDPLAATS]] [[PLAATS]] [[VERTEGENWOORDIGER]] en één alinea "• [[HUISREGEL]]"
// De Shiftbase-velden ({first_name}, {start_date}, {hourly_wage} …) blijven letterlijk staan; die vult Shiftbase.
// Huisregels: één centrale lijst (hr_instellingen 'huisregels', anders contractmaatwerk.HUISREGELS) — ook voor Contract op maat.
// HQ (SLA Holding BV) doet niet mee: deze teksten gaan uit van de cao Horeca, 38 uur en PH&C.
// ============================================================
const fs = require('fs');
const path = require('path');
const C = require('./config');
const Z = require('./zip');

const SOORTEN = [
  { key: 'nieuw-slamaker',       groep: 'nieuw',      titel: 'Sla maker (oproep, bepaalde tijd)' },
  { key: 'nieuw-junior-sm',      groep: 'nieuw',      titel: 'Junior Store Manager (bepaalde tijd)' },
  { key: 'nieuw-sm',             groep: 'nieuw',      titel: 'Store Manager (bepaalde tijd)' },
  { key: 'verlenging-slamaker',  groep: 'verlenging', titel: 'Verlenging Sla maker' },
  { key: 'verlenging-junior-sm', groep: 'verlenging', titel: 'Verlenging Junior Store Manager' },
  { key: 'verlenging-sm',        groep: 'verlenging', titel: 'Verlenging Store Manager' },
  { key: 'onbepaald-slamaker',   groep: 'verlenging', titel: 'Sla maker voortzetten voor onbepaalde tijd' }
];
// v0.34.3: de werkgever tekent altijd namens de eigenaar (C.AFZENDER_NAAM = Jop van de Graaf), niet namens een operations manager
const STANDAARD = { vertegenwoordiger: C.AFZENDER_NAAM || 'Jop van de Graaf' };
// v0.34.2: na bundelen (esbuild) is __dirname de map van de function, niet _lib — daarom meerdere plekken proberen
const KANDIDATEN = [
  path.join(__dirname, 'assets', 'shiftbase'),
  path.join(__dirname, '_lib', 'assets', 'shiftbase'),
  path.join(process.env.LAMBDA_TASK_ROOT || '/var/task', 'netlify', 'functions', '_lib', 'assets', 'shiftbase'),
  path.join(process.cwd(), 'netlify', 'functions', '_lib', 'assets', 'shiftbase')
];
let _masterDir = null;
function masterDir() {
  if (_masterDir) return _masterDir;
  _masterDir = KANDIDATEN.find(d => { try { return fs.existsSync(path.join(d, 'nieuw-slamaker.docx')); } catch (e) { return false; } });
  if (!_masterDir) throw new Error('Shiftbase-masters niet gevonden (gezocht in: ' + KANDIDATEN.join(', ') + ')');
  return _masterDir;
}

const xmlEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isHolding = bv => /holding/i.test(String(bv || ''));

// Winkels die een eigen set templates krijgen (alles uit WINKEL_BV_MAP behalve de holding)
function winkels() {
  return Object.keys(C.WINKEL_BV_MAP).filter(k => !isHolding(C.WINKEL_BV_MAP[k].bv)).map(k => {
    const w = C.WINKEL_BV_MAP[k], d = String(w.adres || '').split(/,\s*/);
    const pp = d.slice(1).join(', '), m = pp.match(/^\d{4}\s?[A-Z]{2}\s+(.+)$/);
    return { code: k, naam: w.naam, bv: w.bv, adres: d[0] || '', postcodePlaats: pp, plaats: m ? m[1].trim() : 'Amsterdam' };
  });
}
function winkel(code) { const w = winkels().find(x => x.code === code); if (!w) throw new Error('Onbekende winkel: ' + code); return w; }
function soort(key) { const s = SOORTEN.find(x => x.key === key); if (!s) throw new Error('Onbekend template: ' + key); return s; }

async function huisregels() {
  const v = await require('./instellingen').lees('huisregels', null);
  return Array.isArray(v) && v.length ? v.map(String) : require('./contractmaatwerk').HUISREGELS.slice();
}
async function instelling() { const v = await require('./instellingen').lees('shiftbase_templates', null); return Object.assign({}, v || {}, STANDAARD); }   // vertegenwoordiger staat vast

// Puur: vult de markers in document.xml in
function vul(xml, w, opts) {
  const waarden = { BV: w.bv, ADRES: w.adres, POSTCODE_PLAATS: w.postcodePlaats, STANDPLAATS: w.plaats, PLAATS: w.plaats, VERTEGENWOORDIGER: opts.vertegenwoordiger || STANDAARD.vertegenwoordiger };
  let x = xml.replace(/\[\[(BV|ADRES|POSTCODE_PLAATS|STANDPLAATS|PLAATS|VERTEGENWOORDIGER)\]\]/g, (_, k) => xmlEsc(waarden[k]));
  const re = /<w:p[ >](?:(?!<w:p[ >]).)*?\[\[HUISREGEL\]\].*?<\/w:p>/s;
  const m = x.match(re);
  if (m) {
    const regels = (opts.huisregels || []).map(r => String(r).trim()).filter(Boolean);
    x = x.replace(re, () => regels.map(r => m[0].replace('[[HUISREGEL]]', xmlEsc(r))).join(''));
  }
  const rest = x.match(/\[\[[A-Z_]+\]\]/);
  if (rest) throw new Error('Template bevat een onbekende marker: ' + rest[0]);
  return x;
}

function master(key) { return fs.readFileSync(path.join(masterDir(), soort(key).key + '.docx')); }
const veilig = s => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
function bestandsnaam(key, w) { return veilig(w.naam + ' - ' + soort(key).titel) + '.docx'; }

// Eén docx (Buffer) voor soort × winkel
function maak(key, code, opts) {
  const w = winkel(code), delen = Z.lees(master(key));
  const doc = delen.find(d => d.naam === 'word/document.xml');
  if (!doc) throw new Error('Master ' + key + ' heeft geen word/document.xml');
  doc.data = Buffer.from(vul(doc.data.toString('utf8'), w, opts || {}), 'utf8');
  return { data: Z.schrijf(delen), bestandsnaam: bestandsnaam(key, w), winkel: w };
}

// Zip met meerdere templates: keys × codes. Mappen per winkel als er meer dan één winkel in zit.
function bundel(keys, codes, opts) {
  const perWinkel = codes.length > 1, entries = [];
  codes.forEach(code => keys.forEach(key => { const r = maak(key, code, opts); entries.push({ naam: (perWinkel ? veilig(r.winkel.naam) + '/' : '') + r.bestandsnaam, data: r.data }); }));
  return Z.schrijf(entries);
}

module.exports = { SOORTEN, STANDAARD, winkels, winkel, soort, huisregels, instelling, vul, maak, bundel, bestandsnaam };
