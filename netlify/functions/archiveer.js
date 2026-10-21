// ============================================================
// POST /api/archiveer  { type, rij, naam }
// Rij naar de tab "Archief" van dezelfde sheet en uit het dashboard.
// Port van archiveerRij() in Code.gs v29.5 - zelfde tab, zelfde kolommen,
// dus terugzetten kan ook nog via herstelUitArchief() in Apps Script.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const { SHEETS } = require('./_lib/config');

const BRONNEN = {
  loonheffing: { id: SHEETS.loonheffing.id, label: 'Loonheffing' },
  ontslag:     { id: SHEETS.ontslag.id,     label: 'Ontslag' },
  sommatie:    { id: SHEETS.sommatie.id,    label: 'Sommatie' },
  onboarding:  { id: SHEETS.onboarding.id,  label: 'Onboarding', isOnboarding: true },
  overplaatsing: { id: SHEETS.overplaatsing.id, label: 'Overplaatsing' } // ondertekenen is niet verplicht: na versturen mag het dossier weg
};

exports.handler = beveiligd('archiveer', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const cfg = BRONNEN[p.type];
  const rij = parseInt(p.rij, 10);
  if (!cfg) throw new Error('Onbekend type: ' + p.type);
  if (!rij || rij < 2) throw new Error('Ongeldige rij (' + p.rij + ')');
  const naam = await S.archiveerRij(cfg.id, cfg.label, rij, p.naam, g.email, !!cfg.isOnboarding);
  await logActie({ door: g.email, actie: 'archiveer', bron: p.type, rij, naam, details: 'naar tab Archief' });
  return { bericht: naam + ' is gearchiveerd.' };
});
