// ============================================================
// Fase 2d: oproepovereenkomsten — aanbod vaste arbeidsomvang (art. 7:628a lid 5 BW).
// Na 12 maanden oproepcontract moet de werkgever binnen een maand schriftelijk een vaste arbeidsomvang aanbieden,
// minimaal het gemiddelde aantal uren van die 12 maanden. Weigert de medewerker, dan blijft het oproepcontract;
// het aanbod moet elk jaar herhaald worden. Zonder aanbod kan de medewerker loon claimen over de niet-aangeboden uren.
// - oproepkracht = contracttype met een OPROEP_TREFWOORD
// - 12-maandsgrens = OPROEP_MAANDEN na de start van de oproepketen (opeenvolgende oproepcontracten)
// - gemiddelde uren uit de roosters (Shiftbase) van de 12 maanden vóór de grens
// ============================================================
const C = require('./config');

const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const ddmm = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const iso = d => d.toLocaleDateString('sv-SE');
const minuten = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const isOproep = c => C.OPROEP_TREFWOORDEN.some(w => String(c.type || '').toLowerCase().indexOf(w) > -1);

// Start van de huidige oproepketen (opeenvolgende oproepcontracten, gat ≤ 1 maand) of null
function oproepSinds(contracten, vandaag) {
  const lijst = (contracten || []).filter(c => dag(c.start)).sort((a, b) => a.start < b.start ? -1 : 1);
  const huidig = lijst.filter(c => dag(c.start) <= vandaag && (!c.eind || dag(c.eind) >= vandaag)).pop();
  if (!huidig || !isOproep(huidig)) return null;
  let start = dag(huidig.start);
  for (let i = lijst.indexOf(huidig) - 1; i >= 0; i--) {
    const v = lijst[i]; if (!isOproep(v)) break;
    const e = dag(v.eind) || start; if (Math.round((start - e) / 864e5) > 31) break;
    start = dag(v.start);
  }
  return { sinds: start, contract: huidig };
}

// Gemiddelde uren per week/maand uit roosters in [van, tot]
function gemiddeldeUren(rosters, userId, van, tot) {
  let totaal = 0, diensten = 0;
  for (const r0 of rosters || []) {
    const r = (r0 && r0.Roster) || r0 || {};
    if (String(r.user_id || '') !== String(userId)) continue;
    const d = dag(r.date); if (!d || d < van || d > tot) continue;
    const s = minuten(r.starttime), e = minuten(r.endtime);
    let u = (s != null && e != null) ? ((e >= s ? e - s : e + 1440 - s) / 60) : (r.hours != null ? Number(r.hours) : 0);
    if (r.break != null && !isNaN(+r.break)) u -= (+r.break >= 5 ? +r.break / 60 : +r.break); // Shiftbase: pauze in minuten (kleine waarden = uren)
    totaal += Math.max(u, 0); diensten++;
  }
  const weken = Math.max(Math.round((tot - van) / (7 * 864e5)), 1);
  return { totaal: Math.round(totaal * 10) / 10, diensten, perWeek: Math.round(totaal / weken * 10) / 10, perMaand: Math.round(totaal / weken * 52 / 12 * 10) / 10, weken };
}

// Signalen: oproepkrachten die binnen OPROEP_SIGNAAL_DAGEN de 12-maandsgrens bereiken of er al overheen zijn,
// zonder aanbod in de laatste 12 maanden (aanbodPerPersoon: naam(norm)/e-mail -> datum laatste aanbod, iso)
function oproepSignalen(med, perUser, rosters, aanbodPerPersoon, vandaag) {
  vandaag = vandaag || new Date();
  const uit = [];
  for (const m of med || []) {
    const o = oproepSinds(perUser[String(m.id)] || [], vandaag); if (!o) continue;
    const grens = new Date(o.sinds.getTime()); grens.setMonth(grens.getMonth() + C.OPROEP_MAANDEN);
    const over = Math.round((grens - vandaag) / 864e5);
    if (over > C.OPROEP_SIGNAAL_DAGEN) continue;
    // herhaling: elk jaar opnieuw; laatste aanbod < 12 maanden geleden = klaar
    const sleutelE = String(m.email || '').toLowerCase(), sleutelN = String(m.naam || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const laatste = (sleutelE && aanbodPerPersoon[sleutelE]) || aanbodPerPersoon[sleutelN] || '';
    if (laatste && Math.round((vandaag - dag(laatste)) / 864e5) < 365) continue;
    const van = new Date(Math.max(grens.getTime() - 365 * 864e5, o.sinds.getTime())), tot = new Date(Math.min(grens.getTime(), vandaag.getTime()));
    const g = gemiddeldeUren(rosters, m.id, van, tot);
    uit.push({ naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', sinds: ddmm(iso(o.sinds)), grens: ddmm(iso(grens)), over, teLaat: over < 0, contractType: o.contract.type, gemPerWeek: g.perWeek, gemPerMaand: g.perMaand, diensten: g.diensten, periode: ddmm(iso(van)) + ' t/m ' + ddmm(iso(tot)), laatsteAanbod: laatste ? ddmm(laatste) : '' });
  }
  return uit.sort((a, b) => a.over - b.over);
}

module.exports = { isOproep, oproepSinds, gemiddeldeUren, oproepSignalen };
