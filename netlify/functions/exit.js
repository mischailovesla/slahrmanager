// ============================================================
// Publieke exit-survey-endpoint (geen login; beveiligd met het getekende token uit de brief/mail).
//   POST { t }                                  -> { naam, taal, vragen:[...] }
//   POST { t, antwoorden:{key:waarde}, anoniem?, email? } -> { id, aantal }  (één keer per link; anoniem = naam niet bewaard)
// Winkel/BV/medewerker_id worden server-side uit Shiftbase gehaald (op naam), niet uit het formulier.
// ============================================================
const { json, body, logActie } = require('./_lib/auth');
const X = require('./_lib/exit');
const { normNaam } = require('./_lib/util');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event);
    const tok = X.leesExitToken(p.t);
    const isVoorbeeld = tok.b === 'voorbeeld'; // HR-voorbeeld vanuit het dashboard: wel bekijken, nooit opslaan
    if (!isVoorbeeld && !(await X.actief())) return json(200, { success: false, bericht: tok.t === 'EN' ? 'The exit survey is temporarily unavailable. Please try again later.' : 'De exit-survey is tijdelijk niet beschikbaar. Probeer het later nog eens.' });
    if (!p.antwoorden) { const taal = String(p.taal || tok.t || 'NL').toUpperCase() === 'EN' ? 'EN' : 'NL'; return json(200, { success: true, naam: tok.n, taal, voorbeeld: isVoorbeeld, vragen: await X.vragen(taal, tok.b) }); }
    if (isVoorbeeld) return json(200, { success: true, id: null, aantal: 0, voorbeeld: true });
    const meta = { anoniem: !!p.anoniem, email: p.email, ip: (event.headers || {})['x-nf-client-connection-ip'] || null };
    try {
      const med = await require('./_lib/shiftbase').getMedewerkers();
      const nn = normNaam(tok.n), m = (med || []).find(x => normNaam(x.naam) === nn);
      if (m) { meta.winkel = m.winkelNaam || ''; meta.bv = m.winkelBv || ''; meta.medewerker_id = String(m.id); if (!meta.email && !p.anoniem) meta.email = m.email || ''; }
    } catch (e) { console.warn('exit shiftbase:', e.message); }
    const r = await X.opslaan(tok, p.antwoorden, meta);
    await logActie({ door: 'exit:' + (p.anoniem ? 'anoniem' : tok.n), actie: 'exit-survey', bron: tok.b || 'exit', naam: p.anoniem ? null : tok.n, nieuw: r.id, details: r.aantal + ' antwoorden' + (p.anoniem ? ' (anoniem)' : '') });
    return json(200, { success: true, id: r.id, aantal: r.aantal });
  } catch (e) {
    console.warn('exit:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
