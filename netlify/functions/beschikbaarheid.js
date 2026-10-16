// GET /api/beschikbaarheid - alle kennisgevingen weekendbeschikbaarheid (nieuwste bovenaan)
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const winkels = Object.keys(C.WINKEL_BV_MAP).map(code => Object.assign({ code }, C.WINKEL_BV_MAP[code])).sort((a, b) => a.naam.localeCompare(b.naam));
exports.handler = beveiligd('beschikbaarheid', async () => ({ rijen: await S.getBeschikbaarheid(), winkels }));
