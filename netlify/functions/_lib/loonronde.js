// ============================================================
// v0.56.0: Loonronde — de maandelijkse aanlevering aan de salarisadministratie (Mahdia / HRM Online).
// Eén loonmaand (M) heeft twee aanlevermomenten in de maand daarna:
//   6e  : uurloners — uitdraai van alle gewerkte uren + controle dat alle ziektedagen op 0 uur staan
//   18e : vastloners — mutaties (vakantie, ziekte, overig) + wachtdagen (ziekte) + uitdienst, in één mail
// Valt een deadline in het weekend, dan telt de werkdag ervoor (feestdagen niet).
// Pure rekenfuncties (testbaar) + dunne laders die Shiftbase aanroepen. Afvinken staat in hr_instellingen
// (sleutel loonronde_JJJJ-MM), dus geen migratie nodig.
// ============================================================
const C = require('./config');
const { normNaam, parseNLDatum } = require('./util');

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const pad2 = n => String(n).padStart(2, '0');
const r2 = x => Math.round(x * 100) / 100;
const isoVan = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const ddmm = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const parseIso = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m && m[1] !== '0000' ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const dagenTussen = (a, b) => Math.round((b - a) / 864e5);
const vandaag0 = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); d.setHours(0, 0, 0, 0); return d; };
const nuNL = () => require('./datum').stempel();
const naamVan = u => ((u.first_name || '') + ' ' + (u.prefix ? u.prefix + ' ' : '') + (u.last_name || '')).replace(/\s+/g, ' ').trim();
const rec1 = (rec, sleutel) => (rec && rec[sleutel]) || rec || {};

// ---------- Periode en deadlines ----------
function periode(jaar, maand) {
  jaar = Number(jaar); maand = Number(maand);
  if (!(jaar >= 2024 && jaar <= 2100) || !(maand >= 1 && maand <= 12)) throw new Error('Kies een geldige maand.');
  const laatste = new Date(jaar, maand, 0).getDate();
  return { jaar, maand, label: MAANDEN[maand - 1] + ' ' + jaar, van: jaar + '-' + pad2(maand) + '-01', tot: jaar + '-' + pad2(maand) + '-' + pad2(laatste), sleutel: jaar + '-' + pad2(maand) };
}
// De loonmaand die nu aan de beurt is = de vorige maand
function standaardMaand(vandaag) { vandaag = vandaag || vandaag0(); const d = new Date(vandaag.getFullYear(), vandaag.getMonth() - 1, 1); return { jaar: d.getFullYear(), maand: d.getMonth() + 1 }; }

const STAPPEN = [
  { sleutel: 'uren', label: 'Uren-uitdraai uurloners naar salaris', dag: 6, groep: 'uurloners' },
  { sleutel: 'ziekte', label: 'Ziektedagen uurloners gecontroleerd (alle op 0 uur)', dag: 6, groep: 'uurloners' },
  { sleutel: 'mutaties', label: 'Mutaties vastloners + wachtdagen doorgegeven aan Mahdia', dag: 18, groep: 'vastloners' },
  { sleutel: 'uitdienst', label: 'Uitdienst doorgegeven aan Mahdia', dag: 18, groep: 'vastloners' }
];
function werkdagOpOfVoor(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() - 1); return x; }
// Deadline voor loonmaand (jaar, maand 1-12): dag `dag` van de maand erna (new Date(jaar, maand, dag) = volgende maand)
const deadlineVan = (jaar, maand, dag) => werkdagOpOfVoor(new Date(Number(jaar), Number(maand), dag));

