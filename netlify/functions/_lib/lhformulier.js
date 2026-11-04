// ============================================================
// v0.44.0: digitale loonheffingsverklaring (eigen formulier met dezelfde gegevens als het
// "Model opgaaf gegevens voor de loonheffingen" van de Belastingdienst) + versiecontrole van dat model.
//   valideer(invoer, tok, nu)  puur: { ok, fouten, schoon }
//   maakPdf(schoon, meta)      PDF in de indeling van het model (rubriek 1 t/m 3) + bewijsspoor
//   opslaan(tok, schoon, meta) PDF in de bucket + hr_uploads (soort 'loon', key 'loon') → dossier, vinkje, salaris
//   voorinvullen(naam)         uit het indiensttredingsformulier (zonder BSN)
// Ondertekening: eenvoudige elektronische handtekening (art. 3:15a BW) via de persoonlijke link uit de HR-mail:
// getypte naam (moet bij het dossier passen) + akkoord + handtekening met vinger/muis; bewijsspoor in de PDF
// (tijd, IP, browser, SHA-256 van de ingevulde gegevens, modelversie).
// Modelcontrole: de pagina van de Belastingdienst (niet de PDF: die host blokkeert automatische ophaal-acties)
// noemt het PDF-bestand met de versiecode in de naam (…_lh0082z12fol.pdf = LH 008 - 2Z*12FOL).
// Privacy: het BSN staat alleen in de PDF (afgeschermde bucket); in de database alleen een HMAC-vingerafdruk.
// ============================================================
const crypto = require('crypto');
const C = require('./config');
const { normNaam, naamPast } = require('./util');

const tekst = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 100);
const ascii = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const nl = d => String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function I() { return require('./indienst'); }

const LABEL = 'Loonheffingsverklaring (model opgaaf gegevens voor de loonheffingen)';
const MAX_HANDTEKENING = 300 * 1024;

