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
// Generieke upload-link in een (door HR bewerkte) tekst vervangen door de persoonlijke
function personaliseerUploadLinks(body, naam) {
  if (!body || !naam) return body;
  return String(body).split(C.UPLOAD_LOON).join(prefillLoonUrl(naam));
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

module.exports = { slaWrap, slaHead, slaFoot, slaStep, prefillLoonUrl, personaliseerUploadLinks, LOON_TEMPLATES, loonPlain, loonHtml, esc, tekstNaarHtml, briefHtml, briefPlain, BRIEF_TEMPLATES };
