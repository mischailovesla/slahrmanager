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
const NAT = require('./nationaliteiten');

const WINKELS = Object.keys(C.WINKEL_BV_MAP).map(code => ({ code, naam: C.WINKEL_BV_MAP[code].naam === 'HQ' ? 'HQ (kantoor)' : C.WINKEL_BV_MAP[code].naam, bv: C.WINKEL_BV_MAP[code].bv }))
  .sort((a, b) => (a.code === 'HO') - (b.code === 'HO') || a.naam.localeCompare(b.naam, 'nl'));
const GESLACHT = { V: 'Vrouw', M: 'Man', X: 'Anders / zeg ik liever niet' };
const VELDEN = [ // volgorde = volgorde in de PDF
  ['vestiging', 'Bij welke vestiging kom je in dienst'], ['voornaam', 'Voornaam'], ['voorletters', 'Voorletters'], ['tussenvoegsel', 'Tussenvoegsel'], ['achternaam', 'Achternaam'],
  ['geslacht', 'Geslacht'], ['adres', 'Adres (straat + huisnummer)'], ['postcode', 'Postcode'], ['woonplaats', 'Woonplaats'], ['mobiel', 'Mobiel nummer'], ['email', 'E-mailadres'],
  ['nationaliteit', 'Nationaliteit'], ['bsn', 'BSN'], ['geboortedatum', 'Geboortedatum'], ['datumIndienst', 'Datum in dienst'], ['uren', 'Aantal uren te werken per week'],
  ['functie', 'Functie'], ['iban', 'IBAN-nummer'], ['opmerkingen', 'Eventuele opmerkingen']
];
const OPTIONEEL = ['tussenvoegsel', 'opmerkingen', 'adres']; // v0.35.2: adres wordt samengesteld uit straat + huisnummer + toevoeging
const EXTRA = [['straat', 80], ['huisnummer', 10], ['toevoeging', 10], ['nationaliteitAnders', 60]];
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
// v0.35.2: logische controles. Codes:
//   leeg · ongeldig · leeftijd · bereik · toekomst · cijfers · voor-geboorte (start vóór 13e verjaardag)
//   voorletters (begint niet met de letter van de voornaam: alleen een fout als de medewerker het niet bevestigt, bijv. bij een roepnaam)
//   pc-onbekend / pc-woonplaats (alleen via controleerAdres, PDOK)
const ascii = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
function valideer(inv, nu) {
  inv = inv || {}; nu = nu || new Date();
  const f = {}, s = {}, bevestigd = [].concat(inv._bevestigd || []);
  for (const [k] of VELDEN) s[k] = tekst(inv[k], k === 'opmerkingen' ? 1000 : k === 'adres' ? 120 : 80);
  for (const [k, max] of EXTRA) s[k] = tekst(inv[k], max);
  // adres: straat + huisnummer (+ toevoeging); oud formaat (alleen 'adres') blijft werken
  if (s.straat || s.huisnummer) {
    if (!s.straat) f.straat = 'leeg';
    if (!s.huisnummer) f.huisnummer = 'leeg'; else if (!/^\d{1,5}$/.test(s.huisnummer)) f.huisnummer = 'ongeldig';
    s.toevoeging = s.toevoeging.replace(/^[-\s]+/, '');
    s.adres = [s.straat, s.huisnummer + (s.toevoeging ? (/^[a-z]$/i.test(s.toevoeging) ? s.toevoeging.toUpperCase() : '-' + s.toevoeging) : '')].filter(Boolean).join(' ');
  } else if (!s.adres) { f.straat = 'leeg'; f.huisnummer = 'leeg'; }
  for (const [k] of VELDEN) if (!OPTIONEEL.includes(k) && !s[k]) f[k] = 'leeg';
  const w = WINKELS.find(x => x.code === s.vestiging); if (s.vestiging && !w) f.vestiging = 'ongeldig';
  if (s.geslacht && !GESLACHT[s.geslacht]) f.geslacht = 'ongeldig';
  // namen en woonplaats: geen cijfers
  for (const k of ['voornaam', 'tussenvoegsel', 'achternaam', 'woonplaats', 'straat']) if (s[k] && (k === 'straat' ? /^\d+$/.test(s[k]) : /\d/.test(s[k]))) f[k] = 'cijfers';
  if (s.voorletters) {
    s.voorletters = ascii(s.voorletters).toUpperCase().replace(/[^A-Z]/g, '').split('').join('.') + '.';
    if (s.voorletters === '.') f.voorletters = 'ongeldig';
    else if (s.voornaam && !f.voornaam && ascii(s.voornaam).toUpperCase()[0] !== s.voorletters[0] && !bevestigd.includes('voorletters')) f.voorletters = 'voorletters';
  }
  // nationaliteit uit de keuzelijst (of 'anders' met tekst)
  if (s.nationaliteit) {
    const n = NAT.PER_CODE[s.nationaliteit];
    if (!n) { const t = NAT.NATIONALITEITEN.find(x => x.nl.toLowerCase() === s.nationaliteit.toLowerCase() || x.en.toLowerCase() === s.nationaliteit.toLowerCase() || (x.code === 'NL' && /^nederland/i.test(s.nationaliteit))); if (t) s.nationaliteit = t.code; else f.nationaliteit = 'ongeldig'; }
    if (s.nationaliteit === 'XX') { if (!s.nationaliteitAnders) f.nationaliteitAnders = 'leeg'; else if (/\d/.test(s.nationaliteitAnders)) f.nationaliteitAnders = 'cijfers'; }
  }
  if (s.postcode && /^\d{4}\s*[a-z]{2}$/i.test(s.postcode)) s.postcode = s.postcode.replace(/^(\d{4})\s*([a-z]{2})$/i, (x, a, b) => a + ' ' + b.toUpperCase());
  if (s.mobiel) { const m = s.mobiel.replace(/[\s()-]/g, ''); if (!/^\+?\d{9,15}$/.test(m) || (/^0[1-9]/.test(m) && m.length !== 10) || (/^06/.test(m) && !/^06\d{8}$/.test(m))) f.mobiel = 'ongeldig'; else s.mobiel = m; }
  if (s.email) { s.email = s.email.toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s.email)) f.email = 'ongeldig'; }
  if (s.bsn) { const b = bsnOk(s.bsn); if (!b) f.bsn = 'ongeldig'; else s.bsn = b; }
  if (s.iban) { const b = ibanOk(s.iban); if (!b) f.iban = 'ongeldig'; else s.iban = b; }
  let geb = null;
  if (s.geboortedatum) { const d = datumOk(s.geboortedatum), lft = d ? (nu - d) / (365.25 * 864e5) : 0; if (!d) f.geboortedatum = 'ongeldig'; else if (d > nu) f.geboortedatum = 'toekomst'; else if (lft < 13 || lft > 80) f.geboortedatum = 'leeftijd'; else { s.geboortedatum = nl(d); geb = d; } }
  if (s.datumIndienst) {
    const d = datumOk(s.datumIndienst), dg = d ? (d - nu) / 864e5 : 0;
    if (!d) f.datumIndienst = 'ongeldig'; else if (dg < -120 || dg > 365) f.datumIndienst = 'bereik';
    else if (geb && d < new Date(geb.getFullYear() + 13, geb.getMonth(), geb.getDate(), 12)) f.datumIndienst = 'voor-geboorte';
    else s.datumIndienst = nl(d);
  }
  if (s.uren !== '') { const u = Number(String(s.uren).replace(',', '.')); if (!isFinite(u) || u < 0 || u > 48) f.uren = 'ongeldig'; else s.uren = String(u); }
  return { ok: !Object.keys(f).length, fouten: f, schoon: s, winkel: w || null };
}
// v0.35.2: postcode ↔ huisnummer ↔ woonplaats via PDOK Locatieserver (Kadaster, gratis, geen sleutel).
// Geeft { straat, woonplaats } of null (niet gevonden) of undefined (PDOK niet bereikbaar: dan niet blokkeren).
async function zoekAdres(postcode, huisnummer) {
  const pc = String(postcode || '').replace(/\s+/g, '').toUpperCase(); if (!/^\d{4}[A-Z]{2}$/.test(pc)) return null;
  const q = 'postcode:' + pc + (huisnummer ? ' and huisnummer:' + String(huisnummer).replace(/\D/g, '') : '');
  const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fl=straatnaam,woonplaatsnaam,postcode&fq=type:' + (huisnummer ? 'adres' : 'postcode') + '&q=' + encodeURIComponent(q);
  try {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(url, { signal: ac.signal }); clearTimeout(tm);
    if (!r.ok) return undefined;
    const d = (((await r.json()) || {}).response || {}).docs || [];
    if (!d.length) {
      if (!huisnummer) return null;
      const alleenPc = await zoekAdres(pc, ''); // postcode bestaat wel, huisnummer niet?
      return alleenPc === undefined ? undefined : alleenPc ? { geenNummer: true, woonplaats: alleenPc.woonplaats } : null;
    }
    return { straat: d[0].straatnaam || '', woonplaats: d[0].woonplaatsnaam || '' };
  } catch (e) { return undefined; }
}
// Op de server, vóór opslaan: Nederlandse postcode moet bestaan en bij de woonplaats horen. Corrigeert spelling naar de officiële naam.
async function controleerAdres(s, zoek) {
  zoek = zoek || zoekAdres;
  if (!/^\d{4} [A-Z]{2}$/.test(s.postcode || '')) return {}; // buitenlands adres: geen controle (HR ziet het in de controle)
  const a = await zoek(s.postcode, s.huisnummer || '');
  if (a === undefined) return {};
  if (a === null) return { postcode: 'pc-onbekend' };
  if (a.geenNummer) return { huisnummer: 'pc-huisnummer' };
  // spelling, accenten en de gangbare namen ('Den Haag' = 's-Gravenhage, 'Den Bosch' = 's-Hertogenbosch) tellen als gelijk
  const ALIAS = { denhaag: 'sgravenhage', thehague: 'sgravenhage', denbosch: 'shertogenbosch' };
  const n = x => { const k = ascii(x).toLowerCase().replace(/[^a-z]/g, ''); return ALIAS[k] || k; };
  if (a.woonplaats && n(a.woonplaats) !== n(s.woonplaats)) return { woonplaats: 'pc-woonplaats', _suggestie: a.woonplaats };
  if (a.straat && s.straat && n(a.straat) === n(s.straat) && a.straat !== s.straat) { s.adres = String(s.adres || '').replace(s.straat, a.straat); s.straat = a.straat; }
  if (a.woonplaats && ascii(a.woonplaats).toLowerCase().replace(/[^a-z]/g, '') === ascii(s.woonplaats).toLowerCase().replace(/[^a-z]/g, '')) s.woonplaats = a.woonplaats; // alleen spelling rechtzetten, 'Den Haag' blijft 'Den Haag'
  return {};
}
// BSN als onomkeerbare vingerafdruk (HMAC met een geheime sleutel op de server) — alleen om dubbele BSN's te vinden
function bsnHash(bsn) {
  const basis = process.env.UPLOAD_SECRET || process.env.SUPABASE_SERVICE_KEY; if (!basis || !bsn) return '';
  const crypto = require('crypto'), k = crypto.createHash('sha256').update('hr-bsn|' + basis).digest();
  return crypto.createHmac('sha256', k).update(String(bsn)).digest('hex').slice(0, 32);
}
function weergave(k, s, winkel) {
  if (k === 'vestiging') return winkel ? winkel.naam + ' (' + winkel.bv + ')' : s.vestiging;
  if (k === 'geslacht') return GESLACHT[s.geslacht] || s.geslacht;
  if (k === 'uren') return s.uren === '0' ? '0 (oproepcontract)' : s.uren;
  if (k === 'nationaliteit') { const n = NAT.PER_CODE[s.nationaliteit]; return n ? (n.code === 'XX' ? s.nationaliteitAnders : n.nl) : s.nationaliteit; }
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
  for (const [k] of EXTRA) o[k] = s[k] || '';
  if (winkel) { o.vestigingNaam = winkel.naam; o.bv = winkel.bv; }
  // v0.35.2: voor de controles, zonder het BSN/IBAN zelf
  const n = NAT.PER_CODE[s.nationaliteit]; o.nationaliteitNaam = weergave('nationaliteit', s); o.euer = n ? n.euer : false;
  o.ibanLand = String(s.iban || '').slice(0, 2); o.bsnHash = bsnHash(s.bsn);
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
  try { if (await retourVoor(tok.n)) await zetRetour(tok.n, null, 'medewerker (nieuw formulier)'); } catch (e) { /* vervalt ook vanzelf via ref */ }
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

// ---- v0.35.1: retour sturen ---------------------------------------------------------------
// HR keurt een ingeleverd indiensttredingsformulier af (bijv. verkeerde vestiging) en stuurt het terug met een reden.
// Opslag: hr_instellingen 'indienst_retour' = { [normNaam]: { naam, email, reden, velden[], ref, op, door, herinnerd } }.
// Een retour is actief zolang het formulier in het dossier nog hetzelfde is (ref); zodra er een nieuw formulier
// binnenkomt (webformulier of upload) vervalt de retour vanzelf. Zolang hij actief is gaat er niets naar salaris.
const RETOUR_SLEUTEL = 'indienst_retour';
// Wat HR kan aanwijzen → velden in het webformulier
const RETOUR_VELDEN = {
  vestiging: { nl: 'Vestiging', en: 'Location', velden: ['vestiging'] },
  datumIndienst: { nl: 'Datum in dienst', en: 'Start date', velden: ['datumIndienst'] },
  uren: { nl: 'Uren per week', en: 'Hours per week', velden: ['uren'] },
  functie: { nl: 'Functie', en: 'Job title', velden: ['functie'] },
  naam: { nl: 'Naam / voorletters', en: 'Name / initials', velden: ['voornaam', 'voorletters', 'tussenvoegsel', 'achternaam'] },
  geboortedatum: { nl: 'Geboortedatum', en: 'Date of birth', velden: ['geboortedatum'] },
  adres: { nl: 'Adres', en: 'Address', velden: ['postcode', 'huisnummer', 'toevoeging', 'straat', 'woonplaats'] },
  contact: { nl: 'Telefoon / e-mail', en: 'Phone / e-mail', velden: ['mobiel', 'email'] },
  bsn: { nl: 'BSN', en: 'BSN', velden: ['bsn'] },
  iban: { nl: 'IBAN', en: 'IBAN', velden: ['iban'] }
};
const lijstRetour = async () => (await require('./instellingen').lees(RETOUR_SLEUTEL, {})) || {};
// Rijen uit getLoonheffing verrijken met .indienstRetour (puur als `lijst` wordt meegegeven)
function annoteerMet(rijen, lijst) {
  for (const r of rijen || []) {
    const x = lijst[normNaam(r.naam)];
    if (x && String(x.ref || '') === String(r.docUrl2 || '')) r.indienstRetour = { reden: x.reden, velden: x.velden || [], op: x.op, door: x.door, herinnerd: x.herinnerd || 0 };
  }
  return rijen;
}
async function annoteer(rijen) { try { return annoteerMet(rijen, await lijstRetour()); } catch (e) { return rijen; } }
async function retourVoor(naam) { const x = (await lijstRetour())[normNaam(naam)]; return x || null; }
async function zetRetour(naam, waarde, door) {
  const I = require('./instellingen'); I.vergeet(RETOUR_SLEUTEL);
  const lijst = Object.assign({}, await lijstRetour()), k = normNaam(naam);
  if (waarde) lijst[k] = waarde; else delete lijst[k];
  await I.schrijf(RETOUR_SLEUTEL, lijst, door);
}
function retourMail(naam, reden, velden, isEN) {
  const T = require('./sjablonen'), e = T.esc, url = link(naam), v = String(naam || '').trim().split(/\s+/)[0] || '';
  const lbl = (velden || []).map(k => RETOUR_VELDEN[k] ? RETOUR_VELDEN[k][isEN ? 'en' : 'nl'] : '').filter(Boolean);
  const L = isEN ? { onderwerp: 'Please update your employment registration form', head: 'One small change', hoi: 'Hi ', intro: 'Thank you for sending your employment registration form! We checked it and there is one thing we need you to change before we can pass it on to payroll:', wat: 'Please check', knop: 'Update form', na: 'Your other details are already filled in. For your security you need to enter your BSN and IBAN again.', q: 'Questions? Just reply to this e-mail or contact hr@ilovesla.com.', groet: 'Warm regards,', team: 'The SLA HR team' }
    : { onderwerp: 'Wil je je indiensttredingsformulier even aanpassen?', head: 'Even een aanpassing', hoi: 'Hoi ', intro: 'Bedankt voor het insturen van je indiensttredingsformulier! We hebben het gecontroleerd en er moet nog één ding worden aangepast voordat we het aan de salarisadministratie kunnen doorgeven:', wat: 'Controleer', knop: 'Formulier aanpassen', na: 'Je andere gegevens staan al ingevuld. Je BSN en IBAN vul je voor de veiligheid opnieuw in.', q: 'Vragen? Beantwoord gewoon deze mail of mail hr@ilovesla.com.', groet: 'Hartelijke groet,', team: 'Het HR-team van SLA' };
  const P = 'font-family:Arial,sans-serif;font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 14px';
  const html = T.slaWrap(T.slaHead('#f5a623', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + P + ';font-size:16px;font-weight:700">' + L.hoi + e(v) + ',</p><p style="' + P + '">' + L.intro + '</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr><td style="padding:14px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;font-family:Arial,sans-serif;font-size:14px;color:#333d3a;line-height:1.6">' + e(reden).replace(/\n/g, '<br>') + (lbl.length ? '<br><span style="font-size:12.5px;color:#7a5c00">' + L.wat + ': <strong>' + e(lbl.join(', ')) + '</strong></span>' : '') + '</td></tr></table>'
    + '<p style="margin:0 0 16px"><a href="' + url + '" style="display:inline-block;background:#009f4b;color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">' + L.knop + ' &rarr;</a></p>'
    + '<p style="' + P + ';font-size:12.5px;color:#888078">' + L.na + '</p><p style="' + P + '">' + L.q + '</p><p style="' + P + ';margin:0">' + L.groet + '<br><strong>' + L.team + '</strong></p></td></tr>' + T.slaFoot());
  const text = L.hoi + v + ',\n\n' + L.intro + '\n\n' + reden + (lbl.length ? '\n' + L.wat + ': ' + lbl.join(', ') : '') + '\n\n' + L.knop + ':\n' + url + '\n\n' + L.na + '\n\n' + L.q + '\n\n' + L.groet + '\n' + L.team;
  return { subject: L.onderwerp, html, text };
}
// HR-actie: retour sturen (of opnieuw sturen als herinnering)
async function stuurRetour(r, p, door) {
  const reden = tekst(p.reden, 600); if (!reden) throw new Error('Geef een reden op: wat moet de medewerker aanpassen?');
  const velden = (p.velden || []).filter(k => RETOUR_VELDEN[k]);
  if (!r.docUrl2) throw new Error('Er is nog geen indiensttredingsformulier van ' + r.naam + ' om retour te sturen.');
  if (r.salaris) throw new Error('De documenten van ' + r.naam + ' zijn al naar de salarisadministratie gestuurd (' + r.salaris + '). Corrigeer het daar, of stuur na de correctie opnieuw.');
  const to = String(r.email || '').trim(); if (to.indexOf('@') < 0) throw new Error('Geen e-mailadres bekend voor ' + r.naam + '.');
  const oud = await retourVoor(r.naam), herinner = !!(oud && String(oud.ref || '') === String(r.docUrl2 || '') && p.herinner);
  const isEN = String(r.taal || '').toUpperCase() === 'EN', m = retourMail(r.naam, reden, velden, isEN), M = require('./mail');
  const resendId = await M.verstuur({ to, subject: m.subject, text: m.text, html: m.html, tags: [{ name: 'bron', value: 'loonheffing' }, { name: 'type', value: 'indienst-retour' }] });
  await zetRetour(r.naam, { naam: r.naam, email: to, reden, velden, ref: r.docUrl2, op: herinner ? oud.op : new Date().toISOString(), door, herinnerd: herinner ? (oud.herinnerd || 0) + 1 : 0 }, door);
  await M.logMail({ door, bron: 'loonheffing', type: 'indienst-retour', naar: to, naam: r.naam, onderwerp: m.subject, taal: isEN ? 'EN' : 'NL', rij: r.rij, resend_id: resendId });
  await require('./auth').logActie({ door, actie: 'mail', bron: 'loonheffing', veld: 'indienst-retour', rij: r.rij, naam: r.naam, nieuw: to, details: (herinner ? 'Herinnering retour: ' : 'Indiensttredingsformulier retour: ') + reden + (velden.length ? ' [' + velden.join(', ') + ']' : '') });
  return { bericht: (herinner ? 'Herinnering verstuurd' : 'Formulier retour gestuurd') + ' naar ' + to + '. Zodra ' + r.naam.split(' ')[0] + ' het aangepaste formulier instuurt, staat het weer klaar voor salaris.' };
}
async function trekRetourIn(r, door) {
  await zetRetour(r.naam, null, door);
  await require('./auth').logActie({ door, actie: 'wijzig', bron: 'loonheffing', veld: 'indienst-retour', rij: r.rij, naam: r.naam, nieuw: 'ingetrokken', details: 'Retour indiensttredingsformulier ingetrokken' });
  return { bericht: 'Retour ingetrokken: het formulier van ' + r.naam + ' staat weer klaar voor salaris.' };
}

// v0.35.2: veldfouten bijhouden (alleen veldnamen, geen waarden) in hr_acties, en tellen voor HR
async function logFouten(naam, velden, bron) {
  const v = [...new Set([].concat(velden || []).map(x => String(x).replace(/[^\w-]/g, '').slice(0, 30)).filter(Boolean))].slice(0, 30);
  if (!v.length) return;
  await require('./auth').logActie({ door: 'indienstformulier', actie: 'validatie', bron: 'indienst', veld: v.join(','), naam: String(naam || '').slice(0, 80), details: bron || '' });
}
async function foutStatistiek(dagen) {
  const grens = new Date(Date.now() - (dagen || 30) * 864e5).toISOString(), db = require('./auth').admin();
  const [f, ok, ret] = await Promise.all([
    db.from('hr_acties').select('veld,naam').eq('actie', 'validatie').eq('bron', 'indienst').gte('tijdstip', grens).limit(5000),
    db.from('hr_acties').select('naam').eq('actie', 'upload').eq('veld', 'indienst').like('door', 'indienstformulier:%').gte('tijdstip', grens).limit(5000),
    db.from('hr_acties').select('naam').eq('veld', 'indienst-retour').like('details', 'Indiensttredingsformulier retour:%').gte('tijdstip', grens).limit(5000)
  ]);
  const per = {}, mensen = {};
  for (const r of (f.data || [])) for (const k of String(r.veld || '').split(',')) { if (!k) continue; (mensen[k] = mensen[k] || new Set()).add(r.naam); }
  for (const k of Object.keys(mensen)) per[k] = mensen[k].size; // aantal medewerkers dat op dit veld vastliep
  return { dagen: dagen || 30, ingevuld: new Set((ok.data || []).map(x => x.naam)).size, retour: (ret.data || []).length, perVeld: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 6) };
}
module.exports = { logFouten, foutStatistiek, zoekAdres, controleerAdres, bsnHash, NAT, WINKELS, GESLACHT, VELDEN, OPTIONEEL, valideer, bsnOk, ibanOk, maakPdf, opslaan, gegevensVan, voorinvullen, zonderGevoelig, link,
  RETOUR_VELDEN, annoteer, annoteerMet, retourVoor, zetRetour, retourMail, stuurRetour, trekRetourIn };
