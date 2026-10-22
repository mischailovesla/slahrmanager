// ============================================================
// Fase 3c: scorekaart per winkel — dezelfde feiten per winkel naast elkaar, vergeleken met het SLA-gemiddelde.
// Voor het sturen op Store Managers door HR (Mischa, Jodi, Ymke); de PDF per winkel bevat alleen geaggregeerde cijfers.
//   bereken(input)       puur: medewerkers (verloop-datalaag), verloopresultaat, absences, check-ins, exits, aanzeggingen, checklists
//   getScorekaart(mnd)   haalt alles op en roept bereken aan
// Status per KPI t.o.v. de organisatie: groen / oranje / rood (drempels per richting), 'klein' bij te weinig gegevens, 'geen' zonder data.
// ============================================================
const C = require('./config');
const { normNaam, parseNLDatum } = require('./util');

const MIN_N = 3; // minder dan 3 reacties/medewerkers = niet vergelijken (en in de PDF niet tonen: anonimiteit)
const KPIS = [
  { key: 'verloop', label: 'Verloop', eenheid: '%', richting: 'laag', groep: 'Uitstroom', uitleg: 'Uitstroom in de periode ÷ gemiddeld bestand' },
  { key: 'vroegPct', label: 'Vertrek binnen 90 dagen', eenheid: '% v.d. uitstroom', richting: 'laag', groep: 'Uitstroom', uitleg: 'Deel van de vertrekkers dat korter dan 90 dagen in dienst was' },
  { key: 'uitval90', label: 'Nieuwe medewerkers weg ≤ 90 dagen', eenheid: '% v.d. instroom', richting: 'laag', groep: 'Instroom', uitleg: 'Van wie in de periode begon en 90 dagen kón halen: deel dat binnen 90 dagen vertrok' },
  { key: 'checkinScore', label: 'Check-in score', eenheid: '/5', richting: 'hoog', groep: 'Instroom', uitleg: 'Gemiddelde van de schaalvragen in de check-in na 30/60 dagen' },
  { key: 'checkinLaagPct', label: 'Lage check-ins', eenheid: '%', richting: 'laag', groep: 'Instroom', uitleg: 'Deel van de ingevulde check-ins met een lage score of een alarm-antwoord' },
  { key: 'onboarding', label: 'Onboarding binnen 21 dagen af', eenheid: '%', richting: 'hoog', groep: 'Instroom', uitleg: 'Onboarding-checklists die binnen 21 dagen zijn afgerond' },
  { key: 'welkomAf', label: 'Welkomstcollectie Academy af', eenheid: '%', richting: 'hoog', groep: 'Training', uitleg: 'Nu: van wie sinds de Academy-start begon en ≥ 21 dagen in dienst is, deel met de welkomstcollectie helemaal af' },
  { key: 'certGeldig', label: 'Certificaat voedselveiligheid geldig', eenheid: '%', richting: 'hoog', groep: 'Training', uitleg: 'Nu: deel van de medewerkers met alle verplichte certificaten (Basis voedselveiligheid, HACCP) geldig in Academy' },
  { key: 'verzuimPct', label: 'Verzuim', eenheid: '%', richting: 'laag', groep: 'In dienst', uitleg: 'Ziektedagen ÷ dagen in dienst (kalenderdagen, goedgekeurde ziekmeldingen in Shiftbase)' },
  { key: 'meldingsfreq', label: 'Ziekmeldingen per medewerker per jaar', eenheid: '', richting: 'laag', groep: 'In dienst', uitleg: 'Aantal ziekmeldingen omgerekend naar een heel jaar per medewerker' },
  { key: 'enps', label: 'eNPS exit-survey', eenheid: '', richting: 'hoog', vergelijk: 'verschil', groep: 'Uitstroom', uitleg: '% promotors (9–10) min % criticasters (0–6) onder vertrekkers' },
  { key: 'aanzegOpTijd', label: 'Aanzegging op tijd', eenheid: '%', richting: 'hoog', groep: 'Uitstroom', uitleg: 'Aanzeggingen die ≥ 30 dagen vóór de einddatum zijn verstuurd (art. 7:668 BW)' },
  // v0.27.2: doorlooptijden van dossiers
  { key: 'loonOpTijd', label: 'Loonheffing binnen 7 dagen', eenheid: '%', richting: 'hoog', groep: 'Dossiers', uitleg: 'Van de loonheffingsuitnodigingen (verstuurd in de periode, ≥ 7 dagen geleden): deel waarvan het formulier binnen 7 dagen binnen was. Te laat = anoniementarief (52%) op de eerste loonstrook' },
  { key: 'tekenDagen', label: 'Ontslagbrief getekend na', eenheid: 'dagen', richting: 'laag', groep: 'Dossiers', uitleg: 'Mediaan aantal dagen van versturen tot handtekening (ontslagbevestigingen en aanzeggingen verstuurd in de periode)' }
];