// ---------- Afvinken (hr_instellingen) ----------
const sleutelVan = p => 'loonronde_' + p.sleutel;
async function leesStatus(jaar, maand) {
  const I = require('./instellingen'), p = periode(jaar, maand), k = sleutelVan(p);
  I.vergeet(k);
  const s = await I.lees(k, null);
  return s && typeof s === 'object' ? { stappen: s.stappen || {}, mail: s.mail || null } : { stappen: {}, mail: null };
}
async function zetStap(jaar, maand, stap, klaar, door) {
  if (!STAPPEN.some(s => s.sleutel === stap)) throw new Error('Onbekende stap: ' + stap);
  const I = require('./instellingen'), p = periode(jaar, maand), st = await leesStatus(jaar, maand);
  if (klaar) st.stappen[stap] = { klaar: true, door: door || '', tijd: nuNL() }; else delete st.stappen[stap];
  await I.schrijf(sleutelVan(p), st, door);
  return st;
}
async function zetMail(jaar, maand, info, door) {
  const I = require('./instellingen'), p = periode(jaar, maand), st = await leesStatus(jaar, maand);
  st.mail = info;
  ['mutaties', 'uitdienst'].forEach(s => { st.stappen[s] = { klaar: true, door: door || '', tijd: info.tijd, viaMail: true }; });
  await I.schrijf(sleutelVan(p), st, door);
  return st;
}
function stappenOverzicht(jaar, maand, status, vandaag) {
  vandaag = vandaag || vandaag0();
  return STAPPEN.map(s => {
    const dl = deadlineVan(jaar, maand, s.dag), x = (status && status.stappen && status.stappen[s.sleutel]) || null;
    return { sleutel: s.sleutel, label: s.label, groep: s.groep, deadline: ddmm(isoVan(dl)), deadlineIso: isoVan(dl), nominaal: s.dag, dagen: dagenTussen(vandaag, dl), klaar: !!(x && x.klaar), door: x ? x.door : '', tijd: x ? x.tijd : '', viaMail: !!(x && x.viaMail) };
  });
}
// Signalering: stappen die (bijna) aan de beurt of te laat zijn en nog niet zijn afgevinkt.
// Venster: 3 dagen vooraf t/m 10 dagen na de deadline; alleen loonmaanden vanaf C.LOONRONDE_VANAF.
async function openStappen(vandaag, leesFn) {
  vandaag = vandaag || vandaag0(); leesFn = leesFn || leesStatus;
  const vanaf = String(C.LOONRONDE_VANAF || '0000-00'), uit = [];
  for (let k = 0; k <= 3; k++) {
    const d = new Date(vandaag.getFullYear(), vandaag.getMonth() - k, 1), jaar = d.getFullYear(), maand = d.getMonth() + 1;
    if ((jaar + '-' + pad2(maand)) < vanaf) continue;
    const ov = stappenOverzicht(jaar, maand, null, vandaag).filter(s => s.dagen <= 3 && s.dagen >= -10);
    if (!ov.length) continue;
    const st = await leesFn(jaar, maand), p = periode(jaar, maand);
    for (const s of stappenOverzicht(jaar, maand, st, vandaag)) {
      if (s.klaar || !(s.dagen <= 3 && s.dagen >= -10)) continue;
      const wanneer = s.dagen < 0 ? (-s.dagen) + ' dag' + (s.dagen === -1 ? '' : 'en') + ' te laat' : s.dagen === 0 ? 'vandaag deadline' : 'deadline ' + s.deadline + ' (over ' + s.dagen + ' dag' + (s.dagen === 1 ? '' : 'en') + ')';
      uit.push({ sleutel: p.sleutel + '|' + s.sleutel, stap: s.sleutel, jaar, maand, loonmaand: p.label, label: s.label, deadline: s.deadline, dagen: s.dagen, titel: s.label + ' — ' + p.label, sub: wanneer });
    }
  }
  return uit.sort((a, b) => a.dagen - b.dagen);
}

