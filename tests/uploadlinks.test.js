
const assert=require('assert');
const U=require('../netlify/functions/_lib/uploads.js');
const t=U.tekenToken({s:'loon',n:'Piet',d:'2026-08-01'});
assert.strictEqual(U.leesToken(t,new Date(2026,8,29)).n,'Piet'); // 59 dagen
assert.throws(()=>U.leesToken(t,new Date(2026,9,2)),/verlopen/); // 62 dagen
const zonder=U.tekenToken({s:'loon',n:'Piet'});
assert.ok(U.leesToken(zonder,new Date(2026,10,1))); assert.throws(()=>U.leesToken(zonder,new Date(2027,0,1)),/verlopen/);
assert.throws(()=>U.leesToken(t.slice(0,-2)+'aa'),/Ongeldige/);
const nieuw=U.leesToken(U.uploadLink('ontslag','Kees').split('t=')[1]); assert.strictEqual(nieuw.s,'ontslag');
console.log('token tests OK');
