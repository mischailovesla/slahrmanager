// ============================================================
// SLA-huisstijl mailsjablonen - port van slaWrap/slaHead/slaFoot/slaStep,
// buildLoonHtml en buildLoonHerHtml uit Code.gs, plus de plain-text
// templates uit de dashboard-UI (T.loonheffing). Zelfde teksten, zelfde kleuren.
// ============================================================
const C = require('./config');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = 'font-family:Arial,sans-serif;';

function slaWrap(c) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f8f3f0;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f3f0;padding:28px 0"><tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">' + c + '</table></td></tr></table></body></html>';
}
function slaHead(k, s) {
  return '<tr><td style="background:' + k + ';padding:28px 36px"><div style="font-size:26px;font-weight:700;color:#fff;' + F + '">SLA</div><div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:3px;letter-spacing:2px;text-transform:uppercase;' + F + '">' + s + '</div></td></tr>';
}
function slaFoot() {
  return '<tr><td style="background:#333d3a;padding:20px 36px"><p style="' + F + 'font-size:11px;color:rgba(255,255,255,.5);margin:0">SLA &middot; the good food bar &middot; <a href="https://www.ilovesla.com" style="color:#009f4b;text-decoration:none">ilovesla.com</a></p></td></tr>';
}
function slaStep(n, t, l, tx, isEN) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr><td style="padding:14px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:11px;font-weight:700;color:#009f4b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.5px">' + (isEN ? 'Step ' : 'Stap ') + n + '</p><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 7px">' + t + '</p><a href="' + l + '" style="' + F + 'font-size:12px;color:#009f4b;text-decoration:none;font-weight:700">&rarr; ' + tx + '</a></td></tr></table>';
}

// Persoonlijke upload-link (prefillLoonUrl in Code.gs)
function prefillLoonUrl(naam) {
  if (!naam) return C.UPLOAD_LOON;
  return C.UPLOAD_LOON.split('?')[0] + '?usp=pp_url&' + C.PREFILL_LOON_ENTRY + '=' + encodeURIComponent(String(naam).trim());
}
function prefillOntslagUrl(naam) {
  if (!naam) return C.UPLOAD_ONTSLAG;
  return C.UPLOAD_ONTSLAG.split('?')[0] + '?usp=pp_url&' + C.PREFILL_ONTSLAG_ENTRY + '=' + encodeURIComponent(String(naam).trim());
}
// Generieke upload-links in een (door HR bewerkte) tekst vervangen door de persoonlijke
function personaliseerUploadLinks(body, naam) {
  if (!body || !naam) return body;
  return String(body).split(C.UPLOAD_LOON).join(prefillLoonUrl(naam)).split(C.UPLOAD_ONTSLAG).join(prefillOntslagUrl(naam));
}

// --- Loonheffing: uitnodiging ------------------------------------------------
function loonUitnodigingHtml(naam, dl, isEN) {
  const n = esc(naam), d = esc(dl);
  const L = isEN ? {
    head: 'HR &middot; Employment registration', greet: 'Dear ', intro: 'Welcome to SLA! We need two completed forms from you.',
    s1: 'Download and fill in the employment registration form', s1b: 'Download form',
    s2: 'Download and sign the payroll tax statement (loonheffingsverklaring)', s2b: 'Download payroll tax form',
    s3: 'Upload both completed forms', s3b: 'Upload forms',
    dlLbl: 'Deadline:', dlTxt: 'Please return by ' + d + '.',
    warn: '<strong>Important:</strong> Without your payroll tax statement we are legally required to apply the anonymous tax rate (52%).',
    q: 'Questions?', bye: 'We look forward to welcoming you!', sign: 'Kind regards,'
  } : {
    head: 'HR &middot; Indiensttreding', greet: 'Beste ', intro: 'Welkom bij SLA! We hebben twee ingevulde formulieren van je nodig.',
    s1: 'Download en vul het indiensttredingsformulier in', s1b: 'Download formulier',
    s2: 'Download en onderteken de loonheffingsverklaring', s2b: 'Download loonheffingsverklaring',
    s3: 'Upload beide ingevulde formulieren', s3b: 'Upload formulieren',
    dlLbl: 'Deadline:', dlTxt: 'Uiterlijk op ' + d + ' ontvangen.',
    warn: '<strong>Let op:</strong> Zonder loonheffingsverklaring zijn we wettelijk verplicht het anoniementarief (52%) toe te passen.',
    q: 'Vragen?', bye: 'We kijken uit naar je komst!', sign: 'Met vriendelijke groet,'
  };
  const db = dl ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr><td style="padding:12px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:12px;color:#7a5c00"><strong>' + L.dlLbl + '</strong> ' + L.dlTxt + '</td></tr></table>' : '';
  return slaWrap(slaHead('#009f4b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + n + ',</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">' + L.intro + '</p>'
    + slaStep(1, L.s1, C.INDIENSTLINK, L.s1b, isEN) + slaStep(2, L.s2, isEN ? C.LB_FORMULIER_EN : C.LB_FORMULIER_NL, L.s2b, isEN) + slaStep(3, L.s3, prefillLoonUrl(naam), L.s3b, isEN) + db
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr><td style="padding:12px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:12px;color:#7a5c00;line-height:1.5">' + L.warn + '</td></tr></table>'
    + '<p style="' + F + 'font-size:14px;color:#333d3a;margin:0 0 6px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p><p style="' + F + 'font-size:14px;color:#333d3a;margin:0 0 20px">' + L.bye + '</p><p style="' + F + 'font-size:14px;color:#333d3a;margin:0">' + L.sign + '<br><strong>SLA HR Team</strong></p></td></tr>' + slaFoot());
}
function loonUitnodigingPlain(naam, dl, isEN) {
  const n = naam || (isEN ? '[Name]' : '[Naam]');
  return isEN
    ? 'Dear ' + n + ',\n\nWelcome to SLA!\n\nStep 1:\n' + C.INDIENSTLINK + '\n\nStep 2:\n' + C.LB_FORMULIER_EN + '\n\nStep 3:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Deadline: ' + dl + '\n\n' : '') + 'Without payroll tax form 52% rate applies.\n\nQuestions? hr@ilovesla.com\n\nKind regards,\nSLA HR Team'
    : 'Beste ' + n + ',\n\nWelkom bij SLA!\n\nStap 1:\n' + C.INDIENSTLINK + '\n\nStap 2:\n' + C.LB_FORMULIER_NL + '\n\nStap 3:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Uiterlijk ' + dl + '.\n\n' : '') + 'Zonder loonheffingsverklaring geldt het anoniementarief (52%).\n\nVragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team';
}

