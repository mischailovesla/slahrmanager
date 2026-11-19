// ============================================================
// v0.54.0: los document (pdf/foto/Word) toevoegen aan een medewerkersdossier, bijv. een mail met een reactie.
// POST /api/dossier-document
//   { stap:'start', naam, bestandsnaam, mime, bytes }                         -> { pad, token, bucket }  (getekende upload-URL)
//   { stap:'klaar', naam, email, omschrijving, pad, naam_orig, bytes, mime }   -> { id, ref }
// Opslag: hr_uploads soort 'dossier' (migratie 0027), bucket hr-documenten. Omschrijving + uploader in bestanden[0].
// ============================================================
const { beveiligd, body, logActie, admin } = require('./_lib/auth');
const U = require('./_lib/uploads');

exports.handler = beveiligd('dossier-document', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const naam = String(p.naam || '').trim();
  if (!naam) throw new Error('Naam van de medewerker ontbreekt.');
  const tok = { s: 'dossier', n: naam };
  if (p.stap === 'start') return await U.startUpload(tok, 'document', { naam: p.bestandsnaam, mime: p.mime, bytes: p.bytes });
  if (p.stap !== 'klaar') throw new Error('Onbekende stap');
  const omschrijving = String(p.omschrijving || '').trim().slice(0, 200);
  if (omschrijving.length < 3) throw new Error('Vul een korte omschrijving in.');
  require('./_lib/medisch').controleer(omschrijving); // geen medische informatie in het dossier (zoals bij notities)
  let reg;
  try { reg = await U.registreer(tok, [{ key: 'document', pad: p.pad, naam_orig: p.naam_orig, bytes: p.bytes, mime: p.mime }], { email: String(p.email || '').trim().toLowerCase() || null, handmatig: true }); }
  catch (e) { if (/soort_check|0013/.test(e.message)) throw new Error('Migratie 0027 is nog niet gedraaid in Supabase (supabase/migrations/0027_dossier_documenten.sql).'); throw e; }
  const bestanden = reg.bestanden.map(b => Object.assign({}, b, { label: omschrijving, omschrijving, door: g.email, toegevoegd_op: new Date().toISOString() }));
  const { error } = await admin().from('hr_uploads').update({ bestanden }).eq('id', reg.id);
  if (error) throw new Error('hr_uploads: ' + error.message);
  await logActie({ door: g.email, actie: 'upload', bron: 'dossier', veld: 'document', rij: 0, naam, nieuw: reg.id, details: 'Document toegevoegd aan dossier: ' + omschrijving + ' (' + (p.naam_orig || '') + ', ' + Math.round((Number(p.bytes) || 0) / 1024) + ' kB)' });
  return { id: reg.id, ref: reg.refs.document, bericht: 'Document "' + omschrijving + '" toegevoegd aan het dossier van ' + naam + '.' };
});
