// ============================================================
// Fase 6: digitaal ondertekenen (eenvoudige elektronische handtekening, art. 3:15a BW) met bewijsspoor.
// Flow: HR verstuurt de brief (ontslag-mail / overplaatsing-mail) → aanmaken() bewaart de PDF + SHA-256 →
// de medewerker opent zijn persoonlijke link (zelfde token als de upload-link) → vraagt een code van 6 cijfers aan
// (naar het e-mailadres waar de brief naartoe ging) → leest de brief, typt zijn naam, vinkt akkoord aan, tekent
// eventueel met de vinger → teken() controleert de code en de hash van het origineel, voegt een ondertekeningspagina
// + voetregel op elke pagina toe, bewaart de ondertekende PDF, registreert hem als upload (dossier op 'ondertekend',
// gaat mee naar salaris) en mailt de medewerker een kopie.
// ============================================================
const crypto = require('crypto');
const { admin } = require('./auth');
const U = require('./uploads');
const M = require('./mail');
const T = require('./sjablonen');
const P = require('./pdf');
const { normNaam } = require('./util');

const CODE_MINUTEN = 15, MAX_POGINGEN = 5, MAX_CODES_PER_DAG = 5, GELDIG_DAGEN = 60;
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const geheim = () => process.env.UPLOAD_SECRET || process.env.SUPABASE_SERVICE_KEY || '';
const codeHash = (id, code) => crypto.createHmac('sha256', 'teken|' + geheim()).update(id + '|' + code).digest('hex');
const slug = s => normNaam(s).replace(/\s+/g, '_').slice(0, 40) || 'medewerker';
const stempel = d => new Date(d).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const maskeer = e => { const [a, b] = String(e || '').split('@'); if (!b) return ''; return a.slice(0, 1) + '•••' + (a.length > 2 ? a.slice(-1) : '') + '@' + b; };
const fout = (e, wat) => { if (e) throw new Error(wat + ': ' + e.message + (/relation|does not exist/i.test(e.message) ? ' (migratie 0017 gedraaid?)' : '')); };

