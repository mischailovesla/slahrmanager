// ============================================================
// Fase 6b: handtekening per HR-medewerker. Brieven (ontslag, aanzegging, proeftijd, overplaatsing) krijgen de
// handtekening + naam + functie van degene die ze aanmaakt. Opslag: hr_instellingen 'handtekening:<email>' =
// { naam, functie, png (data:image/png;base64,...), bijgewerkt }.
// ============================================================
const I = require('./instellingen');
const sleutel = email => 'handtekening:' + String(email || '').trim().toLowerCase();

async function van(email, standaardNaam) {
  const h = await I.lees(sleutel(email), null);
  const naam = (h && h.naam) || standaardNaam || '';
  let png = null;
  if (h && h.png) { const m = String(h.png).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/); if (m) png = Buffer.from(m[1], 'base64'); }
  return { email: String(email || '').toLowerCase(), naam, functie: (h && h.functie) || '', png, ingesteld: !!png, bijgewerkt: (h && h.bijgewerkt) || '' };
}
async function opslaan(email, p) {
  const naam = String(p.naam || '').trim().slice(0, 80), functie = String(p.functie || '').trim().slice(0, 80);
  if (naam.length < 2) throw new Error('Vul je naam in zoals die onder de brief moet staan.');
  let png = null;
  if (p.png) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(p.png))) throw new Error('Ongeldige handtekening (alleen PNG).');
    if (String(p.png).length > 400000) throw new Error('Handtekening is te groot (max. ±300 kB).');
    png = String(p.png);
  }
  const oud = await I.lees(sleutel(email), null);
  const waarde = { naam, functie, png: png || (p.wisHandtekening ? null : (oud && oud.png) || null), bijgewerkt: new Date().toISOString() };
  await I.schrijf(sleutel(email), waarde, email);
  return waarde;
}
module.exports = { van, opslaan };