// ---------- validatie ----------
function leesHandtekening(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/); if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 800 || buf.length > MAX_HANDTEKENING) return null; // lege of te grote afbeelding
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return buf;
}
function valideer(inv, tok, nu) {
  inv = inv || {}; nu = nu || new Date();
  const f = {}, s = {};
  for (const [k, max] of [['voorletters', 20], ['tussenvoegsel', 20], ['achternaam', 80], ['straat', 80], ['huisnummer', 10], ['toevoeging', 10], ['postcode', 12], ['woonplaats', 60], ['landRegio', 80], ['bsn', 12], ['geboortedatum', 12], ['lhk', 4], ['lhkVanaf', 12], ['naamGetypt', 120]]) s[k] = tekst(inv[k], max);
  s.buitenland = inv.buitenland === true || inv.buitenland === 'ja';
  for (const k of ['voorletters', 'achternaam', 'straat', 'huisnummer', 'postcode', 'woonplaats', 'bsn', 'geboortedatum', 'lhk', 'naamGetypt']) if (!s[k]) f[k] = 'leeg';
  for (const k of ['tussenvoegsel', 'achternaam', 'woonplaats']) if (s[k] && /\d/.test(s[k])) f[k] = 'cijfers';
  if (s.voorletters) { s.voorletters = ascii(s.voorletters).toUpperCase().replace(/[^A-Z]/g, '').split('').join('.') + '.'; if (s.voorletters === '.') f.voorletters = 'ongeldig'; }
  if (s.straat && /^\d+$/.test(s.straat)) f.straat = 'cijfers';
  if (s.huisnummer && !/^\d{1,5}$/.test(s.huisnummer) && !s.buitenland) f.huisnummer = 'ongeldig';
  s.toevoeging = s.toevoeging.replace(/^[-\s]+/, '');
  s.adres = [s.straat, s.huisnummer + (s.toevoeging ? (/^[a-z]$/i.test(s.toevoeging) ? s.toevoeging.toUpperCase() : '-' + s.toevoeging) : '')].filter(Boolean).join(' ');
  if (s.buitenland) { if (!s.landRegio) f.landRegio = 'leeg'; else if (/\d/.test(s.landRegio)) f.landRegio = 'cijfers'; }
  else {
    s.landRegio = '';
    if (s.postcode) { if (/^\d{4}\s*[a-z]{2}$/i.test(s.postcode)) s.postcode = s.postcode.replace(/^(\d{4})\s*([a-z]{2})$/i, (x, a, b) => a + ' ' + b.toUpperCase()); else f.postcode = 'w-buitenland'; }
  }
  if (s.bsn) { const b = I().bsnOk(s.bsn); if (!b) f.bsn = 'ongeldig'; else s.bsn = b; }
  const datum = x => { const m = String(x || '').match(/^(\d{4})-(\d{2})-(\d{2})$/) || null; let d = null; if (m) d = new Date(+m[1], +m[2] - 1, +m[3], 12); else { const n = String(x || '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (n) d = new Date(+n[3], +n[2] - 1, +n[1], 12); } return d && !isNaN(d) ? d : null; };
  if (s.geboortedatum) { const d = datum(s.geboortedatum), lft = d ? (nu - d) / (365.25 * 864e5) : 0; if (!d) f.geboortedatum = 'ongeldig'; else if (d > nu) f.geboortedatum = 'toekomst'; else if (lft < 13 || lft > 80) f.geboortedatum = 'leeftijd'; else s.geboortedatum = nl(d); }
  if (s.lhk && !['ja', 'nee'].includes(s.lhk)) f.lhk = 'ongeldig';
  if (s.lhk === 'ja') {
    const d = datum(s.lhkVanaf), dg = d ? (d - nu) / 864e5 : 0;
    if (!s.lhkVanaf) f.lhkVanaf = 'leeg'; else if (!d) f.lhkVanaf = 'ongeldig'; else if (dg < -400 || dg > 366) f.lhkVanaf = 'bereik'; else s.lhkVanaf = nl(d);
  } else s.lhkVanaf = '';
  // ondertekening
  const volledig = [s.voorletters, s.tussenvoegsel, s.achternaam].filter(Boolean).join(' ');
  if (s.naamGetypt && !(naamPast(s.naamGetypt, tok && tok.n) && naamPast(s.naamGetypt, s.achternaam))) f.naamGetypt = 'naam';
  if (!(inv.akkoord === true || inv.akkoord === 'ja')) f.akkoord = 'leeg';
  const hb = leesHandtekening(inv.handtekening); if (!hb) f.handtekening = inv.handtekening ? 'ongeldig' : 'leeg';
  s.naamVoorletters = volledig;
  return { ok: !Object.keys(f).length, fouten: f, schoon: s, handtekening: hb };
}

// ---------- PDF in de indeling van het model ----------
function gegevensHash(s) {
  const kern = ['bsn', 'naamVoorletters', 'geboortedatum', 'adres', 'postcode', 'woonplaats', 'landRegio', 'lhk', 'lhkVanaf', 'naamGetypt'].map(k => k + '=' + (s[k] || '')).join('|');
  return crypto.createHash('sha256').update(kern).digest('hex');
}
async function maakPdf(s, meta) {
  meta = meta || {};
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const { veilig, wrap } = require('./pdf');
  const model = meta.model || C.LH_MODEL;
  const doc = await PDFDocument.create(), p = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica), vet = await doc.embedFont(StandardFonts.HelveticaBold);
  const zwart = rgb(0.1, 0.1, 0.1), blauw = rgb(0.08, 0.25, 0.5), grijs = rgb(0.45, 0.45, 0.45), lijn = rgb(0.75, 0.75, 0.75), vak = rgb(0.93, 0.95, 0.98);
  doc.setTitle('Opgaaf gegevens voor de loonheffingen - ' + veilig(s.naamVoorletters)); doc.setAuthor('SLA HR'); doc.setSubject('Digitaal ingevuld en ondertekend');
  const L = 50, R = 545, kol = 265;
  let y = 800;
  const t = (x, yy, txt, size, f, c) => p.drawText(veilig(txt), { x, y: yy, size, font: f || font, color: c || zwart });
  t(L, y, 'Opgaaf gegevens voor de loonheffingen', 18, vet, blauw); y -= 16;
  t(L, y, 'Digitaal ingevuld en ondertekend - zelfde gegevens als het model van de Belastingdienst', 9, font, grijs); y -= 12;
  t(L, y, 'Model: ' + model.code + (model.gewijzigd ? ' (modelpagina bijgewerkt ' + model.gewijzigd.split('-').reverse().join('-') + ')' : ''), 8, font, grijs); y -= 22;
  const intro = 'Uw werkgever heeft deze gegevens nodig om de loonheffingen goed te berekenen. Levert u dit formulier niet in, dan moet uw werkgever het anoniementarief toepassen (52%, zonder loonheffingskorting).';
  wrap(font, 9, veilig(intro), R - L).forEach(r => { t(L, y, r, 9); y -= 12; }); y -= 10;
  const rubriek = (nr, titel) => { p.drawRectangle({ x: L, y: y - 6, width: R - L, height: 20, color: vak }); t(L + 6, y, nr, 11, vet, blauw); t(L + 26, y, titel, 11, vet, blauw); y -= 26; };
  const veld = (nr, label, waarde, uitleg) => {
    const regels = wrap(font, 10, veilig(waarde || '-'), R - kol - 8), lu = uitleg ? wrap(font, 7.5, veilig(uitleg), kol - L - 40) : [];
    const h = Math.max(regels.length * 13, 13 + lu.length * 9) + 9;
    t(L + 4, y - 13, nr, 9, vet, grijs); t(L + 30, y - 13, label, 10, font);
    lu.forEach((r, i) => t(L + 30, y - 24 - i * 9, r, 7.5, font, grijs));
    p.drawRectangle({ x: kol - 4, y: y - h, width: R - kol + 4, height: h, borderColor: lijn, borderWidth: 0.7 });
    regels.forEach((r, i) => t(kol + 2, y - 13 - i * 13, r, 10, vet));
    y -= h + 6;
  };
  rubriek('1', 'Uw gegevens');
  veld('1a', 'Burgerservicenummer', s.bsn);
  veld('1b', 'Naam en voorletters', s.naamVoorletters);
  veld('1c', 'Geboortedatum', s.geboortedatum);
  veld('1d', 'Adres', s.adres);
  veld('1e', 'Postcode en woonplaats', [s.postcode, s.woonplaats].filter(Boolean).join('  '));
  veld('1f', 'Land en regio', s.landRegio || '-', 'Alleen invullen als u in het buitenland woont');
  y -= 6; rubriek('2', 'Loonheffingskorting');
  const vraag = 'Wilt u dat uw werkgever of uitkeringsinstantie rekening houdt met de loonheffingskorting?';
  wrap(font, 10, vraag, R - L - 34).forEach(r => { t(L + 30, y - 2, r, 10); y -= 13; }); y -= 4;
  const hokje = (x, yy, aan, label) => { p.drawRectangle({ x, y: yy - 2, width: 10, height: 10, borderColor: zwart, borderWidth: 0.8 }); if (aan) { p.drawLine({ start: { x: x + 2, y: yy + 3 }, end: { x: x + 4.5, y: yy }, thickness: 1.4, color: zwart }); p.drawLine({ start: { x: x + 4.5, y: yy }, end: { x: x + 9, y: yy + 7 }, thickness: 1.4, color: zwart }); } t(x + 16, yy, label, 10, aan ? vet : font); };
  t(L + 4, y + 13, '2a', 9, vet, grijs);
  hokje(L + 30, y, s.lhk === 'nee', 'Nee'); y -= 18;
  hokje(L + 30, y, s.lhk === 'ja', 'Ja, vanaf' + (s.lhk === 'ja' ? '  ' + s.lhkVanaf : '  ............')); y -= 18;
  wrap(font, 7.5, veilig('Let op: laat de loonheffingskorting maar door een werkgever of uitkeringsinstantie tegelijk toepassen. Doen meer werkgevers of uitkeringsinstanties dat, dan moet u waarschijnlijk belasting terugbetalen.'), R - L - 34).forEach(r => { t(L + 30, y, r, 7.5, font, grijs); y -= 9; });
  y -= 14; rubriek('3', 'Ondertekening');
  const tijd = meta.tijd ? new Date(meta.tijd) : new Date();
  veld('', 'Datum', tijd.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric' }));
  t(L + 30, y - 13, 'Handtekening', 10);
  const hh = 70; p.drawRectangle({ x: kol - 4, y: y - hh, width: R - kol + 4, height: hh, borderColor: lijn, borderWidth: 0.7 });
  if (meta.handtekening) { try { const img = await doc.embedPng(meta.handtekening); const sc = Math.min((R - kol - 8) / img.width, (hh - 8) / img.height); p.drawImage(img, { x: kol, y: y - hh + 4, width: img.width * sc, height: img.height * sc }); } catch (e) { t(kol + 2, y - 30, '(handtekening kon niet worden geplaatst)', 9, font, grijs); } }
  y -= hh + 12; t(kol, y, 'Getypte naam: ' + (s.naamGetypt || '-'), 8.5, font, grijs); y -= 26;
  // bewijsspoor
  p.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.6, color: lijn }); y -= 14;
  t(L, y, 'Bewijsspoor digitale ondertekening', 9, vet, grijs); y -= 12;
  const bewijs = [
    'Ondertekend via de persoonlijke link uit de HR-mail van SLA' + (meta.email ? ' (verstuurd aan ' + meta.email + ')' : '') + ', met getypte naam, akkoordverklaring en handtekening.',
    'Tijdstip: ' + tijd.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (Europe/Amsterdam)' + (meta.ip ? ' - IP ' + meta.ip : ''),
    meta.browser ? 'Browser: ' + String(meta.browser).slice(0, 140) : '',
    meta.werkgever ? 'Werkgever: ' + meta.werkgever : '',
    'SHA-256 van de ingevulde gegevens: ' + (meta.hash || gegevensHash(s)),
    'Eenvoudige elektronische handtekening (art. 3:15a BW). Kopie identiteitsbewijs: bij het contract (Shiftbase).'
  ].filter(Boolean);
  bewijs.forEach(b => wrap(font, 7.5, veilig(b), R - L).forEach(r => { t(L, y, r, 7.5, font, grijs); y -= 9.5; }));
  t(L, 28, veilig('Vertrouwelijk: bevat het BSN. Alleen voor HR en salarisadministratie. Bewaren tot 5 jaar na het jaar van uitdiensttreding.'), 7, font, grijs);
  return await doc.save();
}

// ---------- opslaan ----------
const slug = s => normNaam(s).replace(/\s+/g, '_').slice(0, 40) || 'medewerker';
async function opslaan(tok, s, meta) {
  meta = meta || {};
  const U = require('./uploads'), db = require('./auth').admin();
  const tijd = new Date().toISOString(), model = await huidigModel(), hash = gegevensHash(s);
  const ind = await I().gegevensVan(tok.n, '').catch(() => null);
  const werkgever = ind && ind.bv ? ind.bv + (ind.vestigingNaam ? ' (' + ind.vestigingNaam + ')' : '') : '';
  const bytes = await maakPdf(s, Object.assign({}, meta, { tijd, model, hash, werkgever }));
  const pdfHash = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  const bestandsnaam = 'Loonheffingsverklaring_' + (s.naamVoorletters || tok.n).replace(/[^\w\-]+/g, '_') + '.pdf';
  const pad = 'loon/' + slug(tok.n) + '/' + Date.now() + '_loon_' + bestandsnaam;
  const { error: e1 } = await db.storage.from(U.BUCKET).upload(pad, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false });
  if (e1) throw new Error('Opslaan mislukt: ' + e1.message);
  const bsnHash = I().bsnHash(s.bsn);
  const gegevens = { lhk: s.lhk, lhkVanaf: s.lhkVanaf, buitenland: s.buitenland, model: model.code, getekendOp: tijd, gegevensHash: hash, pdfHash, bsnHash,
    bsnGelijkAanIndienst: ind && ind.bsnHash ? ind.bsnHash === bsnHash : null, geboortedatum: s.geboortedatum, woonplaats: s.woonplaats };
  const bestand = { key: 'loon', label: LABEL, pad, naam_orig: bestandsnaam, bytes: bytes.length, mime: 'application/pdf', bron: 'webformulier', gegevens };
  const { data, error } = await db.from('hr_uploads').insert({ soort: 'loon', naam: tok.n, email: (ind && ind.email) || meta.email || null, bestanden: [bestand], ip: meta.ip || null }).select('id').single();
  if (error) throw new Error('hr_uploads: ' + error.message);
  const refs = { loon: 'sb:' + data.id + ':loon' };
  try { await require('./vinkje').zetVinkje(tok, refs); } catch (e) { console.warn('vinkje loonheffing:', e.message); }
  try { const S = require('./sheets'); if (S.vergeetCache) S.vergeetCache(); } catch (e) { /* */ }
  return { id: data.id, ref: refs.loon, pdfHash, gegevens };
}

