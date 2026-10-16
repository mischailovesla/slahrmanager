// GET /api/waarschuwing - alle officiële waarschuwingen (nieuwste bovenaan) + huisregels voor de checklist
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const winkels = Object.keys(C.WINKEL_BV_MAP).map(code => Object.assign({ code }, C.WINKEL_BV_MAP[code])).sort((a, b) => a.naam.localeCompare(b.naam));
const T = require('./_lib/sjablonen');
exports.handler = beveiligd('waarschuwing', async () => ({ rijen: await S.getWaarschuwingen(), huisregels: T.HUISREGELS, winkels }));