// Na het versturen van een brief: PDF bewaren en een open ondertekening aanmaken (oudere open versies → vervangen)
async function aanmaken(o) {
  if (!o || !o.pdf || !o.naam) return null;
  const db = admin(), id = crypto.randomUUID(), pad = 'teken/' + id + '/origineel.pdf';
  const { error: se } = await db.storage.from(U.BUCKET).upload(pad, o.pdf, { contentType: 'application/pdf', upsert: false });
  if (se) throw new Error('Storage: ' + se.message);
  await db.from('hr_ondertekening').update({ status: 'vervangen' }).eq('soort', o.soort).eq('naam', o.naam).eq('status', 'wacht');
  const { error } = await db.from('hr_ondertekening').insert({ id, soort: o.soort, type: o.type || '', titel: o.titel || '', naam: o.naam, email: String(o.email || '').trim().toLowerCase(), rij: o.rij || null, taal: o.taal === 'EN' ? 'EN' : 'NL', origineel_pad: pad, origineel_hash: sha(o.pdf), aangemaakt_door: o.door || '' });
  fout(error, 'Ondertekening aanmaken');
  return id;
}
// Open ondertekening bij een upload-token (soort + naam), binnen de geldigheid
async function openVoor(tok) {
  const { data, error } = await admin().from('hr_ondertekening').select('*').eq('soort', tok.s).eq('naam', tok.n).in('status', ['wacht', 'getekend']).order('aangemaakt_op', { ascending: false }).limit(1);
  if (error) return null; // tabel ontbreekt nog: gewoon de uploadpagina
  const r = (data || [])[0]; if (!r) return null;
  if (r.status === 'wacht' && (Date.now() - new Date(r.aangemaakt_op).getTime()) / 864e5 > GELDIG_DAGEN) return null;
  return r;
}
async function info(tok) {
  const r = await openVoor(tok); if (!r) return null;
  const { data } = await admin().storage.from(U.BUCKET).createSignedUrl(r.status === 'getekend' && r.getekend_pad ? r.getekend_pad : r.origineel_pad, 600);
  return { id: r.id, status: r.status, titel: r.titel, type: r.type, naam: r.naam, taal: r.taal, email: maskeer(r.email), heeftEmail: !!r.email, pdf: data ? data.signedUrl : '', getekendOp: r.getekend_op ? stempel(r.getekend_op) : '' };
}
async function rijVoor(tok) {
  const r = await openVoor(tok);
  if (!r) throw new Error('Er staat geen document klaar om te ondertekenen. / No document waiting for signature.');
  if (r.status === 'getekend') throw new Error('Dit document is al ondertekend. / This document has already been signed.');
  return r;
}
// Eenmalige code naar het e-mailadres waar de brief naartoe ging
async function stuurCode(tok) {
  const r = await rijVoor(tok), en = r.taal === 'EN';
  if (!r.email) throw new Error(en ? 'No e-mail address known. Please contact hr@ilovesla.com.' : 'Er is geen e-mailadres bekend. Neem contact op met hr@ilovesla.com.');
  const vandaag = r.code_verstuurd_op && new Date(r.code_verstuurd_op).toDateString() === new Date().toDateString();
  if (vandaag && r.codes_verstuurd >= MAX_CODES_PER_DAG) throw new Error(en ? 'Too many codes requested today. Try again tomorrow or contact hr@ilovesla.com.' : 'Vandaag zijn er te veel codes aangevraagd. Probeer het morgen opnieuw of mail hr@ilovesla.com.');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const tot = new Date(Date.now() + CODE_MINUTEN * 60000);
  const { error } = await admin().from('hr_ondertekening').update({ code_hash: codeHash(r.id, code), code_verstuurd_op: new Date().toISOString(), code_geldig_tot: tot.toISOString(), codes_verstuurd: vandaag ? r.codes_verstuurd + 1 : 1, code_pogingen: 0 }).eq('id', r.id).eq('status', 'wacht');
  fout(error, 'Code opslaan');
  const F = 'font-family:Arial,sans-serif;', v = String(r.naam).split(/\s+/)[0];
  const sub = en ? 'Your signing code: ' + code : 'Je code om te ondertekenen: ' + code;
  const html = T.slaWrap(T.slaHead('#009f4b', en ? 'Signing code' : 'Code om te ondertekenen') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 14px">' + (en ? 'Hi ' : 'Hoi ') + T.esc(v) + ',</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 18px">' + (en ? 'Use this code to sign <strong>' + T.esc(r.titel) + '</strong>. The code is valid for ' + CODE_MINUTEN + ' minutes.' : 'Met deze code onderteken je <strong>' + T.esc(r.titel) + '</strong>. De code is ' + CODE_MINUTEN + ' minuten geldig.') + '</p><p style="' + F + 'font-size:32px;font-weight:700;letter-spacing:8px;color:#333d3a;margin:0 0 18px">' + code + '</p><p style="' + F + 'font-size:12px;color:#888078;margin:0">' + (en ? 'Did you not request this code? Then you can ignore this e-mail, or let us know at hr@ilovesla.com.' : 'Heb je deze code niet aangevraagd? Dan kun je deze mail negeren, of laat het ons weten via hr@ilovesla.com.') + '</p></td></tr>' + T.slaFoot());
  await M.verstuur({ to: r.email, subject: sub, html, text: (en ? 'Your code to sign "' + r.titel + '": ' : 'Je code om "' + r.titel + '" te ondertekenen: ') + code + (en ? ' (valid for ' + CODE_MINUTEN + ' minutes)' : ' (' + CODE_MINUTEN + ' minuten geldig)'), tags: [{ name: 'bron', value: 'ondertekening' }, { name: 'type', value: 'code' }] });
  return { email: maskeer(r.email), minuten: CODE_MINUTEN };
}

// Ondertekeningspagina + voetregel op elke pagina
async function maakOndertekend(origBuf, r, s) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.load(origBuf);
  const F = { n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold) };
  const v = x => P.veilig(String(x == null ? '' : x));
  const groen = rgb(0, 0.624, 0.294), donker = rgb(0.2, 0.239, 0.227), grijs = rgb(0.533, 0.502, 0.471), zand = rgb(0.973, 0.953, 0.941);
  const en = r.taal === 'EN';
  const voet = v((en ? 'Digitally signed by ' : 'Digitaal ondertekend door ') + s.naam + (en ? ' on ' : ' op ') + s.tijd + ' · ' + (en ? 'verification code ' : 'controlecode ') + r.id.slice(0, 8));
  doc.getPages().forEach(pg => { pg.drawText(voet, { x: 40, y: 14, size: 6.5, font: F.n, color: grijs }); });
  const pg = doc.addPage([595.28, 841.89]), L = 56; let y = 780;
  const t = (x, xx, yy, size, font, kleur) => pg.drawText(v(x), { x: xx, y: yy, size, font: font || F.n, color: kleur || donker });
  t('SLA', L, y, 22, F.b, groen); t(en ? 'Signature page' : 'Ondertekeningspagina', L, y - 30, 15, F.b);
  t(r.titel, L, y - 48, 10, F.n, grijs); y -= 80;
  pg.drawRectangle({ x: L - 8, y: y - 132, width: 595.28 - 2 * L + 16, height: 140, color: zand });
  t(en ? 'Signed for receipt and approval by' : 'Voor ontvangst en akkoord ondertekend door', L, y - 8, 9, F.b, grijs);
  t(s.naam, L, y - 30, 16, F.b);
  if (s.png) {
    try { const img = await doc.embedPng(s.png); const h = 70, w = Math.min(260, img.width * (h / img.height)); pg.drawImage(img, { x: L, y: y - 118, width: w, height: h }); }
    catch (e) { t(en ? '(drawn signature could not be processed)' : '(getekende handtekening kon niet worden verwerkt)', L, y - 90, 8, F.n, grijs); }
  } else t(en ? '(signed by typing the name and confirming with a one-time code)' : '(ondertekend door de naam te typen en te bevestigen met een eenmalige code)', L, y - 60, 8, F.n, grijs);
  y -= 160;
  t(en ? 'Audit trail' : 'Bewijsspoor', L, y, 11, F.b, groen); y -= 18;
  const rijen = [
    [en ? 'Document' : 'Document', r.titel],
    [en ? 'Sent to' : 'Verstuurd naar', r.email + (en ? ' on ' : ' op ') + stempel(r.aangemaakt_op)],
    [en ? 'Identity check' : 'Identiteitscontrole', (en ? 'one-time code by e-mail to ' : 'eenmalige code per mail naar ') + r.email + (en ? ', requested ' : ', aangevraagd ') + stempel(r.code_verstuurd_op)],
    [en ? 'Signed on' : 'Ondertekend op', s.tijd + ' (Europe/Amsterdam)'],
    [en ? 'Typed name' : 'Getypte naam', s.naam],
    [en ? 'Statement' : 'Verklaring', en ? 'I have read this document and sign it for receipt and approval.' : 'Ik heb dit document gelezen en onderteken het voor ontvangst en akkoord.'],
    [en ? 'IP address' : 'IP-adres', s.ip || '-'],
    [en ? 'Browser / device' : 'Browser / apparaat', String(s.ua || '-').slice(0, 110)],
    [en ? 'Document fingerprint (SHA-256)' : 'Vingerafdruk document (SHA-256)', r.origineel_hash],
    [en ? 'Verification code' : 'Controlecode', r.id]
  ];
  for (const [k, w] of rijen) {
    t(k, L, y, 8, F.b, grijs);
    const woorden = v(w).split(/\s+/); let rg = '', yy = y; const max = 595.28 - L - 200;
    woorden.forEach(wd => { const p = rg ? rg + ' ' + wd : wd; if (F.n.widthOfTextAtSize(p, 8.5) > max && rg) { t(rg, L + 160, yy, 8.5); yy -= 11; rg = wd; } else rg = p; });
    if (rg) t(rg, L + 160, yy, 8.5);
    y = yy - 16;
  }
  y -= 10;
  const uitleg = en ? 'This document was signed with a simple electronic signature (art. 3:15a Dutch Civil Code / eIDAS). The fingerprint above belongs to the document as sent; the fingerprint of this signed version is stored by SLA HR and is included in the confirmation e-mail. Any change to this file changes the fingerprint.'
    : 'Dit document is ondertekend met een elektronische handtekening (art. 3:15a BW / eIDAS). De vingerafdruk hierboven hoort bij het document zoals het is verstuurd; de vingerafdruk van deze ondertekende versie is vastgelegd door SLA HR en staat in de bevestigingsmail. Elke wijziging aan dit bestand verandert de vingerafdruk.';
  const w2 = v(uitleg).split(/\s+/); let rg2 = '';
  w2.forEach(wd => { const p = rg2 ? rg2 + ' ' + wd : wd; if (F.n.widthOfTextAtSize(p, 7.5) > 595.28 - 2 * L && rg2) { t(rg2, L, y, 7.5, F.n, grijs); y -= 10; rg2 = wd; } else rg2 = p; });
  if (rg2) t(rg2, L, y, 7.5, F.n, grijs);
  pg.drawText(voet, { x: 40, y: 14, size: 6.5, font: F.n, color: grijs });
  doc.setSubject(v((en ? 'Signed by ' : 'Ondertekend door ') + s.naam + ' ' + s.tijd));
  return Buffer.from(await doc.save());
}

