// ============================================================
// Fase 4b: HR-maandrapport als PDF (A4, pdf-lib).
// Pagina 1: SLA totaal — kerngetallen, samenvatting, KPI's deze maand vs vorige maand vs 12 maanden, trend, training.
// Daarna: uitstroomredenen + wat HR deed, en per winkel (3 maanden t/m de rapportmaand) met aandachtspunten.
// Alleen geaggregeerde cijfers (check-in/exit pas vanaf MIN_N reacties, zie maandrapport.js).
// ============================================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const P = require('./pdf');

const A4 = [595.28, 841.89], L = 44, R = 44, B = A4[0] - L - R;
const KL = { groen: rgb(0, 0.624, 0.294), donker: rgb(0.2, 0.239, 0.227), grijs: rgb(0.533, 0.502, 0.471), lijn: rgb(0.91, 0.886, 0.871), zand: rgb(0.973, 0.953, 0.941),
  rood: rgb(0.753, 0.224, 0.169), oranje: rgb(0.91, 0.51, 0.29), roodL: rgb(0.992, 0.925, 0.918), oranjeL: rgb(0.996, 0.945, 0.91), groenL: rgb(0.902, 0.969, 0.933), grijsL: rgb(0.94, 0.93, 0.92) };
const ST = { groen: [KL.groen, KL.groenL], oranje: [KL.oranje, KL.oranjeL], rood: [KL.rood, KL.roodL], klein: [KL.grijs, KL.grijsL], geen: [KL.grijs, KL.grijsL] };
const t = s => P.veilig(String(s == null ? '' : s).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/÷/g, '/').replace(/×/g, 'x').replace(/—/g, '-'));
const Hoofd = s => s.charAt(0).toUpperCase() + s.slice(1);

