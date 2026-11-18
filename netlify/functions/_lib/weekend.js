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

// ---- v0.53.4: opgegeven beschikbaarheid (Shiftbase /availabilities) ----
// Shiftbase kent per dag: beschikbaar hele dag / beschikbaar vanaf, niet beschikbaar hele dag / niet beschikbaar vanaf.
// Veldnamen defensief (het API-object kan onder 'Availability' of 'UserAvailability' hangen; type in available_type/type/…).
const beschObj = a0 => { const el = a0 || {}; return el.Availability || el.UserAvailability || el.availability || Object.values(el).find(v => v && typeof v === 'object' && !Array.isArray(v) && 'user_id' in v) || el; };
function beschSoort(a) {
  if (a.available === false || a.available === 0 || a.available === '0') return 'niet';
  if (a.available === true || a.available === 1 || a.available === '1') return 'wel';
  const t = String(a.available_type || a.availability_type || a.type || a.availability || a.status || '').toLowerCase();
  if (/un|niet|not|no/.test(t)) return 'niet';
  if (/avail|beschik|yes|ja/.test(t)) return 'wel';
  return '';
}
// Per medewerker en per weekendvenster: welke vr/za/zo-dagen beschikbaar of niet beschikbaar zijn opgegeven
function beschikbaarheidPerUser(lijst, vensters) {
  const dag = {}; vensters.forEach((v, i) => { for (let d = 0; d < 3; d++) dag[iso(plusDagen(v.vr, d))] = i; });
  const per = {};
  (lijst || []).forEach(a0 => {
    const a = beschObj(a0), uid = String(a.user_id || ''), dt = String(a.date || '').slice(0, 10);
    if (!uid || dag[dt] === undefined) return;
    const s = beschSoort(a); if (!s) return;
    const p = per[uid] || (per[uid] = {}); const k = dt;
    if (s === 'wel' || !p[k]) p[k] = s; // 'wel' (bijv. beschikbaar vanaf 17:00) wint van 'niet' op dezelfde dag
  });
  const uit = {};
  Object.keys(per).forEach(uid => {
    const w = vensters.map(() => ({ wel: 0, niet: 0 }));
    Object.keys(per[uid]).forEach(dt => { w[dag[dt]][per[uid][dt]]++; });
    uit[uid] = w;
  });
  return uit;
}
// Samenvatting voor 1 medewerker. status: beschikbaar (elk weekend ≥ 2 dagen beschikbaar) · deels · niet · geen (niets opgegeven) · onbekend (geen data)
function beschikbaarheidStatus(perWeekend, aantal, geladen) {
  const dagen = aantal * 3;
  if (!geladen) return { status: 'onbekend', dagen };
  const w = perWeekend || [];
  const wel = w.reduce((s, x) => s + x.wel, 0), niet = w.reduce((s, x) => s + x.niet, 0), weekendenOk = w.filter(x => x.wel >= 2).length;
  const status = aantal && weekendenOk === aantal ? 'beschikbaar' : wel ? 'deels' : niet ? 'niet' : 'geen';
  return { status, wel, niet, dagen, weekendenOk, weekenden: aantal };
}
function beschikbaarheidTekst(b) {
  if (!b || b.status === 'onbekend') return '';
  if (b.status === 'beschikbaar') return 'wél beschikbaar opgegeven (' + b.wel + ' van ' + b.dagen + ' weekenddagen), toch niet ingeroosterd';
  if (b.status === 'deels') return 'beschikbaar opgegeven op ' + b.wel + ' van ' + b.dagen + ' weekenddagen' + (b.niet ? ', ' + b.niet + ' niet beschikbaar' : '');
  if (b.status === 'niet') return b.niet + ' van ' + b.dagen + ' weekenddagen niet beschikbaar opgegeven';
  return 'geen beschikbaarheid opgegeven voor het weekend';
}

