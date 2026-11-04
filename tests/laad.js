// v0.43.6: elke Netlify-functie moet zonder fout kunnen laden (vangt fouten die node --check mist, bv. dubbele declaraties)
const Module = require('module'), path = require('path'), fs = require('fs');
const orig = Module._resolveFilename;
const stubNetlify = path.join(__dirname, 'stub-netlify.js');
if (!fs.existsSync(stubNetlify)) fs.writeFileSync(stubNetlify, "// stub voor tests: schedule(cron, fn) geeft fn terug\nexports.schedule = (cron, fn) => fn;\n");
Module._resolveFilename = function (req, ...a) { if (req === '@supabase/supabase-js') return path.join(__dirname, 'stub-supabase.js'); if (req === '@netlify/functions') return stubNetlify; return orig.call(this, req, ...a); };
const dir = path.join(__dirname, '..', 'netlify', 'functions'); let fout = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) { try { require(path.join(dir, f)); } catch (e) { fout++; console.error('✗ ' + f + ': ' + e.message); } }
if (fout) { console.error(fout + ' functie(s) laden niet'); process.exit(1); } else console.log('alle functies laden OK');
