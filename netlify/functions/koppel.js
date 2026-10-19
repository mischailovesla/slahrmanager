// ============================================================
// POST /api/koppel  (rol admin) — fase 1: medewerker_id vullen op alle rijen zonder koppeling
// (e-mail → genormaliseerde naam, tegen de Shiftbase-lijst). Draait ook automatisch na elke
// sync-formulieren-run. Alleen zinvol met DATA_BRON=supabase.
// ============================================================
const { beveiligd, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const SB = require('./_lib/shiftbase');

exports.handler = beveiligd('koppel', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  if (g.rol !== 'admin') throw new Error('Alleen beheerders.');
  if (S.bron() !== 'supabase') throw new Error('Koppelen kan pas als DATA_BRON=supabase staat.');
  const med = await SB.getMedewerkers(true);
  const uit = await require('./_lib/data').koppelMedewerkers(med);
  const totaal = Object.values(uit).reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0);
  await logActie({ door: g.email, actie: 'koppel', bron: 'medewerkers', details: totaal + ' rijen gekoppeld' });
  return { gekoppeld: totaal, perTabel: uit, medewerkers: med.length };
});
