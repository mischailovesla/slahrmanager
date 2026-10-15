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
  const loonOpen = loon.filter(d => d.mahdia !== 'Ja' && ((isVerzonden(d.status) && d.ontvangen !== 'Ja') || d.herinnering));
  const ontslagOpen = ontslag.filter(d => d.mahdia !== 'Ja' && ((isVerzonden(d.status) && d.ondertekend !== 'Ja') || d.herinnering));
  const somOpen = som.filter(d => d.verwerkt !== 'Ja');
  const oplOpen = opl.filter(d => isVerzonden(d.status) && d.ondertekend !== 'Ja');

  // Aanzegging-alert: einddatum binnen AANZEG_VENSTER_DAGEN en nog niet verstuurd/ondertekend
  const aanzegAlerts = ontslag
    .map(d => ({ d, dagen: dagenTot(parseNLDatum(d.einddatum)) }))
    .filter(x => x.dagen !== null && x.dagen >= 0 && x.dagen <= AANZEG_VENSTER_DAGEN && x.d.ondertekend !== 'Ja')
    .map(x => ({ naam: x.d.naam, email: x.d.email, bedrijf: x.d.bedrijf, einddatum: x.d.einddatum, dagen: x.dagen, status: x.d.status, type: x.d.type }))
    .sort((a, b) => a.dagen - b.dagen);

  return {
    bijgewerkt: new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
    stats: {
      loonTotaal: loon.length, loonOntvangen: loon.filter(d => d.ontvangen === 'Ja').length,
      ontslagTotaal: ontslag.length, ontslagOndertekend: ontslag.filter(d => d.ondertekend === 'Ja').length,
      sommaties: som.length, overplaatsingen: opl.length
    },
    werklijst: { instroom: loon.filter(d => d.ontvangen !== 'Ja').length, indienst: oplOpen.length, dossier: somOpen.length, uitstroom: ontslagOpen.length },
    aanzegAlerts,
    open: {
      loonheffing: loonOpen, ontslag: ontslagOpen, sommatie: somOpen, overplaatsing: oplOpen
    }
  };
});