const isoD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const r1 = x => Math.round(x * 10) / 10;
const dagenTussen = (a, b) => Math.round((b - a) / 864e5);
const maandIdx = (maanden, isoStr) => maanden.findIndex(mm => isoStr >= mm.vanIso && isoStr <= mm.totIso);

function status(k, v, o, klein) {
  if (v === null || v === undefined) return 'geen';
  if (klein) return 'klein';
  if (o === null || o === undefined) return 'geen';
  if (k.vergelijk === 'verschil') { const d = v - o; return d <= -20 ? 'rood' : d <= -10 ? 'oranje' : 'groen'; }
  if (k.richting === 'laag') { if (o === 0) return v === 0 ? 'groen' : 'oranje'; const r = v / o; return r >= 1.3 ? 'rood' : r >= 1.1 ? 'oranje' : 'groen'; }
  if (o === 0) return 'groen'; const r = v / o; return r <= 0.85 ? 'rood' : r <= 0.95 ? 'oranje' : 'groen';
}
function sterk(k, v, o) {
  if (v === null || o === null || v === undefined || o === undefined) return false;
  if (k.vergelijk === 'verschil') return v - o >= 10;
  if (k.richting === 'laag') return o > 0 && v / o <= 0.8;
  return o > 0 && v / o >= 1.05;
}
const DECIMAAL = ['checkinScore', 'meldingsfreq', 'verzuimPct', 'tekenDagen'];
const fmt = (k, v) => v === null || v === undefined ? '-' : (DECIMAAL.includes(k.key) ? r1(v).toFixed(1) : String(Math.round(v))).replace('.', ',') + (k.eenheid === '%' || k.eenheid.indexOf('%') === 0 ? '%' : k.eenheid === '/5' ? '/5' : k.eenheid === 'dagen' ? ' d' : '');

