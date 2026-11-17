// ============================================================
// v0.52.0 POST /api/loonstroken-import — loonstroken automatisch uit de mail van de salarisadministratie.
// Aangeroepen door het Apps Script apps-script/LoonstrokenImport.gs (draait onder hr@ilovesla.com):
// dat zoekt de mails "…, Periodeverslagen Maandelijks …" van HRM Online, pakt de bijlage Loonstroken_*.pdf
// en stuurt hem hierheen. Daarna gaat alles zoals bij slepen: knippen, koppelen, opslaan (verwerkBron).
//
// Beveiliging: geen Google-login (het is een script), maar een gedeelde sleutel in de header
// x-import-sleutel = env LOONSTROKEN_IMPORT_SECRET (min. 32 tekens, ook in de Script Properties van het Apps Script).
// Zonder die env-variabele staat het endpoint uit. Alleen PDF's met de naam Loonstroken_*.pdf, max 4 MB.
//   body: { naam:'Loonstroken_Maandelijks_2026_10_3.pdf', bestand:<base64>, onderwerp, van, datum, messageId }
// ============================================================
const crypto = require('crypto');
const { admin, json, body, logActie } = require('./_lib/auth');
const L = require('./_lib/loonstroken');
const { verwerkBron } = require('./loonstroken');

const MAX = 4 * 1024 * 1024;
function sleutelKlopt(gegeven) {
  const goed = String(process.env.LOONSTROKEN_IMPORT_SECRET || '');
  if (goed.length < 32) return null; // endpoint staat uit
  const a = crypto.createHash('sha256').update(String(gegeven || '')).digest(), b = crypto.createHash('sha256').update(goed).digest();
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  const h = event.headers || {};
  const ok = sleutelKlopt(h['x-import-sleutel'] || h['X-Import-Sleutel']);
  if (ok === null) return json(503, { success: false, bericht: 'Import staat uit: LOONSTROKEN_IMPORT_SECRET (min. 32 tekens) ontbreekt op Netlify.' });
  if (!ok) {
    try { await admin().from('hr_toegangslog').insert({ email: '(loonstroken-import)', actie: 'geweigerd', details: 'verkeerde importsleutel', ip: h['x-nf-client-connection-ip'] || null }); } catch (e) { /* */ }
    return json(401, { success: false, bericht: 'Ongeldige sleutel.' });
  }
  try {
    const p = body(event);
    const naam = String(p.naam || '');
    if (!/^Loonstroken[\w .\-]*\.pdf$/i.test(naam)) throw new Error('Alleen bijlagen met de naam Loonstroken_….pdf (' + naam + ').');
    const buf = Buffer.from(String(p.bestand || ''), 'base64');
    if (!buf.length || buf.length > MAX) throw new Error('Bestand is leeg of groter dan 4 MB.');
    if (buf.slice(0, 5).toString('latin1') !== '%PDF-') throw new Error('Dit is geen PDF.');
    const db = admin();
    const pad = 'bron/mail/' + new Date().toISOString().slice(0, 10) + '/' + Date.now() + '_' + naam.replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const up = await db.storage.from(L.BUCKET).upload(pad, buf, { contentType: 'application/pdf', upsert: false });
    if (up.error) throw new Error('Opslag: ' + up.error.message);
    const bron = (String(p.onderwerp || '').replace(/^(fwd?|fw|doorgestuurd):\s*/i, '') || naam).slice(0, 120);
    const res = await verwerkBron(db, pad, bron, 'automatisch (mail ' + String(p.van || 'salaris').slice(0, 60) + ')');
    await logActie({ door: 'loonstroken-import', actie: 'import', bron: 'loonstroken', veld: 'mail', naam: res.bvs.join(', '), nieuw: res.periodes.join(', '), details: bron + ' · ' + (p.messageId || '') + ' · ' + res.aantal + ' stroken, ' + res.nieuw + ' nieuw' });
    return json(200, Object.assign({ success: true }, res));
  } catch (e) {
    console.error('loonstroken-import', e);
    return json(500, { success: false, bericht: e.message || String(e) });
  }
};
exports._sleutelKlopt = sleutelKlopt;
