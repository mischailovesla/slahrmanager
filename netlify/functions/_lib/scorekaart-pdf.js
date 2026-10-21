// ============================================================
// Fase 3c: scorekaart van één winkel als PDF (A4, pdf-lib) — voor het overleg van HR met de Store Manager.
// Alleen geaggregeerde cijfers. Check-in- en exit-cijfers worden pas getoond vanaf MIN_N reacties (anonimiteit):
// de check-in belooft medewerkers dat de Store Manager hun antwoorden niet ziet.
// ============================================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const P = require('./pdf');
const SK = require('./scorekaart');

const A4 = [595.28, 841.89], L = 48, R = 48, B = A4[0] - L - R;
const KL = { groen: rgb(0, 0.624, 0.294), donker: rgb(0.2, 0.239, 0.227), grijs: rgb(0.533, 0.502, 0.471), lijn: rgb(0.91, 0.886, 0.871), zand: rgb(0.973, 0.953, 0.941),
  rood: rgb(0.753, 0.224, 0.169), oranje: rgb(0.91, 0.51, 0.29), roodL: rgb(0.992, 0.925, 0.918), oranjeL: rgb(0.996, 0.945, 0.91), groenL: rgb(0.902, 0.969, 0.933), grijsL: rgb(0.94, 0.93, 0.92) };
const STATUS = { groen: ['Goed', KL.groen, KL.groenL], oranje: ['Let op', KL.oranje, KL.oranjeL], rood: ['Aandacht', KL.rood, KL.roodL], klein: ['Kleine aantallen', KL.grijs, KL.grijsL], geen: ['Geen gegevens', KL.grijs, KL.grijsL] };
const PRIVE = ['checkinScore', 'checkinLaagPct', 'enps']; // anonimiteit: alleen tonen vanaf MIN_N reacties
const t = s => P.veilig(String(s == null ? '' : s).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/÷/g, '/').replace(/×/g, 'x'));

