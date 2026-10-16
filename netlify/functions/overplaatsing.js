// GET /api/overplaatsing - alle overplaatsingen/standplaatswijzigingen + winkellijst voor het modal
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
exports.handler = beveiligd('overplaatsing', async () => {
  const rijen = await S.getOverplaatsing();
  const winkels = Object.keys(C.WINKEL_BV_MAP).map(code => Object.assign({ code }, C.WINKEL_BV_MAP[code])).sort((a, b) => a.naam.localeCompare(b.naam));
  return { rijen, winkels };
});