// --- Loonheffing: herinnering (buildLoonHerHtml) --------------------------------
function loonHerinneringHtml(naam, dl, isEN) {
  const n = esc(naam), d = esc(dl);
  const L = isEN ? { head: 'HR &middot; Reminder', greet: 'Dear ', body: 'We have not yet received your signed wage tax form (loonheffingsverklaring). Please upload it as soon as possible.', dl: 'Deadline: ', btn: '&rarr; Upload form', warn: '<strong>Important:</strong> Without your wage tax form we are legally required to apply the anonymous tax rate (52%).', q: 'Questions?', sign: 'Kind regards,' }
    : { head: 'HR &middot; Herinnering', greet: 'Beste ', body: 'We hebben jouw ondertekende loonheffingsverklaring nog niet ontvangen. Upload deze zo spoedig mogelijk.', dl: 'Deadline: ', btn: '&rarr; Upload formulier', warn: '<strong>Let op:</strong> Zonder loonheffingsverklaring zijn we wettelijk verplicht het anoniementarief (52%) toe te passen.', q: 'Vragen?', sign: 'Met vriendelijke groet,' };
  const db = dl ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr><td style="padding:12px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:13px;color:#7a5c00"><strong>' + L.dl + '</strong>' + d + '</td></tr></table>' : '';
  return slaWrap(slaHead('#f5a623', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + n + ',</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 20px">' + L.body + '</p>' + db
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><a href="' + prefillLoonUrl(naam) + '" style="display:inline-block;background:#009f4b;color:#fff;' + F + 'font-size:12px;font-weight:700;padding:10px 20px;border-radius:6px;text-decoration:none">' + L.btn + '</a></td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr><td style="padding:12px 16px;background:#fdecea;border-radius:8px;border-left:4px solid #c0392b;' + F + 'font-size:12px;color:#7a1f15;line-height:1.5">' + L.warn + '</td></tr></table>'
    + '<p style="' + F + 'font-size:14px;color:#333d3a;margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p><p style="' + F + 'font-size:14px;color:#333d3a;margin:0">' + L.sign + '<br><br><strong>SLA HR Team</strong></p></td></tr>' + slaFoot());
}
function loonHerinneringPlain(naam, dl, isEN) {
  const n = naam || (isEN ? '[Name]' : '[Naam]');
  return isEN
    ? 'Dear ' + n + ',\n\nNot yet received. Upload via:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Deadline: ' + dl + '\n\n' : '') + 'Questions? hr@ilovesla.com\n\nKind regards,\nSLA HR Team'
    : 'Beste ' + n + ',\n\nNog niet ontvangen. Upload via:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Uiterlijk ' + dl + '.\n\n' : '') + 'Vragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team';
}

// Templates zoals de UI ze kent (label, onderwerp, body-functie)
const LOON_TEMPLATES = [
  { key: 'uitnodiging-nl', label: 'Uitnodiging NL', taal: 'NL', type: 'uitnodiging', subject: 'Actie vereist: Jouw indiensttredingsformulieren - SLA' },
  { key: 'uitnodiging-en', label: 'Invitation EN', taal: 'EN', type: 'uitnodiging', subject: 'Action required: Your employment registration forms - SLA' },
  { key: 'herinnering-nl', label: 'Herinnering NL', taal: 'NL', type: 'herinnering', subject: 'Herinnering: loonheffingsverklaring nog niet ontvangen' },
  { key: 'herinnering-en', label: 'Reminder EN', taal: 'EN', type: 'herinnering', subject: 'Reminder: wage tax form not yet received' }
];
function loonPlain(type, naam, dl, isEN) { return type === 'herinnering' ? loonHerinneringPlain(naam, dl, isEN) : loonUitnodigingPlain(naam, dl, isEN); }
function loonHtml(type, naam, dl, isEN) { return type === 'herinnering' ? loonHerinneringHtml(naam, dl, isEN) : loonUitnodigingHtml(naam, dl, isEN); }