async function teken(tok, p, meta) {
  const r = await rijVoor(tok), en = r.taal === 'EN', db = admin();
  const E = (nl, eng) => new Error(en ? eng : nl);
  if (!r.code_hash || !r.code_geldig_tot) throw E('Vraag eerst een code aan.', 'Please request a code first.');
  if (r.code_pogingen >= MAX_POGINGEN) throw E('Te vaak een verkeerde code. Vraag een nieuwe code aan.', 'Too many wrong attempts. Please request a new code.');
  if (new Date(r.code_geldig_tot) < new Date()) throw E('De code is verlopen. Vraag een nieuwe code aan.', 'The code has expired. Please request a new code.');
  const code = String(p.code || '').replace(/\D/g, '');
  const goed = code.length === 6 && crypto.timingSafeEqual(Buffer.from(codeHash(r.id, code)), Buffer.from(r.code_hash));
  if (!goed) { await db.from('hr_ondertekening').update({ code_pogingen: r.code_pogingen + 1 }).eq('id', r.id); throw E('De code klopt niet.', 'The code is incorrect.'); }
  if (p.akkoord !== true) throw E('Vink aan dat je het document hebt gelezen.', 'Please confirm that you have read the document.');
  const naam = String(p.naam || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (naam.length < 3) throw E('Typ je volledige naam.', 'Please type your full name.');
  const achternaam = normNaam(r.naam).split(' ').pop();
  if (achternaam && normNaam(naam).indexOf(achternaam) === -1) throw E('Typ je naam zoals die in de brief staat (' + r.naam + ').', 'Please type your name as it appears in the letter (' + r.naam + ').');
  let png = null;
  if (p.handtekening) { const m = String(p.handtekening).match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/); if (m && m[1].length < 400000) png = Buffer.from(m[1], 'base64'); }
  // origineel ophalen en controleren
  const { data: blob, error: de } = await db.storage.from(U.BUCKET).download(r.origineel_pad);
  if (de) throw new Error('Document ophalen mislukt: ' + de.message);
  const orig = Buffer.from(await blob.arrayBuffer());
  if (sha(orig) !== r.origineel_hash) throw new Error('Het document is gewijzigd sinds het werd verstuurd en kan niet worden ondertekend. Neem contact op met HR.');
  const nu = new Date(), tijd = stempel(nu);
  const getekend = await maakOndertekend(orig, r, { naam, png, tijd, ip: meta.ip, ua: meta.ua });
  const hashNa = sha(getekend);
  const key = U.SOORTEN[tok.s].bestanden[0].key;
  const pad = tok.s + '/' + slug(tok.n) + '/' + Date.now() + '_' + key + '_digitaal_ondertekend.pdf';
  const { error: ue } = await db.storage.from(U.BUCKET).upload(pad, getekend, { contentType: 'application/pdf', upsert: false });
  if (ue) throw new Error('Opslaan mislukt: ' + ue.message);
  const bestandsnaam = String(r.titel || 'document').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '_ondertekend.pdf';
  const reg = await U.registreer(tok, [{ key, pad, naam_orig: bestandsnaam, bytes: getekend.length, mime: 'application/pdf' }], { email: r.email, ip: meta.ip });
  const { error: ee } = await db.from('hr_ondertekening').update({ status: 'getekend', getekend_op: nu.toISOString(), getekend_naam: naam, getekend_ip: meta.ip || '', getekend_browser: String(meta.ua || '').slice(0, 300), met_handtekening: !!png, getekend_pad: pad, getekend_hash: hashNa, upload_id: reg.id, code_hash: null }).eq('id', r.id).eq('status', 'wacht');
  fout(ee, 'Ondertekening vastleggen');
  // bevestiging met kopie aan de medewerker
  try {
    const F = 'font-family:Arial,sans-serif;', vn = String(r.naam).split(/\s+/)[0];
    const html = T.slaWrap(T.slaHead('#009f4b', en ? 'Signed' : 'Ondertekend') + '<tr><td style="padding:32px 36px 28px"><p style="' + F + 'font-size:15px;color:#333d3a;margin:0 0 14px">' + (en ? 'Hi ' : 'Hoi ') + T.esc(vn) + ',</p><p style="' + F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 16px">' + (en ? 'Thank you! You signed <strong>' + T.esc(r.titel) + '</strong> on ' + tijd + '. Attached is your copy, including the signature page.' : 'Bedankt! Je hebt <strong>' + T.esc(r.titel) + '</strong> ondertekend op ' + tijd + '. In de bijlage vind je jouw exemplaar, met de ondertekeningspagina.') + '</p><p style="' + F + 'font-size:11px;color:#888078;margin:0">' + (en ? 'Document fingerprint (SHA-256): ' : 'Vingerafdruk document (SHA-256): ') + hashNa + '</p></td></tr>' + T.slaFoot());
    await M.verstuur({ to: r.email, subject: (en ? 'Signed: ' : 'Ondertekend: ') + r.titel, html, text: (en ? 'You signed "' : 'Je hebt "') + r.titel + (en ? '" on ' : '" ondertekend op ') + tijd + '. SHA-256: ' + hashNa, attachments: [{ filename: bestandsnaam, content: getekend.toString('base64') }], tags: [{ name: 'bron', value: 'ondertekening' }, { name: 'type', value: 'bevestiging' }] });
    await M.logMail({ door: 'ondertekening', bron: 'ondertekening', type: r.type || r.soort, naar: r.email, naam: r.naam, onderwerp: (en ? 'Signed: ' : 'Ondertekend: ') + r.titel, taal: r.taal, rij: r.rij || 0, resend_id: '' });
  } catch (e) { console.warn('ondertekening bevestiging:', e.message); }
  return { r, reg, tijd, hash: hashNa };
}
// Voor het dashboard: alle ondertekeningen (laatste 6 maanden)
async function overzicht() {
  const van = new Date(Date.now() - 183 * 864e5).toISOString();
  const { data, error } = await admin().from('hr_ondertekening').select('id,soort,type,titel,naam,email,status,aangemaakt_op,aangemaakt_door,code_verstuurd_op,getekend_op,getekend_naam,getekend_ip,met_handtekening,getekend_hash,origineel_hash').gte('aangemaakt_op', van).order('aangemaakt_op', { ascending: false });
  fout(error, 'Ondertekeningen lezen');
  return (data || []).map(r => Object.assign({}, r, { aangemaakt: stempel(r.aangemaakt_op), getekend: r.getekend_op ? stempel(r.getekend_op) : '', codeAangevraagd: !!r.code_verstuurd_op }));
}
// Controle: hoort een PDF (SHA-256) bij een ondertekend document?
async function controleer(hash) {
  const h = String(hash || '').toLowerCase().trim(); if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('Ongeldige vingerafdruk.');
  const { data } = await admin().from('hr_ondertekening').select('id,titel,naam,status,getekend_op,getekend_hash,origineel_hash').or('getekend_hash.eq.' + h + ',origineel_hash.eq.' + h).limit(1);
  const r = (data || [])[0]; if (!r) return { gevonden: false };
  return { gevonden: true, soort: r.getekend_hash === h ? 'ondertekend' : 'origineel', titel: r.titel, naam: r.naam, status: r.status, getekend: r.getekend_op ? stempel(r.getekend_op) : '' };
}
module.exports = { aanmaken, openVoor, info, stuurCode, teken, overzicht, controleer, maskeer, sha };
