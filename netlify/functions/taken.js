// ============================================================
// /api/taken — fase 1: de takenlijst op het Overzicht ("Vandaag te doen").
// Eén lijst van concrete acties, afgeleid uit:
//   1. de laatste run van elke automatische check (hr_signaleringen.details.gevonden) — gratis;
//      ?live=1 draait de dagelijkse checks opnieuw in droogloop voor een verse stand (Shiftbase-calls);
//   2. open dossiers in de database (sommaties niet verwerkt, overplaatsing niet ondertekend);
//   3. open on-/offboarding-checklists (hr_checklists).
// Items die niet vanzelf verdwijnen (stille afwezigen, bewaartermijnen, datakwaliteit, pieken) kunnen
// als 'afgehandeld' worden gemarkeerd (POST {sleutel, dagen}); ze blijven dan `dagen` verborgen.
// Urgentie: rood = wettelijke/financiële deadline (nu), oranje = deze week, grijs = ter info.
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const { parseNLDatum, dagenTot } = require('./_lib/util');

const LIVE_CHECKS = ['nieuwe-medewerkers', 'aanzegtermijnen', 'loonheffing-herinneringen', 'ontslag-herinneringen', 'korting-herinneringen', 'contractketen', 'verzuim', 'verlengingen'];
const ALLE_CHECKS = LIVE_CHECKS.concat(['mail-bounces', 'stille-afwezigen', 'weekend-beschikbaarheid', 'vakantiepieken', 'bewaartermijnen', 'data-hygiene', 'jeugd', 'oproepaanbod']);

