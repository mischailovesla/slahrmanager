// ============================================================
// POST /api/oproepaanbod-mail — fase 2d: aanbod vaste arbeidsomvang (art. 7:628a lid 5 BW)
// { to, naam, adres, winkel (code), sinds, periode, gemUren, aangebodenUren, ingangsdatum, reactiedatum, taal, preview?, alleenPdf? }
//  - brief OPROEP_NL/EN → PDF; mail oproepHtml/oproepPlain met persoonlijke uploadlink (soort 'oproep')
//  - log: hr_oproepaanbod (tab 'Oproepaanbod'), status 'Verstuurd op …'
// { actie:'reactie', rij, reactie: 'Aanvaard' | 'Afgewezen' | 'Geen reactie' }  → reactie vastleggen (HR)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const B = require('./_lib/brieftemplates');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const U = require('./_lib/uploads');

exports.handler = beveiligd('oproepaanbod-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  if (p.actie === 'reactie') {
    const rij = parseInt(p.rij, 10); if (!rij) throw new Error('Ongeldige rij');
    const reactie = ['Aanvaard', 'Afgewezen', 'Geen reactie'].includes(p.reactie) ? p.reactie : null; if (!reactie) throw new Error('Onbekende reactie');
    await S.zetOproepReactie(rij, reactie, g.email);
    await logActie({ door: g.email, actie: 'oproep-reactie', bron: 'oproepaanbod', rij, naam: p.naam || null, nieuw: reactie });
    return { bericht: 'Reactie vastgelegd: ' + reactie + (reactie === 'Aanvaard' ? ' — leg de nieuwe arbeidsomvang vast in Shiftbase en het contract.' : '') };
  }
  const naam = String(p.naam || '').trim(), to = String(p.to || '').trim(), adres = String(p.adres || '').trim();
  const isEN = String(p.taal || 'NL').toUpperCase() === 'EN';
  if (!p.winkel) throw new Error('Selecteer een winkel.');
  const w = C.WINKEL_BV_MAP[p.winkel]; if (!w) throw new Error('Onbekende winkel-afkorting.');
  const gem = Number(String(p.gemUren || '').replace(',', '.')), aang = Number(String(p.aangebodenUren || '').replace(',', '.'));
  if (!(aang > 0)) throw new Error('Vul het aantal aangeboden uren per week in.');
  if (gem > 0 && aang < gem - 0.05) throw new Error('Het aanbod (' + aang + ' u) mag niet lager zijn dan het gemiddelde (' + gem + ' u/week).');
  const uren = String(aang).replace('.', ',');
  const subject = (isEN ? 'Good news: an offer of fixed hours - ' : 'Goed nieuws: een aanbod voor vaste uren - ') + naam;
  const link = U.uploadLink('oproep', naam);
  const text = T.oproepPlain(naam, w.bv, uren, p.reactiedatum || '', isEN).replace(/{{UPLOADLINK}}/g, link), html = T.oproepHtml(naam, w.bv, uren, p.reactiedatum || '', isEN).replace(/{{UPLOADLINK}}/g, link);
  if (p.preview) return { subject, text, html };
  if (!naam) throw new Error('Vul de naam in.');
  if (!p.ingangsdatum || !p.reactiedatum) throw new Error('Vul ingangsdatum en reactiedatum in.');
  const tekst = B.vul(isEN ? B.OPROEP_EN : B.OPROEP_NL, {
    '{{Naam}}': naam, '{{Adres}}': adres, '{{BV}}': w.bv, '{{Winkel}}': w.naam, '{{Sinds}}': String(p.sinds || ''), '{{Periode}}': String(p.periode || ''),
    '{{GemUren}}': gem > 0 ? String(gem).replace('.', ',') : '-', '{{AangebodenUren}}': uren, '{{Ingangsdatum}}': String(p.ingangsdatum), '{{Reactiedatum}}': String(p.reactiedatum), '{{HuidigeDatum}}': D.briefDatum(isEN)
  });
  const pdf = await P.maakOpgemaakteBrief(tekst, { titel: (isEN ? 'Offer of fixed working hours' : 'Aanbod vaste arbeidsomvang') + ' - ' + naam });
  const bestandsnaam = (isEN ? 'Offer_fixed_hours_' : 'Aanbod_vaste_uren_') + D.veiligeNaam(naam) + '.pdf';
  if (p.alleenPdf) return { pdf: pdf.toString('base64'), bestandsnaam };
  if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const resendId = await M.verstuur({ to, subject, text, html, attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'oproepaanbod' }] });
  const nu = D.stempel();
  const rij = await S.logOproepaanbod({ naam, to, adres, sinds: p.sinds, gemUren: gem > 0 ? gem : '', aangebodenUren: aang, ingangsdatum: p.ingangsdatum, reactiedatum: p.reactiedatum, taal: isEN ? 'EN' : 'NL' }, w, nu);
  try { await require('./_lib/ondertekening').aanmaken({ soort: 'oproep', type: 'oproepaanbod', titel: (isEN ? 'Offer of fixed working hours' : 'Aanbod vaste arbeidsomvang') + ' - ' + naam, naam, email: to, rij, taal: isEN ? 'EN' : 'NL', pdf, door: g.email }); } catch (e) { console.warn('ondertekening aanmaken:', e.message); } // v0.26.0: digitaal kiezen + tekenen
  await M.logMail({ door: g.email, bron: 'oproepaanbod', type: 'aanbod-pdf', naar: to, naam, onderwerp: subject, taal: isEN ? 'EN' : 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'oproepaanbod', veld: w.naam, rij, naam, nieuw: to, details: subject + ' (' + uren + ' u/week, +PDF)' });
  return { bericht: 'Aanbod' + (isEN ? ' (EN)' : '') + ' + PDF verstuurd naar ' + to, rij, resendId };
});
