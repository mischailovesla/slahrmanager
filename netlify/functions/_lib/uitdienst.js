// ============================================================
// v0.19.4: "Bevestiging uitdiensttreding" — als een ontslagbevestiging, aanzegging of proeftijdbrief na 3 herinneringen
// nog niet ondertekend retour is. Een handtekening is juridisch niet nodig (opzegging is eenzijdig; een aanzegging hoeft
// alleen schriftelijk en op tijd verstuurd te zijn), dus we sluiten het dossier netjes af:
//   1. bevestiging aan de medewerker (NL boven, EN onder, PDF-bijlage, reply-to hr@) — niets te ondertekenen
//   2. seintje aan de salarisadministratie (alleen als er nog niets naar salaris is gegaan) zodat de eindafrekening niet blijft liggen
//   3. dossier archiveren met bron 'afgerond: uitdiensttreding bevestigd (niet ondertekend)'
// Automatisch alleen als hr_instellingen 'uitdienst_bevestiging_actief' aan staat (Uitstroom → Ontslag & aanzegging);
// handmatig per rij kan altijd (⋯ → Bevestig uitdiensttreding).
// ============================================================
const C = require('./config');
const T = require('./sjablonen');
const B = require('./brieftemplates');
const P = require('./pdf');
const M = require('./mail');
const I = require('./instellingen');
const { admin, logActie } = require('./auth');

const SLEUTEL = 'uitdienst_bevestiging_actief';
const REACTIE_DAGEN = 5;
const actief = async () => (await I.lees(SLEUTEL, false)) === true;
const esc = T.esc;

function briefDatum() {
  const f = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: 'long', year: 'numeric' }).formatToParts(new Date());
  const g = k => (f.find(x => x.type === k) || {}).value || '';
  return g('day') + ' ' + g('month') + ' ' + g('year');
}
const datumDeel = s => String(s || '').split(' ')[0];

// Welke brief ging er eerder uit? (uit hr_mails; rij.type kent alleen ontslag/aanzegging)
async function soortVan(r) {
  try {
    const { data } = await admin().from('hr_mails').select('type,tijdstip').eq('bron', 'ontslag').eq('rij', r.rij).order('tijdstip', { ascending: false }).limit(20);
    const t = (data || []).map(x => String(x.type || '')).find(x => !/herinnering/.test(x)) || '';
    if (/^aanzegging/.test(t)) return 'aanzegging';
    if (/^proeftijd/.test(t)) return 'proeftijd';
    if (/^ontslag/.test(t)) return 'ontslag';
  } catch (e) { /* valt terug op de rij */ }
  return r.type === 'aanzegging' ? 'aanzegging' : 'ontslag';
}

