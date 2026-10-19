// ============================================================
// POST /api/ontslag-mail  (port van stuurMail → stuurOntslagMetPDF /
// stuurAanzeggingMetPDF / stuurTekstMail + logVerzonden uit Code.gs v29.7)
// { template:'ontslag-pdf'|'ontslag-herinnering'|'aanzegging-nl'|'aanzegging-en'
//           |'proeftijd-wg-nl'|'proeftijd-wg-en'|'proeftijd-wn-nl'|'proeftijd-wn-en' (Proeftijd.gs; log als type ontslag),
//   to, naam, bv, adres, datumOpzegging, einddatum, rij?, subject?, body? }
//  - PDF-templates: brieftekst uit _lib/brieftemplates.js (1-op-1 uit de Docs-templates),
//    placeholders {{Naam}} {{Adres}} {{DatumOpzegging}} {{Einddatum}} {{BV}} {{HuidigeDatum}}
//    ingevuld en als PDF opgebouwd met pdf-lib (geen Drive/Docs-API, geen beheerdersstap).
//    Geen Drive-archief: de PDF zit in de mail en is via 'alleenPdf' altijd opnieuw te maken.
//  - mail via Resend in SLA-huisstijl (HTML + plain), PDF als bijlage
//  - sheet: H 'Verzonden op dd-MM-yyyy HH:mm' (groen) + I datum; nieuwe rij
//    (A naam, B e-mail, C opzegdatum, D einddatum, F BV, G adres) als de
//    medewerker nog niet in de sheet staat. Herinnering → K laatste + L teller
//    (zelfde cellen als checkOntslagHerinneringen).
// { ..., preview:true }   -> { subject, text, html }, verstuurt niets
// { ..., alleenPdf:true } -> { pdf (base64), bestandsnaam }, verstuurt en logt niets
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const B = require('./_lib/brieftemplates');
const C = require('./_lib/config');

function stempel() {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + '-' + g('month') + '-' + g('year') + ' ' + g('hour') + ':' + g('minute');
}
// Datum zoals de Docs-versie: 'dd MMMM yyyy' (NL) of 'MMMM d, yyyy' (EN)
function briefDatum(isEN) {
  const d = new Date();
  if (isEN) return d.toLocaleDateString('en-US', { timeZone: 'Europe/Amsterdam', month: 'long', day: 'numeric', year: 'numeric' });
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: 'long', year: 'numeric' }).formatToParts(d);
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + ' ' + g('month') + ' ' + g('year');
}
const veiligeNaam = n => String(n || 'medewerker').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