// ---------- Uurloners: uren + ziektecontrole ----------
function bouwContext(users, med) {
  const byId = {};
  for (const rec of users || []) { const u = rec1(rec, 'User'); if (u.id != null) byId[String(u.id)] = { naam: naamVan(u), email: String(u.email || '').trim().toLowerCase(), enddate: String(u.enddate || '').slice(0, 10), anon: u.anonymized === true || u.anonymized === '1' || u.anonymized === 1 }; }
  const V = require('./vastloners');
  const vastIds = new Set(V.bepaalVastloners(med || []).map(v => String(v.id)));
  const vastNamen = new Set((C.VASTLONER_NAMEN || []).map(normNaam)), uitgesloten = new Set((C.SB_UITGESLOTEN_NAMEN || []).map(normNaam));
  const extra = (C.VASTLONER_EXTRA || []).map(x => String(x).toLowerCase()), uitsl = (C.VASTLONER_UITSLUITEN || []).map(x => String(x).toLowerCase());
  const isVast = uid => { const u = byId[uid]; if (!u) return false; if (u.email && uitsl.indexOf(u.email) > -1) return false; return vastIds.has(uid) || vastNamen.has(normNaam(u.naam)) || (u.email && extra.indexOf(u.email) > -1); };
  const isUurloner = uid => { const u = byId[uid]; return !!u && !u.anon && !isVast(uid) && !uitgesloten.has(normNaam(u.naam)); };
  const medById = {}; for (const m of med || []) medById[String(m.id)] = m;
  return { byId, isVast, isUurloner, medById };
}
function plaatsVan(dept, teamId, depNaam, teamNaam) {
  const code = (C.SB_DEPT_CODE || {})[dept];
  if (code && C.WINKEL_BV_MAP[code]) return { bv: C.WINKEL_BV_MAP[code].bv, winkel: C.WINKEL_BV_MAP[code].naam };
  const naam = depNaam[dept] || teamNaam[String(teamId || '')] || 'Onbekend';
  if ((C.SB_FRANCHISE_DEPTS || {})[dept] || C.FRANCHISE_NAAM.test(naam)) return null; // franchise: niet via SLA-salaris
  const ke = (C.WAARSCHUWING_EXTRA_LOCATIES || {}).KE;
  const bv = /keuken/i.test(naam) ? (ke ? ke.bv : '(BV onbekend)') : /^hq$|kantoor/i.test(naam) ? C.WINKEL_BV_MAP.HO.bv : '(BV onbekend)';
  return { bv, winkel: naam };
}
// Timesheets -> uren per uurloner per winkel + uren per dag (voor de ziektecontrole)
function verwerkUren(tsLijst, ctx, teams, depts, p) {
  const F = require('./fooi');
  const depNaam = {}, teamNaam = {}, teamDept = {};
  for (const rec of depts || []) { const d = rec1(rec, 'Department'); if (d.id != null) depNaam[String(d.id)] = String(d.name || '').trim(); }
  for (const rec of teams || []) { const t = rec1(rec, 'Team'); if (t.id != null) { teamNaam[String(t.id)] = String(t.name || '').trim(); teamDept[String(t.id)] = String(t.department_id || ''); } }
  const per = {}, perDag = {}; let openUren = 0, openAantal = 0, afgewezen = 0, vastOvergeslagen = 0;
  for (const rec of tsLijst || []) {
    const t = rec1(rec, 'Timesheet');
    const datum = String(t.date || '').slice(0, 10);
    if (!datum || datum < p.van || datum > p.tot) continue;
    if (t.deleted === true || t.deleted === '1' || t.deleted === 1) continue;
    const st = String(t.status || '').toLowerCase();
    if (/declin|reject|afgewez/.test(st)) { afgewezen++; continue; }
    const uid = String(t.user_id || ''); if (!uid) continue;
    if (!ctx.isUurloner(uid)) { if (ctx.isVast(uid)) vastOvergeslagen++; continue; }
    const uren = F.urenVan(t); if (!(uren > 0)) continue;
    const dept = String(t.department_id || teamDept[String(t.team_id || '')] || '');
    const pl = plaatsVan(dept, t.team_id, depNaam, teamNaam); if (!pl) continue;
    const open = /pend|open|wacht/.test(st);
    if (open) { openUren += uren; openAantal++; }
    const k = uid + '|' + pl.bv + '|' + pl.winkel;
    const r = per[k] || (per[k] = { userId: uid, naam: ctx.byId[uid].naam, bv: pl.bv, winkel: pl.winkel, uren: 0, openUren: 0, einde: ctx.byId[uid].enddate && ctx.byId[uid].enddate !== '0000-00-00' ? ctx.byId[uid].enddate : '' });
    r.uren += uren; if (open) r.openUren += uren;
    (perDag[uid] = perDag[uid] || {})[datum] = r2(((perDag[uid] || {})[datum] || 0) + uren);
  }
  const regels = Object.values(per).map(x => Object.assign(x, { uren: r2(x.uren), openUren: r2(x.openUren) }))
    .sort((a, b) => a.bv.localeCompare(b.bv, 'nl') || a.winkel.localeCompare(b.winkel, 'nl') || a.naam.localeCompare(b.naam, 'nl'));
  const bvs = {}, medew = new Set();
  for (const r of regels) { medew.add(r.userId); const b = bvs[r.bv] || (bvs[r.bv] = { bv: r.bv, uren: 0, ids: new Set() }); b.uren += r.uren; b.ids.add(r.userId); }
  const perBv = Object.values(bvs).map(b => ({ bv: b.bv, uren: r2(b.uren), medewerkers: b.ids.size })).sort((a, b) => a.bv.localeCompare(b.bv, 'nl'));
  const waarschuwingen = [];
  if (openAantal) waarschuwingen.push(openAantal + ' timesheet(s) met ' + String(r2(openUren)).replace('.', ',') + ' uur zijn nog niet goedgekeurd in Shiftbase; ze staan er wel in. Keur ze eerst goed (of af) voordat je de uitdraai doorstuurt.');
  const onbekendBv = regels.filter(r => /onbekend/i.test(r.bv)); if (onbekendBv.length) waarschuwingen.push(onbekendBv.length + ' regel(s) in een team zonder bekende BV (' + [...new Set(onbekendBv.map(r => r.winkel))].join(', ') + ') — controleer bij welke BV deze uren horen.');
  return { regels, perBv, totaal: { uren: r2(regels.reduce((n, r) => n + r.uren, 0)), medewerkers: medew.size, regels: regels.length }, afgewezen, vastOvergeslagen, waarschuwingen, perDag };
}
// Ziekmeldingen van uurloners: staan alle ziektedagen op 0 uur?
function ziekteControle(absLijst, typeMap, ctx, perDag, p) {
  const start = parseIso(p.van), eind = parseIso(p.tot), per = {};
  let ziekeRegels = 0;
  for (const a0 of absLijst || []) {
    const a = rec1(a0, 'Absentee'), uid = String(a.user_id || '');
    if (!uid || !ctx.isUurloner(uid)) continue;
    if (a.deleted === true || String(a.deleted) === '1') continue;
    const status = String(a.status || ''), sl = status.toLowerCase();
    if (sl.indexOf('declin') > -1 || sl.indexOf('reject') > -1) continue;
    const type = typeMap[String(a.absentee_option_id || '')];
    if (!type || type.cat !== 'ziekte') continue;
    const aStart = parseIso(a.startdate); if (!aStart) continue;
    const loopt = !a.enddate || a.open_ended === true;
    const aEind = parseIso(a.enddate) || aStart;
    const eindEff = loopt ? eind : aEind;
    const oStart = aStart > start ? aStart : start, oEind = eindEff < eind ? eindEff : eind;
    if (oEind < oStart) continue;
    const dagenIn = dagenTussen(oStart, oEind) + 1, dagenTot = dagenTussen(aStart, eindEff) + 1;
    const hpd = Number(a.hours_per_day) || 0, tot = Number(a.hours) || 0;
    const uren = tot > 0 ? r2(tot * dagenIn / dagenTot) : r2(hpd * dagenIn);
    ziekeRegels++;
    const r = per[uid] || (per[uid] = { userId: uid, naam: ctx.byId[uid].naam, winkel: (ctx.medById[uid] && ctx.medById[uid].winkelNaam) || '-', bv: (ctx.medById[uid] && ctx.medById[uid].winkelBv) || '', periodes: [], uren: 0, dagen: 0, afwijkingen: [] });
    r.periodes.push({ start: ddmm(isoVan(oStart)), eind: loopt ? 'loopt nog' : ddmm(isoVan(oEind)), dagen: dagenIn, uren, deelDag: a.partial_day === true, status });
    r.uren = r2(r.uren + uren); r.dagen += dagenIn;
    const label = ddmm(isoVan(oStart)) + (dagenIn > 1 ? ' t/m ' + ddmm(isoVan(oEind)) : '');
    if (uren > 0) r.afwijkingen.push({ soort: 'uren', ernst: 'rood', tekst: 'Ziekte ' + label + ' staat op ' + String(uren).replace('.', ',') + ' uur — moet 0 uur zijn.' });
    if (a.partial_day !== true) {
      const gewerkt = []; for (let d = new Date(oStart); d <= oEind; d.setDate(d.getDate() + 1)) { const u = (perDag[uid] || {})[isoVan(d)]; if (u > 0) gewerkt.push(ddmm(isoVan(d)) + ' (' + String(u).replace('.', ',') + ' u)'); }
      if (gewerkt.length) r.afwijkingen.push({ soort: 'gewerkt', ernst: 'oranje', tekst: 'Wel uren geklokt op ziektedag(en): ' + gewerkt.join(', ') + ' — controleer of de ziekmelding of de uren klopt.' });
    }
    if (sl.indexOf('pend') > -1 || sl.indexOf('open') > -1) r.afwijkingen.push({ soort: 'open', ernst: 'oranje', tekst: 'Ziekmelding ' + label + ' is nog niet goedgekeurd in Shiftbase.' });
    if (loopt) r.afwijkingen.push({ soort: 'lopend', ernst: 'grijs', tekst: 'Ziekmelding van ' + ddmm(isoVan(aStart)) + ' loopt nog (geen hersteldatum).' });
  }
  const rang = { rood: 0, oranje: 1, grijs: 2 };
  const alle = Object.values(per).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  alle.forEach(r => { r.ernst = r.afwijkingen.length ? r.afwijkingen.slice().sort((x, y) => rang[x.ernst] - rang[y.ernst])[0].ernst : 'ok'; r.uren = r2(r.uren); });
  const metAfwijking = alle.filter(r => r.afwijkingen.length).sort((a, b) => rang[a.ernst] - rang[b.ernst] || a.naam.localeCompare(b.naam, 'nl'));
  return { medewerkers: alle, metAfwijking, totaal: { ziekeMedewerkers: alle.length, metAfwijking: metAfwijking.length, teCorrigeren: alle.filter(r => r.afwijkingen.some(x => x.ernst === 'rood' || x.ernst === 'oranje')).length, ziekmeldingen: ziekeRegels } };
}
function berekenUurloners(inv, p) {
  const ctx = bouwContext(inv.users, inv.med);
  const uren = verwerkUren(inv.timesheets, ctx, inv.teams, inv.depts, p);
  const ziekte = ziekteControle(inv.absentees, inv.typeMap || {}, ctx, uren.perDag, p);
  delete uren.perDag;
  return { periode: p, uren, ziekte };
}

