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

exports.handler = beveiligd('dossier', async (event) => {
  const qs = event.queryStringParameters || {};
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

  const [loon, ontslag, som, opl, onb, extra, brieven, wrs, bsk, kort] = await Promise.all([
    S.getLoonheffing(), S.getOntslag(), S.getSommatie(), S.getOverplaatsing(), S.getOnboarding(), S.getExtraTabs(), S.getBrieven().catch(() => []),
    S.getWaarschuwingen().catch(() => []), S.getBeschikbaarheid().catch(() => []), S.getKorting().catch(() => [])
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
    { key: 'beschikbaarheid', label: 'Weekendbeschikbaarheid', rijen: bsk.filter(match) }
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
  let verlof = [];
  if (persoon) { try { verlof = await SB.getVerlof(persoon.id); } catch (e) { verlof = []; } }

  return { persoon, naam, email, contract, verlof, secties, totaal: secties.reduce((n, s) => n + s.rijen.length, 0) };
});
