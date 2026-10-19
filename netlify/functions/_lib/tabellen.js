// ============================================================
// Tabelregister: de Supabase-tabellen die de Google-Sheet-tabs vervangen
// (stap 6, "helemaal over"). Eén plek voor
//   - welke sheet/tab bij welke tabel hoort (voor de import én voor de
//     adapter in data.js, die dezelfde (sheetId, tab, rij, kolom)-aanroepen
//     als sheets.js blijft accepteren),
//   - de kolommen in sheet-volgorde (kolom A = index 0) met hun kopregel.
// Alle kolommen zijn tekst, exact zoals de sheet ze toonde (dd-mm-jjjj,
// 'Ja', 'Verzonden op …'): de rest van de code hoeft daardoor niets te
// weten van de overstap. `rij` is de primaire sleutel en blijft bij de
// import gelijk aan het sheet-rijnummer; nieuwe rijen krijgen max(rij)+1.
// Archief: geen aparte tab meer maar gearchiveerd_op/door/bron op de rij.
// ============================================================
const { SHEETS, TAB_WAARSCHUWINGEN, TAB_BESCHIKBAARHEID, TAB_KORTING, TAB_NOTITIES, TAB_ARCHIEF } = require('./config');

const k = (naam, kop) => ({ naam, kop });

const TABELLEN = {
  hr_loonheffing: {
    sheet: 'loonheffing', tab: null, label: 'Loonheffing', archief: true, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('deadline', 'Deadline'), k('status', 'Status'), k('verzenddatum', 'Verzenddatum'),
      k('ontvangen', 'Formulier ontvangen'), k('taal', 'Taal'), k('herinnering', 'Herinnering'), k('aantal_herinneringen', 'Aantal herinneringen'),
      k('mahdia', 'Naar Mahdia'), k('salaris', 'Naar salaris')]
  },
  hr_ontslag: {
    sheet: 'ontslag', tab: null, label: 'Ontslag', archief: true, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('opzegging', 'Datum opzegging'), k('einddatum', 'Einddatum'), k('kol_e', 'E'),
      k('bedrijf', 'Bedrijf (BV)'), k('adres', 'Adres'), k('status', 'Status'), k('verzenddatum', 'Verzenddatum'), k('ondertekend', 'Ondertekend'),
      k('herinnering', 'Herinnering'), k('aantal_herinneringen', 'Aantal herinneringen'), k('kol_m', 'M'), k('mahdia', 'Naar Mahdia'),
      k('salaris', 'Naar salaris'), k('brief_url', 'Brief'), k('uitstroomreden', 'Uitstroomreden')]
  },
  hr_sommatie: {
    sheet: 'sommatie', tab: null, label: 'Sommatie', archief: true, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('bv', 'BV'), k('type', 'Type sommatie'), k('datum_afwezig', 'Datum afwezigheid'),
      k('datum_afspraak', 'Datum/tijd afspraak'), k('verzenddatum', 'Verzenddatum'), k('status', 'Status'), k('verwerkt', 'Verwerkt'), k('aanvullend', 'Aanvullende tekst')]
  },
  hr_onboarding: {
    sheet: 'onboarding', tab: null, label: 'Onboarding', archief: true, kopLabel: 'Voornaam',
    kolommen: [k('voornaam', 'Voornaam'), k('achternaam', 'Achternaam'), k('email', 'Email'), k('taal', 'Taal'), k('status', 'Status'),
      k('verzenddatum', 'Verzenddatum'), k('herinnering', 'Herinnering'), k('collectie2', 'Collectie2'), k('locatie', 'Locatie')]
  },
  hr_overplaatsing: {
    sheet: 'overplaatsing', tab: SHEETS.overplaatsing.tab, label: 'Overplaatsing', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('adres', 'Adres'), k('huidige_bv', 'Huidige BV'), k('nieuwe_bv', 'Nieuwe BV'),
      k('datum_indienst', 'Datum indiensttreding'), k('ingangsdatum', 'Ingangsdatum overplaatsing'), k('functie', 'Functie'), k('standplaats', 'Standplaats nieuw'),
      k('taal', 'Taal'), k('status', 'Status'), k('verzenddatum', 'Verzenddatum'), k('ondertekend', 'Ondertekend'), k('herinnering', 'Herinnering'),
      k('aantal_herinneringen', 'Aantal herinneringen'), k('type', 'Type'), k('brief_url', 'Brief')]
  },
  hr_brieven: {
    sheet: 'brieven', tab: SHEETS.brieven.tab, label: 'Vrije brieven', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('bv', 'BV'), k('categorie', 'Categorie'), k('onderwerp', 'Onderwerp'), k('tekst', 'Tekst'),
      k('pdf', 'PDF'), k('verzenddatum', 'Verzenddatum'), k('status', 'Status')]
  },
  hr_waarschuwingen: {
    sheet: 'ontslag', tab: TAB_WAARSCHUWINGEN, label: 'Waarschuwingen', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('adres', 'Adres'), k('winkel', 'Winkel'), k('bv', 'BV'), k('datum_overtreding', 'Datum overtreding'),
      k('regels', 'Overtreden regels'), k('toelichting', 'Toelichting'), k('taal', 'Taal'), k('status', 'Status'), k('verzenddatum', 'Verzenddatum')]
  },
  hr_beschikbaarheid: {
    sheet: 'ontslag', tab: TAB_BESCHIKBAARHEID, label: 'Beschikbaarheid', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('adres', 'Adres'), k('winkel', 'Winkel'), k('bv', 'BV'), k('ingangsdatum', 'Ingangsdatum'),
      k('taal', 'Taal'), k('onderbouwing', 'Data-onderbouwing'), k('status', 'Status'), k('verzenddatum', 'Verzenddatum')]
  },
  hr_korting: {
    sheet: 'loonheffing', tab: TAB_KORTING, label: 'Loonheffingskorting', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('keuze', 'Keuze'), k('ingangsdatum', 'Gewenste ingangsdatum'), k('deadline', 'Deadline'), k('taal', 'Taal'),
      k('status', 'Status'), k('verzenddatum', 'Verzenddatum'), k('retour', 'Formulier retour'), k('document', 'Document'), k('herinnering', 'Herinnering'),
      k('aantal_herinneringen', 'Aantal herinneringen'), k('salaris', 'Naar salaris')]
  },
  hr_oproepaanbod: {
    sheet: 'ontslag', tab: 'Oproepaanbod', label: 'Oproepaanbod', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('adres', 'Adres'), k('winkel', 'Winkel'), k('bv', 'BV'), k('sinds', 'Oproep sinds'), k('gem_uren', 'Gemiddeld u/week'),
      k('aangeboden_uren', 'Aangeboden u/week'), k('ingangsdatum', 'Ingangsdatum'), k('reactiedatum', 'Reageren vóór'), k('taal', 'Taal'), k('status', 'Status'), k('verzenddatum', 'Verzenddatum'),
      k('reactie', 'Reactie'), k('reactie_datum', 'Reactie op'), k('document', 'Document')]
  },
  hr_notities: {
    sheet: 'loonheffing', tab: TAB_NOTITIES, label: 'Notities', archief: false, kopLabel: 'Naam',
    kolommen: [k('naam', 'Naam'), k('email', 'Email'), k('datum', 'Datum'), k('auteur', 'Auteur'), k('tekst', 'Notitie')]
  }
};