// ---------- Uitdienst ----------
const isFlexTeam = t => !!t && (String(t.type || '').toLowerCase().includes('flex') || t.hidden === true || t.hidden === '1' || t.hidden === 1 || String(t.name || '').toLowerCase().includes('flex'));
function uitdienstLijst(users, med, ontslag, van, tot) {
  const ctx = bouwContext(users, med), uit = [];
  const uitgesloten = new Set((C.SB_UITGESLOTEN_NAMEN || []).map(normNaam));
  for (const rec of users || []) {
    const u = rec1(rec, 'User'), uid = String(u.id || ''), e = String(u.enddate || '').slice(0, 10);
    if (!uid || !/^\d{4}-\d{2}-\d{2}$/.test(e) || e === '0000-00-00' || e < van || e > tot) continue;
    const naam = naamVan(u); if (!naam || ctx.byId[uid].anon || uitgesloten.has(normNaam(naam))) continue;
    const teams = (rec.Team || []).filter(x => x && x.name), eigen = teams.filter(t => !isFlexTeam(t)), basis = eigen.length ? eigen : teams;
    let winkel = '', bv = '';
    for (const t of basis) { const code = (C.SB_DEPT_CODE || {})[String(t.department_id || '')]; if (eigen.length && code) { winkel = C.WINKEL_BV_MAP[code].naam; bv = C.WINKEL_BV_MAP[code].bv; break; } }
    if (!winkel && basis[0]) winkel = String(basis[0].name).replace(/^SLA\s*/i, '').trim();
    const m = ctx.medById[uid];
    uit.push({ id: uid, naam, email: ctx.byId[uid].email, einddatum: ddmm(e), einddatumIso: e, winkel: winkel || '-', bv: bv || (m && m.winkelBv) || '', soort: ctx.isVast(uid) ? 'vastloner' : 'uurloner', functie: (m && m.functie) || '', maand: MAANDEN[+e.slice(5, 7) - 1] + ' ' + e.slice(0, 4) });
  }
  uit.sort((a, b) => a.einddatumIso.localeCompare(b.einddatumIso) || a.naam.localeCompare(b.naam, 'nl'));
  // Tweede paar ogen: klopt Shiftbase met de ontslagdossiers?
  const controle = [], vanD = parseIso(van), totD = parseIso(tot);
  const matcht = (x, r) => (x.email && r.email && x.email === String(r.email).trim().toLowerCase()) || (x.naam && r.naam && normNaam(x.naam) === normNaam(r.naam));
  for (const r of ontslag || []) {
    const d = parseNLDatum(r.einddatum); if (!d || d < vanD || d > totD) continue;
    if (!uit.some(x => matcht(x, r))) controle.push({ ernst: 'oranje', tekst: 'Ontslagdossier ' + r.naam + ' heeft einddatum ' + r.einddatum + ', maar Shiftbase heeft geen einddatum in deze periode — zet de uitdienst ook in Shiftbase, anders mist Mahdia hem of haar.' });
  }
  for (const x of uit) if (!(ontslag || []).some(r => matcht(x, r))) controle.push({ ernst: 'grijs', tekst: x.naam + ' heeft in Shiftbase einddatum ' + x.einddatum + ' maar geen ontslagdossier (ontslagbevestiging/aanzegging) in het dashboard.' });
  return { uitdienst: uit, controle, venster: { van: ddmm(van), tot: ddmm(tot) } };
}

