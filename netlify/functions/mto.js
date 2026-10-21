// ============================================================
// Publieke MTO-endpoint (fase 5; geen login, beveiligd met het getekende token uit de mail).
//   POST { t, taal? }                                        -> { naam (voornaam), ronde, sluit, groep, vragen, klaar, voorbeeld }
//   POST { t, taal, antwoorden, enps, prioriteit, opmerking } -> { ok }  (één keer per uitnodiging, anoniem opgeslagen)
// Token { s:'mto', i:<hr_mto_uitnodiging.id> }; i='voorbeeld' (of 'voorbeeld-manager') = HR-voorbeeld, slaat niets op.
// ============================================================
const { json, body } = require('./_lib/auth');
const MTO = require('./_lib/mto');
const Q = require('./_lib/mto-vragen');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event);
    const tok = MTO.leesToken(p.t);
    const taal = String(p.taal || 'NL').toUpperCase() === 'EN' ? 'EN' : 'NL', en = taal === 'EN';
    const voorbeeld = /^voorbeeld/.test(tok.i);
    if (!p.antwoorden) {
      if (voorbeeld) { const groep = tok.i === 'voorbeeld-manager' ? 'manager' : 'medewerker'; return json(200, { success: true, voorbeeld: true, naam: 'Voorbeeld', ronde: 'Voorbeeld', sluit: '', groep, minN: MTO.MIN_N, klaar: false, vragen: Q.voorPagina(taal, groep) }); }
      const { u, ronde } = await MTO.uitnodigingVoor(tok);
      if (!ronde || ronde.status !== 'open') return json(200, { success: false, bericht: en ? 'This survey round has closed. Thank you for your interest!' : 'Deze ronde is gesloten. Bedankt voor je interesse!' });
      const sluit = ronde.sluit_op ? new Date(ronde.sluit_op).toLocaleDateString(en ? 'en-GB' : 'nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' }) : '';
      return json(200, { success: true, naam: String(u.naam || '').split(/\s+/)[0], ronde: ronde.naam, sluit, groep: u.groep, minN: MTO.MIN_N, klaar: !!u.ingevuld, vragen: Q.voorPagina(taal, u.groep) });
    }
    if (voorbeeld) { Q.valideer(p, taal); return json(200, { success: true, voorbeeld: true }); }
    await MTO.opslaan(tok, p, taal);
    return json(200, { success: true }); // bewust geen logActie met naam: de reactie is anoniem
  } catch (e) {
    console.warn('mto:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
