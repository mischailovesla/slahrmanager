// v0.54.2: loonheffing niet meer nodig als er na start/uitnodiging een ontslag- of aanzeggingsdossier is
const assert = require('assert');
const O = require('../netlify/functions/_lib/opgezegd');
const k = O.kaart([
  { naam: 'Ella Aspinall', email: 'ella@x.nl', einddatum: '', verzenddatum: '17-11-2026 14:02', status: 'Verzonden' },
  { naam: 'Oud Herintreder', email: 'oud@x.nl', einddatum: '31-08-2026', verzenddatum: '01-08-2026 10:00' },
  { naam: 'Toekomst Vertrek', email: '', einddatum: '15-12-2026', verzenddatum: '' }
]);
// Ella: uitnodiging 18-11 (na ontslag) → verbergen; ook op naam (andere schrijfwijze e-mail)
assert.strictEqual(O.na(k, { naam: 'Ella Aspinall', email: 'ELLA@x.nl' }, '18-11-2026'), true);
assert.strictEqual(O.na(k, { naam: 'ella  aspinall', email: '' }, '18-11-2026 08:30'), true);
// Ontslag kort vóór uitnodiging (binnen marge) telt ook
assert.strictEqual(O.na(k, { naam: 'Ella Aspinall' }, '25-11-2026'), true);
// Herintreder: oud dossier (augustus), nieuwe start november → wél uitnodigen
assert.strictEqual(O.na(k, { naam: 'Oud Herintreder', email: 'oud@x.nl' }, '01-11-2026'), false);
// Shiftbase-start als Date
assert.strictEqual(O.na(k, { naam: 'Toekomst Vertrek' }, new Date(2026, 10, 10)), true);
// Onbekende persoon
assert.strictEqual(O.na(k, { naam: 'Iemand Anders', email: 'a@b.nl' }, '18-11-2026'), false);
// Uitnodigingsdatum uit status als verzenddatum leeg is
assert.strictEqual(O.uitnodiging({ verzenddatum: '', status: 'Verzonden op 18-11-2026 08:30' }), '18-11-2026 08:30');
console.log('opgezegd: OK');
