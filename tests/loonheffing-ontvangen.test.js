// v0.48.2: 'Ontvangen' gaat alleen over de loonheffingsverklaring, niet over het indiensttredingsformulier
const assert = require('assert');
const S = require('../netlify/functions/_lib/sheets');
const SIG = require('../netlify/functions/_lib/signaleringen');

// 1. Welke regels worden teruggezet (alleen open dossiers sinds 01-10-2026 zonder loonheffingsverklaring)
const rijen = [
  { rij: 2, naam: 'Alleen Indienst', ontvangen: 'Ja', docUrl: '', docUrl2: 'sb:x:indienst', salaris: '', mahdia: 'Nee', verzenddatum: '06-11-2026 16:45' },
  { rij: 3, naam: 'Beide Binnen', ontvangen: 'Ja', docUrl: 'sb:y:loon', docUrl2: 'sb:y:indienst', salaris: '', mahdia: 'Nee', verzenddatum: '06-11-2026 16:45' },
  { rij: 4, naam: 'Al Naar Salaris', ontvangen: 'Ja', docUrl: '', docUrl2: 'sb:z:indienst', salaris: '07-11-2026 08:30', mahdia: 'Nee', verzenddatum: '01-11-2026 10:00' },
  { rij: 5, naam: 'Oud Dossier', ontvangen: 'Ja', docUrl: '', docUrl2: '', salaris: '', mahdia: 'Nee', verzenddatum: '15-08-2026 10:00' },
  { rij: 6, naam: 'Mahdia Verwerkt', ontvangen: 'Ja', docUrl: '', docUrl2: '', salaris: '', mahdia: 'Ja', verzenddatum: '06-11-2026 10:00' },
  { rij: 7, naam: 'Nog Niets', ontvangen: 'Nee', docUrl: '', docUrl2: '', salaris: '', mahdia: 'Nee', verzenddatum: '06-11-2026 10:00' }
];
assert.deepStrictEqual(SIG.ontvangenZonderLoonheffing(rijen, '2026-10-01').map(r => r.rij), [2]);

// 2. Upload via de loon-link: alleen het indiensttredingsformulier -> 'Ontvangen' blijft uit; met loonheffingsverklaring -> aan
(async () => {
  const gezet = [];
  const orig = { get: S.getLoonheffing, zet: S.zetCel };
  S.getLoonheffing = async () => [{ rij: 9, naam: 'Test Persoon', ontvangen: 'Nee' }];
  S.zetCel = async (id, tab, rij, kol, waarde) => { gezet.push([rij, kol, waarde]); };
  const { zetVinkje } = require('../netlify/functions/_lib/vinkje');
  await zetVinkje({ s: 'loon', n: 'Test Persoon' }, { indienst: 'sb:a:indienst' });
  assert.deepStrictEqual(gezet, [], 'alleen indienst: niet ontvangen');
  await zetVinkje({ s: 'loon', n: 'Test Persoon' }, { loon: 'sb:a:loon', indienst: 'sb:a:indienst' });
  assert.deepStrictEqual(gezet, [[9, 6, 'Ja']], 'met loonheffingsverklaring: ontvangen');
  S.getLoonheffing = orig.get; S.zetCel = orig.zet;
  console.log('loonheffing-ontvangen tests OK');
})().catch(e => { console.error('✗ loonheffing-ontvangen.test.js: ' + e.message); process.exitCode = 1; });
