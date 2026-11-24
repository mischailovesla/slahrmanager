// ============================================================
// v0.55.0: Werkgeversverklaring vanuit het medewerkersdossier
// GET  /api/werkgeversverklaring?id=&naam=&email=   -> { salarisInzage, voorstel (uit Shiftbase + evt. eerder Contract op maat), afzender }
// POST { actie:'controle', ...formulier }            -> { fouten, let_op, samenvatting, voorbeeld }
// POST { actie:'pdf', ...formulier }                 -> { pdf (base64), bestandsnaam } — verstuurt en logt niets (wel in hr_acties)
// POST { actie:'versturen', email, ...formulier }    -> mail (NL/EN) met PDF aan de medewerker + log in hr_brieven (categorie
//      'Werkgeversverklaring', zónder salaris) + hr_mails + hr_acties
// Salaris is gevoelig: alleen wie salarisinzage heeft (Jop, Ymke, Mischa) kan een verklaring opstellen.
// Tekst en controles: _lib/werkgeversverklaring.js
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const P = require('./_lib/pdf');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const SB = require('./_lib/shiftbase');
const WV = require('./_lib/werkgeversverklaring');
const { normNaam } = require('./_lib/util');

const F = 'font-family:Arial,sans-serif;', P14 = F + 'font-size:14px;color:#333d3a;';
function mailHtml(naam, en) {
  const vn = T.esc(String(naam).trim().split(/\s+/)[0] || naam);
  const k = en ? { head: 'Your employer\'s statement', hi: 'Dear ', t1: 'As requested, you will find your signed employer\'s statement attached to this email.', t2: 'Is anything not right? Reply to this email or mail us at', bye: 'Kind regards,' }
    : { head: 'Je werkgeversverklaring', hi: 'Beste ', t1: 'Zoals gevraagd vind je in de bijlage je ondertekende werkgeversverklaring.', t2: 'Klopt er iets niet? Reageer op deze mail of mail ons op', bye: 'Hartelijke groet,' };
  return T.slaWrap(T.slaHead('#009f4b', k.head) + '<tr><td style="padding:32px 36px 28px">'
    + '<p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">' + k.hi + vn + ',</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 16px">' + k.t1 + '</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 6px">' + k.t2 + ' <a href="mailto:' + C.HR_EMAIL + '" style="color:#009f4b">' + C.HR_EMAIL + '</a>.</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:18px 0 0">' + k.bye + '<br><strong>SLA HR Team</strong></p></td></tr>' + T.slaFoot());
}
function mailPlain(naam, en) {
  const vn = String(naam).trim().split(/\s+/)[0] || naam;
  return en ? 'Dear ' + vn + ',\n\nAs requested, you will find your signed employer\'s statement attached to this email.\n\nIs anything not right? Reply to this email or mail us at ' + C.HR_EMAIL + '.\n\nKind regards,\nSLA HR Team'
    : 'Beste ' + vn + ',\n\nZoals gevraagd vind je in de bijlage je ondertekende werkgeversverklaring.\n\nKlopt er iets niet? Reageer op deze mail of mail ons op ' + C.HR_EMAIL + '.\n\nHartelijke groet,\nSLA HR Team';
}

// Voorstel uit Shiftbase (functie, BV, start, einde, type, uren) + salaris uit het laatste Contract op maat (alleen met salarisinzage)
async function voorstel(qs, magZien) {
  const med = await SB.getMedewerkers(false).catch(() => []);
  let m = null;
  if (qs.id) m = med.find(x => x.id === String(qs.id)) || null;
  if (!m && qs.email) m = med.find(x => x.email.toLowerCase() === String(qs.email).toLowerCase()) || null;
  if (!m && qs.naam) m = med.find(x => normNaam(x.naam) === normNaam(qs.naam)) || null;
  const naam = (m && m.naam) || qs.naam || '', email = ((m && m.email) || qs.email || '').toLowerCase();
  const iso = s => { const d = WV.parseDatum(s); return d ? d.toLocaleDateString('sv-SE') : ''; };
  const winkel = m && m.winkelCode && C.WINKEL_BV_MAP[m.winkelCode] ? C.WINKEL_BV_MAP[m.winkelCode] : null;
  const v = {
    naam, email, functie: (m && m.functie) || '', bv: (m && m.winkelBv) || (winkel && winkel.bv) || '', bvAdres: winkel ? winkel.adres : '',
    startdatum: m ? iso(m.indienst) : '', einddatum: m ? iso(m.contractEinde) : '', soort: m && m.contractEinde ? 'bepaald' : 'onbepaald',
    vorm: m && WV.isOproepType(m.contractType) ? 'oproep' : 'vast', uren: m && m.contractUren ? String(m.contractUren) : '',
    loonsoort: m && WV.isOproepType(m.contractType) ? 'uur' : 'maand', bedrag: '', toeslag: '8', proeftijd: '', doel: '', taal: 'EN',
    contractType: (m && m.contractType) || '', gevonden: !!m
  };
  v.bronSalaris = '';
  if (magZien) {
    try {
      const CM = require('./_lib/contractmaatwerk');
      const nn = normNaam(naam), brieven = (await S.getBrieven()).filter(r => r.categorie === 'Contract op maat' && ((email && String(r.email || '').toLowerCase() === email) || (nn && normNaam(r.naam) === nn)));
      const r = brieven[0];   // nieuwste bovenaan
      if (r) {
        const f = CM.terugLezen(r.tekst), vandaag = new Date().toLocaleDateString('sv-SE');
        const fase = f.fasering && f.fasering.aan ? (f.fasering.fase1 && f.fasering.fase1.tot && vandaag > f.fasering.fase1.tot ? f.fasering.fase2 : f.fasering.fase1) : { vorm: f.vorm, uren: f.uren, loon: f.loonsoort, bedrag: f.bedrag };
        if (fase && fase.bedrag) { v.bedrag = String(fase.bedrag); v.loonsoort = fase.loon === 'uur' ? 'uur' : 'maand'; if (fase.vorm === 'vast' && fase.uren) v.uren = String(fase.uren); v.bronSalaris = 'Contract op maat van ' + (r.verzenddatum || '?') + ' (controleer of dit nog klopt)'; }
        if (f.proeftijd && f.proeftijd !== '0') v.proeftijd = String(f.proeftijd);
      }
    } catch (e) { console.warn('voorstel salaris:', e.message); }
  }
  return v;
}

