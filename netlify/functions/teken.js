// ============================================================
// Publieke endpoint voor digitaal ondertekenen (fase 6; geen login, beveiligd met de persoonlijke link uit de mail
// + een eenmalige code per mail). Token = hetzelfde getekende upload-token (soort + naam).
//   POST { t }                                         -> { teken: { titel, status, email (gemaskeerd), pdf (tijdelijke link) } }
//   POST { t, stap:'code' }                            -> code van 6 cijfers naar het e-mailadres van de brief
//   POST { t, stap:'teken', code, naam, akkoord, handtekening? } -> ondertekenen
// ============================================================
const { json, body, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
const ON = require('./_lib/ondertekening');
const { zetVinkje } = require('./_lib/vinkje');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event);
    const tok = U.leesToken(p.t);
    if (!['ontslag', 'overplaatsing'].includes(tok.s)) throw new Error('Voor dit document is digitaal ondertekenen niet beschikbaar.');
    const h = event.headers || {};
    const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || String(h['x-forwarded-for'] || '').split(',')[0].trim() || '';
    const ua = h['user-agent'] || '';
    if (!p.stap) { const i = await ON.info(tok); return json(200, { success: true, teken: i }); }
    if (p.stap === 'code') {
      const r = await ON.stuurCode(tok);
      await logActie({ door: 'ondertekening:' + tok.n, actie: 'teken-code', bron: tok.s, naam: tok.n, details: 'code naar ' + r.email + (ip ? ' · ' + ip : '') });
      return json(200, Object.assign({ success: true }, r));
    }
    if (p.stap === 'teken') {
      const res = await ON.teken(tok, p, { ip, ua });
      let rij = 0; try { rij = await zetVinkje(tok, res.reg.refs); } catch (e) { console.warn('teken vinkje:', e.message); }
      await logActie({ door: 'ondertekening:' + tok.n, actie: 'ondertekend', bron: tok.s, veld: res.r.type || tok.s, rij, naam: tok.n, nieuw: res.reg.id, details: res.r.titel + ' · digitaal ondertekend ' + res.tijd + ' · SHA-256 ' + res.hash.slice(0, 16) + '…' + (ip ? ' · ' + ip : '') });
      return json(200, { success: true, tijd: res.tijd, hash: res.hash });
    }
    return json(400, { success: false, bericht: 'Onbekende stap' });
  } catch (e) {
    console.warn('teken:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
