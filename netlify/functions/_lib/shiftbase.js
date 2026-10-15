// ============================================================
// Shiftbase-koppeling - port van Shiftbase.gs (verwerkShiftbaseData_,
// isActief_, isFlexTeam_). Loondata (wage) wordt bewust genegeerd
// en verlaat de server nooit.
// ============================================================
const { SB_DEPT_CODE, SB_FRANCHISE_DEPTS, SB_UITGESLOTEN_NAMEN, WINKEL_BV_MAP, VAKANTIE_OPTION_ID } = require('./config');
const { normNaam } = require('./util');

const API = 'https://api.shiftbase.com/api/';
const UITGESLOTEN = new Set(SB_UITGESLOTEN_NAMEN.map(normNaam));

async function sbGet(pad) {
  const key = process.env.SHIFTBASE_KEY;
  if (!key) throw new Error('SHIFTBASE_KEY ontbreekt');
  const r = await fetch(API + pad, { headers: { Authorization: 'API ' + key, Accept: 'application/json' } });
  if (r.status === 401 || r.status === 403) throw new Error('Shiftbase weigert de key (HTTP ' + r.status + ')');
  if (r.status === 429) throw new Error('Shiftbase rate limit bereikt (180 req/min). Wacht even.');
  if (!r.ok) throw new Error('Shiftbase API fout: HTTP ' + r.status);
  const j = await r.json();
  return j && j.data !== undefined ? j.data : j;
}

function isFlexTeam(t) {
  if (!t) return false;
  if (String(t.type || '').toLowerCase().includes('flex')) return true;
  if (t.hidden === true || t.hidden === '1' || t.hidden === 1) return true;
  return String(t.name || '').toLowerCase().includes('flex');
}
function isoVandaag() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // yyyy-mm-dd
}
function isActief(u) {
  if (u.anonymized === true || u.anonymized === '1' || u.anonymized === 1) return false;
  const e = String(u.enddate || '').trim();
  if (!e || e === '0000-00-00') return true;
  return e >= isoVandaag();
}
const ddmm = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };

function verwerk(usersLijst, contractsLijst, typeNamen) {
  typeNamen = typeNamen || {};
  const perUser = {};
  for (const rec of contractsLijst || []) {
    const c = (rec && rec.Contract) || rec || {};
    const uid = String(c.user_id || ''); if (!uid) continue;
    const sd = String(c.startdate || '').trim(), ed = String(c.enddate || '').trim();
    const p = perUser[uid] || (perUser[uid] = { vroegste: '', laatste: '', functie: '', einde: '', contractType: '' });
    if (sd && sd !== '0000-00-00') {
      if (!p.vroegste || sd < p.vroegste) p.vroegste = sd;
      if (!p.laatste || sd >= p.laatste) {
        p.laatste = sd;
        if (c['function']) p.functie = String(c['function']).trim();
        p.einde = (ed && ed !== '0000-00-00') ? ed : '';
        p.contractType = String((c.ContractType && c.ContractType.name) || typeNamen[String(c.contract_type_id || '')] || c.contract_type || '').trim();
      }
    }
  }
  const out = [];
  for (const rec of usersLijst || []) {
    const u = (rec && rec.User) || rec || {};
    if (!isActief(u)) continue;
    const teams = rec.Team || [];
    const eigen = teams.filter(t => !isFlexTeam(t)), flexT = teams.filter(isFlexTeam);
    const basis = eigen.length ? eigen : flexT;
    let code = '', winkelNaam = '', alleenFranchise = basis.length > 0;
    for (const t of basis) {
      const did = String(t.department_id || '');
      if (!SB_FRANCHISE_DEPTS[did]) alleenFranchise = false;
      if (eigen.length && !code && SB_DEPT_CODE[did]) { code = SB_DEPT_CODE[did]; winkelNaam = WINKEL_BV_MAP[code].naam; }
      if (!winkelNaam && t.name) winkelNaam = String(t.name).replace(/^SLA\s*/i, '').trim();
    }
    if (alleenFranchise) continue;
    const naam = ((u.first_name || '') + ' ' + (u.prefix ? u.prefix + ' ' : '') + (u.last_name || '')).replace(/\s+/g, ' ').trim();
    if (!naam || UITGESLOTEN.has(normNaam(naam))) continue;
    let adres = '';
    if (String(u.street_address || '').trim()) {
      adres = String(u.street_address).trim();
      const pc = String(u.post_code || '').trim(), ci = String(u.city || '').trim();
      if (pc || ci) adres += ', ' + (pc ? pc + ' ' : '') + ci;
    }
    const ci = perUser[String(u.id)] || {};
    out.push({
      id: String(u.id || ''), naam, voornaam: String(u.first_name || '').trim(), email: String(u.email || '').trim(), adres,
      indienst: ddmm(ci.vroegste || u.startdate || ''), contractEinde: ddmm(ci.einde || ''), contractType: ci.contractType || '',
      functie: ci.functie || '', winkelCode: code, winkelNaam, winkelBv: code ? WINKEL_BV_MAP[code].bv : ''
    });
  }
  out.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  return out;
}

// Cache per function-instance (10 min, zoals CacheService in Apps Script)
let _cache = { t: 0, v: null };
async function getMedewerkers(forceer) {
  if (!forceer && _cache.v && _cache.t > Date.now()) return _cache.v;
  const users = await sbGet('users');
  let cons = [], typeNamen = {};
  try { cons = await sbGet('contracts'); } catch (e) { console.warn('contracts:', e.message); }
  // Contracttypen (Bepaalde tijd / Onbepaalde tijd / Oproep ...) - id -> naam
  try {
    const ct = await sbGet('contract_types');
    for (const rec of ct || []) { const x = (rec && rec.ContractType) || rec || {}; if (x.id) typeNamen[String(x.id)] = String(x.name || '').trim(); }
  } catch (e) { console.warn('contract_types:', e.message); }
  const med = verwerk(users, cons, typeNamen);
  _cache = { t: Date.now() + 600000, v: med };
  return med;
}

// Vakantie-/verlofsaldo-ish: goedgekeurde afwezigheden van 1 medewerker (laatste 12 maanden + 6 vooruit)
async function getVerlof(userId) {
  const nu = new Date();
  const f = d => d.toISOString().slice(0, 10);
  const min = new Date(nu); min.setMonth(min.getMonth() - 12);
  const max = new Date(nu); max.setMonth(max.getMonth() + 6);
  const lijst = await sbGet('absentees?min_date=' + f(min) + '&max_date=' + f(max) + '&user_id=' + encodeURIComponent(userId));
  return (lijst || []).map(x => (x && x.Absentee) || x || {})
    .filter(a => String(a.user_id) === String(userId))
    .map(a => ({
      start: ddmm(a.startdate), eind: ddmm(a.enddate || a.startdate), status: a.status || '',
      type: String(a.absentee_option_id) === VAKANTIE_OPTION_ID ? 'Vakantie' : (a.absentee_option_id ? 'Overig (' + a.absentee_option_id + ')' : ''),
      uren: a.hours || a.total_hours || null
    }))
    .sort((a, b) => (b.start || '').split('-').reverse().join('').localeCompare((a.start || '').split('-').reverse().join('')));
}

module.exports = { getMedewerkers, getVerlof, verwerk, sbGet };
