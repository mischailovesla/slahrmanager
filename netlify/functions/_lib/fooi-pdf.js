// ============================================================
// v0.47.0 Fooiverdeling als PDF per winkel (A4, pdf-lib) — zelfde huisstijl als het maandrapport.
// Per winkel: kop met maand + status, tegels (fooi, uren, per uur, medewerkers), bij een gedeelde BV de
// verdeelsleutel van beide winkels, en de lijst medewerkers met uren, aandeel en fooi (+ totaalregel).
// Alle winkels = zip met één PDF per winkel.
// ============================================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const P = require('./pdf');

const A4 = [595.28, 841.89], L = 50, R = 50, B = A4[0] - L - R;
const KL = { groen: rgb(0, 0.624, 0.294), donker: rgb(0.2, 0.239, 0.227), grijs: rgb(0.533, 0.502, 0.471), lijn: rgb(0.91, 0.886, 0.871), zand: rgb(0.973, 0.953, 0.941),
  rood: rgb(0.753, 0.224, 0.169), oranjeL: rgb(0.996, 0.945, 0.91), groenL: rgb(0.902, 0.969, 0.933) };
const t = s => P.veilig(String(s == null ? '' : s).replace(/—/g, '-').replace(/×/g, 'x').replace(/÷/g, '/'));

// Nederlandse getallen zonder afhankelijkheid van ICU
function nl(x, d) {
  if (x == null || !isFinite(x)) return '-';
  d = d == null ? 2 : d;
  const neg = x < 0, v = Math.abs(Number(x)).toFixed(d), [heel, dec] = v.split('.');
  return (neg ? '-' : '') + heel.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + dec : '');
}
const eur = x => x == null ? '-' : 'EUR ' + nl(x);
const pct = x => x == null ? '-' : nl(x * 100, 1) + '%';

function vindWinkel(r, code) {
  for (const p of r.potten) { const w = p.winkels.find(x => x.code === code); if (w) return { pot: p, w }; }
  return null;
}

