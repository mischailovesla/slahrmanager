// ============================================================
// v0.35.0: digitaal indiensttredingsformulier (vervangt het Excel-bestand Indiensttredingsformulier_SLA.xlsx)
//   WINKELS                    keuzelijst: eigen winkels + HQ (uit config.WINKEL_BV_MAP, geen franchise)
//   valideer(invoer)           puur: { ok, fouten: {veld: code}, schoon }
//   maakPdf(schoon, meta)      PDF (pdf-lib) zoals het oude formulier, voor dossier en salarisadministratie
//   opslaan(tok, schoon, meta) PDF in de bucket + hr_uploads (soort 'loon', key 'indienst'), zodat het
//                              in het loonheffingsdossier en de salaris-mail verschijnt als "Indiensttreding".
//   gegevensVan(naam, email)   laatst ingevulde gegevens (zonder BSN/IBAN) voor het dossier
// Privacy: BSN en IBAN staan alleen in de PDF (afgeschermde bucket), niet in de database-gegevens of het logboek.
// ============================================================
const C = require('./config');
const { normNaam } = require('./util');

const WINKELS = Object.keys(C.WINKEL_BV_MAP).map(code => ({ code, naam: C.WINKEL_BV_MAP[code].naam === 'HQ' ? 'HQ (kantoor)' : C.WINKEL_BV_MAP[code].naam, bv: C.WINKEL_BV_MAP[code].bv }))
  .sort((a, b) => (a.code === 'HO') - (b.code === 'HO') || a.naam.localeCompare(b.naam, 'nl'));
const GESLACHT = { V: 'Vrouw', M: 'Man', X: 'Anders / zeg ik liever niet' };
const VELDEN = [ // volgorde = volgorde in de PDF
  ['vestiging', 'Bij welke vestiging kom je in dienst'], ['voornaam', 'Voornaam'], ['voorletters', 'Voorletters'], ['tussenvoegsel', 'Tussenvoegsel'], ['achternaam', 'Achternaam'],
  ['geslacht', 'Geslacht'], ['adres', 'Adres (straat + huisnummer)'], ['postcode', 'Postcode'], ['woonplaats', 'Woonplaats'], ['mobiel', 'Mobiel nummer'], ['email', 'E-mailadres'],
  ['nationaliteit', 'Nationaliteit'], ['bsn', 'BSN'], ['geboortedatum', 'Geboortedatum'], ['datumIndienst', 'Datum in dienst'], ['uren', 'Aantal uren te werken per week'],
  ['functie', 'Functie'], ['iban', 'IBAN-nummer'], ['opmerkingen', 'Eventuele opmerkingen']
];
const OPTIONEEL = ['tussenvoegsel', 'opmerkingen'];
const GEVOELIG = ['bsn', 'iban'];

