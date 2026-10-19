// ============================================================
// Publieke check-in-endpoint (fase 3a; geen login, beveiligd met het getekende token uit de mail).
//   POST { t, taal? }                 -> { naam (voornaam), moment, taal, vragen, voorbeeld }
//   POST { t, antwoorden, taal }      -> { ok }  (één keer per uitnodiging; lage score → mail aan HR + taak)
// Token { s:'checkin', i:<hr_checkin.id> }; i='voorbeeld' = HR-voorbeeld vanuit het dashboard (werkt ook gepauzeerd, slaat niets op).
// ============================================================
const { json, body, logActie } = require('./_lib/auth');
const CI = require('./_lib/checkin');
const V = require('./_lib/vragenlijst');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event);
    const tok = CI.leesToken(p.t);
    const taal = String(p.taal || 'NL').toUpperCase() === 'EN' ? 'EN' : 'NL';
    const voorbeeld = tok.i === 'voorbeeld';
    if (!voorbeeld && !(await CI.actief())) return json(200, { success: false, bericht: taal === 'EN' ? 'The check-in is temporarily unavailable. Please try again later.' : 'De check-in is tijdelijk niet beschikbaar. Probeer het later nog eens.' });
    if (!p.antwoorden) {
      let naam = 'Voorbeeld', moment = 30, klaar = false;
      if (!voorbeeld) { const r = await CI.rijVoor(tok); naam = r.naam; moment = r.moment; klaar = !!r.ingevuld_op; }
      return json(200, { success: true, naam: String(naam).split(/\s+/)[0], moment, taal, voorbeeld, klaar, vragen: V.vertaal(await CI.vragenConfig(), taal) });
    }
    if (voorbeeld) return json(200, { success: true, voorbeeld: true });
    const r = await CI.opslaan(tok, p.antwoorden, taal);
    await logActie({ door: 'checkin:' + r.rij.naam, actie: 'checkin', bron: 'checkin', veld: 'dag' + r.rij.moment, naam: r.rij.naam, nieuw: r.score == null ? '' : String(r.score), details: r.laag ? 'laag: ' + r.rij.laag_reden : 'ok' });
    return json(200, { success: true });
  } catch (e) {
    console.warn('checkin:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
