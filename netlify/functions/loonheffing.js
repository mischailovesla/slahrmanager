// GET /api/loonheffing - alle loonheffingsdossiers (voor de tab) + templates
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
exports.handler = beveiligd('loonheffing', async () => {
  const rijen = await S.getLoonheffing();
  return { rijen, templates: T.LOON_TEMPLATES.map(x => ({ key: x.key, label: x.label, taal: x.taal, type: x.type, subject: x.subject })) };
});
