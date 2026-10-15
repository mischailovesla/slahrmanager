// ============================================================
// Mail versturen via Resend (REST, geen SDK nodig) + verzendlog.
// Vervangt MailApp.sendEmail uit Apps Script. Afzender: hr@ilovesla.com
// (domein ilovesla.com moet in Resend geverifieerd zijn).
// ============================================================
const { admin } = require('./auth');
const { AFZENDER_TEAM, HR_EMAIL } = require('./config');

function afzender() {
  return process.env.MAIL_FROM || (AFZENDER_TEAM + ' <' + HR_EMAIL + '>');
}

// opts: { to, subject, text, html, replyTo?, attachments?: [{filename, content(base64)}], tags? }
async function verstuur(opts) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY ontbreekt (Netlify env var)');
  if (!opts.to || String(opts.to).indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
  const payload = {
    from: afzender(),
    to: [String(opts.to).trim()],
    reply_to: opts.replyTo || HR_EMAIL,
    subject: opts.subject,
    text: opts.text || '',
    html: opts.html || undefined,
    attachments: opts.attachments || undefined,
    tags: opts.tags || undefined
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    let msg = 'Resend: HTTP ' + r.status + (j.message ? ' - ' + j.message : '');
    if (r.status === 403 || /domain/i.test(j.message || '')) msg += ' (is ilovesla.com geverifieerd in Resend?)';
    throw new Error(msg);
  }
  return j.id || '';
}

// Verzendlog in Supabase (migratie 0003). Faalt nooit hard.
async function logMail(rec) {
  try { await admin().from('hr_mails').insert(rec); }
  catch (e) { console.warn('hr_mails log mislukt:', e.message); }
}

module.exports = { verstuur, logMail, afzender };
