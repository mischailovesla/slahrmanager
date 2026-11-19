// v0.54.2: wie heeft (na start of na de loonheffingsuitnodiging) een ontslag- of aanzeggingsdossier gekregen?
// Voor die mensen hoeft er geen loonheffing meer: niet (opnieuw) uitnodigen, niet herinneren, niet tonen in Instroom.
//   kaart(ontslagRijen)          Map sleutel → laatste datum (max van einddatum en verzenddatum) — puur
//   na(kaart, persoon, sinds)    true als er een ontslagdossier is met datum ≥ sinds − MARGE dagen — puur
//   laad()                       kaart uit getOntslag(true) (incl. archief)
// Een herintreder (oud dossier, ruim vóór de nieuwe start/uitnodiging) valt er dus níet onder.
const { normNaam, parseNLDatum } = require('./util');
const MARGE = 14;
const dag = s => parseNLDatum(String(s || '').trim().split(' ')[0]);

function kaart(rijen) {
  const m = new Map();
  const zet = (k, d) => { if (k && (!m.has(k) || m.get(k) < d)) m.set(k, d); };
  for (const r of rijen || []) {
    const ds = [dag(r.einddatum), dag(r.verzenddatum || String(r.status || '').replace(/^\D*/, ''))].filter(Boolean);
    if (!ds.length) continue;
    const d = new Date(Math.max(...ds.map(x => +x)));
    if (r.email) zet('e:' + String(r.email).trim().toLowerCase(), d);
    if (r.naam) zet('n:' + normNaam(r.naam), d);
  }
  return m;
}
function na(m, x, sinds) {
  if (!m || !m.size || !x) return false;
  const s = sinds instanceof Date ? sinds : dag(sinds);
  const grens = s ? new Date(+s - MARGE * 864e5) : null;
  const ks = [x.email && 'e:' + String(x.email).trim().toLowerCase(), x.naam && 'n:' + normNaam(x.naam)].filter(Boolean);
  return ks.some(k => m.has(k) && (!grens || m.get(k) >= grens));
}
async function laad() { return kaart(await require('./sheets').getOntslag(true)); }
// Uitnodigingsdatum van een loonheffingsrij
const uitnodiging = r => r.verzenddatum || String(r.status || '').replace(/^\D*/, '');

module.exports = { kaart, na, laad, uitnodiging, MARGE };
