// ============================================================
// v0.26.0: Vroeg-vertrek-analyse — waarom vertrekt een deel van de nieuwe medewerkers binnen 90 dagen?
// Cohort: iedereen die in de afgelopen `maanden` maanden startte én al 90 dagen in dienst kón zijn
// (start tussen vandaag − maanden − 90 dagen en vandaag − 90 dagen). Vroeg vertrek = weg binnen 90 dagen.
// Uitsplitsing per winkel, functie, contracttype en startmaand; plus wanneer ze gaan (0–14 / 15–30 / 31–60 / 61–90 dagen),
// uitstroomredenen (dossier) en de check-in (30 dagen) van vroege vertrekkers vs. blijvers.
//   analyse({ med, perUser, ontslag, checkins, vandaag, maanden })  — puur, testbaar
//   laad(maanden)                                                    — haalt alles op
// ============================================================
const { normNaam } = require('./util');
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const GRENS = 90, MIN_N = 5;
const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nl = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const pct = (a, b) => b ? Math.round(a / b * 100) : null;
const FASES = [['0–14 dagen', 0, 14], ['15–30 dagen', 15, 30], ['31–60 dagen', 31, 60], ['61–90 dagen', 61, 89]];

// functie/contracttype van het eerste contract (rond de start); functie leeg → 'Onbekend'
function eersteContract(lijst, start) {
  if (!lijst || !lijst.length) return {};
  const rond = lijst.filter(c => c.start <= start || Math.abs((dag(c.start) - dag(start)) / 864e5) <= 31);
  return rond.length ? rond[rond.length - 1] : lijst[0];
}
const functieGroep = f => {
  const s = String(f || '').trim(); if (!s) return 'Onbekend';
  if (/manager/i.test(s)) return 'Management';
  return s.replace(/\s*\(.*\)$/, '');
};
const typeGroep = t => {
  const s = String(t || '').toLowerCase(); if (!s) return 'Onbekend';
  if (/oproep|nul|0[\s-]?uren|min\s*max/.test(s)) return 'Oproep / 0-uren';
  if (/onbepaald|vast\s*contract/.test(s)) return 'Onbepaalde tijd';
  if (/vaste uren|bepaald/.test(s)) return 'Vaste uren / bepaalde tijd';
  return t;
};