// --- Vrije brieven (port van VrijeBrief.gs v1.2) ------------------------------
// Vrije tekst -> huisstijl-alinea's: dubbele enter = alinea, enkele enter = regeleinde,
// regels die met "- " beginnen = lijst (vbTekstNaarHtml_)
function tekstNaarHtml(txt) {
  const s = F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 14px';
  let html = '';
  String(txt || '').replace(/\r/g, '').split(/\n{2,}/).forEach(b => {
    b = b.trim(); if (!b) return;
    const regels = b.split('\n');
    const isLijst = regels.every(r => /^\s*-\s+/.test(r) || !r.trim());
    if (isLijst) {
      html += '<ul style="margin:0 0 14px;padding-left:20px">';
      regels.forEach(r => { r = r.replace(/^\s*-\s+/, '').trim(); if (r) html += '<li style="' + s + ';margin:0 0 6px">' + esc(r) + '</li>'; });
      html += '</ul>';
    } else html += '<p style="' + s + '">' + regels.map(esc).join('<br>') + '</p>';
  });
  return html;
}
function briefHtml(p, bv, categorie) {
  let body = '<p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Beste ' + esc(p.naam) + ',</p>';
  body += tekstNaarHtml(p.tekst);
  body += '<p style="' + F + 'font-size:14px;color:#333d3a;margin:24px 0 6px">Met vriendelijke groet,<br><strong>' + esc(C.AFZENDER_NAAM) + '</strong><br>' + esc(bv) + '</p>';
  return slaWrap(slaHead('#333d3a', 'SLA HR &middot; ' + esc(categorie)) + '<tr><td style="padding:32px 36px 28px">' + body + '</td></tr>' + slaFoot());
}
function briefPlain(p, bv) {
  return 'Beste ' + p.naam + ',\n\n' + String(p.tekst || '').trim() + '\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + bv;
}
// Startpunten voor de Brief-modal; {NAAM} {BV} {DATUM} worden in de browser live vervangen
const BRIEF_TEMPLATES = [
  { key: 'leeg', label: 'Leeg (zelf schrijven)', subject: '', hint: '', body: '' },
  { key: 'ontslagname', label: 'Bevestiging ontslagname per direct', subject: 'Bevestiging opzegging dienstverband - {NAAM}',
    hint: 'Voor de situatie dat een medewerker mondeling/telefonisch per direct opzegt en niet op de dienst verschijnt. Juridisch belangrijk: een opzegging door de medewerker moet duidelijk en ondubbelzinnig zijn - vraag daarom altijd om schriftelijke bevestiging en bied ruimte om erop terug te komen (onderzoeksplicht werkgever).',
    body: 'Op {DATUM} heb je bij jouw Store Manager gemeld dat je niet op je ingeplande dienst verschijnt en dat je per direct ontslag neemt.\n\n' +
      'Met deze brief bevestigen wij de ontvangst van jouw mondelinge opzegging. Omdat een opzegging duidelijk en ondubbelzinnig moet zijn, vragen we je om jouw opzegging binnen 5 werkdagen schriftelijk te bevestigen via hr@ilovesla.com, met vermelding van de door jou gewenste einddatum.\n\n' +
      'Mocht je van gedachten zijn veranderd of is deze beslissing in een emotioneel moment genomen, neem dan zo snel mogelijk contact op met je Store Manager of met HR - dan kijken we samen naar de situatie.\n\n' +
      'Zonder tegenbericht gaan wij uit van beeindiging van jouw dienstverband bij {BV}. De niet-gewerkte dienst van {DATUM} wordt geregistreerd als ongeoorloofd verzuim en wordt niet uitbetaald.\n\n' +
      'Verder wijzen we je op het volgende:\n' +
      '- De eindafrekening (loon, vakantiegeld en openstaande vakantie-uren) ontvang je bij de eerstvolgende loonrun.\n' +
      '- Bedrijfseigendommen zoals kleding, sleutels en pas lever je in bij je Store Manager.\n' +
      '- Door zelf op te zeggen heb je in de regel geen recht op een WW-uitkering.' },
  { key: 'afspraken', label: 'Bevestiging gemaakte afspraken', subject: 'Bevestiging gemaakte afspraken - {NAAM}',
    hint: 'Voor het schriftelijk vastleggen van een gesprek (verbetertraject, gedragsafspraken, urenwijziging etc.). Vul de afspraken zelf in.',
    body: 'Op {DATUM} hebben wij met elkaar gesproken. Met deze brief bevestigen we de afspraken die we daarin hebben gemaakt:\n\n' +
      '- [afspraak 1]\n- [afspraak 2]\n- [afspraak 3]\n\n' +
      'We vertrouwen erop dat we hiermee samen tot een goede oplossing komen. Heb je vragen over de inhoud van deze brief, neem dan contact op met je Store Manager of met HR via hr@ilovesla.com.' },
  { key: 'mededeling', label: 'Algemene mededeling', subject: 'Mededeling - {NAAM}', hint: '',
    body: '[Typ hier je mededeling.]\n\nHeb je vragen naar aanleiding van deze brief, neem dan contact op via hr@ilovesla.com.' }
];