async function maakWinkelPdf(r, code, door) {
  const v = vindWinkel(r, code);
  if (!v) throw new Error('Onbekende winkel: ' + code);
  const { pot, w } = v, def = r.opslag && r.opslag.status === 'definitief';
  const titel = 'Fooiverdeling ' + r.periode.label;
  const doc = await PDFDocument.create(); doc.setTitle(titel + ' - ' + w.naam); doc.setAuthor('SLA HR Team');
  const F = { n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique) };
  let pg, y, pagina = 0;
  const tekst = (s, x, yy, size, font, kleur) => pg.drawText(t(s), { x, y: yy, size, font: font || F.n, color: kleur || KL.donker });
  const breed = (s, size, font) => (font || F.n).widthOfTextAtSize(t(s), size);
  const rechts = (s, xr, yy, size, font, kleur) => tekst(s, xr - breed(s, size, font), yy, size, font, kleur);
  const lijn = (dik, kleur) => pg.drawLine({ start: { x: L, y }, end: { x: A4[0] - R, y }, thickness: dik || 0.5, color: kleur || KL.lijn });
  const nieuwePagina = () => {
    pg = doc.addPage(A4); pagina++; y = A4[1] - 40;
    tekst('SLA', L, y - 18, 20, F.b, KL.groen); tekst('the good food bar · HR', L, y - 29, 7.5, F.n, KL.grijs);
    rechts(titel, A4[0] - R, y - 12, 14, F.b);
    rechts(w.naam + ' · ' + w.bv, A4[0] - R, y - 26, 9, F.n, KL.grijs);
    y -= 42; lijn(1); y -= 22;
  };

  nieuwePagina();
  // Status
  const stTekst = def ? 'Definitief vastgelegd' + (r.opslag.door ? ' door ' + r.opslag.door : '') + (r.opslag.op ? ' op ' + require('./datum').kort(new Date(r.opslag.op)) : '')
    : 'CONCEPT - nog niet definitief vastgelegd; bedragen kunnen nog wijzigen';
  const stW = breed(stTekst, 8, F.b) + 14;
  pg.drawRectangle({ x: L, y: y - 4, width: stW, height: 15, color: def ? KL.groenL : KL.oranjeL });
  tekst(stTekst, L + 7, y, 8, F.b, def ? KL.groen : KL.rood);
  rechts('Periode ' + r.periode.van.split('-').reverse().join('-') + ' t/m ' + r.periode.tot.split('-').reverse().join('-'), A4[0] - R, y, 8, F.n, KL.grijs);
  y -= 26;

  // Tegels
  const tegels = [[eur(w.fooi), 'Fooi voor deze winkel'], [nl(w.uren), 'Gewerkte uren (geklokt)'], [w.perUur == null ? '-' : eur(w.perUur), 'Fooi per gewerkt uur'], [String(w.medewerkers.length), 'Medewerkers']];
  const tb = (B - 3 * 10) / 4;
  tegels.forEach((tg, i) => { const x = L + i * (tb + 10); pg.drawRectangle({ x, y: y - 44, width: tb, height: 44, color: KL.zand }); tekst(tg[0], x + 9, y - 20, 14, F.b); tekst(tg[1], x + 9, y - 34, 7.5, F.n, KL.grijs); });
  y -= 64;

  // v0.47.1: verdeelsleutel tussen de gedeelde winkels staat bewust niet in de PDF (alleen in het dashboard)
  if (false && pot.gedeeld) {
    tekst('Verdeling ' + pot.naam + ' (gedeelde fooi ' + eur(pot.bedrag) + ')', L, y, 11, F.b, KL.groen); y -= 8;
    tekst('Sleutel per winkel = (urenaandeel + omzetaandeel) / 2. Omzet = netto omzet ex btw van de maand.', L, y - 8, 7.5, F.i, KL.grijs); y -= 24;
    const k = { w: L, u: L + 175, o: L + 262, ua: L + 320, oa: L + 385, s: L + 422, f: A4[0] - R }; // rechterkanten
    tekst('Winkel', k.w, y, 7.5, F.b, KL.grijs); rechts('Uren', k.u, y, 7.5, F.b, KL.grijs); rechts('Omzet', k.o, y, 7.5, F.b, KL.grijs);
    rechts('Urenaandeel', k.ua, y, 7.5, F.b, KL.grijs); rechts('Omzetaandeel', k.oa, y, 7.5, F.b, KL.grijs); rechts('Sleutel', k.s, y, 7.5, F.b, KL.grijs); rechts('Fooi', k.f, y, 7.5, F.b, KL.grijs);
    y -= 6; lijn(0.8); y -= 13;
    pot.winkels.forEach(x => {
      const zelf = x.code === w.code, f = zelf ? F.b : F.n;
      tekst(x.naam, k.w, y, 9, f); rechts(nl(x.uren), k.u, y, 9, f); rechts(eur(x.omzet), k.o, y, 9, f);
      rechts(pct(x.urenAandeel), k.ua, y, 9, f); rechts(pct(x.omzetAandeel), k.oa, y, 9, f); rechts(pct(x.sleutel), k.s, y, 9, F.b); rechts(eur(x.fooi), k.f, y, 9, F.b);
      y -= 6; lijn(0.4); y -= 13;
    });
    y -= 14;
  }

  // Medewerkers
  const kol = { n: L, u: L + 300, a: L + 390, f: A4[0] - R };
  const kopRegel = (verder) => {
    tekst('Fooi per medewerker' + (verder ? ' (vervolg)' : ''), L, y, 11, F.b, KL.groen); y -= 8;
    if (!verder) { tekst('Fooi per medewerker = fooi winkel x eigen uren / alle uren in deze winkel.', L, y - 8, 7.5, F.i, KL.grijs); y -= 24; } else y -= 12;
    tekst('Naam', kol.n, y, 7.5, F.b, KL.grijs); rechts('Uren', kol.u, y, 7.5, F.b, KL.grijs); rechts('Aandeel', kol.a, y, 7.5, F.b, KL.grijs); rechts('Fooi', kol.f, y, 7.5, F.b, KL.grijs);
    y -= 6; lijn(0.8); y -= 13;
  };
  kopRegel(false);
  w.medewerkers.forEach((m, i) => {
    if (y < 80) { nieuwePagina(); kopRegel(true); }
    if (i % 2) pg.drawRectangle({ x: L, y: y - 5, width: B, height: 17, color: KL.zand });
    tekst(m.naam, kol.n + 4, y, 9.5); if (m.uitDienst) tekst(m.uitDienst === 'onbekend' ? 'uit dienst' : 'uit dienst per ' + m.uitDienst, kol.n + 10 + breed(m.naam, 9.5), y, 7.5, F.i, KL.rood); rechts(nl(m.uren), kol.u, y, 9.5); rechts(pct(m.aandeel), kol.a, y, 9.5, F.n, KL.grijs); rechts(eur(m.fooi), kol.f - 4, y, 9.5, F.b);
    y -= 17;
  });
  if (!w.medewerkers.length) { tekst('Geen geklokte uren in deze maand.', L, y, 9, F.i, KL.grijs); y -= 17; }
  y += 4; lijn(1, KL.donker); y -= 14;
  if (y < 60) { nieuwePagina(); }
  tekst('Totaal', kol.n + 4, y, 10, F.b); rechts(nl(w.uren), kol.u, y, 10, F.b); rechts(w.medewerkers.length ? '100%' : '-', kol.a, y, 10, F.b); rechts(eur(w.medewerkers.reduce((a, m) => a + m.fooi, 0)), kol.f - 4, y, 10, F.b);

  // Voettekst op elke pagina
  const voet = 'Uren: Shiftbase timesheets (geklokt, excl. pauze; afgewezen tellen niet). Bedragen afgerond op centen, telt exact op. Gemaakt '
    + require('./datum').stempel() + (door ? ' door ' + door : '') + '.';
  doc.getPages().forEach((p, i) => {
    pg = p;
    pg.drawLine({ start: { x: L, y: 40 }, end: { x: A4[0] - R, y: 40 }, thickness: 0.5, color: KL.lijn });
    P.wrap(F.n, 6.5, t(voet), B - 60).forEach((rg, j) => tekst(rg, L, 30 - j * 8, 6.5, F.n, KL.grijs));
    rechts('Pagina ' + (i + 1) + ' van ' + pagina, A4[0] - R, 30, 6.5, F.n, KL.grijs);
  });
  return Buffer.from(await doc.save());
}

