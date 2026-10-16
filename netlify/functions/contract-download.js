// GET /api/contract-download?id=<attachment id>&naam=...  (getContractBase64, Contract.gs) — intern gebruik
const { beveiligd, logActie } = require('./_lib/auth');
const D = require('./_lib/datum');
exports.handler = beveiligd('contract-download', async (event, g) => {
  const qs = event.queryStringParameters || {};
  const id = String(qs.id || '').replace(/[^\w-]/g, ''), naam = String(qs.naam || '');
  if (!id) throw new Error('Geen attachment-id.');
  const key = process.env.SHIFTBASE_KEY; if (!key) throw new Error('SHIFTBASE_KEY ontbreekt');
  const r = await fetch('https://api.shiftbase.com/api/attachments/' + id + '/download', { headers: { Authorization: 'API ' + key } });
  if (!r.ok) throw new Error('Shiftbase-download mislukt: HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('Contract is geen geldige PDF (magic bytes: "' + buf.slice(0, 4).toString() + '").');
  await logActie({ door: g.email, actie: 'download', bron: 'contract', veld: 'contract-pdf', rij: 0, naam, nieuw: id, details: 'Arbeidscontract gedownload (intern)' });
  return { base64: buf.toString('base64'), mime: 'application/pdf', bestandsnaam: 'Arbeidscontract_' + D.veiligeNaam(naam) + '.pdf' };
});