const tekst = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 100);
function bsnOk(s) {
  let d = String(s || '').replace(/\D/g, ''); if (d.length === 8) d = '0' + d; if (d.length !== 9 || /^0+$/.test(d)) return '';
  let som = 0; for (let i = 0; i < 8; i++) som += (+d[i]) * (9 - i); som -= +d[8];
  return som % 11 === 0 ? d : '';
}
function ibanOk(s) {
  const i = String(s || '').replace(/[\s.-]/g, '').toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(i)) return '';
  const r = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rest = 0; for (const c of r) rest = (rest * 10 + +c) % 97;
  return rest === 1 ? i.replace(/(.{4})/g, '$1 ').trim() : '';
}
function datumOk(s) { // jjjj-mm-dd of dd-mm-jjjj → Date (lokaal, 12:00)
  let m = String(s || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), j, mn, d;
  if (m) { j = +m[1]; mn = +m[2]; d = +m[3]; } else { m = String(s || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (!m) return null; j = +m[3]; mn = +m[2]; d = +m[1]; }
  const dt = new Date(j, mn - 1, d, 12); return dt.getFullYear() === j && dt.getMonth() === mn - 1 && dt.getDate() === d ? dt : null;
}
const nl = d => String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();

// fouten-codes worden in indienst.html vertaald (NL/EN)
function valideer(inv, nu) {
  inv = inv || {}; nu = nu || new Date();
  const f = {}, s = {};
  for (const [k] of VELDEN) s[k] = tekst(inv[k], k === 'opmerkingen' ? 1000 : k === 'adres' ? 120 : 80);
  for (const [k] of VELDEN) if (!OPTIONEEL.includes(k) && !s[k]) f[k] = 'leeg';
  const w = WINKELS.find(x => x.code === s.vestiging); if (s.vestiging && !w) f.vestiging = 'ongeldig';
  if (s.geslacht && !GESLACHT[s.geslacht]) f.geslacht = 'ongeldig';
  if (s.voorletters) s.voorletters = s.voorletters.toUpperCase().replace(/[^A-Z]/g, '').split('').join('.') + '.';
  if (s.postcode && /^\d{4}\s*[a-z]{2}$/i.test(s.postcode)) s.postcode = s.postcode.replace(/^(\d{4})\s*([a-z]{2})$/i, (x, a, b) => a + ' ' + b.toUpperCase());
  if (s.mobiel) { const m = s.mobiel.replace(/[\s()-]/g, ''); if (!/^\+?\d{9,15}$/.test(m)) f.mobiel = 'ongeldig'; else s.mobiel = m; }
  if (s.email) { s.email = s.email.toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s.email)) f.email = 'ongeldig'; }
  if (s.bsn) { const b = bsnOk(s.bsn); if (!b) f.bsn = 'ongeldig'; else s.bsn = b; }
  if (s.iban) { const b = ibanOk(s.iban); if (!b) f.iban = 'ongeldig'; else s.iban = b; }
  if (s.geboortedatum) { const d = datumOk(s.geboortedatum), lft = d ? (nu - d) / (365.25 * 864e5) : 0; if (!d) f.geboortedatum = 'ongeldig'; else if (lft < 13 || lft > 80) f.geboortedatum = 'leeftijd'; else s.geboortedatum = nl(d); }
  if (s.datumIndienst) { const d = datumOk(s.datumIndienst), dg = d ? (d - nu) / 864e5 : 0; if (!d) f.datumIndienst = 'ongeldig'; else if (dg < -120 || dg > 365) f.datumIndienst = 'bereik'; else s.datumIndienst = nl(d); }
  if (s.uren !== '') { const u = Number(String(s.uren).replace(',', '.')); if (!isFinite(u) || u < 0 || u > 48) f.uren = 'ongeldig'; else s.uren = String(u); }
  return { ok: !Object.keys(f).length, fouten: f, schoon: s, winkel: w || null };
}
function weergave(k, s, winkel) {
  if (k === 'vestiging') return winkel ? winkel.naam + ' (' + winkel.bv + ')' : s.vestiging;
  if (k === 'geslacht') return GESLACHT[s.geslacht] || s.geslacht;
  if (k === 'uren') return s.uren === '0' ? '0 (oproepcontract)' : s.uren;
  return s[k] || '';
}
const volledigeNaam = s => [s.voornaam, s.tussenvoegsel, s.achternaam].filter(Boolean).join(' ');

async function maakPdf(s, meta) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const { veilig, wrap } = require('./pdf');
  const winkel = WINKELS.find(x => x.code === s.vestiging);
  const doc = await PDFDocument.create(), p = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica), vet = await doc.embedFont(StandardFonts.HelveticaBold);
  const groen = rgb(0, 0.624, 0.294), donker = rgb(0.2, 0.24, 0.227), grijs = rgb(0.53, 0.5, 0.47), lijn = rgb(0.85, 0.82, 0.8);
  doc.setTitle('Indiensttredingsformulier ' + veilig(volledigeNaam(s))); doc.setAuthor('SLA HR');
  let y = 790;
  p.drawText('SLA', { x: 50, y, size: 26, font: vet, color: groen }); p.drawText('the good food bar', { x: 50, y: y - 14, size: 9, font, color: grijs });
  y -= 52; p.drawText('INDIENSTTREDINGSFORMULIER', { x: 50, y, size: 16, font: vet, color: donker }); y -= 26;
  const kol = 250, br = 545 - kol;
  for (const [k, label] of VELDEN) {
    const regels = wrap(font, 10, veilig(weergave(k, s, winkel) || '-'), br - 10);
    const h = Math.max(1, regels.length) * 13 + 8;
    p.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.6, color: lijn });
    p.drawText(veilig(label), { x: 54, y: y - 15, size: 10, font: vet, color: donker });
    regels.forEach((r, i) => p.drawText(r, { x: kol, y: y - 15 - i * 13, size: 10, font, color: donker }));
    y -= h;
  }
  p.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.6, color: lijn });
  const stempel = (meta && meta.tijd ? new Date(meta.tijd) : new Date()).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  p.drawText(veilig('Digitaal ingevuld en verstuurd door de medewerker via de HR-omgeving van SLA op ' + stempel + '.'), { x: 50, y: y - 24, size: 8.5, font, color: grijs });
  p.drawText(veilig('Vertrouwelijk: bevat persoonsgegevens (BSN, IBAN). Alleen voor HR en salarisadministratie.'), { x: 50, y: y - 36, size: 8.5, font, color: grijs });
  return await doc.save();
}