// ---------- Mail aan Mahdia (concept; HR controleert en verstuurt) ----------
const uurTekst = n => String(r2(n)).replace('.', ',');
function bouwMutatieMail(vl, ud, afzender) {
  const p = vl.periode, regels = [];
  const metMutatie = vl.regels.filter(r => r.heeftMutatie), zonder = vl.regels.length - metMutatie.length;
  regels.push('Hoi Mahdia,', '', 'Hierbij de mutaties voor de vastloners over ' + p.label + ' (' + p.start + ' t/m ' + p.eind + ') en de medewerkers die uit dienst gaan of zijn gegaan.', '');
  regels.push('MUTATIES VASTLONERS');
  if (!metMutatie.length) regels.push('Geen mutaties in ' + p.label + '.');
  for (const r of metMutatie) {
    regels.push(r.naam + (r.locatie && r.locatie !== '-' ? ' (' + r.locatie + ')' : ''));
    if (r.verlofDagen) regels.push('  - Vakantie: ' + r.verlofDagen + ' dag(en)' + (r.verlofUren ? ' / ' + uurTekst(r.verlofUren) + ' uur' : '') + ' — ' + r.verlofRegels.map(x => x.start + (x.eind !== x.start ? ' t/m ' + x.eind : '')).join(', '));
    if (r.ziekDagen) regels.push('  - Ziek: ' + r.ziekDagen + ' dag(en)' + (r.ziekUren ? ' / ' + uurTekst(r.ziekUren) + ' uur' : '') + ' — ' + r.ziekteperiodes.map(x => x.start + (x.eind !== x.start ? ' t/m ' + x.eind : '')).join(', '));
    r.overig.forEach(o => regels.push('  - ' + o.type + ': ' + o.start + (o.eind !== o.start ? ' t/m ' + o.eind : '') + ' (' + o.dagen + ' dag(en))' + (o.loon ? ' — ' + o.loon : '')));
  }
  if (zonder > 0 && metMutatie.length) regels.push('', 'Geen mutaties bij de overige ' + zonder + ' vastloner(s).');
  regels.push('', 'WACHTDAGEN (ZIEKTE)');
  const wacht = vl.regels.filter(r => r.wachtdagen.length);
  if (!wacht.length) regels.push('Geen wachtdagen in ' + p.label + '.');
  for (const r of wacht) regels.push('- ' + r.naam + ': ' + r.wachtdagen.map(w => w.datum + (w.uren ? ' (' + uurTekst(w.uren) + ' uur)' : '')).join(', '));
  regels.push('', 'UIT DIENST (einddatum ' + ud.venster.van + ' t/m ' + ud.venster.tot + ')');
  if (!ud.uitdienst.length) regels.push('Niemand uit dienst in deze periode.');
  for (const x of ud.uitdienst) regels.push('- ' + x.naam + ' (' + (x.bv ? x.bv + ', ' : '') + x.winkel + ', ' + x.soort + '): laatste dag ' + x.einddatum);
  regels.push('', 'Laat je het weten als je iets anders nodig hebt?', '', 'Groet,', afzender || 'HR');
  return { subject: 'Mutaties vastloners, wachtdagen en uitdienst — ' + p.label + ' (SLA)', text: regels.join('\n') };
}

