// ============================================================
// MTO-rapport als PDF (A4, pdf-lib) — per winkel, voor heel SLA, of een bundel (SLA + alle winkels met genoeg reacties).
// Opbouw per rapport (zelfde lijn als de rapporten na de nulmeting): kerncijfers, in het kort, scores per thema (met
// SLA-gemiddelde en verschil met de vorige ronde), eNPS, verbeterprioriteit, sterkste/zwakste stellingen, open antwoorden.
// Het SLA-rapport heeft daarnaast: overzicht per winkel, SLA makers vs store managers, verloop per ronde.
// Anoniem: alleen geaggregeerde cijfers en alleen voor groepen met >= MIN_N reacties (zie mto.pdfSecties).
// Status per thema: >= 75% van max (3,75) Goed · 55–74% (2,75) Matig · < 55% Aandacht nodig.
// ============================================================
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const P = require('./pdf');

const A4 = [595.28, 841.89], L = 44, R = 44, B = A4[0] - L - R;
const KL = { groen: rgb(0, 0.624, 0.294), donker: rgb(0.2, 0.239, 0.227), grijs: rgb(0.533, 0.502, 0.471), lijn: rgb(0.91, 0.886, 0.871), zand: rgb(0.973, 0.953, 0.941),
  rood: rgb(0.753, 0.224, 0.169), oranje: rgb(0.91, 0.51, 0.29), roodL: rgb(0.992, 0.925, 0.918), oranjeL: rgb(0.996, 0.945, 0.91), groenL: rgb(0.902, 0.969, 0.933), grijsL: rgb(0.94, 0.93, 0.92), passief: rgb(0.8, 0.77, 0.74) };
const ST = { Goed: [KL.groen, KL.groenL], Matig: [KL.oranje, KL.oranjeL], 'Aandacht nodig': [KL.rood, KL.roodL], geen: [KL.grijs, KL.grijsL] };
const GROEP = { alle: 'alle medewerkers', medewerker: 'SLA makers', manager: 'store managers' };
const WIE = { alle: 'medewerkers', medewerker: 'SLA makers', manager: 'store managers' };
const KORT = { werkplezier: 'Werkplezier', leidinggevende: 'Leiding', samenwerking: 'Samenw.', werkdruk: 'Werkdruk', ontwikkeling: 'Ontwikk.', beloning: 'Beloning', communicatie: 'Commun.', veiligheid: 'Veiligh.' };
const t = s => P.veilig(String(s == null ? '' : s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/—/g, '-').replace(/▲/g, '+').replace(/▼/g, '-'));
const nl = (x, d) => x == null ? '-' : (d ? Number(x).toFixed(d) : String(x)).replace('.', ',');
const sc = x => nl(x, 1); // scores altijd met één decimaal (4,0 i.p.v. 4)
const status = x => x == null ? 'geen' : x >= 3.75 ? 'Goed' : x >= 2.75 ? 'Matig' : 'Aandacht nodig';
const pctMax = x => x == null ? '-' : Math.round(x / 5 * 1000) / 10 + '%';
const enpsTxt = x => x == null ? '-' : (x > 0 ? '+' : '') + x;
const delta = (nu, oud, heel) => { if (nu == null || oud == null) return null; const d = heel ? Math.round(nu - oud) : Math.round((nu - oud) * 10) / 10; return d; };
const deltaTxt = (d, heel) => d == null ? '' : d === 0 ? '=' : (d > 0 ? '+' : '') + (heel ? d : nl(d));