const slug = s => normNaam(s).replace(/\s+/g, '_').slice(0, 40) || 'medewerker';
// Gegevens die in de database mogen (geen BSN/IBAN)
function zonderGevoelig(s, winkel) {
  const o = {}; for (const [k] of VELDEN) if (!GEVOELIG.includes(k)) o[k] = s[k] || '';
  if (winkel) { o.vestigingNaam = winkel.naam; o.bv = winkel.bv; }
  return o;
}
async function opslaan(tok, s, meta) {
  const U = require('./uploads'), db = require('./auth').admin();
  const winkel = WINKELS.find(x => x.code === s.vestiging), tijd = new Date().toISOString();
  const bytes = await maakPdf(s, { tijd });
  const bestandsnaam = 'Indiensttredingsformulier_' + (volledigeNaam(s) || tok.n).replace(/[^\w\-]+/g, '_') + '.pdf';
  const pad = 'loon/' + slug(tok.n) + '/' + Date.now() + '_indienst_' + bestandsnaam;
  const { error: e1 } = await db.storage.from(U.BUCKET).upload(pad, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false });
  if (e1) throw new Error('Opslaan mislukt: ' + e1.message);
  const bestand = { key: 'indienst', label: 'Indiensttredingsformulier', pad, naam_orig: bestandsnaam, bytes: bytes.length, mime: 'application/pdf', bron: 'webformulier', gegevens: zonderGevoelig(s, winkel) };
  const { data, error } = await db.from('hr_uploads').insert({ soort: 'loon', naam: tok.n, email: s.email || null, bestanden: [bestand], ip: (meta && meta.ip) || null }).select('id').single();
  if (error) throw new Error('hr_uploads: ' + error.message);
  return { id: data.id, ref: 'sb:' + data.id + ':indienst', bestandsnaam, winkel };
}
async function gegevensVan(naam, email) {
  const db = require('./auth').admin(), nn = normNaam(naam), em = String(email || '').toLowerCase();
  const { data } = await db.from('hr_uploads').select('id,naam,email,bestanden,created_at').eq('soort', 'loon').order('created_at', { ascending: false }).limit(500);
  for (const u of data || []) {
    if (!((em && String(u.email || '').toLowerCase() === em) || (nn && normNaam(u.naam) === nn))) continue;
    const b = (u.bestanden || []).find(x => x.key === 'indienst' && x.gegevens); if (b) return Object.assign({ ref: 'sb:' + u.id + ':indienst', ingevuld: u.created_at }, b.gegevens);
  }
  return null;
}
// Voorinvullen op basis van Shiftbase (vestiging, start, functie) — best effort
async function voorinvullen(naam) {
  const delen = String(naam || '').trim().split(/\s+/), uit = { voornaam: delen[0] || '', achternaam: delen.slice(1).join(' ') };
  try {
    const m = (await require('./shiftbase').getMedewerkers(false)).find(x => normNaam(x.naam) === normNaam(naam));
    if (m) {
      const w = WINKELS.find(x => x.code === m.winkelCode || x.naam === m.winkelNaam); if (w) uit.vestiging = w.code;
      const d = datumOk(m.indienst); if (d) uit.datumIndienst = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (m.email) uit.email = m.email; if (m.functie) uit.functie = m.functie;
    }
  } catch (e) { /* Shiftbase niet bereikbaar: gewoon leeg */ }
  return uit;
}
const link = naam => require('./uploads').site() + '/indienst.html' + (naam ? '?t=' + require('./uploads').maakToken('loon', naam) : '');

module.exports = { WINKELS, GESLACHT, VELDEN, OPTIONEEL, valideer, bsnOk, ibanOk, maakPdf, opslaan, gegevensVan, voorinvullen, zonderGevoelig, link };