// ---- puur rekenwerk ----
function bereken(inp) {
  const { med, verloop, absences, checkins, exits, aanzeggingen, checklists, academy, vandaag } = inp; const dossiers = inp.dossiers || [];
  const maanden = verloop.maanden, vanIso = maanden[0].vanIso, totIsoVol = maanden[maanden.length - 1].totIso;
  const vandaagIso = isoD(vandaag), totIso = totIsoVol > vandaagIso ? vandaagIso : totIsoVol;
  const van = dag(vanIso), tot = dag(totIso);
  const perId = {}, perNaam = {};
  (med || []).forEach(m => { perId[String(m.id)] = m.winkel; if (m.naam) perNaam[normNaam(m.naam)] = m.winkel; });
  const winkelVan = (id, naam, gegeven) => (id && perId[String(id)]) || (naam && perNaam[normNaam(naam)]) || gegeven || '';
  const namen = verloop.winkels.map(w => w.naam).filter(n => n && n !== '(geen winkel)');
  const leeg = () => ({ ziekDagen: 0, dienstDagen: 0, meldingen: 0, lopend: 0, ciVerstuurd: 0, ciIngevuld: 0, ciScores: [], ciLaag: 0, ciMaand: maanden.map(() => []), meldMaand: maanden.map(() => 0), ex: [], az: 0, azOpTijd: 0, ob: 0, obOpTijd: 0, mensen: 0, wkTelt: 0, wkAf: 0, ctTelt: 0, ctOk: 0, acad: false , lo7: 0, lo7Ok: 0, teken: []});
  const acc = {}; namen.forEach(n => { acc[n] = leeg(); }); const tot0 = leeg();
  const bij = (w, f) => { if (acc[w]) f(acc[w]); f(tot0); };

  // verzuim: kalenderdagen ziek binnen de periode ÷ kalenderdagen in dienst binnen de periode
  const VZ = require('./verzuim');
  const periodes = VZ.ziekteperiodes(absences || [], vandaag);
  for (const m of med || []) {
    if (!acc[m.winkel]) continue;
    const s = dag(m.start), e = m.eind ? dag(m.eind) : null; if (!s) continue;
    const a = s > van ? s : van, b = e && e < tot ? e : tot;
    if (b < a) continue;
    const dd = dagenTussen(a, b) + 1;
    bij(m.winkel, x => { x.dienstDagen += dd; x.mensen++; });
    for (const p of periodes[String(m.id)] || []) {
      for (const d of p.delen || [p]) { // alleen echte ziektedagen, niet de gewerkte dagen tussen samengetelde meldingen
        const ps = dag(d.start), pe = dag(d.eind) || ps; if (!ps) continue;
        const ca = ps > a ? ps : a, cb = pe < b ? pe : b;
        if (cb >= ca) bij(m.winkel, x => { x.ziekDagen += dagenTussen(ca, cb) + 1; });
      }
      if (p.start >= vanIso && p.start <= totIso) { const mi = maandIdx(maanden, p.start); bij(m.winkel, x => { x.meldingen += p.meldingen; if (mi > -1) x.meldMaand[mi] += p.meldingen; }); }
      if (p.lopend && (!e || e >= vandaag)) bij(m.winkel, x => { x.lopend++; });
    }
  }
  // check-ins (verstuurd in de periode)
  const inPeriode = ts => { const d = String(ts || '').slice(0, 10); return !d || (d >= vanIso && d <= totIsoVol); };
  for (const r of checkins || []) {
    if (!inPeriode(r.verstuurd_op)) continue;
    const w = winkelVan(r.medewerker_id, r.naam, r.winkel);
    bij(w, x => {
      x.ciVerstuurd++;
      if (r.ingevuld_op) {
        x.ciIngevuld++; if (r.laag) x.ciLaag++;
        if (r.score !== null && r.score !== undefined) { x.ciScores.push(Number(r.score)); const mi = maandIdx(maanden, String(r.ingevuld_op).slice(0, 10)); if (mi > -1) x.ciMaand[mi].push(Number(r.score)); }
      }
    });
  }
  // exit-survey (ingevuld in de periode; ook anoniem — winkel komt uit Shiftbase bij het invullen)
  for (const r of exits || []) { if (typeof r.nps !== 'number' || !inPeriode(r.ingevuld_op)) continue; const w = winkelVan(r.medewerker_id, r.naam, r.winkel); bij(w, x => { x.ex.push(r.nps); }); }
  // aanzeggingen met einddatum in de periode
  for (const r of aanzeggingen || []) {
    const eind = parseNLDatum(r.einddatum); if (!eind) continue; const ei = isoD(eind); if (ei < vanIso || ei > totIsoVol) continue;
    const w = winkelVan(r.mid, r.naam, ''); const vz = parseNLDatum(r.verzenddatum);
    bij(w, x => { x.az++; if (vz && dagenTussen(vz, eind) >= 30) x.azOpTijd++; });
  }
  // v0.27.2: doorlooptijden (dossiers verstuurd in de periode)
  for (const d of dossiers) {
    const vi = isoD(d.verzonden); if (vi < vanIso || vi > totIsoVol) continue;
    const w = winkelVan(d.mid, d.naam, '');
    if (d.soort === 'loonheffing') { if (dagenTussen(d.verzonden, vandaag) >= 7) bij(w, x => { x.lo7++; if (d.binnen && (d.binnen - d.verzonden) / 864e5 <= 7) x.lo7Ok++; }); }
    else if (d.binnen) { const dd = (d.binnen - d.verzonden) / 864e5; bij(w, x => { x.teken.push(dd); }); }
  }
  // onboarding-checklists gestart in de periode die 21 dagen de tijd hebben gehad (of al af zijn)
  for (const c of checklists || []) {
    if (c.type !== 'onboarding' || !c.gestart_op) continue; const gs = new Date(c.gestart_op); const gi = isoD(gs); if (gi < vanIso || gi > totIsoVol) continue;
    const af = c.afgerond_op ? new Date(c.afgerond_op) : null;
    if (!af && dagenTussen(gs, vandaag) < 21) continue;
    const w = winkelVan(c.medewerker_id, c.naam, c.winkel);
    bij(w, x => { x.ob++; if (af && dagenTussen(gs, af) <= 21) x.obOpTijd++; });
  }
  // Academy (stand van nu, niet per periode): welkomstcollectie en certificaten — alleen als de koppeling werkt
  if (academy) {
    const A = require('./academy'), vi = isoD(vandaag);
    for (const m of academy) {
      const b = A.beoordeel(m, vi);
      bij(m.winkel, x => { x.acad = true; if (b.welkomTelt) { x.wkTelt++; if (b.welkomAf) x.wkAf++; } if (b.certTelt) { x.ctTelt++; if (b.certOk) x.ctOk++; } });
    }
  }

  const gem = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const waarden = (vr, x) => {
    const enpsN = x.ex.length, prom = x.ex.filter(v => v >= 9).length, det = x.ex.filter(v => v <= 6).length;
    return {
      verloop: { v: vr ? vr.verloop : null, n: vr ? vr.gemBestand : 0, klein: !vr || vr.gemBestand < C.VRL_MIN_BESTAND },
      vroegPct: { v: vr && vr.uitstroom ? vr.vroegPct : null, n: vr ? vr.uitstroom : 0, klein: !vr || vr.uitstroom < MIN_N },
      uitval90: { v: vr && vr.cohort['90'] ? vr.cohort['90'].pct : null, n: vr && vr.cohort['90'] ? vr.cohort['90'].n : 0, klein: !vr || !vr.cohort['90'] || vr.cohort['90'].n < MIN_N },
      checkinScore: { v: x.ciScores.length ? r1(gem(x.ciScores)) : null, n: x.ciScores.length, klein: x.ciScores.length < MIN_N },
      checkinLaagPct: { v: x.ciIngevuld ? Math.round(x.ciLaag / x.ciIngevuld * 100) : null, n: x.ciIngevuld, klein: x.ciIngevuld < MIN_N },
      onboarding: { v: x.ob ? Math.round(x.obOpTijd / x.ob * 100) : null, n: x.ob, klein: false },
      verzuimPct: { v: x.dienstDagen ? r1(x.ziekDagen / x.dienstDagen * 100) : null, n: x.mensen, klein: x.mensen < MIN_N },
      meldingsfreq: { v: x.dienstDagen ? r1(x.meldingen / (x.dienstDagen / 365)) : null, n: x.mensen, klein: x.mensen < MIN_N },
      enps: { v: enpsN ? Math.round((prom - det) / enpsN * 100) : null, n: enpsN, klein: enpsN < MIN_N },
      welkomAf: { v: x.wkTelt ? Math.round(x.wkAf / x.wkTelt * 100) : null, n: x.wkTelt, klein: x.wkTelt < MIN_N },
      certGeldig: { v: x.ctTelt ? Math.round(x.ctOk / x.ctTelt * 100) : null, n: x.ctTelt, klein: x.ctTelt < MIN_N },
      aanzegOpTijd: { v: x.az ? Math.round(x.azOpTijd / x.az * 100) : null, n: x.az, klein: false },
      loonOpTijd: { v: x.lo7 ? Math.round(x.lo7Ok / x.lo7 * 100) : null, n: x.lo7, klein: x.lo7 < MIN_N },
      tekenDagen: { v: x.teken.length ? r1(require('./doorloop').mediaan(x.teken)) : null, n: x.teken.length, klein: x.teken.length < MIN_N }
    };
  };
  const metFmt = ws => { KPIS.forEach(k => { ws[k.key].f = fmt(k, ws[k.key].v); }); return ws; };
  const totaalVr = verloop.totaal;
  const totaal = { naam: 'SLA totaal', bestand: totaalVr.bestandNu, bestandEind: totaalVr.bestandEind, instroom: totaalVr.instroom, uitstroom: totaalVr.uitstroom, lopendVerzuim: tot0.lopend, waarden: metFmt(waarden(totaalVr, tot0)),
    trend: { uit: totaalVr.maandUit, in: totaalVr.maandIn, checkin: tot0.ciMaand.map(a => a.length ? r1(gem(a)) : null), meldingen: tot0.meldMaand },
    checkin: { verstuurd: tot0.ciVerstuurd, ingevuld: tot0.ciIngevuld, laag: tot0.ciLaag } };
  const winkels = verloop.winkels.filter(w => acc[w.naam]).map(vr => {
    const x = acc[vr.naam], ws = metFmt(waarden(vr, x)), aandacht = [], goed = [];
    for (const k of KPIS) {
      const o = totaal.waarden[k.key].v, item = ws[k.key];
      item.status = status(k, item.v, o, item.klein);
      if (item.status === 'rood') {
        let extra = '';
        if (k.vergelijk === 'verschil') extra = ' (' + (item.v - o > 0 ? '+' : '') + Math.round(item.v - o) + ' t.o.v. SLA)';
        else if (k.richting === 'laag' && o > 0) extra = ' — ' + String(r1(item.v / o)).replace('.', ',') + '× het SLA-gemiddelde';
        aandacht.push({ key: k.key, tekst: k.label + ': ' + fmt(k, item.v) + ' (SLA ' + fmt(k, o) + ')' + extra });
      } else if (item.status === 'groen' && sterk(k, item.v, o)) goed.push({ key: k.key, tekst: k.label + ': ' + fmt(k, item.v) + ' (SLA ' + fmt(k, o) + ')' });
    }
    return { naam: vr.naam, bestand: vr.bestandNu, bestandEind: vr.bestandEind, instroom: vr.instroom, uitstroom: vr.uitstroom, lopendVerzuim: x.lopend, waarden: ws, aandacht, goed,
      rood: aandacht.length, oranje: KPIS.filter(k => ws[k.key].status === 'oranje').length,
      trend: { uit: vr.maandUit, in: vr.maandIn, checkin: x.ciMaand.map(a => a.length ? r1(gem(a)) : null), meldingen: x.meldMaand },
      checkin: { verstuurd: x.ciVerstuurd, ingevuld: x.ciIngevuld, laag: x.ciLaag } };
  }).sort((a, b) => b.rood - a.rood || b.oranje - a.oranje || a.naam.localeCompare(b.naam, 'nl'));
  const doorloop = dossiers.length ? require('./doorloop').stats(dossiers, vandaag, vanIso, totIsoVol) : null;
  return { kpis: KPIS, maanden: maanden.map(m => m.label), periode: maanden[0].label + ' t/m ' + maanden[maanden.length - 1].label, vanIso, totIso, winkels, totaal, minN: MIN_N, doorloop };
}