// --- Ontslag & aanzegging (buildOntslagHtml / buildOntslagHerHtml / buildAanzeggingHtml) ---
const P14 = F + 'font-size:14px;color:#333d3a;';
const knop = (url, txt) => '<a href="' + url + '" style="display:inline-block;background:#009f4b;color:#fff;' + F + 'font-size:12px;font-weight:700;padding:10px 20px;border-radius:6px;text-decoration:none">' + txt + '</a>';
const groet = (tekst, bv) => '<p style="' + P14 + 'margin:0">' + tekst + '<br><br><strong>' + esc(C.AFZENDER_NAAM) + '</strong><br>' + esc(bv) + '</p>';
function ontslagHtml(naam, bv) {
  return slaWrap(slaHead('#333d3a', 'HR &middot; Uitdiensttreding') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Beste ' + esc(naam) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">Naar aanleiding van jouw opzegging sturen wij je hierbij de offici&euml;le bevestiging als PDF bijlage.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #333d3a"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">Onderteken de bijlage en upload via:</p>' + knop(prefillOntslagUrl(naam), '&rarr; Upload ondertekend document') + '</td></tr></table><p style="' + P14 + 'margin:0 0 20px">Vragen? <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p>' + groet('Met vriendelijke groet,', bv) + '</td></tr>' + slaFoot());
}
function ontslagHerHtml(naam, bv) {
  return slaWrap(slaHead('#333d3a', 'HR &middot; Herinnering') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Beste ' + esc(naam) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">We hebben het ondertekende HR-document nog niet retour ontvangen. Upload zo spoedig mogelijk:</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px">' + knop(prefillOntslagUrl(naam), '&rarr; Upload ondertekend document') + '</td></tr></table>' + groet('Met vriendelijke groet,', bv) + '</td></tr>' + slaFoot());
}
function aanzeggingHtml(naam, bv, einddatum, isEN) {
  const b = esc(bv), e = esc(einddatum);
  const L = isEN ? {
    head: 'HR &middot; Notice of non-renewal', greet: 'Dear ',
    intro: 'Attached you will find the official notice that your employment agreement with <strong>' + b + '</strong>' + (e ? ' will end by operation of law on <strong>' + e + '</strong>' : '') + ' and will not be renewed.',
    body: 'Until that date we expect you to complete your tasks properly and ensure a good handover. The attached letter contains further information about the final settlement, returning company property and applying for unemployment benefits.',
    cta: 'Please sign for receipt and upload via:', btn: '&rarr; Upload signed document', q: 'Questions?', sign: 'Kind regards,'
  } : {
    head: 'HR &middot; Aanzegging', greet: 'Beste ',
    intro: 'In de bijlage tref je de officiele aanzegging dat jouw arbeidsovereenkomst met <strong>' + b + '</strong>' + (e ? ' op <strong>' + e + '</strong>' : '') + ' van rechtswege eindigt en niet wordt verlengd.',
    body: 'Tot die datum verwachten we dat je jouw werkzaamheden netjes afmaakt en zorgt voor een goede overdracht. In de bijlage lees je wat je verder kunt verwachten rondom eindafrekening, inleveren van bedrijfseigendommen en het WW-traject.',
    cta: 'Onderteken de brief voor ontvangst en upload via:', btn: '&rarr; Upload ondertekend document', q: 'Vragen?', sign: 'Met vriendelijke groet,'
  };
  return slaWrap(slaHead('#e8824a', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(naam) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 16px">' + L.intro + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + L.body + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #e8824a"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">' + L.cta + '</p>' + knop(prefillOntslagUrl(naam), L.btn) + '</td></tr></table><p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p>' + groet(L.sign, bv) + '</td></tr>' + slaFoot());
}
// Plain-text templates uit de dashboard-UI (T.ontslag); [BV] in het onderwerp wordt vervangen
const ONTSLAG_TEMPLATES = [
  { key: 'ontslag-pdf', label: 'Ontslagbevestiging + PDF', type: 'ontslag', taal: 'NL', pdf: true, subject: 'Bevestiging opzegging dienstverband - [BV]',
    body: (n, bv) => 'Beste ' + (n || '[Naam]') + ',\n\nHierbij de officiele ontslagbevestiging als PDF bijlage.\n\nOnderteken en upload via:\n' + C.UPLOAD_ONTSLAG + '\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'ontslag-herinnering', label: 'Herinnering ondertekening', type: 'herinnering', taal: 'NL', pdf: false, subject: 'Herinnering: ontslagbevestiging nog niet ontvangen',
    body: (n, bv) => 'Beste ' + (n || '[Naam]') + ',\n\nNog niet ondertekend. Upload via:\n' + C.UPLOAD_ONTSLAG + '\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'aanzegging-nl', label: 'Aanzegging niet-verlengen + PDF', type: 'aanzegging', taal: 'NL', pdf: true, subject: 'Aanzegging einde arbeidsovereenkomst - [BV]',
    body: (n, bv) => 'Beste ' + (n || '[Naam]') + ',\n\nIn de bijlage vind je de officiele aanzegging waarin we je informeren dat jouw arbeidsovereenkomst met ' + (bv || 'SLA') + ' op de einddatum van rechtswege eindigt en niet wordt verlengd.\n\nTot de einddatum verwachten we dat je jouw werkzaamheden netjes afmaakt en zorgt voor een goede overdracht aan jouw collegas. In de bijlage lees je verder over de eindafrekening, inleveren van bedrijfseigendommen en het WW-traject.\n\nOnderteken de brief voor ontvangst en upload via:\n' + C.UPLOAD_ONTSLAG + '\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'aanzegging-en', label: 'Notice of non-renewal + PDF (EN)', type: 'aanzegging', taal: 'EN', pdf: true, subject: 'Notice of non-renewal of employment agreement - [BV]',
    body: (n, bv) => 'Dear ' + (n || '[Name]') + ',\n\nAttached you will find the official notice that your fixed-term employment agreement with ' + (bv || 'SLA') + ' will end by operation of law on the end date and will not be renewed.\n\nUntil that date we expect you to complete your tasks properly and ensure a careful handover to your colleagues. The attached letter contains further information about the final settlement, returning company property and applying for unemployment benefits.\n\nPlease sign for receipt and upload via:\n' + C.UPLOAD_ONTSLAG + '\n\nKind regards,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') }
];
function ontslagMailHtml(tpl, naam, bv, einddatum) {
  if (tpl.type === 'aanzegging') return aanzeggingHtml(naam, bv, einddatum, tpl.taal === 'EN');
  if (tpl.type === 'herinnering') return ontslagHerHtml(naam, bv);
  return ontslagHtml(naam, bv);
}

// --- Sommatie (buildSommatieHtml / buildSommatiePlain + eigen tekst uit VrijeBrief.gs) ---
const SOM_TYPES = ['Oproepbrief', '1e Sommatie', '2e Sommatie', 'Finale Sommatie', 'Ontslag op Staande Voet'];
const SOM_KLEUR = { 'Oproepbrief': '#2980b9', '1e Sommatie': '#e8824a', '2e Sommatie': '#d35400', 'Finale Sommatie': '#c0392b', 'Ontslag op Staande Voet': '#333d3a' };
const SOM_SHEETKLEUR = { 'Ontslag op Staande Voet': '#f4cccc', 'Finale Sommatie': '#fce5cd', '2e Sommatie': '#fff2cc' }; // rest groen
const SOM_HINTS = {
  'Oproepbrief': '📋 <strong>Fase 0 — Vóór de sommatie</strong> — Vriendelijke oproep voor iemand die lang niet is komen werken. Geen formele maatregel — maar wel <strong>aangetekend verzenden</strong> voor het dossier. Vul de naam van de Store Manager in en stel een concrete contactdatum/tijd in.',
  '1e Sommatie': '🔵 <strong>Dag 1–2</strong> — Verstuur e-mail + aangetekende brief op dezelfde dag. Vermeld: loonopschorting • deadline 24–48 uur na ontvangst • concrete datum/tijd afspraak.',
  '2e Sommatie': '🟠 <strong>Dag 3–5</strong> — Verstuur e-mail + aangetekende brief. Vermeld: tweede én laatste waarschuwing • loonstopzetting per direct • gevolg is ontslag.',
  'Finale Sommatie': '🔴 <strong>Dag 5–7</strong> — Verstuur e-mail + aangetekende brief. Stel de datum/tijd afspraak minimaal 2–3 werkdagen vooruit in (bezorgtijd post + reactietijd).',
  'Ontslag op Staande Voet': '⚫ <strong>Na Finale Sommatie</strong> — Zorg dat het dossier compleet is. Stuur e-mail + aangetekende brief. Overweeg juridisch advies (KHN of HR-jurist).'
};
function sommatieSubject(p) { return p.type === 'Oproepbrief' ? 'Oproep: wij horen graag iets van u - ' + p.naam : p.type + ' - ' + p.naam; }
function sommatieHtml(p) {
  const type = p.type, naam = esc(p.naam), bv = esc(p.bv || C.BEDRIJFSNAAM), da = esc(p.datumAfwezig), dap = esc(p.datumAfspraak);
  const kleur = SOM_KLEUR[type] || '#333d3a';
  const s = F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 14px', sB = F + 'font-size:15px;color:#333d3a;margin:0 0 16px';
  const sR = F + 'font-size:14px;color:#c0392b;line-height:1.7;margin:0 0 14px;font-weight:700';
  const bxR = 'padding:14px 16px;background:#fdecea;border-radius:8px;border-left:4px solid #c0392b;margin-bottom:16px;' + F + 'font-size:13px;color:#7b241c;line-height:1.6';
  const bxO = 'padding:14px 16px;background:#fef9e7;border-radius:8px;border-left:4px solid #e8824a;margin-bottom:16px;' + F + 'font-size:13px;color:#7d5a00;line-height:1.6';
  let body = '<p style="' + sB + '">Beste ' + naam + ',</p>';
  if (type === 'Oproepbrief') {
    const mgr = esc(p.storeManager || 'de Store Manager');
    body += '<p style="' + s + '">We zien dat je al geruime tijd niet op jouw werkplek bent verschenen en we geen contact met je hebben kunnen krijgen. We hopen dat alles goed met je gaat.</p>';
    body += '<p style="' + s + '">We zien dat je nog altijd in dienst bent bij <strong>' + bv + '</strong> en hechten waarde aan jouw welzijn en situatie. We begrijpen dat er omstandigheden kunnen zijn die je belemmeren, en horen graag wat er speelt.</p>';
    body += '<p style="' + s + '">We vragen je vriendelijk om' + (dap ? ' uiterlijk op <strong>' + dap + '</strong>' : ' zo spoedig mogelijk') + ' telefonisch contact op te nemen met <strong>' + mgr + '</strong>, zodat we samen naar een oplossing kunnen kijken.</p>';
    body += '<div style="' + bxO + '">&#128222; <strong>Contactpersoon:</strong> ' + mgr + (dap ? ' &bull; <strong>Uiterlijk:</strong> ' + dap : '') + '</div>';
    body += '<p style="' + s + '">We hopen snel iets van je te horen. Heb je vragen, aarzel dan niet om contact op te nemen.</p>';
  } else if (type === '1e Sommatie') {
    body += '<p style="' + s + '">We zien dat je ' + (da ? 'op <strong>' + da + '</strong> ' : 'op de afgesproken datum ') + 'niet bent verschenen op jouw werkplek en/of niet bereikbaar was. Dit betreft ongeoorloofd verzuim.</p>';
    body += '<p style="' + s + '">We sommeren je hierbij om <strong>binnen 24 tot 48 uur</strong> na ontvangst van deze brief contact op te nemen.' + (dap ? ' We vragen je uiterlijk op <strong>' + dap + '</strong> aanwezig te zijn of contact op te nemen.' : '') + '</p>';
    body += '<div style="' + bxO + '"><strong>&#9888; Loonopschorting</strong><br>Zolang je het werk niet hervat en geen contact opneemt, zijn we genoodzaakt jouw loon op te schorten. Dit betreft nadrukkelijk een opschorting en geen definitieve stopzetting.</div>';
    body += '<p style="' + s + '">Als je niet reageert op deze sommatie, zullen we verdere maatregelen treffen. Dit kan leiden tot loonstopzetting en ontslag.</p>';
  } else if (type === '2e Sommatie') {
    body += '<p style="' + s + '">We zien dat je ' + (da ? 'op <strong>' + da + '</strong> ' : 'wederom ') + 'niet bent verschenen op jouw werkplek en/of niet bereikbaar was, ondanks onze eerdere sommatie.</p>';
    body += '<p style="' + s + '">Dit is jouw <strong>tweede en laatste officiele waarschuwing</strong>. We sommeren je om ' + (dap ? 'uiterlijk op <strong>' + dap + '</strong> ' : 'per direct ') + 'contact op te nemen of aanwezig te zijn op jouw werklocatie.</p>';
    body += '<div style="' + bxO + '"><strong>&#9888; Loonstopzetting</strong><br>Omdat je geen gehoor hebt gegeven aan onze eerdere sommatie, gaan we over tot loonstopzetting. Met onmiddellijke ingang wordt geen loon meer uitbetaald totdat je het werk hervat.</div>';
    body += '<div style="' + bxR + '"><strong>Gevolgen bij uitblijven reactie</strong><br>Als je ook op deze sommatie niet reageert, zijn we genoodzaakt over te gaan tot ontslag.</div>';
  } else if (type === 'Finale Sommatie') {
    body += '<p style="' + s + '">We zien dat je, ondanks twee eerdere officiele sommaties, nog steeds niet bent verschenen op jouw werkplek en/of geen contact heeft opgenomen.</p>';
    if (da) body += '<p style="' + s + '">Op <strong>' + da + '</strong> ben je wederom niet verschenen.</p>';
    body += '<p style="' + sR + '">Dit is jouw FINALE sommatie.</p>';
    body += '<p style="' + s + '">' + (dap ? 'Je dient uiterlijk op <strong>' + dap + '</strong> aanwezig te zijn op jouw werklocatie of contact op te nemen met jouw leidinggevende. ' : 'Je dient zo spoedig mogelijk na ontvangst van dit schrijven contact op te nemen. ') + 'Bij uitblijven gaan we over tot ontslag op staande voet.</p>';
    body += '<div style="' + bxR + '"><strong>&#9940; Uitdrukkelijke waarschuwing</strong><br>Bij het uitblijven van een reactie gaan we over tot ontslag op staande voet wegens herhaaldelijk ongeoorloofd verzuim. Uw volledige dossier is gereed voor dit besluit.</div>';
    body += '<p style="' + F + 'font-size:12px;color:#888;margin:8px 0 0;font-style:italic">We hebben je vandaag ook een e-mail gestuurd. De uiterste reactietermijn geldt vanaf ontvangst van dit schrijven.</p>';
  } else {
    body += '<p style="' + s + '">Tot onze spijt laten we je weten dat jouw dienstverband bij <strong>' + bv + '</strong> per direct en met onmiddellijke ingang wordt be&euml;indigd wegens ontslag op staande voet.</p>';
    body += '<p style="' + s + '">Dit besluit is genomen na herhaaldelijk ongeoorloofd verzuim en het niet reageren op meerdere officiele sommaties. Dit vormt een dringende reden in de zin van artikel 7:677 BW.</p>';
    if (da) body += '<p style="' + s + '">Uw meest recente ongeoorloofde afwezigheid betrof <strong>' + da + '</strong>.</p>';
    body += '<div style="' + bxR + '"><strong>Reden van ontslag op staande voet</strong><br>Herhaaldelijk ongeoorloofd verzuim ondanks meerdere officiele sommaties (artikel 7:677 BW).</div>';
    if (dap) body += '<p style="' + s + '">We vragen je om op <strong>' + dap + '</strong> aanwezig te zijn voor de administratieve afwikkeling en het ophalen van jouw persoonlijke eigendommen.</p>';
    body += '<p style="' + s + '">Een schriftelijke bevestiging van dit ontslag ontvangt je per aangetekende post. We adviseren je om zo nodig juridisch advies in te winnen.</p>';
  }
  if (p.eigenTekst && String(p.eigenTekst).trim()) body += tekstNaarHtml(p.eigenTekst);   // extra alinea's vlak voor de groet
  body += '<p style="' + F + 'font-size:14px;color:#333d3a;margin:24px 0 6px">Met vriendelijke groet,<br><strong>' + esc(C.AFZENDER_NAAM) + '</strong><br>' + bv + '</p>';
  return slaWrap(slaHead(kleur, 'SLA HR &middot; ' + esc(type)) + '<tr><td style="padding:32px 36px 28px">' + body + '</td></tr>' + slaFoot());
}
function sommatiePlain(p) {
  const type = p.type, naam = p.naam, bv = p.bv || C.BEDRIJFSNAAM, da = p.datumAfwezig, dap = p.datumAfspraak, mgr = p.storeManager || 'de Store Manager';
  let txt = 'Beste ' + naam + ',\n\n';
  if (type === 'Oproepbrief') {
    txt += 'We zien dat je al geruime tijd niet op jouw werkplek bent verschenen en we geen contact met je hebben kunnen krijgen. We hopen dat alles goed met je gaat.\n\n';
    txt += 'We zien dat je nog altijd in dienst bent bij ' + bv + ' en hechten waarde aan jouw welzijn en situatie.\n\n';
    txt += 'We vragen je vriendelijk om' + (dap ? ' uiterlijk op ' + dap + ' ' : ' zo spoedig mogelijk ') + 'telefonisch contact op te nemen met ' + mgr + '.\n\n';
    txt += 'We hopen snel iets van je te horen.\n\n';
  } else if (type === '1e Sommatie') {
    txt += (da ? 'Op ' + da + ' ben je niet verschenen op jouw werkplek en/of was je niet bereikbaar. Dit betreft ongeoorloofd verzuim.\n\n' : 'Je bent niet verschenen en/of niet bereikbaar geweest. Dit betreft ongeoorloofd verzuim.\n\n');
    txt += 'We sommeren je om binnen 24 tot 48 uur contact op te nemen of aanwezig te zijn.' + (dap ? ' Uiterlijk op ' + dap + '.' : '') + ' LOONOPSCHORTING: Zolang je niet reageert, schorten we jouw loonbetaling op. Bij uitblijven van reactie volgen verdere maatregelen waaronder loonstopzetting en ontslag.\n\n';
  } else if (type === '2e Sommatie') {
    txt += (da ? 'Op ' + da + ' ben je wederom niet verschenen, ondanks onze eerdere sommatie.\n\n' : 'Je bent wederom niet verschenen, ondanks onze eerdere sommatie.\n\n');
    txt += 'Dit is jouw tweede en laatste officiele waarschuwing. We sommeren je om ' + (dap ? 'uiterlijk op ' + dap + ' ' : 'per direct ') + 'contact op te nemen of aanwezig te zijn. LOONSTOPZETTING: Met onmiddellijke ingang wordt geen loon meer uitbetaald. Bij uitblijven van reactie gaan we over tot ontslag.\n\n';
  } else if (type === 'Finale Sommatie') {
    txt += 'Ondanks twee eerdere sommaties ben je nog steeds niet verschenen en heb je geen contact opgenomen.\n\n';
    txt += (da ? 'Op ' + da + ' ben je wederom niet verschenen.\n\n' : '');
    txt += 'FINALE SOMMATIE. ' + (dap ? 'Je dient uiterlijk op ' + dap + ' aanwezig te zijn of contact op te nemen. ' : 'Je dient per direct contact op te nemen. ') + 'Bij uitblijven gaan we over tot ontslag op staande voet.\n\nWe hebben je vandaag ook een e-mail gestuurd. De uiterste reactietermijn geldt vanaf ontvangst van dit schrijven.\n\n';
  } else {
    txt += 'Tot onze spijt laten we je weten dat jouw dienstverband bij ' + bv + ' per direct wordt beëindigd wegens ontslag op staande voet.\n\n';
    txt += 'Reden: Herhaaldelijk ongeoorloofd verzuim ondanks meerdere officiele sommaties (artikel 7:677 BW).\n\n';
    txt += (da ? 'Meest recente afwezigheid: ' + da + '.\n\n' : '');
    txt += (dap ? 'We vragen je aanwezig te zijn op ' + dap + ' voor afwikkeling en persoonlijke eigendommen.\n\n' : '');
    txt += 'Een schriftelijke bevestiging ontvangt je per aangetekende post.\n\n';
  }
  if (p.eigenTekst && String(p.eigenTekst).trim()) txt += String(p.eigenTekst).trim() + '\n\n';
  return txt + 'Met vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + bv;
}

// --- Overplaatsing / standplaatswijziging (buildOverplaatsing* uit Code.gs) ---
function overplaatsingSubject(naam, isStandpl, isEN) {
  if (isStandpl) return (isEN ? 'Confirmation of change of place of work - ' : 'Bevestiging wijziging standplaats - ') + naam;
  return (isEN ? 'Confirmation of internal transfer - ' : 'Bevestiging interne overplaatsing - ') + naam;
}
function overplaatsingPlain(naam, huidig, nieuw, ingangsdatum, isStandpl, isEN) {
  const u = C.UPLOAD_ONTSLAG;
  if (isEN) {
    if (isStandpl) return 'Dear ' + naam + ',\n\nAttached you will find the confirmation of the change of your place of work within ' + huidig.bv + '.\n\nAs of ' + (ingangsdatum || 'the agreed date') + ', your workplace changes from ' + huidig.naam + ' to ' + nieuw.naam + '.\n\nPlease sign for approval and upload via:\n' + u + '\n\nQuestions? hr@ilovesla.com\n\nKind regards,\nSLA HR Team';
    return 'Dear ' + naam + ',\n\nAttached you will find the official confirmation of your internal transfer from ' + huidig.bv + ' to ' + nieuw.bv + '.\n\nAs of ' + (ingangsdatum || 'the agreed date') + ', your employment formally transfers, with retention of your years of service.\n\nPlease sign for approval and upload via:\n' + u + '\n\nQuestions? hr@ilovesla.com\n\nKind regards,\nSLA HR Team';
  }
  if (isStandpl) return 'Beste ' + naam + ',\n\nIn de bijlage vind je de bevestiging van de wijziging van jouw standplaats binnen ' + huidig.bv + '.\n\nPer ' + (ingangsdatum || 'de afgesproken datum') + ' wijzigt jouw werkplek van ' + huidig.naam + ' naar ' + nieuw.naam + '.\n\nOnderteken voor akkoord en upload via:\n' + u + '\n\nVragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team';
  return 'Beste ' + naam + ',\n\nIn de bijlage vind je de officiele bevestiging van jouw interne overplaatsing van ' + huidig.bv + ' naar ' + nieuw.bv + '.\n\nPer ' + (ingangsdatum || 'de afgesproken datum') + ' word je formeel overgedragen, met behoud van dienstjaren.\n\nOnderteken voor akkoord en upload via:\n' + u + '\n\nVragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team';
}
function overplaatsingHtml(naam, huidig, nieuw, ingangsdatum, isStandpl, isEN) {
  const hb = esc(huidig.bv), nb = esc(nieuw.bv), hn = esc(huidig.naam), nn = esc(nieuw.naam), ing = ingangsdatum ? '<strong>' + esc(ingangsdatum) + '</strong>' : '<strong>' + (isEN ? 'the agreed date' : 'de afgesproken datum') + '</strong>';
  const L = isEN ? (isStandpl ? {
    head: 'HR &middot; Change of workplace', greet: 'Dear ', intro: 'Attached you will find the confirmation of the change of your place of work within <strong>' + hb + '</strong>.',
    detail: 'As of ' + ing + ', your workplace changes from <strong>' + hn + '</strong> to <strong>' + nn + '</strong>. Your employment, salary, hours and accrued holidays remain unchanged.',
    cta: 'Please sign for approval and upload via:', btn: '&rarr; Upload signed document', q: 'Questions?', sign: 'Kind regards,'
  } : {
    head: 'HR &middot; Internal transfer', greet: 'Dear ', intro: 'Attached you will find the official confirmation of your internal transfer from <strong>' + hb + '</strong> to <strong>' + nb + '</strong>.',
    detail: 'As of ' + ing + ', your employment formally transfers, <strong>with retention of your years of service</strong> and all related entitlements (holiday, seniority, chain rule).',
    cta: 'Please sign for approval and upload via:', btn: '&rarr; Upload signed document', q: 'Questions?', sign: 'Kind regards,'
  }) : (isStandpl ? {
    head: 'HR &middot; Wijziging standplaats', greet: 'Beste ', intro: 'In de bijlage vind je de bevestiging van de wijziging van jouw standplaats binnen <strong>' + hb + '</strong>.',
    detail: 'Per ' + ing + ' wijzigt jouw werkplek van <strong>' + hn + '</strong> naar <strong>' + nn + '</strong>. Jouw dienstverband, salaris, uren en opgebouwde vakantiedagen blijven ongewijzigd.',
    cta: 'Onderteken voor akkoord en upload via:', btn: '&rarr; Upload ondertekend document', q: 'Vragen?', sign: 'Met vriendelijke groet,'
  } : {
    head: 'HR &middot; Interne overplaatsing', greet: 'Beste ', intro: 'In de bijlage vind je de officiele bevestiging van jouw interne overplaatsing van <strong>' + hb + '</strong> naar <strong>' + nb + '</strong>.',
    detail: 'Per ' + ing + ' word je formeel overgedragen, <strong>met behoud van dienstjaren</strong> en alle daaraan verbonden aanspraken (vakantiedagen, anci&euml;nniteit, ketenregeling).',
    cta: 'Onderteken voor akkoord en upload via:', btn: '&rarr; Upload ondertekend document', q: 'Vragen?', sign: 'Met vriendelijke groet,'
  });
  const afzender = isStandpl ? hb : hb + ' &amp; ' + nb;
  return slaWrap(slaHead('#009f4b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(naam) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 16px">' + L.intro + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + L.detail + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">' + L.cta + '</p>' + knop(prefillOntslagUrl(naam), L.btn) + '</td></tr></table><p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p><p style="' + P14 + 'margin:0">' + L.sign + '<br><br><strong>SLA HR Team</strong><br>' + afzender + '</p></td></tr>' + slaFoot());
}

module.exports = { slaWrap, slaHead, slaFoot, slaStep, prefillLoonUrl, prefillOntslagUrl, personaliseerUploadLinks, LOON_TEMPLATES, loonPlain, loonHtml, esc, tekstNaarHtml, briefHtml, briefPlain, BRIEF_TEMPLATES, ontslagHtml, ontslagHerHtml, aanzeggingHtml, ONTSLAG_TEMPLATES, ontslagMailHtml,
  SOM_TYPES, SOM_KLEUR, SOM_SHEETKLEUR, SOM_HINTS, sommatieSubject, sommatieHtml, sommatiePlain, overplaatsingSubject, overplaatsingPlain, overplaatsingHtml };