// "In het kort": zinnen uit de cijfers
function zinnen(s, ctx) {
  const a = s.a, th = ctx.themas, naam = k => (th.find(x => x.key === k) || {}).nl || k, uit = [];
  const gesorteerd = th.map(x => [x.key, a.perThema[x.key]]).filter(x => x[1] != null).sort((p, q) => q[1] - p[1]);
  const wie = s.winkel ? 'In ' + s.winkel : 'Bij SLA';
  uit.push(wie + ' vulden ' + a.n + ' ' + WIE[ctx.groep] + ' de vragenlijst in' + (s.respons ? ' (respons ' + s.respons.pct + '%: ' + s.respons.ingevuld + ' van ' + s.respons.uitgenodigd + ')' : '') + '. De gemiddelde score is ' + sc(a.totaal) + ' / 5 (' + pctMax(a.totaal) + ' van max): ' + status(a.totaal).toLowerCase() + '.'
    + (s.winkel && ctx.sla && ctx.sla.a.totaal != null ? ' Het SLA-gemiddelde is ' + sc(ctx.sla.a.totaal) + (a.totaal > ctx.sla.a.totaal ? ', deze winkel scoort dus hoger.' : a.totaal < ctx.sla.a.totaal ? ', deze winkel scoort dus lager.' : ', deze winkel zit precies op het gemiddelde.') : ''));
  if (gesorteerd.length) uit.push('Sterkste thema: ' + naam(gesorteerd[0][0]) + ' (' + sc(gesorteerd[0][1]) + '). Grootste verbeterpunt: ' + naam(gesorteerd[gesorteerd.length - 1][0]) + ' (' + sc(gesorteerd[gesorteerd.length - 1][1]) + ').');
  if (a.enps != null) uit.push('De eNPS is ' + enpsTxt(a.enps) + ' (' + a.enpsAantal.promoter + ' promoters, ' + a.enpsAantal.passief + ' passief, ' + a.enpsAantal.criticus + ' critici): ' + (a.enps >= 30 ? 'sterk positief' : a.enps > 0 ? 'positief' : a.enps === 0 ? 'neutraal' : 'negatief, er zijn meer critici dan promoters') + '.');
  const top = a.prioriteit[0];
  if (top && top.n) uit.push('Meest gekozen verbeterprioriteit: ' + naam(top.key) + ' (' + top.n + ' van ' + a.n + ')' + (gesorteerd.length && top.key === gesorteerd[gesorteerd.length - 1][0] ? '; dat is ook het laagst scorende thema.' : '.'));
  if (s.vorige && !s.vorige.verborgen && s.vorige.n) {
    const d = th.map(x => [x.key, delta(a.perThema[x.key], s.vorige.perThema[x.key])]).filter(x => x[1] != null).sort((p, q) => q[1] - p[1]);
    let z = 'Ten opzichte van ' + ctx.vorigeNaam + ': gemiddelde ' + deltaTxt(delta(a.totaal, s.vorige.totaal)) + ', eNPS ' + deltaTxt(delta(a.enps, s.vorige.enps, true), true) + '.';
    if (d.length && d[0][1] > 0) z += ' Grootste stijging: ' + naam(d[0][0]) + ' (' + deltaTxt(d[0][1]) + ').';
    if (d.length && d[d.length - 1][1] < 0) z += ' Grootste daling: ' + naam(d[d.length - 1][0]) + ' (' + deltaTxt(d[d.length - 1][1]) + ').';
    uit.push(z);
  } else if (ctx.vorigeNaam && s.winkel) uit.push('Een vergelijking met ' + ctx.vorigeNaam + ' is er niet: toen waren er te weinig reacties voor deze winkel.');
  const vragen = stellingen(a, ctx);
  const laag = vragen.slice().sort((p, q) => p.gem - q.gem)[0];
  if (laag) uit.push('Laagst scorende stelling: "' + laag.nl + '" (' + sc(laag.gem) + (laag.neg ? '; ' + laag.neg + '% oneens' : '') + ').');
  return uit;
}
function stellingen(a, ctx) {
  const uit = []; ctx.themas.forEach(th => th.vragen.forEach(v => { const x = (a.perVraag || {})[v.key]; if (x && x.gem != null) uit.push({ key: v.key, nl: v.nl, thema: th.nl, gem: x.gem, pos: x.pos, neg: x.neg }); }));
  return uit;
}

