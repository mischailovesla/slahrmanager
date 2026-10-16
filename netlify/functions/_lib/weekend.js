// ============================================================
// Weekendbeschikbaarheid (port van Shiftbase.gs v9.4: weekendVensters_,
// bepaalWeekendOntwijkers_, berekenWeekendOnderbouwing_, getWeekendOnderbouwing)
// Pure rekenfuncties + 1 Shiftbase-lezer. Raakt geen sheets aan.
// ============================================================
const SB = require('./shiftbase');
const C = require('./config');
const { parseNLDatum } = require('./util');

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const plusDagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const ddmm = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s); };
function isoWeek(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
// De laatste N VOLLEDIG afgeronde weekenden (vr/za/zo), meest recent eerst
function weekendVensters(vandaag, aantal) {
  const dow = vandaag.getDay(), terug = dow === 0 ? 7 : dow;
  const zondag = plusDagen(vandaag, -terug);
  const out = [];
  for (let i = 0; i < aantal; i++) { const zo = plusDagen(zondag, -7 * i), vr = plusDagen(zo, -2); out.push({ vr, zo, label: 'wk ' + isoWeek(vr) }); }
  return out;
}
const roster = r0 => (r0 && r0.Roster) || r0 || {};
const absentee = a0 => (a0 && a0.Absentee) || a0 || {};
const verwijderd = rr => rr.deleted === true || String(rr.deleted) === '1';

// Weekendontwijkers: N opeenvolgende weekenden geen dienst/verlof, wél doordeweeks gewerkt
function bepaalWeekendOntwijkers(med, rosterLijst, absLijst, vandaag, aantalWeekenden, uitgesloten) {
  const vensters = weekendVensters(vandaag, aantalWeekenden);
  const dagNaarVenster = {};
  vensters.forEach((v, i) => { for (let d = 0; d < 3; d++) dagNaarVenster[iso(plusDagen(v.vr, d))] = i; });
  const startIso = iso(vensters[vensters.length - 1].vr), eindIso = iso(vensters[0].zo), vandaagIso = iso(vandaag);
  const uit = {}; (uitgesloten || []).forEach(w => { uit[w] = true; });
  const wkHit = {}, dwCount = {}, laatsteWk = {};
  (rosterLijst || []).forEach(r0 => {
    const rr = roster(r0); if (verwijderd(rr)) return;
    const uid = String(rr.user_id || ''), dt = String(rr.date || ''); if (!uid || !dt || dt > vandaagIso) return;
    const mm = dt.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!mm) return;
    const dow = new Date(+mm[1], +mm[2] - 1, +mm[3]).getDay();
    if (dow === 5 || dow === 6 || dow === 0) {
      if (!laatsteWk[uid] || dt > laatsteWk[uid]) laatsteWk[uid] = dt;
      if (dagNaarVenster[dt] !== undefined) { (wkHit[uid] = wkHit[uid] || {})[dagNaarVenster[dt]] = true; }
    } else if (dt >= startIso && dt <= eindIso) dwCount[uid] = (dwCount[uid] || 0) + 1;
  });
  const verlofVenster = {};
  (absLijst || []).forEach(a0 => {
    const a = absentee(a0); if (String(a.status || '') !== 'Approved') return;
    const uid = String(a.user_id || ''), sd = String(a.startdate || ''), ed = String(a.enddate || a.startdate || ''); if (!uid || !sd) return;
    vensters.forEach((v, i) => { if (sd <= iso(v.zo) && ed >= iso(v.vr)) (verlofVenster[uid] = verlofVenster[uid] || {})[i] = true; });
  });
  const periode = ddmm(startIso) + ' t/m ' + ddmm(eindIso), startD = vensters[vensters.length - 1].vr;
  const out = [];
  (med || []).forEach(m => {
    const w = m.winkelNaam || '(geen winkel)'; if (uit[w]) return;
    const uid = String(m.id || '');
    const ind = parseNLDatum(m.indienst); if (ind && ind > startD) return;
    const hits = wkHit[uid] || {}, verl = verlofVenster[uid] || {};
    for (let i = 0; i < vensters.length; i++) if (hits[i] || verl[i]) return;
    const dw = dwCount[uid] || 0; if (dw < 1) return;
    const lw = laatsteWk[uid] || '';
    out.push({ naam: m.naam, email: m.email || '', winkel: w, doordeweeks: dw, laatsteWeekendDienst: lw ? ddmm(lw) : '', periode,
      onderbouwing: 'In de periode ' + periode + ' had je in ' + aantalWeekenden + ' opeenvolgende weekenden geen enkele dienst op vrijdag, zaterdag of zondag, terwijl je in dezelfde periode ' + dw + ' doordeweekse dienst' + (dw === 1 ? '' : 'en') + ' werkte.' });
  });
  return out.sort((a, b) => a.winkel !== b.winkel ? (a.winkel < b.winkel ? -1 : 1) : b.doordeweeks - a.doordeweeks);
}