// ---- ophalen ----
const nuNL = () => { const nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); nu.setHours(0, 0, 0, 0); return nu; };
// Alle bronnen voor de periode [vanIso, totIso] in één keer (ook gebruikt door het maandrapport, fase 4b).
// Ontbrekende tabel/bron → melding in fouten, de rest werkt door. academy = null als de koppeling (nog) niet werkt.
async function laadBronnen(vanIso, totIso, ververs) {
  const VR = require('./verloop'), SB = require('./shiftbase'), S = require('./sheets'), { admin } = require('./auth');
  const db = admin(), fouten = [];
  const veilig = async (naam, f) => { try { return await f(); } catch (e) { fouten.push(naam + ': ' + e.message); return []; } };
  const lijst = r => { if (r.error) throw new Error(r.error.message); return r.data || []; };
  const academyP = (async () => { try { const r = await require('./academy').laad(ververs); return r.lijst; } catch (e) { if (process.env.ACADEMY_HR_SLEUTEL) fouten.push('Academy: ' + e.message); return null; } })();
  const [med, absences, checkins, exits, ontslag, checklists] = await Promise.all([
    VR.laadMedewerkers(ververs),
    veilig('verzuim (Shiftbase)', async () => { const r = await SB.sbGet('absentees?min_date=' + isoD(new Date(dag(vanIso).getTime() - 60 * 864e5)) + '&max_date=' + totIso); return (r && r.data) || r || []; }),
    veilig('check-ins', async () => lijst(await db.from('hr_checkin').select('medewerker_id,naam,winkel,verstuurd_op,ingevuld_op,score,laag').gte('verstuurd_op', vanIso + 'T00:00:00').lte('verstuurd_op', totIso + 'T23:59:59'))),
    veilig('exit-survey', async () => lijst(await db.from('hr_exit').select('medewerker_id,naam,winkel,nps,ingevuld_op').gte('ingevuld_op', vanIso + 'T00:00:00').lte('ingevuld_op', totIso + 'T23:59:59'))),
    veilig('ontslagdossiers', async () => S.getOntslag(true)),
    veilig('checklists', async () => lijst(await db.from('hr_checklists').select('type,naam,winkel,medewerker_id,gestart_op,afgerond_op').eq('type', 'onboarding')))
  ]);
  // v0.27.2: doorlooptijden — loonheffing + ontslag/aanzegging met hun 'binnen'-moment (upload, formulier, digitale handtekening)
  const loon = await veilig('loonheffing', async () => S.getLoonheffing(true));
  const DL = require('./doorloop');
  const dossiers = await veilig('doorlooptijden', async () => DL.tijdlijn(Object.assign({ loon, ontslag }, await DL.laad())));
  const academy = await academyP;
  return { med, absences, checkins, exits, aanzeggingen: (ontslag || []).filter(r => r.type === 'aanzegging'), dossiers, checklists, academy, fouten };
}

async function getScorekaart(maanden, ververs) {
  maanden = [3, 6, 12].includes(Number(maanden)) ? Number(maanden) : 6;
  const VR = require('./verloop');
  const nu = nuNL();
  const med = await VR.laadMedewerkers(ververs);
  const verloop = VR.berekenVerloop(med, new Date(nu.getFullYear(), nu.getMonth(), 1), maanden, nu);
  const vanIso = verloop.maanden[0].vanIso, totIso = verloop.maanden[verloop.maanden.length - 1].totIso;
  const b = await laadBronnen(vanIso, totIso, ververs);
  const r = bereken(Object.assign({}, b, { verloop, vandaag: nu }));
  r.academy = !!b.academy;
  r.maandenAantal = maanden; r.fouten = b.fouten; r.bijgewerkt = require('./datum').stempel();
  return r;
}

module.exports = { KPIS, MIN_N, bereken, getScorekaart, laadBronnen, nuNL, status, fmt, sterk };