async function maakMtoPdf(res, door) {
  const doc = await PDFDocument.create();
  const titelDoc = 'MTO ' + res.ronde.naam + (res.alleenWinkel ? ' - ' + res.winkels[0].winkel : res.bundel ? ' - SLA en winkels' : ' - SLA');
  doc.setTitle(t(titelDoc)); doc.setAuthor('SLA HR Team');
  const F = { n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique) };
  let pg, y, kopTitel = '';
  const tekst = (s, x, yy, size, font, kleur) => pg.drawText(t(s), { x, y: yy, size, font: font || F.n, color: kleur || KL.donker });
  const breed = (s, size, font) => (font || F.n).widthOfTextAtSize(t(s), size);
  const rechts = (s, xr, yy, size, font, kleur) => tekst(s, xr - breed(s, size, font), yy, size, font, kleur);
  const regels = (s, size, font, max) => { const woorden = t(s).split(/\s+/), uit = []; let rg = ''; woorden.forEach(wd => { const p = rg ? rg + ' ' + wd : wd; if ((font || F.n).widthOfTextAtSize(p, size) > max && rg) { uit.push(rg); rg = wd; } else rg = p; }); if (rg) uit.push(rg); return uit; };
  const lijn = (dik, kleur) => pg.drawLine({ start: { x: L, y }, end: { x: A4[0] - R, y }, thickness: dik || 0.5, color: kleur || KL.lijn });
  const badge = (s, x, yy, st, size) => { const c = ST[st] || ST.geen, sz = size || 7.5, w = breed(s, sz, F.b) + 10; pg.drawRectangle({ x, y: yy - 3.5, width: w, height: sz + 5, color: c[1] }); tekst(s, x + 5, yy, sz, F.b, c[0]); return w; };
  const deltaBadge = (d, x, yy, heel) => { if (d == null) return; const s = deltaTxt(d, heel); const c = d > 0 ? ST.Goed : d < 0 ? ST['Aandacht nodig'] : ST.geen; const w = breed(s, 7, F.b) + 8; pg.drawRectangle({ x, y: yy - 3, width: w, height: 11, color: c[1] }); tekst(s, x + 4, yy, 7, F.b, c[0]); };
  const nieuwePagina = (titel, sub) => {
    pg = doc.addPage(A4); y = A4[1] - 40; kopTitel = titel;
    tekst('SLA', L, y - 18, 20, F.b, KL.groen); tekst('the good food bar · HR', L, y - 29, 7.5, F.n, KL.grijs);
    rechts(titel, A4[0] - R, y - 12, 14, F.b); if (sub) rechts(sub, A4[0] - R, y - 25, 8, F.n, KL.grijs);
    y -= 44; lijn(1); y -= 20;
  };
  const ruimte = h => { if (y - h < 60) nieuwePagina(kopTitel); };
  const kop = (s, h) => { ruimte((h || 0) + 26); y -= 4; tekst(s, L, y, 11.5, F.b, KL.groen); y -= 6; lijn(0.8, KL.groen); y -= 14; };
  const alinea = (s, size, kleur, font) => { regels(s, size || 8.5, font, B).forEach(rg => { ruimte(12); tekst(rg, L, y, size || 8.5, font, kleur || KL.grijs); y -= (size || 8.5) + 3; }); };

  // ---------- één rapportdeel (SLA of winkel) ----------
  function deel(s, isSla) {
    const a = s.a, titel = isSla ? 'Medewerkertevredenheid SLA' : 'Medewerkertevredenheid ' + s.winkel;
    nieuwePagina(titel, res.ronde.naam + ' · ' + GROEP[res.groep]);
    // kerncijfers
    const tegels = [
      [String(a.n), 'Reacties', (a.taal.NL || 0) + ' NL · ' + (a.taal.EN || 0) + ' EN' + (s.respons ? ' · respons ' + s.respons.pct + '%' : '')],
      [sc(a.totaal) + ' / 5', 'Gemiddelde score', pctMax(a.totaal) + ' van max' + (!isSla && res.sla.a.totaal != null ? ' · SLA ' + sc(res.sla.a.totaal) : '')],
      [enpsTxt(a.enps), 'eNPS', a.enpsAantal.promoter + ' promoters · ' + a.enpsAantal.passief + ' passief · ' + a.enpsAantal.criticus + ' critici'],
      [s.vorige && !s.vorige.verborgen && s.vorige.n ? deltaTxt(delta(a.totaal, s.vorige.totaal)) : '-', 'Verschil vorige ronde', s.vorige && !s.vorige.verborgen && s.vorige.n ? res.vorigeNaam + ': ' + nl(s.vorige.totaal) : (res.vorigeNaam ? 'te weinig reacties toen' : 'eerste meting')]
    ];
    const tb = (B - 3 * 8) / 4;
    tegels.forEach((tg, i) => { const x = L + i * (tb + 8); pg.drawRectangle({ x, y: y - 50, width: tb, height: 50, color: KL.zand }); pg.drawRectangle({ x, y: y - 2, width: tb, height: 2, color: i === 1 ? (ST[status(a.totaal)] || ST.geen)[0] : i === 2 ? (a.enps >= 0 ? KL.groen : KL.rood) : KL.donker });
      tekst(tg[0], x + 9, y - 22, 16, F.b); tekst(tg[1], x + 9, y - 33, 7.5, F.b); regels(tg[2], 6.3, F.n, tb - 14).slice(0, 2).forEach((rg, j) => tekst(rg, x + 9, y - 42 - j * 7.5, 6.3, F.n, KL.grijs)); });
    y -= 70;
    kop('In het kort');
    zinnen(s, res).forEach(z => { const rs = regels(z, 9, F.n, B - 14); ruimte(rs.length * 11.5 + 4); pg.drawCircle({ x: L + 3, y: y + 3, size: 1.6, color: KL.groen }); rs.forEach((rg, j) => tekst(rg, L + 11, y - j * 11.5, 9)); y -= rs.length * 11.5 + 5; });
    y -= 4;

    // scores per thema
    kop('Scores per thema', 150);
    const k = { naam: L, bar: L + 150, sc: L + 312, pm: L + 344, sla: L + 386, dv: L + 420, st: L + 458 };
    const bw = k.sc - k.bar - 12;
    tekst('Thema', k.naam, y, 7, F.b, KL.grijs); tekst('Score (1-5)', k.bar, y, 7, F.b, KL.grijs); tekst('Gem.', k.sc, y, 7, F.b, KL.grijs); tekst('% max', k.pm, y, 7, F.b, KL.grijs); if (!isSla) tekst('SLA', k.sla, y, 7, F.b, KL.grijs); tekst('Vorige', k.dv, y, 7, F.b, KL.grijs); tekst('Status', k.st, y, 7, F.b, KL.grijs);
    y -= 5; lijn(0.6); y -= 3;
    res.themas.forEach(th => {
      const x = a.perThema[th.key], sl = res.sla.a.perThema[th.key], vo = s.vorige && !s.vorige.verborgen && s.vorige.n ? s.vorige.perThema[th.key] : null;
      y -= 14;
      tekst(th.nl, k.naam, y, 8.5, F.b);
      pg.drawRectangle({ x: k.bar, y: y - 1, width: bw, height: 9, color: KL.grijsL });
      if (x != null) pg.drawRectangle({ x: k.bar, y: y - 1, width: Math.max(1, (x - 1) / 4 * bw), height: 9, color: (ST[status(x)] || ST.geen)[0] });
      if (!isSla && sl != null) pg.drawRectangle({ x: k.bar + (sl - 1) / 4 * bw - 0.75, y: y - 3, width: 1.5, height: 13, color: KL.donker });
      tekst(sc(x), k.sc, y, 8.5, F.b); tekst(pctMax(x), k.pm, y, 8);
      if (!isSla) tekst(sc(sl), k.sla, y, 8, F.n, KL.grijs);
      if (vo != null) deltaBadge(delta(x, vo), k.dv, y); else tekst('-', k.dv, y, 8, F.n, KL.grijs);
      badge(status(x), k.st, y, status(x), 7);
      y -= 4; lijn(0.3);
    });
    y -= 14;
    tekst('TOTAAL', k.naam, y, 8.5, F.b); tekst(sc(a.totaal), k.sc, y, 9, F.b); tekst(pctMax(a.totaal), k.pm, y, 8, F.b); if (!isSla) tekst(sc(res.sla.a.totaal), k.sla, y, 8, F.n, KL.grijs);
    if (s.vorige && !s.vorige.verborgen && s.vorige.n) deltaBadge(delta(a.totaal, s.vorige.totaal), k.dv, y); badge(status(a.totaal), k.st, y, status(a.totaal), 7);
    y -= 14;
    tekst('Goed = 75% van max of meer (3,75+) · Matig = 55-74% · Aandacht nodig = onder 55%.' + (!isSla ? ' Het streepje in de balk is het SLA-gemiddelde.' : ''), L, y, 6.8, F.i, KL.grijs);
    y -= 18;

    // eNPS + prioriteit naast elkaar
    kop('Aanbeveling (eNPS) en verbeterprioriteit', 130);
    const half = (B - 20) / 2, x2 = L + half + 20, y0 = y;
    const uitlegR = regels('"Hoe waarschijnlijk is het dat je SLA aanraadt als werkgever?" 9-10 = promoter, 7-8 = passief, 0-6 = criticus. eNPS = % promoters - % critici (-100 tot +100).', 6.8, F.n, half);
    uitlegR.forEach((rg, j) => tekst(rg, L, y - j * 8.5, 6.8, F.n, KL.grijs));
    let yl = y - uitlegR.length * 8.5 - 26;
    tekst(enpsTxt(a.enps), L, yl + 4, 22, F.b, a.enps >= 0 ? KL.groen : KL.rood); tekst('eNPS', L + breed(enpsTxt(a.enps), 22, F.b) + 6, yl + 4, 8, F.b, KL.grijs);
    yl -= 18;
    const tot = a.n || 1, seg = [[a.enpsAantal.promoter, KL.groen, 'promoters'], [a.enpsAantal.passief, KL.passief, 'passief'], [a.enpsAantal.criticus, KL.rood, 'critici']];
    let xs = L; seg.forEach(sg => { const w = sg[0] / tot * half; if (w > 0) { pg.drawRectangle({ x: xs, y: yl, width: w, height: 14, color: sg[1] }); if (w > 16) tekst(Math.round(sg[0] / tot * 100) + '%', xs + 4, yl + 4, 7, F.b, rgb(1, 1, 1)); } xs += w; });
    yl -= 12;
    let xl = L; seg.forEach(sg => { pg.drawRectangle({ x: xl, y: yl, width: 7, height: 7, color: sg[1] }); const s2 = sg[0] + ' ' + sg[2]; tekst(s2, xl + 10, yl, 7.5, F.n, KL.grijs); xl += breed(s2, 7.5) + 22; });
    yl -= 12;
    if (s.vorige && !s.vorige.verborgen && s.vorige.n && s.vorige.enps != null) { tekst('Vorige ronde: ' + enpsTxt(s.vorige.enps), L, yl, 7.5, F.n, KL.grijs); deltaBadge(delta(a.enps, s.vorige.enps, true), L + 72, yl, true); yl -= 12; }
    if (!isSla && res.sla.a.enps != null) { tekst('SLA-gemiddelde: ' + enpsTxt(res.sla.a.enps), L, yl, 7.5, F.n, KL.grijs); yl -= 12; }
    // prioriteit
    let yr = y0;
    tekst('"Welk thema heeft de hoogste prioriteit om te verbeteren?"', x2, yr, 6.8, F.n, KL.grijs); yr -= 14;
    const naamTh = kk => (res.themas.find(x => x.key === kk) || {}).nl || kk, mx = Math.max(1, ...a.prioriteit.map(p => p.n));
    a.prioriteit.forEach(p => {
      tekst(naamTh(p.key), x2, yr, 7.8, p.n === mx ? F.b : F.n);
      const bx = x2 + 128, bwp = half - 128 - 34;
      pg.drawRectangle({ x: bx, y: yr - 1, width: bwp, height: 8, color: KL.grijsL });
      if (p.n) pg.drawRectangle({ x: bx, y: yr - 1, width: p.n / mx * bwp, height: 8, color: p.n === mx ? KL.oranje : KL.donker });
      rechts(p.n + ' (' + p.pct + '%)', x2 + half, yr, 7.3, F.n, KL.grijs);
      yr -= 12.5;
    });
    y = Math.min(yl, yr) - 10;

    // sterkste / zwakste stellingen
    const v = stellingen(a, res);
    if (v.length) {
      kop('Sterkste en zwakste stellingen', 90);
      const lijst = (titel, items, kleur) => {
        ruimte(30); tekst(titel, L, y, 8, F.b, kleur); rechts('gem.   eens   oneens', A4[0] - R, y, 7, F.b, KL.grijs); y -= 4; lijn(0.5); y -= 2;
        items.forEach(it => { const rs = regels(it.nl, 8, F.n, B - 120); ruimte(rs.length * 10 + 12); y -= 11; rs.forEach((rg, j) => tekst(rg, L, y - j * 10, 8)); tekst(it.thema, L, y - rs.length * 10 + 1, 6.3, F.n, KL.grijs);
          rechts(sc(it.gem), A4[0] - R - 62, y, 8.5, F.b, (ST[status(it.gem)] || ST.geen)[0]); rechts(it.pos + '%', A4[0] - R - 32, y, 8); rechts(it.neg + '%', A4[0] - R, y, 8, it.neg >= 25 ? F.b : F.n, it.neg >= 25 ? KL.rood : KL.donker);
          y -= rs.length * 10 + 5; lijn(0.3); });
        y -= 12;
      };
      lijst('Top 5: hier zijn medewerkers het meest tevreden over', v.slice().sort((p, q) => q.gem - p.gem).slice(0, 5), KL.groen);
      lijst('Laagste 5: hier liggen de verbeterkansen', v.slice().sort((p, q) => p.gem - q.gem).slice(0, 5), KL.rood);
    }

    // open antwoorden
    if (s.opmerkingen && s.opmerkingen.length) {
      kop('Open antwoorden: "Wat zou jouw werk bij SLA nog beter maken?"', 40);
      alinea('Letterlijk overgenomen, alfabetisch gesorteerd (niet in invulvolgorde).', 7, KL.grijs, F.i); y -= 4;
      s.opmerkingen.forEach(o => { const rs = regels('"' + o + '"', 8.3, F.n, B - 16); ruimte(rs.length * 10.5 + 8); pg.drawRectangle({ x: L, y: y - (rs.length - 1) * 10.5 - 4, width: 2, height: rs.length * 10.5 + 2, color: KL.groen }); rs.forEach((rg, j) => tekst(rg, L + 8, y - j * 10.5, 8.3)); y -= rs.length * 10.5 + 6; });
    }
  }

  function actieplan(s) {
    if (!s.acties || !s.acties.length) return;
    kop('Actieplan' + (s.winkel ? ' ' + s.winkel : ' SLA-breed'), 40);
    const STA = { open: ['Open', 'geen'], bezig: ['Bezig', 'Matig'], klaar: ['Klaar', 'Goed'], vervallen: ['Vervallen', 'geen'] };
    tekst('Actie', L, y, 7, F.b, KL.grijs); tekst('Eigenaar', L + 300, y, 7, F.b, KL.grijs); tekst('Deadline', L + 390, y, 7, F.b, KL.grijs); tekst('Status', L + 448, y, 7, F.b, KL.grijs); y -= 5; lijn(0.6);
    s.acties.forEach(a => {
      const rs = regels(a.titel, 8.5, F.b, 290), sub = a.themaNaam + (a.resultaat ? ' · resultaat: ' + a.resultaat : ''), rs2 = regels(sub, 6.8, F.n, 290);
      ruimte(rs.length * 10.5 + rs2.length * 8.5 + 14); y -= 12;
      rs.forEach((rg, j) => tekst(rg, L, y - j * 10.5, 8.5, F.b)); rs2.forEach((rg, j) => tekst(rg, L, y - rs.length * 10.5 - j * 8.5 + 1, 6.8, F.n, KL.grijs));
      tekst(a.eigenaar || '-', L + 300, y, 8); tekst(a.deadlineNL || '-', L + 390, y, 8, a.teLaat ? F.b : F.n, a.teLaat ? KL.rood : KL.donker);
      const st = STA[a.status] || [a.status, 'geen']; badge(st[0], L + 448, y, st[1], 7);
      y -= rs.length * 10.5 + rs2.length * 8.5 - 4; lijn(0.3);
    });
    y -= 12;
  }

  // ---------- extra voor het SLA-rapport ----------
  function slaExtra() {
    kop('Per winkel', 80);
    alinea('Gemiddelde score per thema (1-5). Winkels met minder dan ' + res.minN + ' reacties worden niet getoond (anonimiteit).', 7.5);
    y -= 4;
    const k0 = L, kn = L + 104, kr = L + 128, kg = L + 160, ke = L + 190, kt = L + 222, tw = (A4[0] - R - kt) / res.themas.length;
    const kopRij = () => { tekst('Winkel', k0, y, 6.8, F.b, KL.grijs); tekst('n', kn, y, 6.8, F.b, KL.grijs); tekst('Resp.', kr, y, 6.8, F.b, KL.grijs); tekst('Gem.', kg, y, 6.8, F.b, KL.grijs); tekst('eNPS', ke, y, 6.8, F.b, KL.grijs); res.themas.forEach((th, i) => tekst(KORT[th.key] || th.nl.slice(0, 8), kt + i * tw, y, 6.3, F.b, KL.grijs)); y -= 5; lijn(0.6); };
    kopRij();
    const cel = (x, xx, yy) => { if (x == null) { tekst('-', xx + 6, yy, 7.5, F.n, KL.grijs); return; } const c = ST[status(x)] || ST.geen; pg.drawRectangle({ x: xx, y: yy - 3, width: tw - 4, height: 11.5, color: c[1] }); tekst(sc(x), xx + 5, yy, 7.5, F.b, c[0]); };
    res.perWinkel.forEach(w => {
      if (y - 16 < 60) { nieuwePagina(kopTitel); kopRij(); }
      y -= 13; tekst(w.winkel, k0, y, 8, F.b); tekst(String(w.a.n), kn, y, 8); tekst(w.respons ? w.respons.pct + '%' : '-', kr, y, 8, F.n, KL.grijs);
      if (w.a.verborgen || !w.a.n || w.a.totaal == null) tekst('minder dan ' + res.minN + ' reacties', kg, y, 7.5, F.i, KL.grijs);
      else { cel(w.a.totaal, kg - 2, y); tekst(enpsTxt(w.a.enps), ke, y, 8); res.themas.forEach((th, i) => cel(w.a.perThema[th.key], kt + i * tw, y)); }
      y -= 5; lijn(0.3);
    });
    y -= 18;
    kop('SLA makers en store managers', 60);
    const gk = { g: L, n: L + 100, r: L + 136, gm: L + 176, e: L + 214, l: L + 256, h: L + 380 };
    tekst('Groep', gk.g, y, 7, F.b, KL.grijs); tekst('n', gk.n, y, 7, F.b, KL.grijs); tekst('Respons', gk.r, y, 7, F.b, KL.grijs); tekst('Gem.', gk.gm, y, 7, F.b, KL.grijs); tekst('eNPS', gk.e, y, 7, F.b, KL.grijs); tekst('Laagste thema', gk.l, y, 7, F.b, KL.grijs); tekst('Hoogste thema', gk.h, y, 7, F.b, KL.grijs); y -= 5; lijn(0.6);
    res.groepen.forEach(gp => {
      y -= 13; tekst(GROEP[gp.groep].replace(/^./, c => c.toUpperCase()), gk.g, y, 8, F.b); tekst(String(gp.a.n), gk.n, y, 8); tekst(gp.respons ? gp.respons.pct + '%' : '-', gk.r, y, 8, F.n, KL.grijs);
      if (gp.a.verborgen || !gp.a.n || gp.a.totaal == null) tekst('minder dan ' + res.minN + ' reacties', gk.gm, y, 7.5, F.i, KL.grijs);
      else { const ks = Object.keys(gp.a.perThema).filter(kk => gp.a.perThema[kk] != null).sort((p, q) => gp.a.perThema[p] - gp.a.perThema[q]); const nm = kk => (res.themas.find(x => x.key === kk) || {}).nl;
        tekst(sc(gp.a.totaal), gk.gm, y, 8, F.b); tekst(enpsTxt(gp.a.enps), gk.e, y, 8); tekst(nm(ks[0]) + ' ' + nl(gp.a.perThema[ks[0]]), gk.l, y, 7.5); tekst(nm(ks[ks.length - 1]) + ' ' + nl(gp.a.perThema[ks[ks.length - 1]]), gk.h, y, 7.5); }
      y -= 5; lijn(0.3);
    });
    if (res.trend && res.trend.length) {
      y -= 18; kop('Verloop per ronde', 20 + res.trend.length * 14);
      res.trend.forEach(r => { y -= 13; tekst(r.naam, L, y, 8, F.b); if (r.verborgen) { tekst(r.n + ' reacties (te weinig)', L + 170, y, 7.5, F.i, KL.grijs); return; }
        const bx = L + 170, bwt = 200; pg.drawRectangle({ x: bx, y: y - 1, width: bwt, height: 9, color: KL.grijsL }); pg.drawRectangle({ x: bx, y: y - 1, width: (r.totaal - 1) / 4 * bwt, height: 9, color: (ST[status(r.totaal)] || ST.geen)[0] });
        tekst(sc(r.totaal) + ' / 5', bx + bwt + 8, y, 8, F.b); tekst('eNPS ' + enpsTxt(r.enps) + ' · n=' + r.n, bx + bwt + 52, y, 7.5, F.n, KL.grijs); });
      y -= 10;
    }
  }

  // ---------- samenstellen ----------
  if (!res.alleenWinkel) { deel(res.sla, true); actieplan(res.sla); slaExtra(); }
  (res.winkels || []).forEach(w => { deel(w, false); actieplan(w); });
  if (res.bundel && res.overgeslagen && res.overgeslagen.length) { ruimte(40); y -= 10; alinea('Geen apart rapport (minder dan ' + res.minN + ' reacties): ' + res.overgeslagen.map(w => w.winkel + ' (' + w.n + ')').join(', ') + '. Hun antwoorden tellen wel mee in het SLA-totaal.', 8, KL.grijs, F.i); }

  // voet + paginanummers
  const voet = 'Vertrouwelijk - alleen voor intern gebruik. Anoniem: antwoorden zijn opgeslagen zonder naam; groepen met minder dan ' + res.minN + ' reacties worden niet getoond.';
  const pages = doc.getPages();
  pages.forEach((p, i) => { p.drawText(t(voet), { x: L, y: 26, size: 6.5, font: F.n, color: KL.grijs }); const s = t((i + 1) + ' / ' + pages.length); p.drawText(s, { x: A4[0] - R - F.n.widthOfTextAtSize(s, 6.5), y: 26, size: 6.5, font: F.n, color: KL.grijs }); });
  if (door) doc.setSubject(t('Gemaakt door ' + door));
  return Buffer.from(await doc.save());
}

function bestandsnaam(res) {
  const s = x => String(x).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  return 'MTO_' + s(res.ronde.naam) + '_' + (res.alleenWinkel ? s(res.winkels[0].winkel) : res.bundel ? 'SLA_en_winkels' : 'SLA') + (res.groep !== 'alle' ? '_' + (res.groep === 'manager' ? 'storemanagers' : 'SLA_makers') : '') + '.pdf';
}
module.exports = { maakMtoPdf, bestandsnaam, status };