// Brief-klare onderbouwing voor 1 medewerker over de laatste N weekenden
function berekenWeekendOnderbouwing(userId, rosterLijst, absLijst, vandaag, aantalWeekenden) {
  const uid = String(userId || '');
  const vensters = weekendVensters(vandaag, aantalWeekenden);
  const dagNaarVenster = {};
  vensters.forEach((v, i) => { for (let d = 0; d < 3; d++) dagNaarVenster[iso(plusDagen(v.vr, d))] = i; });
  const startIso = iso(vensters[vensters.length - 1].vr), eindIso = iso(vensters[0].zo);
  const wkDiensten = {}; let dw = 0;
  (rosterLijst || []).forEach(r0 => {
    const rr = roster(r0); if (verwijderd(rr) || String(rr.user_id || '') !== uid) return;
    const dt = String(rr.date || ''); if (!dt || dt < startIso || dt > eindIso) return;
    if (dagNaarVenster[dt] !== undefined) wkDiensten[dagNaarVenster[dt]] = (wkDiensten[dagNaarVenster[dt]] || 0) + 1; else dw++;
  });
  const verlofVenster = {};
  (absLijst || []).forEach(a0 => {
    const a = absentee(a0); if (String(a.status || '') !== 'Approved' || String(a.user_id || '') !== uid) return;
    const sd = String(a.startdate || ''), ed = String(a.enddate || a.startdate || ''); if (!sd) return;
    vensters.forEach((v, i) => { if (sd <= iso(v.zo) && ed >= iso(v.vr)) verlofVenster[i] = true; });
  });
  let metDienst = 0, metVerlof = 0;
  vensters.forEach((v, i) => { if (wkDiensten[i]) metDienst++; else if (verlofVenster[i]) metVerlof++; });
  const periode = ddmm(startIso) + ' t/m ' + ddmm(eindIso);
  let tekst = 'In de afgelopen ' + aantalWeekenden + ' weekenden (' + periode + ') was je in ' + metDienst + ' van de ' + aantalWeekenden + ' weekenden ingeroosterd voor een dienst op vrijdag, zaterdag of zondag';
  if (metVerlof > 0) tekst += '; in ' + metVerlof + ' weekend' + (metVerlof === 1 ? '' : 'en') + ' had je goedgekeurd verlof';
  tekst += '. In dezelfde periode werkte je ' + dw + ' doordeweekse dienst' + (dw === 1 ? '' : 'en') + '.';
  return { tekst, metDienst, metVerlof, doordeweeks: dw, periode };
}

const vandaag0 = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); d.setHours(0, 0, 0, 0); return d; };
async function roostersEnVerlof(dagenTerug, vandaag) {
  const [ros, abs] = await Promise.all([
    SB.sbGet('rosters?min_date=' + iso(plusDagen(vandaag, -dagenTerug)) + '&max_date=' + iso(vandaag)).then(r => (r && r.data) || r || []),
    SB.sbGet('absentees?min_date=' + iso(plusDagen(vandaag, -dagenTerug)) + '&max_date=' + iso(vandaag)).then(r => (r && r.data) || r || [])
  ]);
  return { ros, abs };
}
// Client-endpoint (read-only): onderbouwing voor 1 Shiftbase-id
async function getWeekendOnderbouwing(userId) {
  if (!userId) throw new Error('Geen Shiftbase-id meegegeven.');
  const vandaag = vandaag0();
  const { ros, abs } = await roostersEnVerlof(C.BSK_ONDERBOUWING_WEKEN * 7 + 7, vandaag);
  return berekenWeekendOnderbouwing(userId, ros, abs, vandaag, C.BSK_ONDERBOUWING_WEKEN);
}

module.exports = { weekendVensters, bepaalWeekendOntwijkers, berekenWeekendOnderbouwing, getWeekendOnderbouwing, roostersEnVerlof, isoWeek, vandaag0, iso, plusDagen };