function analyse({ med, perUser, ontslag, checkins, vandaag, maanden }) {
  maanden = Number(maanden) || 12;
  const tot = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate() - GRENS);
  const van = new Date(tot.getFullYear(), tot.getMonth() - maanden, tot.getDate());
  const vanIso = iso(van), totIso = iso(tot);
  const redenVan = {}; (ontslag || []).forEach(r => { const n = normNaam(r.naam); if (n && (r.uitstroomreden || !redenVan[n])) redenVan[n] = String(r.uitstroomreden || '').trim() || '(dossier zonder reden)'; });
  const ciVan = {}; (checkins || []).forEach(c => { if (!c.ingevuld_op || c.score == null) return; const k = String(c.medewerker_id || '') || normNaam(c.naam); (ciVan[k] = ciVan[k] || []).push({ score: Number(c.score), laag: !!c.laag, moment: c.moment }); });

  const cohort = [];
  for (const m of med || []) {
    if (!m.start || m.start < vanIso || m.start > totIso) continue;
    const s = dag(m.start), e = m.eind ? dag(m.eind) : null;
    const dagen = e ? Math.round((e - s) / 864e5) : null;
    const vroeg = dagen !== null && dagen < GRENS;
    const c = eersteContract(perUser[String(m.id)], m.start);
    const ci = ciVan[String(m.id)] || ciVan[normNaam(m.naam)] || [];
    cohort.push({ id: m.id, naam: m.naam, winkel: m.winkel || '(geen winkel)', start: m.start, eind: m.eind || '', dagen, vroeg,
      functie: functieGroep(c.functie), type: typeGroep(c.type), startmaand: m.start.slice(0, 7),
      reden: vroeg ? (redenVan[normNaam(m.naam)] || '(geen dossier)') : '', ci: ci.length ? ci[0] : null });
  }
  const n = cohort.length, nv = cohort.filter(x => x.vroeg).length, gem = pct(nv, n);
  const groep = (key, label) => {
    const g = {};
    cohort.forEach(x => { const k = label ? label(x[key]) : x[key]; (g[k] = g[k] || { waarde: k, starters: 0, vroeg: 0 }); g[k].starters++; if (x.vroeg) g[k].vroeg++; });
    return Object.values(g).map(x => Object.assign(x, { pct: pct(x.vroeg, x.starters), klein: x.starters < MIN_N,
      oordeel: x.starters < MIN_N || gem == null ? 'klein' : pct(x.vroeg, x.starters) >= gem * 1.5 && x.vroeg >= 2 ? 'rood' : pct(x.vroeg, x.starters) >= gem * 1.15 ? 'oranje' : 'groen' }));
  };
  const perWinkel = groep('winkel').sort((a, b) => (b.pct || 0) - (a.pct || 0) || b.starters - a.starters);
  const perFunctie = groep('functie').sort((a, b) => (b.pct || 0) - (a.pct || 0) || b.starters - a.starters);
  const perType = groep('type').sort((a, b) => (b.pct || 0) - (a.pct || 0));
  const perMaand = groep('startmaand').sort((a, b) => a.waarde < b.waarde ? -1 : 1).map(x => Object.assign(x, { label: MAAND[+x.waarde.slice(5, 7) - 1] + ' ' + x.waarde.slice(2, 4) }));
  const vroegen = cohort.filter(x => x.vroeg);
  const fases = FASES.map(([label, a, b]) => ({ label, aantal: vroegen.filter(x => x.dagen >= a && x.dagen <= b).length })).map(f => Object.assign(f, { pct: pct(f.aantal, nv) }));
  const rt = {}; vroegen.forEach(x => { rt[x.reden] = (rt[x.reden] || 0) + 1; });
  const redenen = Object.keys(rt).map(r => ({ reden: r, aantal: rt[r], pct: pct(rt[r], nv) })).sort((a, b) => b.aantal - a.aantal);
  const ciGem = l => { const s = l.filter(x => x.ci).map(x => x.ci.score); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length * 10) / 10 : null; };
  const blijvers = cohort.filter(x => !x.vroeg);
  const checkin = { vroegN: vroegen.filter(x => x.ci).length, vroegScore: ciGem(vroegen), vroegLaag: vroegen.filter(x => x.ci && x.ci.laag).length,
    blijfN: blijvers.filter(x => x.ci).length, blijfScore: ciGem(blijvers), blijfLaag: blijvers.filter(x => x.ci && x.ci.laag).length };
  const mediaan = (() => { const d = vroegen.map(x => x.dagen).sort((a, b) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; })();

  // inzichten in gewone zinnen
  const zinnen = [];
  if (n) zinnen.push('Van de ' + n + ' medewerkers die tussen ' + nl(vanIso) + ' en ' + nl(totIso) + ' begonnen, vertrokken er ' + nv + ' binnen 90 dagen (' + gem + '%).' + (mediaan != null ? ' De helft daarvan was binnen ' + mediaan + ' dagen weg.' : ''));
  const vroegste = fases[0]; if (nv && vroegste.aantal) zinnen.push(vroegste.aantal + ' van de ' + nv + ' vroege vertrekkers (' + vroegste.pct + '%) ging al in de eerste 2 weken: dat wijst op werving, verwachtingen of de eerste diensten, niet op het werk zelf.');
  const opval = [].concat(perWinkel.map(x => ['winkel', x]), perFunctie.map(x => ['functie', x]), perType.map(x => ['contracttype', x])).filter(([, x]) => x.oordeel === 'rood').slice(0, 4);
  opval.forEach(([soort, x]) => zinnen.push('Opvallend (' + soort + '): ' + x.waarde + ' — ' + x.vroeg + ' van ' + x.starters + ' starters vertrok binnen 90 dagen (' + x.pct + '%, gemiddeld ' + gem + '%).'));
  const zonder = rt['(geen dossier)'] || 0; if (nv && zonder) zinnen.push(zonder + ' van de ' + nv + ' vroege vertrekkers heeft geen ontslagdossier en dus geen bekende reden.');
  if (checkin.vroegN >= 3 && checkin.blijfN >= 3 && checkin.vroegScore != null && checkin.blijfScore != null) zinnen.push('Check-in na 30 dagen: vroege vertrekkers gaven gemiddeld ' + String(checkin.vroegScore).replace('.', ',') + ', blijvers ' + String(checkin.blijfScore).replace('.', ',') + ' (op 5).');
  return { periode: { van: nl(vanIso), tot: nl(totIso), maanden }, starters: n, vroeg: nv, pct: gem, mediaanDagen: mediaan, minN: MIN_N,
    perWinkel, perFunctie, perType, perMaand, fases, redenen, checkin, zinnen,
    lijst: vroegen.sort((a, b) => a.start < b.start ? 1 : -1).map(x => ({ naam: x.naam, winkel: x.winkel, functie: x.functie, type: x.type, start: nl(x.start), eind: nl(x.eind), dagen: x.dagen, reden: x.reden, checkin: x.ci ? x.ci.score : null })) };
}

async function laad(maanden) {
  const VR = require('./verloop'), SB = require('./shiftbase'), S = require('./sheets'), { admin } = require('./auth');
  const vandaag = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); vandaag.setHours(0, 0, 0, 0);
  const [med, perUser, ontslag, checkins] = await Promise.all([
    VR.laadMedewerkers(false),
    SB.getContractenPerUser(false).catch(() => ({})),
    S.getOntslag(true).catch(() => []),
    admin().from('hr_checkin').select('medewerker_id,naam,moment,score,laag,ingevuld_op').order('verstuurd_op', { ascending: true }).limit(5000).then(r => r.data || []).catch(() => [])
  ]);
  return analyse({ med, perUser, ontslag, checkins, vandaag, maanden });
}
module.exports = { analyse, laad, functieGroep, typeGroep };
