// ============================================================
// v0.50.0 HACCP-naleving: welke verplichte HACCP-lijst is niet gedaan, en wie stond in dat tijdvak op het rooster?
//  - bron 1: Academy (hr_haccp_naleving, supabase/academy/hr_haccp.sql) -> per winkel per dag per lijst: gemist / laat / ok + tijdvak
//  - bron 2: Shiftbase-rooster (rosters per afdeling) -> wie stond er wanneer
// Keuze Mischa (16-11-2026): overtreding = lijst die dag NIET afgerond (te laat = alleen signaal); iedereen die in het tijdvak
// van de lijst geroosterd stond kan een waarschuwing krijgen (HR vinkt per persoon). Alles hier is puur, behalve haal().
// ============================================================
const C = require('./config');

const MIN_OVERLAP = 30;   // minuten: een dienst telt pas mee als hij minstens zo lang in het tijdvak valt
const WEEKDAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const tijdMin = v => { const m = String(v == null ? '' : v).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const hhmm = m => m == null ? '' : String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const kortDatum = iso => { const d = new Date(iso + 'T12:00:00Z'); return WEEKDAG[d.getUTCDay()] + ' ' + iso.slice(8, 10) + '-' + iso.slice(5, 7); };
const nlDatum = iso => iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) : '';

// Shiftbase rosters -> [{ uid, naam, code, datum, start, eind }]  (minuten; eind over middernacht = +1440)
function rooster(rosters, users) {
  const lijst = x => ((x && x.data) || x || []);
  const naamVan = {};
  for (const rec of lijst(users)) { const u = (rec && rec.User) || rec || {}; if (u.id != null) naamVan[String(u.id)] = ((u.first_name || '') + ' ' + (u.prefix ? u.prefix + ' ' : '') + (u.last_name || '')).replace(/\s+/g, ' ').trim(); }
  const uit = [], gezien = {};
  for (const rec of lijst(rosters)) {
    const r = (rec && rec.Roster) || rec || {};
    if (r.id == null || r.deleted === true || r.deleted === '1' || r.deleted === 1) continue;
    const uid = String(r.user_id || ''); if (!uid || uid === '0') continue;          // open dienst
    const code = C.SB_DEPT_CODE[String(r.department_id || '')]; if (!code) continue;    // keuken, HQ, franchise
    const datum = String(r.date || '').slice(0, 10), start = tijdMin(r.starttime); let eind = tijdMin(r.endtime);
    if (!datum || start == null || eind == null) continue;
    if (eind <= start) eind += 1440;
    const k = r.id + '|' + datum; if (gezien[k]) continue; gezien[k] = 1;
    const u = (rec && rec.User) || {};
    uit.push({ uid, naam: naamVan[uid] || ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || ('Medewerker #' + uid), code, datum, start, eind });
  }
  return uit;
}