// Teksten. soort: 'ontslag' (medewerker zegde op) | 'aanzegging' (contract niet verlengd) | 'proeftijd'
function teksten(r, soort) {
  const naam = r.naam, voornaam = String(naam || '').split(' ')[0], bv = r.bedrijf || C.BEDRIJFSNAAM || 'SLA';
  const eind = r.einddatum || '?', verzonden = datumDeel(r.verzenddatum), opz = r.opzegging;
  const grond = {
    ontslag: { nl: (opz ? 'Je hebt op ' + opz + ' jouw arbeidsovereenkomst opgezegd' : 'Je hebt jouw arbeidsovereenkomst opgezegd') + '. Op ' + verzonden + ' hebben we dat schriftelijk bevestigd.', en: (opz ? 'On ' + opz + ' you gave notice of termination of your employment' : 'You gave notice of termination of your employment') + '. We confirmed this in writing on ' + verzonden + '.' },
    aanzegging: { nl: 'Op ' + verzonden + ' hebben we je laten weten dat jouw arbeidsovereenkomst niet wordt verlengd (aanzegging).', en: 'On ' + verzonden + ' we informed you that your fixed-term employment agreement will not be renewed (notice of non-renewal).' },
    proeftijd: { nl: 'Op ' + verzonden + ' hebben we het einde van jouw arbeidsovereenkomst tijdens de proeftijd schriftelijk bevestigd.', en: 'On ' + verzonden + ' we confirmed in writing that your employment ended during the probationary period.' }
  }[soort] || { nl: '', en: '' };
  const nl = {
    intro: grond.nl + ' We hebben die brief niet ondertekend terug ontvangen, maar dat is ook niet nodig.',
    eind: 'Je dienstverband met ' + bv + ' eindigt op ' + eind + '.',
    punten: ['Je laatste werkdag is uiterlijk ' + eind + '. Lever eventuele sleutels en spullen van SLA uiterlijk die dag in bij je Store Manager.', 'Je eindafrekening (het loon over je laatst gewerkte uren) ontvang je met je laatste loonstrook. Omdat je een all-in contract hebt, zijn vakantie-uren en vakantiegeld al in je uurloon inbegrepen; die worden niet apart uitbetaald.', 'Klopt er iets niet? Laat het ons binnen ' + REACTIE_DAGEN + ' dagen weten via hr@ilovesla.com. Horen we niets, dan gaan we ervan uit dat dit klopt.'],
    slot: 'Je hoeft niets te ondertekenen of terug te sturen. Bedankt voor je inzet bij SLA en veel succes!'
  };
  const en = {
    intro: grond.en + ' We have not received the signed letter back, but that is not required.',
    eind: 'Your employment with ' + bv + ' ends on ' + eind + '.',
    punten: ['Your last working day is ' + eind + ' at the latest. Please return any keys and SLA items to your Store Manager by then.', 'Your final settlement (wages for your last hours worked) will be paid with your last payslip. Because you have an all-in contract, holiday hours and holiday allowance are already included in your hourly wage and are not paid out separately.', 'Is anything incorrect? Let us know within ' + REACTIE_DAGEN + ' days at hr@ilovesla.com. If we do not hear from you, we will assume this is correct.'],
    slot: 'You do not need to sign or return anything. Thank you for your work at SLA and good luck!'
  };
  if (r.manager) { const AI = require('./allin'); nl.punten = nl.punten.map(AI.voorManager); en.punten = en.punten.map(AI.voorManager); } // managers: geen all-in
  const subject = 'Bevestiging uitdiensttreding / Confirmation of end of employment - ' + bv;
  const F = 'font-family:Arial,sans-serif;', P14 = F + 'font-size:14px;color:#333d3a;';
  const blok = (L, greet, kop) => '<p style="' + F + 'font-size:11px;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px">' + kop + '</p><p style="' + P14 + 'margin:0 0 14px">' + greet + ' ' + esc(voornaam) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 14px">' + esc(L.intro) + '</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #333d3a;' + F + 'font-size:14px;color:#333d3a;font-weight:700">' + esc(L.eind) + '</td></tr></table>'
    + '<ul style="' + P14 + 'line-height:1.7;margin:0 0 14px;padding-left:20px">' + L.punten.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><p style="' + P14 + 'line-height:1.7;margin:0 0 6px">' + esc(L.slot) + '</p>';
  const html = T.slaWrap(T.slaHead('#333d3a', 'HR &middot; Uitdiensttreding') + '<tr><td style="padding:32px 36px 28px">' + blok(nl, 'Beste', 'Nederlands')
    + '<hr style="border:none;border-top:1px solid #e8e2de;margin:24px 0">' + blok(en, 'Dear', 'English')
    + '<p style="' + P14 + 'margin:20px 0 0">Hartelijke groet / Warm regards,<br><br><strong>Het HR-team van SLA</strong><br>' + esc(bv) + '</p></td></tr>' + T.slaFoot());
  const plain = 'Beste ' + voornaam + ',\n\n' + nl.intro + '\n\n' + nl.eind + '\n\n' + nl.punten.map(x => '- ' + x).join('\n') + '\n\n' + nl.slot
    + '\n\n------------------------------\n\nDear ' + voornaam + ',\n\n' + en.intro + '\n\n' + en.eind + '\n\n' + en.punten.map(x => '- ' + x).join('\n') + '\n\n' + en.slot
    + '\n\nHartelijke groet / Warm regards,\nHet HR-team van SLA\n' + bv;
  const brief = '**BEVESTIGING UITDIENSTTREDING ' + bv + '**\n\n**Amsterdam, ' + briefDatum() + '**\n\n**' + naam + '**\n' + (r.adres ? '**' + r.adres + '**\n' : '') + '\n**Beste ' + naam + ',**\n\n'
    + nl.intro + '\n\n**' + nl.eind + '**\n\n' + nl.punten.join('\n\n') + '\n\n' + nl.slot + '\n\nMet vriendelijke groet,\n\n\n**' + bv + '**\n{{HANDTEKENING}}\n................................................\ni.o. ' + C.AFZENDER_NAAM
    + '\n\n\n**English**\n\n' + en.intro + '\n\n**' + en.eind + '**\n\n' + en.punten.join('\n\n') + '\n\n' + en.slot;
  return { subject, html, plain, brief, bv, eind };
}

async function pdfVan(r, soort) {
  const t = teksten(r, soort);
  return P.maakOpgemaakteBrief(t.brief, { titel: 'Bevestiging uitdiensttreding - ' + r.naam, handtekening: B.handtekening() });
}
const bestandsnaam = r => 'Bevestiging_uitdiensttreding_' + String(r.naam || 'medewerker').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '') + '.pdf';

