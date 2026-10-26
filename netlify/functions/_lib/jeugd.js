// ============================================================
// Fase 2c: jeugd.
// 1. Minimumjeugdloon: het wettelijk minimum(jeugd)loon stijgt per verjaardag t/m 20 jaar (vanaf 21 volwassen minimumloon).
//    Verjaardagen van medewerkers ≤ 20 in de komende JEUGD_VERJAARDAG_DAGEN → doorgeven aan de salarisadministratie.
// 2. Arbeidstijdenwet / Nadere regeling kinderarbeid voor < 18: rooster van de komende ATW_DAGEN_VOORUIT dagen toetsen
//    aan ATW_REGELS (eindtijd, uren per dienst, uren per week). 13–14-jarigen mogen in de horeca niet werken → altijd melden.
// Alleen leeftijd wordt gebruikt (geen geboortedatum naar buiten).
// ============================================================
const C = require('./config');

const iso = d => d.toLocaleDateString('sv-SE');
const ddmm = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const minuten = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };

function verjaardagen(med, vandaag) {
  vandaag = vandaag || new Date();
  const uit = [];
  for (const m of med || []) {
    if (m.leeftijd == null || m.leeftijd > C.JEUGD_LOON_MAX_LEEFTIJD || m.leeftijd < 13 || !m.verjaardag) continue;
    const vj = dag(m.verjaardag); const over = Math.round((vj - vandaag) / 864e5);
    if (over < 0 || over > C.JEUGD_VERJAARDAG_DAGEN) continue;
    uit.push({ naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', wordt: m.leeftijd + 1, op: ddmm(m.verjaardag), over });
  }
  return uit.sort((a, b) => a.over - b.over);
}

function regelVoor(leeftijd) {
  if (leeftijd == null || leeftijd >= 18) return null;
  if (leeftijd <= 14) return { verboden: true, label: leeftijd + ' jaar: mag niet in de horeca werken (Nadere regeling kinderarbeid)' };
  if (leeftijd === 15) return C.ATW_REGELS['15'];
  return C.ATW_REGELS['16-17'];
}

// rosters (Shiftbase, komende dagen) toetsen voor medewerkers < 18
function atwOvertredingen(med, rosters, vandaag) {
  vandaag = vandaag || new Date();
  const byId = {}; (med || []).forEach(m => { byId[String(m.id)] = m; });
  const perUser = {};
  for (const r0 of rosters || []) {
    const r = (r0 && r0.Roster) || r0 || {};
    const uid = String(r.user_id || ''), m = byId[uid]; if (!m || m.leeftijd == null || m.leeftijd >= 18 || m.leeftijd < 13) continue;   // v0.31.4: < 13 = geboortedatum fout ingevuld (datacontrole meldt het)
    const dt = String(r.date || ''); if (!dt) continue;
    const s = minuten(r.starttime), e = minuten(r.endtime);
    let uren = (s != null && e != null) ? ((e >= s ? e - s : e + 1440 - s) / 60) : (r.hours != null ? Number(r.hours) : 0);
    if (r.break != null && !isNaN(+r.break)) uren -= (+r.break >= 5 ? +r.break / 60 : +r.break); // Shiftbase: pauze in minuten (kleine waarden = uren)
    (perUser[uid] = perUser[uid] || []).push({ datum: dt, start: r.starttime || '', eind: r.endtime || '', uren: Math.round(uren * 10) / 10, eindMin: e });
  }
  const uit = [];
  for (const uid of Object.keys(perUser)) {
    const m = byId[uid], regel = regelVoor(m.leeftijd), diensten = perUser[uid];
    if (!regel) continue;
    const meld = (wat, d) => uit.push({ naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', leeftijd: m.leeftijd, datum: ddmm(d.datum), dienst: d.start + '–' + d.eind, wat, regel: regel.label });
    if (regel.verboden) { diensten.forEach(d => meld('ingeroosterd terwijl werken op deze leeftijd niet is toegestaan', d)); continue; }
    const totMin = minuten(regel.tot);
    const perWeek = {};
    for (const d of diensten) {
      if (d.eindMin != null && totMin != null && (d.eindMin > totMin || d.eindMin < 300)) meld('dienst eindigt om ' + d.eind + ' (uiterlijk ' + regel.tot + ')', d);
      if (d.uren > regel.dienstMaxUur) meld('dienst van ' + d.uren + ' u (max. ' + regel.dienstMaxUur + ' u)', d);
      const dd = dag(d.datum); const wk = iso(new Date(dd.getTime() - ((dd.getDay() + 6) % 7) * 864e5));
      perWeek[wk] = (perWeek[wk] || 0) + d.uren;
    }
    for (const wk of Object.keys(perWeek)) if (perWeek[wk] > regel.weekMaxUur) uit.push({ naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', leeftijd: m.leeftijd, datum: 'week van ' + ddmm(wk), dienst: '', wat: Math.round(perWeek[wk] * 10) / 10 + ' u in de week (max. ' + regel.weekMaxUur + ' u)', regel: regel.label });
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam, 'nl') || a.datum.localeCompare(b.datum));
}

module.exports = { verjaardagen, atwOvertredingen, regelVoor };