const veiligeNaam = s => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').trim();
function bestandsnaam(r, naam, ext) {
  return 'Fooi_' + r.periode.jaar + '-' + String(r.periode.maand).padStart(2, '0') + '_' + veiligeNaam(naam) + ((r.opslag && r.opslag.status === 'definitief') ? '' : '_CONCEPT') + '.' + ext;
}

// Winkels met fooi of uren (in vaste volgorde van de potten)
function winkelsMetInhoud(r) {
  const uit = [];
  r.potten.forEach(p => p.winkels.forEach(w => { if ((w.fooi || 0) > 0 && w.medewerkers.length) uit.push(w.code); }));
  return uit;
}

// code = één winkelcode of 'alle' -> { pdf (base64), bestandsnaam, mime }
async function exporteer(r, code, door) {
  if (code && code !== 'alle') {
    const v = vindWinkel(r, code); if (!v) throw new Error('Onbekende winkel.');
    return { pdf: (await maakWinkelPdf(r, code, door)).toString('base64'), bestandsnaam: bestandsnaam(r, v.w.naam, 'pdf'), mime: 'application/pdf' };
  }
  const codes = winkelsMetInhoud(r);
  if (!codes.length) throw new Error('Er is nog niets verdeeld: vul de fooi per pot in en klik op Bereken verdeling.');
  const entries = [];
  for (const c of codes) entries.push({ naam: bestandsnaam(r, vindWinkel(r, c).w.naam, 'pdf'), data: await maakWinkelPdf(r, c, door) });
  return { pdf: require('./zip').schrijf(entries).toString('base64'), bestandsnaam: bestandsnaam(r, 'alle_winkels', 'zip'), mime: 'application/zip', aantal: codes.length };
}

module.exports = { maakWinkelPdf, exporteer, nl, winkelsMetInhoud };
