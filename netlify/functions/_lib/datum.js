// Datumhulpjes (Europe/Amsterdam) – vervangen Utilities.formatDate uit Apps Script
function delen(d, opties) {
  const f = new Intl.DateTimeFormat('nl-NL', Object.assign({ timeZone: 'Europe/Amsterdam' }, opties)).formatToParts(d || new Date());
  return k => (f.find(x => x.type === k) || {}).value || '';
}
// 'dd-MM-yyyy HH:mm'
function stempel(d) { const g = delen(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); return g('day') + '-' + g('month') + '-' + g('year') + ' ' + g('hour') + ':' + g('minute'); }
// 'dd-MM-yyyy'
function kort(d) { const g = delen(d, { day: '2-digit', month: '2-digit', year: 'numeric' }); return g('day') + '-' + g('month') + '-' + g('year'); }
// Briefdatum: 'dd MMMM yyyy' (NL) of 'MMMM d, yyyy' (EN)
function briefDatum(isEN, d) {
  d = d || new Date();
  if (isEN) return d.toLocaleDateString('en-US', { timeZone: 'Europe/Amsterdam', month: 'long', day: 'numeric', year: 'numeric' });
  const g = delen(d, { day: '2-digit', month: 'long', year: 'numeric' });
  return g('day') + ' ' + g('month') + ' ' + g('year');
}
const veiligeNaam = n => String(n || 'medewerker').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
module.exports = { stempel, kort, briefDatum, veiligeNaam };
