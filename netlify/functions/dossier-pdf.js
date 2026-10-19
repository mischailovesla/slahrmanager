// GET /api/dossier-pdf?id=... | ?naam=...&email=...  (exporteerDossierPdf, Dossier.gs) — volledig personeelsdossier als PDF (inzageverzoek / jurist)
// Gebruikt dezelfde data als /api/dossier; opgebouwd met pdf-lib (geen Docs/Drive). Export wordt gelogd in hr_acties én hr_toegangslog.
const { beveiligd, logActie, log } = require('./_lib/auth');
const P = require('./_lib/pdf');
const D = require('./_lib/datum');
const dossier = require('./dossier');

const LABELS = {
  loonheffing: ['Deadline', 'deadline', 'Mail', 'status', 'Formulier ontvangen', 'ontvangen', 'Herinneringen', 'aantalHer', 'Naar salaris', 'mahdia', 'Salaris verstuurd', 'salaris'],
  korting: ['Keuze', 'keuze', 'Ingangsdatum', 'ingangsdatum', 'Deadline', 'deadline', 'Mail', 'status', 'Retour', 'retour', 'Naar salaris', 'salaris'],
  onboarding: ['Locatie', 'locatie', 'Taal', 'taal', 'Welkomstmail', 'status', 'Datum', 'verzenddatum'],
  overplaatsing: ['Type', 'type', 'Van', 'huidigeBV', 'Naar', 'nieuweBV', 'Ingangsdatum', 'ingangsdatum', 'Mail', 'status', 'Ondertekend', 'ondertekend'],
  sommatie: ['Type', 'type', 'BV', 'bv', 'Datum afwezig', 'datumAfwezig', 'Afspraak', 'datumAfspraak', 'Verstuurd', 'verzenddatum', 'Status', 'status', 'Verwerkt', 'verwerkt', 'Aanvullende tekst', 'aanvullend'],
  ontslag: ['Type', 'type', 'BV', 'bedrijf', 'Datum opzegging', 'opzegging', 'Einddatum', 'einddatum', 'Mail', 'status', 'Ondertekend', 'ondertekend', 'Herinneringen', 'aantalHer', 'Naar salaris', 'mahdia'],
  brief: ['Categorie', 'categorie', 'Onderwerp', 'onderwerp', 'BV', 'bv', 'Verstuurd', 'verzenddatum', 'Tekst', 'tekst'],
  waarschuwing: ['Winkel', 'winkel', 'Datum overtreding', 'datumOvertreding', 'Overtreden regels', 'regels', 'Toelichting', 'toelichting', 'Status', 'status'],
  beschikbaarheid: ['Winkel', 'winkel', 'Ingangsdatum', 'ingangsdatum', 'Onderbouwing', 'onderbouwing', 'Status', 'status'],
  notitie: ['Datum', 'datum', 'Auteur', 'auteur', 'Notitie', 'tekst']
};
const veld = v => v === undefined || v === null || v === '' ? '-' : String(v);

exports.handler = beveiligd('dossier-pdf', async (event, g) => {
  const d = await dossier.laad(event.queryStringParameters || {});
  const nu = D.stempel();
  let t = '**SLA**\n*Personeelsdossier - vertrouwelijk*\n\n**' + d.naam + '**\n' + (d.email || '') + '\n';
  if (d.persoon) t += (d.persoon.winkelNaam ? 'Winkel: ' + d.persoon.winkelNaam + (d.persoon.winkelBv ? ' (' + d.persoon.winkelBv + ')' : '') + '\n' : '') + 'Functie: ' + veld(d.persoon.functie) + '\nIn dienst sinds: ' + veld(d.persoon.indienst) + '\nContract: ' + veld(d.contract && d.contract.type) + (d.contract && d.contract.einde ? ', eindigt ' + d.contract.einde : ', onbepaalde tijd / onbekend') + '\n';
  if (d.verlof && d.verlof.length) t += 'Verlof (Shiftbase): ' + d.verlof.slice(0, 10).map(v => v.start + (v.eind && v.eind !== v.start ? ' t/m ' + v.eind : '') + ' ' + (v.type || '') + ' (' + v.status + ')').join('; ') + '\n';
  t += '\n';
  if (d.gesprekken && d.gesprekken.length) {
    t += '**Gesprekken (' + d.gesprekken.length + ')**\n';
    d.gesprekken.forEach((x, i) => {
      if (i > 0) t += '\n';
      t += '**' + x.soortLabel + ':** ' + x.datumNL + (x.kanaal ? ' (' + x.kanaal + ')' : '') + (x.gevoerdDoor ? ' · ' + x.gevoerdDoor : '') + '\n';
      if (x.aanleiding) t += '**Aanleiding:** ' + x.aanleiding + '\n';
      if (x.besproken) t += '**Besproken:** ' + x.besproken + '\n';
      if (x.afspraken) t += '**Afspraken:** ' + x.afspraken + '\n';
      if (x.vervolgDatum) t += '**Vervolg:** ' + x.vervolgNL + (x.vervolgAfgerond ? ' (afgerond ' + x.vervolgAfgerond + ')' : ' (open)') + '\n';
    });
    t += '\n';
  }
  const leeg = [];
  for (const s of d.secties) {
    if (!s.rijen.length) { leeg.push(s.label); continue; }
    t += '**' + s.label + ' (' + s.rijen.length + ')**\n';
    const L = LABELS[s.key];
    s.rijen.forEach((r, i) => {
      if (i > 0) t += '\n';
      if (L) { for (let k = 0; k < L.length; k += 2) { const v = r[L[k + 1]]; if (v === undefined) continue; t += '**' + L[k] + ':** ' + veld(v) + '\n'; } }
      else t += (r.datum ? '**Datum:** ' + r.datum + '\n' : '') + (r.raw || []).slice(0, 8).join(' · ') + '\n';
    });
    t += '\n';
  }
  if (!d.secties.some(s => s.rijen.length)) t += (d.gesprekken && d.gesprekken.length ? '*Geen overige dossierstukken aanwezig.*' : '*Geen dossierstukken aanwezig.*') + '\n\n';
  if (leeg.length) t += '*Geen stukken in: ' + leeg.join(', ') + '*\n\n';
  t += '*Gegenereerd op ' + nu + ' door ' + g.email + ' via het SLA HR Dashboard.*';
  const pdf = await P.maakOpgemaakteBrief(t, { titel: 'Dossier - ' + d.naam, kop: false });
  const bestandsnaam = 'Dossier - ' + d.naam.replace(/[\\/:*?"<>|]/g, '') + ' - ' + D.kort() + '.pdf';
  await logActie({ door: g.email, actie: 'export', bron: 'dossier', veld: 'pdf', rij: 0, naam: d.naam, details: 'Dossier geëxporteerd (PDF), ' + d.totaal + ' stukken' });
  await log(g.email, 'export', 'Dossier-PDF ' + d.naam, event);
  return { b64: pdf.toString('base64'), bestandsnaam };
});
