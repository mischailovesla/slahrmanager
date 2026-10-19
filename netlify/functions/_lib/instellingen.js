// ============================================================
// Instellingen die HR zelf in het dashboard beheert (tabel hr_instellingen, migratie 0010).
// lees(sleutel, standaard) valt terug op `standaard` als de rij of de tabel ontbreekt; 60 s cache per function-instantie.
// ============================================================
const { admin } = require('./auth');
const CACHE_MS = 60 * 1000;
const _cache = {};

async function lees(sleutel, standaard) {
  const c = _cache[sleutel];
  if (c && c.t > Date.now()) return c.v;
  let v = standaard;
  try {
    const { data, error } = await admin().from('hr_instellingen').select('waarde').eq('sleutel', sleutel).limit(1);
    if (error) throw new Error(error.message);
    if (data && data.length && data[0].waarde !== null && data[0].waarde !== undefined) v = data[0].waarde;
  } catch (e) { console.warn('instelling ' + sleutel + ':', e.message); }
  _cache[sleutel] = { t: Date.now() + CACHE_MS, v };
  return v;
}
async function schrijf(sleutel, waarde, door) {
  const { error } = await admin().from('hr_instellingen').upsert({ sleutel, waarde, bijgewerkt_op: new Date().toISOString(), bijgewerkt_door: door || '' }, { onConflict: 'sleutel' });
  if (error) throw new Error('Instelling opslaan mislukt: ' + error.message + ' (migratie 0010 gedraaid?)');
  _cache[sleutel] = { t: Date.now() + CACHE_MS, v: waarde };
  return waarde;
}
function vergeet(sleutel) { if (sleutel) delete _cache[sleutel]; else Object.keys(_cache).forEach(k => delete _cache[k]); }
module.exports = { lees, schrijf, vergeet };