// ---------- voorinvullen uit het indiensttredingsformulier (nooit het BSN) ----------
async function voorinvullen(naam) {
  const delen = String(naam || '').trim().split(/\s+/), uit = { achternaam: delen.slice(1).join(' ') };
  const g = await I().gegevensVan(naam, '').catch(() => null);
  if (g && naamPast([g.voornaam, g.tussenvoegsel, g.achternaam].filter(Boolean).join(' '), naam)) {
    Object.assign(uit, { voorletters: g.voorletters || '', tussenvoegsel: g.tussenvoegsel || '', achternaam: g.achternaam || uit.achternaam, straat: g.straat || '', huisnummer: g.huisnummer || '', toevoeging: g.toevoeging || '', postcode: g.postcode || '', woonplaats: g.woonplaats || '' });
    const m = String(g.geboortedatum || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); if (m) uit.geboortedatum = m[3] + '-' + m[2] + '-' + m[1];
    if (g.postcode && !/^\d{4} [A-Z]{2}$/.test(g.postcode)) uit.buitenland = true;
    const di = String(g.datumIndienst || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); if (di) uit.lhkVanaf = di[3] + '-' + di[2] + '-' + di[1];
    uit._uitIndienst = true;
  }
  if (!uit.lhkVanaf) uit.lhkVanaf = iso(new Date());
  return uit;
}
// Is er al een loonheffingsverklaring (upload of webformulier)?
async function alAanwezig(naam) {
  const { data } = await require('./auth').admin().from('hr_uploads').select('naam,bestanden,created_at').eq('soort', 'loon').order('created_at', { ascending: false }).limit(1000);
  for (const u of data || []) if (normNaam(u.naam) === normNaam(naam)) { const b = (u.bestanden || []).find(x => x.key === 'loon'); if (b) return { op: u.created_at, web: b.bron === 'webformulier' }; }
  return null;
}
const link = naam => require('./uploads').site() + '/loonheffing.html' + (naam ? '?t=' + require('./uploads').maakToken('loon', naam) : '');

