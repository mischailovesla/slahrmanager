// ============================================================
// v0.51.0 Loonstroken uit Exact Online splitsen en koppelen.
// Exact levert per BV één PDF met de salarisspecificaties van alle medewerkers ("Loonstroken_Maandelijks_2026_10_3.pdf").
// Deze module:
//  1. leest de tekst per pagina uit de PDF (eigen kleine parser: Exact schrijft Helvetica/WinAnsi met Td/Tj, geen OCR nodig);
//  2. haalt per pagina de kopgegevens op (Exact-medewerkernummer, periode, BV, naam, geboortedatum, afdeling, run, "Pagina x van y");
//  3. groepeert pagina's tot één loonstrook per medewerker (meerdere pagina's worden samengevoegd);
//  4. knipt elke loonstrook als eigen PDF (pdf-lib, pagina's 1-op-1 gekopieerd, dus identiek aan het origineel);
//  5. koppelt aan een Shiftbase-medewerker: vaste koppeling (BV + Exact-nr) > geboortedatum + achternaam/initiaal > voorstel op naam.
// Bedragen worden NIET uitgelezen of opgeslagen: alleen kopgegevens. Het salaris staat uitsluitend in de PDF (privé bucket).
// ============================================================
const zlib = require('zlib');
const { PDFDocument, PDFArray, PDFRawStream, PDFName, decodePDFRawStream } = require('pdf-lib');
const { normNaam } = require('./util');

const BUCKET = 'hr-loonstroken';
const MAX_BYTES = 25 * 1024 * 1024;

// ---------- 1. Tekst uit een content stream ----------
// Windows-1252 0x80-0x9F (rest = Latin-1)
const CP1252 = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š', 0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ', 0x9E: 'ž', 0x9F: 'Ÿ' };
const winAnsi = bytes => bytes.map(b => CP1252[b] || String.fromCharCode(b)).join('');

// Tokenizer voor PDF-content: getallen, namen, strings (literal/hex), arrays en operatoren.
function tokens(src) {
  const out = []; let i = 0; const n = src.length;
  const ws = c => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
  const delim = c => c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
  while (i < n) {
    const c = src[i];
    if (ws(c)) { i++; continue; }
    if (c === 0x25) { while (i < n && src[i] !== 0x0a && src[i] !== 0x0d) i++; continue; } // % commentaar
    if (c === 0x28) { // ( literal string )
      const b = []; let diep = 1; i++;
      while (i < n && diep > 0) {
        let x = src[i++];
        if (x === 0x5c) { // backslash
          const y = src[i++];
          if (y === 0x6e) b.push(10); else if (y === 0x72) b.push(13); else if (y === 0x74) b.push(9); else if (y === 0x62) b.push(8); else if (y === 0x66) b.push(12);
          else if (y >= 0x30 && y <= 0x37) { let o = y - 48; for (let k = 0; k < 2 && src[i] >= 0x30 && src[i] <= 0x37; k++) o = o * 8 + (src[i++] - 48); b.push(o & 255); }
          else if (y === 0x0d) { if (src[i] === 0x0a) i++; } else if (y === 0x0a) { /* regelvoortzetting */ }
          else b.push(y);
          continue;
        }
        if (x === 0x28) diep++; else if (x === 0x29) { diep--; if (!diep) break; }
        b.push(x);
      }
      out.push({ s: winAnsi(b) }); continue;
    }
    if (c === 0x3c && src[i + 1] !== 0x3c) { // <hex>
      let j = i + 1, h = ''; while (j < n && src[j] !== 0x3e) { const ch = String.fromCharCode(src[j]); if (/[0-9a-f]/i.test(ch)) h += ch; j++; }
      if (h.length % 2) h += '0'; const b = []; for (let k = 0; k < h.length; k += 2) b.push(parseInt(h.substr(k, 2), 16));
      out.push({ s: winAnsi(b) }); i = j + 1; continue;
    }
    if (c === 0x3c || c === 0x3e) { i += 2; out.push({ op: c === 0x3c ? '<<' : '>>' }); continue; }
    if (c === 0x5b) { out.push({ op: '[' }); i++; continue; }
    if (c === 0x5d) { out.push({ op: ']' }); i++; continue; }
    if (c === 0x7b || c === 0x7d) { i++; continue; }
    let j = i + (c === 0x2f ? 1 : 0); while (j < n && !ws(src[j]) && !delim(src[j])) j++;
    const w = Buffer.from(src.slice(i, j)).toString('latin1'); i = j === i ? i + 1 : j;
    if (w[0] === '/') out.push({ name: w.slice(1) });
    else if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) out.push({ num: parseFloat(w) });
    else out.push({ op: w });
  }
  return out;
}

