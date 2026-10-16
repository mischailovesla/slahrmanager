// GET /api/korting - loonheffingskorting-dossiers (nieuwste bovenaan), eerst uploads syncen (getKortingData in Korting.gs)
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
exports.handler = beveiligd('korting', async () => {
  let sync = [];
  try { sync = await S.syncKortingUploads(false); } catch (e) { console.warn('Korting sync:', e.message); }
  return { rijen: await S.getKorting(), keuzes: T.KORT_KEUZES, gesynct: sync.length };
});
