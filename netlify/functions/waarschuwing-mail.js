// ============================================================
// POST /api/waarschuwing-mail  (port van stuurWaarschuwingMetPDF, waarschuwing.gs v1.2)
// { to, naam, adres, winkel (code), datumOvertreding, regelIds[], toelichting, taal, rij?, preview?, alleenPdf? }
//  - brief uit _lib/brieftemplates.js (WRS_NL/EN) → PDF met pdf-lib
//  - mail SLA-huisstijl (wrsHtml/wrsPlain), PDF als bijlage
//  - log: tab 'Waarschuwingen' (A..K), status J 'Verstuurd op …' (#f4cccc)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const B = require('./_lib/brieftemplates');
const C = require('./_lib/config');
const D = require('./_lib/datum');

exports.handler = beveiligd('waarschuwing-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim(), to = String(p.to || '').trim(), adres = String(p.adres || '').trim();
  const isEN = String(p.taal || 'NL').toUpperCase() === 'EN';
  const w = C.WINKEL_BV_MAP[p.winkel];
  if (!p.winkel) throw new Error('Selecteer een winkel.');
  if (!w) throw new Error('Onbekende winkel-afkorting.');
  const regels = T.regelsById(p.regelIds);
  const bv = w.bv;
  const subject = (isEN ? 'Official written warning - ' : 'Officiele schriftelijke waarschuwing - ') + naam;
  const text = T.wrsPlain(naam, bv, regels, isEN), html = T.wrsHtml(naam, bv, regels, p.datumOvertreding || '', isEN);
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Vul de naam in.');
  if (!regels.length) throw new Error('Vink minimaal 1 overtreden regel aan.');

  const tekst = B.vul(isEN ? B.WRS_EN : B.WRS_NL, {
    '{{Naam}}': naam, '{{Adres}}': adres, '{{BV}}': bv, '{{Winkel}}': w.naam, '{{DatumOvertreding}}': String(p.datumOvertreding || ''),
    '{{Overtredingen}}': '• ' + regels.join('\n• '), '{{Toelichting}}': String(p.toelichting || '').trim() || '-', '{{HuidigeDatum}}': D.briefDatum(isEN)
  });
  const pdf = await P.maakOpgemaakteBrief(tekst, { titel: (isEN ? 'Official written warning' : 'Officiele waarschuwing') + ' - ' + naam });
  const bestandsnaam = (isEN ? 'Official_warning_' : 'Officiele_waarschuwing_') + D.veiligeNaam(naam) + '.pdf';
  if (p.alleenPdf) return { pdf: pdf.toString('base64'), bestandsnaam };

  if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const resendId = await M.verstuur({ to, subject, text, html, attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'waarschuwing' }] });
  const nu = D.stempel();
  const rij = await S.logWaarschuwing({ naam, to, adres, datumOvertreding: p.datumOvertreding, toelichting: p.toelichting, taal: isEN ? 'EN' : 'NL', rij: p.rij }, w, regels, nu);
  await M.logMail({ door: g.email, bron: 'waarschuwing', type: 'waarschuwing-pdf', naar: to, naam, onderwerp: subject, taal: isEN ? 'EN' : 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'waarschuwing', veld: regels.length + ' regel(s)', rij, naam, nieuw: to, details: subject + ' (+PDF)' });
  return { bericht: 'Officiele waarschuwing' + (isEN ? ' (EN)' : '') + ' + PDF verstuurd naar ' + to, rij, resendId };
});