// Tekstfragmenten met positie: [{x, y, t}]. Ondersteunt BT/ET, Td, TD, Tm, T*, TL, Tj, TJ, ' en ".
function tekstItems(src) {
  const items = [], st = []; let arr = null;
  let tx = 0, ty = 0, lx = 0, ly = 0, tl = 0;
  const zet = (x, y) => { lx = tx = x; ly = ty = y; };
  const push = t => { if (t && t.trim()) items.push({ x: Math.round(tx * 100) / 100, y: Math.round(ty * 100) / 100, t: t.replace(/\s+/g, ' ').trim() }); };
  for (const tk of tokens(src)) {
    if (tk.op === '[') { arr = []; continue; }
    if (tk.op === ']') { st.push({ arr: arr || [] }); arr = null; continue; }
    if (arr) { arr.push(tk); continue; }
    if (tk.op === undefined) { st.push(tk); continue; }
    const num = k => { const v = st[st.length - k]; return v && typeof v.num === 'number' ? v.num : 0; };
    switch (tk.op) {
      case 'BT': zet(0, 0); break;
      case 'Td': zet(lx + num(2), ly + num(1)); break;
      case 'TD': tl = -num(1); zet(lx + num(2), ly + num(1)); break;
      case 'Tm': zet(num(2), num(1)); break;
      case 'TL': tl = num(1); break;
      case 'T*': zet(lx, ly - tl); break;
      case 'Tj': { const v = st[st.length - 1]; if (v && v.s != null) push(v.s); break; }
      case "'": { zet(lx, ly - tl); const v = st[st.length - 1]; if (v && v.s != null) push(v.s); break; }
      case '"': { zet(lx, ly - tl); const v = st[st.length - 1]; if (v && v.s != null) push(v.s); break; }
      case 'TJ': {
        const v = st[st.length - 1];
        if (v && v.arr) push(v.arr.map(x => x.s != null ? x.s : (typeof x.num === 'number' && x.num < -200 ? ' ' : '')).join(''));
        break;
      }
      default: break;
    }
    st.length = 0;
  }
  return items;
}

function inflate(raw) {
  try { return decodePDFRawStream(raw).decode(); }
  catch (e) { return new Uint8Array(zlib.inflateSync(Buffer.from(raw.contents))); }
}
function paginaBytes(page) {
  const c = page.node.Contents(); if (!c) return new Uint8Array(0);
  const delen = [];
  const lees = ref => { const o = page.doc.context.lookup(ref); if (o instanceof PDFRawStream) delen.push(inflate(o)); else if (o && o.getContents) delen.push(o.getContents()); };
  if (c instanceof PDFArray) for (let i = 0; i < c.size(); i++) lees(c.get(i)); else lees(c);
  const tot = delen.reduce((a, b) => a + b.length + 1, 0), buf = new Uint8Array(tot); let o = 0;
  for (const d of delen) { buf.set(d, o); o += d.length; buf[o++] = 0x0a; }
  return buf;
}

// ---------- 2. Kopgegevens van één pagina ----------
const dicht = (a, b, tol) => Math.abs(a - b) <= (tol || 2);
function waarde(items, label, opts) {
  const o = opts || {};
  const lab = items.filter(i => i.t === label).sort((a, b) => b.y - a.y);
  const l = o.laagste ? lab[lab.length - 1] : lab[0]; if (!l) return '';
  const r = items.filter(i => dicht(i.y, l.y) && i.x > l.x + 1 && i.x < l.x + (o.bereik || 260)).sort((a, b) => a.x - b.x)[0];
  return r ? r.t : '';
}
const pp = s => { const m = String(s || '').match(/^(\d{4})-(\d{1,2})$/); return m ? m[1] + '-' + m[2].padStart(2, '0') : ''; };
function paginaInfo(items) {
  const pag = items.map(i => i.t.match(/^Pagina (\d+) van (\d+)$/)).find(Boolean);
  const run = (items.find(i => /^[A-Z]\d{4}\.\d{2}\.\d+$/.test(i.t)) || {}).t || '';
  const titel = items.filter(i => i.y > 805).sort((a, b) => b.y - a.y)[0];
  const info = {
    soort: titel ? titel.t : '',
    exactNr: (waarde(items, 'Medewerker').match(/^\d{1,10}$/) || [''])[0],
    periodeStrook: pp(waarde(items, 'Jaar - periode')),
    geboortedatum: (waarde(items, 'Geboortedatum').match(/^\d{2}-\d{2}-\d{4}$/) || [''])[0],
    functie: waarde(items, 'Functie'), afdeling: waarde(items, 'Afdeling'), indienst: waarde(items, 'Datum in dienst'),
    pagina: pag ? +pag[1] : 1, paginas: pag ? +pag[2] : 1, run, bv: '', naamStrook: ''
  };
  // verwerkingsperiode: uit de runcode (M2026.10.3 = periode 2026-10, run 3); anders de periode op de strook
  const rm = run.match(/^[A-Z](\d{4})\.(\d{2})\./);
  info.periode = rm ? rm[1] + '-' + rm[2] : info.periodeStrook;
  // Adresblok: tussen de kop en "Medewerkergegevens". Bovenste regel links = BV, rechts = medewerker.
  const kopY = Math.min.apply(null, items.filter(i => i.x >= 400 && i.y > 740 && i.y < 805).map(i => i.y).concat([760]));
  const mg = items.find(i => i.t === 'Medewerkergegevens');
  if (mg) {
    const blok = items.filter(i => i.y < kopY - 10 && i.y > mg.y + 10);
    const links = blok.filter(i => i.x < 250).sort((a, b) => b.y - a.y), rechts = blok.filter(i => i.x >= 250).sort((a, b) => b.y - a.y);
    info.bv = links[0] ? links[0].t : ''; info.naamStrook = rechts[0] ? rechts[0].t : '';
  }
  return info;
}

