// ============================================================
// v0.36.0: instroom-KPI — hoeveel dagen zitten er tussen de indienstdatum (Shiftbase, eerste contract)
// en de eerste geroosterde dienst? Per medewerker, per winkel, gemiddelde + mediaan.
//   bereken(med, rosters, vanaf, vandaag)  puur
//   laad(vanaf)                           haalt medewerkers + rooster uit Shiftbase (in blokken van 31 dagen)
// Alleen medewerkers die nu in dienst zijn (wie al weer weg is, heeft geen indienstdatum meer in de actieve lijst).
// Een dienst vóór de indienstdatum telt mee als negatief getal: dan is er gewerkt (of gepland) vóór het contract liep.
// ============================================================
const VOOR_START_DAGEN = 30; // zover terug kijken we vóór de indienstdatum naar diensten
const isoNl = s => { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
const verschil = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
function mediaan(l) { if (!l.length) return null; const s = l.slice().sort((a, b) => a - b), h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
function samenvatting(lijst) {
  const d = lijst.filter(x => x.dagen != null).map(x => x.dagen);
  const pos = d.filter(x => x >= 0);
  return { aantal: lijst.length, metDienst: d.length, zonderDienst: lijst.filter(x => x.dagen == null).length, gemiddeld: d.length ? r1(d.reduce((a, b) => a + b, 0) / d.length) : null, mediaan: mediaan(d),
    gemiddeldVanafStart: pos.length ? r1(pos.reduce((a, b) => a + b, 0) / pos.length) : null, voorStart: d.filter(x => x < 0).length,
    verdeling: { 'vóór start': d.filter(x => x < 0).length, '0–3': pos.filter(x => x <= 3).length, '4–7': pos.filter(x => x > 3 && x <= 7).length, '8–14': pos.filter(x => x > 7 && x <= 14).length, '15+': pos.filter(x => x > 14).length } };
}
function bereken(med, rosters, vanaf, vandaag) {
  vandaag = vandaag || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const per = {};
  for (const r0 of rosters || []) { const r = (r0 && r0.Roster) || r0 || {}; const u = String(r.user_id || ''), d = dag(r.date); if (!u || !d) continue; (per[u] = per[u] || []).push(d); }
  const lijst = [];
  for (const m of med || []) {
    const start = isoNl(m.indienst); if (!start || start < vanaf || start > vandaag) continue;
    const ds = (per[String(m.id)] || []).filter(d => d >= plus(start, -VOOR_START_DAGEN)).sort();
    const eerste = ds[0] || '';
    lijst.push({ naam: m.naam, winkel: m.winkelNaam || '-', indienst: start, eersteDienst: eerste, dagen: eerste ? verschil(start, eerste) : null, gepland: !!eerste && eerste > vandaag, dagenInDienst: verschil(start, vandaag) });
  }
  lijst.sort((a, b) => (b.dagen == null ? 1e6 : b.dagen) - (a.dagen == null ? 1e6 : a.dagen) || a.naam.localeCompare(b.naam, 'nl'));
  const winkels = {}; lijst.forEach(x => { (winkels[x.winkel] = winkels[x.winkel] || []).push(x); });
  return { vanaf, vandaag, totaal: samenvatting(lijst), perWinkel: Object.keys(winkels).sort((a, b) => a.localeCompare(b, 'nl')).map(w => Object.assign({ winkel: w }, samenvatting(winkels[w]))), medewerkers: lijst };
}
async function laad(vanaf) {
  const SB = require('./shiftbase');
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const med = await SB.getMedewerkers(false);
  const van = plus(vanaf, -VOOR_START_DAGEN), tot = plus(vandaag, 42), blokken = [];
  for (let a = van; a <= tot; a = plus(a, 31)) { const b = plus(a, 30) < tot ? plus(a, 30) : tot; blokken.push([a, b]); }
  const rosters = [];
  for (const [a, b] of blokken) { const r = await SB.sbGet('rosters?min_date=' + a + '&max_date=' + b); rosters.push(...((r && r.data) || r || [])); }
  return bereken(med, rosters, vanaf, vandaag);
}
module.exports = { bereken, laad, mediaan };
