// ============================================================
// Brief-PDF in SLA-briefopmaak, programmatisch opgebouwd met pdf-lib.
// Vervangt vbMaakBriefPdf_ (DocumentApp + getAs(PDF)) uit VrijeBrief.gs:
// zelfde opbouw en maten als de Google-Docs-versie —
//   logo 'SLA' 22pt vet groen, categorie 8pt grijs in kapitalen,
//   Datum/Aan/BV 9pt, 'Betreft:' 11pt vet, aanhef, alinea's/bullets 11pt,
//   groet met AFZENDER_NAAM + BV, voettekst 8pt.
// Marges 56/56/64/64 pt, A4. Helvetica = metrisch gelijk aan Arial.
// Geen Chromium nodig: pure JS, werkt in een Netlify Function.
// ============================================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { AFZENDER_NAAM, HR_EMAIL } = require('./config');

const A4 = [595.28, 841.89];
const MARGE = { boven: 56, onder: 56, links: 64, rechts: 64 };
const KL = { groen: rgb(0, 0.624, 0.294), grijs: rgb(0.533, 0.502, 0.471), meta: rgb(0.333, 0.333, 0.333), tekst: rgb(0.102, 0.102, 0.102) };

function datumNL(d) {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d || new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return (g('day').length < 2 ? '0' : '') + g('day') + ' ' + g('month') + ' ' + g('year');
}

// Tekst -> blokken (zelfde regels als vbTekstNaarHtml_: dubbele enter = alinea,
// regels die met "- " beginnen = lijst)
function blokken(tekst) {
  const out = [];
  String(tekst || '').replace(/\r/g, '').split(/\n{2,}/).forEach(b => {
    b = b.trim(); if (!b) return;
    const regels = b.split('\n');
    if (/^\s*-\s+/.test(regels[0])) out.push({ lijst: regels.map(r => r.replace(/^\s*-\s+/, '').trim()).filter(Boolean) });
    else out.push({ alinea: regels.map(r => r.trim()) });
  });
  return out;
}

// Tekens die Helvetica (WinAnsi) niet kent vervangen, zodat pdf-lib niet crasht
function veilig(s) {
  return String(s == null ? '' : s)
    .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"')
    .replace(/–/g, '-').replace(/—/g, '-').replace(/…/g, '...').replace(/€/g, 'EUR')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '?');
}

// Woorden afbreken op regelbreedte
function wrap(font, size, tekst, breedte) {
  const regels = [];
  String(tekst).split('\n').forEach(regel => {
    const woorden = regel.split(/\s+/).filter(Boolean);
    if (!woorden.length) { regels.push(''); return; }
    let huidig = '';
    woorden.forEach(w => {
      const probeer = huidig ? huidig + ' ' + w : w;
      if (font.widthOfTextAtSize(probeer, size) <= breedte || !huidig) huidig = probeer;
      else { regels.push(huidig); huidig = w; }
    });
    regels.push(huidig);
  });
  return regels;
}

// p: { naam, tekst }, bv, categorie, onderwerp  ->  Buffer (PDF)
async function maakBriefPdf(p, bv, categorie, onderwerp, opties) {
  const o = opties || {};
  const doc = await PDFDocument.create();
  doc.setTitle('Brief - ' + veilig(p.naam));
  doc.setAuthor('SLA HR Team');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const vet = await doc.embedFont(StandardFonts.HelveticaBold);
  const breedte = A4[0] - MARGE.links - MARGE.rechts;

  let pagina = doc.addPage(A4);
  let y = A4[1] - MARGE.boven;
  const nieuwePagina = () => { pagina = doc.addPage(A4); y = A4[1] - MARGE.boven; };
  const ruimte = h => { if (y - h < MARGE.onder) nieuwePagina(); };

  function regel(txt, f, size, kleur, lijn, x) {
    const lh = lijn || size * 1.35;
    ruimte(lh);
    pagina.drawText(veilig(txt), { x: MARGE.links + (x || 0), y: y - size, size, font: f, color: kleur || KL.tekst });
    y -= lh;
  }
  function alinea(txt, f, size, kleur, na, x) {
    wrap(f, size, veilig(txt), breedte - (x || 0)).forEach(r => regel(r, f, size, kleur, size * 1.5, x));
    y -= na == null ? 10 : na;
  }
  function bullet(txt) {
    const size = 11, inspring = 18;
    const rs = wrap(font, size, veilig(txt), breedte - inspring);
    rs.forEach((r, i) => {
      ruimte(size * 1.5);
      if (i === 0) pagina.drawText('•', { x: MARGE.links + 6, y: y - size, size, font, color: KL.tekst });
      pagina.drawText(r, { x: MARGE.links + inspring, y: y - size, size, font, color: KL.tekst });
      y -= size * 1.5;
    });
  }

  // Kop
  regel('SLA', vet, 22, KL.groen, 30);
  regel(String(categorie || 'Personeelszaken').toUpperCase(), font, 8, KL.grijs, 12);
  y -= 14;
  regel('Datum: ' + (o.datum || datumNL()), font, 9, KL.meta, 13);
  regel('Aan: ' + p.naam, font, 9, KL.meta, 13);
  if (bv) regel('BV: ' + bv, font, 9, KL.meta, 13);
  y -= 14;
  alinea('Betreft: ' + onderwerp, vet, 11, KL.tekst, 6);
  y -= 8;
  regel('Beste ' + p.naam + ',', font, 11, KL.tekst, 11 * 1.5);
  y -= 8;

  blokken(p.tekst).forEach(b => {
    if (b.lijst) { b.lijst.forEach(bullet); y -= 6; }
    else alinea(b.alinea.join('\n'), font, 11, KL.tekst, 10);
  });

  // Groet
  y -= 8;
  regel('Met vriendelijke groet,', font, 11, KL.tekst, 11 * 1.5);
  y -= 11 * 1.5;
  regel(o.afzender || AFZENDER_NAAM, font, 11, KL.tekst, 11 * 1.5);
  if (bv) regel(bv, font, 11, KL.tekst, 11 * 1.5);

  // Voettekst (onderaan de laatste pagina, net als in de Docs-versie onder de tekst)
  y -= 18;
  regel('SLA · the good food bar · ' + HR_EMAIL, font, 8, KL.grijs, 11);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function pdfBestandsnaam(naam) { return 'Brief_' + String(naam || 'medewerker').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '') + '.pdf'; }

