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

const LIVE_CHECKS = ['nieuwe-medewerkers', 'aanzegtermijnen', 'loonheffing-herinneringen', 'ontslag-herinneringen', 'korting-herinneringen', 'contractketen', 'verzuim'];
const ALLE_CHECKS = LIVE_CHECKS.concat(['stille-afwezigen', 'weekend-beschikbaarheid', 'vakantiepieken', 'bewaartermijnen', 'data-hygiene', 'jeugd', 'oproepaanbod']);

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
    else if (naam === 'ontslag-herinneringen') t.push(Object.assign({}, bron, { urgentie: (g.eerder || 0) >= 3 ? 'rood' : 'oranje', sleutel: naam + '|' + g.naam, titel: (g.type === 'aanzegging' ? 'Aanzegging' : 'Ontslagbevestiging') + ' nog niet ondertekend retour', sub: g.naam + ' · verstuurd ' + (g.verzonden || '?') + ' · ' + (g.eerder || 0) + ' herinnering(en)', naam: g.naam, email: g.email || '', actie: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', rij: g.rij }, label: 'Herinnering' }, extra: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'korting-herinneringen') t.push(Object.assign({}, bron, { urgentie: 'oranje', sleutel: naam + '|' + g.naam, titel: 'Loonheffingskorting-formulier niet retour (' + (g.keuze || '?') + ')', sub: g.naam + ' · verstuurd ' + (g.verzonden || '?') + ' · ' + (g.eerder || 0) + ' herinnering(en)', naam: g.naam, email: g.email || '', actie: { soort: 'korting', persoon: { naam: g.naam, email: g.email || '', rij: g.rij }, label: 'Herinnering' } }));
    else if (naam === 'stille-afwezigen') t.push(Object.assign({}, bron, { urgentie: 'oranje', afhandelbaar: true, sleutel: naam + '|' + g.naam, titel: 'Stille afwezige: check bij de store manager', sub: g.naam + ' · ' + (g.winkel || '-') + ' · ' + (g.laatsteDienst ? 'laatste dienst ' + g.laatsteDienst + ' (' + g.dagen + ' dagen)' : 'geen dienst in ' + C.STIL_LOOKBACK_DAGEN + ' dagen'), naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' }, extra: { soort: 'sommatie', persoon: { naam: g.naam, email: g.email || '' }, label: 'Oproepbrief' } }));
    else if (naam === 'weekend-beschikbaarheid') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + g.naam, titel: 'Weekendbeschikbaarheid: gesprek + brief (huisregel 2)', sub: g.naam + ' · ' + (g.winkel || '-') + (g.doordeweeks != null ? ' · ' + g.doordeweeks + ' doordeweekse diensten, laatste weekenddienst ' + (g.laatsteWeekendDienst || 'onbekend') : ''), naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'beschikbaarheid', persoon: { naam: g.naam, email: g.email || '', winkel: g.winkel || '' }, label: 'Brief' } }));
    else if (naam === 'vakantiepieken') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + (g.winkel || '') + '|' + (g.week || ''), titel: 'Afwezigheidspiek: ' + (g.winkel || '?') + (g.week ? ' ' + g.week : ''), sub: (g.bezetting ? Math.round(((g.app || 0) + (g.pend || 0) + (g.stil || 0)) / g.bezetting * 100) + '% van ' + g.bezetting + ' tegelijk weg' : '') + (g.namen && g.namen.length ? ' · ' + g.namen.slice(0, 5).join(', ') : ''), winkel: g.winkel || '', actie: { soort: 'tab', tab: 'vakantie', label: 'Planner' } }));
    else if (naam === 'bewaartermijnen') t.push(Object.assign({}, bron, { urgentie: 'grijs', afhandelbaar: true, sleutel: naam + '|' + (g.categorie || '') + '|' + g.naam, titel: 'AVG: beoordelen of dit weg kan — ' + (g.categorie || ''), sub: g.naam + ' · ' + (g.datum || '') + ' · ' + (g.termijn || ''), naam: g.naam, actie: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'contractketen' && g.soort === 'keten') t.push(Object.assign({}, bron, { urgentie: g.vol ? 'rood' : 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Vast contract gegeven (in Shiftbase gezet)', dagen: 90, opmerking: 'vast contract' }, { label: 'Besloten: niet verlengen → aanzegging volgt', dagen: Math.min((g.dagenTotEinde || 0) + 1, 90), opmerking: 'niet verlengen' }], sleutel: naam + '|keten|' + g.naam, titel: g.vol ? 'Ketenregeling: verlengen kan alleen nog als vast contract' : 'Ketenregeling: volgende contract is het laatste tijdelijke', sub: g.naam + ' · ' + (g.winkel || '-') + ' · contract eindigt ' + g.einddatum + ' (over ' + g.dagenTotEinde + ' dagen) · ' + g.aantal + ' contracten, ' + g.maanden + ' mnd', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' }, extra: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', einddatum: g.einddatum, type: 'aanzegging' }, label: 'Aanzegging' } }));
    else if (naam === 'contractketen' && g.soort === 'proeftijd') t.push(Object.assign({}, bron, { urgentie: g.dagenTotEinde <= 3 ? 'rood' : 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Proeftijdgesprek gevoerd — blijft', dagen: 30, opmerking: 'proeftijd ok' }], sleutel: naam + '|proeftijd|' + g.naam, titel: 'Proeftijd eindigt ' + (g.dagenTotEinde > 0 ? 'over ' + g.dagenTotEinde + ' dagen' : g.dagenTotEinde === 0 ? 'vandaag' : '(verstreken)') + ' — gesprek + beslissing', sub: g.naam + ' · ' + (g.winkel || '-') + ' · in dienst ' + g.start + ' · proeftijd t/m ' + g.proeftijdEinde + ' (indien overeengekomen)', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' }, extra: { soort: 'ontslagmail', persoon: { naam: g.naam, email: g.email || '', type: 'ontslag' }, label: 'Proeftijdontslag' } }));
    else if (naam === 'verzuim' && g.soort === 'mijlpaal') t.push(Object.assign({}, bron, { urgentie: g.teLaat || g.over <= 2 ? 'rood' : 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Gedaan en vastgelegd', dagen: 14, opmerking: g.mijlpaal }], sleutel: naam + '|' + g.mijlpaalDag + '|' + g.naam, titel: 'Poortwachter: ' + g.mijlpaal + (g.teLaat ? ' — ' + (-g.over) + ' dagen geleden' : g.over === 0 ? ' — vandaag' : ' — over ' + g.over + ' dagen'), sub: g.naam + ' · ' + (g.winkel || '-') + ' · ziek sinds ' + g.sinds + ' (dag ' + g.dag + ')', naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' } }));
    else if (naam === 'verzuim' && g.soort === 'frequent') t.push(Object.assign({}, bron, { urgentie: 'oranje', afhandelbaar: true, afhandelOpties: [{ label: 'Verzuimgesprek gevoerd', dagen: 60, opmerking: 'verzuimgesprek' }], sleutel: naam + '|frequent|' + g.naam, titel: 'Frequent verzuim: ' + g.meldingen + ' ziekmeldingen in 12 maanden — gesprek plannen', sub: g.naam + ' · ' + (g.winkel || '-') + ' · laatste melding ' + g.laatste, naam: g.naam, email: g.email || '', winkel: g.winkel || '', actie: { soort: 'dossier', label: 'Dossier' } }));
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
  for (const r of opl) if (String(r.status || '').indexOf('Verstuurd') === 0 && r.ondertekend !== 'Ja') { const d = parseNLDatum(r.verzenddatum), dagen = d ? -dagenTot(d) : 0; if (dagen >= 7) t.push({ bron: 'dossier', urgentie: 'grijs', sleutel: 'opl|' + r.rij, titel: 'Overplaatsing nog niet ondertekend', sub: r.naam + ' · ' + r.huidigeBV + ' → ' + r.nieuweBV + ' · verstuurd ' + r.verzenddatum, naam: r.naam, email: r.email, actie: { soort: 'tab', tab: 'overplaatsing', zoek: r.naam, label: 'Overplaatsing' } }); }
  return t;
}

// Fase 3a: lage check-ins (dag 30/60) die nog niet opgevolgd zijn
async function uitCheckins() {
  const t = [];
  try {
    const { data } = await admin().from('hr_checkin').select('id,naam,email,winkel,moment,score,laag_reden,opmerking,ingevuld_op').eq('laag', true).is('opgevolgd_op', null).not('ingevuld_op', 'is', null).limit(200);
    for (const r of data || []) {
      const delen = String(r.laag_reden || '').split(' · ').filter(Boolean), alarm = delen.some(x => !/\d\/5$/.test(x));
      const dagen = Math.round((Date.now() - new Date(r.ingevuld_op).getTime()) / 864e5);
      t.push({ bron: 'checkin', urgentie: alarm || (r.score != null && Number(r.score) <= 2.5) || dagen >= 3 ? 'rood' : 'oranje', sleutel: 'checkin|' + r.id,
        titel: 'Check-in dag ' + r.moment + ': lage score — even bellen', sub: r.naam + ' · ' + (r.winkel || '-') + (r.score != null ? ' · gem. ' + String(r.score).replace('.', ',') + '/5' : '') + (delen.length ? ' · ' + delen.slice(0, 2).join(' · ') : '') + (r.opmerking ? ' · "' + String(r.opmerking).slice(0, 80) + '"' : '') + (dagen ? ' · ' + dagen + ' dagen geleden' : ''),
        naam: r.naam, email: r.email || '', winkel: r.winkel || '', actie: { soort: 'checkin-opvolgen', id: r.id, label: '✓ Opgevolgd' }, extra: { soort: 'tab', tab: 'checkin', zoek: r.naam, label: 'Antwoorden' } });
    }
  } catch (e) { /* tabel ontbreekt nog (migratie 0011) */ }
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
    await Promise.all(LIVE_CHECKS.map(async naam => { try { const rap = await sig.CHECKS[naam](true); runs[naam] = { tijd: new Date().toISOString(), gevonden: rap.gevonden || [] }; } catch (e) { fouten.push(naam + ': ' + e.message); } }));
  }
  for (const naam of ALLE_CHECKS) if (runs[naam]) taken.push(...uitCheck(naam, runs[naam].gevonden, runs[naam].tijd));
  taken.push(...await uitDatabase());
  taken.push(...await uitChecklists());
  taken.push(...await uitCheckins());
  // afgehandelde items verbergen
  let verborgen = 0;
  try {
    const { data } = await admin().from('hr_taken_afgehandeld').select('sleutel,tot').gt('tot', new Date().toISOString()).limit(2000);
    const weg = new Set((data || []).map(r => r.sleutel));
    const voor = taken.length; taken = taken.filter(t => !weg.has(t.sleutel)); verborgen = voor - taken.length;
  } catch (e) { /* migratie 0007 nog niet gedraaid */ }
  const rang = { rood: 0, oranje: 1, grijs: 2 };
  taken.sort((a, b) => rang[a.urgentie] - rang[b.urgentie] || String(a.naam || '').localeCompare(String(b.naam || ''), 'nl'));
  const stand = Object.keys(runs).filter(k => ALLE_CHECKS.includes(k)).map(k => ({ check: k, tijd: stempelNL(runs[k].tijd), aantal: (runs[k].gevonden || []).length }));
  return { taken, aantallen: { rood: taken.filter(t => t.urgentie === 'rood').length, oranje: taken.filter(t => t.urgentie === 'oranje').length, grijs: taken.filter(t => t.urgentie === 'grijs').length }, verborgen, stand, live, fouten };
});
