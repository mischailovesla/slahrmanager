// ============================================================
// Verloopanalyse (port van Verloop.gs v1.3): verloop% = uitstroom / gemiddeld
// bestand; vroege uitstroom (≤90 dagen), gem. diensttijd vertrekkers, in-/uitstroom
// per maand, 30/60/90-dagen cohortuitval. Kijkt óók naar uit dienst getreden
// medewerkers (users zonder active-filter). HQ/Keuken/Logistiek/flexpools uitgesloten.
// ============================================================
const SB = require('./shiftbase');
const C = require('./config');
const D = require('./datum');
const { normNaam } = require('./util');

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parse = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const UIT_NAMEN = new Set(C.SB_UITGESLOTEN_NAMEN.map(normNaam));
const UIT_TEAMS = new Set(C.VRL_UITGESLOTEN_TEAMS.map(normNaam));
function uitgesloten(winkel) { const n = normNaam(winkel); if (!n) return false; if (UIT_TEAMS.has(n)) return true; return C.VRL_FLEX_UITSLUITEN && n.indexOf('flex') > -1; }
function isFlexTeam(t) { if (!t) return false; if (String(t.type || '').toLowerCase().includes('flex')) return true; if (t.hidden === true || t.hidden === '1' || t.hidden === 1) return true; return String(t.name || '').toLowerCase().includes('flex'); }

