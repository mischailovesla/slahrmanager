const assert=require('assert'); const M=require('../netlify/functions/_lib/medisch.js');
assert.strictEqual(M.vind('Ze komt volgende week terug op de vloer'), null);
assert.strictEqual(M.vind('Afgesproken: dinsdag bellen, start met halve diensten'), null);
assert.strictEqual(M.vind('Hartelijk dank, langer afwezig dan gedacht'), null);
assert.strictEqual(M.vind('Heeft last van zijn rug'), 'rug');
assert.strictEqual(M.vind('Burn-out klachten'), 'burn-out');
assert.strictEqual(M.vind('She is pregnant'), 'pregnant');
assert.strictEqual(M.vind('Is overspannen geraakt'), 'overspannen');
assert.strictEqual(M.vind('Address in Amsterdam'), null); // 'add' alleen als los woord
assert.throws(()=>M.controleer(['ok','Na de operatie']),/operatie/);
console.log('medisch tests OK');