async function maakMaandrapportPdf(r, door) {
  const doc = await PDFDocument.create(); doc.setTitle((r.titel || 'HR-maandrapport ' + r.label)); doc.setAuthor('SLA HR Team');
  const F = { n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique) };
  let pg, y;
  const tekst = (s, x, yy, size, font, kleur) => pg.drawText(t(s), { x, y: yy, size, font: font || F.n, color: kleur || KL.donker });
  const breed = (s, size, font) => (font || F.n).widthOfTextAtSize(t(s), size);
  const rechts = (s, xr, yy, size, font, kleur) => tekst(s, xr - breed(s, size, font), yy, size, font, kleur);
  const regels = (s, size, font, max) => { const woorden = t(s).split(/\s+/), uit = []; let rg = ''; woorden.forEach(wd => { const p = rg ? rg + ' ' + wd : wd; if ((font || F.n).widthOfTextAtSize(p, size) > max && rg) { uit.push(rg); rg = wd; } else rg = p; }); if (rg) uit.push(rg); return uit; };
  const lijn = (dik, kleur) => pg.drawLine({ start: { x: L, y }, end: { x: A4[0] - R, y }, thickness: dik || 0.5, color: kleur || KL.lijn });
  const nieuwePagina = (titel) => {
    pg = doc.addPage(A4); y = A4[1] - 40;
    tekst('SLA', L, y - 18, 20, F.b, KL.groen); tekst('the good food bar · HR', L, y - 29, 7.5, F.n, KL.grijs);
    rechts(titel, A4[0] - R, y - 14, 14, F.b);
    y -= 44; lijn(1); y -= 18;
  };
  const ruimte = (h, titel) => { if (y - h < 56) nieuwePagina(titel || (r.titel || 'HR-maandrapport ' + r.label)); };
  const kop = (s, h) => { ruimte((h || 0) + 26); tekst(s, L, y, 11, F.b, KL.groen); y -= 14; };

  // ---------- pagina 1: SLA totaal ----------
  nieuwePagina((r.titel || 'HR-maandrapport ' + r.label));
  rechts((r.winkel || 'SLA totaal') + (r.lopend ? ' · lopende maand t/m vandaag' : '') + ' · gemaakt ' + (r.bijgewerkt || ''), A4[0] - R, y + 22, 8, F.n, KL.grijs);

  const k = r.kern;
  const tegels = [[k.bestand, 'In dienst eind maand', 'vorige maand ' + k.vorig.bestand], [k.instroom, 'Instroom', 'vorige maand ' + k.vorig.instroom], [k.uitstroom, 'Uitstroom', 'vorige maand ' + k.vorig.uitstroom], [(k.netto > 0 ? '+' : '') + k.netto, 'Netto', 'instroom - uitstroom'], [k.verloop12, 'Verloop 12 mnd', 'uitstroom / gem. bestand'], [k.nuZiek, 'Nu ziek', 'lopende ziekmeldingen']];
  const tb = (B - 5 * 8) / 6;
  tegels.forEach((tg, i) => { const x = L + i * (tb + 8); pg.drawRectangle({ x, y: y - 46, width: tb, height: 46, color: KL.zand }); tekst(String(tg[0]), x + 8, y - 20, 15, F.b); tekst(tg[1], x + 8, y - 31, 7, F.b, KL.donker); tekst(tg[2], x + 8, y - 40, 6, F.n, KL.grijs); });
  y -= 64;

  // samenvatting
  kop('In het kort');
  r.zinnen.forEach(z => { const rs = regels(z, 9, F.n, B - 14); ruimte(rs.length * 11.5 + 4); pg.drawCircle({ x: L + 3, y: y + 3, size: 1.6, color: KL.groen }); rs.forEach((rg, j) => tekst(rg, L + 11, y - j * 11.5, 9)); y -= rs.length * 11.5 + 4; });
  y -= 8;

  // KPI-tabel
  kop(r.winkel ? 'Kerncijfers ' + r.winkel + ' (met SLA ter vergelijking)' : 'Kerncijfers SLA', 40);
  const kol = r.winkel ? { kpi: L, nu: L + 214, vo: L + 268, vs: L + 322, jr: L + 384, sla: L + 440 } : { kpi: L, nu: L + 238, vo: L + 300, vs: L + 362, jr: L + 430 };
  tekst('Indicator', kol.kpi, y, 7.5, F.b, KL.grijs); const kortL = l => kol.sla ? Hoofd(l.slice(0, 3)) + ' ' + l.slice(-2) : Hoofd(l); tekst(kortL(r.label), kol.nu, y, 7.5, F.b, KL.grijs); tekst(kortL(r.labelVorig), kol.vo, y, 7.5, F.b, KL.grijs); tekst('Verschil', kol.vs, y, 7.5, F.b, KL.grijs); tekst('12 maanden', kol.jr, y, 7.5, F.b, KL.grijs); if (kol.sla) tekst('SLA 12 mnd', kol.sla, y, 7.5, F.b, KL.grijs);
  y -= 6; lijn(0.8); y -= 2;
  let groep = '';
  for (const kp of r.kpis) {
    const uitleg = regels(kp.uitleg, 6.5, F.n, r.winkel ? 205 : 228);
    ruimte(15 + uitleg.length * 8 + (groep !== kp.groep ? 14 : 0));
    if (groep !== kp.groep) { groep = kp.groep; y -= 12; tekst(groep.toUpperCase(), kol.kpi, y, 7, F.b, KL.groen); }
    y -= 12;
    tekst(kp.label, kol.kpi, y, 9, F.b);
    tekst(kp.nu.f, kol.nu, y, 9.5, F.b); if (kp.nu.n && kp.nu.f !== '-') tekst('n=' + Math.round(kp.nu.n), kol.nu + breed(kp.nu.f, 9.5, F.b) + 4, y, 6, F.n, KL.grijs);
    tekst(kp.vorig.f, kol.vo, y, 9, F.n, KL.grijs);
    if (kp.verschil.tekst) {
      const c = kp.verschil.oordeel === 'beter' ? ST.groen : kp.verschil.oordeel === 'slechter' ? ST.rood : ST.geen, w = breed(kp.verschil.tekst, 8, F.b) + 10;
      pg.drawRectangle({ x: kol.vs, y: y - 3.5, width: w, height: 12.5, color: c[1] }); tekst(kp.verschil.tekst, kol.vs + 5, y, 8, F.b, c[0]);
    }
    tekst(kp.jaar.f, kol.jr, y, 9, kp.sla && kp.sla.status === 'rood' ? F.b : F.n, kp.sla && kp.sla.status === 'rood' ? KL.rood : undefined);
    if (kol.sla && kp.sla) tekst(kp.sla.f, kol.sla, y, 9, F.n, KL.grijs);
    uitleg.forEach(rg => { y -= 8; tekst(rg, kol.kpi, y, 6.5, F.n, KL.grijs); });
    y -= 4; lijn(0.4);
  }
  y -= 16;

  // training (stand nu)
  if (r.training && r.training.length) {
    kop('Training (SLA Academy, stand van nu)', 30);
    const tw = (B - 10) / 2;
    r.training.forEach((tr, i) => { const x = L + i * (tw + 10); pg.drawRectangle({ x, y: y - 30, width: tw, height: 30, color: KL.zand }); tekst(tr.f, x + 8, y - 14, 13, F.b); tekst(tr.label + (tr.n ? ' (n=' + tr.n + ')' : ''), x + 8, y - 25, 7, F.n, KL.grijs); });
    y -= 46;
  }

  // trend 12 maanden
  kop('In- en uitstroom per maand (12 maanden)', 100);
  const tr = r.trend, mx = Math.max(1, ...tr.in, ...tr.uit), n = tr.maanden.length, kw = B / n, hoog = 58, basis = y - hoog - 4;
  tr.maanden.forEach((lab, i) => {
    const x = L + i * kw + kw * 0.16, bw = kw * 0.32, hi = tr.in[i] / mx * hoog, hu = tr.uit[i] / mx * hoog, laatste = i === n - 1;
    if (laatste) pg.drawRectangle({ x: L + i * kw + 1, y: basis - 13, width: kw - 2, height: hoog + 24, color: KL.zand });
    pg.drawRectangle({ x, y: basis, width: bw, height: Math.max(hi, 0.8), color: KL.groen });
    pg.drawRectangle({ x: x + bw + 2, y: basis, width: bw, height: Math.max(hu, 0.8), color: KL.oranje });
    if (tr.in[i]) tekst(String(tr.in[i]), x, basis + hi + 2, 6.5, F.n, KL.grijs);
    if (tr.uit[i]) tekst(String(tr.uit[i]), x + bw + 2, basis + hu + 2, 6.5, F.n, KL.grijs);
    tekst(lab, L + i * kw + kw / 2 - breed(lab, 6.5) / 2, basis - 10, 6.5, laatste ? F.b : F.n, laatste ? KL.donker : KL.grijs);
  });
  y = basis - 24;
  pg.drawRectangle({ x: L, y: y + 1, width: 8, height: 6, color: KL.groen }); tekst('instroom', L + 11, y, 7, F.n, KL.grijs);
  pg.drawRectangle({ x: L + 58, y: y + 1, width: 8, height: 6, color: KL.oranje }); tekst('uitstroom', L + 69, y, 7, F.n, KL.grijs);
  y -= 22;

  // uitstroomredenen
  const red = r.redenen;
  if (!r.winkel) kop('Uitstroomredenen ' + r.label, 40);
  if (r.winkel) { /* per winkel: geen uitstroomredenen-blok */ }
  else if (!red || !red.totaal) { tekst('Geen uitstroomdossiers met een einddatum in deze maand.', L, y, 8.5, F.i, KL.grijs); y -= 16; }
  else {
    const rijen = red.lijst.map(x => [x.reden, x.aantal]).concat(red.zonder ? [['Niet geregistreerd', red.zonder]] : []);
    const mxr = Math.max(...rijen.map(x => x[1]));
    rijen.forEach(([reden, aantal]) => {
      ruimte(14);
      tekst(reden, L, y, 8.5, reden === 'Niet geregistreerd' ? F.i : F.n, reden === 'Niet geregistreerd' ? KL.rood : KL.donker);
      const bw = Math.max(2, aantal / mxr * 180); pg.drawRectangle({ x: L + 210, y: y - 1, width: bw, height: 8, color: reden === 'Niet geregistreerd' ? KL.roodL : KL.groenL });
      tekst(aantal + ' (' + Math.round(aantal / red.totaal * 100) + '%)', L + 214 + bw, y, 8, F.n, KL.grijs); y -= 13;
    });
    y -= 4; tekst('Totaal ' + red.totaal + ' dossiers met einddatum in de maand' + (red.eigenKeuzePct ? '; ' + red.eigenKeuzePct + '% eigen keuze' : '') + '.', L, y, 7.5, F.n, KL.grijs); y -= 16;
  }

  // wat HR deed
  const a = r.activiteit;
  if (a) {
    kop('Wat HR deed in ' + r.label, 50);
    const blokjes = [[a.mailsTotaal, 'mails aan medewerkers en HR'], [a.gesprekkenTotaal, 'gesprekken vastgelegd'], [a.checkinIngevuld + '/' + a.checkinVerstuurd, 'check-ins ingevuld'], [a.exitIngevuld, 'exit-surveys ingevuld']];
    const bb = (B - 3 * 8) / 4;
    blokjes.forEach((bl, i) => { const x = L + i * (bb + 8); pg.drawRectangle({ x, y: y - 32, width: bb, height: 32, color: KL.zand }); tekst(String(bl[0]), x + 8, y - 15, 13, F.b); tekst(bl[1], x + 8, y - 26, 7, F.n, KL.grijs); });
    y -= 44;
    const kolom = (titel, items, x) => { let yy = y; tekst(titel, x, yy, 7.5, F.b, KL.grijs); yy -= 11; (items.length ? items : [{ label: '-', aantal: '' }]).slice(0, 10).forEach(it => { tekst(it.label, x, yy, 8); rechts(String(it.aantal), x + B / 2 - 20, yy, 8, F.b); yy -= 10.5; }); return yy; };
    const hoogte = Math.max(a.mails.length, a.gesprekken.length, 1) * 10.5 + 16; ruimte(hoogte);
    const y1 = kolom('Mails per onderwerp', a.mails, L), y2 = kolom('Gesprekken per soort', a.gesprekken, L + B / 2 + 10);
    y = Math.min(y1, y2) - 10;
  }

  // kosten van verloop
  if (r.kosten) {
    const ko = r.kosten, eur = n => 'EUR ' + Math.round(n).toLocaleString('nl-NL');
    kop('Kosten van verloop', 60);
    const bl = [[eur(ko.jaar), 'laatste 12 maanden', ko.uitstroomJaar + ' vertrekkers'], [eur(ko.maand), Hoofd(r.label), 'vorige maand ' + eur(ko.vorig)], [eur(ko.vroegJaar), 'vertrek binnen 90 dagen', ko.vroeg + ' vertrekkers (12 mnd)'], [eur(ko.naarGemiddelde), 'besparing per jaar', 'winkels naar SLA-gemiddelde']];
    const bb = (B - 3 * 8) / 4;
    bl.forEach((x, i) => { const xx = L + i * (bb + 8); pg.drawRectangle({ x: xx, y: y - 40, width: bb, height: 40, color: i === 3 ? KL.groenL : KL.zand }); tekst(x[0], xx + 8, y - 15, 12, F.b, i === 3 ? KL.groen : KL.donker); tekst(x[1], xx + 8, y - 26, 7, F.b); tekst(x[2], xx + 8, y - 35, 6, F.n, KL.grijs); });
    y -= 52;
    if (ko.top.length) { tekst('Hoogste kosten: ' + ko.top.map(w => w.naam + ' ' + eur(w.perJaar)).join(' · '), L, y, 8, F.n); y -= 11; }
    tekst('Per vervanging ' + eur(ko.perVervanging) + ' (' + (ko.standaard ? 'standaard schatting' : 'opbouw door HR ingesteld') + '; opbouw per kostenpost en aanpassen: Scorekaart > Kosten van verloop).', L, y, 6.8, F.i, KL.grijs);
    y -= 20;
  }
  // medewerkertevredenheid (laatste MTO-ronde)
  if (r.mto) {
    const m = r.mto, sc = x => x == null ? '-' : Number(x).toFixed(1).replace('.', ','), ep = x => x == null ? '-' : (x > 0 ? '+' : '') + x;
    kop('Medewerkertevredenheid · ' + m.ronde, 70);
    const bl = [[sc(m.totaal) + ' / 5', 'gemiddelde score', m.vorige ? m.vorige.naam + ': ' + sc(m.vorige.totaal) : m.n + ' reacties'], [ep(m.enps), 'eNPS', m.vorige ? 'vorige: ' + ep(m.vorige.enps) : ''], [m.laagste ? sc(m.laagste.score) : '-', 'zwakste thema', m.laagste ? m.laagste.naam : ''], [String(m.acties.lopend), 'acties lopend', (m.acties.teLaat ? m.acties.teLaat + ' over de deadline · ' : '') + m.acties.klaar + ' afgerond']];
    const bb = (B - 3 * 8) / 4;
    bl.forEach((x, i) => { const xx = L + i * (bb + 8); pg.drawRectangle({ x: xx, y: y - 40, width: bb, height: 40, color: i === 3 && m.acties.teLaat ? KL.roodL : KL.zand }); tekst(x[0], xx + 8, y - 15, 12, F.b); tekst(x[1], xx + 8, y - 26, 7, F.b); tekst(x[2], xx + 8, y - 35, 6, F.n, KL.grijs); });
    y -= 52;
    const ws = Object.values(m.perWinkel).filter(w => !w.verborgen && w.winkel !== '(geen winkel)').sort((a, b) => a.totaal - b.totaal);
    if (ws.length) { const rs = regels('Per winkel (laag naar hoog): ' + ws.map(w => w.winkel + ' ' + sc(w.totaal)).join(' · '), 8, F.n, B); rs.forEach(rg => { tekst(rg, L, y, 8); y -= 10.5; }); }
    tekst('Winkels met minder dan ' + m.minN + ' reacties worden niet getoond (anonimiteit). Volledig rapport: In dienst > Tevredenheid (MTO).', L, y, 6.8, F.i, KL.grijs);
    y -= 20;
  }

  // ---------- per winkel ----------
  y -= 6; if (y < 300) nieuwePagina((r.titel || 'HR-maandrapport ' + r.label));
  kop(r.winkel ? r.winkel + ' t.o.v. SLA' : 'Per winkel · laatste ' + r.winkelMaanden + ' maanden (' + r.periodeWinkels + ')', 120);
  const uitlegW = 'Per winkel kijken we naar de laatste ' + r.winkelMaanden + ' maanden: per maand zijn de aantallen per winkel te klein om iets te zeggen. Kleur = vergeleken met het SLA-gemiddelde over dezelfde periode (rood duidelijk slechter, oranje iets slechter, groen gelijk of beter, grijs te weinig gegevens).';
  regels(uitlegW, 7.5, F.n, B).forEach(rg => { tekst(rg, L, y, 7.5, F.n, KL.grijs); y -= 9.5; });
  y -= 8;
  const wk = { naam: L, best: L + 150, inu: L + 200, ver: L + 262, vz: L + 318, ci: L + 374, aa: L + 430 };
  const kopW = () => { tekst('Winkel', wk.naam, y, 7.5, F.b, KL.grijs); tekst('In dienst', wk.best, y, 7.5, F.b, KL.grijs); tekst('In / uit (' + r.label.split(' ')[0].slice(0, 3) + ')', wk.inu, y, 7.5, F.b, KL.grijs); tekst('Verloop', wk.ver, y, 7.5, F.b, KL.grijs); tekst('Verzuim', wk.vz, y, 7.5, F.b, KL.grijs); tekst('Check-in', wk.ci, y, 7.5, F.b, KL.grijs); tekst('Aandacht', wk.aa, y, 7.5, F.b, KL.grijs); y -= 6; lijn(0.8); };
  kopW();
  const badge = (s, x, st) => { const c = ST[st] || ST.geen, w = breed(s, 8, F.b) + 10; pg.drawRectangle({ x, y: y - 3.5, width: w, height: 12.5, color: c[1] }); tekst(s, x + 5, y, 8, F.b, c[0]); };
  for (const w of r.winkels) {
    if (y - 18 < 56) { nieuwePagina('Per winkel · ' + r.periodeWinkels); kopW(); }
    y -= 13;
    tekst(w.naam.length > 30 ? w.naam.slice(0, 29) + '…' : w.naam, wk.naam, y, 8.5, F.b);
    tekst(String(w.bestand), wk.best, y, 8.5);
    tekst(w.maand.instroom + ' / ' + w.maand.uitstroom, wk.inu, y, 8.5);
    badge(w.verloop, wk.ver, w.status.verloop); badge(w.verzuim, wk.vz, w.status.verzuim); badge(w.checkin, wk.ci, w.checkin === '-' ? 'klein' : w.status.checkin);
    let x = wk.aa; if (w.rood) { badge(String(w.rood), x, 'rood'); x += breed(String(w.rood), 8, F.b) + 14; } if (w.oranje) badge(String(w.oranje), x, 'oranje'); if (!w.rood && !w.oranje) tekst('-', wk.aa, y, 8.5, F.n, KL.grijs);
    y -= 5; lijn(0.4);
  }
  y -= 18;

  const metPunten = r.winkels.filter(w => w.aandacht.length || w.goed.length);
  if (metPunten.length) {
    kop('Aandachtspunten en wat goed gaat per winkel', 40);
    for (const w of metPunten) {
      const items = w.aandacht.map(s => ['rood', s]).concat(w.goed.slice(0, 2).map(s => ['groen', s]));
      const hoogte = 16 + items.reduce((h, it) => h + regels(it[1], 8.5, F.n, B - 16).length * 10.5 + 3, 0);
      ruimte(Math.min(hoogte, 200));
      tekst(w.naam, L, y, 9.5, F.b); y -= 12;
      items.forEach(([st, s]) => { const rs = regels(s, 8.5, F.n, B - 16); ruimte(rs.length * 10.5 + 3); pg.drawCircle({ x: L + 4, y: y + 3, size: 1.8, color: st === 'rood' ? KL.rood : KL.groen }); rs.forEach((rg, j) => tekst(rg, L + 12, y - j * 10.5, 8.5)); y -= rs.length * 10.5 + 3; });
      y -= 7;
    }
  }

  // voet
  const voet = 'Alleen geaggregeerde cijfers uit Shiftbase en het HR Dashboard. Check-in- en exitcijfers staan er pas bij vanaf ' + r.minN + ' reacties. Verloop deze maand = uitstroom in de maand / gemiddeld bestand; 12 maanden = over het hele jaar. Training is de stand op het moment van maken. pp = procentpunt.' + (door ? ' Gemaakt door ' + door + '.' : '') + (r.fouten && r.fouten.length ? ' Niet alles kon worden opgehaald: ' + r.fouten.join('; ') + '.' : '');
  const vr = regels(voet, 7, F.n, B); ruimte(vr.length * 9 + 12);
  y -= 4; vr.forEach(rg => { tekst(rg, L, y, 7, F.n, KL.grijs); y -= 9; });
  const pages = doc.getPages();
  pages.forEach((p, i) => { p.drawText(t('SLA HR · Maandrapport ' + (r.winkel ? r.winkel + ' · ' : '') + r.label + ' · vertrouwelijk'), { x: L, y: 26, size: 7, font: F.n, color: KL.grijs }); const s = t('pagina ' + (i + 1) + ' van ' + pages.length); p.drawText(s, { x: A4[0] - R - F.n.widthOfTextAtSize(s, 7), y: 26, size: 7, font: F.n, color: KL.grijs }); });
  return Buffer.from(await doc.save());
}
module.exports = { maakMaandrapportPdf };