async function maakScorekaartPdf(sk, winkelNaam, door) {
  const w = sk.winkels.find(x => x.naam === winkelNaam); if (!w) throw new Error('Onbekende winkel: ' + winkelNaam);
  const doc = await PDFDocument.create(); doc.setTitle('Scorekaart ' + winkelNaam); doc.setAuthor('SLA HR Team');
  const F = { n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique) };
  let pg = doc.addPage(A4), y = A4[1] - 44;
  const tekst = (s, x, yy, size, font, kleur) => pg.drawText(t(s), { x, y: yy, size, font: font || F.n, color: kleur || KL.donker });
  const breed = (s, size, font) => (font || F.n).widthOfTextAtSize(t(s), size);
  const nieuwePagina = () => { pg = doc.addPage(A4); y = A4[1] - 44; };
  const ruimte = h => { if (y - h < 56) nieuwePagina(); };
  const regels = (s, size, font, max) => { const woorden = t(s).split(/\s+/), uit = []; let r = ''; woorden.forEach(wd => { const p = r ? r + ' ' + wd : wd; if ((font || F.n).widthOfTextAtSize(p, size) > max && r) { uit.push(r); r = wd; } else r = p; }); if (r) uit.push(r); return uit; };

  // kop
  tekst('SLA', L, y - 20, 22, F.b, KL.groen); tekst('the good food bar · HR', L, y - 32, 8, F.n, KL.grijs);
  const kop = 'Scorekaart ' + winkelNaam; tekst(kop, A4[0] - R - breed(kop, 15, F.b), y - 16, 15, F.b);
  const sub = sk.periode + ' · vergeleken met het SLA-gemiddelde'; tekst(sub, A4[0] - R - breed(sub, 9), y - 30, 9, F.n, KL.grijs);
  y -= 52; pg.drawLine({ start: { x: L, y }, end: { x: A4[0] - R, y }, thickness: 1, color: KL.lijn }); y -= 18;

  // kerngetallen
  const kern = [['In dienst nu', w.bestand], ['Instroom', w.instroom], ['Uitstroom', w.uitstroom], ['Nu ziek', w.lopendVerzuim]];
  const mtoW = sk.mto ? sk.mto.perWinkel[String(winkelNaam).trim().toLowerCase()] : null;
  if (sk.mto) kern.push(['MTO-score', mtoW && !mtoW.verborgen ? Number(mtoW.totaal).toFixed(1).replace('.', ',') + ' / 5' : '-', mtoW && !mtoW.verborgen ? 'SLA ' + String(sk.mto.totaal).replace('.', ',') + ' · eNPS ' + (mtoW.enps > 0 ? '+' : '') + mtoW.enps : 'minder dan ' + sk.mto.minN + ' reacties']);
  const kwKost = sk.kosten ? sk.kosten.winkels.find(x => x.naam === winkelNaam) : null;
  if (kwKost) kern.push(["Verloopkosten/jr EUR", kwKost.perJaar.toLocaleString('nl-NL'), kwKost.uitstroom + ' x EUR ' + sk.kosten.perVervanging.totaal]);
  const kb = (B - (kern.length - 1) * 8) / kern.length;
  kern.forEach((k, i) => { const x = L + i * (kb + 8); pg.drawRectangle({ x, y: y - 44, width: kb, height: 44, color: KL.zand }); tekst(String(k[1]), x + 8, y - 20, kern.length > 4 ? 13 : 16, F.b); tekst(k[0], x + 8, y - 31, 7, F.n, KL.grijs); if (k[2]) tekst(k[2], x + 8, y - 40, 6, F.n, KL.grijs); });
  y -= 60;

  // aandachtspunten / wat goed gaat (privé-KPI's met te weinig reacties staan er nooit in: status 'klein')
  const blok = (titel, items, kleur, achter) => {
    if (!items.length) return;
    ruimte(30 + items.length * 14); tekst(titel, L, y, 10, F.b, kleur); y -= 6;
    items.forEach(it => { const rs = regels(it.tekst, 9, F.n, B - 22); ruimte(rs.length * 12 + 6); pg.drawRectangle({ x: L, y: y - rs.length * 12 - 2, width: B, height: rs.length * 12 + 6, color: achter }); pg.drawCircle({ x: L + 10, y: y - 7, size: 1.8, color: kleur }); rs.forEach((r, j) => tekst(r, L + 17, y - 10 - j * 12, 9, F.n)); y -= rs.length * 12 + 10; });
    y -= 8;
  };
  blok('Aandachtspunten', w.aandacht, KL.rood, KL.roodL);
  blok('Wat goed gaat', w.goed, KL.groen, KL.groenL);
  if (!w.aandacht.length && !w.goed.length) { ruimte(20); tekst('Geen opvallende afwijkingen ten opzichte van het SLA-gemiddelde.', L, y, 9, F.i, KL.grijs); y -= 18; }

  y -= 4;
  // KPI-tabel
  const kol = { kpi: L, w: L + 250, o: L + 320, s: L + 392 };
  tekst('Indicator', kol.kpi, y, 8, F.b, KL.grijs); tekst(winkelNaam.length > 12 ? 'Winkel' : winkelNaam, kol.w, y, 8, F.b, KL.grijs); tekst('SLA', kol.o, y, 8, F.b, KL.grijs); tekst('Beoordeling', kol.s, y, 8, F.b, KL.grijs);
  y -= 6; pg.drawLine({ start: { x: L, y }, end: { x: A4[0] - R, y }, thickness: 0.8, color: KL.lijn }); y -= 4;
  let groep = '';
  for (const k of sk.kpis) {
    const item = w.waarden[k.key], o = sk.totaal.waarden[k.key];
    const verborgen = PRIVE.includes(k.key) && item.n < sk.minN;
    const uitleg = regels(k.uitleg, 7, F.n, 240);
    const h = 16 + uitleg.length * 8.5 + (groep !== k.groep ? 16 : 0);
    ruimte(h);
    if (groep !== k.groep) { groep = k.groep; y -= 13; tekst(groep.toUpperCase(), kol.kpi, y, 7.5, F.b, KL.groen); }
    y -= 13;
    tekst(k.label, kol.kpi, y, 9.5, F.b);
    tekst(verborgen ? '-' : SK.fmt(k, item.v), kol.w, y, 10, F.b);
    tekst(SK.fmt(k, o.v), kol.o, y, 10, F.n, KL.grijs);
    const st = verborgen ? ['< ' + sk.minN + ' reacties', KL.grijs, KL.grijsL] : STATUS[item.status] || STATUS.geen;
    const sw = breed(st[0], 8, F.b) + 14; pg.drawRectangle({ x: kol.s, y: y - 4, width: sw, height: 14, color: st[2] }); tekst(st[0], kol.s + 7, y, 8, F.b, st[1]);
    const nTekst = item.n ? 'n=' + Math.round(item.n) : ''; if (nTekst && !verborgen) tekst(nTekst, kol.s + sw + 8, y, 7.5, F.n, KL.grijs);
    uitleg.forEach(r => { y -= 8.5; tekst(r, kol.kpi, y, 7, F.n, KL.grijs); });
    y -= 5; pg.drawLine({ start: { x: L, y }, end: { x: A4[0] - R, y }, thickness: 0.4, color: KL.lijn });
  }
  y -= 18;

  // trend in- en uitstroom per maand
  ruimte(120);
  tekst('In- en uitstroom per maand', L, y, 10, F.b); y -= 8;
  const mx = Math.max(1, ...w.trend.in, ...w.trend.uit), n = sk.maanden.length, kw = B / n, hoog = 60, basis = y - hoog - 6;
  sk.maanden.forEach((lab, i) => {
    const x = L + i * kw + kw * 0.18, bw = kw * 0.3;
    const hi = w.trend.in[i] / mx * hoog, hu = w.trend.uit[i] / mx * hoog;
    pg.drawRectangle({ x, y: basis, width: bw, height: Math.max(hi, 0.8), color: KL.groen });
    pg.drawRectangle({ x: x + bw + 2, y: basis, width: bw, height: Math.max(hu, 0.8), color: KL.oranje });
    if (w.trend.in[i]) tekst(String(w.trend.in[i]), x, basis + hi + 2, 6.5, F.n, KL.grijs);
    if (w.trend.uit[i]) tekst(String(w.trend.uit[i]), x + bw + 2, basis + hu + 2, 6.5, F.n, KL.grijs);
    tekst(lab, L + i * kw + kw / 2 - breed(lab, 7) / 2, basis - 10, 7, F.n, KL.grijs);
  });
  y = basis - 22;
  pg.drawRectangle({ x: L, y: y + 1, width: 8, height: 6, color: KL.groen }); tekst('instroom', L + 11, y, 7.5, F.n, KL.grijs);
  pg.drawRectangle({ x: L + 60, y: y + 1, width: 8, height: 6, color: KL.oranje }); tekst('uitstroom', L + 71, y, 7.5, F.n, KL.grijs);
  y -= 22;

  // voet
  const voet = 'Alleen geaggregeerde cijfers. Individuele antwoorden uit de check-in en de exit-survey worden niet gedeeld; die cijfers staan er pas bij vanaf ' + sk.minN + ' reacties. Beoordeling t.o.v. het SLA-gemiddelde over dezelfde periode: Aandacht = duidelijk slechter (>= 30% bij aantallen, >= 15% bij scores), Let op = iets slechter. Gemaakt ' + (sk.bijgewerkt || '') + (door ? ' door ' + door : '') + '.';
  const vr = regels(voet, 7, F.n, B); ruimte(vr.length * 9 + 10);
  doc.getPages().forEach(p => p.drawText(t('SLA HR · Scorekaart ' + winkelNaam + ' · vertrouwelijk'), { x: L, y: 28, size: 7, font: F.n, color: KL.grijs }));
  y -= 4; vr.forEach(r => { tekst(r, L, y, 7, F.n, KL.grijs); y -= 9; });
  return Buffer.from(await doc.save());
}
module.exports = { maakScorekaartPdf };
