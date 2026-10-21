// ============================================================
// Fase 5c: kosten van verloop in euro's. Per vertrekker de kosten van één vervanging (werving, HR-administratie,
// inwerken, Academy-training en opstartverlies), maal de uitstroom per winkel uit de scorekaart.
// Alle bedragen zijn AANNAMES die HR zelf instelt (hr_instellingen 'verloop_kosten'); de standaard hieronder is een
// voorzichtige schatting voor SLA. Het rapport laat altijd zien met welke aannames is gerekend.
// ============================================================
const I = require('./instellingen');

const POSTEN = [
  { key: 'wervingVast', label: 'Werving: vacatureplaatsing / advertenties', eenheid: 'EUR', std: 75 },
  { key: 'wervingUren', label: 'Werving: uren leiding (selectie, gesprekken)', eenheid: 'uur leiding', std: 2 },
  { key: 'hrUren', label: 'HR-administratie in- en uitdienst', eenheid: 'uur HR', std: 1.5 },
  { key: 'meeloopUren', label: 'Inwerken: meeloopdiensten (extra bezetting)', eenheid: 'uur medewerker', std: 12 },
  { key: 'begeleidUren', label: 'Inwerken: begeleiding door leiding', eenheid: 'uur leiding', std: 4 },
  { key: 'academyUren', label: 'Training SLA Academy (betaalde uren)', eenheid: 'uur medewerker', std: 4 },
  { key: 'opstartUren', label: 'Opstartverlies eerste weken (lagere productiviteit)', eenheid: 'uur medewerker', std: 24 }
];
const TARIEVEN = [
  { key: 'uurMedewerker', label: 'Uurloon medewerker incl. werkgeverslasten', std: 17.5 },
  { key: 'uurLeiding', label: 'Uurloon (junior) store manager incl. lasten', std: 24 },
  { key: 'uurHR', label: 'Uurtarief HR', std: 35 }
];
const STANDAARD = {}; POSTEN.concat(TARIEVEN).forEach(p => { STANDAARD[p.key] = p.std; });

async function params() {
  const eigen = await I.lees('verloop_kosten', null);
  const p = Object.assign({}, STANDAARD);
  if (eigen && typeof eigen === 'object') Object.keys(STANDAARD).forEach(k => { const n = Number(eigen[k]); if (isFinite(n) && n >= 0) p[k] = n; });
  return { p, standaard: !(eigen && typeof eigen === 'object' && Object.keys(eigen).length) };
}
async function opslaan(nieuw, door) {
  if (nieuw === null) { await I.schrijf('verloop_kosten', {}, door); return Object.assign({}, STANDAARD); }
  const p = {};
  Object.keys(STANDAARD).forEach(k => { const n = Number(String(nieuw[k]).replace(',', '.')); if (!isFinite(n) || n < 0 || n > 10000) throw new Error('Ongeldige waarde voor ' + k); p[k] = Math.round(n * 100) / 100; });
  await I.schrijf('verloop_kosten', p, door);
  return p;
}
// Kosten van één vervanging, per post
function perVervanging(p) {
  const uurVan = e => e === 'uur leiding' ? p.uurLeiding : e === 'uur HR' ? p.uurHR : e === 'uur medewerker' ? p.uurMedewerker : 1;
  const posten = POSTEN.map(x => ({ key: x.key, label: x.label, eenheid: x.eenheid, aantal: p[x.key], tarief: x.eenheid === 'EUR' ? null : uurVan(x.eenheid), bedrag: Math.round(p[x.key] * uurVan(x.eenheid) * 100) / 100 }));
  return { posten, totaal: Math.round(posten.reduce((a, x) => a + x.bedrag, 0)) };
}
// sk = scorekaart-resultaat (getScorekaart), maanden = periode
function bereken(sk, p, maanden) {
  const pv = perVervanging(p), K = pv.totaal, jaarFactor = 12 / (maanden || 12);
  const vroegVan = w => { const pct = w.waarden.vroegPct && w.waarden.vroegPct.v; return pct != null && w.uitstroom ? Math.round(w.uitstroom * pct / 100) : 0; };
  const slaVerloop = sk.totaal.waarden.verloop ? sk.totaal.waarden.verloop.v : null;
  const winkels = sk.winkels.map(w => {
    const vroeg = vroegVan(w), kosten = w.uitstroom * K, verloop = w.waarden.verloop ? w.waarden.verloop.v : null;
    // als deze winkel op het SLA-gemiddelde zat: zoveel minder vertrekkers (alleen als hij erboven zit)
    const teveel = verloop != null && slaVerloop != null && verloop > slaVerloop && verloop > 0 ? Math.round(w.uitstroom * (1 - slaVerloop / verloop) * 10) / 10 : 0;
    return { naam: w.naam, bestand: w.bestand, uitstroom: w.uitstroom, verloop, vroeg, kosten: Math.round(kosten), perJaar: Math.round(kosten * jaarFactor), perMedewerker: w.bestand ? Math.round(kosten * jaarFactor / w.bestand) : null,
      vroegKosten: Math.round(vroeg * K), teveel, besparingNaarGemiddelde: Math.round(teveel * K * jaarFactor) };
  }).sort((a, b) => b.perJaar - a.perJaar);
  const t = sk.totaal, vroegT = vroegVan(t), kostenT = t.uitstroom * K;
  return {
    periode: sk.periode, maanden, perVervanging: pv, params: p,
    totaal: { uitstroom: t.uitstroom, bestand: t.bestand, verloop: slaVerloop, kosten: Math.round(kostenT), perJaar: Math.round(kostenT * jaarFactor), vroeg: vroegT, vroegKosten: Math.round(vroegT * K),
      perMedewerker: t.bestand ? Math.round(kostenT * jaarFactor / t.bestand) : null },
    scenario: {
      tienProcentMinder: Math.round(t.uitstroom * 0.1 * K * jaarFactor),            // 10% minder vertrekkers
      halveVroeg: Math.round(vroegT / 2 * K * jaarFactor),                            // de helft van de vroege vertrekkers houden
      naarGemiddelde: winkels.reduce((a, w) => a + w.besparingNaarGemiddelde, 0)     // winkels boven het SLA-verloop naar het gemiddelde
    },
    winkels
  };
}
module.exports = { POSTEN, TARIEVEN, STANDAARD, params, opslaan, perVervanging, bereken };