// lijsten (Academy) + diensten (rooster) -> analyse
// o: { lijst: 'HACCP dag' (optioneel filter), winkels: [{code,naam}] }
function analyseer(lijsten, diensten, o) {
  o = o || {};
  const L = (lijsten || []).filter(l => !o.lijst || l.lijst === o.lijst);
  const perDag = {};
  for (const d of diensten || []) (perDag[d.code + '|' + d.datum] || (perDag[d.code + '|' + d.datum] = [])).push(d);
  const inTijdvak = l => {
    const v = tijdMin(l.van) == null ? 0 : tijdMin(l.van), t = tijdMin(l.tot) == null ? 1440 : tijdMin(l.tot);
    return (perDag[l.code + '|' + l.datum] || []).filter(d => Math.min(d.eind, t) - Math.max(d.start, v) >= MIN_OVERLAP)
      .sort((a, b) => a.start - b.start || a.naam.localeCompare(b.naam, 'nl'));
  };
  // Winkel dicht (niemand op het rooster die dag) -> telt niet mee
  const open = l => (perDag[l.code + '|' + l.datum] || []).length > 0;
  const winkels = {}, mw = {}, gemist = [];
  (o.winkels || []).forEach(w => { winkels[w.code] = { code: w.code, naam: w.naam, verwacht: 0, gemist: 0, laat: 0, dicht: 0 }; });
  for (const l of L) {
    const w = winkels[l.code] || (winkels[l.code] = { code: l.code, naam: l.winkel, verwacht: 0, gemist: 0, laat: 0, dicht: 0 });
    if (!open(l)) { w.dicht++; continue; }
    w.verwacht++;
    const ploeg = inTijdvak(l);
    for (const d of ploeg) {
      const m = mw[d.uid] || (mw[d.uid] = { uid: d.uid, naam: d.naam, winkels: {}, inTijdvak: 0, gemist: 0, laat: 0, voorvallen: [] });
      m.winkels[l.code] = (m.winkels[l.code] || 0) + 1; m.inTijdvak++;
      if (l.status === 'gemist') { m.gemist++; m.voorvallen.push({ datum: l.datum, code: l.code, winkel: w.naam, lijst: l.lijst, tijdvak: (l.van || '') + '–' + (l.tot || 'einde dag'), dienst: hhmm(d.start) + '–' + hhmm(d.eind) }); }
      if (l.status === 'laat') m.laat++;
    }
    if (l.status === 'laat') w.laat++;
    if (l.status === 'gemist') {
      w.gemist++;
      gemist.push({ datum: l.datum, dag: kortDatum(l.datum), code: l.code, winkel: w.naam, lijst: l.lijst, tijdvak: (l.van || '') + '–' + (l.tot || 'einde dag'),
        ploeg: ploeg.map(d => ({ uid: d.uid, naam: d.naam, dienst: hhmm(d.start) + '–' + hhmm(d.eind) })) });
    }
  }
  const wl = Object.values(winkels).map(w => Object.assign(w, { pctOpTijd: w.verwacht ? Math.round((w.verwacht - w.gemist - w.laat) / w.verwacht * 100) : null, pctGemist: w.verwacht ? Math.round(w.gemist / w.verwacht * 100) : null }))
    .sort((a, b) => (b.pctGemist || 0) - (a.pctGemist || 0) || a.naam.localeCompare(b.naam, 'nl'));
  const ml = Object.values(mw).filter(m => m.gemist > 0).map(m => {
    const hoofd = Object.keys(m.winkels).sort((a, b) => m.winkels[b] - m.winkels[a])[0];
    m.voorvallen.sort((a, b) => a.datum.localeCompare(b.datum));
    return { uid: m.uid, naam: m.naam, code: hoofd, winkels: Object.keys(m.winkels), inTijdvak: m.inTijdvak, gemist: m.gemist, laat: m.laat, pct: Math.round(m.gemist / m.inTijdvak * 100), laatste: m.voorvallen[m.voorvallen.length - 1].datum, voorvallen: m.voorvallen };
  }).sort((a, b) => b.gemist - a.gemist || b.pct - a.pct || a.naam.localeCompare(b.naam, 'nl'));
  const tot = wl.reduce((s, w) => ({ verwacht: s.verwacht + w.verwacht, gemist: s.gemist + w.gemist, laat: s.laat + w.laat }), { verwacht: 0, gemist: 0, laat: 0 });
  return { totaal: Object.assign(tot, { pctGemist: tot.verwacht ? Math.round(tot.gemist / tot.verwacht * 100) : 0, medewerkers: ml.length }), winkels: wl, medewerkers: ml, gemist: gemist.sort((a, b) => b.datum.localeCompare(a.datum) || a.winkel.localeCompare(b.winkel, 'nl')), lijstnamen: [...new Set((lijsten || []).map(l => l.lijst))].sort() };
}

// Toelichting voor in de waarschuwing (NL/EN)
function toelichting(m, en) {
  const r = m.voorvallen.map(v => '• ' + nlDatum(v.datum) + ' · ' + v.winkel + ' · ' + v.lijst + ' (' + (en ? 'to be completed ' : 'af te ronden ') + v.tijdvak + ') · ' + (en ? 'your shift ' : 'jouw dienst ') + v.dienst).join('\n');
  return en
    ? 'On the following days you were scheduled during the time window of a mandatory HACCP list, and the list was not completed that day:\n' + r + '\n\nEveryone on the schedule during that time window is jointly responsible for completing the list on time.'
    : 'Op de volgende dagen stond je op het rooster in het tijdvak van een verplichte HACCP-lijst, en is die lijst die dag niet afgerond:\n' + r + '\n\nIedereen die in dat tijdvak op het rooster staat, is er samen verantwoordelijk voor dat de lijst op tijd is afgerond.';
}

// Academy RPC (zelfde sleutel als de trainingskoppeling)
async function haal(van, tot, _fetch) {
  const sleutel = process.env.ACADEMY_HR_SLEUTEL;
  if (!sleutel) throw new Error('Koppeling met Academy staat nog niet aan: ACADEMY_HR_SLEUTEL ontbreekt in Netlify.');
  const r = await (_fetch || fetch)(C.ACADEMY_URL + '/rest/v1/rpc/hr_haccp_naleving', {
    method: 'POST', headers: { apikey: C.ACADEMY_KEY, Authorization: 'Bearer ' + C.ACADEMY_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_sleutel: sleutel, p_van: van || null, p_tot: tot || null })
  });
  const tekst = await r.text();
  if (!r.ok) {
    let msg = tekst; try { msg = JSON.parse(tekst).message || tekst; } catch (e) { /* tekst */ }
    if (r.status === 404 || /hr_haccp_naleving/.test(msg)) throw new Error('Functie hr_haccp_naleving ontbreekt in Academy: draai supabase/academy/hr_haccp.sql in het Academy-project.');
    if (/geen toegang/.test(msg) || r.status === 401 || r.status === 403) throw new Error('Academy weigert de sleutel (ACADEMY_HR_SLEUTEL).');
    throw new Error('Academy: ' + r.status + ' ' + String(msg).slice(0, 200));
  }
  return JSON.parse(tekst) || {};
}

module.exports = { MIN_OVERLAP, tijdMin, hhmm, nlDatum, kortDatum, rooster, analyseer, toelichting, haal };
