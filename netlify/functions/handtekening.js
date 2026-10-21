// GET  /api/handtekening              -> { naam, functie, png (data-url), ingesteld } van de ingelogde HR-medewerker
// POST { naam, functie, png?, wisHandtekening? } -> eigen handtekening opslaan (fase 6b)
const { beveiligd, body, logActie } = require('./_lib/auth');
const HT = require('./_lib/handtekening');

exports.handler = beveiligd('handtekening', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    const w = await HT.opslaan(g.email, p);
    await logActie({ door: g.email, actie: 'instelling', bron: 'handtekening', veld: 'handtekening', nieuw: w.png ? 'ingesteld' : 'geen', details: w.naam + (w.functie ? ' · ' + w.functie : '') });
    return { bericht: 'Handtekening opgeslagen. Nieuwe brieven die jij verstuurt, krijgen deze handtekening.', naam: w.naam, functie: w.functie, ingesteld: !!w.png };
  }
  const h = await HT.van(g.email, g.naam && g.naam !== g.email ? g.naam : '');
  return { naam: h.naam, functie: h.functie, ingesteld: h.ingesteld, png: h.png ? 'data:image/png;base64,' + h.png.toString('base64') : null, email: g.email };
});
