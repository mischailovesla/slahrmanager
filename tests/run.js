// Tests zonder database of netwerk: `npm test` (of `node tests/run.js`).
// @supabase/supabase-js wordt vervangen door een lege stub, zodat de pure logica te testen is zonder Supabase.
const Module = require('module'), path = require('path'), fs = require('fs');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === '@supabase/supabase-js') return path.join(__dirname, 'stub-supabase.js'); return orig.call(this, req, ...a); };
process.env.UPLOAD_SECRET = process.env.UPLOAD_SECRET || 'test';
let fout = 0;
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
  try { require(path.join(__dirname, f)); } catch (e) { fout++; console.error('✗ ' + f + ': ' + e.message); }
}
if (fout) { console.error(fout + ' testbestand(en) mislukt'); process.exit(1); }
console.log('Alle tests geslaagd.');
