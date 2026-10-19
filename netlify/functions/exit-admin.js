// ============================================================
// HR-kant van de exit-survey (ingelogd).
//   GET  /api/exit-admin?maanden=12   -> { rijen (alle reacties, nieuwste eerst), uitnodigingen (handmatig verstuurd), vertrokken (Shiftbase, laatste 12 mnd), vragen }
//   POST /api/exit-admin { naam, email, taal, preview? } -> uitnodigingsmail met persoonlijke link (ook voor wie al uit dienst is); log hr_mails bron 'exit'
//   POST { actie:'actief', actief:true|false }         -> schakelaar (hr_instellingen 'exit_actief'); uit = geen link in brieven/mails, pagina dicht
//   POST { actie:'vragen', vragen:[{key,type,nl,en,opties}] } -> vragenlijst opslaan (hr_instellingen 'exit_vragen'); { actie:'vragen', herstel:true } = terug naar config.js
//   POST { actie:'voorbeeld', taal }                   -> link naar de survey-pagina in voorbeeldstand (niets wordt opgeslagen)
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const X = require('./_lib/exit');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const C = require('./_lib/config');
const I = require('./_lib/instellingen');

exports.handler = beveiligd('exit-admin', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie === 'actief') {
      if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de exit-survey aan- of uitzetten.');
      const aan = p.actief === true || p.actief === 'true';
      await I.schrijf('exit_actief', aan, g.email);
      await logActie({ door: g.email, actie: 'instelling', bron: 'exit', veld: 'exit_actief', nieuw: aan ? 'aan' : 'uit', details: aan ? 'Exit-survey aangezet' : 'Exit-survey gepauzeerd' });
      return { bericht: aan ? 'Exit-survey staat aan: de link gaat weer mee in brieven en mails.' : 'Exit-survey gepauzeerd: geen link in brieven/mails, pagina gesloten.', actief: aan };
    }
    if (p.actie === 'vragen') {
      if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de vragen aanpassen.');
      if (p.herstel) { await I.schrijf('exit_vragen', [], g.email); /* leeg = terug naar config.EXIT_VRAGEN (jsonb mag niet null zijn) */ await logActie({ door: g.email, actie: 'instelling', bron: 'exit', veld: 'exit_vragen', nieuw: 'standaard', details: 'Vragen teruggezet naar config.js' }); return { bericht: 'Vragen teruggezet naar de standaardlijst.', vragen: C.EXIT_VRAGEN }; }
      const lijst = X.normaliseerVragen(p.vragen);
      await I.schrijf('exit_vragen', lijst, g.email);
      await logActie({ door: g.email, actie: 'instelling', bron: 'exit', veld: 'exit_vragen', nieuw: lijst.length + ' vragen', details: lijst.map(v => v.key).join(', ') });
      return { bericht: lijst.length + ' vragen opgeslagen. Reacties die al binnen zijn houden hun eigen antwoorden.', vragen: lijst };
    }
    if (p.actie === 'voorbeeld') return { link: X.exitLink('Voorbeeld', p.taal || 'NL', 'voorbeeld') };
    if (!(await X.actief())) throw new Error('De exit-survey is gepauzeerd. Zet hem eerst aan (Instellingen hieronder) voordat je uitnodigingen verstuurt.');
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
  const labels = {}; (await X.vragenConfig()).forEach(v => { if (v.opties) v.opties.forEach(o => { labels[v.key + ':' + o[0]] = o[1]; }); });
  const ingevuldNamen = new Set((rijen || []).map(r => String(r.naam || '').toLowerCase()).filter(Boolean));
  const uitgenodigd = new Set((uitn || []).map(u => String(u.naam || '').toLowerCase()));
  const vragenCfg = await X.vragenConfig(); const eigen = await I.lees('exit_vragen', null);
  return {
    maanden, actief: await X.actief(), vragenConfig: vragenCfg, standaard: !(Array.isArray(eigen) && eigen.length), vragen: await X.vragen('NL'), types: X.TYPES,
    rijen: (rijen || []).map(r => ({ id: r.id, op: ddmm(r.ingevuld_op), naam: r.anoniem ? '' : r.naam, anoniem: !!r.anoniem, email: r.email, winkel: r.winkel, bv: r.bv, bron: r.bron, taal: r.taal, nps: r.nps, opmerking: r.opmerking,
      antwoorden: r.antwoorden || {}, labels: Object.keys(r.antwoorden || {}).reduce((o, k) => { const l = labels[k + ':' + r.antwoorden[k]]; if (l) o[k] = l; return o; }, {}) })),
    uitnodigingen: (uitn || []).map(u => ({ naam: u.naam, naar: u.naar, taal: u.taal, op: u.tijdstip ? new Date(u.tijdstip).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'short', timeStyle: 'short' }) : '', door: u.door })),
    vertrokken: vertrokken.map(v => Object.assign(v, { ingevuld: ingevuldNamen.has(v.naam.toLowerCase()), uitgenodigd: uitgenodigd.has(v.naam.toLowerCase()) }))
  };
});
