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

// Persoonlijke upload-link: eigen uploadpagina + Supabase Storage (geen Google Forms/Drive meer, besluit 16-10-2026).
// Zonder naam (lege preview) blijft de generieke placeholder staan; personaliseerUploadLinks vervangt die alsnog.
const U = require('./uploads');
function prefillLoonUrl(naam) { return naam ? U.uploadLink('loon', naam) : C.UPLOAD_LOON; }
function prefillOntslagUrl(naam) { return naam ? U.uploadLink('ontslag', naam) : C.UPLOAD_ONTSLAG; }
function overplaatsingUploadUrl(naam) { return naam ? U.uploadLink('overplaatsing', naam) : C.UPLOAD_ONTSLAG; }
function prefillKortingUrl(naam) { return naam ? U.uploadLink('korting', naam) : C.UPLOAD_LOON; }
// Indiensttredingsformulier: bestand in public/ van het dashboard zelf (voorheen een Google Drive-exportlink, INDIENSTLINK)
function indienstLink() { return U.site() + '/Indiensttredingsformulier_SLA.xlsx'; }
// Generieke upload-links in een (door HR bewerkte) tekst vervangen door de persoonlijke
function personaliseerUploadLinks(body, naam) {
  if (!body || !naam) return body;
  return String(body).split(C.UPLOAD_LOON).join(prefillLoonUrl(naam)).split(C.UPLOAD_ONTSLAG).join(prefillOntslagUrl(naam));
}

// --- Loonheffing: uitnodiging ------------------------------------------------
// Uitnodiging indiensttreding + loonheffing — warme welkomstmail (v0.21.2). Persoonlijk (voornaam), uitleg waarom,
// de 52%-regel als vriendelijke uitleg in plaats van een waarschuwing.
const voornaamVan = n => String(n || '').trim().split(/\s+/)[0] || '';
function loonUitnodigingHtml(naam, dl, isEN) {
  const v = esc(voornaamVan(naam)), d = esc(dl);
  const L = isEN ? {
    head: 'Welcome to SLA', greet: 'Hi ', intro: 'We are really happy you are joining SLA! We are looking forward to welcoming you to the team.',
    intro2: 'To make sure your first salary is paid correctly and on time, we just need two forms from you. It only takes a few minutes.',
    s1: 'Fill in the employment registration form', s1b: 'Download form',
    s2: 'Fill in and sign the payroll tax statement (loonheffingsverklaring)', s2b: 'Go to the form',
    s3: 'Upload both forms via your personal link', s3b: 'Upload forms',
    dlTxt: 'It would be great to receive them by <strong>' + d + '</strong>.',
    waarom: '<strong>Why the payroll tax statement?</strong> Without it, Dutch law requires us to withhold the anonymous tax rate (52%). With the form you simply pay the normal rate.',
    q: 'Questions or need a hand? Just email us at <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a> or ask your Store Manager.',
    bye: 'See you soon!', sign: 'Warm regards,', team: 'The SLA HR team'
  } : {
    head: 'Welkom bij SLA', greet: 'Hoi ', intro: 'Wat leuk dat je bij SLA komt werken! We kijken ernaar uit om je in het team te verwelkomen.',
    intro2: 'Om je eerste salaris goed en op tijd uit te betalen, hebben we nog twee formulieren van je nodig. Dat kost je maar een paar minuten.',
    s1: 'Vul het indiensttredingsformulier in', s1b: 'Download formulier',
    s2: 'Vul de loonheffingsverklaring in en onderteken hem', s2b: 'Naar het formulier',
    s3: 'Upload beide formulieren via je persoonlijke link', s3b: 'Formulieren uploaden',
    dlTxt: 'Fijn als we ze uiterlijk <strong>' + d + '</strong> binnen hebben.',
    waarom: '<strong>Waarom die loonheffingsverklaring?</strong> Zonder dit formulier moeten we volgens de wet het anoniementarief (52%) inhouden. Met het formulier betaal je gewoon het normale tarief.',
    q: 'Vragen of hulp nodig? Mail ons gerust op <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a> of vraag het aan je Store Manager.',
    bye: 'Tot snel!', sign: 'Hartelijke groet,', team: 'Het HR-team van SLA'
  };
  const P = F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 14px';
  const db = dl ? '<p style="' + P + '">' + L.dlTxt + '</p>' : '';
  return slaWrap(slaHead('#009f4b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">' + L.greet + v + ',</p>'
    + '<p style="' + P + '">' + L.intro + '</p><p style="' + P + ';margin-bottom:20px">' + L.intro2 + '</p>'
    + slaStep(1, L.s1, indienstLink(), L.s1b, isEN) + slaStep(2, L.s2, isEN ? C.LB_FORMULIER_EN : C.LB_FORMULIER_NL, L.s2b, isEN) + slaStep(3, L.s3, prefillLoonUrl(naam), L.s3b, isEN)
    + '<div style="height:8px"></div>' + db
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr><td style="padding:12px 14px;background:#e6f7ee;border-radius:8px;' + F + 'font-size:12.5px;color:#006b30;line-height:1.6">' + L.waarom + '</td></tr></table>'
    + '<p style="' + P + '">' + L.q + '</p><p style="' + P + '">' + L.bye + '</p><p style="' + F + 'font-size:14px;color:#333d3a;margin:0">' + L.sign + '<br><strong>' + L.team + '</strong></p></td></tr>' + slaFoot());
}
function loonUitnodigingPlain(naam, dl, isEN) {
  const v = voornaamVan(naam) || (isEN ? '[Name]' : '[Naam]');
  return isEN
    ? 'Hi ' + v + ',\n\nWe are really happy you are joining SLA! We are looking forward to welcoming you to the team.\n\nTo make sure your first salary is paid correctly and on time, we just need two forms from you. It only takes a few minutes:\n\n1. Fill in the employment registration form:\n' + indienstLink() + '\n\n2. Fill in and sign the payroll tax statement (loonheffingsverklaring):\n' + C.LB_FORMULIER_EN + '\n\n3. Upload both forms via your personal link:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'It would be great to receive them by ' + dl + '.\n\n' : '') + 'Why the payroll tax statement? Without it, Dutch law requires us to withhold the anonymous tax rate (52%). With the form you simply pay the normal rate.\n\nQuestions or need a hand? Just email hr@ilovesla.com or ask your Store Manager.\n\nSee you soon!\n\nWarm regards,\nThe SLA HR team'
    : 'Hoi ' + v + ',\n\nWat leuk dat je bij SLA komt werken! We kijken ernaar uit om je in het team te verwelkomen.\n\nOm je eerste salaris goed en op tijd uit te betalen, hebben we nog twee formulieren van je nodig. Dat kost je maar een paar minuten:\n\n1. Vul het indiensttredingsformulier in:\n' + indienstLink() + '\n\n2. Vul de loonheffingsverklaring in en onderteken hem:\n' + C.LB_FORMULIER_NL + '\n\n3. Upload beide formulieren via je persoonlijke link:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Fijn als we ze uiterlijk ' + dl + ' binnen hebben.\n\n' : '') + 'Waarom die loonheffingsverklaring? Zonder dit formulier moeten we volgens de wet het anoniementarief (52%) inhouden. Met het formulier betaal je gewoon het normale tarief.\n\nVragen of hulp nodig? Mail ons gerust op hr@ilovesla.com of vraag het aan je Store Manager.\n\nTot snel!\n\nHartelijke groet,\nHet HR-team van SLA';
}

// --- Loonheffing: herinnering (buildLoonHerHtml) --------------------------------
function loonHerinneringHtml(naam, dl, isEN) {
  const v = esc(voornaamVan(naam)), d = esc(dl);
  const L = isEN ? { head: 'A quick reminder', greet: 'Hi ', body: 'We have not received your payroll tax statement (loonheffingsverklaring) yet. Maybe it slipped your mind, that happens! Could you upload it as soon as possible? Then we can pay your salary correctly.', dl: 'Ideally by: ', btn: '&rarr; Upload form', warn: '<strong>Good to know:</strong> as long as we do not have the statement, Dutch law requires us to withhold the anonymous tax rate (52%). We would like to spare you that.', q: 'Stuck or have a question? Just email us at', sign: 'Warm regards,', team: 'The SLA HR team' }
    : { head: 'Even een herinnering', greet: 'Hoi ', body: 'We hebben je loonheffingsverklaring nog niet van je binnen. Misschien is het er even bij ingeschoten, dat kan gebeuren! Wil je hem zo snel mogelijk uploaden? Dan kunnen we je salaris goed uitbetalen.', dl: 'Graag uiterlijk: ', btn: '&rarr; Formulier uploaden', warn: '<strong>Goed om te weten:</strong> zolang we de verklaring niet hebben, moeten we volgens de wet het anoniementarief (52%) inhouden. Dat willen we je graag besparen.', q: 'Lukt het niet of heb je een vraag? Mail ons gerust op', sign: 'Hartelijke groet,', team: 'Het HR-team van SLA' };
  const db = dl ? '<p style="' + F + 'font-size:14px;color:#333d3a;margin:0 0 16px">' + L.dl + '<strong>' + d + '</strong></p>' : '';
  return slaWrap(slaHead('#f5a623', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">' + L.greet + v + ',</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 18px">' + L.body + '</p>' + db
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><a href="' + prefillLoonUrl(naam) + '" style="display:inline-block;background:#009f4b;color:#fff;' + F + 'font-size:13px;font-weight:700;padding:11px 22px;border-radius:6px;text-decoration:none">' + L.btn + '</a></td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr><td style="padding:12px 14px;background:#fff8e6;border-radius:8px;' + F + 'font-size:12.5px;color:#7a5c00;line-height:1.6">' + L.warn + '</td></tr></table>'
    + '<p style="' + F + 'font-size:14px;color:#333d3a;margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p><p style="' + F + 'font-size:14px;color:#333d3a;margin:0">' + L.sign + '<br><strong>' + L.team + '</strong></p></td></tr>' + slaFoot());
}
function loonHerinneringPlain(naam, dl, isEN) {
  const v = voornaamVan(naam) || (isEN ? '[Name]' : '[Naam]');
  return isEN
    ? 'Hi ' + v + ',\n\nWe have not received your payroll tax statement (loonheffingsverklaring) yet. Maybe it slipped your mind, that happens! Could you upload it as soon as possible? Then we can pay your salary correctly.\n\nUpload here:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Ideally by: ' + dl + '\n\n' : '') + 'Good to know: as long as we do not have the statement, Dutch law requires us to withhold the anonymous tax rate (52%).\n\nStuck or have a question? Just email hr@ilovesla.com.\n\nWarm regards,\nThe SLA HR team'
    : 'Hoi ' + v + ',\n\nWe hebben je loonheffingsverklaring nog niet van je binnen. Misschien is het er even bij ingeschoten, dat kan gebeuren! Wil je hem zo snel mogelijk uploaden? Dan kunnen we je salaris goed uitbetalen.\n\nUploaden kan hier:\n' + C.UPLOAD_LOON + '\n\n' + (dl ? 'Graag uiterlijk: ' + dl + '\n\n' : '') + 'Goed om te weten: zolang we de verklaring niet hebben, moeten we volgens de wet het anoniementarief (52%) inhouden.\n\nLukt het niet of heb je een vraag? Mail ons gerust op hr@ilovesla.com.\n\nHartelijke groet,\nHet HR-team van SLA';
}

