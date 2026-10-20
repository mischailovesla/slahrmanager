// ============================================================
// POST /api/oosv-mail  (port van stuurOoSV, OoSV.gs v1.0 — ontslag op staande voet)
// { naam, email, aanhef ('mevrouw'|'heer'|'heer/mevrouw'), bv, adres, datumConstatering, wederhoor?, gronden (≥20 tekens), preview?, alleenPdf? }
//  - brief OOSV (+ OOSV_WEDERHOOR-blok) → PDF; mail oosvHtml/oosvPlain aan medewerker, CC hr@ilovesla.com
//  - log in de sommatie-sheet: type 'Ontslag op Staande Voet', E datumConstatering, H 'OoSV verstuurd op …' (#f4cccc)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const B = require('./_lib/brieftemplates');
const C = require('./_lib/config');
const D = require('./_lib/datum');

exports.handler = beveiligd('oosv-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim(), email = String(p.email || '').trim(), bv = String(p.bv || '').trim() || C.BEDRIJFSNAAM;
  const subject = 'Ontslag op staande voet - ' + bv;
  const text = T.oosvPlain(naam, bv), html = T.oosvHtml(naam, bv);
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Vul de naam in.');
  const gronden = String(p.gronden || '').trim();
  if (gronden.length < 20) throw new Error('Omschrijf de dringende reden(en) concreet (minimaal een paar zinnen) - dit is de juridische kern van de brief.');

  const vandaag = D.kort();
  const wederhoor = String(p.wederhoor || '').trim();
  const tekst = B.vul(B.OOSV, {
    '{{BV}}': bv, '{{Naam}}': naam, '{{Adres}}': String(p.adres || '').trim(), '{{Aanhef}}': String(p.aanhef || 'heer/mevrouw').trim(),
    '{{Datum}}': vandaag, '{{DatumConstatering}}': String(p.datumConstatering || '').trim() || vandaag, '{{Gronden}}': gronden.split('\n').map(l => l.trim()).filter(Boolean).join('*\n*'),
    '{{Wederhoor}}': wederhoor ? B.OOSV_WEDERHOOR.replace('{{Wederhoor}}', wederhoor) : ''
  });
  const pdf = await P.maakOpgemaakteBrief(await require('./_lib/allin').pasAan(tekst, { email, naam }), { titel: 'Ontslag op staande voet - ' + naam });
  const bestandsnaam = 'Ontslag op staande voet - ' + naam.replace(/[\\/:*?"<>|]/g, '') + ' - ' + vandaag + '.pdf';
  if (p.alleenPdf) return { pdf: pdf.toString('base64'), bestandsnaam };

  if (!email || email.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const resendId = await M.verstuur({ to: email, cc: C.HR_EMAIL, subject, text, html, attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'oosv' }] });
  const nu = D.stempel();
  const rij = await S.logSommatie({ naam, email, bv, type: 'Ontslag op Staande Voet', datumAfwezig: String(p.datumConstatering || '').trim(), datumAfspraak: '', eigenTekst: '' }, nu, '#f4cccc', 'OoSV verstuurd op ' + nu);
  await M.logMail({ door: g.email, bron: 'oosv', type: 'oosv-pdf', naar: email, naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'oosv', veld: 'Ontslag op staande voet', rij, naam, nieuw: email, details: subject + ' (+PDF, cc ' + C.HR_EMAIL + ')' });
  return { bericht: 'OoSV-brief verstuurd naar ' + email + ' (kopie aan ' + C.HR_EMAIL + '). Verstuur de brief vandaag ook aangetekend per post.', rij, resendId };
});
