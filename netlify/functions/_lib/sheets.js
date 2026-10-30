// ============================================================
// Datalaag-schakelaar (stap 6). Dit bestand heet nog sheets.js omdat alle
// endpoints en signaleringen het zo aanroepen; het kiest op DATA_BRON:
//   supabase -> data.js          (Supabase-tabellen, migratie 0006)
//   anders   -> sheets-google.js (de oorspronkelijke Google-Sheets-laag)
// Zo is de overstap - en het terugdraaien - één env var.
// ============================================================
const bron = () => (String(process.env.DATA_BRON || '').trim().toLowerCase() === 'supabase' ? 'supabase' : 'sheets');
const impl = () => (bron() === 'supabase' ? require('./data') : require('./sheets-google'));
// Lazy proxy: elke aanroep gaat naar de actieve implementatie (ook in tests die de env var wisselen)
const S = new Proxy({}, {
  get(_, naam) {
    if (naam === 'bron') return bron;
    if (naam === 'KLEUR') return impl().KLEUR;
    const f = impl()[naam];
    // v0.35.1: loonheffingsrijen krijgen .indienstRetour (indiensttredingsformulier teruggestuurd door HR)
    if (naam === 'getLoonheffing' && typeof f === 'function') return async (...a) => require('./indienst').annoteer(await f(...a));
    return typeof f === 'function' ? (...a) => f(...a) : f;
  },
  // Toekenningen (tests die functies mocken) komen op de actieve implementatie terecht
  set(_, naam, waarde) { impl()[naam] = waarde; return true; }
});
module.exports = S;
