// GET /api/brieven - verstuurde vrije brieven (tab 'Brieven', nieuwste bovenaan)
// + templates en de BV-lijst voor het Brief-modal (getVrijeBriefUI in VrijeBrief.gs)
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const C = require('./_lib/config');
exports.handler = beveiligd('brieven', async () => {
  const rijen = await S.getBrieven();
  const bvs = Array.from(new Set(Object.values(C.WINKEL_BV_MAP).map(w => w.bv))).sort();
  const winkelBv = {};
  Object.values(C.WINKEL_BV_MAP).forEach(w => { winkelBv[w.naam] = w.bv; });
  return { rijen, templates: T.BRIEF_TEMPLATES, bvs, winkelBv, afzender: C.AFZENDER_NAAM };
});
