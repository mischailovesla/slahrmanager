// GET  /api/document?ref=sb:<id>:<key>  -> tijdelijke downloadlink (2 min) voor een Supabase-document; gelogd in hr_toegangslog via beveiligd
//      v0.48.3: + leeg:true als het bestand 0 bytes is (mislukte upload)
// POST /api/document { actie:'verwijder-leeg', ref } -> v0.48.3: leeg document uit het dossier halen (alleen 0 bytes);
//      bij een loonheffingsverklaring gaat 'Ontvangen' weer uit, zodat de herinneringen weer lopen
const { beveiligd, body, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
exports.handler = beveiligd('document', async (event, g) => {
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie !== 'verwijder-leeg' && p.actie !== 'afkeuren') throw new Error('Onbekende actie.');
    if (p.actie === 'afkeuren' && String(p.reden || '').trim().length < 3) throw new Error('Geef een reden op.');
    if (!U.isRef(p.ref)) throw new Error('Ongeldige documentverwijzing.');
    const S = require('./_lib/sheets'), C = require('./_lib/config');
    const voor = p.ref.split(':')[2] === 'loon' ? (await S.getLoonheffing()).filter(r => r.docUrl === p.ref) : [];
    const uit = await U.verwijderLeeg(p.ref, g.email, p.actie === 'afkeuren' ? p.reden : '');
    let teruggezet = 0;
    if (voor.length) {
      if (S.vergeetCache) S.vergeetCache();
      const na = await S.getLoonheffing();
      for (const r of voor) { const nu = na.find(x => x.rij === r.rij); if (nu && nu.ontvangen === 'Ja' && !nu.docUrl && !nu.salaris) { await S.zetCel(C.SHEETS.loonheffing.id, null, r.rij, 6, '', S.KLEUR.wit); teruggezet++; } }
    }
    if (S.vergeetCache) S.vergeetCache();
    await logActie({ door: g.email, actie: 'verwijder', bron: 'upload', veld: uit.key, rij: voor.length ? voor[0].rij : 0, naam: uit.naam, oud: p.ref, nieuw: '', details: (p.actie === 'afkeuren' ? 'Document afgekeurd (' + String(p.reden).trim().slice(0, 200) + '): ' : 'Leeg document (0 bytes) verwijderd: ') + uit.label + (teruggezet ? '; Ontvangen weer uit' : '') });
    return { bericht: (p.actie === 'afkeuren' ? 'Document "' : 'Leeg document "') + uit.label + '" van ' + uit.naam + ' verwijderd.' + (teruggezet ? ' Het dossier staat weer op "wacht op formulier"; de herinneringen lopen weer.' : '') };
  }
  const ref = (event.queryStringParameters || {}).ref;
  if (!U.isRef(ref)) throw new Error('Ongeldige documentverwijzing.');
  if (/:contract$/.test(ref)) await require('./_lib/salarisinzage').eis(g.email, 'Dit contract');   // v0.42.0: contract op maat (met salaris)
  const r = await U.signedUrl(ref, 120);
  let leeg = false; try { leeg = (await U.grootte(r.bestand)) === 0; } catch (e) { /* onbekend: gewoon openen */ }
  await logActie({ door: g.email, actie: 'document', bron: 'upload', veld: r.bestand.key, rij: 0, naam: r.bestand.upload.naam, nieuw: ref, details: r.bestand.label });
  return { url: r.url, bestandsnaam: r.bestand.naam_orig, label: r.bestand.label, naam: r.bestand.upload.naam, leeg };
});