// Datalaag (puur): alle medewerkers met start en eind
function verwerkVerloopData(usersLijst, contractsLijst) {
  const startPerUser = {};
  for (const r of contractsLijst || []) { const c = (r && r.Contract) || r || {}; const uid = String(c.user_id || ''); const sd = String(c.startdate || '').trim(); if (!uid || !sd || sd === '0000-00-00') continue; if (!startPerUser[uid] || sd < startPerUser[uid]) startPerUser[uid] = sd; }
  const out = [];
  for (const rec of usersLijst || []) {
    const u = (rec && rec.User) || rec || {}; const teams = rec.Team || [];
    const eigen = teams.filter(t => !isFlexTeam(t)), flexT = teams.filter(isFlexTeam), basis = eigen.length ? eigen : flexT;
    let winkel = '', alleenFranchise = basis.length > 0;
    for (const t of basis) { const did = String(t.department_id || ''); if (!C.SB_FRANCHISE_DEPTS[did]) alleenFranchise = false; if (!winkel && eigen.length && C.SB_DEPT_CODE[did]) winkel = C.WINKEL_BV_MAP[C.SB_DEPT_CODE[did]].naam; if (!winkel && t.name) winkel = String(t.name).replace(/^SLA\s*/i, '').trim(); }
    if (alleenFranchise) continue;
    const naam = ((u.first_name || '') + ' ' + (u.prefix ? u.prefix + ' ' : '') + (u.last_name || '')).replace(/\s+/g, ' ').trim();
    const geanon = u.anonymized === true || u.anonymized === '1' || u.anonymized === 1;
    if (!geanon && naam && UIT_NAMEN.has(normNaam(naam))) continue;
    const start = startPerUser[String(u.id)] || String(u.startdate || '').trim();
    if (!start || start === '0000-00-00') continue;
    let eind = String(u.enddate || '').trim(); if (eind === '0000-00-00') eind = '';
    const winkelNaam = winkel || '(geen winkel)'; if (uitgesloten(winkelNaam)) continue;
    out.push({ id: String(u.id || ''), naam: geanon ? '(geanonimiseerd)' : (naam || '(naamloos)'), winkel: winkelNaam, start, eind });
  }
  return out;
}
// Rekenlaag (puur)
function berekenVerloop(med, eindMaand, aantalMaanden, vandaag) {
  vandaag = vandaag || new Date(); const vandaagIso = iso(vandaag);
  const inDienstOp = (m, d) => !(m.start > d) && !(m.eind && m.eind < d);
  const maanden = [];
  for (let i = aantalMaanden - 1; i >= 0; i--) { const d = new Date(eindMaand.getFullYear(), eindMaand.getMonth() - i, 1); maanden.push({ label: MAAND[d.getMonth()] + ' ' + String(d.getFullYear()).substring(2), jaar: d.getFullYear(), maand: d.getMonth(), vanIso: iso(new Date(d.getFullYear(), d.getMonth(), 1)), totIso: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }); }
  const leeg = naam => ({ naam, bestandNu: 0, instroom: 0, uitstroom: 0, vroeg: 0, dienstDagen: [], bestandStart: 0, bestandEind: 0, maandUit: maanden.map(() => 0), maandIn: maanden.map(() => 0), cohort: Object.fromEntries(C.VRL_COHORTEN.map(g => [String(g), { n: 0, uit: 0 }])) });
  const winkels = {}, totaal = leeg('Totaal');
  const vanIso = maanden[0].vanIso, totIso = maanden[maanden.length - 1].totIso, peilEindIso = totIso > vandaagIso ? vandaagIso : totIso;
  const vroegeLijst = [];
  for (const m of med) {
    const w = winkels[m.winkel] || (winkels[m.winkel] = leeg(m.winkel));
    if (inDienstOp(m, vanIso)) { w.bestandStart++; totaal.bestandStart++; }
    if (inDienstOp(m, peilEindIso)) { w.bestandEind++; totaal.bestandEind++; }
    if (inDienstOp(m, vandaagIso)) { w.bestandNu++; totaal.bestandNu++; }
    if (m.start >= vanIso && m.start <= totIso) {
      const ds0 = parse(m.start), eindGeweest = (m.eind && m.eind <= vandaagIso) ? m.eind : '', de0 = eindGeweest ? parse(eindGeweest) : null;
      const dienstDgn = de0 ? Math.round((de0 - ds0) / 864e5) : null, dgnSindsStart = ds0 ? Math.round((vandaag - ds0) / 864e5) : -1;
      for (const grens of C.VRL_COHORTEN) {
        const k = String(grens), kan = dgnSindsStart >= grens || (dienstDgn !== null && dienstDgn <= grens); if (!kan) continue;
        w.cohort[k].n++; totaal.cohort[k].n++; if (dienstDgn !== null && dienstDgn <= grens) { w.cohort[k].uit++; totaal.cohort[k].uit++; }
      }
    }
    maanden.forEach((mm, mi) => {
      if (m.start >= mm.vanIso && m.start <= mm.totIso && m.start <= vandaagIso) { w.maandIn[mi]++; totaal.maandIn[mi]++; w.instroom++; totaal.instroom++; }
      if (m.eind && m.eind <= vandaagIso && m.eind >= mm.vanIso && m.eind <= mm.totIso) {
        w.maandUit[mi]++; totaal.maandUit[mi]++; w.uitstroom++; totaal.uitstroom++;
        const ds = parse(m.start), de = parse(m.eind);
        if (ds && de) { const dagen = Math.round((de - ds) / 864e5); w.dienstDagen.push(dagen); totaal.dienstDagen.push(dagen); if (dagen <= C.VRL_VROEG_DAGEN) { w.vroeg++; totaal.vroeg++; vroegeLijst.push({ naam: m.naam, winkel: m.winkel, dagen, eind: m.eind }); } }
      }
    });
  }
  const afronden = o => {
    const gem = (o.bestandStart + o.bestandEind) / 2;
    o.gemBestand = Math.round(gem * 10) / 10; o.verloop = gem >= C.VRL_MIN_BESTAND ? Math.round(o.uitstroom / gem * 1000) / 10 : null;
    o.vroegPct = o.uitstroom ? Math.round(o.vroeg / o.uitstroom * 100) : 0;
    o.gemDienstMnd = o.dienstDagen.length ? Math.round(o.dienstDagen.reduce((a, b) => a + b, 0) / o.dienstDagen.length / 30.44 * 10) / 10 : null;
    delete o.dienstDagen; o.netto = o.instroom - o.uitstroom;
    for (const k of Object.keys(o.cohort)) { const c = o.cohort[k]; c.pct = c.n ? Math.round(c.uit / c.n * 1000) / 10 : null; }
    return o;
  };
  const lijst = Object.values(winkels).map(afronden).sort((a, b) => (a.verloop === null && b.verloop === null) ? a.naam.localeCompare(b.naam) : a.verloop === null ? 1 : b.verloop === null ? -1 : b.verloop - a.verloop);
  afronden(totaal);
  vroegeLijst.sort((a, b) => a.dagen - b.dagen);
  return { maanden, winkels: lijst, totaal, vroegeLijst: vroegeLijst.slice(0, 15) };
}
let _cache = { t: 0, v: null };
async function getVerloopData(maanden, ververs) {
  maanden = Number(maanden) || 12;
  if (ververs || !_cache.v || _cache.t < Date.now()) {
    const users = await SB.sbGet('users'); let cons = []; try { cons = await SB.sbGet('contracts'); } catch (e) { console.warn('contracts:', e.message); }
    _cache = { t: Date.now() + 30 * 60000, v: verwerkVerloopData(users, cons) };
  }
  const nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const r = berekenVerloop(_cache.v, new Date(nu.getFullYear(), nu.getMonth(), 1), maanden, nu);
  r.cohorten = C.VRL_COHORTEN; r.vroegDagen = C.VRL_VROEG_DAGEN; r.bijgewerkt = D.stempel();
  r.periode = r.maanden[0].label + ' t/m ' + r.maanden[r.maanden.length - 1].label + (r.maanden[r.maanden.length - 1].totIso > iso(nu) ? ' (lopende maand t/m vandaag)' : '');
  return r;
}
module.exports = { verwerkVerloopData, berekenVerloop, getVerloopData };
