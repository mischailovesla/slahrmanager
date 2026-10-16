// ============================================================
// POST /api/beschikbaarheid-mail  (port van stuurBeschikbaarheidMetPDF, Beschikbaarheid.gs v1)
// { to, naam, adres, winkel (code), ingangsdatum, taal, onderbouwing, rij?, preview?, alleenPdf? }
//  - brief BESCHIKB_NL/EN → PDF (pdf-lib); mail beschikbHtml/beschikbPlain
//  - log: tab 'Beschikbaarheid' (A..J), status I 'Verstuurd op …' (#d9ead3)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const B = require('./_lib/brieftemplates');
const C = require('./_lib/config');
const D = require('./_lib/datum');

exports.handler = beveiligd('beschikbaarheid-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim(), to = String(p.to || '').trim(), adres = String(p.adres || '').trim();
  const ingangsdatum = String(p.ingangsdatum || '').trim();
  const isEN = String(p.taal || 'NL').toUpperCase() === 'EN';
  if (!p.winkel) throw new Error('Selecteer een winkel.');
  const w = C.WINKEL_BV_MAP[p.winkel];
  if (!w) throw new Error('Onbekende winkel-afkorting.');
  const bv = w.bv;
  const subject = (isEN ? 'Weekend availability - written notice - ' : 'Weekendbeschikbaarheid - schriftelijke kennisgeving - ') + naam;
  const text = T.beschikbPlain(naam, bv, ingangsdatum, isEN), html = T.beschikbHtml(naam, bv, ingangsdatum, isEN);
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Vul de naam in.');
  if (!ingangsdatum) throw new Error('Vul de ingangsdatum in.');

  const tekst = B.vul(isEN ? B.BESCHIKB_EN : B.BESCHIKB_NL, {
    '{{Naam}}': naam, '{{Adres}}': adres, '{{BV}}': bv, '{{Winkel}}': w.naam, '{{DataOnderbouwing}}': String(p.onderbouwing || '').trim(),
    '{{Ingangsdatum}}': ingangsdatum, '{{HuidigeDatum}}': D.briefDatum(isEN)
  });
  const pdf = await P.maakOpgemaakteBrief(tekst, { titel: (isEN ? 'Weekend availability notice' : 'Kennisgeving weekendbeschikbaarheid') + ' - ' + naam });
  const bestandsnaam = (isEN ? 'Weekend_availability_notice_' : 'Kennisgeving_beschikbaarheid_') + D.veiligeNaam(naam) + '.pdf';
  if (p.alleenPdf) return { pdf: pdf.toString('base64'), bestandsnaam };

  if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const resendId = await M.verstuur({ to, subject, text, html, attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'beschikbaarheid' }] });
  const nu = D.stempel();
  const rij = await S.logBeschikbaarheid({ naam, to, adres, ingangsdatum, taal: isEN ? 'EN' : 'NL', onderbouwing: p.onderbouwing, rij: p.rij }, w, nu);
  await M.logMail({ door: g.email, bron: 'beschikbaarheid', type: 'kennisgeving-pdf', naar: to, naam, onderwerp: subject, taal: isEN ? 'EN' : 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'beschikbaarheid', veld: w.naam, rij, naam, nieuw: to, details: subject + ' (+PDF)' });
  return { bericht: 'Kennisgeving' + (isEN ? ' (EN)' : '') + ' + PDF verstuurd naar ' + to, rij, resendId };
});