// Weekendontwijkers: N opeenvolgende weekenden geen dienst/verlof, wél doordeweeks gewerkt
function bepaalWeekendOntwijkers(med, rosterLijst, absLijst, vandaag, aantalWeekenden, uitgesloten, beschLijst) {
  const vensters = weekendVensters(vandaag, aantalWeekenden);
  const besch = beschLijst ? beschikbaarheidPerUser(beschLijst, vensters) : null; // v0.53.4
  const dagNaarVenster = {};
  vensters.forEach((v, i) => { for (let d = 0; d < 3; d++) dagNaarVenster[iso(plusDagen(v.vr, d))] = i; });
  const startIso = iso(vensters[vensters.length - 1].vr), eindIso = iso(vensters[0].zo), vandaagIso = iso(vandaag);
  const nw = s => String(s || '').trim().toLowerCase().replace(/^sla\s+/, ''); // v0.38.5: 'Zuidas' = 'SLA Zuidas' = 'zuidas'
  const uit = {}; (uitgesloten || []).forEach(w => { uit[nw(w)] = true; });
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
    const w = m.winkelNaam || '(geen winkel)'; if (uit[nw(w)]) return;
    const uid = String(m.id || '');
    const ind = parseNLDatum(m.indienst); if (ind && ind > startD) return;
    const hits = wkHit[uid] || {}, verl = verlofVenster[uid] || {};
    for (let i = 0; i < vensters.length; i++) if (hits[i] || verl[i]) return;
    const dw = dwCount[uid] || 0; if (dw < 1) return;
    const lw = laatsteWk[uid] || '';
    const b = beschikbaarheidStatus(besch ? besch[uid] : null, aantalWeekenden, !!besch);
    out.push({ id: uid, naam: m.naam, email: m.email || '', winkel: w, doordeweeks: dw, laatsteWeekendDienst: lw ? ddmm(lw) : '', periode, beschikbaarheid: b,
      onderbouwing: 'In de periode ' + periode + ' had je in ' + aantalWeekenden + ' opeenvolgende weekenden geen enkele dienst op vrijdag, zaterdag of zondag, terwijl je in dezelfde periode ' + dw + ' doordeweekse dienst' + (dw === 1 ? '' : 'en') + ' werkte.' });
  });
  return out.sort((a, b) => a.winkel !== b.winkel ? (a.winkel < b.winkel ? -1 : 1) : b.doordeweeks - a.doordeweeks);
}

// Brief-klare onderbouwing voor 1 medewerker over de laatste N weekenden
function berekenWeekendOnderbouwing(userId, rosterLijst, absLijst, vandaag, aantalWeekenden, beschLijst) {
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
  // v0.53.4: opgegeven beschikbaarheid erbij (alleen als die uit Shiftbase kon worden gelezen)
  let beschikbaarheid = null;
  if (beschLijst) {
    beschikbaarheid = beschikbaarheidStatus((beschikbaarheidPerUser(beschLijst, vensters))[uid], aantalWeekenden, true);
    const b = beschikbaarheid;
    tekst += b.status === 'geen' ? ' Voor die weekenden had je in Shiftbase geen beschikbaarheid opgegeven.'
      : !b.wel ? ' In Shiftbase gaf je voor ' + b.niet + ' van de ' + b.dagen + ' weekenddagen (vrijdag t/m zondag) op dat je niet beschikbaar was.'
      : ' In Shiftbase gaf je voor die weekenden op ' + b.wel + ' van de ' + b.dagen + ' dagen (vrijdag t/m zondag) op dat je beschikbaar was' + (b.niet ? ' en op ' + b.niet + ' dagen dat je niet beschikbaar was' : '') + '.';
  }
  return { tekst, metDienst, metVerlof, doordeweeks: dw, periode, beschikbaarheid };
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
// v0.53.4: opgegeven beschikbaarheid ophalen (null = kon niet worden gelezen)
async function leesBeschikbaarheid(van, tot, userId) {
  try { const r = await SB.sbGet('availabilities?min_date=' + iso(van) + '&max_date=' + iso(tot) + (userId ? '&user_id=' + encodeURIComponent(userId) : '')); return (r && r.data) || (Array.isArray(r) ? r : []); }
  catch (e) { console.warn('beschikbaarheid Shiftbase:', e.message); return null; }
}
async function getWeekendOnderbouwing(userId) {
  if (!userId) throw new Error('Geen Shiftbase-id meegegeven.');
  const vandaag = vandaag0();
  const [{ ros, abs }, besch] = await Promise.all([roostersEnVerlof(C.BSK_ONDERBOUWING_WEKEN * 7 + 7, vandaag), leesBeschikbaarheid(plusDagen(vandaag, -(C.BSK_ONDERBOUWING_WEKEN * 7 + 7)), vandaag, userId)]);
  return berekenWeekendOnderbouwing(userId, ros, abs, vandaag, C.BSK_ONDERBOUWING_WEKEN, besch);
}

module.exports = { beschObj, beschSoort, beschikbaarheidPerUser, beschikbaarheidStatus, beschikbaarheidTekst, leesBeschikbaarheid, weekendVensters, bepaalWeekendOntwijkers, berekenWeekendOnderbouwing, getWeekendOnderbouwing, roostersEnVerlof, isoWeek, vandaag0, iso, plusDagen };
