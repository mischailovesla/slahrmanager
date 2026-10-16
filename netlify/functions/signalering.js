// ============================================================
// Signaleringen handmatig draaien / bekijken (stap 4)
// GET  /api/signalering              -> status (actief?), checks, laatste runs uit hr_signaleringen
// POST /api/signalering {check, droog} -> check nu draaien; droog:true = alleen rapporteren
//      (zonder droog én met SIGNALERINGEN_ACTIEF=1 wordt er echt gemaild en geschreven)
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const SIG = require('./_lib/signaleringen');

const OMSCHRIJVING = {
  'sync-formulieren': { label: 'Formulierstatus syncen', wanneer: 'elke 4 uur', wat: 'Zet "Ja" bij Formulier ontvangen (loonheffing) / Ondertekend (ontslag) zodra het geüploade document is gevonden.' },
  'loonheffing-herinneringen': { label: 'Loonheffing-herinneringen', wanneer: 'dagelijks 09:00', wat: 'Herinnering (NL/EN) aan medewerkers van wie de deadline is verstreken en het formulier niet binnen is; max. 1x per 3 dagen.' },
  'ontslag-herinneringen': { label: 'Ontslag-herinneringen', wanneer: 'dagelijks 09:15', wat: 'Herinnering aan medewerkers die 3+ dagen na de ontslagbevestiging/aanzegging nog niet hebben ondertekend; max. 1x per 3 dagen.' },
  'nieuwe-medewerkers': { label: 'Nieuwe medewerkers', wanneer: 'dagelijks 09:45', wat: 'Mail aan HR: Shiftbase-medewerkers die recent gestart zijn zonder loonheffingsuitnodiging.' },
  'aanzegtermijnen': { label: 'Aanzegtermijnen', wanneer: 'dagelijks 09:50', wat: 'Mail aan HR: contracten die binnen 42 dagen aflopen zonder verstuurde aanzegging (art. 7:668 BW).' },
  'stille-afwezigen': { label: 'Stille afwezigen', wanneer: 'maandag 10:00', wat: 'Mail aan HR: actieve medewerkers zonder dienst in 28 dagen, zonder verlof en zonder toekomstige dienst.' }
};

exports.handler = beveiligd('signalering', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (!SIG.CHECKS[p.check]) throw new Error('Onbekende check: ' + p.check);
    const droog = p.droog !== false;
    const rap = await SIG.draai(p.check, droog, 'handmatig:' + g.email);
    await logActie({ door: g.email, actie: 'signalering', bron: p.check, veld: droog ? 'droogloop' : 'echt', naam: '', details: rap.gevonden.length + ' gevonden, ' + rap.verstuurd.length + ' verstuurd, ' + rap.fouten.length + ' fouten' });
    return { rapport: rap };
  }
  let laatste = [];
  try {
    const r = await admin().from('hr_signaleringen').select('check,bron,droog,gevonden,verstuurd,fouten,tijdstip').order('tijdstip', { ascending: false }).limit(60);
    laatste = r.data || [];
  } catch (e) { /* tabel ontbreekt nog */ }
  return { actief: SIG.actief(), checks: Object.keys(SIG.CHECKS).map(k => Object.assign({ key: k }, OMSCHRIJVING[k])), laatste };
});
