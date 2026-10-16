// GET /api/document?ref=sb:<id>:<key>  -> tijdelijke downloadlink (2 min) voor een Supabase-document; gelogd in hr_toegangslog via beveiligd
const { beveiligd, logActie } = require('./_lib/auth');
const U = require('./_lib/uploads');
exports.handler = beveiligd('document', async (event, g) => {
  const ref = (event.queryStringParameters || {}).ref;
  if (!U.isRef(ref)) throw new Error('Ongeldige documentverwijzing.');
  const r = await U.signedUrl(ref, 120);
  await logActie({ door: g.email, actie: 'document', bron: 'upload', veld: r.bestand.key, rij: 0, naam: r.bestand.upload.naam, nieuw: ref, details: r.bestand.label });
  return { url: r.url, bestandsnaam: r.bestand.naam_orig, label: r.bestand.label };
});
