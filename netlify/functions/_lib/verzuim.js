// ============================================================
// Fase 2b: verzuim uit Shiftbase-afwezigheden (type "Ziek" via VL_TYPE_MAP) en de Wet verbetering poortwachter.
// - Ziekteperiodes per medewerker; periodes die < VERZUIM_SAMENTEL_DAGEN (28) na elkaar beginnen tellen als één (4-wekenregel).
// - Mijlpalen (dag 42/56/294/364 vanaf de 1e ziektedag) voor lopende periodes.
// - Frequent verzuim: ≥ VERZUIM_FREQUENT_AANTAL losse ziekmeldingen in 12 maanden.
// Pure functies; de check in signaleringen.js haalt data op en mailt. Niets hiervan is een diagnose:
// alleen data uit Shiftbase (status Approved) over aanwezigheid.
// ============================================================
const C = require('./config');

const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const iso = d => d.toLocaleDateString('sv-SE');
const ddmm = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const dagen = (a, b) => Math.round((b - a) / 864e5);

function isZiek(optionId) {
  const t = C.VL_TYPE_MAP[String(optionId)];
  return !!(t && t.cat === 'ziekte');
}

// absences -> { userId: [ {start, eind, dagen, lopend, meldingen} ] }  (samengevoegd per 4-wekenregel)
function ziekteperiodes(absences, vandaag) {
  vandaag = vandaag || new Date();
  const per = {};
  for (const a0 of absences || []) {
    const a = (a0 && a0.Absentee) || a0 || {};
    if (String(a.status || '') !== 'Approved' || !isZiek(a.absentee_option_id)) continue;
    const s = dag(a.startdate), e = dag(a.enddate || a.startdate); if (!s) continue;
    const uid = String(a.user_id || '');
    (per[uid] = per[uid] || []).push({ s, e: e || s });
  }
  const uit = {};
  for (const uid of Object.keys(per)) {
    const lijst = per[uid].sort((x, y) => x.s - y.s);
    const periodes = [];
    for (const z of lijst) {
      const laatste = periodes[periodes.length - 1];
      if (laatste && dagen(laatste.e, z.s) <= C.VERZUIM_SAMENTEL_DAGEN) { if (z.e > laatste.e) laatste.e = z.e; laatste.meldingen++; }
      else periodes.push({ s: z.s, e: z.e, meldingen: 1 });
    }
    uit[uid] = periodes.map(p => ({ start: iso(p.s), eind: iso(p.e), dagen: dagen(p.s, p.e) + 1, lopend: p.e >= vandaag, meldingen: p.meldingen, dagVandaag: dagen(p.s, vandaag) + 1 }));
  }
  return uit;
}

// Signalen: mijlpalen voor lopende periodes + frequent verzuim.
function verzuimSignalen(med, periodesPerUser, vandaag) {
  vandaag = vandaag || new Date();
  const uit = [];
  const grens12 = new Date(vandaag.getTime() - 365 * 864e5);
  for (const m of med || []) {
    const ps = periodesPerUser[String(m.id)] || [];
    if (!ps.length) continue;
    const lopend = ps.find(p => p.lopend);
    if (lopend) {
      for (const mp of C.VERZUIM_MIJLPALEN) {
        const verschil = mp.dag - lopend.dagVandaag; // > 0 = nog te gaan
        if (verschil <= C.VERZUIM_SIGNAAL_DAGEN && verschil >= -C.VERZUIM_SIGNAAL_DAGEN) {
          uit.push({ soort: 'mijlpaal', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', sinds: ddmm(lopend.start), dag: lopend.dagVandaag, mijlpaal: mp.label, mijlpaalDag: mp.dag, over: verschil, teLaat: verschil < 0 });
        }
      }
      if (lopend.dagVandaag >= 14 && !uit.some(u => u.naam === m.naam)) uit.push({ soort: 'lopend', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', sinds: ddmm(lopend.start), dag: lopend.dagVandaag });
    }
    const recent = ps.filter(p => dag(p.start) >= grens12);
    const meldingen = recent.reduce((n, p) => n + p.meldingen, 0);
    if (meldingen >= C.VERZUIM_FREQUENT_AANTAL) uit.push({ soort: 'frequent', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', meldingen, periodes: recent.length, laatste: ddmm(recent[recent.length - 1].start) });
  }
  const rang = { mijlpaal: 0, frequent: 1, lopend: 2 };
  return uit.sort((a, b) => rang[a.soort] - rang[b.soort] || a.naam.localeCompare(b.naam, 'nl'));
}

// Dossier: periodes van één medewerker in leesbare vorm
function dossierVerzuim(periodes) {
  return (periodes || []).slice().reverse().map(p => ({ start: ddmm(p.start), eind: p.lopend ? '' : ddmm(p.eind), dagen: p.dagen, lopend: p.lopend, meldingen: p.meldingen, dagVandaag: p.lopend ? p.dagVandaag : null, volgendeMijlpaal: p.lopend ? (C.VERZUIM_MIJLPALEN.find(mp => mp.dag >= p.dagVandaag) || null) : null }));
}

module.exports = { isZiek, ziekteperiodes, verzuimSignalen, dossierVerzuim };
