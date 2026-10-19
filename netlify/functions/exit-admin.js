// ============================================================
// HR-kant van de exit-survey (ingelogd).
//   GET  /api/exit-admin?maanden=12   -> { rijen (alle reacties, nieuwste eerst), uitnodigingen (handmatig verstuurd), vertrokken (Shiftbase, laatste 12 mnd), vragen }
//   POST /api/exit-admin { naam, email, taal, preview? } -> uitnodigingsmail met persoonlijke link (ook voor wie al uit dienst is); log hr_mails bron 'exit'
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const X = require('./_lib/exit');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const C = require('./_lib/config');

exports.handler = beveiligd('exit-admin', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    const naam = String(p.naam || '').trim(), to = String(p.to || p.email || '').trim().toLowerCase();
    const isEN = String(p.taal || 'NL').toUpperCase() === 'EN';
    if (!naam) throw new Error('Vul de naam in.');
    const link = X.exitLink(naam, isEN ? 'EN' : 'NL', 'handmatig');
    const subject = isEN ? 'How was it at SLA? Short exit survey' : 'Hoe was het bij SLA? Korte exit-survey';
    const text = T.exitUitnodigingPlain(naam, isEN).split('{{EXITLINK}}').join(link), html = T.exitUitnodigingHtml(naam, isEN).split('{{EXITLINK}}').join(link);
    if (p.preview) return { subject, text, html, link };
    if (!to || to.indexOf('@') === -1) throw new Error('Ongeldig e-mailadres.');
    const resendId = await M.verstuur({ to, subject, text, html, tags: [{ name: 'bron', value: 'exit' }] });
    await M.logMail({ door: g.email, bron: 'exit', type: 'uitnodiging', naar: to, naam, onderwerp: subject, taal: isEN ? 'EN' : 'NL', rij: 0, resend_id: resendId });
    await logActie({ door: g.email, actie: 'mail', bron: 'exit', veld: 'uitnodiging', rij: 0, naam, nieuw: to, details: subject });
    return { bericht: 'Exit-survey' + (isEN ? ' (EN)' : '') + ' verstuurd naar ' + to };
  }
  const q = event.queryStringParameters || {};
  const maanden = Math.min(Math.max(parseInt(q.maanden, 10) || 12, 1), 36);
  const van = new Date(); van.setMonth(van.getMonth() - maanden);
  const db = admin();
  const { data: rijen, error } = await db.from('hr_exit').select('*').gte('ingevuld_op', van.toISOString()).order('ingevuld_op', { ascending: false });
  if (error) throw new Error(error.message + ' (migratie 0009 gedraaid?)');
  const { data: uitn } = await db.from('hr_mails').select('naam,naar,taal,tijdstip,door').eq('bron', 'exit').order('tijdstip', { ascending: false }).limit(200);
  let vertrokken = [];
  try { vertrokken = await require('./_lib/shiftbase').getVertrokken(maanden); } catch (e) { console.warn('vertrokken:', e.message); }
  const ddmm = s => String(s || '').slice(0, 10).split('-').reverse().join('-');
  const labels = {}; C.EXIT_VRAGEN.forEach(v => { if (v.opties) v.opties.forEach(o => { labels[v.key + ':' + o[0]] = o[1]; }); });
  const ingevuldNamen = new Set((rijen || []).map(r => String(r.naam || '').toLowerCase()).filter(Boolean));
  const uitgenodigd = new Set((uitn || []).map(u => String(u.naam || '').toLowerCase()));
  return {
    maanden, vragen: X.vragen('NL'),
    rijen: (rijen || []).map(r => ({ id: r.id, op: ddmm(r.ingevuld_op), naam: r.anoniem ? '' : r.naam, anoniem: !!r.anoniem, email: r.email, winkel: r.winkel, bv: r.bv, bron: r.bron, taal: r.taal, nps: r.nps, opmerking: r.opmerking,
      antwoorden: r.antwoorden || {}, reden: labels['reden:' + ((r.antwoorden || {}).reden || '')] || '', terug: labels['terug:' + ((r.antwoorden || {}).terug || '')] || '' })),
    uitnodigingen: (uitn || []).map(u => ({ naam: u.naam, naar: u.naar, taal: u.taal, op: u.tijdstip ? new Date(u.tijdstip).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'short' }) : '', door: u.door })),
    vertrokken: vertrokken.map(v => Object.assign(v, { ingevuld: ingevuldNamen.has(v.naam.toLowerCase()), uitgenodigd: uitgenodigd.has(v.naam.toLowerCase()) }))
  };
});
