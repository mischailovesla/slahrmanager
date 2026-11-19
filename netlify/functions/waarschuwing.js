// GET /api/waarschuwing - alle officiële waarschuwingen (nieuwste bovenaan) + huisregels voor de checklist
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const LOC = Object.assign({}, C.WINKEL_BV_MAP, C.WAARSCHUWING_EXTRA_LOCATIES || {});   // v0.53.5: + Keuken (SLA Hofhouse BV)
const winkels = Object.keys(LOC).map(code => Object.assign({ code }, LOC[code])).sort((a, b) => a.naam.localeCompare(b.naam));
const T = require('./_lib/sjablonen');
exports.handler = beveiligd('waarschuwing', async () => {
  const rijen = await S.getWaarschuwingen();
  // v0.53.2: tekenstatus (voor gezien) per waarschuwing
  try { const ON = require('./_lib/ondertekening'), l = await ON.statusVoor('waarschuwing'); rijen.forEach(r => { r.teken = ON.koppel(l, r); }); } catch (e) { console.warn('waarschuwing tekenstatus:', e.message); }
  return { rijen, huisregels: T.HUISREGELS, winkels };
});