// Templates zoals de UI ze kent (label, onderwerp, body-functie)
const LOON_TEMPLATES = [
  { key: 'uitnodiging-nl', label: 'Uitnodiging NL', taal: 'NL', type: 'uitnodiging', subject: 'Welkom bij SLA! Nog twee formulieren voor je eerste salaris' },
  { key: 'uitnodiging-en', label: 'Invitation EN', taal: 'EN', type: 'uitnodiging', subject: 'Welcome to SLA! Two forms for your first salary' },
  { key: 'herinnering-nl', label: 'Herinnering NL', taal: 'NL', type: 'herinnering', subject: 'Even een herinnering: je loonheffingsverklaring' },
  { key: 'herinnering-en', label: 'Reminder EN', taal: 'EN', type: 'herinnering', subject: 'A quick reminder: your payroll tax statement' }
];
// Tweetalig (NL + EN in één mail) voor de automatische uitnodiging: taal van een nieuwe medewerker is niet bekend.
// Haalt de inhoud uit beide eentalige versies en zet ze onder elkaar in één huisstijl-mail.
function binnenInhoud(html) {
  const a = '<tr><td style="padding:32px 36px 28px">', i = html.indexOf(a), j = html.lastIndexOf('</td></tr>' + slaFoot());
  return i > -1 && j > i ? html.slice(i + a.length, j) : html;
}
const LOON_TWEETALIG_ONDERWERP = { uitnodiging: 'Welkom bij SLA! / Welcome to SLA! – twee formulieren voor je eerste salaris', herinnering: 'Even een herinnering / A quick reminder: je loonheffingsverklaring' };
function loonHtmlTweetalig(type, naam, dl) {
  const kop = type === 'herinnering' ? 'Even een herinnering &middot; A quick reminder' : 'Welkom bij SLA &middot; Welcome to SLA';
  return slaWrap(slaHead(type === 'herinnering' ? '#f5a623' : '#009f4b', kop) + '<tr><td style="padding:32px 36px 28px">'
    + '<p style="' + F + 'font-size:11px;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px">Nederlands</p>' + binnenInhoud(loonHtml(type, naam, dl, false))
    + '<hr style="border:none;border-top:1px solid #e8e2de;margin:26px 0">'
    + '<p style="' + F + 'font-size:11px;font-weight:700;color:#888078;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px">English</p>' + binnenInhoud(loonHtml(type, naam, dl, true))
    + '</td></tr>' + slaFoot());
}
function loonPlainTweetalig(type, naam, dl) { return loonPlain(type, naam, dl, false) + '\n\n------------------------------\n\n' + loonPlain(type, naam, dl, true); }
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
      '- De eindafrekening (loon over je laatst gewerkte uren) ontvang je bij de eerstvolgende loonrun. Vakantie-uren en vakantiegeld zitten bij je all-in contract al in je uurloon.\n' +
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
// Exit-survey-blok (fase 2f): {{EXITLINK}} wordt in ontslag-mail.js vervangen door de persoonlijke link
function exitBlok(isEN) {
  const L = isEN ? { kop: 'How was it at SLA?', tekst: 'Instead of an exit interview we ask you to fill in a short survey: a few questions, about 2 minutes, anonymously if you prefer. It helps us keep improving.', knop: '&rarr; Fill in the exit survey' }
    : { kop: 'Hoe was het bij SLA?', tekst: 'In plaats van een exitgesprek vragen we je een korte vragenlijst in te vullen: een paar vragen, ongeveer 2 minuten, desgewenst anoniem. Daar worden we beter van.', knop: '&rarr; Exit-survey invullen' };
  // <!--EXIT-->…<!--/EXIT--> markeert het blok zodat ontslag-mail.js het kan weglaten als de survey gepauzeerd is
  return '<!--EXIT--><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 4px">' + L.kop + '</p><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">' + L.tekst + '</p>' + knop('{{EXITLINK}}', L.knop) + '</td></tr></table><!--/EXIT-->';
}
// Aankondiging in de ontslag-/aanzegging-/proeftijdmail: de survey zelf komt automatisch ná de laatste werkdag (sched-exit-survey)
function exitMeldingBlok(isEN) {
  const L = isEN ? { kop: 'Exit survey after your last working day', tekst: 'Instead of an exit interview, you will receive a short survey by email after your last working day: a few questions, about 2 minutes, anonymously if you prefer. It helps us keep improving.' }
    : { kop: 'Exit-survey na je laatste werkdag', tekst: 'In plaats van een exitgesprek ontvang je na je laatste werkdag per mail een korte vragenlijst: een paar vragen, ongeveer 2 minuten, desgewenst anoniem. Daar worden we beter van.' };
  return '<!--EXIT--><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#e6f7ee;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:14px;font-weight:700;color:#333d3a;margin:0 0 4px">' + L.kop + '</p><p style="' + F + 'font-size:13px;color:#333d3a;margin:0">' + L.tekst + '</p></td></tr></table><!--/EXIT-->';
}
// Check-in na 30/60 dagen (fase 3a): tweetalig in één mail, want de taal van een nieuwe medewerker is niet bekend
const voornaam = n => String(n || '').trim().split(/\s+/)[0] || '';
function checkinOnderwerp(herinnering) { return herinnering ? 'Herinnering: hoe gaat het bij SLA? / Reminder: how are things at SLA?' : 'Hoe gaat het bij SLA? / How are things at SLA?'; }
function checkinPlain(naam, url, herinnering) {
  const v = voornaam(naam);
  return (herinnering ? 'Hoi ' + v + ',\n\nVorige week vroegen we hoe je je eerste weken bij SLA ervaart. We horen het nog graag: een paar korte vragen, ongeveer 1 minuut.\n\n' : 'Hoi ' + v + ',\n\nJe werkt nu een paar weken bij SLA. We zijn benieuwd hoe het gaat: een paar korte vragen, ongeveer 1 minuut. Je antwoorden gaan naar het HR-team, niet naar je Store Manager.\n\n')
    + 'Invullen: ' + url + '\n\nHartelijke groet,\nHet HR-team van SLA\n\n---\n\n'
    + (herinnering ? 'Hi ' + v + ',\n\nLast week we asked how your first weeks at SLA are going. We would still love to hear from you: a few short questions, about 1 minute.\n\n' : 'Hi ' + v + ',\n\nYou have been working at SLA for a few weeks now. We would like to know how it is going: a few short questions, about 1 minute. Your answers go to the HR team, not to your Store Manager.\n\n')
    + 'Fill in: ' + url + '\n\nWarm regards,\nThe SLA HR team';
}
function checkinHtml(naam, url, herinnering) {
  const v = esc(voornaam(naam));
  const blok = (groet, tekst, knopTxt) => '<p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 14px">' + groet + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 18px">' + tekst + '</p><p style="margin:0 0 26px">' + knop(url, knopTxt) + '</p>';
  return slaWrap(slaHead('#009f4b', 'Hoe gaat het? &middot; How are you doing?') + '<tr><td style="padding:32px 36px 28px">'
    + blok('Hoi ' + v + ',', herinnering ? 'Vorige week vroegen we hoe je je eerste weken bij SLA ervaart. We horen het nog graag: <strong>een paar korte vragen, ongeveer 1 minuut</strong>.' : 'Je werkt nu een paar weken bij SLA. We zijn benieuwd hoe het gaat: <strong>een paar korte vragen, ongeveer 1 minuut</strong>. Je antwoorden gaan naar het HR-team, niet naar je Store Manager.', '&rarr; Check-in invullen')
    + '<hr style="border:0;border-top:1px solid #e8e2de;margin:0 0 22px">'
    + blok('Hi ' + v + ',', herinnering ? 'Last week we asked how your first weeks at SLA are going. We would still love to hear from you: <strong>a few short questions, about 1 minute</strong>.' : 'You have been working at SLA for a few weeks now. We would like to know how it is going: <strong>a few short questions, about 1 minute</strong>. Your answers go to the HR team, not to your Store Manager.', '&rarr; Fill in the check-in')
    + '<p style="' + P14 + 'margin:0">Hartelijke groet / Warm regards,<br><strong>Het HR-team van SLA</strong></p></td></tr>' + slaFoot());
}
// Losse uitnodiging exit-survey (handmatig, ook voor medewerkers die al uit dienst zijn)
function exitUitnodigingPlain(naam, isEN) {
  const v = voornaamVan(naam) || naam;
  return isEN ? 'Hi ' + v + ',\n\nYour time at SLA has come to an end, or almost. Thank you for everything you have done for us!\n\nWe would love to hear how you experienced working at SLA: what went well and what could be better? A few short questions, about 2 minutes, anonymously if you prefer. Your honest answers help us make SLA an even better place to work.\n\nFill in the exit survey: {{EXITLINK}}\n\nAll the best, and hopefully see you again!\nThe SLA HR team'
    : 'Hoi ' + v + ',\n\nJe tijd bij SLA zit erop, of bijna. Bedankt voor alles wat je voor ons hebt gedaan!\n\nWe zijn benieuwd hoe jij het werken bij SLA hebt ervaren: wat ging goed en wat kan beter? Een paar korte vragen, ongeveer 2 minuten, desgewenst anoniem. Met jouw eerlijke antwoorden maken we SLA een nog fijnere plek om te werken.\n\nVul de exit-survey in: {{EXITLINK}}\n\nHeel veel succes en hopelijk tot ziens!\nHet HR-team van SLA';
}
function exitUitnodigingHtml(naam, isEN) {
  const L = isEN ? { head: 'Thank you for your time at SLA', greet: 'Hi ', intro: 'Your time at SLA has come to an end, or almost. Thank you for everything you have done for us!', intro2: 'We would love to hear how you experienced working at SLA: what went well and what could be better? Your honest answers help us make SLA an even better place to work.', sign: 'All the best, and hopefully see you again!', team: 'The SLA HR team' }
    : { head: 'Bedankt voor je tijd bij SLA', greet: 'Hoi ', intro: 'Je tijd bij SLA zit erop, of bijna. Bedankt voor alles wat je voor ons hebt gedaan!', intro2: 'We zijn benieuwd hoe jij het werken bij SLA hebt ervaren: wat ging goed en wat kan beter? Met jouw eerlijke antwoorden maken we SLA een nog fijnere plek om te werken.', sign: 'Heel veel succes en hopelijk tot ziens!', team: 'Het HR-team van SLA' };
  return slaWrap(slaHead('#009f4b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">' + L.greet + esc(voornaamVan(naam) || naam) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 14px">' + L.intro + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + L.intro2 + '</p>' + exitBlok(isEN) + '<p style="' + P14 + 'margin:0">' + L.sign + '<br><strong>' + L.team + '</strong></p></td></tr>' + slaFoot());
}
// Exit-survey-delen weghalen (gepauzeerd): html-blok tussen markers, en in platte tekst/brieven de regel met de link plus een voorafgaande kop 'Exit-survey'
function zonderExit(s) {
  const regels = String(s || '').replace(/<!--EXIT-->[\s\S]*?<!--\/EXIT-->/g, '').split('\n');
  const weg = new Set();
  regels.forEach((r, i) => {
    if (r.indexOf('{{EXITLINK}}') === -1 && r.indexOf('{{EXITMELDING}}') === -1) return;
    weg.add(i);
    if (r.trim() === '{{EXITLINK}}' && i > 0 && regels[i - 1].trim()) weg.add(i - 1); // intro-regel ("Vul onze korte exit-survey in:") boven een losse linkregel
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) if (/^\*\*Exit[- ]survey\*\*$/i.test(regels[j].trim())) weg.add(j); // kop in de brief
  });
  return regels.filter((r, i) => !weg.has(i)).join('\n').replace(/\n{3,}/g, '\n\n');
}
function ontslagHtml(naam, bv) {
  return slaWrap(slaHead('#333d3a', 'Bevestiging van je opzegging') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">Beste ' + esc(voornaamVan(naam)) + ',</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 14px">Je hebt aangegeven dat je bij SLA stopt. Jammer dat je gaat, maar we begrijpen het en wensen je veel succes met wat er komt!</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 20px">In de bijlage vind je de offici&euml;le bevestiging van je opzegging, met je laatste werkdag en wat je verder kunt verwachten.</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #333d3a"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">Wil je de brief hier digitaal ondertekenen? Dan is alles netjes geregeld.</p>' + knop(prefillOntslagUrl(naam), '&rarr; Brief ondertekenen') + '</td></tr></table>'
    + exitMeldingBlok(false) + '<p style="' + P14 + 'margin:0 0 20px">Vragen? Mail ons gerust op <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p>' + groet('Hartelijke groet,', bv) + '</td></tr>' + slaFoot());
}
function ontslagHerHtml(naam, bv) {
  return slaWrap(slaHead('#333d3a', 'Even een herinnering') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">Beste ' + esc(voornaamVan(naam)) + ',</p>'
    + '<p style="' + P14 + 'line-height:1.7;margin:0 0 20px">We hebben de ondertekende brief nog niet van je terug ontvangen. Wil je hem nog even ondertekenen? Dat kan via de knop hieronder en kost je maar een minuutje.</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px">' + knop(prefillOntslagUrl(naam), '&rarr; Brief ondertekenen') + '</td></tr></table>'
    + '<p style="' + P14 + 'margin:0 0 20px">Lukt het niet of heb je een vraag? Mail ons gerust op <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p>' + groet('Hartelijke groet,', bv) + '</td></tr>' + slaFoot());
}
function aanzeggingHtml(naam, bv, einddatum, isEN) {
  const b = esc(bv), e = esc(einddatum);
  const L = isEN ? {
    head: 'End of your contract', greet: 'Dear ',
    intro: 'Attached you will find the official notice that your employment agreement with <strong>' + b + '</strong>' + (e ? ' will end by operation of law on <strong>' + e + '</strong>' : '') + ' and will not be renewed.',
    body: 'We understand this may not be the news you were hoping for. Thank you for your work at SLA. Until that date we are happy to count on you, and together we will make sure there is a good handover. The attached letter explains what you can expect regarding the final settlement, returning company property and unemployment benefits.',
    cta: 'Could you sign the letter for receipt here?', btn: '&rarr; Sign the letter', q: 'Questions, or would you like to talk about it? Email us at', sign: 'Kind regards,'
  } : {
    head: 'Einde van je contract', greet: 'Beste ',
    intro: 'In de bijlage tref je de offici&euml;le aanzegging dat jouw arbeidsovereenkomst met <strong>' + b + '</strong>' + (e ? ' op <strong>' + e + '</strong>' : '') + ' van rechtswege eindigt en niet wordt verlengd.',
    body: 'We begrijpen dat dit misschien niet het bericht is waar je op hoopte. Bedankt voor je inzet bij SLA. Tot die datum rekenen we graag nog op je, en samen zorgen we voor een goede overdracht. In de bijlage lees je wat je kunt verwachten rondom de eindafrekening, het inleveren van bedrijfseigendommen en het WW-traject.',
    cta: 'Wil je de brief voor ontvangst hier digitaal ondertekenen?', btn: '&rarr; Brief ondertekenen', q: 'Vragen, of wil je erover praten? Mail ons op', sign: 'Met vriendelijke groet,'
  };
  return slaWrap(slaHead('#e8824a', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(voornaamVan(naam)) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 16px">' + L.intro + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + L.body + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #e8824a"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">' + L.cta + '</p>' + knop(prefillOntslagUrl(naam), L.btn) + '</td></tr></table>' + exitMeldingBlok(isEN) + '<p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p>' + groet(L.sign, bv) + '</td></tr>' + slaFoot());
}
// Plain-text templates uit de dashboard-UI (T.ontslag); [BV] in het onderwerp wordt vervangen
const ONTSLAG_TEMPLATES = [
  { key: 'ontslag-pdf', label: 'Ontslagbevestiging + PDF', type: 'ontslag', taal: 'NL', pdf: true, subject: 'Bevestiging opzegging dienstverband - [BV]',
    body: (n, bv) => 'Beste ' + (voornaamVan(n) || '[Naam]') + ',\n\nJe hebt aangegeven dat je bij SLA stopt. Jammer dat je gaat, maar we begrijpen het en wensen je veel succes met wat er komt!\n\nIn de bijlage vind je de officiële bevestiging van je opzegging. Wil je de brief hier digitaal ondertekenen? Dan is alles netjes geregeld:\n' + C.UPLOAD_ONTSLAG + '\n\nNa je laatste werkdag ontvang je van ons per mail een korte exit-survey (een paar vragen, 2 minuten, desgewenst anoniem). We horen graag hoe je je tijd bij SLA hebt ervaren.{{EXITMELDING}}\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'ontslag-herinnering', label: 'Herinnering ondertekening', type: 'herinnering', taal: 'NL', pdf: false, subject: 'Even een herinnering: je ondertekende brief',
    body: (n, bv) => 'Beste ' + (voornaamVan(n) || '[Naam]') + ',\n\nWe hebben de ondertekende brief nog niet van je terug ontvangen. Wil je hem nog even ondertekenen? Dat kan hier:\n' + C.UPLOAD_ONTSLAG + '\n\nLukt het niet of heb je een vraag? Mail ons gerust op hr@ilovesla.com.\n\nHartelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'aanzegging-nl', label: 'Aanzegging niet-verlengen + PDF', type: 'aanzegging', taal: 'NL', pdf: true, subject: 'Aanzegging einde arbeidsovereenkomst - [BV]',
    body: (n, bv) => 'Beste ' + (voornaamVan(n) || '[Naam]') + ',\n\nIn de bijlage vind je de officiële aanzegging waarin we je informeren dat jouw arbeidsovereenkomst met ' + (bv || 'SLA') + ' op de einddatum van rechtswege eindigt en niet wordt verlengd.\n\nTot de einddatum verwachten we dat je jouw werkzaamheden netjes afmaakt en zorgt voor een goede overdracht aan je collega\'s. Bedankt voor je inzet bij SLA. In de bijlage lees je verder over de eindafrekening, inleveren van bedrijfseigendommen en het WW-traject.\n\nOnderteken de brief voor ontvangst via:\n' + C.UPLOAD_ONTSLAG + '\n\nNa je laatste werkdag ontvang je van ons per mail een korte exit-survey (een paar vragen, 2 minuten, desgewenst anoniem). We horen graag hoe je je tijd bij SLA hebt ervaren.{{EXITMELDING}}\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'aanzegging-en', label: 'Notice of non-renewal + PDF (EN)', type: 'aanzegging', taal: 'EN', pdf: true, subject: 'Notice of non-renewal of employment agreement - [BV]',
    body: (n, bv) => 'Dear ' + (voornaamVan(n) || '[Name]') + ',\n\nAttached you will find the official notice that your fixed-term employment agreement with ' + (bv || 'SLA') + ' will end by operation of law on the end date and will not be renewed.\n\nUntil that date we expect you to complete your tasks properly and ensure a careful handover to your colleagues. Thank you for your work at SLA. The attached letter contains further information about the final settlement, returning company property and applying for unemployment benefits.\n\nPlease sign for receipt via:\n' + C.UPLOAD_ONTSLAG + '\n\nAfter your last working day you will receive a short exit survey by email (a few questions, 2 minutes, anonymously if you prefer). We would love to hear how you experienced your time at SLA.{{EXITMELDING}}\n\nKind regards,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  // Proeftijd (Proeftijd.gs v1): logt in dezelfde ontslag-sheet; variant wg = werkgever zegt op, wn = medewerker zegt op
  { key: 'proeftijd-wg-nl', label: 'Proeftijdontslag + PDF', type: 'proeftijd', variant: 'wg', taal: 'NL', pdf: true, subject: 'Beëindiging arbeidsovereenkomst tijdens proeftijd - [BV]', opzLabel: 'Datum mededeling beëindiging',
    body: (n, bv) => 'Beste ' + (voornaamVan(n) || '[Naam]') + ',\n\nIn de bijlage vind je de schriftelijke bevestiging dat jouw arbeidsovereenkomst met ' + (bv || 'SLA') + ' tijdens de proeftijd is beëindigd.\n\nIn de brief lees je meer over de eindafrekening en het inleveren van bedrijfseigendommen. Op verzoek geven wij de reden van de beëindiging schriftelijk op.\n\nOnderteken de brief voor ontvangst via:\n' + C.UPLOAD_ONTSLAG + '\n\nNa je laatste werkdag ontvang je van ons per mail een korte exit-survey (een paar vragen, 2 minuten, desgewenst anoniem). We horen graag hoe je je tijd bij SLA hebt ervaren.{{EXITMELDING}}\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'proeftijd-wg-en', label: 'Probation termination + PDF (EN)', type: 'proeftijd', variant: 'wg', taal: 'EN', pdf: true, subject: 'Termination of employment during probationary period - [BV]', opzLabel: 'Datum mededeling beëindiging',
    body: (n, bv) => 'Dear ' + (voornaamVan(n) || '[Name]') + ',\n\nAttached you will find the written confirmation that your employment agreement with ' + (bv || 'SLA') + ' has been terminated during the probationary period.\n\nThe attached letter contains further information about the final settlement and returning company property. Upon request we will provide the reason for the termination in writing.\n\nPlease sign for receipt via:\n' + C.UPLOAD_ONTSLAG + '\n\nAfter your last working day you will receive a short exit survey by email (a few questions, 2 minutes, anonymously if you prefer). We would love to hear how you experienced your time at SLA.{{EXITMELDING}}\n\nKind regards,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'proeftijd-wn-nl', label: 'Bevestiging ontslagname proeftijd + PDF', type: 'proeftijd', variant: 'wn', taal: 'NL', pdf: true, subject: 'Bevestiging van jouw opzegging tijdens de proeftijd - [BV]', opzLabel: 'Datum opzegging door medewerker',
    body: (n, bv) => 'Beste ' + (voornaamVan(n) || '[Naam]') + ',\n\nHierbij bevestigen we jouw opzegging tijdens de proeftijd, waarmee jouw dienstverband bij ' + (bv || 'SLA') + ' eindigt.\n\nIn de bijlage vind je de schriftelijke bevestiging met de einddatum en informatie over de eindafrekening en het inleveren van bedrijfseigendommen.\n\nOnderteken de brief voor akkoord via:\n' + C.UPLOAD_ONTSLAG + '\n\nNa je laatste werkdag ontvang je van ons per mail een korte exit-survey (een paar vragen, 2 minuten, desgewenst anoniem). We horen graag hoe je je tijd bij SLA hebt ervaren.{{EXITMELDING}}\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') },
  { key: 'proeftijd-wn-en', label: 'Confirmation resignation probation + PDF (EN)', type: 'proeftijd', variant: 'wn', taal: 'EN', pdf: true, subject: 'Confirmation of your resignation during the probationary period - [BV]', opzLabel: 'Datum opzegging door medewerker',
    body: (n, bv) => 'Dear ' + (voornaamVan(n) || '[Name]') + ',\n\nWe hereby confirm your resignation during the probationary period, ending your employment with ' + (bv || 'SLA') + '.\n\nAttached you will find the written confirmation stating the end date and information about the final settlement and returning company property.\n\nPlease sign for approval via:\n' + C.UPLOAD_ONTSLAG + '\n\nAfter your last working day you will receive a short exit survey by email (a few questions, 2 minutes, anonymously if you prefer). We would love to hear how you experienced your time at SLA.{{EXITMELDING}}\n\nKind regards,\n' + C.AFZENDER_NAAM + '\n' + (bv || 'SLA') }
];
function proeftijdHtml(naam, bv, einddatum, isWG, isEN) {
  const b = esc(bv), e = esc(einddatum);
  const L = isWG ? (isEN ? {
    head: 'End of your contract', greet: 'Dear ', intro: 'Attached you will find the written confirmation that your employment agreement with <strong>' + b + '</strong> has been terminated during the probationary period' + (e ? ', ending on <strong>' + e + '</strong>' : '') + '.',
    body: 'Thank you for your work at SLA over the past period. The attached letter explains what you can expect regarding the final settlement and returning company property. Upon request we will provide the reason for the termination in writing.', cta: 'Could you sign the letter for receipt here?', btn: '&rarr; Sign the letter', q: 'Questions? Email us at', sign: 'Kind regards,'
  } : {
    head: 'Einde van je contract', greet: 'Beste ', intro: 'In de bijlage vind je de schriftelijke bevestiging dat jouw arbeidsovereenkomst met <strong>' + b + '</strong> tijdens de proeftijd is be&euml;indigd' + (e ? ', met als einddatum <strong>' + e + '</strong>' : '') + '.',
    body: 'Bedankt voor je inzet bij SLA de afgelopen periode. In de bijgevoegde brief lees je wat je kunt verwachten rondom de eindafrekening en het inleveren van bedrijfseigendommen. Op verzoek geven we de reden van de be&euml;indiging schriftelijk op.', cta: 'Wil je de brief voor ontvangst hier digitaal ondertekenen?', btn: '&rarr; Brief ondertekenen', q: 'Vragen? Mail ons gerust op', sign: 'Met vriendelijke groet,'
  }) : (isEN ? {
    head: 'Confirmation of your resignation', greet: 'Dear ', intro: 'Attached you will find the written confirmation of your resignation during the probationary period, ending your employment with <strong>' + b + '</strong>' + (e ? ' on <strong>' + e + '</strong>' : '') + '.',
    body: 'Sorry to see you go, and thank you for your time at SLA! The attached letter explains what you can expect regarding the final settlement and returning company property.', cta: 'Could you sign the letter here?', btn: '&rarr; Sign the letter', q: 'Questions? Email us at', sign: 'Warm regards,'
  } : {
    head: 'Bevestiging van je opzegging', greet: 'Beste ', intro: 'In de bijlage vind je de schriftelijke bevestiging van jouw opzegging tijdens de proeftijd, waarmee jouw dienstverband bij <strong>' + b + '</strong>' + (e ? ' per <strong>' + e + '</strong>' : '') + ' eindigt.',
    body: 'Jammer dat je gaat, en bedankt voor je tijd bij SLA! In de bijgevoegde brief lees je wat je kunt verwachten rondom de eindafrekening en het inleveren van bedrijfseigendommen.', cta: 'Wil je de brief hier digitaal ondertekenen?', btn: '&rarr; Brief ondertekenen', q: 'Vragen? Mail ons gerust op', sign: 'Hartelijke groet,'
  });
  return slaWrap(slaHead('#333d3a', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(voornaamVan(naam)) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 16px">' + L.intro + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + L.body + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #333d3a"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">' + L.cta + '</p>' + knop(prefillOntslagUrl(naam), L.btn) + '</td></tr></table>' + exitMeldingBlok(isEN) + '<p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p>' + groet(L.sign, bv) + '</td></tr>' + slaFoot());
}
function ontslagMailHtml(tpl, naam, bv, einddatum) {
  if (tpl.type === 'proeftijd') return proeftijdHtml(naam, bv, einddatum, tpl.variant === 'wg', tpl.taal === 'EN');
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
  const u = overplaatsingUploadUrl(naam);
  if (isEN) {
    if (isStandpl) return 'Dear ' + voornaamVan(naam) + ',\n\nAttached you will find the confirmation of the change of your place of work within ' + huidig.bv + '.\n\nAs of ' + (ingangsdatum || 'the agreed date') + ', your workplace changes from ' + huidig.naam + ' to ' + nieuw.naam + '.\n\nWe wish you a great start at your new place! Could you sign the letter for approval here?\n' + u + '\n\nQuestions? Just email hr@ilovesla.com.\n\nWarm regards,\nThe SLA HR team';
    return 'Dear ' + voornaamVan(naam) + ',\n\nAttached you will find the official confirmation of your internal transfer from ' + huidig.bv + ' to ' + nieuw.bv + '.\n\nAs of ' + (ingangsdatum || 'the agreed date') + ', your employment formally transfers, with retention of your years of service.\n\nWe wish you a great start at your new place! Could you sign the letter for approval here?\n' + u + '\n\nQuestions? Just email hr@ilovesla.com.\n\nWarm regards,\nThe SLA HR team';
  }
  if (isStandpl) return 'Beste ' + voornaamVan(naam) + ',\n\nIn de bijlage vind je de bevestiging van de wijziging van jouw standplaats binnen ' + huidig.bv + '.\n\nPer ' + (ingangsdatum || 'de afgesproken datum') + ' wijzigt jouw werkplek van ' + huidig.naam + ' naar ' + nieuw.naam + '.\n\nWe wensen je een fijne start op je nieuwe plek! Wil je de brief voor akkoord hier digitaal ondertekenen?\n' + u + '\n\nVragen? Mail ons gerust op hr@ilovesla.com.\n\nHartelijke groet,\nHet HR-team van SLA';
  return 'Beste ' + voornaamVan(naam) + ',\n\nIn de bijlage vind je de officiële bevestiging van je interne overplaatsing van ' + huidig.bv + ' naar ' + nieuw.bv + '.\n\nPer ' + (ingangsdatum || 'de afgesproken datum') + ' word je formeel overgedragen, met behoud van dienstjaren.\n\nWe wensen je een fijne start op je nieuwe plek! Wil je de brief voor akkoord hier digitaal ondertekenen?\n' + u + '\n\nVragen? Mail ons gerust op hr@ilovesla.com.\n\nHartelijke groet,\nHet HR-team van SLA';
}
function overplaatsingHtml(naam, huidig, nieuw, ingangsdatum, isStandpl, isEN) {
  const hb = esc(huidig.bv), nb = esc(nieuw.bv), hn = esc(huidig.naam), nn = esc(nieuw.naam), ing = ingangsdatum ? '<strong>' + esc(ingangsdatum) + '</strong>' : '<strong>' + (isEN ? 'the agreed date' : 'de afgesproken datum') + '</strong>';
  const L = isEN ? (isStandpl ? {
    head: 'Your new workplace', greet: 'Dear ', intro: 'Attached you will find the confirmation of the change of your place of work within <strong>' + hb + '</strong>.',
    detail: 'As of ' + ing + ', your workplace changes from <strong>' + hn + '</strong> to <strong>' + nn + '</strong>. Your employment, salary, hours and accrued holidays remain unchanged.',
    cta: 'We wish you a great start at your new place! Could you sign the letter for approval here?', btn: '&rarr; Sign the letter', q: 'Questions? Just email us at', sign: 'Warm regards,'
  } : {
    head: 'Your transfer', greet: 'Dear ', intro: 'Attached you will find the official confirmation of your internal transfer from <strong>' + hb + '</strong> to <strong>' + nb + '</strong>.',
    detail: 'As of ' + ing + ', your employment formally transfers, <strong>with retention of your years of service</strong> and all related entitlements (holiday, seniority, chain rule).',
    cta: 'We wish you a great start at your new place! Could you sign the letter for approval here?', btn: '&rarr; Sign the letter', q: 'Questions? Just email us at', sign: 'Warm regards,'
  }) : (isStandpl ? {
    head: 'Je nieuwe werkplek', greet: 'Beste ', intro: 'In de bijlage vind je de bevestiging van de wijziging van jouw standplaats binnen <strong>' + hb + '</strong>.',
    detail: 'Per ' + ing + ' wijzigt jouw werkplek van <strong>' + hn + '</strong> naar <strong>' + nn + '</strong>. Jouw dienstverband, salaris, uren en opgebouwde vakantiedagen blijven ongewijzigd.',
    cta: 'We wensen je een fijne start op je nieuwe plek! Wil je de brief voor akkoord hier digitaal ondertekenen?', btn: '&rarr; Brief ondertekenen', q: 'Vragen? Mail ons gerust op', sign: 'Hartelijke groet,'
  } : {
    head: 'Je overplaatsing', greet: 'Beste ', intro: 'In de bijlage vind je de offici&euml;le bevestiging van je interne overplaatsing van <strong>' + hb + '</strong> naar <strong>' + nb + '</strong>.',
    detail: 'Per ' + ing + ' word je formeel overgedragen, <strong>met behoud van dienstjaren</strong> en alle daaraan verbonden aanspraken (vakantiedagen, anci&euml;nniteit, ketenregeling).',
    cta: 'We wensen je een fijne start op je nieuwe plek! Wil je de brief voor akkoord hier digitaal ondertekenen?', btn: '&rarr; Brief ondertekenen', q: 'Vragen? Mail ons gerust op', sign: 'Hartelijke groet,'
  });
  const afzender = isStandpl ? hb : hb + ' &amp; ' + nb;
  return slaWrap(slaHead('#009f4b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:16px;font-weight:700;color:#333d3a;margin:0 0 14px">' + L.greet + esc(voornaamVan(naam)) + ',</p><p style="' + P14 + 'line-height:1.7;margin:0 0 16px">' + L.intro + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + L.detail + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr><td style="padding:16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 12px">' + L.cta + '</p>' + knop(overplaatsingUploadUrl(naam), L.btn) + '</td></tr></table><p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p><p style="' + P14 + 'margin:0">' + L.sign + '<br><strong>' + (isEN ? 'The SLA HR team' : 'Het HR-team van SLA') + '</strong><br>' + afzender + '</p></td></tr>' + slaFoot());
}

// --- Officiële waarschuwing: huisregels WOORDELIJK uit de contractbijlage (waarschuwing.gs v1.2) ---
const HUISREGELS = [
  { id: 'HR01', cat: 'Aanwezigheid & inzet', tekst: 'Je bent altijd 5 minuten voor je dienst begint aanwezig.' },
  { id: 'HR02', cat: 'Aanwezigheid & inzet', tekst: 'Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar.' },
  { id: 'HR03', cat: 'Aanwezigheid & inzet', tekst: 'Je werkt minimaal 2 diensten per week.' },
  { id: 'HR04', cat: 'Aanwezigheid & inzet', tekst: 'Je ziekmelden doe je voor 8.00 uur ’s ochtends telefonisch bij je bedrijfsleider. Een bericht sturen is niet afdoende. Na 8.00 uur ben je zelf verantwoordelijk voor het opvangen van je dienst.' },
  { id: 'HR05', cat: 'Aanwezigheid & inzet', tekst: 'SLA-meetings zijn verplicht, dit zijn er max 4 per jaar (inclusief 2 menu wissel meetings). Hiervoor krijg je per meeting 1 uur uitbetaald.' },
  { id: 'HR06', cat: 'Aanwezigheid & inzet', tekst: 'Je zorgt dat je voor je dienst alle berichten in de SLA-app hebt gelezen, zo ben je helemaal op de hoogte van de meest recente ontwikkelingen binnen je winkel en binnen SLA.' },
  { id: 'HR10', cat: 'Uiterlijk & kleding', tekst: 'Als je aan het werk bent, heb je altijd bedrijfskleding aan: een SLA-shirt en een nette sloof.' },
  { id: 'HR11', cat: 'Uiterlijk & kleding', tekst: 'Lang haar draag je altijd in een vlecht of knot.' },
  { id: 'HR12', cat: 'Uiterlijk & kleding', tekst: 'Je handen zien er verzorgd uit. Geen armbanden, ringen om, restjes nagellak verwijder je voor je dienst begint.' },
  { id: 'HR13', cat: 'Uiterlijk & kleding', tekst: 'Je hebt altijd dichte schoenen aan tijdens je werk.' },
  { id: 'HR20', cat: 'Op de werkvloer', tekst: 'Pauzeren doe je buiten de piekuren en nadat alle klusjes zijn gedaan. Je gaat dan apart zitten in privé kleding (even een trui over je SLA-shirt).' },
  { id: 'HR21', cat: 'Op de werkvloer', tekst: 'De counter en de winkel zijn alleen bestemd voor werk-gerelateerde spullen.' },
  { id: 'HR22', cat: 'Op de werkvloer', tekst: 'Mobiele telefoons bewaar je bij je privé-spullen en zijn nooit zichtbaar voor de klanten. Een uitzondering hierop is de mobiele telefoon van de bedrijfsleider.' },
  { id: 'HR23', cat: 'Op de werkvloer', tekst: 'Gesprekken voer je op gepaste toon en nooit als er klanten geholpen moeten worden.' },
  { id: 'HR24', cat: 'Op de werkvloer', tekst: 'Je praat nooit over klanten of over de kwaliteit of houdbaarheid van het eten als andere klanten dit kunnen horen.' },
  { id: 'HR25', cat: 'Op de werkvloer', tekst: 'Als je niet aan het werk bent gedraag je je als klant. Je komt niet achter de counter.' },
  { id: 'HR26', cat: 'Op de werkvloer', tekst: 'Roken tijdens werktijd mag alleen uit het zicht van de klanten in privé kleding. Dit mag alleen op rustige momenten als het uitkomt.' },
  { id: 'HR27', cat: 'Op de werkvloer', tekst: 'Het is niet toegestaan om onder invloed van alcohol of drugs te zijn op de werkvloer.' },
  { id: 'HR30', cat: 'Eten & drinken', tekst: 'Er wordt niet gegeten op de werkvloer. Als je een drankje hebt staan zet je dit uit het zicht.' },
  { id: 'HR31', cat: 'Eten & drinken', tekst: 'Je mag koffie, thee en water drinken tijdens je dienst. Als je zin hebt in een ander drankje zoals sapjes, smoothies of fris, reken je die bij een collega af met personeelskorting.' },
  { id: 'HR32', cat: 'Eten & drinken', tekst: 'Bij een dienst langer dan 5,5 uur mag je een salade, bowl of soep eten. Hierbij kies je een salade van het menu of een reguliere stel-zelf-samen met 1 premium. Bij een dienst korter dan 5,5 uur kun je voor of na je dienst een salade, bowl of soep afrekenen voor de personeelsprijs.' },
  { id: 'HR33', cat: 'Eten & drinken', tekst: 'Het is niet de bedoeling dat je eten mee naar huis neemt, behalve als je bedrijfsleider hier toestemming voor heeft gegeven.' },
  { id: 'HR50', cat: 'HACCP & voedselveiligheid', tekst: 'Je voert de HACCP-procedures correct en tijdig uit conform het HACCP-handboek en de instructies van je bedrijfsleider.' },
  { id: 'HR51', cat: 'HACCP & voedselveiligheid', tekst: 'Je wast je handen bij aanvang van je dienst, na toiletgebruik, na pauze en bij het wisselen tussen taken of producten.' },
  { id: 'HR52', cat: 'HACCP & voedselveiligheid', tekst: 'Temperatuurregistraties (koelingen, koelkast, warmhoud) worden dagelijks bijgehouden; afwijkende waarden meld je direct bij je bedrijfsleider.' },
  { id: 'HR53', cat: 'HACCP & voedselveiligheid', tekst: 'THT- en TGT-datums controleer je vóór uitgifte; producten waarvan de datum is verstreken gebruik je niet en haal je uit het assortiment.' },
  { id: 'HR54', cat: 'HACCP & voedselveiligheid', tekst: 'Kruisbesmetting voorkom je door aparte snijplanken en gerei te gebruiken en - waar voorgeschreven - handschoenen te dragen en te wisselen tussen producten.' },
  { id: 'HR55', cat: 'HACCP & voedselveiligheid', tekst: 'Reiniging en desinfectie voer je uit volgens het schoonmaakschema en registreer je op de daarvoor bestemde lijst.' },
  { id: 'HR56', cat: 'HACCP & voedselveiligheid', tekst: 'Bij maag- of darmklachten, koorts of andere klachten die de voedselveiligheid in gevaar kunnen brengen, werk je niet met levensmiddelen en meld je je ziek (Warenwet).' },
  { id: 'HR40', cat: 'Gedrag & omgang', tekst: 'SLA hanteert een strikt zero tolerance beleid op grensoverschrijdend gedrag.' },
  { id: 'HR41', cat: 'Gedrag & omgang', tekst: 'Je accepteert en respecteert de ander zoals hij is en discrimineert niet. Iedereen telt mee binnen de SLA-organisatie.' },
  { id: 'HR42', cat: 'Gedrag & omgang', tekst: 'Je houdt rekening met de grenzen die de ander aangeeft.' },
  { id: 'HR43', cat: 'Gedrag & omgang', tekst: 'Je valt de ander niet lastig.' },
  { id: 'HR44', cat: 'Gedrag & omgang', tekst: 'Je maakt op geen enkele wijze misbruik van jouw machtspositie.' },
  { id: 'HR45', cat: 'Gedrag & omgang', tekst: 'Je komt niet ongewenst te dichtbij en raakt de ander niet tegen zijn of haar wil aan.' }
];
const regelsById = ids => (ids || []).map(id => (HUISREGELS.find(r => r.id === id) || {}).tekst).filter(Boolean);
function wrsPlain(naam, bv, regels, isEN) {
  if (isEN) return 'Dear ' + naam + ',\n\nAttached you will find an official written warning, which will be added to your personnel file at ' + bv + '.\n\nThe warning concerns the following rule(s) and instruction(s), which are part of your employment agreement (through the house rules annex, the applicable CAO Horeca and the employer\'s right of instruction):\n- ' + regels.join('\n- ') + '\n\nWe ask you to comply with these rules from now on. If this happens again, further measures may follow.\n\nIf you would like to discuss this, please contact your Store Manager or hr@ilovesla.com.\n\nKind regards,\n' + C.AFZENDER_NAAM + '\n' + bv;
  return 'Beste ' + naam + ',\n\nIn de bijlage vind je een officiele schriftelijke waarschuwing, die wordt opgenomen in jouw personeelsdossier bij ' + bv + '.\n\nDe waarschuwing betreft de volgende regel(s) en instructie(s), die onderdeel zijn van jouw arbeidsovereenkomst (via de huisregels-bijlage, de toepasselijke CAO Horeca en het instructierecht van de werkgever):\n- ' + regels.join('\n- ') + '\n\nWe vragen je om deze regels vanaf nu na te leven. Bij herhaling kunnen verdere maatregelen volgen.\n\nWil je hierover in gesprek? Neem contact op met jouw Store Manager of hr@ilovesla.com.\n\nMet vriendelijke groet,\n' + C.AFZENDER_NAAM + '\n' + bv;
}
function wrsHtml(naam, bv, regels, datumOvertreding, isEN) {
  const b = esc(bv), d = esc(datumOvertreding);
  const L = isEN ? {
    head: 'HR &middot; Official warning', greet: 'Dear ', intro: 'Attached you will find an <strong>official written warning</strong>, which will be added to your personnel file at <strong>' + b + '</strong>' + (d ? ' regarding ' + d : '') + '.',
    regelKop: 'The warning concerns the following rule(s) and instruction(s), which are part of your employment agreement (through the house rules annex, the applicable CAO Horeca and the employer\'s right of instruction):',
    slot: 'We ask you to comply with these rules from now on. <strong>If this happens again, further measures may follow.</strong>', gesprek: 'If you would like to discuss this, please contact your Store Manager or HR.', q: 'Questions?', sign: 'Kind regards,'
  } : {
    head: 'HR &middot; Officiele waarschuwing', greet: 'Beste ', intro: 'In de bijlage vind je een <strong>officiele schriftelijke waarschuwing</strong>, die wordt opgenomen in jouw personeelsdossier bij <strong>' + b + '</strong>' + (d ? ' naar aanleiding van ' + d : '') + '.',
    regelKop: 'De waarschuwing betreft de volgende regel(s) en instructie(s), die onderdeel zijn van jouw arbeidsovereenkomst (via de huisregels-bijlage, de toepasselijke CAO Horeca en het instructierecht van de werkgever):',
    slot: 'We vragen je om deze regels vanaf nu na te leven. <strong>Bij herhaling kunnen verdere maatregelen volgen.</strong>', gesprek: 'Wil je hierover in gesprek? Neem dan contact op met jouw Store Manager of HR.', q: 'Vragen?', sign: 'Met vriendelijke groet,'
  };
  const s = P14 + 'line-height:1.7;margin:0 0 16px';
  const regelHtml = regels.map(r => '<p style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 8px;font-style:italic">&ldquo;' + esc(r) + '&rdquo;</p>').join('');
  return slaWrap(slaHead('#c0392b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(naam) + ',</p><p style="' + s + '">' + L.intro + '</p><p style="' + s + '">' + L.regelKop + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr><td style="padding:14px 16px;background:#fdecea;border-radius:8px;border-left:4px solid #c0392b">' + regelHtml + '</td></tr></table><p style="' + s + '">' + L.slot + '</p><p style="' + s + '">' + L.gesprek + '</p><p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p>' + groet(L.sign, bv) + '</td></tr>' + slaFoot());
}

// --- Weekendbeschikbaarheid (Beschikbaarheid.gs v1.2) ---
function beschikbPlain(naam, bv, ingangsdatum, isEN) {
  if (isEN) return 'Dear ' + naam + ',\n\nAttached you will find a written notice regarding your weekend availability. The SLA house rules state: "You are available for a minimum of 2 shifts on Friday, Saturday or Sunday."\n\nWe ask you to update your availability in Shiftbase' + (ingangsdatum ? ' no later than ' + ingangsdatum : ' as soon as possible') + '.\n\nIs there a personal circumstance that prevents you from meeting this rule? Please contact your Store Manager or hr@ilovesla.com.\n\nKind regards,\nSLA HR Team\n' + bv;
  return 'Beste ' + naam + ',\n\nIn de bijlage vind je een schriftelijke kennisgeving over jouw weekendbeschikbaarheid. In de huisregels van SLA staat: "Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar."\n\nWe vragen je om jouw beschikbaarheid in Shiftbase' + (ingangsdatum ? ' uiterlijk per ' + ingangsdatum : ' zo spoedig mogelijk') + ' aan te passen.\n\nIs er een persoonlijke omstandigheid waardoor je niet aan deze afspraak kunt voldoen? Neem dan contact op met jouw Store Manager of hr@ilovesla.com.\n\nMet vriendelijke groet,\nSLA HR Team\n' + bv;
}
function beschikbHtml(naam, bv, ingangsdatum, isEN) {
  const i = esc(ingangsdatum);
  const L = isEN ? {
    head: 'HR &middot; Weekend availability', greet: 'Dear ', intro: 'Attached you will find a <strong>written notice</strong> regarding your weekend availability. The SLA house rules, which you agreed to when you joined, state:', regel: '"You are available for a minimum of 2 shifts on Friday, Saturday or Sunday."',
    detail: 'Our records show that your stated availability has structurally not met this rule. Weekend shifts are the hardest to fill; when part of the team is structurally unavailable, this burden falls disproportionately on colleagues who are available.',
    actie: 'Please update your availability in <strong>Shiftbase</strong>' + (i ? ' no later than <strong>' + i + '</strong>' : ' as soon as possible') + ' so that it complies with the house rules.',
    omst: 'Is there a personal circumstance (studies, care responsibilities, a second job) that prevents you from meeting this rule? Please contact your Store Manager or HR so we can look at what is possible together.', q: 'Questions?', sign: 'Kind regards,'
  } : {
    head: 'HR &middot; Weekendbeschikbaarheid', greet: 'Beste ', intro: 'In de bijlage vind je een <strong>schriftelijke kennisgeving</strong> over jouw weekendbeschikbaarheid. In de huisregels van SLA, waarmee je bij indiensttreding akkoord bent gegaan, staat:', regel: '"Je bent minimaal 2 diensten op vrijdag, zaterdag of zondag beschikbaar."',
    detail: 'Uit onze gegevens blijkt dat jouw opgegeven beschikbaarheid hier structureel niet aan voldoet. Weekenddiensten zijn het lastigst in te vullen; wanneer een deel van het team structureel niet beschikbaar is, komt deze last onevenredig terecht bij collega\'s die dat wél zijn.',
    actie: 'Pas jouw beschikbaarheid in <strong>Shiftbase</strong>' + (i ? ' uiterlijk per <strong>' + i + '</strong>' : ' zo spoedig mogelijk') + ' aan zodat deze voldoet aan de huisregels.',
    omst: 'Is er een persoonlijke omstandigheid (studie, zorgtaken, tweede baan) waardoor je niet aan deze afspraak kunt voldoen? Neem dan contact op met jouw Store Manager of HR, zodat we samen kunnen kijken wat er mogelijk is.', q: 'Vragen?', sign: 'Met vriendelijke groet,'
  };
  const s = P14 + 'line-height:1.7;margin:0 0 16px';
  return slaWrap(slaHead('#e8824a', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(naam) + ',</p><p style="' + s + '">' + L.intro + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr><td style="padding:14px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:14px;color:#333d3a;font-style:italic">' + L.regel + '</td></tr></table><p style="' + s + '">' + L.detail + '</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr><td style="padding:14px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #e8824a;' + F + 'font-size:13px;color:#7a5c00;line-height:1.6">&#9888; ' + L.actie + '</td></tr></table><p style="' + s + '">' + L.omst + '</p><p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p>' + groet(L.sign, bv) + '</td></tr>' + slaFoot());
}

// --- Ontslag op staande voet (OoSV.gs v1.0) ---
function oosvPlain(naam, bv) {
  return 'Geachte ' + naam + ',\n\nHierbij ontvangt u de brief waarin ' + bv + ' de arbeidsovereenkomst met u met onmiddellijke ingang opzegt wegens een dringende reden (ontslag op staande voet). De volledige motivering leest u in de bijgevoegde brief.\n\nDeze brief wordt u tevens per aangetekende post toegezonden.\n\nHoogachtend,\n' + C.AFZENDER_NAAM + '\n' + bv;
}
function oosvHtml(naam, bv) {
  const s = P14 + 'line-height:1.7;margin:0 0 14px';
  return slaWrap(slaHead('#333d3a', 'HR &middot; Offici&euml;le kennisgeving') + '<tr><td style="padding:32px 36px 28px"><p style="' + s + '">Geachte ' + esc(naam) + ',</p><p style="' + s + '">Hierbij ontvangt u de brief waarin <strong>' + esc(bv) + '</strong> de arbeidsovereenkomst met u <strong>met onmiddellijke ingang</strong> opzegt wegens een dringende reden (ontslag op staande voet). De volledige motivering leest u in de bijgevoegde brief.</p><p style="' + s + '">Deze brief wordt u tevens per aangetekende post toegezonden.</p><p style="' + s + '">Hoogachtend,<br><strong>' + esc(C.AFZENDER_NAAM) + '</strong><br>' + esc(bv) + '</p></td></tr>' + slaFoot());
}

// ============================================================
// Loonheffingskorting (Korting.gs v1.5): mail per keuze (Aanzetten/Uitzetten/Wijzigen), NL/EN, eerste mail of herinnering
// ============================================================
const KORT_KEUZES = ['Aanzetten', 'Uitzetten', 'Wijzigen'];
const kortStrip = s => String(s).replace(/<[^>]*>/g, '').replace(/&eacute;/g, 'e').replace(/&oacute;/g, 'o').replace(/&euml;/g, 'e').replace(/&mdash;/g, '-').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
function kortSubject(keuze, isEN, isHer) {
  if (isHer) return isEN ? 'Reminder: payroll tax credit form not yet received' : 'Herinnering: formulier loonheffingskorting nog niet ontvangen';
  if (isEN) return keuze === 'Aanzetten' ? 'Action required: form to apply your payroll tax credit' : keuze === 'Uitzetten' ? 'Action required: form to stop your payroll tax credit' : 'Action required: form to change your payroll tax credit';
  return keuze === 'Aanzetten' ? 'Actie vereist: formulier loonheffingskorting aanzetten' : keuze === 'Uitzetten' ? 'Actie vereist: formulier loonheffingskorting uitzetten' : 'Actie vereist: formulier loonheffingskorting wijzigen';
}
function kortIntro(keuze, isEN, isHer) {
  if (isEN) {
    if (isHer) {
      if (keuze === 'Aanzetten') return 'We have not yet received your signed form to apply the payroll tax credit. As long as the form is missing, nothing changes and we do not apply the credit to your salary. Please complete the three steps below as soon as possible.';
      if (keuze === 'Uitzetten') return 'We have not yet received your signed form to stop the payroll tax credit. As long as the form is missing, we keep applying the credit. Please complete the three steps below as soon as possible.';
      return 'We have not yet received your signed form for the change of your payroll tax credit (loonheffingskorting). Please complete the three steps below as soon as possible.';
    }
    if (keuze === 'Aanzetten') return 'At the moment we do not apply the payroll tax credit (loonheffingskorting) to your salary. You have indicated that you would like us to apply it from now on. We are only allowed to change this on the basis of a newly signed form from the Dutch Tax Administration - a message by e-mail or in person is not enough.';
    if (keuze === 'Uitzetten') return 'At the moment we apply the payroll tax credit (loonheffingskorting) to your salary. You have indicated that you would like us to stop applying it. We are only allowed to change this on the basis of a newly signed form from the Dutch Tax Administration.';
    return 'You have indicated that you want to change whether we apply the payroll tax credit (loonheffingskorting) to your salary. We are only allowed to change this on the basis of a newly signed form from the Dutch Tax Administration.';
  }
  if (isHer) {
    if (keuze === 'Aanzetten') return 'We hebben jouw ondertekende formulier om de loonheffingskorting aan te zetten nog niet ontvangen. Zolang het formulier ontbreekt verandert er niets en passen wij de korting niet toe op jouw salaris. Doorloop de drie stappen hieronder zo snel mogelijk.';
    if (keuze === 'Uitzetten') return 'We hebben jouw ondertekende formulier om de loonheffingskorting stop te zetten nog niet ontvangen. Zolang het formulier ontbreekt blijven wij de korting toepassen. Doorloop de drie stappen hieronder zo snel mogelijk.';
    return 'We hebben jouw ondertekende formulier voor het wijzigen van de loonheffingskorting nog niet ontvangen. Doorloop de drie stappen hieronder zo snel mogelijk.';
  }
  if (keuze === 'Aanzetten') return 'Op dit moment passen wij de loonheffingskorting niet toe op jouw salaris. Je hebt aangegeven dat je dit wilt wijzigen, zodat de korting vanaf nu w&eacute;l wordt toegepast. Wij mogen dit alleen doorvoeren op basis van een nieuw ondertekend formulier van de Belastingdienst - een mondelinge of losse schriftelijke melding is niet voldoende.';
  if (keuze === 'Uitzetten') return 'Op dit moment passen wij de loonheffingskorting toe op jouw salaris. Je hebt aangegeven dat je dit wilt stopzetten. Wij mogen dit alleen doorvoeren op basis van een nieuw ondertekend formulier van de Belastingdienst.';
  return 'Je hebt aangegeven dat je wilt wijzigen of wij de loonheffingskorting op jouw salaris toepassen. Wij mogen dit alleen doorvoeren op basis van een nieuw ondertekend formulier van de Belastingdienst.';
}
function kortWarn(keuze, isEN) {
  if (isEN) {
    if (keuze === 'Aanzetten') return '<strong>Please note:</strong> the payroll tax credit may only be applied by one employer at a time. Do you have another job where the credit is currently applied? Stop it there first - otherwise you will have to pay tax back later.';
    if (keuze === 'Uitzetten') return '<strong>Please note:</strong> without the payroll tax credit we withhold more wage tax, so your net salary will be lower. You may only have the credit applied by one employer at a time.';
    return '<strong>Please note:</strong> the payroll tax credit may only be applied by one employer at a time. If you have more than one job, choose the employer where you earn the most.';
  }
  if (keuze === 'Aanzetten') return '<strong>Let op:</strong> de loonheffingskorting mag maar bij &eacute;&eacute;n werkgever tegelijk worden toegepast. Heb je nog een andere baan waar de korting nu loopt? Zet die daar dan eerst stop - anders betaal je later belasting bij.';
  if (keuze === 'Uitzetten') return '<strong>Let op:</strong> zonder loonheffingskorting houden wij meer loonbelasting in en wordt je nettoloon lager. De korting mag maar bij &eacute;&eacute;n werkgever tegelijk worden toegepast.';
  return '<strong>Let op:</strong> de loonheffingskorting mag maar bij &eacute;&eacute;n werkgever tegelijk worden toegepast. Heb je meerdere banen? Kies dan de werkgever waar je het meeste verdient.';
}
function kortStep(label, tekst, link, linktekst) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr><td style="padding:14px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b"><p style="' + F + 'font-size:11px;font-weight:700;color:#009f4b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.5px">' + label + '</p><p style="' + F + 'font-size:13px;color:#333d3a;margin:0' + (link ? ' 0 7px' : '') + '">' + tekst + '</p>' + (link ? '<a href="' + link + '" style="' + F + 'font-size:12px;color:#009f4b;text-decoration:none;font-weight:700">&rarr; ' + linktekst + '</a>' : '') + '</td></tr></table>';
}
function kortingHtml(naam, keuze, ingang, deadline, isEN, isHer) {
  const kleur = isHer ? '#f5a623' : '#009f4b', n = esc(naam);
  const vink = keuze === 'Aanzetten' ? (isEN ? '<strong>Yes</strong>' : '<strong>Ja</strong>') : keuze === 'Uitzetten' ? (isEN ? '<strong>No</strong>' : '<strong>Nee</strong>') : (isEN ? 'the option of your choice' : 'de door jou gewenste optie');
  const L = isEN ? { head: isHer ? 'HR &middot; Reminder' : 'HR &middot; Payroll tax credit', greet: 'Dear ', s1t: 'Download the form "Model opgaaf gegevens voor de loonheffingen" from the Dutch Tax Administration.', s1l: 'Download form', s2t: 'Complete the form, tick ' + vink + ' at the question about the payroll tax credit, then sign and date it.', s3t: 'Upload the completed form (your name is already filled in).', s3l: 'Upload form', ingang: 'Requested start date: ', dl: 'Please submit before ', dlx: ' so we can process it in the next payroll run.', q: 'Questions? Just email us at', sign: 'Warm regards,', st: 'Step' }
    : { head: isHer ? 'HR &middot; Herinnering' : 'HR &middot; Loonheffingskorting', greet: 'Beste ', s1t: 'Download het formulier "Model opgaaf gegevens voor de loonheffingen" van de Belastingdienst.', s1l: 'Download formulier', s2t: 'Vul het formulier in, kruis bij de vraag over de loonheffingskorting ' + vink + ' aan, onderteken en zet de datum erbij.', s3t: 'Upload het ingevulde formulier (jouw naam staat al ingevuld).', s3l: 'Upload formulier', ingang: 'Gewenste ingangsdatum: ', dl: 'Lever het formulier aan v&oacute;&oacute;r ', dlx: ', dan verwerken we het in de eerstvolgende salarisrun.', q: 'Vragen? Mail ons gerust op', sign: 'Hartelijke groet,', st: 'Stap' };
  const titel = keuze === 'Aanzetten' ? (isEN ? 'Applying your payroll tax credit' : 'Loonheffingskorting aanzetten') : keuze === 'Uitzetten' ? (isEN ? 'Stopping your payroll tax credit' : 'Loonheffingskorting uitzetten') : (isEN ? 'Changing your payroll tax credit' : 'Loonheffingskorting wijzigen');
  let box = '';
  if (ingang) box += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr><td style="padding:12px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #009f4b;' + F + 'font-size:13px;color:#333d3a">' + L.ingang + '<strong>' + esc(ingang) + '</strong></td></tr></table>';
  if (deadline) box += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr><td style="padding:12px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:13px;color:#7a5c00">' + L.dl + '<strong>' + esc(deadline) + '</strong>' + L.dlx + '</td></tr></table>';
  return slaWrap(slaHead(kleur, L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 6px">' + L.greet + esc(voornaamVan(naam)) + ',</p><p style="' + F + 'font-size:12px;font-weight:700;color:#009f4b;margin:0 0 16px;text-transform:uppercase;letter-spacing:.5px">' + titel + '</p><p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + kortIntro(keuze, isEN, isHer) + '</p>'
    + kortStep(L.st + ' 1', L.s1t, isEN ? C.KORT_LB_EN : C.KORT_LB_NL, L.s1l) + kortStep(L.st + ' 2', L.s2t, '', '') + kortStep(L.st + ' 3', L.s3t, prefillKortingUrl(naam), L.s3l) + box
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 20px"><tr><td style="padding:12px 16px;background:#fff8e6;border-radius:8px;border-left:4px solid #f5a623;' + F + 'font-size:12px;color:#7a5c00;line-height:1.6">' + kortWarn(keuze, isEN) + '</td></tr></table>'
    + '<p style="' + P14 + 'margin:0 0 20px">' + L.q + ' <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a>.</p><p style="' + P14 + 'margin:0">' + L.sign + '<br><strong>' + (isEN ? 'The SLA HR team' : 'Het HR-team van SLA') + '</strong></p></td></tr>' + slaFoot());
}
function kortingPlain(naam, keuze, ingang, deadline, isEN, isHer) {
  const vinkNL = keuze === 'Aanzetten' ? 'Ja' : keuze === 'Uitzetten' ? 'Nee' : 'de gewenste optie', vinkEN = keuze === 'Aanzetten' ? 'Yes' : keuze === 'Uitzetten' ? 'No' : 'the option of your choice';
  if (isEN) return 'Dear ' + voornaamVan(naam) + ',\n\n' + kortStrip(kortIntro(keuze, true, isHer)) + '\n\nStep 1 - Download the form:\n' + C.KORT_LB_EN + '\n\nStep 2 - Complete it, tick "' + vinkEN + '" at the question about the payroll tax credit, sign and date.\n\nStep 3 - Upload the form:\n' + prefillKortingUrl(naam) + '\n\n' + (ingang ? 'Requested start date: ' + ingang + '\n' : '') + (deadline ? 'Please submit before ' + deadline + '.\n' : '') + '\n' + kortStrip(kortWarn(keuze, true)) + '\n\nQuestions? Just email hr@ilovesla.com.\n\nWarm regards,\nThe SLA HR team';
  return 'Beste ' + voornaamVan(naam) + ',\n\n' + kortStrip(kortIntro(keuze, false, isHer)) + '\n\nStap 1 - Download het formulier:\n' + C.KORT_LB_NL + '\n\nStap 2 - Vul in, kruis bij de loonheffingskorting "' + vinkNL + '" aan, onderteken en zet de datum erbij.\n\nStap 3 - Upload het formulier:\n' + prefillKortingUrl(naam) + '\n\n' + (ingang ? 'Gewenste ingangsdatum: ' + ingang + '\n' : '') + (deadline ? 'Aanleveren voor ' + deadline + '.\n' : '') + '\n' + kortStrip(kortWarn(keuze, false)) + '\n\nVragen? Mail ons gerust op hr@ilovesla.com.\n\nHartelijke groet,\nHet HR-team van SLA';
}

// ============================================================
// Documenten → salarisadministratie (buildSalarisHtml / buildKortingSalarisHtml_)
// ============================================================
function salarisHtml(naam, labels, kortKeuze, kortIngang) {
  const n = esc(naam);
  let body;
  if (kortKeuze !== undefined) {
    const actie = kortKeuze === 'Aanzetten' ? 'de loonheffingskorting <strong>aanzetten</strong>' : kortKeuze === 'Uitzetten' ? 'de loonheffingskorting <strong>uitzetten</strong>' : 'een <strong>wijziging van de loonheffingskorting</strong>';
    body = '<p style="' + P14 + 'line-height:1.7;margin:0 0 14px">In de bijlage het ondertekende formulier van <strong>' + n + '</strong> voor ' + actie + '.</p>' + (kortIngang ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr><td style="padding:12px 16px;background:#f8f3f0;border-radius:8px;border-left:4px solid #2b6cb0;' + F + 'font-size:13px;color:#333d3a"><strong>Gewenste ingangsdatum:</strong> ' + esc(kortIngang) + '</td></tr></table>' : '');
  } else {
    body = '<p style="' + P14 + 'line-height:1.7;margin:0 0 14px">In de bijlage de documenten van <strong>' + n + '</strong>:</p><ul style="margin:0 0 20px;padding-left:20px">' + labels.map(l => '<li style="' + F + 'font-size:13px;color:#333d3a;margin:0 0 4px">' + esc(l) + '</li>').join('') + '</ul>';
  }
  return slaWrap(slaHead('#2b6cb0', 'HR &middot; Salarisadministratie') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Beste,</p>' + body + '<p style="' + P14 + 'margin:0 0 20px">Vragen? <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p><p style="' + P14 + 'margin:0">Met vriendelijke groet,<br><strong>SLA HR Team</strong></p><p style="' + F + 'font-size:11px;color:#aaa;margin:18px 0 0">Automatisch verstuurd vanuit het SLA HR Dashboard</p></td></tr>' + slaFoot());
}
// Overplaatsing/standplaatswijziging naar salaris: de mutatie zelf (BV, ingangsdatum) + het ondertekende document als dat er is
function salarisOverplaatsingRegels(r) {
  const isStandpl = /standplaats/i.test(r.type || '') || (r.huidigeBV && r.huidigeBV === r.nieuweBV);
  return { isStandpl, regels: [['Medewerker', r.naam], ['Soort', isStandpl ? 'Standplaatswijziging (zelfde werkgever)' : 'Overplaatsing naar andere BV (andere werkgever, met behoud van dienstjaren)'], ['Van', r.huidigeBV || '-'], ['Naar', r.nieuweBV || '-'], ['Nieuwe standplaats', r.standplaats || '-'], ['Ingangsdatum', r.ingangsdatum || '-'], ['Functie', r.functie || '-'], ['In dienst sinds', r.datumIndienst || '-']] };
}
function salarisOverplaatsingHtml(r, labels) {
  const { isStandpl, regels } = salarisOverplaatsingRegels(r);
  const tabel = '<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse">' + regels.map(x => '<tr><td style="' + F + 'font-size:13px;color:#888078;padding:4px 16px 4px 0">' + esc(x[0]) + '</td><td style="' + F + 'font-size:13px;color:#333d3a;font-weight:700;padding:4px 0">' + esc(x[1]) + '</td></tr>').join('') + '</table>';
  const doc = labels.length ? 'In de bijlage: ' + esc(labels.join(', ')) + '.' : '<strong>Het ondertekende document is nog niet binnen</strong>; dat sturen we na zodra we het hebben. Wil je de mutatie alvast verwerken?';
  return slaWrap(slaHead('#2b6cb0', 'HR &middot; ' + (isStandpl ? 'Standplaatswijziging' : 'Overplaatsing') + ' doorgeven') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">Beste,</p><p style="' + P14 + 'line-height:1.7;margin:0 0 14px">Hierbij een ' + (isStandpl ? 'standplaatswijziging' : '<strong>overplaatsing naar een andere BV</strong>') + ' voor de salarisadministratie:</p>' + tabel + '<p style="' + P14 + 'line-height:1.7;margin:0 0 20px">' + doc + '</p><p style="' + P14 + 'margin:0 0 20px">Vragen? <a href="mailto:hr@ilovesla.com" style="color:#009f4b">hr@ilovesla.com</a></p><p style="' + P14 + 'margin:0">Met vriendelijke groet,<br><br><strong>SLA HR Team</strong></p></td></tr>' + slaFoot());
}
function salarisOverplaatsingPlain(r, labels) {
  const { isStandpl, regels } = salarisOverplaatsingRegels(r);
  return 'Beste,\n\nHierbij een ' + (isStandpl ? 'standplaatswijziging' : 'overplaatsing naar een andere BV') + ' voor de salarisadministratie:\n\n' + regels.map(x => x[0] + ': ' + x[1]).join('\n') + '\n\n' + (labels.length ? 'In de bijlage: ' + labels.join(', ') + '.' : 'Het ondertekende document is nog niet binnen; dat sturen we na. Wil je de mutatie alvast verwerken?') + '\n\nVragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team\n\n(Automatisch verstuurd vanuit het SLA HR Dashboard)';
}
function salarisPlain(naam, labels, kortKeuze, kortIngang) {
  if (kortKeuze !== undefined) {
    const actie = kortKeuze === 'Aanzetten' ? 'loonheffingskorting AANZETTEN' : kortKeuze === 'Uitzetten' ? 'loonheffingskorting UITZETTEN' : 'wijziging loonheffingskorting';
    return 'Beste,\n\nIn de bijlage het ondertekende formulier van ' + naam + ' voor ' + actie + '.' + (kortIngang ? '\nGewenste ingangsdatum: ' + kortIngang : '') + '\n\nVragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team\n\n(Automatisch verstuurd vanuit het SLA HR Dashboard)';
  }
  return 'Beste,\n\nIn de bijlage de documenten van ' + naam + ':\n- ' + labels.join('\n- ') + '\n\nVragen? hr@ilovesla.com\n\nMet vriendelijke groet,\nSLA HR Team\n\n(Automatisch verstuurd vanuit het SLA HR Dashboard)';
}

// --- Aanbod vaste arbeidsomvang (fase 2) ---
function oproepPlain(naam, bv, uren, reactiedatum, isEN) {
  const v = voornaamVan(naam) || naam;
  if (isEN) return 'Hi ' + v + ',\n\nGood news: you have now been working with us on an on-call basis for twelve months, so we would like to offer you fixed working hours (' + uren + ' hours per week). Dutch law requires this offer, and we are happy to make it. You will find the official offer attached.\n\nCould you let us know by ' + reactiedatum + ' whether you accept? Return the signed letter via the link below, or simply reply to this e-mail. Prefer to stay on call? That is fine too; then we will make you a new offer next year.\n\nUpload the signed letter: {{UPLOADLINK}}\n\nWarm regards,\nThe SLA HR team\n' + bv;
  return 'Hoi ' + v + ',\n\nGoed nieuws: je werkt nu twaalf maanden als oproepkracht bij ons, en daarom bieden we je graag een vast aantal uren aan (' + uren + ' uur per week). De wet schrijft dit aanbod voor, en we doen het met plezier. In de bijlage vind je het officiële aanbod.\n\nLaat je ons uiterlijk ' + reactiedatum + ' weten of je het aanbod aanneemt? Stuur de ondertekende brief terug via de link hieronder, of beantwoord gewoon deze e-mail. Blijf je liever oproepkracht? Ook prima; dan doen we je volgend jaar opnieuw een aanbod.\n\nOndertekende brief uploaden: {{UPLOADLINK}}\n\nHartelijke groet,\nHet HR-team van SLA\n' + bv;
}
function oproepHtml(naam, bv, uren, reactiedatum, isEN) {
  const L = isEN ? { head: 'An offer of fixed hours', greet: 'Hi ', intro: 'Good news: you have now been working with us on an on-call basis for twelve months, so we would like to offer you <strong>fixed working hours (' + esc(uren) + ' hours per week)</strong>. Dutch law requires this offer, and we are happy to make it. You will find the official offer attached.', actie: 'Could you let us know by <strong>' + esc(reactiedatum) + '</strong> whether you accept? Return the signed letter via the button below, or simply reply to this e-mail.', vrij: 'Prefer to stay on call? That is fine too; then we will make you a new offer next year.', knop: 'Upload signed letter', sign: 'Warm regards,' }
    : { head: 'Een aanbod voor vaste uren', greet: 'Hoi ', intro: 'Goed nieuws: je werkt nu twaalf maanden als oproepkracht bij ons, en daarom bieden we je graag een <strong>vast aantal uren aan (' + esc(uren) + ' uur per week)</strong>. De wet schrijft dit aanbod voor, en we doen het met plezier. In de bijlage vind je het offici&euml;le aanbod.', actie: 'Laat je ons uiterlijk <strong>' + esc(reactiedatum) + '</strong> weten of je het aanbod aanneemt? Stuur de ondertekende brief terug via de knop hieronder, of beantwoord gewoon deze e-mail.', vrij: 'Blijf je liever oproepkracht? Ook prima; dan doen we je volgend jaar opnieuw een aanbod.', knop: 'Ondertekende brief uploaden', sign: 'Hartelijke groet,' };
  const s = P14 + 'line-height:1.7;margin:0 0 16px';
  return slaWrap(slaHead('#009f4b', L.head) + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 16px">' + L.greet + esc(voornaamVan(naam)) + ',</p><p style="' + s + '">' + L.intro + '</p><p style="' + s + '">' + L.actie + '</p><p style="' + s + '">' + L.vrij + '</p>'
    + '<table cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="background:#009f4b;border-radius:8px"><a href="{{UPLOADLINK}}" style="' + F + 'display:inline-block;padding:13px 26px;color:#fff;text-decoration:none;font-weight:700;font-size:14px">' + L.knop + ' &rarr;</a></td></tr></table>'
    + '<p style="' + s + '">' + L.sign + '<br><strong>' + (isEN ? 'The SLA HR team' : 'Het HR-team van SLA') + '</strong><br><span style="color:#888078">' + esc(bv) + '</span></p></td></tr>' + slaFoot());
}

module.exports = { loonHtmlTweetalig, loonPlainTweetalig, LOON_TWEETALIG_ONDERWERP, oproepPlain, oproepHtml, KORT_KEUZES, kortSubject, kortingHtml, kortingPlain, salarisHtml, salarisPlain,
  slaWrap, slaHead, slaFoot, slaStep, prefillLoonUrl, prefillOntslagUrl, prefillKortingUrl, overplaatsingUploadUrl, salarisOverplaatsingHtml, salarisOverplaatsingPlain, indienstLink, personaliseerUploadLinks, LOON_TEMPLATES, loonPlain, loonHtml, esc, tekstNaarHtml, briefHtml, briefPlain, BRIEF_TEMPLATES, ontslagHtml, ontslagHerHtml, aanzeggingHtml, exitBlok, zonderExit, exitUitnodigingPlain, exitUitnodigingHtml, checkinOnderwerp, checkinPlain, checkinHtml, ONTSLAG_TEMPLATES, ontslagMailHtml, proeftijdHtml,
  HUISREGELS, regelsById, wrsPlain, wrsHtml, beschikbPlain, beschikbHtml, oosvPlain, oosvHtml,
  SOM_TYPES, SOM_KLEUR, SOM_SHEETKLEUR, SOM_HINTS, sommatieSubject, sommatieHtml, sommatiePlain, overplaatsingSubject, overplaatsingPlain, overplaatsingHtml };
