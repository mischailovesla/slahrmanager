// ============================================================
// v0.27.0 — Geen medische informatie in vrije tekst (AVG art. 9 + UAVG art. 30).
// Een werkgever mag bij verzuim alleen vastleggen: dat iemand ziek is, de verwachte duur,
// lopende afspraken, of werkhervatting/aangepast werk mogelijk is en of de bedrijfsarts erbij is.
// Níet: diagnose, klachten, oorzaak, behandeling, medicijnen, zwangerschap.
// controleer(teksten) gooit een fout met het gevonden woord, zodat HR het kan herformuleren.
// Bewust een woordenlijst met woordgrenzen (geen 'terug' → 'rug'); liever een keer te streng dan te ruim.
// ============================================================
const TERMEN = [
  'griep', 'koorts', 'verkoudheid', 'verkouden', 'covid', 'corona', 'virus', 'infectie', 'ontsteking', 'allergie', 'allergisch', 'astma', 'diabetes', 'suikerziekte',
  'migraine', 'hoofdpijn', 'buikpijn', 'rugpijn', 'pijn', 'misselijk', 'overgeven', 'diarree', 'maag', 'darm', 'blindedarm', 'hernia', 'gebroken', 'breuk', 'kneuzing', 'verstuiking', 'ingescheurd', 'gescheurd',
  'rug', 'knie', 'enkel', 'pols', 'schouder', 'nek', 'heup', 'hart', 'longen', 'nieren', 'lever',
  'operatie', 'geopereerd', 'ziekenhuis', 'opgenomen', 'huisarts', 'fysio', 'fysiotherapie', 'therapie', 'therapeut', 'psycholoog', 'psychiater', 'ggz',
  'medicijn', 'medicijnen', 'medicatie', 'antibiotica', 'pijnstillers', 'diagnose', 'gediagnosticeerd', 'kanker', 'tumor', 'chemo',
  'burnout', 'burn-out', 'overspannen', 'overspanning', 'depressie', 'depressief', 'angststoornis', 'paniekaanval', 'adhd', 'autisme', 'trauma', 'ptss',
  'zwanger', 'zwangerschap', 'miskraam', 'bevalling', 'bevallen', 'ivf',
  'verslaving', 'verslaafd', 'afkicken', 'alcoholisme',
  // Engels (veel medewerkers schrijven Engels)
  'flu', 'fever', 'pain', 'injury', 'injured', 'surgery', 'hospital', 'diagnosis', 'diagnosed', 'medication', 'pregnant', 'pregnancy', 'depression', 'anxiety', 'therapist'
];
const RE = new RegExp('(^|[^a-zà-ÿ])(' + TERMEN.map(t => t.replace(/[-]/g, '\\-')).join('|') + ')(?=$|[^a-zà-ÿ])', 'i');

function vind(tekst) { const m = String(tekst || '').toLowerCase().match(RE); return m ? m[2] : null; }
function controleer(teksten) {
  for (const t of [].concat(teksten || [])) {
    const w = vind(t);
    if (w) throw new Error('Dit lijkt medische informatie ("' + w + '"). Die mag SLA als werkgever niet vastleggen (AVG). Beschrijf alleen wat iemand wél en niet kan, de verwachte duur en de afspraken over contact en werkhervatting. Medische zaken bespreekt de medewerker met de bedrijfsarts.');
  }
}
module.exports = { TERMEN, vind, controleer };