// ---------- 3. Hele PDF: pagina's → loonstroken ----------
// Eén loonstrook = alle documenten van één medewerker in deze run (salarisspecificatie, nabetaling, correcties van eerdere
// periodes), in de volgorde van het origineel. Een vervolgpagina ("Pagina 2 van 2") zonder kop hoort bij de vorige pagina.
async function lees(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  const perNr = new Map(), waarschuwingen = [];
  let vorige = null;
  doc.getPages().forEach((p, idx) => {
    let info = paginaInfo(tekstItems(paginaBytes(p)));
    if (!info.exactNr) {
      if (vorige && info.pagina > 1) { vorige.paginaIdx.push(idx); return; }
      waarschuwingen.push('Pagina ' + (idx + 1) + ': geen medewerkernummer gevonden (geen salarisspecificatie uit Exact?). Deze pagina is overgeslagen.');
      return;
    }
    const sleutel = info.bv + '|' + info.exactNr;
    let s = perNr.get(sleutel);
    if (!s) { s = Object.assign({}, info, { paginaIdx: [], documenten: [] }); delete s.pagina; delete s.paginas; perNr.set(sleutel, s); }
    else {
      if (!s.geboortedatum && info.geboortedatum) s.geboortedatum = info.geboortedatum;
      if (s.run !== info.run) waarschuwingen.push(s.naamStrook + ' (' + s.exactNr + '): pagina\'s uit verschillende runs (' + s.run + ' / ' + info.run + ').');
    }
    s.paginaIdx.push(idx);
    if (info.pagina === 1) s.documenten.push(info.soort + (info.periodeStrook && info.periodeStrook !== s.periode ? ' ' + info.periodeStrook : ''));
    vorige = s;
  });
  const stroken = Array.from(perNr.values());
  for (const s of stroken) { delete s.periodeStrook; delete s.soort; if (!s.periode) waarschuwingen.push(s.naamStrook + ' (' + s.exactNr + '): geen periode gevonden.'); }
  let maker = ''; try { maker = doc.getCreator() || ''; } catch (e) { /* */ }
  return { doc, stroken, paginas: doc.getPageCount(), waarschuwingen, maker };
}
// Losse PDF voor één strook (pagina's 1-op-1 gekopieerd)
async function knip(doc, paginaIdx, titel) {
  const uit = await PDFDocument.create();
  (await uit.copyPages(doc, paginaIdx)).forEach(p => uit.addPage(p));
  uit.setTitle(titel || 'Salarisspecificatie'); uit.setProducer('SLA HR Dashboard'); uit.setCreator('Exact Online');
  return uit.save({ useObjectStreams: false });
}
// Meerdere stroken (bytes) samenvoegen tot één PDF
async function bundel(lijstBytes, titel) {
  const uit = await PDFDocument.create();
  for (const b of lijstBytes) { const d = await PDFDocument.load(b); (await uit.copyPages(d, d.getPageIndices())).forEach(p => uit.addPage(p)); }
  uit.setTitle(titel || 'Salarisspecificaties'); uit.setProducer('SLA HR Dashboard');
  return uit.save();
}

