// Na een upload het vinkje/documentveld in het dossier zetten (gedeeld door de medewerker-upload en de HR-upload).
const S = require('./sheets');
const C = require('./config');
const { normNaam } = require('./util');

async function zetVinkje(tok, refs) {
  const nn = normNaam(tok.n);
  const match = r => normNaam(r.naam) === nn;
  if (tok.s === 'loon') {
    const r = (await S.getLoonheffing()).find(match); if (!r) return 0;
    if (r.ontvangen !== 'Ja') await S.zetCel(C.SHEETS.loonheffing.id, null, r.rij, 6, 'Ja', S.KLEUR.groen);
    return r.rij;
  }
  if (tok.s === 'ontslag') {
    const r = (await S.getOntslag()).find(match); if (!r) return 0;
    if (r.ondertekend !== 'Ja') await S.zetCel(C.SHEETS.ontslag.id, null, r.rij, 10, 'Ja', S.KLEUR.groen);
    return r.rij;
  }
  if (tok.s === 'korting') {
    const open = (await S.getKorting()).filter(r => match(r) && r.retour !== 'Ja'); // nieuwste open dossier (lijst is nieuwste-eerst)
    const r = open[0]; if (!r) return 0;
    await S.zetCel(C.SHEETS.loonheffing.id, C.TAB_KORTING, r.rij, 9, 'Ja', S.KLEUR.groen);
    await S.zetCel(C.SHEETS.loonheffing.id, C.TAB_KORTING, r.rij, 10, refs.korting || '');
    return r.rij;
  }
  if (tok.s === 'oproep') {
    const open = (await S.getOproepaanbod()).filter(r => match(r) && !r.reactie); const r = open[0]; if (!r) return 0;
    await S.zetCel(C.SHEETS.ontslag.id, 'Oproepaanbod', r.rij, 14, 'Ontvangen (document)'); await S.zetCel(C.SHEETS.ontslag.id, 'Oproepaanbod', r.rij, 15, new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 16).replace('T', ' '));
    await S.zetCel(C.SHEETS.ontslag.id, 'Oproepaanbod', r.rij, 16, refs.oproep || '');
    return r.rij;
  }
  return 0;
}
module.exports = { zetVinkje };