// ---------- versiecontrole van het model ----------
function codeUitBestand(b) {
  const m = /lh(\d{3})(\d)z(\d+)([a-z]*)\.pdf$/i.exec(String(b || '')); if (!m) return '';
  return 'LH ' + m[1] + ' - ' + m[2] + 'Z*' + m[3] + m[4].toUpperCase();
}
function parseModelPagina(html) {
  html = String(html || '');
  const h = html.match(/href="([^"]*model_opgaaf_gegevens[^"]*\.pdf)"/i) || html.match(/href='([^']*model_opgaaf_gegevens[^']*\.pdf)'/i);
  if (!h) return null;
  const url = h[1].replace(/&amp;/g, '&'), bestand = url.split('/').pop().split('?')[0].toLowerCase();
  const mod = html.match(/name="DCTERMS\.modified"[^>]*content="([^"]+)"/i) || html.match(/content="([^"]+)"[^>]*name="DCTERMS\.modified"/i);
  return { url: /^https?:/i.test(url) ? url : 'https://www.belastingdienst.nl' + url, bestand, code: codeUitBestand(bestand) || bestand, gewijzigd: mod ? mod[1].slice(0, 10) : '' };
}
async function huidigModel() {
  const eigen = await require('./instellingen').lees('lh_model', null);
  return Object.assign({}, C.LH_MODEL, eigen && eigen.bestand ? eigen : {});
}
async function haalPagina() {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000);
  try {
    const r = await fetch(C.LB_FORMULIER_NL, { signal: ac.signal, headers: { 'User-Agent': 'SLA-HR-dashboard (wekelijkse modelcontrole)', Accept: 'text/html' } });
    if (!r.ok) throw new Error('Belastingdienst gaf HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(tm); }
}
// Vergelijkt de pagina met het model waarop ons formulier gebaseerd is. Bewaart de uitkomst in hr_instellingen 'lh_model_check'.
async function controleerModel(o) {
  o = o || {};
  const II = require('./instellingen'), huidig = await huidigModel(), vorig = (await II.lees('lh_model_check', null)) || {};
  const uit = { op: new Date().toISOString(), huidig: { code: huidig.code, bestand: huidig.bestand, gewijzigd: huidig.gewijzigd }, gemeld: vorig.gemeld || '', foutTeller: 0, foutGemeld: vorig.foutGemeld || false };
  try {
    const g = parseModelPagina(await (o.haal || haalPagina)());
    if (!g) throw new Error('Geen link naar de model-PDF gevonden op de pagina (is de pagina van de Belastingdienst veranderd?)');
    uit.gevonden = g;
    uit.status = g.bestand === String(huidig.bestand || '').toLowerCase() ? 'actueel' : 'nieuw';
    uit.foutGemeld = false;
  } catch (e) {
    uit.status = 'fout'; uit.fout = e.message; uit.gevonden = vorig.gevonden || null; uit.foutTeller = (vorig.foutTeller || 0) + 1;
  }
  if (o.opslaan !== false) await II.schrijf('lh_model_check', uit, o.door || 'automatisch');
  return uit;
}
async function markeer(velden) {
  const II = require('./instellingen'); II.vergeet('lh_model_check');
  const v = (await II.lees('lh_model_check', null)) || {}; await II.schrijf('lh_model_check', Object.assign({}, v, velden), 'automatisch');
}
async function modelStatus() {
  const huidig = await huidigModel(), check = await require('./instellingen').lees('lh_model_check', null);
  return { huidig, check, pagina: C.LB_FORMULIER_NL };
}
// HR heeft het nieuwe model bekeken: de velden zijn gelijk gebleven → nieuwe versiecode overnemen.
async function overnemen(door) {
  const II = require('./instellingen'); II.vergeet('lh_model_check');
  const c = await II.lees('lh_model_check', null);
  if (!c || c.status !== 'nieuw' || !c.gevonden) throw new Error('Er is geen nieuwe modelversie gevonden om over te nemen. Klik eerst op "Nu controleren".');
  const nieuw = { code: c.gevonden.code, bestand: c.gevonden.bestand, gewijzigd: c.gevonden.gewijzigd, url: c.gevonden.url, overgenomenOp: new Date().toISOString(), door };
  await II.schrijf('lh_model', nieuw, door);
  await II.schrijf('lh_model_check', Object.assign({}, c, { status: 'actueel', huidig: nieuw }), door);
  return nieuw;
}

module.exports = { LABEL, valideer, leesHandtekening, gegevensHash, maakPdf, opslaan, voorinvullen, alAanwezig, link, codeUitBestand, parseModelPagina, huidigModel, controleerModel, markeer, modelStatus, overnemen };
