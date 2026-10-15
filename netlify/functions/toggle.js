// ============================================================
// POST /api/toggle  { type, rij, naam }
// Zet een vinkje om in de sheet - exact dezelfde cel en kleur als
// de toggle-functies in Code.gs, zodat Apps Script hetzelfde ziet.
//   mahdia-loonheffing  -> Loonheffing kolom J (10)   Ja/''  groen
//   mahdia-ontslag      -> Ontslag     kolom N (14)   Ja/''  groen
//   som-verwerkt        -> Sommatie    kolom I (9) + status H (8): Verwerkt/Verstuurd
//   opl-ondertekend     -> Overplaatsing-tab kolom M (13) Ja/''
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const { SHEETS } = require('./_lib/config');

const TOGGLES = {
  'mahdia-loonheffing': { id: SHEETS.loonheffing.id, tab: null, kol: 10, bron: 'loonheffing', veld: 'mahdia' },
  'mahdia-ontslag':     { id: SHEETS.ontslag.id,     tab: null, kol: 14, bron: 'ontslag',     veld: 'mahdia' },
  'som-verwerkt':       { id: SHEETS.sommatie.id,    tab: null, kol: 9,  bron: 'sommatie',    veld: 'verwerkt' },
  'opl-ondertekend':    { id: SHEETS.overplaatsing.id, tab: SHEETS.overplaatsing.tab, kol: 13, bron: 'overplaatsing', veld: 'ondertekend' }
};

exports.handler = beveiligd('toggle', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const cfg = TOGGLES[p.type];
  const rij = parseInt(p.rij, 10);
  if (!cfg) throw new Error('Onbekend toggle-type: ' + p.type);
  if (!rij || rij < 2) throw new Error('Ongeldige rij');

  const huidig = await S.leesCel(cfg.id, cfg.tab, rij, cfg.kol);
  const wasJa = huidig.toUpperCase() === 'JA';
  const nieuw = wasJa ? '' : 'Ja';
  await S.zetCel(cfg.id, cfg.tab, rij, cfg.kol, nieuw, nieuw ? S.KLEUR.groen : S.KLEUR.wit);
  // Sommatie: statuskolom H meebewegen (toggleSomVerwerkt in Code.gs)
  if (p.type === 'som-verwerkt') {
    await S.zetCel(cfg.id, cfg.tab, rij, 8, nieuw ? 'Verwerkt' : 'Verstuurd', nieuw ? S.KLEUR.groen : S.KLEUR.geel);
  }
  await logActie({ door: g.email, actie: 'toggle', bron: cfg.bron, veld: cfg.veld, rij, naam: p.naam || null, oud: huidig || '', nieuw });
  return { waarde: nieuw || 'Nee', bericht: (p.naam ? p.naam + ': ' : '') + cfg.veld + ' ' + (nieuw ? 'aangevinkt' : 'uitgevinkt') };
});
