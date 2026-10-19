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

async function laad(qs) {
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
    S.getLoonheffing(), S.getOntslag(), S.getSommatie(), S.getOverplaatsing(), S.getOnboarding(), S.getExtraTabs(), S.getBrieven().catch(() => []),
    S.getWaarschuwingen().catch(() => []), S.getBeschikbaarheid().catch(() => []), S.getKorting().catch(() => []), S.getNotities().catch(() => [])
  ]);

  const secties = [
    { key: 'loonheffing', label: 'Loonheffingsverklaring', rijen: loon.filter(match) },
    { key: 'korting', label: 'Loonheffingskorting', rijen: kort.filter(match) },
    { key: 'onboarding', label: 'Onboarding (historie)', rijen: onb.filter(match) },
    { key: 'overplaatsing', label: 'Overplaatsing / standplaats', rijen: opl.filter(match) },
    { key: 'sommatie', label: 'Sommaties', rijen: som.filter(match) },
    { key: 'ontslag', label: 'Ontslag & aanzegging', rijen: ontslag.filter(match) },
    { key: 'brief', label: 'Vrije brieven', rijen: brieven.filter(match) },
    { key: 'waarschuwing', label: 'Officiële waarschuwingen', rijen: wrs.filter(match) },
    { key: 'beschikbaarheid', label: 'Weekendbeschikbaarheid', rijen: bsk.filter(match) },
    { key: 'notitie', label: 'Notities', rijen: notities.filter(match) }
  ].concat(extra.map(t => ({ key: 'extra', label: t.label, rijen: t.rijen.filter(match), fout: t.fout })));

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
      const k = KT.bepaalKeten(per[String(persoon.id)] || [], new Date());
      if (k) keten = { onbepaald: k.onbepaald, aantal: k.aantal, maanden: k.maanden, vol: k.vol, reden: k.reden || '', contracten: (per[String(persoon.id)] || []).map(c => ({ start: c.start.split('-').reverse().join('-'), eind: c.eind ? c.eind.split('-').reverse().join('-') : '', type: c.type, functie: c.functie })) };
    } catch (e) { keten = null; }
  }

  return { persoon, naam, email, contract, verlof, verzuim, keten, secties, totaal: secties.reduce((n, s) => n + s.rijen.length, 0) };
}
exports.laad = laad;
exports.handler = beveiligd('dossier', async (event) => laad(event.queryStringParameters || {}));
