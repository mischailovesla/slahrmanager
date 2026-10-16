// GET /api/sommatie - alle sommaties (nieuwste bovenaan) + types, kleuren en hints voor het modal
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
exports.handler = beveiligd('sommatie', async () => {
  const rijen = (await S.getSommatie()).reverse();
  return { rijen, types: T.SOM_TYPES, kleuren: T.SOM_KLEUR, hints: T.SOM_HINTS };
});
