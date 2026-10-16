// ============================================================
// POST /api/salaris-mail  (port van stuurDocsNaarSalaris v29.3 + stuurKortingNaarSalaris)
// { type:'loonheffing'|'ontslag'|'korting', rij }
//  - haalt de geüploade formulieren (Drive, via het service account) op en
//    mailt ze als bijlage naar SALARIS_EMAIL (Mahdia / HRM Online) in SLA-huisstijl
//  - logt de tijdstempel: loonheffing K, ontslag O, korting M (groen)
// Vereist Drive API + upload-map gedeeld met het service account (zie _lib/drive.js).
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const DR = require('./_lib/drive');

exports.handler = beveiligd('salaris-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const type = String(p.type || ''), rij = parseInt(p.rij, 10) || 0;
  if (['loonheffing', 'ontslag', 'korting'].indexOf(type) === -1) throw new Error('Onbekend type: ' + type);
  if (!rij) throw new Error('Rijnummer ontbreekt.');
  const lijst = type === 'loonheffing' ? await S.getLoonheffing() : type === 'ontslag' ? await S.getOntslag() : await S.getKorting();
  const row = lijst.find(r => r.rij === rij);
  if (!row) throw new Error('Medewerker niet gevonden (rij ' + rij + ').');

  const bijlagen = [], labels = [];
  const voeg = async (url, label, naamLabel) => { const id = DR.fileIdVanUrl(url); if (!id) return; bijlagen.push(await DR.bestandMetLabel(id, label, row.naam)); labels.push(naamLabel); };
  if (type === 'loonheffing') { await voeg(row.docUrl, 'Loonheffingsverklaring', 'Loonheffingsverklaring'); await voeg(row.docUrl2, 'Indiensttreding', 'Indiensttredingsformulier'); }
  else if (type === 'ontslag') await voeg(row.docUrl, 'Ontslagbevestiging_ondertekend', 'Ondertekende ontslagbevestiging');
  else { if (!row.docUrl) throw new Error('Nog geen formulier retour ontvangen voor ' + row.naam + '.'); await voeg(row.docUrl, 'Loonheffingskorting', 'Formulier loonheffingskorting'); }
  if (!bijlagen.length) throw new Error('Geen document gevonden voor ' + row.naam + ' - is het formulier al geupload?');

  const isK = type === 'korting';
  const subject = isK ? 'Loonheffingskorting ' + row.naam + ' - ' + (row.keuze || 'wijziging') : 'Documenten ' + row.naam + ' - ' + labels.join(' + ');
  const html = isK ? T.salarisHtml(row.naam, labels, row.keuze || '', row.ingangsdatum || '') : T.salarisHtml(row.naam, labels);
  const text = isK ? T.salarisPlain(row.naam, labels, row.keuze || '', row.ingangsdatum || '') : T.salarisPlain(row.naam, labels);
  const resendId = await M.verstuur({ to: C.SALARIS_EMAIL, subject, text, html, attachments: bijlagen.map(b => ({ filename: b.filename, content: b.content })), tags: [{ name: 'bron', value: 'salaris' }, { name: 'type', value: type }] });
  const nu = D.stempel();
  await S.zetSalarisStempel(type, rij, nu);
  await M.logMail({ door: g.email, bron: 'salaris', type, naar: C.SALARIS_EMAIL, naam: row.naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: type, veld: 'naar-salaris', rij, naam: row.naam, nieuw: nu, details: subject + ' (' + bijlagen.length + ' bijlage(n))' });
  return { bericht: bijlagen.length + ' document(en) van ' + row.naam + ' verstuurd naar ' + C.SALARIS_EMAIL, rij, salaris: nu, resendId };
});
