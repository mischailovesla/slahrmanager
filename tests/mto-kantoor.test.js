// v0.37.0: kantoor (HQ) als eigen MTO-groep
const assert = require('assert');
const MTO = require('../netlify/functions/_lib/mto');
const Q = require('../netlify/functions/_lib/mto-vragen');
assert.strictEqual(MTO.groepVan('HQ', 'Manager Training'), 'kantoor');
assert.strictEqual(MTO.groepVan('Westerstraat', 'Store Manager'), 'manager');
assert.strictEqual(MTO.groepVan('Westerstraat', 'SLA maker'), 'medewerker');
const rijen = MTO.metGroep([{ winkel: 'HQ', groep: 'manager' }, { winkel: 'hq', groep: 'medewerker' }, { winkel: 'Westerstraat', groep: 'manager' }, { winkel: 'Westerstraat', groep: 'medewerker' }]);
assert.strictEqual(MTO.filter(rijen, 'alle', null).length, 2, 'alle = winkels, zonder kantoor');
assert.strictEqual(MTO.filter(rijen, 'kantoor', null).length, 2);
assert.strictEqual(MTO.filter(rijen, 'manager', null).length, 1, 'HQ-manager telt niet als store manager');
assert.deepStrictEqual(MTO.GROEPEN, ['medewerker', 'manager', 'kantoor']);
const tekst = JSON.stringify(Q.voorPagina('EN', 'kantoor'));
assert.ok(!/store manager/i.test(tekst), 'kantoor krijgt geen "store manager" in de vragen');
console.log('mto kantoor tests OK');
