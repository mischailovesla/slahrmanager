// GET /api/ontslag - alle ontslag/aanzegging-dossiers (voor de tab) + templates
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
exports.handler = beveiligd('ontslag', async () => {
  const rijen = await S.getOntslag();
  return {
    rijen,
    templates: T.ONTSLAG_TEMPLATES.map(x => ({ key: x.key, label: x.label, taal: x.taal, type: x.type, pdf: x.pdf, subject: x.subject }))
  };
});
