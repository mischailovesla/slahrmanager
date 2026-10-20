// ============================================================
// POST /api/salaris-mail  (port van stuurDocsNaarSalaris v29.3 + stuurKortingNaarSalaris)
// { type:'loonheffing'|'ontslag'|'korting', rij }
//  - haalt de geüploade formulieren uit Supabase Storage (eigen uploadpagina, _lib/uploads.js)
//    en mailt ze als bijlage naar SALARIS_EMAIL (Mahdia / HRM Online) in SLA-huisstijl
//  - logt de tijdstempel: loonheffing K, ontslag O, korting M (groen)
//  - oude Google-Forms-uploads (Drive-links) kunnen niet automatisch mee: antwoord { success:false, upload:{...} } → het dashboard
//    laat HR het document uit Drive downloaden en hier uploaden (/api/document-upload) en stuurt daarna opnieuw. zonderDrive:1 = toch versturen zonder.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const T = require('./_lib/sjablonen');
const M = require('./_lib/mail');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const U = require('./_lib/uploads');

exports.handler = beveiligd('salaris-mail', async (event, g) => {
  if (event.httpMethod !== 'POST') throw new Error('Gebruik POST');
  const p = body(event);
  const type = String(p.type || ''), rij = parseInt(p.rij, 10) || 0;
  if (['loonheffing', 'ontslag', 'korting', 'overplaatsing'].indexOf(type) === -1) throw new Error('Onbekend type: ' + type);
  if (!rij) throw new Error('Rijnummer ontbreekt.');
  const lijst = type === 'loonheffing' ? await S.getLoonheffing() : type === 'ontslag' ? await S.getOntslag() : type === 'overplaatsing' ? await S.getOverplaatsing() : await S.getKorting();
  const row = lijst.find(r => r.rij === rij);
  if (!row) throw new Error('Medewerker niet gevonden (rij ' + rij + ').');

  const bijlagen = [], labels = [];
  const oudeDrive = [];
  const driveKeys = [];
  const voeg = async (url, label, naamLabel, key) => {
    if (!url) return;
    if (!U.isRef(url)) { oudeDrive.push(naamLabel); driveKeys.push({ key, label: naamLabel, drive: url }); return; }
    bijlagen.push(await U.bestandMetLabel(url, label, row.naam)); labels.push(naamLabel);
  };
  if (type === 'loonheffing') { await voeg(row.docUrl, 'Loonheffingsverklaring', 'Loonheffingsverklaring', 'loon'); await voeg(row.docUrl2, 'Indiensttreding', 'Indiensttredingsformulier', 'indienst'); }
  else if (type === 'ontslag') await voeg(row.docUrl, 'Ontslagbevestiging_ondertekend', 'Ondertekende ontslagbevestiging', 'ontslag');
  else if (type === 'overplaatsing') {
    // v0.19.3: de mutatie gaat altijd mee in de mail; het ondertekende document als het er is. Zonder document eerst vragen.
    await voeg(row.docUrl, (/standplaats/i.test(row.type || '') ? 'Standplaatswijziging' : 'Overplaatsing') + '_ondertekend', 'Ondertekende ' + (/standplaats/i.test(row.type || '') ? 'standplaatswijziging' : 'overplaatsingsbrief'), 'overplaatsing');
    if (!bijlagen.length && !p.zonderDocument) return { success: false, geenDocument: true, bericht: 'Van ' + row.naam + ' is nog geen ondertekende brief binnen. Wil je de overplaatsing alvast doorgeven aan de salarisadministratie (alleen de gegevens, het document volgt later)?' };
    const isSt = /standplaats/i.test(row.type || '');
    const subject = (isSt ? 'Standplaatswijziging ' : 'Overplaatsing ') + row.naam + ' per ' + (row.ingangsdatum || '?') + (isSt ? '' : ' (' + (row.huidigeBV || '?') + ' → ' + (row.nieuweBV || '?') + ')') + (bijlagen.length ? '' : ' — document volgt');
    const resendId = await M.verstuur({ to: C.SALARIS_EMAIL, subject, text: T.salarisOverplaatsingPlain(row, labels), html: T.salarisOverplaatsingHtml(row, labels), attachments: bijlagen.length ? bijlagen.map(b => ({ filename: b.filename, content: b.content })) : undefined, tags: [{ name: 'bron', value: 'salaris' }, { name: 'type', value: type }] });
    const nu = D.stempel();
    await M.logMail({ door: g.email, bron: 'salaris', type, naar: C.SALARIS_EMAIL, naam: row.naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
    await logActie({ door: g.email, actie: 'mail', bron: type, veld: 'naar-salaris', rij, naam: row.naam, nieuw: nu, details: subject + ' (' + bijlagen.length + ' bijlage(n))' });
    return { bericht: (isSt ? 'Standplaatswijziging' : 'Overplaatsing') + ' van ' + row.naam + ' doorgegeven aan ' + C.SALARIS_EMAIL + (bijlagen.length ? ' met de ondertekende brief.' : ' (zonder document — stuur het ondertekende exemplaar later opnieuw).') + (oudeDrive.length ? ' LET OP: het document staat nog in Google Drive en is niet meegestuurd.' : ''), rij, salaris: nu, resendId };
  }
  else { if (!row.docUrl) throw new Error('Nog geen formulier retour ontvangen voor ' + row.naam + '.'); await voeg(row.docUrl, 'Loonheffingskorting', 'Formulier loonheffingskorting', 'korting'); }
  // Oud Google-formulier: document staat in Drive (geen Drive-API). HR downloadt het en uploadt het hier (/api/document-upload); daarna gaat het automatisch mee.
  if (driveKeys.length && !p.zonderDrive) return { success: false, upload: { type, rij, naam: row.naam, bestanden: driveKeys }, bericht: oudeDrive.join(' en ') + ' van ' + row.naam + ' staat nog in Google Drive (oud Google-formulier). Download het daar en upload het hier, dan gaat het mee naar salaris.' };
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
  return { bericht: bijlagen.length + ' document(en) van ' + row.naam + ' verstuurd naar ' + C.SALARIS_EMAIL + (oudeDrive.length ? '. LET OP: ' + oudeDrive.join(' en ') + ' staat nog in Google Drive en is niet meegestuurd.' : ''), rij, salaris: nu, resendId };
});
