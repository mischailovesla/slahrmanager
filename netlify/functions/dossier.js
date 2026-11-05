// ============================================================
// Dossier-tab: alles over 1 medewerker, over alle log-tabs heen
// (tegenhanger van Dossier.gs). Match op e-mail (betrouwbaarst),
// anders op genormaliseerde naam.
// ?id=<shiftbase user id>  of  ?naam=...&email=...
// ============================================================
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const SB = require('./_lib/shiftbase');
const { AANZEG_VENSTER_DAGEN } = require('./_lib/config');
const { normNaam, parseNLDatum, dagenTot } = require('./_lib/util');

async function laad(qs, ingelogd) {   // ingelogd = e-mail van de HR-gebruiker (salarisinzage)
  let persoon = null;
  const med = await SB.getMedewerkers(false).catch(() => []);
  if (qs.id) persoon = med.find(m => m.id === String(qs.id)) || null;
  if (!persoon && qs.email) persoon = med.find(m => m.email.toLowerCase() === String(qs.email).toLowerCase()) || null;
  if (!persoon && qs.naam) persoon = med.find(m => normNaam(m.naam) === normNaam(qs.naam)) || null;
  const naam = (persoon && persoon.naam) || qs.naam || '';
  const email = ((persoon && persoon.email) || qs.email || '').toLowerCase();
  if (!naam && !email) throw new Error('Geef id, naam of e-mail op.');
  const nn = normNaam(naam);
  const match = r => (email && String(r.email || '').toLowerCase() === email) || (nn && normNaam(r.naam) === nn);

  const [loon, ontslag, som, opl, onb, extra, brieven, wrs, bsk, kort, notities] = await Promise.all([
    S.getLoonheffing(), S.getOntslag(true).then(l => l.map(r => r.gearchiveerd ? Object.assign({}, r, { status: (r.status || '') + ' · gearchiveerd ' + String(r.gearchiveerd.op || '').slice(0, 10) + (r.gearchiveerd.bron ? ' (' + r.gearchiveerd.bron + ')' : '') }) : r)), S.getSommatie(), S.getOverplaatsing(), S.getOnboarding(), S.getExtraTabs(), S.getBrieven().catch(() => []),
    S.getWaarschuwingen().catch(() => []), S.getBeschikbaarheid().catch(() => []), S.getKorting().catch(() => []), S.getNotities().catch(() => [])
  ]);

  const secties = [
    { key: 'loonheffing', label: 'Loonheffingsverklaring', rijen: loon.filter(match) },
    { key: 'korting', label: 'Loonheffingskorting', rijen: kort.filter(match) },
    { key: 'onboarding', label: 'Onboarding (historie)', rijen: onb.filter(match) },
    { key: 'overplaatsing', label: 'Overplaatsing / standplaats', rijen: opl.filter(match) },
    { key: 'sommatie', label: 'Sommaties', rijen: som.filter(match) },
    { key: 'ontslag', label: 'Ontslag & aanzegging', rijen: ontslag.filter(match) },
    { key: 'brief', label: 'Vrije brieven', rijen: (await require('./_lib/salarisinzage').schermVoor(ingelogd, brieven.filter(match))) },   // v0.42.0
    { key: 'waarschuwing', label: 'Officiële waarschuwingen', rijen: wrs.filter(match) },
    { key: 'beschikbaarheid', label: 'Weekendbeschikbaarheid', rijen: bsk.filter(match) },
    { key: 'notitie', label: 'Notities', rijen: notities.filter(match) }
  ].concat(extra.map(t => ({ key: 'extra', label: t.label, rijen: t.rijen.filter(match), fout: t.fout })));

  // v0.45.3: gearchiveerde dossiers (loonheffing, overplaatsing) ook in het medewerkersdossier tonen, met de archiefdatum in de status.
  // Voorheen verdween bijv. een verstuurde overplaatsingsbrief uit het dossier zodra de rij in de tab Overplaatsing was gearchiveerd.
  try {
    const U = require('./_lib/uploads'), v = (r, i) => String(((r.velden || [])[i]) == null ? '' : r.velden[i]).trim();
    const arch = r => ' · gearchiveerd ' + String(r.gearchiveerd || '').slice(0, 10) + (r.door ? ' (' + String(r.door).split('@')[0] + ')' : '');
    const doc = (dl, naam, em, key) => { const e = String(em || '').toLowerCase(); const d = (e && dl.byEmail[e]) || dl.byNaam[normNaam(naam)] || {}; return d[key] || ''; };
    const [aOv, aLh, dOv, dLh] = await Promise.all([S.getArchief('overplaatsing').catch(() => ({ rijen: [] })), S.getArchief('loonheffing').catch(() => ({ rijen: [] })), U.vindUploads('overplaatsing').catch(() => ({ byNaam: {}, byEmail: {} })), U.vindUploads('loon').catch(() => ({ byNaam: {}, byEmail: {} }))]);
    const ov = (aOv.rijen || []).map(r => ({ rij: 'archief ' + r.rij, gearchiveerd: true, naam: v(r, 0), email: v(r, 1), adres: v(r, 2), huidigeBV: v(r, 3), nieuweBV: v(r, 4), datumIndienst: v(r, 5), ingangsdatum: v(r, 6), functie: v(r, 7), standplaats: v(r, 8), taal: v(r, 9) || 'NL', status: v(r, 10) + arch(r), verzenddatum: v(r, 11), ondertekend: /^ja$/i.test(v(r, 12)) ? 'Ja' : 'Nee', herinnering: v(r, 13), aantalHer: parseInt(v(r, 14), 10) || 0, type: v(r, 15), briefUrl: v(r, 16), docUrl: doc(dOv, v(r, 0), v(r, 1), 'overplaatsing') })).filter(match);
    const lh = (aLh.rijen || []).map(r => ({ rij: 'archief ' + r.rij, gearchiveerd: true, naam: v(r, 0), email: v(r, 1), deadline: v(r, 2), status: v(r, 3) + arch(r), verzenddatum: v(r, 4), ontvangen: /^ja$/i.test(v(r, 5)) ? 'Ja' : 'Nee', taal: v(r, 6) || 'NL', herinnering: v(r, 7), aantalHer: parseInt(v(r, 8), 10) || 0, mahdia: /^ja$/i.test(v(r, 9)) ? 'Ja' : 'Nee', salaris: v(r, 10), docUrl: doc(dLh, v(r, 0), v(r, 1), 'loon'), docUrl2: doc(dLh, v(r, 0), v(r, 1), 'indienst') })).filter(match);
    const sec = k => secties.find(x => x.key === k);
    if (ov.length) sec('overplaatsing').rijen = sec('overplaatsing').rijen.concat(ov);
    if (lh.length) sec('loonheffing').rijen = sec('loonheffing').rijen.concat(lh);
  } catch (e) { console.warn('dossier archief:', e.message); }

  // Contractstatus + aanzeg-alert (42 dagen) uit Shiftbase
  let contract = null;
  if (persoon) {
    const einde = parseNLDatum(persoon.contractEinde);
    const dagen = dagenTot(einde);
    contract = {
      indienst: persoon.indienst, einde: persoon.contractEinde || '', type: persoon.contractType || '', functie: persoon.functie || '',
      dagenTotEinde: dagen,
      aanzegAlert: dagen !== null && dagen >= 0 && dagen <= AANZEG_VENSTER_DAGEN,
      aanzeggingVerstuurd: ontslag.some(r => match(r) && r.type === 'aanzegging')
    };
  }
  let verlof = [], verzuim = null, keten = null;
  if (persoon) {
    try { verlof = await SB.getVerlof(persoon.id); } catch (e) { verlof = []; }
    // Fase 2: verzuim (ziekteperiodes 2 jaar, Poortwachter) en contractketen uit Shiftbase
    try {
      const VZ = require('./_lib/verzuim'); const C = require('./_lib/config');
      const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
      const iso = d => d.toLocaleDateString('sv-SE');
      const abs = await SB.sbGet('absentees?min_date=' + iso(new Date(vandaag.getTime() - C.VERZUIM_TERUGKIJK_DAGEN * 864e5)) + '&max_date=' + iso(new Date(vandaag.getTime() + 60 * 864e5))).then(r => (r && r.data) || r || []);
      const mijn = abs.filter(a0 => String(((a0 && a0.Absentee) || a0 || {}).user_id || '') === String(persoon.id));
      const per = VZ.ziekteperiodes(mijn, vandaag)[String(persoon.id)] || [];
      const recent = per.filter(p => new Date(p.start) >= new Date(vandaag.getTime() - 365 * 864e5));
      verzuim = { periodes: VZ.dossierVerzuim(per), meldingen12mnd: recent.reduce((n, p) => n + p.meldingen, 0), dagen12mnd: recent.reduce((n, p) => n + p.dagen, 0), frequent: recent.reduce((n, p) => n + p.meldingen, 0) >= C.VERZUIM_FREQUENT_AANTAL };
    } catch (e) { verzuim = { fout: e.message }; }
    try {
      const KT = require('./_lib/contracten'); const per = await SB.getContractenPerUser(false);
      const corr = ((await require('./_lib/instellingen').lees('keten_correcties', {})) || {})[String(persoon.id)] || null;
      const k = KT.bepaalKeten(per[String(persoon.id)] || [], new Date(), corr, persoon.verjaardag);
      const nl = d => d ? d.split('-').reverse().join('-') : '';
      if (k) keten = { mid: String(persoon.id), onbepaald: k.onbepaald, aantal: k.aantal, maanden: k.maanden, vol: k.vol, reden: k.reden || '', gecorrigeerd: !!k.gecorrigeerd, correctie: k.gecorrigeerd ? corr : null, huidigStart: k.huidig ? k.huidig.start : '', telling: (k.keten || []).length,
        overeenkomsten: k.overeenkomsten.map(o => ({ start: nl(o.start), eind: nl(o.eind), type: o.type, functie: o.functie, inKeten: (k.keten || []).includes(o), huidig: o === k.huidig, knips: o.delen.length - 1, delen: o.delen.map(d => nl(d.start) + (d.eind ? ' – ' + nl(d.eind) : ' – heden')) })),
        contracten: (per[String(persoon.id)] || []).map(c => ({ start: nl(c.start), eind: nl(c.eind), type: c.type, functie: c.functie })) };
      // Fase 4c: besluiten over verlenging
      if (keten) { try { const VL = require('./_lib/verlenging'); const { data } = await require('./_lib/auth').admin().from('hr_verlenging').select('*').eq('medewerker_id', String(persoon.id)).order('contract_eind', { ascending: false }).limit(10); keten.besluiten = (data || []).map(b => ({ eind: nl(b.contract_eind), label: VL.BESLUITEN[b.besluit] || b.besluit, nieuweEind: nl(b.nieuwe_eind), advies: VL.ADVIES[b.advies_sm || ''] || '', adviesOpmerking: b.advies_opmerking || '', notitie: b.notitie || '', door: b.besloten_door || '', op: String(b.besloten_op || '').slice(0, 10).split('-').reverse().join('-') })); } catch (e) { keten.besluiten = []; } }
    } catch (e) { keten = null; }
  }
  // Fase 3a: check-ins (dag 30/60) — op medewerker-id, anders op naam
  let checkins = [];
  try {
    const { admin } = require('./_lib/auth'); const { normNaam } = require('./_lib/util');
    const { data } = await admin().from('hr_checkin').select('id,medewerker_id,naam,moment,verstuurd_op,ingevuld_op,score,laag,laag_reden,opmerking,opgevolgd_op,opgevolgd_door,opvolg_notitie').order('verstuurd_op', { ascending: true }).limit(2000);
    const nn = normNaam(naam || (persoon && persoon.naam) || '');
    const fmt = x => x ? new Date(x).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    checkins = (data || []).filter(r => (persoon && r.medewerker_id && String(r.medewerker_id) === String(persoon.id)) || (nn && normNaam(r.naam) === nn))
      .map(r => ({ id: r.id, moment: r.moment, verstuurd: fmt(r.verstuurd_op), ingevuld: fmt(r.ingevuld_op), score: r.score == null ? null : Number(r.score), laag: !!r.laag, reden: r.laag_reden, opmerking: r.opmerking, opgevolgd: fmt(r.opgevolgd_op), opgevolgdDoor: r.opgevolgd_door, notitie: r.opvolg_notitie }));
  } catch (e) { checkins = []; }

  // Fase 3b: gesprekken
  let gesprekken = [];
  try { gesprekken = await require('./_lib/gesprekken').voorPersoon({ mid: persoon && persoon.id, naam: naam || (persoon && persoon.naam) }); } catch (e) { gesprekken = []; }

  // Fase 4a: Academy (training, certificaten, aftekenen)
  let academy = null, academyFout = '';
  try { academy = await require('./_lib/academy').voorPersoon({ mid: persoon && persoon.id, email: email || (persoon && persoon.email), naam: naam || (persoon && persoon.naam) }); } catch (e) { academyFout = e.message; }
  // v0.35.0: gegevens uit het digitale indiensttredingsformulier (zonder BSN/IBAN)
  let indienstFormulier = null;
  try { indienstFormulier = await require('./_lib/indienst').gegevensVan(naam || (persoon && persoon.naam), email); } catch (e) { indienstFormulier = null; }
  return { persoon, naam, email, contract, verlof, verzuim, keten, checkins, gesprekken, academy, academyFout, indienstFormulier, secties, totaal: secties.reduce((n, s) => n + s.rijen.length, 0) };
}
exports.laad = laad;
exports.handler = beveiligd('dossier', async (event, g) => laad(event.queryStringParameters || {}, g.email));
