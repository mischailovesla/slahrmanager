// ============================================================
// v0.35.0: publiek endpoint voor het digitale indiensttredingsformulier (geen login; het getekende
// loonheffings-token uit de welkomstmail bepaalt voor wie het is).
//   POST { t }                    -> { naam, winkels, voorinvullen }
//   POST { t, stap:'verstuur', gegevens } -> valideert, maakt de PDF, zet hem in het dossier
// ============================================================
const { json, body, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
const I = require('./_lib/indienst');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, bericht: 'Gebruik POST' });
  try {
    const p = body(event), tok = U.leesToken(p.t);
    if (tok.s !== 'loon') throw new Error('Ongeldige link.');
    if (!p.stap) {
      // v0.35.1: teruggestuurd door HR → reden tonen en het vorige webformulier (zonder BSN/IBAN) vooraf invullen
      let retour = null, vorig = null;
      try { const x = await I.retourVoor(tok.n); if (x) retour = { reden: x.reden, velden: [].concat(...(x.velden || []).map(k => (I.RETOUR_VELDEN[k] || { velden: [] }).velden)) }; } catch (e) { retour = null; }
      try { vorig = await I.gegevensVan(tok.n, ''); } catch (e) { vorig = null; }
      const pre = await I.voorinvullen(tok.n);
      if (vorig) for (const [k] of I.VELDEN.concat([['straat'], ['huisnummer'], ['toevoeging'], ['nationaliteitAnders']])) if (vorig[k] && !['bsn', 'iban'].includes(k)) pre[k] = /^\d{2}-\d{2}-\d{4}$/.test(vorig[k]) && ['geboortedatum', 'datumIndienst'].includes(k) ? vorig[k].split('-').reverse().join('-') : vorig[k];
      return json(200, { success: true, naam: tok.n, winkels: I.WINKELS.map(w => ({ code: w.code, naam: w.naam })), nationaliteiten: I.NAT.NATIONALITEITEN.map(n => ({ code: n.code, nl: n.nl, en: n.en })), voorinvullen: pre, retour });
    }
    // v0.35.2: adres opzoeken bij postcode + huisnummer (PDOK) voor het automatisch invullen van straat en woonplaats
    if (p.stap === 'adres') { const a = await I.zoekAdres(p.postcode, p.huisnummer); return json(200, { success: true, adres: a || null, bereikbaar: a !== undefined }); }
    // v0.35.2: welke velden fout gingen (alleen de veldnamen, nooit de waarden) — om de uitleg te verbeteren
    if (p.stap === 'fouten') { await I.logFouten(tok.n, p.velden, 'browser'); return json(200, { success: true }); }
    if (p.stap === 'verstuur') {
      const v = I.valideer(p.gegevens);
      if (v.ok) Object.assign(v.fouten, await I.controleerAdres(v.schoon));
      const sugg = v.fouten._suggestie; delete v.fouten._suggestie;
      if (Object.keys(v.fouten).length) { await I.logFouten(tok.n, Object.keys(v.fouten), 'server'); return json(200, { success: false, fouten: v.fouten, suggestie: sugg ? { woonplaats: sugg } : null, bericht: 'Controleer de gemarkeerde velden.' }); }
      const ip = (event.headers || {})['x-nf-client-connection-ip'] || (event.headers || {})['client-ip'] || null;
      const r = await I.opslaan(tok, v.schoon, { ip });
      // logboek zonder BSN/IBAN
      await logActie({ door: 'indienstformulier:' + (v.schoon.email || tok.n), actie: 'upload', bron: 'loon', veld: 'indienst', naam: tok.n, nieuw: r.id, details: 'Webformulier ingevuld · ' + (r.winkel ? r.winkel.naam : v.schoon.vestiging) + ' · in dienst ' + v.schoon.datumIndienst + ' · ' + v.schoon.uren + ' u/week' });
      return json(200, { success: true });
    }
    return json(400, { success: false, bericht: 'Onbekende stap' });
  } catch (e) {
    console.warn('indienst:', e.message);
    return json(400, { success: false, bericht: e.message || String(e) });
  }
};