function stempelNL(iso) { try { return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

// Laatste run per check uit hr_signaleringen
async function laatsteRuns() {
  const { data, error } = await admin().from('hr_signaleringen').select('check,tijdstip,droog,details').order('tijdstip', { ascending: false }).limit(300);
  if (error) throw new Error('hr_signaleringen: ' + error.message);
  const uit = {};
  for (const r of data || []) if (!uit[r.check]) uit[r.check] = { tijd: r.tijdstip, gevonden: (r.details && r.details.gevonden) || [] };
  return uit;
}

// Vertaling van check-bevindingen naar taken
function uitCheck(naam, items, tijd) {
  const t = [];
  const bron = { bron: naam, stand: stempelNL(tijd) };
  for (const g of items || []) {
    if (naam === 'nieuwe-medewerkers') t.push(Object.assign({}, bron, { urgentie: 'rood', sleutel: naam + '|' + g.naam, titel: 'Loonheffingsuitnodiging versturen', sub: g.naam + ' · ' + (g.winkel || '-') + ' · start ' + (g.start || '?') + ' — zonder verklaring geldt het anoniementarief (52%)', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'loonmail', persoon: { naam: g.naam, email: g.email || '' }, label: 'Uitnodiging' }, extra: { soort: 'onboarding', label: 'Onboarding starten' } }));
    else if (naam === 'aanzegtermijnen') {
      const laat = g.dagenTotDeadline < 0, snel = g.dagenTotDeadline <= 7, totEinde = Math.min(Math.max((g.dagenTotEinde || 0) + 1, 1), 90);
      t.push(Object.assign({}, bron, { urgentie: laat || snel ? 'rood' : 'oranje', sleutel: naam + '|' + g.naam, titel: laat ? 'Aanzegging TE LAAT (' + (-g.dagenTotDeadline) + ' dagen) — vergoeding loopt op' : 'Aanzegging versturen' + (g.dagenTotDeadline === 0 ? ' (deadline vandaag)' : ' (deadline over ' + g.dagenTotDeadline + ' dagen)'), sub: g.naam + ' · ' + (g.winkel || '-') + ' · contract eindigt ' + g.einddatum + ' (art. 7:668 BW)', naam: g.naam, email: g.email || '', winkel: g.winkel || '',
        actie: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', einddatum: g.einddatum, type: 'aanzegging' }, label: 'Aanzegging' },
        // Medewerker wil zelf niet verlengen / zegt op: dan geen aanzegging maar een bevestiging van de opzegging (ontslagbevestiging + PDF).
        // Zodra die verstuurd is, valt de melding vanzelf weg (de check kijkt naar een verzonden ontslag/aanzegging-rij).
        extra: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', einddatum: g.einddatum, type: 'ontslag', zelfOpgezegd: true }, label: 'Zegt zelf op' },
        afhandelbaar: true, afhandelOpties: [
          { label: 'Contract verlengd (ook in Shiftbase zetten)', dagen: totEinde, opmerking: 'contract verlengd' },
          { label: 'Mondeling/anders geregeld', dagen: totEinde, opmerking: 'anders geregeld' }
        ] }));
    }
    else if (naam === 'loonheffing-herinneringen') { const d = parseNLDatum(g.deadline), over = d ? -dagenTot(d) : 0; t.push(Object.assign({}, bron, { urgentie: (g.eerder || 0) >= 3 || over > 14 ? 'rood' : 'oranje', sleutel: naam + '|' + g.naam, titel: (g.eerder || 0) >= 3 ? 'Loonheffingsverklaring: na 3 herinneringen nog niets — zelf contact opnemen' : 'Loonheffingsverklaring niet ontvangen', sub: g.naam + ' · deadline ' + (g.deadline || '?') + (over > 0 ? ' (' + over + ' dagen verstreken)' : '') + ' · ' + (g.eerder || 0) + ' herinnering(en), automatisch max. 1 per 3 dagen', naam: g.naam, email: g.email || '', actie: { soort: 'loonmail', persoon: { naam: g.naam, email: g.email || '', rij: g.rij, deadline: g.deadline }, label: 'Herinnering' }, extra: { soort: 'dossier', label: 'Dossier' } })); }
    else if (naam === 'ontslag-herinneringen') t.push(Object.assign({}, bron, { urgentie: (g.eerder || 0) >= 3 ? 'rood' : 'oranje', sleutel: naam + '|' + g.naam, titel: (g.type === 'aanzegging' ? 'Aanzegging' : 'Ontslagbevestiging') + ' nog niet ondertekend retour', sub: g.naam + ' · verstuurd ' + (g.verzonden || '?') + ' · ' + (g.eerder || 0) + ' herinnering(en)' + (g.gestopt ? ' · herinneringen gestopt — bevestig de uitdiensttreding (Ontslag & aanzegging → ✓ Bevestig uitdiensttreding; tekenen is niet nodig) of upload het document zelf' : ''), naam: g.naam, email: g.email || '', actie: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', rij: g.rij }, label: 'Herinnering' }, extra: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'korting-herinneringen') t.push(Object.assign({}, bron, { urgentie: 'oranje', sleutel: naam + '|' + g.naam, titel: 'Loonheffingskorting-formulier niet retour (' + (g.keuze || '?') + ')', sub: g.naam + ' · verstuurd ' + (g.verzonden || '?') + ' · ' + (g.eerder || 0) + ' herinnering(en)' + (g.gestopt ? ' · automatische herinneringen gestopt — bel even, of upload het document zelf (⋯ → ⬆ Zelf uploaden)' : ''), naam: g.naam, email: g.email || '', actie: { soort: 'korting', persoon: { naam: g.naam, email: g.email || '', rij: g.rij }, label: 'Herinnering' } }));
    // v0.27.4: mail niet aangekomen (Resend bounce/spam) — blijft staan tot HR hem afhandelt
    else if (naam === 'mail-bounces') t.push(Object.assign({}, bron, { urgentie: g.bron === 'ontslag' || g.bron === 'loonheffing' || g.bron === 'salaris' ? 'rood' : 'oranje', afhandelbaar: true,
      afhandelOpties: [{ label: 'Opnieuw verstuurd naar het juiste adres', dagen: 30, opmerking: 'opnieuw verstuurd' }, { label: 'Anders geregeld (geprint / persoonlijk)', dagen: 30, opmerking: 'anders geregeld' }],
      sleutel: naam + '|' + g.id, titel: 'Mail niet aangekomen: ' + (g.soort || g.bron), sub: g.naam + ' · ' + (g.email || '-') + ' · verstuurd ' + (g.verstuurd || '?') + (g.status === 'klacht' ? ' · als spam gemarkeerd' : ' · adres bestaat niet of weigert') + ' — controleer het e-mailadres en verstuur opnieuw', naam: g.naam, email: g.email || '', winkel: g.winkel || '' }));
    else if (naam === 'stille-afwezigen') t.push(Object.assign({}, bron, { urgentie: 'oranje', afhandelbaar: true, sleutel: naam + '|' + g.naam, titel: 'Stille afwezige: check bij de store manager', sub: g.naam + ' · ' + (g.winkel || '-') + ' · ' + (g.laatsteDienst ? 'laatste dienst ' + g.laatsteDienst + ' (' + g.dagen + ' dagen)' : 'geen dienst in ' + C.STIL_LOOKBACK_DAGEN + ' dagen'), naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' }, extra: { soort: 'sommatie', persoon: { naam: g.naam, email: g.email || '' }, label: 'Oproepbrief' } }));
    else if (naam === 'weekend-beschikbaarheid') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + g.naam, titel: 'Weekendbeschikbaarheid: gesprek + brief (huisregel 2)', sub: g.naam + ' · ' + (g.winkel || '-') + (g.doordeweeks != null ? ' · ' + g.doordeweeks + ' doordeweekse diensten, laatste weekenddienst ' + (g.laatsteWeekendDienst || 'onbekend') : ''), naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'beschikbaarheid', persoon: { naam: g.naam, email: g.email || '', winkel: g.winkel || '' }, label: 'Brief' } }));
    else if (naam === 'vakantiepieken') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + (g.winkel || '') + '|' + (g.week || ''), titel: 'Afwezigheidspiek: ' + (g.winkel || '?') + (g.week ? ' ' + g.week : ''), sub: (g.bezetting ? Math.round(((g.app || 0) + (g.pend || 0) + (g.stil || 0)) / g.bezetting * 100) + '% van ' + g.bezetting + ' tegelijk weg' : '') + (g.namen && g.namen.length ? ' · ' + g.namen.slice(0, 5).join(', ') : ''), winkel: g.winkel || '', actie: { soort: 'tab', tab: 'vakantie', label: 'Planner' } }));
    else if (naam === 'bewaartermijnen') { items = (items || []).filter(x => x.ref); if (items.length && !t.some(x => x.bron === 'bewaartermijnen')) { const n = items.length, ng = items.filter(x => !x.gekoppeld).length; t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + n, titel: 'AVG: ' + n + ' oud-medewerker(s) voorbij de bewaartermijn', sub: items.reduce((a, x) => a + (x.aantal || 0), 0) + ' regels' + (ng ? ' · ' + ng + ' niet in Shiftbase gevonden' : '') + ' · beoordelen en verwijderen (beheerder)', actie: { soort: 'tab', tab: 'bewaartermijn', label: 'Bewaartermijnen' } })); } }
    else if (naam === 'verlengingen') {
      // Fase 4c: één taak per aflopend contract (vervangt de losse aanzeg- en ketentaken voor dezelfde persoon)
      const persoon = { naam: g.naam, email: g.email || '', winkel: g.winkel || '', mid: g.mid, startIso: g.startIso, eindIso: g.eindIso, einddatum: g.einddatum, dagenTotEinde: g.dagenTotEinde, deadline: g.deadline, wettelijkeDeadline: g.wettelijkeDeadline, aanzegplichtig: g.aanzegplichtig, duurMnd: g.duurMnd, keten: g.keten, besluit: g.besluit, smAdvies: g.smAdvies || null };
      const ketenTekst = (g.keten ? g.keten.aantal + ' contract' + (g.keten.aantal === 1 ? '' : 'en') + ', ' + g.keten.maanden + ' mnd' + (g.keten.vol ? ' · keten vol' : g.keten.laatste ? ' · volgende = laatste tijdelijke' : '') : '');
      const bes = g.besluit ? ' · besluit: ' + g.besluit.label + (g.besluit.nieuweEind ? ' t/m ' + g.besluit.nieuweEind.split('-').reverse().join('-') : '') + (g.besluit.advies ? ' (SM: ' + g.besluit.adviesLabel.toLowerCase() + ')' : '') : (g.smAdvies ? ' · advies SM: ' + g.smAdvies.label.toLowerCase() + (g.smAdvies.opmerking ? ' ("' + g.smAdvies.opmerking.slice(0, 80) + '")' : '') : '') + (g.aanzegplichtig ? '' : ' · korter dan 6 mnd: geen aanzegplicht');
      const sub = g.naam + ' · ' + (g.winkel || '-') + ' · contract eindigt ' + g.einddatum + ' (over ' + g.dagenTotEinde + ' dagen) · ' + ketenTekst + bes + (g.uitleg ? ' — ' + g.uitleg : '');
      const besluitKnop = { soort: 'verlenging', persoon, label: g.besluit ? 'Besluit wijzigen' : 'Besluit vastleggen' };
      const t0 = Object.assign({}, bron, { urgentie: g.urgentie, sleutel: naam + '|' + g.status + '|' + g.mid + '|' + g.eindIso, titel: g.titel, sub, naam: g.naam, email: g.email || '', winkel: g.winkel || '', verlenging: true });
      if (g.status === 'besluit-nodig') t.push(Object.assign(t0, { actie: besluitKnop, extra: { soort: 'dossier', label: 'Dossier' } }));
      else if (g.status === 'wacht-aanzegging') t.push(Object.assign(t0, { actie: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', einddatum: g.einddatum, type: 'aanzegging' }, label: 'Aanzegging' }, extra: besluitKnop }));
      else if (g.status === 'wacht-bevestiging') t.push(Object.assign(t0, { actie: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', einddatum: g.einddatum, type: 'ontslag', zelfOpgezegd: true }, label: 'Ontslagbevestiging' }, extra: besluitKnop }));
      else t.push(Object.assign(t0, { actie: besluitKnop, extra: { soort: 'dossier', label: 'Dossier' }, afhandelbaar: true, afhandelOpties: [{ label: g.status === 'wacht-shiftbase' ? 'Staat in Shiftbase / anders geregeld' : 'Opgelost / klopt toch', dagen: Math.min(Math.max((g.dagenTotEinde || 0) + 1, 1), 90), opmerking: g.status }] }));
    }
    else if (naam === 'contractketen' && g.soort === 'vast') t.push(Object.assign({}, bron, { urgentie: 'rood', afhandelbaar: true, afhandelOpties: [{ label: 'Opgelost: contract is onbepaalde tijd', dagen: 90, opmerking: 'vast' }, { label: 'Telling klopt niet (aantal gecorrigeerd)', dagen: 30, opmerking: 'telling' }], sleutel: naam + '|vast|' + g.naam, titel: 'Ketenregeling: tijdelijk verlengd terwijl de keten vol is — van rechtswege vast?', sub: g.naam + ' · ' + (g.winkel || '-') + ' · verlengd t/m ' + g.verlengdTot + ' · ' + g.aantal + ' contracten (' + (g.contracten || '') + '), ' + g.maanden + ' mnd', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'contractketen' && g.soort === 'keten') t.push(Object.assign({}, bron, { urgentie: g.vol ? 'rood' : 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Vast contract gegeven (in Shiftbase gezet)', dagen: 90, opmerking: 'vast contract' }, { label: 'Besloten: niet verlengen → aanzegging volgt', dagen: Math.min((g.dagenTotEinde || 0) + 1, 90), opmerking: 'niet verlengen' }], sleutel: naam + '|keten|' + g.naam, titel: g.vol ? 'Ketenregeling: verlengen kan alleen nog als vast contract' : 'Ketenregeling: volgende contract is het laatste tijdelijke', sub: g.naam + ' · ' + (g.winkel || '-') + ' · contract eindigt ' + g.einddatum + ' (over ' + g.dagenTotEinde + ' dagen) · ' + g.aantal + ' contract' + (g.aantal === 1 ? '' : 'en') + (g.contracten ? ' (vanaf ' + g.contracten + ')' : '') + (g.gecorrigeerd ? ' [aantal door HR]' : '') + ', ' + g.maanden + ' mnd', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' }, extra: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', einddatum: g.einddatum, type: 'aanzegging' }, label: 'Aanzegging' } }));
    else if (naam === 'contractketen' && g.soort === 'proeftijd') t.push(Object.assign({}, bron, { urgentie: g.dagenTotEinde <= 3 ? 'rood' : 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Proeftijdgesprek gevoerd — blijft', dagen: 30, opmerking: 'proeftijd ok' }], sleutel: naam + '|proeftijd|' + g.naam, titel: 'Proeftijd eindigt ' + (g.dagenTotEinde > 0 ? 'over ' + g.dagenTotEinde + ' dagen' : g.dagenTotEinde === 0 ? 'vandaag' : '(verstreken)') + ' — gesprek + beslissing', sub: g.naam + ' · ' + (g.winkel || '-') + ' · in dienst ' + g.start + ' · proeftijd t/m ' + g.proeftijdEinde + ' (indien overeengekomen)', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'gesprek', gs: 'proeftijd', label: 'Gesprek vastleggen' }, extra: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', type: 'ontslag' }, label: 'Proeftijdontslag' } }));
    else if (naam === 'verzuim' && g.soort === 'mijlpaal') t.push(Object.assign({}, bron, { urgentie: g.teLaat || g.over <= 2 ? 'rood' : 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Gedaan en vastgelegd', dagen: 14, opmerking: g.mijlpaal }], sleutel: naam + '|' + g.mijlpaalDag + '|' + g.naam, titel: 'Poortwachter: ' + g.mijlpaal + (g.teLaat ? ' — ' + (-g.over) + ' dagen geleden' : g.over === 0 ? ' — vandaag' : ' — over ' + g.over + ' dagen'), sub: g.naam + ' · ' + (g.winkel || '-') + ' · ziek sinds ' + g.sinds + ' (dag ' + g.dag + ')', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'gesprek', gs: 'verzuim', label: 'Gesprek vastleggen' } }));
    else if (naam === 'verzuim' && g.soort === 'frequent') t.push(Object.assign({}, bron, { urgentie: 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Verzuimgesprek gevoerd', dagen: 60, opmerking: 'verzuimgesprek' }], sleutel: naam + '|frequent|' + g.naam, titel: 'Frequent verzuim: ' + g.meldingen + ' ziekmeldingen in 12 maanden — gesprek plannen', sub: g.naam + ' · ' + (g.winkel || '-') + ' · laatste melding ' + g.laatste, naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'gesprek', gs: 'verzuim', label: 'Gesprek vastleggen' } }));
    else if (naam === 'verzuim' && g.soort === 'lopend') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|lopend|' + g.naam, titel: 'Lopend verzuim (dag ' + g.dag + ') — contact houden', sub: g.naam + ' · ' + (g.winkel || '-') + ' · ziek sinds ' + g.sinds, naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'jeugd' && g.soort === 'atw') t.push(Object.assign({}, bron, { urgentie: 'rood', afhandelbaar: true, afhandelOpties: [{ label: 'Rooster aangepast', dagen: 7, opmerking: 'rooster aangepast' }], sleutel: naam + '|atw|' + g.naam + '|' + g.datum, titel: 'Arbeidstijdenwet: rooster aanpassen (' + g.leeftijd + ' jaar)', sub: g.naam + ' · ' + (g.winkel || '-') + ' · ' + g.datum + (g.dienst ? ' ' + g.dienst : '') + ' · ' + g.wat, naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'link', url: 'https://app.shiftbase.com', label: 'Shiftbase' } }));
    else if (naam === 'jeugd' && g.soort === 'verjaardag') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, afhandelOpties: [{ label: 'Doorgegeven aan salaris', dagen: 30, opmerking: 'jeugdloon doorgegeven' }], sleutel: naam + '|verjaardag|' + g.naam + '|' + g.op, titel: 'Minimumjeugdloon: wordt ' + g.wordt + ' op ' + g.op + ' — doorgeven aan salaris', sub: g.naam + ' · ' + (g.winkel || '-'), naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'oproepaanbod') t.push(Object.assign({}, bron, { urgentie: g.teLaat || g.over <= 7 ? 'rood' : 'oranje', sleutel: naam + '|' + g.naam, titel: 'Aanbod vaste arbeidsomvang versturen' + (g.teLaat ? ' — ' + (-g.over) + ' dagen over de 12-maandsgrens' : ' (grens over ' + g.over + ' dagen)'), sub: g.naam + ' · ' + (g.winkel || '-') + ' · oproep sinds ' + g.sinds + ' · gemiddeld ' + g.gemPerWeek + ' u/week', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'oproep', persoon: g, label: 'Aanbod' }, extra: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'data-hygiene') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + g.naam, titel: 'Shiftbase aanvullen: ' + (g.mist || 'gegevens') + ' ontbreekt', sub: g.naam + ' · ' + (g.winkel || '-'), naam: g.naam, winkel: g.winkel || '', actie: { soort: 'link', url: 'https://app.shiftbase.com', label: 'Shiftbase' } }));
  }
  return t;
}

async function uitDatabase() {
  const t = [];
  const [som, opl] = await Promise.all([S.getSommatie(), S.getOverplaatsing()]);
  for (const r of som) if (r.verwerkt !== 'Ja' && /finale|staande voet|oproep/i.test(r.type || '')) t.push({ bron: 'dossier', urgentie: 'oranje', sleutel: 'som|' + r.rij, titel: r.type + ' afhandelen (gesprek gepland ' + (r.datumAfspraak || '?') + ')', sub: r.naam + ' · ' + (r.bv || '') + ' · verstuurd ' + (r.verzenddatum || '?'), naam: r.naam, email: r.email, actie: { soort: 'tab', tab: 'sommatie', zoek: r.naam, label: 'Sommaties' }, extra: { soort: 'dossier', label: 'Dossier' } });
  for (const r of opl) if (String(r.status || '').indexOf('Verstuurd') === 0 && r.ondertekend !== 'Ja') { const d = parseNLDatum(r.verzenddatum), dagen = d ? -dagenTot(d) : 0; if (dagen >= 7) t.push({ bron: 'dossier', urgentie: 'grijs', sleutel: 'opl|' + r.rij, titel: 'Overplaatsing nog niet ondertekend (niet verplicht)', sub: r.naam + ' · ' + r.huidigeBV + ' → ' + r.nieuweBV + ' · verstuurd ' + r.verzenddatum, naam: r.naam, email: r.email, actie: { soort: 'archiveer', type: 'overplaatsing', rij: r.rij, label: 'Archiveren' }, extra: { soort: 'tab', tab: 'overplaatsing', zoek: r.naam, label: 'Overplaatsing' } }); }
  return t;
}

// Fase 3a: lage check-ins (dag 30/60) die nog niet opgevolgd zijn
async function uitCheckins() {
  const t = [];
  try {
    const { data } = await admin().from('hr_checkin').select('id,medewerker_id,naam,email,winkel,moment,score,laag_reden,opmerking,ingevuld_op').eq('laag', true).is('opgevolgd_op', null).not('ingevuld_op', 'is', null).limit(200);
    for (const r of data || []) {
      const delen = String(r.laag_reden || '').split(' · ').filter(Boolean), alarm = delen.some(x => !/\d\/5$/.test(x));
      const dagen = Math.round((Date.now() - new Date(r.ingevuld_op).getTime()) / 864e5);
      t.push({ bron: 'checkin', urgentie: alarm || (r.score != null && Number(r.score) <= 2.5) || dagen >= 3 ? 'rood' : 'oranje', sleutel: 'checkin|' + r.id,
        titel: 'Check-in dag ' + r.moment + ': lage score — even bellen', sub: r.naam + ' · ' + (r.winkel || '-') + (r.score != null ? ' · gem. ' + String(r.score).replace('.', ',') + '/5' : '') + (delen.length ? ' · ' + delen.slice(0, 2).join(' · ') : '') + (r.opmerking ? ' · "' + String(r.opmerking).slice(0, 80) + '"' : '') + (dagen ? ' · ' + dagen + ' dagen geleden' : ''),
        naam: r.naam, email: r.email || '', winkel: r.winkel || '', actie: { soort: 'checkin-opvolgen', id: r.id, label: 'Gesprek / opgevolgd', aanleiding: 'Lage check-in dag ' + r.moment + (delen.length ? ': ' + delen.join(' · ') : '') + (r.opmerking ? ' — "' + r.opmerking + '"' : '') }, extra: { soort: 'tab', tab: 'checkin', zoek: r.naam, label: 'Antwoorden' } });
    }
  } catch (e) { /* tabel ontbreekt nog (migratie 0011) */ }
  return t;
}

// Fase 5b: MTO-acties met een deadline binnen 7 dagen (of over tijd)
async function uitMtoActies() {
  const t = [];
  try {
    const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }), grens = new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv-SE');
    const { data } = await admin().from('hr_mto_actie').select('id,winkel,thema,titel,eigenaar,deadline,status').in('status', ['open', 'bezig']).not('deadline', 'is', null).lte('deadline', grens).limit(200);
    const TH = {}; require('./_lib/mto-vragen').THEMAS.forEach(x => { TH[x.key] = x.nl; });
    for (const a of data || []) {
      const over = Math.round((new Date(vandaag) - new Date(a.deadline)) / 864e5);
      t.push({ bron: 'mto-actie', urgentie: over > 0 ? 'rood' : 'oranje', sleutel: 'mto-actie|' + a.id,
        titel: 'MTO-actie' + (over > 0 ? ' — ' + over + ' dagen over de deadline' : over === 0 ? ' — deadline vandaag' : ' — deadline over ' + (-over) + ' dagen') + ': ' + a.titel,
        sub: (a.winkel || 'SLA-breed') + (a.thema ? ' · ' + (TH[a.thema] || a.thema) : '') + (a.eigenaar ? ' · eigenaar ' + a.eigenaar : '') + ' · ' + a.status,
        winkel: a.winkel || '', actie: { soort: 'mto-actie', id: a.id, label: 'Bijwerken' }, extra: { soort: 'tab', tab: 'mto', label: 'MTO' } });
    }
  } catch (e) { /* tabel ontbreekt nog (migratie 0016) */ }
  return t;
}

// Fase 3b: vervolggesprekken die (bijna) aan de beurt zijn
async function uitGesprekken() {
  const t = [];
  try {
    const C = require('./_lib/config'), G = require('./_lib/gesprekken');
    const grens = new Date(Date.now() + 2 * 864e5).toLocaleDateString('sv-SE'), vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
    for (const r of await G.openVervolgen()) {
      if (r.vervolgDatum > grens) continue;
      const over = Math.round((new Date(vandaag) - new Date(r.vervolgDatum)) / 864e5);
      t.push({ bron: 'gesprek', urgentie: over > C.GESPREK_VERVOLG_TE_LAAT_DAGEN ? 'rood' : over >= 0 ? 'oranje' : 'grijs', sleutel: 'gesprek|' + r.id,
        titel: 'Vervolg ' + r.soortLabel.toLowerCase() + (over > 0 ? ' — ' + over + ' dagen over tijd' : over === 0 ? ' — vandaag' : ' — op ' + r.vervolgNL),
        sub: r.naam + ' · ' + (r.winkel || '-') + ' · gesprek ' + r.datumNL + (r.afspraken ? ' · afspraak: ' + r.afspraken.slice(0, 90) : ''),
        naam: r.naam, email: r.email || '', winkel: r.winkel || '', actie: { soort: 'gesprek-vervolg', id: r.id, gs: r.soort, label: 'Vervolggesprek vastleggen', aanleiding: 'Vervolg op ' + r.soortLabel.toLowerCase() + ' van ' + r.datumNL + (r.afspraken ? '. Afspraak was: ' + r.afspraken : '') }, extra: { soort: 'gesprek-af', id: r.id, label: '✓ Afvinken' } });
    }
  } catch (e) { /* tabel ontbreekt nog (migratie 0012) */ }
  return t;
}

// Fase 4a: training & certificaten uit SLA Academy (geen mails — Academy herinnert de medewerker zelf)
async function uitAcademy() {
  const t = [];
  try {
    const A = require('./_lib/academy');
    const r = await A.laad(false);
    for (const s of r.signalen) {
      const perWinkel = s.soort === 'nooit' || s.soort === 'zonder-cert';
      t.push(Object.assign({}, s, { afhandelbaar: true,
        afhandelOpties: s.soort === 'cert' ? [{ label: 'Medewerker/SM ingelicht', dagen: 14, opmerking: 'certificaat besproken' }]
          : perWinkel ? [{ label: 'Store Manager gevraagd', dagen: s.soort === 'nooit' ? 7 : 30, opmerking: 'winkel ingelicht' }]
          : [{ label: 'Besproken', dagen: 7, opmerking: 'besproken' }],
        actie: perWinkel ? { soort: 'tab', tab: 'training', zoek: s.winkel, label: 'Bekijk' } : { soort: 'dossier', label: 'Dossier' } }));
    }
  } catch (e) { /* koppeling nog niet aan (ACADEMY_HR_SLEUTEL / hr_koppeling.sql) */ }
  return t;
}

async function uitChecklists() {
  const t = [];
  try {
    const { data } = await admin().from('hr_checklists').select('id,type,naam,email,winkel,items,gestart_op').is('afgerond_op', null).limit(500);
    for (const c of data || []) {
      const items = c.items || [], open = items.filter(i => !i.klaar);
      if (!open.length) continue;
      const dagen = Math.round((Date.now() - new Date(c.gestart_op).getTime()) / 864e5);
      t.push({ bron: 'checklist', urgentie: c.type === 'offboarding' || dagen > 14 ? 'oranje' : 'grijs', sleutel: 'chk|' + c.id, titel: (c.type === 'onboarding' ? 'Onboarding' : 'Offboarding') + ': ' + open.length + ' van ' + items.length + ' punten open', sub: c.naam + ' · ' + (c.winkel || '-') + ' · gestart ' + dagen + ' dagen geleden · volgende: ' + open[0].label, naam: c.naam, email: c.email || '', winkel: c.winkel || '', actie: { soort: 'checklist', id: c.id, label: 'Checklist' } });
    }
  } catch (e) { /* tabel ontbreekt nog (migratie 0007) */ }
  return t;
}

exports.handler = beveiligd('taken', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (!p.sleutel) throw new Error('sleutel ontbreekt');
    if (g.rol === 'keuken' && !/keuken/i.test(String(p.winkel || ''))) throw new Error('Je kunt alleen taken van de keuken afhandelen.');
    const dagen = Math.min(Math.max(parseInt(p.dagen, 10) || 7, 1), 90);
    const tot = new Date(Date.now() + dagen * 864e5).toISOString();
    const { error } = await admin().from('hr_taken_afgehandeld').upsert({ sleutel: String(p.sleutel), door: g.email, op: new Date().toISOString(), tot, opmerking: p.opmerking ? String(p.opmerking).slice(0, 300) : null }, { onConflict: 'sleutel' });
    if (error) throw new Error('hr_taken_afgehandeld: ' + error.message + ' (migratie 0007 gedraaid?)');
    await logActie({ door: g.email, actie: 'taak-afgehandeld', bron: 'taken', naam: String(p.sleutel).split('|')[1] || null, details: String(p.sleutel) + ' · ' + dagen + ' dagen' });
    return { bericht: 'Afgehandeld; komt na ' + dagen + ' dagen terug als het nog speelt.' };
  }
  const qs = event.queryStringParameters || {};
  const live = qs.live === '1';
  const runs = await laatsteRuns();
  let taken = [];
  const fouten = [];
  if (live) {
    const sig = require('./_lib/signaleringen');
    await Promise.all(LIVE_CHECKS.map(async naam => { try { const rap = await sig.draai(naam, true, 'verse stand · ' + g.email); /* v0.27.1: verse stand bewaren (droogloop, geen mails) */ runs[naam] = { tijd: new Date().toISOString(), gevonden: rap.gevonden || [] }; } catch (e) { fouten.push(naam + ': ' + e.message); } }));
  }
  // Wie al bij Ontslag & aanzegging staat (einddatum vandaag of later) krijgt geen contract-/keten-/proeftijd-/oproep-/aanwezigheidstaken meer
  const OVERBODIG_BIJ_ONTSLAG = new Set(['contractketen', 'aanzegtermijnen', 'oproepaanbod', 'stille-afwezigen', 'weekend-beschikbaarheid']);
  let vertrek = null;
  try { vertrek = await require('./_lib/signaleringen').vertrekkers(); } catch (e) { fouten.push('ontslagdossiers: ' + e.message); }
  const VT = require('./_lib/signaleringen').vertrekt;
  // De checks draaien een paar keer per dag; wat sindsdien al is afgehandeld mag niet als taak blijven staan.
  // Nieuwe medewerkers: wie inmiddels in het loonheffingsoverzicht staat (uitnodiging verstuurd, handmatig of automatisch) valt weg.
  let loonAl = null;
  try { const { normNaam: nn } = require('./_lib/util'); loonAl = new Set(); (await S.getLoonheffing()).forEach(r => { if (r.email) loonAl.add('e:' + String(r.email).trim().toLowerCase()); if (r.naam) loonAl.add('n:' + nn(r.naam)); }); loonAl.nn = nn; } catch (e) { loonAl = null; }
  const loonVerstuurd = x => loonAl && ((x.email && loonAl.has('e:' + String(x.email).trim().toLowerCase())) || (x.naam && loonAl.has('n:' + loonAl.nn(x.naam))));
  for (const naam of ALLE_CHECKS) if (runs[naam]) {
    let items = vertrek && OVERBODIG_BIJ_ONTSLAG.has(naam) ? (runs[naam].gevonden || []).filter(x => !VT(vertrek, x)) : runs[naam].gevonden;
    // v0.26.2: de checks draaien 's ochtends; is er daarna een ontslagbevestiging/aanzegging verstuurd, dan is de verlengingstaak klaar
    // (behalve 'tegenstrijdig': besloten te verlengen terwijl er een brief is verstuurd — die moet juist blijven staan)
    if (vertrek && naam === 'verlengingen') items = (items || []).filter(x => x.status === 'tegenstrijdig' || !VT(vertrek, x));
    if (naam === 'nieuwe-medewerkers') items = (items || []).filter(x => !loonVerstuurd(x));
    taken.push(...uitCheck(naam, items, runs[naam].tijd));
  }
  // Fase 4c: wie een verlengingstaak heeft, krijgt geen losse aanzeg- of ketentaak meer (die info zit in de verlengingstaak)
  const { normNaam } = require('./_lib/util');
  const metVerlenging = new Set(taken.filter(t => t.verlenging).map(t => normNaam(t.naam)));
  if (metVerlenging.size) taken = taken.filter(t => !(metVerlenging.has(normNaam(t.naam)) && (t.bron === 'aanzegtermijnen' || /^contractketen\|(keten|vast)\|/.test(t.sleutel || ''))));
  // v0.29.0: advies van de store manager over de proeftijd (winkelmail) bij de proeftijdtaak zetten
  try {
    const pt = taken.filter(t => /^contractketen\|proeftijd\|/.test(t.sleutel || ''));
    if (pt.length) {
      const { data } = await require('./_lib/auth').admin().from('hr_sm_advies').select('naam,advies,opmerking,contract_eind').eq('soort', 'proeftijd').gte('contract_eind', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
      const LBL = require('./_lib/winkelmail').PROEF_ADVIES;
      for (const t of pt) { const a = (data || []).find(x => normNaam(x.naam) === normNaam(t.naam)); if (!a) continue;
        t.sub += ' · advies SM: ' + (LBL[a.advies] || a.advies).toLowerCase() + (a.opmerking ? ' ("' + String(a.opmerking).slice(0, 80) + '")' : '');
        if (a.advies === 'niet') { t.urgentie = 'rood'; const pd = (t.sub.match(/proeftijd t\/m (\d{2}-\d{2}-\d{4})/) || [])[1]; t.titel = 'Store manager adviseert: stoppen in de proeftijd — brief ' + (pd ? 'uiterlijk ' + pd + ' bij de medewerker' : 'vóór het einde van de proeftijd'); } }
    }
  } catch (e) { fouten.push('advies proeftijd: ' + e.message); }
  taken.push(...await uitDatabase());
  taken.push(...await uitChecklists());
  taken.push(...await uitCheckins());
  taken.push(...await uitGesprekken());
  taken.push(...await uitMtoActies());
  taken.push(...await uitAcademy());
  // afgehandelde items verbergen
  let verborgen = 0;
  try {
    const { data } = await admin().from('hr_taken_afgehandeld').select('sleutel,tot').gt('tot', new Date().toISOString()).limit(2000);
    const weg = new Set((data || []).map(r => r.sleutel));
    const voor = taken.length; taken = taken.filter(t => !weg.has(t.sleutel)); verborgen = voor - taken.length;
  } catch (e) { /* migratie 0007 nog niet gedraaid */ }
  // v0.25.8: keukentaken alleen bij Jop (rol 'keuken'); HR ziet alles behalve de keuken
  const keukenRol = g.rol === 'keuken', isKeuken = t => /keuken/i.test(String(t.winkel || ''));
  taken = taken.filter(t => keukenRol ? isKeuken(t) : !isKeuken(t));
  const rang = { rood: 0, oranje: 1, grijs: 2 };
  taken.sort((a, b) => rang[a.urgentie] - rang[b.urgentie] || String(a.naam || '').localeCompare(String(b.naam || ''), 'nl'));
  const stand = Object.keys(runs).filter(k => ALLE_CHECKS.includes(k)).map(k => ({ check: k, tijd: stempelNL(runs[k].tijd), aantal: (runs[k].gevonden || []).length }));
  return { taken, aantallen: { rood: taken.filter(t => t.urgentie === 'rood').length, oranje: taken.filter(t => t.urgentie === 'oranje').length, grijs: taken.filter(t => t.urgentie === 'grijs').length }, verborgen, stand, live, fouten };
});
exports._uitCheck = uitCheck; // tests