// Oude Google-Forms-reacties (Drive-links van vóór de eigen uploadpagina). Geen sheet-tab-equivalent
// in het register hierboven: de import leest de responses-tabs en vult deze tabel; data.js leest er
// de documentlinks uit (loonDocLinks/ontslagDocLinks/syncKortingUploads), zoals sheets.js dat uit de tabs deed.
const FORMULIER_TABEL = 'hr_formulier_reacties';

// Sheet-ID -> sleutelnaam (voor zetCel/leesCel-aanroepen die nog met sheet-id werken)
const SHEET_SLEUTEL = {};
for (const [sl, s] of Object.entries(SHEETS)) if (!SHEET_SLEUTEL[s.id]) SHEET_SLEUTEL[s.id] = sl;
// Een sheet-id kan meerdere sleutels hebben (ontslag = overplaatsing = brieven): de hoofdtab hoort bij de eerste.

// (sheetId | sleutel, tabNaam | null) -> tabelnaam
// 'hoofd' is wat data.js teruggeeft voor eersteTabNaam(): de eerste tab = de hoofdtabel van die sheet.
function tabelVoor(sheetIdOfSleutel, tabNaam) {
  const sl = SHEET_SLEUTEL[sheetIdOfSleutel] || sheetIdOfSleutel;
  const sheetId = SHEETS[sl] ? SHEETS[sl].id : String(sheetIdOfSleutel);
  const t = tabNaam ? String(tabNaam) : null;
  const lijst = Object.entries(TABELLEN);
  if (t && t !== TAB_ARCHIEF && t !== 'hoofd') {
    for (const [naam, d] of lijst) if (d.tab === t && SHEETS[d.sheet].id === sheetId) return naam;
    return null;
  }
  for (const [naam, d] of lijst) if (d.tab === null && SHEETS[d.sheet].id === sheetId) return naam;
  return null;
}

function def(tabel) { const d = TABELLEN[tabel]; if (!d) throw new Error('Onbekende tabel: ' + tabel); return d; }
const kolomNamen = tabel => def(tabel).kolommen.map(c => c.naam);
const koppen = tabel => def(tabel).kolommen.map(c => c.kop);

module.exports = { TABELLEN, FORMULIER_TABEL, SHEET_SLEUTEL, tabelVoor, def, kolomNamen, koppen };
