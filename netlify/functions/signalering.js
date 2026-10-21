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
  'ontslag-herinneringen': { label: 'Ontslag-herinneringen', wanneer: 'dagelijks 09:15', wat: 'Herinnering aan medewerkers die 3+ dagen na de ontslagbevestiging/aanzegging nog niet hebben ondertekend; max. 1x per 3 dagen en max. 3 keer. Daarna (als het aan staat bij Ontslag & aanzegging): bevestiging uitdiensttreding aan de medewerker zonder handtekening + seintje salaris + archiveren. Na 30 dagen zonder handtekening wordt de rij in elk geval gearchiveerd (terug te zetten via Beheer → Archief; daarna niet opnieuw).' },
  'nieuwe-medewerkers': { label: 'Nieuwe medewerkers', wanneer: 'elke 4 uur (09:45–21:45)', wat: 'Shiftbase-medewerkers die recent gestart zijn (of gaan starten) zonder loonheffingsuitnodiging. Automatisch uitnodigen aan (tab Loonheffing): de medewerker krijgt de indiensttredings- en loonheffingsmail (NL + EN, deadline = startdatum) en HR een overzicht. Uit: één keer per dag een lijstje aan HR.' },
  'aanzegtermijnen': { label: 'Aanzegtermijnen', wanneer: 'dagelijks 09:50', wat: 'Mail aan HR: contracten die binnen 42 dagen aflopen zonder verstuurde aanzegging (art. 7:668 BW).' },
  'stille-afwezigen': { label: 'Stille afwezigen', wanneer: 'maandag 10:00', wat: 'Mail aan HR: actieve medewerkers zonder dienst in 28 dagen, zonder verlof en zonder toekomstige dienst.' },
  'weekend-beschikbaarheid': { label: 'Weekendbeschikbaarheid', wanneer: 'maandag 09:45', wat: 'Mail aan HR: medewerkers die 3 volledige weekenden geen dienst hadden maar wél doordeweeks werkten (huisregel 2 weekenddiensten), met brief-klare onderbouwing.' },
  'korting-herinneringen': { label: 'Loonheffingskorting-herinneringen', wanneer: 'dagelijks 09:55', wat: 'Herinnering aan medewerkers van wie het kortingsformulier na 3 dagen nog niet retour is (tab Korting K/L), max. 1 per 3 dagen.' },
  'vakantiepieken': { label: 'Afwezigheidspieken', wanneer: 'maandag 09:00', wat: 'Mail aan HR: winkels waar in de komende 4 weken ≥30% van de bezetting tegelijk weg is (vakantie + stille afwezigen, open aanvragen meegerekend).' },
  'bewaartermijnen': { label: 'AVG-bewaartermijnen', wanneer: '1e van de maand 08:00', wat: 'Mail aan Mischa: dossierregels voorbij hun bewaartermijn (2 jaar dossier, 5 jaar loonheffing). Verwijdert niets — beoordelen blijft mensenwerk.' },
  'data-hygiene': { label: 'Datakwaliteit Shiftbase', wanneer: '1e van de maand 09:00', wat: 'Mail aan HR: actieve medewerkers zonder adres of functie in Shiftbase, per winkel.' },
  'contractketen': { label: 'Contractketen & proeftijd', wanneer: 'dagelijks 10:00', wat: 'Mail aan HR: contracten die binnen 60 dagen aflopen terwijl de ketenregeling (3 contracten / 36 maanden, art. 7:668a BW) vol is of bijna vol; en proeftijden die binnen 10 dagen eindigen (art. 7:652 BW).' },
  'verzuim': { label: 'Verzuim & Poortwachter', wanneer: 'dagelijks 10:20', wat: 'Mail aan HR: lopende ziekteperiodes (Shiftbase) met een Poortwachter-mijlpaal binnen 7 dagen (week 6/8/42/52), en frequent verzuim (≥3 meldingen in 12 maanden).' },
  'jeugd': { label: 'Jeugd: ATW-rooster & jeugdloon', wanneer: 'maandag 10:15', wat: 'Mail aan HR: roosterdiensten van <18-jarigen die niet passen bij de Arbeidstijdenwet (eindtijd, uren per dienst/week), en verjaardagen t/m 20 jaar in de komende 21 dagen (minimumjeugdloon stijgt).' },
  'oproepaanbod': { label: 'Oproepaanbod na 12 maanden', wanneer: 'maandag 10:30', wat: 'Mail aan HR: oproepkrachten die binnen 30 dagen 12 maanden in dienst zijn zonder aanbod vaste arbeidsomvang (art. 7:628a lid 5 BW), met het gemiddelde aantal uren uit de roosters.' },
  'checkin': { label: 'Check-in 30/60 dagen', wanneer: 'dagelijks 10:40', wat: 'Mail aan nieuwe medewerkers op dag 30 en 60 met een korte check-in (NL/EN) + één herinnering na 5 dagen. Alleen als de check-in aan staat (Instroom → Check-in 30/60). Lage score = direct mail aan HR + taak.' },
  'verlengingen': { label: 'Contractverlengingen', wanneer: 'dagelijks 10:05', wat: 'Alle tijdelijke contracten die binnen 60 dagen aflopen: besluit nodig (uiterlijk 35 dagen vóór het einde), daarna controle of het nieuwe contract in Shiftbase staat of de aanzegging/ontslagbevestiging verstuurd is. Geen mail — taken op het Overzicht en het tabblad In dienst → Contractverlenging.' },
  'salaris': { label: 'Automatisch naar salaris', wanneer: 'maandag + donderdag 09:00', wat: 'Stuurt alles wat klaar is naar de salarisadministratie (' + require('./_lib/config').SALARIS_EMAIL + '), één mail per dossier met de documenten als bijlage — net als de knop "→ Salaris": loonheffing (verklaring geüpload), ondertekende ontslag/aanzegging, loonheffingskorting en overplaatsingen. Oude Drive-uploads blijven handmatig. HR krijgt een overzicht. Alleen als de schakelaar aan staat (tab Loonheffing).' },
  'mto': { label: 'Tevredenheidsonderzoek (MTO)', wanneer: 'dagelijks 10:20', wat: 'Tijdens een open ronde: restant uitnodigingen versturen, herinnering na 7 en 14 dagen aan wie nog niet invulde, ronde dicht na 21 dagen. In februari en september één mail aan HR om een nieuwe ronde te starten (als er nog geen loopt).' },
  'exit-survey': { label: 'Exit-survey na laatste werkdag', wanneer: 'dagelijks 10:50', wat: 'Mail aan medewerkers uit Ontslag & aanzegging (ook gearchiveerd) op de dag na hun laatste werkdag: persoonlijke link naar de exit-survey (NL/EN, taal van de ontslagbrief). Niet als ze al zijn uitgenodigd of al hebben ingevuld. Alleen als de exit-survey aan staat.' },
  'maandrapport': { label: 'HR-maandrapport', wanneer: '1e van de maand 08:30', wat: 'PDF-rapport over de vorige maand naar Mischa, Jodi en Ymke: SLA totaal (deze maand vs vorige maand vs 12 maanden), uitstroomredenen, wat HR deed en per winkel de aandachtspunten. Eén keer per maand; opnieuw mailen of een andere maand ophalen via Scorekaart → Maandrapport.' },
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
