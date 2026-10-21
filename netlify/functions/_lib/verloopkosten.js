// ============================================================
// Fase 5c: kosten van verloop in euro's. Per vertrekker de kosten van één vervanging (werving, HR-administratie,
// inwerken, Academy-training en opstartverlies), maal de uitstroom per winkel uit de scorekaart.
// Alle bedragen zijn AANNAMES die HR zelf instelt (hr_instellingen 'verloop_kosten'):
//   { <post>: aantal, <tarief>: euro/uur, uit: [posten die niet meetellen], extra: [{ label, bedrag }] }
// De standaard hieronder is een voorzichtige schatting voor SLA. Het rapport laat altijd zien met welke aannames is gerekend.
// ============================================================
const I = require('./instellingen');

const POSTEN = [
  { key: 'wervingVast', label: 'Werving: vacatureplaatsing / advertenties', eenheid: 'EUR', std: 75, uitleg: 'Vacaturesites, social ads of wervingsbonus, gemiddeld per nieuwe medewerker.' },
  { key: 'wervingUren', label: 'Werving: uren leiding (selectie, gesprekken)', eenheid: 'uur leiding', std: 2, uitleg: 'Cv\'s doorlopen, bellen, sollicitatiegesprek en proefdraaien inplannen.' },
  { key: 'hrUren', label: 'HR-administratie in- en uitdienst', eenheid: 'uur HR', std: 1.5, uitleg: 'Contract, loonheffing, Shiftbase en Academy-account aanmaken, uitdienstbrief en eindafrekening.' },
  { key: 'meeloopUren', label: 'Inwerken: meeloopdiensten (extra bezetting)', eenheid: 'uur medewerker', std: 12, uitleg: 'Diensten waarin de nieuwe medewerker extra op het rooster staat en nog niet zelfstandig meedraait.' },
  { key: 'begeleidUren', label: 'Inwerken: begeleiding door leiding', eenheid: 'uur leiding', std: 4, uitleg: 'Uitleg, instructie en meekijken door de (junior) store manager of buddy.' },
  { key: 'academyUren', label: 'Training SLA Academy (betaalde uren)', eenheid: 'uur medewerker', std: 4, uitleg: 'Welkomstcollectie, voedselveiligheid en HACCP in SLA Academy.' },
  { key: 'opstartUren', label: 'Opstartverlies eerste weken (lagere productiviteit)', eenheid: 'uur medewerker', std: 24, uitleg: 'Een nieuwe medewerker werkt de eerste weken langzamer; uitgedrukt in uren loon zonder volledige opbrengst.' }
];
const TARIEVEN = [
  { key: 'uurMedewerker', label: 'Uurloon medewerker incl. werkgeverslasten', std: 17.5 },
  { key: 'uurLeiding', label: 'Uurloon (junior) store manager incl. lasten', std: 24 },
  { key: 'uurHR', label: 'Uurtarief HR', std: 35 }
];
const STANDAARD = {}; POSTEN.concat(TARIEVEN).forEach(p => { STANDAARD[p.key] = p.std; });
STANDAARD.uit = []; STANDAARD.extra = [];

function schoon(bron) {
  const p = Object.assign({}, STANDAARD, { uit: [], extra: [] });
  if (!bron || typeof bron !== 'object') return p;
  POSTEN.concat(TARIEVEN).forEach(x => { const n = Number(String(bron[x.key] == null ? '' : bron[x.key]).replace(',', '.')); if (bron[x.key] !== undefined && bron[x.key] !== '' && isFinite(n) && n >= 0) p[x.key] = n; });
  if (Array.isArray(bron.uit)) p.uit = bron.uit.filter(k => POSTEN.some(x => x.key === k));
  if (Array.isArray(bron.extra)) p.extra = bron.extra.map(e => ({ label: String(e && e.label || '').trim().slice(0, 80), bedrag: Number(String(e && e.bedrag || '').replace(',', '.')) })).filter(e => e.label && isFinite(e.bedrag) && e.bedrag >= 0).slice(0, 10);
  return p;
}
async function params() {
  const eigen = await I.lees('verloop_kosten', null);
  return { p: schoon(eigen), standaard: !(eigen && typeof eigen === 'object' && Object.keys(eigen).length) };
}
async function opslaan(nieuw, door) {
  if (nieuw === null) { await I.schrijf('verloop_kosten', {}, door); return schoon(null); }
  POSTEN.concat(TARIEVEN).forEach(x => { const n = Number(String(nieuw[x.key]).replace(',', '.')); if (nieuw[x.key] !== undefined && (!isFinite(n) || n < 0 || n > 10000)) throw new Error('Ongeldige waarde bij "' + x.label + '".'); });
  (nieuw.extra || []).forEach(e => { const n = Number(String(e.bedrag).replace(',', '.')); if (e.label && (!isFinite(n) || n < 0 || n > 10000)) throw new Error('Ongeldig bedrag bij "' + e.label + '".'); });
  const p = schoon(nieuw);
  POSTEN.concat(TARIEVEN).forEach(x => { p[x.key] = Math.round(p[x.key] * 100) / 100; });
  await I.schrijf('verloop_kosten', p, door);
  return p;
}
// Kosten van één vervanging, per post (ook de posten die uit staan, met meegenomen=false)
function perVervanging(p) {
  p = schoon(p);
  const uurVan = e => e === 'uur leiding' ? p.uurLeiding : e === 'uur HR' ? p.uurHR : e === 'uur medewerker' ? p.uurMedewerker : 1;
  const posten = POSTEN.map(x => ({ key: x.key, label: x.label, uitleg: x.uitleg, eenheid: x.eenheid, aantal: p[x.key], tarief: x.eenheid === 'EUR' ? null : uurVan(x.eenheid),
    bedrag: Math.round(p[x.key] * uurVan(x.eenheid) * 100) / 100, meegenomen: !p.uit.includes(x.key) }))
    .concat(p.extra.map((e, i) => ({ key: 'extra' + i, label: e.label, uitleg: 'Eigen kostenpost', eenheid: 'EUR', aantal: e.bedrag, tarief: null, bedrag: e.bedrag, meegenomen: true, extra: true })));
  return { posten, totaal: Math.round(posten.filter(x => x.meegenomen).reduce((a, x) => a + x.bedrag, 0)) };
}
// sk = scorekaart-resultaat (getScorekaart), maanden = periode
function bereken(sk, p, maanden) {
  p = schoon(p);
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
module.exports = { POSTEN, TARIEVEN, STANDAARD, schoon, params, opslaan, perVervanging, bereken };