// ---------- 4. Koppelen aan Shiftbase ----------
const AANHEF = /^(mevrouw|mevr\.?|mw\.?|de heer|heer|dhr\.?|mx\.?|mr\.?|mrs\.?|ms\.?|familie|fam\.?)\s+/i;
// "Mevrouw J. Loewy" → { initialen:'J', achternaam:'loewy' }; "M.C.C. Coulouvrat-Cren" → { 'MCC', 'coulouvrat cren' }
function ontleedNaam(s) {
  let t = String(s || '').trim().replace(AANHEF, '').replace(/^de heer\s+/i, '');
  const m = t.match(/^((?:[A-Za-zÀ-ÿ]{1,3}\.\s*)+)(.*)$/);
  let ini = '', rest = t;
  if (m) { ini = m[1].replace(/[\s.]/g, ''); rest = m[2]; }
  return { initialen: ini.toUpperCase(), achternaam: normNaam(rest) };
}
const TUSSEN = new Set(['van', 'de', 'der', 'den', 'het', 'ten', 'ter', 'te', 'in', 't', 'la', 'le', 'du', 'da', 'dos', 'del', 'di', 'von', 'zu', 'el', 'al', 'op', 'aan', 'uit', 'bij']);
const kern = s => normNaam(s).split(' ').filter(w => w && !TUSSEN.has(w)).join(' ');
function ddmmjjjjNaarIso(s) { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
// achternaam uit de strook past bij de Shiftbase-naam? (alle kernwoorden komen voor; dubbele namen met '-' tellen per deel)
function achternaamPast(strookAchternaam, sbNaam) {
  const a = kern(strookAchternaam).split(' ').filter(Boolean), w = new Set(kern(sbNaam).split(' '));
  if (!a.length) return false;
  if (a.every(x => w.has(x))) return true;
  // gedeeltelijk: minstens één deel van een dubbele achternaam (bijv. strook "Coulouvrat-Cren", Shiftbase alleen "Coulouvrat")
  return a.length > 1 && a.some(x => x.length > 2 && w.has(x));
}
const initiaalPast = (ini, voornaam) => !ini || !voornaam || normNaam(voornaam)[0] === ini[0].toLowerCase();

// medewerkers: [{id, naam, voornaam, email, gebDatum:'YYYY-MM-DD'}], koppelingen: {'BV|nr': {shiftbase_id, naam}}
// → { shiftbaseId, naam, email, zekerheid:'vast'|'zeker'|'voorstel'|'', reden }
function koppel(strook, medewerkers, koppelingen) {
  const vast = (koppelingen || {})[strook.bv + '|' + strook.exactNr];
  if (vast && vast.shiftbase_id) {
    const m = medewerkers.find(x => x.id === String(vast.shiftbase_id));
    return { shiftbaseId: String(vast.shiftbase_id), naam: m ? m.naam : vast.naam, email: m ? m.email : '', zekerheid: 'vast', reden: 'eerder gekoppeld (Exact-nr ' + strook.exactNr + ')' };
  }
  const nm = ontleedNaam(strook.naamStrook), geb = ddmmjjjjNaarIso(strook.geboortedatum);
  const opGeb = geb ? medewerkers.filter(m => m.gebDatum === geb) : [];
  const res = (m, z, r) => ({ shiftbaseId: m.id, naam: m.naam, email: m.email || '', zekerheid: z, reden: r });
  const gebNaam = opGeb.filter(m => achternaamPast(nm.achternaam, m.naam));
  if (gebNaam.length === 1) return res(gebNaam[0], 'zeker', 'geboortedatum + achternaam');
  const gebIni = opGeb.filter(m => initiaalPast(nm.initialen, m.voornaam));
  if (opGeb.length === 1 && gebIni.length === 1) return res(opGeb[0], 'voorstel', 'geboortedatum + voorletter (achternaam wijkt af)');
  const opNaam = medewerkers.filter(m => achternaamPast(nm.achternaam, m.naam) && initiaalPast(nm.initialen, m.voornaam));
  if (opNaam.length === 1) return res(opNaam[0], 'voorstel', 'achternaam + voorletter' + (geb && opNaam[0].gebDatum ? ' (geboortedatum wijkt af!)' : ''));
  return { shiftbaseId: '', naam: '', email: '', zekerheid: '', reden: opNaam.length > 1 ? opNaam.length + ' medewerkers met deze naam' : 'niet gevonden in Shiftbase (uit dienst?)' };
}

const slug = s => normNaam(s).replace(/\s+/g, '_').slice(0, 40) || 'medewerker';
const veiligPad = s => String(s || '').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
function opslagPad(s) { return 'stroken/' + s.periode + '/' + veiligPad(s.bv) + '/' + veiligPad(s.run || 'run') + '_' + s.exactNr + '_' + slug(s.naamStrook) + '.pdf'; }
function bestandsnaam(naam, periode) { return 'Salarisspecificatie_' + String(naam || 'medewerker').trim().replace(/[^\wÀ-ÿ\-]+/g, '_') + '_' + periode + '.pdf'; }

module.exports = { BUCKET, MAX_BYTES, tokens, tekstItems, paginaInfo, lees, knip, bundel, ontleedNaam, achternaamPast, koppel, ddmmjjjjNaarIso, opslagPad, bestandsnaam };
