// ============================================================
// Overzicht-tab: alle open dossiers + werklijst-tellingen.
// Zelfde selectie als rOv() + layVernieuw() in het Apps Script-dashboard.
// ============================================================
const { beveiligd } = require('./_lib/auth');
const S = require('./_lib/sheets');
const { AANZEG_VENSTER_DAGEN } = require('./_lib/config');
const { parseNLDatum, dagenTot } = require('./_lib/util');

exports.handler = beveiligd('overzicht', async () => {
  const [loon, ontslag, som, opl] = await Promise.all([S.getLoonheffing(), S.getOntslag(), S.getSommatie(), S.getOverplaatsing()]);

  const isVerzonden = s => s && (s.indexOf('Verzonden') === 0 || s.indexOf('Verstuurd') === 0);
  // v0.27.1: open = nog niet naar salaris (Mahdia) gestuurd. Getekend/ontvangen → kolom 'Klaar voor salaris'.
  // Na een geslaagde salarismail staat 'Verwerkt' automatisch op Ja (salaris.vinkVerwerkt) en is het dossier afgerond.
  // Alleen recente dossiers (verstuurd ≤ KLAAR_DAGEN geleden), zodat oude rijen van vóór de salaris-knop niet terugkomen.
  const KLAAR_DAGEN = 90;
  const recent = d => { const v = parseNLDatum(String(d.verzenddatum || '').split(' ')[0]); const n = v ? dagenTot(v) : null; return n !== null && n >= -KLAAR_DAGEN; };
  const loonOpen = loon.filter(d => d.mahdia !== 'Ja' && !d.salaris && ((isVerzonden(d.status) && (d.ontvangen !== 'Ja' || recent(d))) || d.herinnering));
  const ontslagOpen = ontslag.filter(d => d.mahdia !== 'Ja' && !d.salaris && ((isVerzonden(d.status) && (d.ondertekend !== 'Ja' || recent(d))) || d.herinnering));
  try { const ctl = await require('./_lib/dossiercontrole').laad(ontslag); ontslagOpen.forEach(r => { if (ctl[r.rij]) r.controle = ctl[r.rij]; }); } catch (e) { console.warn('dossiercontrole:', e.message); } // v0.27.2
  const somOpen = som.filter(d => d.verwerkt !== 'Ja');
  const oplOpen = opl.filter(d => isVerzonden(d.status) && d.ondertekend !== 'Ja');

  // Aanzegging-alert: einddatum binnen AANZEG_VENSTER_DAGEN en nog niet verstuurd/ondertekend
  const aanzegAlerts = ontslag
    .map(d => ({ d, dagen: dagenTot(parseNLDatum(d.einddatum)) }))
    .filter(x => x.dagen !== null && x.dagen >= 0 && x.dagen <= AANZEG_VENSTER_DAGEN && x.d.ondertekend !== 'Ja')
    .map(x => ({ naam: x.d.naam, email: x.d.email, bedrijf: x.d.bedrijf, einddatum: x.d.einddatum, dagen: x.dagen, status: x.d.status, type: x.d.type }))
    .sort((a, b) => a.dagen - b.dagen);

  // Deze week (vandaag t/m +6): starters, laatste werkdagen, proeftijd-einde, contract-einde — voor de tijdlijn op het Overzicht
  const week = [];
  const vandaag = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); vandaag.setHours(0, 0, 0, 0);
  const tot = new Date(vandaag.getTime() + 6 * 864e5);
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const inWeek = d => d && d >= vandaag && d <= tot;
  const { normNaam } = require('./_lib/util');
  const wegNaam = new Set();
  for (const d of ontslag) { const e = parseNLDatum(d.einddatum); if (inWeek(e)) { week.push({ datum: iso(e), soort: 'laatste', naam: d.naam, email: d.email || '', winkel: '' }); wegNaam.add(normNaam(d.naam)); } }
  try {
    const med = await require('./_lib/shiftbase').getMedewerkers();
    for (const m of med) {
      const s = parseNLDatum(m.indienst); if (inWeek(s)) week.push({ datum: iso(s), soort: 'start', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '' });
      const c = parseNLDatum(m.contractEinde); if (inWeek(c) && !wegNaam.has(normNaam(m.naam))) week.push({ datum: iso(c), soort: 'contract', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '' });
    }
    const winkelVan = {}; med.forEach(m => { winkelVan[normNaam(m.naam)] = m.winkelNaam || ''; });
    week.forEach(w => { if (!w.winkel) w.winkel = winkelVan[normNaam(w.naam)] || ''; });
  } catch (e) { console.warn('week (Shiftbase):', e.message); }
  try {
    const { data } = await require('./_lib/auth').admin().from('hr_signaleringen').select('details').eq('check', 'contractketen').order('tijdstip', { ascending: false }).limit(1);
    const gev = (data && data[0] && data[0].details && data[0].details.gevonden) || [];
    for (const g of gev) if (g.soort === 'proeftijd') { const p = parseNLDatum(g.proeftijdEinde); if (inWeek(p)) week.push({ datum: iso(p), soort: 'proeftijd', naam: g.naam, email: g.email || '', winkel: g.winkel || '' }); }
  } catch (e) { console.warn('week (proeftijd):', e.message); }
  week.sort((a, b) => a.datum.localeCompare(b.datum) || a.soort.localeCompare(b.soort) || a.naam.localeCompare(b.naam, 'nl'));

  return {
    week, vandaag: iso(vandaag),
    bijgewerkt: new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
    stats: {
      loonTotaal: loon.length, loonOntvangen: loon.filter(d => d.ontvangen === 'Ja').length,
      ontslagTotaal: ontslag.length, ontslagOndertekend: ontslag.filter(d => d.ondertekend === 'Ja').length,
      sommaties: som.length, overplaatsingen: opl.length
    },
    werklijst: { instroom: loon.filter(d => d.ontvangen !== 'Ja').length, indienst: oplOpen.length, dossier: somOpen.length, uitstroom: ontslagOpen.filter(d => d.ondertekend !== 'Ja').length },
    aanzegAlerts,
    open: {
      loonheffing: loonOpen, ontslag: ontslagOpen, sommatie: somOpen, overplaatsing: oplOpen
    }
  };
});
