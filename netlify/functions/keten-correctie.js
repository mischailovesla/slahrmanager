// ============================================================
// POST /api/keten-correctie { mid, naam, aantal, huidigStart, notitie }   (v0.19.1)
// HR legt het echte aantal tijdelijke arbeidsovereenkomsten in de huidige keten vast (incl. het huidige contract),
// als de telling uit Shiftbase niet klopt. Geldt zolang het huidige contract dezelfde startdatum heeft; aantal leeg/0 = correctie weg.
// Opgeslagen in hr_instellingen 'keten_correcties' { [medewerker-id]: { aantal, huidigStart, naam, notitie, door, op } }.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const I = require('./_lib/instellingen');

exports.handler = beveiligd('keten-correctie', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Alleen POST.');
  const p = body(event), mid = String(p.mid || '').trim();
  if (!mid) throw new Error('Medewerker-id ontbreekt (alleen mogelijk voor medewerkers uit Shiftbase).');
  const aantal = parseInt(p.aantal, 10);
  I.vergeet('keten_correcties');
  const alle = Object.assign({}, (await I.lees('keten_correcties', {})) || {});
  if (!aantal) delete alle[mid];
  else {
    if (aantal < 1 || aantal > 20) throw new Error('Aantal moet tussen 1 en 20 liggen.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.huidigStart || ''))) throw new Error('Startdatum huidig contract ontbreekt.');
    alle[mid] = { aantal, huidigStart: p.huidigStart, naam: String(p.naam || ''), notitie: String(p.notitie || '').slice(0, 300), door: g.email, op: new Date().toISOString() };
  }
  await I.schrijf('keten_correcties', alle, g.email);
  await logActie({ door: g.email, actie: 'keten-correctie', bron: 'contractketen', naam: String(p.naam || ''), veld: 'aantal', nieuw: aantal ? String(aantal) : 'weg', details: String(p.notitie || '') });
  return { bericht: aantal ? 'Keten van ' + (p.naam || 'medewerker') + ' staat nu op ' + aantal + ' contract(en). De takenlijst past zich aan bij de volgende run of met ↻ Verse stand.' : 'Correctie verwijderd; de telling uit Shiftbase geldt weer.' };
});