// Salarisadministratie: einde dienstverband + bevestiging als bijlage
function salarisTekst(r, soort, t) {
  const soortTekst = { ontslag: 'Opzegging door de medewerker', aanzegging: 'Einde tijdelijk contract (niet verlengd, aanzegging)', proeftijd: 'Einde tijdens proeftijd' }[soort] || 'Einde dienstverband';
  const regels = [['Medewerker', r.naam], ['BV', t.bv], ['Soort', soortTekst], ['Datum opzegging', r.opzegging || '-'], ['Laatste dag / einddatum', t.eind], ['Brief verstuurd', datumDeel(r.verzenddatum) || '-']];
  const subject = 'Uitdiensttreding ' + r.naam + ' per ' + t.eind + ' - ' + t.bv;
  const F = 'font-family:Arial,sans-serif;', P14 = F + 'font-size:14px;color:#333d3a;';
  const html = T.slaWrap(T.slaHead('#2b6cb0', 'HR &middot; Uitdiensttreding doorgeven') + '<tr><td style="padding:32px 36px 28px"><p style="' + P14 + 'margin:0 0 14px">Beste,</p><p style="' + P14 + 'line-height:1.7;margin:0 0 14px">Graag de eindafrekening verwerken voor:</p><table cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse">' + regels.map(x => '<tr><td style="' + F + 'font-size:13px;color:#888078;padding:4px 16px 4px 0">' + esc(x[0]) + '</td><td style="' + F + 'font-size:13px;color:#333d3a;font-weight:700;padding:4px 0">' + esc(x[1]) + '</td></tr>').join('') + '</table><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">De medewerker heeft de brief niet ondertekend retour gestuurd (dat is niet nodig). In de bijlage de bevestiging van de uitdiensttreding die we de medewerker hebben gestuurd.</p><p style="' + P14 + 'margin:0">Met vriendelijke groet,<br><br><strong>SLA HR Team</strong></p></td></tr>' + T.slaFoot());
  const plain = 'Beste,\n\nGraag de eindafrekening verwerken voor:\n\n' + regels.map(x => x[0] + ': ' + x[1]).join('\n') + '\n\nDe medewerker heeft de brief niet ondertekend retour gestuurd (dat is niet nodig). In de bijlage de bevestiging van de uitdiensttreding die we de medewerker hebben gestuurd.\n\nMet vriendelijke groet,\nSLA HR Team';
  return { subject, html, plain };
}

// Alles in één keer: medewerker, salaris (alleen als er nog niets heen ging), archiveren. door = e-mail van HR of 'signalering'.
async function bevestig(r, door) {
  const S = require('./sheets'), D = require('./datum');
  if (!r.email || r.email.indexOf('@') === -1) throw new Error('Geen e-mailadres bij ' + r.naam + '.');
  if (r.ondertekend === 'Ja') throw new Error(r.naam + ' heeft al ondertekend.');
  r.manager = await require('./allin').isManager({ email: r.email, naam: r.naam });
  const soort = await soortVan(r), t = teksten(r, soort), pdf = await pdfVan(r, soort), bijlage = [{ filename: bestandsnaam(r), content: pdf.toString('base64') }];
  const id = await M.verstuur({ to: r.email, subject: t.subject, text: t.plain, html: t.html, attachments: bijlage, tags: [{ name: 'bron', value: 'ontslag' }, { name: 'type', value: 'bevestiging-uitdienst' }] });
  await M.logMail({ door: door || 'signalering', bron: 'ontslag', type: 'bevestiging-uitdienst', naar: r.email, naam: r.naam, onderwerp: t.subject, taal: 'NL/EN', rij: r.rij, resend_id: id });
  let salaris = 'al eerder gestuurd';
  if (!r.salaris) {
    const st = salarisTekst(r, soort, t);
    const sid = await M.verstuur({ to: C.SALARIS_EMAIL, subject: st.subject, text: st.plain, html: st.html, attachments: bijlage, tags: [{ name: 'bron', value: 'salaris' }, { name: 'type', value: 'ontslag' }] });
    await M.logMail({ door: door || 'signalering', bron: 'salaris', type: 'ontslag', naar: C.SALARIS_EMAIL, naam: r.naam, onderwerp: st.subject, taal: 'NL', rij: r.rij, resend_id: sid });
    try { await S.zetSalarisStempel('ontslag', r.rij, D.stempel()); } catch (e) { console.warn('salaris-stempel:', e.message); }
    salaris = 'verstuurd';
  }
  await S.archiveerRij(C.SHEETS.ontslag.id, 'afgerond: uitdiensttreding bevestigd (niet ondertekend)', r.rij, r.naam, door || 'signalering');
  await logActie({ door: door || 'signalering', actie: 'bevestiging-uitdienst', bron: 'ontslag', rij: r.rij, naam: r.naam, nieuw: r.email, details: 'Uitdiensttreding bevestigd zonder handtekening (' + soort + ', einddatum ' + t.eind + '); salaris: ' + salaris + '; dossier gearchiveerd' });
  return { naam: r.naam, soort, salaris, resendId: id };
}

module.exports = { SLEUTEL, actief, soortVan, teksten, pdfVan, salarisTekst, bevestig, bestandsnaam, REACTIE_DAGEN };