// ---------- Excel (xlsx) zonder extra pakket: zip.js schrijft de onderdelen ----------
const xe = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const kolLetter = i => { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// bladen: [{ naam, kolommen: [{ kop, breedte, uren? }], rijen: [[...]] }]
function maakXlsx(bladen) {
  const Z = require('./zip');
  const ent = [];
  ent.push({ naam: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + bladen.map((b, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' });
  ent.push({ naam: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
  ent.push({ naam: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + bladen.map((b, i) => '<sheet name="' + xe(String(b.naam).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' });
  ent.push({ naam: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + bladen.map((b, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (bladen.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
  // stijlen: 0 standaard, 1 vet (kop), 2 getal met 2 decimalen
  ent.push({ naam: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
  bladen.forEach((b, i) => {
    const cel = (r, c, w, stijl) => {
      const ref = kolLetter(c) + r;
      if (typeof w === 'number' && isFinite(w)) return '<c r="' + ref + '"' + (stijl ? ' s="' + stijl + '"' : '') + '><v>' + w + '</v></c>';
      if (w == null || w === '') return '';
      return '<c r="' + ref + '" t="inlineStr"' + (stijl === 1 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xe(w) + '</t></is></c>';
    };
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + b.kolommen.map((k, j) => '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + (k.breedte || 16) + '" customWidth="1"/>').join('') + '</cols><sheetData>';
    x += '<row r="1">' + b.kolommen.map((k, j) => cel(1, j, k.kop, 1)).join('') + '</row>';
    b.rijen.forEach((rij, ri) => { x += '<row r="' + (ri + 2) + '">' + rij.map((w, j) => cel(ri + 2, j, w, b.kolommen[j] && b.kolommen[j].uren ? 2 : 0)).join('') + '</row>'; });
    ent.push({ naam: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x + '</sheetData></worksheet>' });
  });
  return Z.schrijf(ent);
}
function uurlonersBladen(res) {
  const u = res.uren.regels.map(r => [r.bv, r.winkel, r.naam, r.uren, r.openUren || '', r.einde ? ddmm(r.einde) : '']);
  u.push([], ['', '', 'TOTAAL', res.uren.totaal.uren, '', '']);
  const z = [];
  for (const m of res.ziekte.medewerkers) {
    const periodes = m.periodes.map(x => x.start + (x.eind !== x.start ? ' t/m ' + x.eind : '')).join('; ');
    z.push([m.naam, m.winkel, periodes, m.dagen, m.uren, m.afwijkingen.length ? m.afwijkingen.map(x => x.tekst).join(' ') : 'OK — 0 uur']);
  }
  return [
    { naam: 'Uren uurloners ' + res.periode.label, kolommen: [{ kop: 'BV', breedte: 22 }, { kop: 'Winkel', breedte: 20 }, { kop: 'Medewerker', breedte: 30 }, { kop: 'Uren', breedte: 10, uren: true }, { kop: 'Waarvan nog niet goedgekeurd', breedte: 16, uren: true }, { kop: 'Laatste dag (uit dienst)', breedte: 18 }], rijen: u },
    { naam: 'Ziektecontrole', kolommen: [{ kop: 'Medewerker', breedte: 30 }, { kop: 'Winkel', breedte: 20 }, { kop: 'Ziekteperiode(s)', breedte: 34 }, { kop: 'Dagen', breedte: 8 }, { kop: 'Uren op ziekte', breedte: 14, uren: true }, { kop: 'Controle', breedte: 80 }], rijen: z }
  ];
}

// ---------- Laders (Shiftbase) ----------
const _cache = {};
async function laadUurloners(jaar, maand, ververs) {
  const p = periode(jaar, maand), k = p.sleutel;
  if (!ververs && _cache[k] && _cache[k].t > Date.now()) return _cache[k].v;
  const SB = require('./shiftbase'), V = require('./vastloners');
  const terug = isoVan(new Date(p.jaar, p.maand - 1, 1 - C.VL_TERUGKIJK_DAGEN));
  const lijst = r => (r && r.data) || r || [];
  const [ts, users, teams, depts, abs, typeMap, med] = await Promise.all([
    SB.sbGet('timesheets?min_date=' + p.van + '&max_date=' + p.tot).then(lijst),
    SB.sbGet('users').then(lijst),
    SB.sbGet('teams').then(lijst).catch(e => { console.warn('loonronde teams:', e.message); return []; }),
    SB.sbGet('departments').then(lijst).catch(e => { console.warn('loonronde departments:', e.message); return []; }),
    SB.sbGet('absentees?min_date=' + terug + '&max_date=' + p.tot).then(lijst),
    V.verlofTypes(),
    SB.getMedewerkers(false)
  ]);
  const v = berekenUurloners({ timesheets: ts, users, teams, depts, absentees: abs, typeMap, med }, p);
  v.opgehaald = nuNL();
  _cache[k] = { t: Date.now() + 10 * 60000, v };
  return v;
}
async function laadMutaties(jaar, maand, afzender) {
  const SB = require('./shiftbase'), V = require('./vastloners'), p = periode(jaar, maand);
  const [vl, users, med] = await Promise.all([V.getVastlonerMaand(p.jaar, p.maand), SB.sbGet('users').then(r => (r && r.data) || r || []), SB.getMedewerkers(false)]);
  let ontslag = [], ontslagFout = '';
  try { ontslag = await require('./sheets').getOntslag(true); } catch (e) { ontslagFout = e.message; }
  // uitdienst: loonmaand + de maand erna (de maand waarin de 18e valt)
  const tot = isoVan(new Date(p.jaar, p.maand + 1, 0));
  const ud = uitdienstLijst(users, med, ontslag, p.van, tot);
  if (ontslagFout) ud.controle.unshift({ ernst: 'grijs', tekst: 'Ontslagdossiers konden niet worden gelezen (' + ontslagFout + '); alleen Shiftbase is gecontroleerd.' });
  const mail = bouwMutatieMail(vl, ud, afzender);
  const st = await leesStatus(p.jaar, p.maand);
  return { periode: vl.periode, vastloners: { aantal: vl.aantalVastloners, totalen: vl.totalen, waarschuwingen: vl.waarschuwingen, regels: vl.regels.filter(r => r.heeftMutatie).map(r => ({ naam: r.naam, locatie: r.locatie, verlofDagen: r.verlofDagen, ziekDagen: r.ziekDagen, wachtdagen: r.wachtdagen, overig: r.overig.length })) }, uitdienst: ud, mail, mailStatus: st.mail, aan: C.SALARIS_EMAIL, opgehaald: nuNL() };
}
async function status(jaar, maand) {
  const p = periode(jaar, maand), st = await leesStatus(p.jaar, p.maand);
  return { periode: p, stappen: stappenOverzicht(p.jaar, p.maand, st), mail: st.mail };
}

module.exports = { periode, standaardMaand, STAPPEN, werkdagOpOfVoor, deadlineVan, stappenOverzicht, openStappen, leesStatus, zetStap, zetMail, bouwContext, verwerkUren, ziekteControle, berekenUurloners, uitdienstLijst, bouwMutatieMail, maakXlsx, uurlonersBladen, laadUurloners, laadMutaties, status };
