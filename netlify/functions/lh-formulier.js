// ============================================================
// v0.44.0: publiek endpoint voor de digitale loonheffingsverklaring (public/loonheffing.html). Geen login:
// het getekende loonheffings-token uit de HR-mail (zelfde als bij het indiensttredingsformulier) bepaalt voor wie het is.
//   POST { t }                              -> { naam, voorinvullen, model, al }
//   POST { t, stap:'adres', postcode, huisnummer }
//   POST { t, stap:'verstuur', gegevens }   -> valideert, maakt de PDF, zet hem in het dossier (→ salaris)
// ============================================================
const { json, body, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
const L = require('./_lib/lhformulier');
const I = require('./_lib/indienst');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event), tok = U.leesToken(p.t);
    if (tok.s !== 'loon') throw new Error('Ongeldige link.');
    if (!p.stap) {
      const [pre, model, al] = await Promise.all([L.voorinvullen(tok.n), L.huidigModel(), L.alAanwezig(tok.n).catch(() => null)]);
      return json(200, { success: true, naam: tok.n, voorinvullen: pre, model: { code: model.code }, al: al ? { op: al.op, web: al.web } : null });
    }
    if (p.stap === 'adres') { const a = await I.zoekAdres(p.postcode, p.huisnummer); return json(200, { success: true, adres: a || null, bereikbaar: a !== undefined }); }
    if (p.stap === 'verstuur') {
      const v = L.valideer(p.gegevens, tok);
      if (v.ok && !v.schoon.buitenland) Object.assign(v.fouten, await I.controleerAdres(v.schoon));
      const sugg = v.fouten._suggestie; delete v.fouten._suggestie;
      if (Object.keys(v.fouten).length) { await I.logFouten(tok.n, Object.keys(v.fouten).map(k => 'lh-' + k), 'loonheffing').catch(() => {}); return json(200, { success: false, fouten: v.fouten, suggestie: sugg ? { woonplaats: sugg } : null, bericht: 'Controleer de gemarkeerde velden.' }); }
      const h = event.headers || {}, ip = h['x-nf-client-connection-ip'] || h['client-ip'] || null;
      const r = await L.opslaan(tok, v.schoon, { ip, browser: h['user-agent'] || '', handtekening: v.handtekening });
      // logboek zonder BSN
      await logActie({ door: 'loonheffingformulier:' + tok.n, actie: 'upload', bron: 'loon', veld: 'loon', naam: tok.n, nieuw: r.id,
        details: 'Loonheffingsverklaring digitaal ondertekend · loonheffingskorting ' + (v.schoon.lhk === 'ja' ? 'ja vanaf ' + v.schoon.lhkVanaf : 'nee') + ' · model ' + r.gegevens.model + ' · SHA-256 ' + r.pdfHash.slice(0, 16) + '…' + (r.gegevens.bsnGelijkAanIndienst === false ? ' · LET OP: BSN wijkt af van het indiensttredingsformulier' : '') });
      return json(200, { success: true, lhk: v.schoon.lhk });
    }
    return json(400, { success: false, bericht: 'Onbekende stap' });
  } catch (e) {
    console.warn('lh-formulier:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