exports.handler = beveiligd('werkgeversverklaring', async (event, g) => {
  const SI = require('./_lib/salarisinzage'), magZien = await SI.mag(g.email);
  const H = require('./_lib/handtekening');
  const afz = await H.van(g.email, g.naam && g.naam !== g.email ? g.naam : '');
  if (event.httpMethod !== 'POST') {
    const v = await voorstel(event.queryStringParameters || {}, magZien);
    return { salarisInzage: magZien, voorstel: v, afzender: { naam: afz.naam, functie: afz.functie, handtekening: afz.ingesteld } };
  }
  await SI.eis(g.email, 'Een werkgeversverklaring');
  const p = body(event), actie = String(p.actie || 'controle');
  p.afzenderNaam = afz.naam || g.naam || ''; p.afzenderFunctie = afz.functie || '';
  const b = WV.bouw(p);
  if (actie === 'controle') return { fouten: b.fouten, let_op: b.let_op, samenvatting: b.samenvatting, voorbeeld: b.tekst.replace('{{HANDTEKENING}}\n', ''), handtekening: afz.ingesteld };
  if (b.fouten.length) throw new Error(b.fouten.join(' '));
  // Zonder ingestelde handtekening: ruimte laten om te printen en met de hand te tekenen
  const tekst = afz.png ? b.tekst : b.tekst.replace('{{HANDTEKENING}}', '\n\n\n');
  const pdf = await P.maakOpgemaakteBrief(tekst, { titel: b.titel, handtekening: afz.png || null });
  const bestandsnaam = (b.c.en ? 'Employers_statement_' : 'Werkgeversverklaring_') + D.veiligeNaam(b.c.naam) + '.pdf';
  const zonderSalaris = b.samenvatting.replace(/ · € [^·]*· /, ' · ');   // log/actie zonder bedrag
  if (actie === 'pdf') {
    await logActie({ door: g.email, actie: 'document', bron: 'werkgeversverklaring', veld: 'pdf', naam: b.c.naam, details: 'Werkgeversverklaring (PDF gedownload): ' + zonderSalaris });
    return { pdf: pdf.toString('base64'), bestandsnaam, let_op: b.let_op };
  }
  if (actie !== 'versturen') throw new Error('Onbekende actie: ' + actie);

  const to = String(p.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Vul een geldig e-mailadres van de medewerker in.');
  const subject = b.c.en ? 'Your employer\'s statement - ' + b.c.bv : 'Je werkgeversverklaring - ' + b.c.bv;
  const resendId = await M.verstuur({ to, subject, text: mailPlain(b.c.naam, b.c.en), html: mailHtml(b.c.naam, b.c.en),
    attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'werkgeversverklaring' }] });
  const nu = D.stempel();
  let rij = 0;
  try { rij = await S.logBrief({ naam: b.c.naam, email: to, bv: b.c.bv, categorie: WV.CATEGORIE, onderwerp: b.titel, tekst: WV.redigeer(tekst), metPdf: true }, nu); }
  catch (e) { console.warn('logBrief mislukt:', e.message); }
  await M.logMail({ door: g.email, bron: 'werkgeversverklaring', type: 'werkgeversverklaring', naar: to, naam: b.c.naam, onderwerp: subject, taal: b.c.en ? 'EN' : 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'werkgeversverklaring', veld: 'werkgeversverklaring', rij, naam: b.c.naam, nieuw: to, details: zonderSalaris });
  return { bericht: 'Werkgeversverklaring verstuurd naar ' + to + (rij ? '' : ' (let op: loggen in het dossier is mislukt)'), rij, let_op: b.let_op };
});