module.exports = { maakBriefPdf, pdfBestandsnaam, blokken, wrap, veilig, datumNL };

// ============================================================
// Generieke brief-renderer met eenvoudige opmaak (stap 3d, ontslag/aanzegging).
// Invoer: tekst met **vet**, *cursief*, regels die met "• " of "- " beginnen = lijst,
// lege regel = nieuwe alinea. Zelfde pagina-opzet als maakBriefPdf.
// ============================================================
function parseRuns(regel) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(regel))) {
    if (m.index > last) runs.push({ t: regel.slice(last, m.index), b: false, i: false });
    const s = m[0];
    if (s.startsWith('**')) runs.push({ t: s.slice(2, -2), b: true, i: false });
    else runs.push({ t: s.slice(1, -1), b: false, i: true });
    last = m.index + s.length;
  }
  if (last < regel.length) runs.push({ t: regel.slice(last), b: false, i: false });
  return runs.filter(r => r.t.length);
}
// Runs in woorden splitsen en afbreken op breedte -> regels van runs
function wrapRuns(fonts, size, runs, breedte) {
  const woorden = [];
  runs.forEach(r => {
    const delen = r.t.split(/(\s+)/);
    delen.forEach(d => { if (d) woorden.push({ t: d, b: r.b, i: r.i, sp: /^\s+$/.test(d) }); });
  });
  const f = w => (w.b ? fonts.vet : w.i ? fonts.cursief : fonts.norm);
  const regels = []; let huidig = [], w = 0;
  woorden.forEach(wd => {
    const bw = f(wd).widthOfTextAtSize(wd.t, size);
    if (w + bw > breedte && huidig.length && !wd.sp) { regels.push(huidig); huidig = []; w = 0; }
    if (!huidig.length && wd.sp) return;
    huidig.push(wd); w += bw;
  });
  if (huidig.length) regels.push(huidig);
  return regels;
}

// opties: { titel?, kop? (true = SLA-logo + 'the good food bar'), voet? }
async function maakOpgemaakteBrief(tekst, opties) {
  const o = opties || {};
  const doc = await PDFDocument.create();
  doc.setTitle(o.titel || 'Brief'); doc.setAuthor('SLA HR Team');
  const fonts = { norm: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold), cursief: await doc.embedFont(StandardFonts.HelveticaOblique) };
  const breedte = A4[0] - MARGE.links - MARGE.rechts;
  let pagina = doc.addPage(A4), y = A4[1] - MARGE.boven;
  const ruimte = h => { if (y - h < MARGE.onder) { pagina = doc.addPage(A4); y = A4[1] - MARGE.boven; } };
  const teken = (runsRegel, size, x, kleur) => {
    let cx = MARGE.links + (x || 0);
    runsRegel.forEach(w => {
      const f = w.b ? fonts.vet : w.i ? fonts.cursief : fonts.norm;
      pagina.drawText(w.t, { x: cx, y: y - size, size, font: f, color: kleur || KL.tekst });
      cx += f.widthOfTextAtSize(w.t, size);
    });
  };
  if (o.kop !== false) {
    ruimte(44);
    pagina.drawText('SLA', { x: MARGE.links, y: y - 22, size: 22, font: fonts.vet, color: KL.groen }); y -= 28;
    pagina.drawText('the good food bar', { x: MARGE.links, y: y - 8, size: 8, font: fonts.norm, color: KL.grijs }); y -= 24;
  }
  const size = 10.5, lh = size * 1.45;
  const blokken = String(tekst || '').replace(/\r/g, '').split('\n');
  blokken.forEach(regel => {
    const r = regel.replace(/\s+$/, '');
    if (!r.trim()) { y -= lh * 0.55; return; }
    const isBullet = /^\s*[•\-]\s+/.test(r);
    const inhoud = isBullet ? r.replace(/^\s*[•\-]\s+/, '') : r;
    const runs = parseRuns(veilig(inhoud));
    const inspring = isBullet ? 16 : 0;
    const regels = wrapRuns(fonts, size, runs, breedte - inspring);
    regels.forEach((rr, i) => {
      ruimte(lh);
      if (isBullet && i === 0) pagina.drawText('•', { x: MARGE.links + 4, y: y - size, size, font: fonts.norm, color: KL.tekst });
      teken(rr, size, inspring);
      y -= lh;
    });
    if (isBullet) y -= 2;
  });
  if (o.voet !== false) { y -= 18; ruimte(12); pagina.drawText('SLA · the good food bar · ' + HR_EMAIL, { x: MARGE.links, y: y - 8, size: 8, font: fonts.norm, color: KL.grijs }); }
  return Buffer.from(await doc.save());
}

module.exports.maakOpgemaakteBrief = maakOpgemaakteBrief;
module.exports.parseRuns = parseRuns;
