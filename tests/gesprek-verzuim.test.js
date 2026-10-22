const assert=require('assert'); const G=require('../netlify/functions/_lib/gesprekken.js');
const basis={naam:'Piet',soort:'verzuim',datum:'2026-10-20'};
const r=G.valideer(Object.assign({},basis,{verzuim:{duur:'1–4 weken',werk:'Gedeeltelijk / aangepast werk'},besproken:'heeft griep',afspraken:'Dinsdag bellen'}));
assert.strictEqual(r.besproken,'Verwachte duur: 1–4 weken · Werken mogelijk?: Gedeeltelijk / aangepast werk'); // vrije tekst genegeerd
assert.throws(()=>G.valideer(Object.assign({},basis,{verzuim:{}})),/minimaal/);
assert.throws(()=>G.valideer(Object.assign({},basis,{verzuim:{duur:'2 dagen'}})),/Ongeldige keuze/);
assert.throws(()=>G.valideer(Object.assign({},basis,{verzuim:{duur:'Onbekend'},afspraken:'na de operatie bellen'})),/medische/);
assert.throws(()=>G.valideer({naam:'Piet',soort:'functioneren',datum:'2026-10-20',besproken:'Klaagt over rugpijn'}),/medische/);
assert.ok(G.valideer({naam:'Piet',soort:'functioneren',datum:'2026-10-20',besproken:'Komt vaak te laat terug van pauze'}));
console.log('gesprek tests OK');