exports.handler = beveiligd('ontslag-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const tpl = T.ONTSLAG_TEMPLATES.find(x => x.key === p.template);
  if (!tpl) throw new Error('Onbekend template: ' + p.template);
  const isEN = tpl.taal === 'EN';
  const naam = String(p.naam || '').trim();
  const to = String(p.to || '').trim();
  const bv = String(p.bv || '').trim() || C.BEDRIJFSNAAM;
  const adres = String(p.adres || '').trim();
  const datumOpzegging = String(p.datumOpzegging || '').trim();
  const einddatum = String(p.einddatum || '').trim();
  const subject = String(p.subject || tpl.subject.replace('[BV]', bv)).trim();
  // Exit-survey (fase 2f): persoonlijke link in mail + brief bij ontslag/aanzegging/proeftijd (niet bij herinnering)
  const exitLink = tpl.type === 'herinnering' ? '' : require('./_lib/exit').exitLink(naam || 'medewerker', tpl.taal, tpl.type);
  const metExit = s => String(s || '').split('{{EXITLINK}}').join(exitLink);
  const text = metExit(T.personaliseerUploadLinks(String(p.body || tpl.body(naam, bv)), naam));
  const html = metExit(T.ontslagMailHtml(tpl, naam, bv, einddatum));
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Naam ontbreekt.');

  // --- PDF uit de code-template ---
  const isProef = tpl.type === 'proeftijd', isWG = tpl.variant === 'wg';
  if (isProef && !einddatum) throw new Error('Vul de einddatum in.');
  const proefLabel = isWG ? (isEN ? 'Probation termination (EN)' : 'Proeftijdontslag') : (isEN ? 'Confirmation resignation probation (EN)' : 'Bevestiging ontslagname proeftijd');
  const maakPdf = async () => {
    const sjabloon = tpl.type === 'aanzegging' ? (isEN ? B.AANZEGGING_EN : B.AANZEGGING_NL)
      : isProef ? (isWG ? (isEN ? B.PROEFTIJD_WG_EN : B.PROEFTIJD_WG_NL) : (isEN ? B.PROEFTIJD_WN_EN : B.PROEFTIJD_WN_NL))
      : B.ONTSLAG;
    const tekst = B.vul(sjabloon, { '{{Naam}}': naam, '{{Adres}}': adres, '{{DatumOpzegging}}': datumOpzegging, '{{Einddatum}}': einddatum, '{{BV}}': bv, '{{HuidigeDatum}}': briefDatum(isEN), '{{EXITLINK}}': exitLink });
    const titel = tpl.type === 'aanzegging' ? (isEN ? 'Notice of non-renewal' : 'Aanzegging') : isProef ? proefLabel : 'Ontslagbevestiging';
    return P.maakOpgemaakteBrief(tekst, { titel: titel + ' - ' + naam, handtekening: tpl.type === 'ontslag' ? B.handtekening() : null });
  };
  const prefix = tpl.type === 'aanzegging' ? (isEN ? 'Notice_non_renewal_' : 'Aanzegging_')
    : isProef ? (isWG ? (isEN ? 'Probation_termination_' : 'Proeftijdontslag_') : (isEN ? 'Confirmation_resignation_probation_' : 'Bevestiging_ontslagname_proeftijd_'))
    : 'Ontslagbevestiging_';
  const bestandsnaam = prefix + veiligeNaam(naam) + '.pdf';
  if (p.alleenPdf) {
    if (!tpl.pdf) throw new Error('Dit template heeft geen PDF.');
    return { pdf: (await maakPdf()).toString('base64'), bestandsnaam };
  }

  if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const pdf = tpl.pdf ? await maakPdf() : null;
  const resendId = await M.verstuur({
    to, subject, text, html,
    attachments: pdf ? [{ filename: bestandsnaam, content: pdf.toString('base64') }] : undefined,
    tags: [{ name: 'bron', value: 'ontslag' }, { name: 'type', value: tpl.type }]
  });

  // --- sheet-logging (logVerzonden) ---
  const id = C.SHEETS.ontslag.id;
  const nu = stempel();
  let rij = parseInt(p.rij, 10) || 0;
  if (!rij) rij = await S.vindOntslagRij(to);
  let nieuweRij = false;
  if (!rij) {
    rij = await S.eersteLegeOntslagRij();
    nieuweRij = true;
    await S.zetCel(id, null, rij, 1, naam);
    await S.zetCel(id, null, rij, 2, to);
    if (datumOpzegging) await S.zetCel(id, null, rij, 3, datumOpzegging);
    if (einddatum) await S.zetCel(id, null, rij, 4, einddatum);
    if (bv) await S.zetCel(id, null, rij, 6, bv);
    if (adres) await S.zetCel(id, null, rij, 7, adres);
  }
  if (tpl.type === 'herinnering') {
    const teller = parseInt(await S.leesCel(id, null, rij, 12), 10) || 0;
    await S.zetCel(id, null, rij, 11, nu);
    await S.zetCel(id, null, rij, 12, String(teller + 1));
  } else {
    await S.zetCel(id, null, rij, 8, 'Verzonden op ' + nu, S.KLEUR.groen);
    await S.zetCel(id, null, rij, 9, nu);
    if (!nieuweRij) {
      if (einddatum) await S.zetCel(id, null, rij, 4, einddatum);
      if (datumOpzegging && (tpl.type === 'ontslag' || isProef)) await S.zetCel(id, null, rij, 3, datumOpzegging);
      if (adres) await S.zetCel(id, null, rij, 7, adres);
    }
  }
  if (p.uitstroomreden && tpl.type !== 'herinnering' && C.UITSTROOMREDENEN.includes(p.uitstroomreden)) await S.zetUitstroomreden(rij, p.uitstroomreden);
  await M.logMail({ door: g.email, bron: 'ontslag', type: tpl.type + (pdf ? '-pdf' : ''), naar: to, naam, onderwerp: subject, taal: tpl.taal, rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'ontslag', veld: tpl.type, rij, naam, nieuw: to, details: subject + (pdf ? ' (+PDF)' : '') });
  const wat = tpl.type === 'aanzegging' ? 'Aanzegging' + (isEN ? ' (EN)' : '') : tpl.type === 'herinnering' ? 'Herinnering' : isProef ? proefLabel : 'Ontslagbevestiging';
  return { bericht: wat + (pdf ? ' + PDF' : '') + ' verstuurd naar ' + to + (nieuweRij ? ' (nieuwe rij ' + rij + ')' : ''), rij, resendId };
});
