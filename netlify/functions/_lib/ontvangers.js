// ============================================================
// v0.37.0: Ontvangers van de automatische checks, beheerbaar in het dashboard (Beheer → Signaleringen).
// Standaard = C.SIGNALERING_ONTVANGERS / C.KEUKEN_EMAIL uit config.js. Afwijkingen staan in hr_instellingen
// onder sleutel 'signalering_ontvangers' als { <sleutel>: ['a@x.nl', ...], keuken: [...] }.
// laad() zet de afwijkingen over de config heen (C wordt gedeeld door alle libs), zodat de bestaande
// ontvangers()-helpers en KEUKEN() zonder verdere wijziging de juiste adressen gebruiken.
// ============================================================
const C = require('./config');
const I = require('./instellingen');

const SLEUTEL = 'signalering_ontvangers';
const lijst = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const STANDAARD = Object.assign({}, ...Object.keys(C.SIGNALERING_ONTVANGERS).map(k => ({ [k]: lijst(C.SIGNALERING_ONTVANGERS[k]) })), { keuken: lijst(C.KEUKEN_EMAIL) });
const MAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Welke ontvanger-sleutel hoort bij welke check (kaart). keuken:true = keukenmeldingen gaan apart naar de keuken-ontvangers.
const PER_CHECK = {
  'mail-bounces': { sleutel: 'mail-bounces', keuken: true },
  'jubilea': { sleutel: 'jubilea', keuken: true },
  'datacontrole': { sleutel: 'datacontrole', keuken: true },
  'zomerpiek': { sleutel: 'zomerpiek', keuken: true },
  'nieuwe-medewerkers': { sleutel: 'nieuweMedewerkers', keuken: true },
  'stille-afwezigen': { sleutel: 'stilleAfwezigen', keuken: true },
  'vakantiepieken': { sleutel: 'vakantiepiek', keuken: true },
  'bewaartermijnen': { sleutel: 'bewaartermijn' },
  'data-hygiene': { sleutel: 'dataHygiene', keuken: true },
  'contractketen': { sleutel: 'contractketen', keuken: true },
  'verzuim': { sleutel: 'verzuim', keuken: true },
  'jeugd': { sleutel: 'jeugd', keuken: true },
  'oproepaanbod': { sleutel: 'oproepaanbod', keuken: true },
  'checkin': { sleutel: 'checkin', keuken: true },
  'maandrapport': { sleutel: 'maandrapport' },
  'salaris': { sleutel: 'salaris', keuken: true },
  'mto': { sleutel: 'mto' }
};

async function afwijkingen() { const v = await I.lees(SLEUTEL, {}); return v && typeof v === 'object' ? v : {}; }

// Effectieve ontvangers: { sleutel: { adressen:[...], standaard:[...], aangepast:bool } }
async function laad() {
  const af = await afwijkingen(), uit = {};
  for (const k of Object.keys(STANDAARD)) {
    const eigen = Array.isArray(af[k]) && af[k].length ? af[k] : null;
    uit[k] = { adressen: eigen || STANDAARD[k], standaard: STANDAARD[k], aangepast: !!eigen };
    if (k === 'keuken') C.KEUKEN_EMAIL = uit[k].adressen.join(',');
    else C.SIGNALERING_ONTVANGERS[k] = uit[k].adressen.join(',');
  }
  return uit;
}

// adressen = null of [] → terug naar standaard
async function schrijf(sleutel, adressen, door) {
  if (!Object.prototype.hasOwnProperty.call(STANDAARD, sleutel)) throw new Error('Onbekende ontvangerlijst: ' + sleutel);
  const schoon = Array.from(new Set((adressen || []).map(a => String(a || '').trim().toLowerCase()).filter(Boolean)));
  const fout = schoon.filter(a => !MAIL_RE.test(a));
  if (fout.length) throw new Error('Ongeldig mailadres: ' + fout.join(', '));
  if (adressen && adressen.length && !schoon.length) throw new Error('Er moet minimaal één mailadres overblijven.');
  const af = Object.assign({}, await afwijkingen());
  const gelijk = schoon.length === STANDAARD[sleutel].length && schoon.every((a, i) => a === String(STANDAARD[sleutel][i]).toLowerCase());
  if (!schoon.length || gelijk) delete af[sleutel]; else af[sleutel] = schoon;
  await I.schrijf(SLEUTEL, af, door);
  return laad();
}

module.exports = { laad, schrijf, PER_CHECK, STANDAARD, MAIL_RE };
