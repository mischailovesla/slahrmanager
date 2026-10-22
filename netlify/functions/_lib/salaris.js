// ============================================================
// Documenten naar de salarisadministratie (Mahdia / HRM Online) — gedeeld door /api/salaris-mail (knop) en
// de automatische run op maandag en donderdag (sched-salaris, signaleringen 'salaris').
// stuur(type, row, door, opts) geeft hetzelfde terug als voorheen de knop: { bericht, ... } of { success:false, upload|geenDocument }.
// ============================================================
const { logActie } = require('./auth');
const S = require('./sheets');
const T = require('./sjablonen');
const M = require('./mail');
const C = require('./config');
const D = require('./datum');
const U = require('./uploads');

async function lijstVan(type) {
  return type === 'loonheffing' ? S.getLoonheffing() : type === 'ontslag' ? S.getOntslag() : type === 'overplaatsing' ? S.getOverplaatsing() : S.getKorting();
}

// v0.25.6: is de mail aan salaris geaccepteerd, dan staat "Naar salaris / Verwerkt" meteen aan (geen handmatig vinkje meer nodig).
const KOL_VERWERKT = { loonheffing: [C.SHEETS.loonheffing.id, 10], ontslag: [C.SHEETS.ontslag.id, 14] };
async function vinkVerwerkt(type, rij) {
  const k = KOL_VERWERKT[type]; if (!k || !rij) return;
  try { await S.zetCel(k[0], null, rij, k[1], 'Ja', S.KLEUR.groen); } catch (e) { console.warn('vinkje verwerkt:', e.message); }
}

async function stuur(type, row, door, p) {
  p = p || {}; const rij = row.rij;
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
    await M.logMail({ door: door, bron: 'salaris', type, naar: C.SALARIS_EMAIL, naam: row.naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
    await logActie({ door: door, actie: 'mail', bron: type, veld: 'naar-salaris', rij, naam: row.naam, nieuw: nu, details: subject + ' (' + bijlagen.length + ' bijlage(n))' });
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
  await vinkVerwerkt(type, rij);
  await M.logMail({ door: door, bron: 'salaris', type, naar: C.SALARIS_EMAIL, naam: row.naam, onderwerp: subject, taal: 'NL', rij, resend_id: resendId });
  await logActie({ door: door, actie: 'mail', bron: type, veld: 'naar-salaris', rij, naam: row.naam, nieuw: nu, details: subject + ' (' + bijlagen.length + ' bijlage(n))' });
  return { bericht: bijlagen.length + ' document(en) van ' + row.naam + ' verstuurd naar ' + C.SALARIS_EMAIL + (oudeDrive.length ? '. LET OP: ' + oudeDrive.join(' en ') + ' staat nog in Google Drive en is niet meegestuurd.' : ''), rij, salaris: nu, resendId };
}

module.exports = { stuur, lijstVan, vinkVerwerkt };
