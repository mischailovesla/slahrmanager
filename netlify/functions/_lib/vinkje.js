// Na een upload het vinkje/documentveld in het dossier zetten (gedeeld door de medewerker-upload en de HR-upload).
const S = require('./sheets');
const C = require('./config');
const { normNaam } = require('./util');

async function zetVinkje(tok, refs, rijHint) {
  const nn = normNaam(tok.n);
  const match = r => normNaam(r.naam) === nn;
  if (tok.s === 'loon') {
    const r = (await S.getLoonheffing()).find(match); if (!r) return 0;
    if (r.ontvangen !== 'Ja') await S.zetCel(C.SHEETS.loonheffing.id, null, r.rij, 6, 'Ja', S.KLEUR.groen);
    return r.rij;
  }
  if (tok.s === 'ontslag') {
    // v0.25.14: bij dubbele namen de juiste regel: de rij van de ondertekening, anders de nieuwste nog niet ondertekende
    const lijst = (await S.getOntslag()).filter(match); if (!lijst.length) return 0;
    const ts = x => { const m = String(x.verzenddatum || '').match(/(\d{2})-(\d{2})-(\d{4})/); return m ? m[3] + m[2] + m[1] : ''; };
    const r = (rijHint && lijst.find(x => x.rij === rijHint)) || lijst.filter(x => x.ondertekend !== 'Ja').sort((a, b) => ts(b).localeCompare(ts(a)))[0] || lijst[0];
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
  if (tok.s === 'overplaatsing') {
    const lijst = (await S.getOverplaatsing()).filter(match); // nieuwste niet-ondertekende eerst, anders de laatste
    const r = lijst.filter(x => x.ondertekend !== 'Ja').pop() || lijst[lijst.length - 1]; if (!r) return 0;
    if (r.ondertekend !== 'Ja') await S.zetCel(C.SHEETS.overplaatsing.id, C.SHEETS.overplaatsing.tab, r.rij, 13, 'Ja', S.KLEUR.groen);
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
