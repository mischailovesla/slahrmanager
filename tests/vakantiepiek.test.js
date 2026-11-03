// v0.38.0: vakantiepiek voor zomer én kerst
const assert = require('assert');
const SIG = require('../netlify/functions/_lib/signaleringen');
const C = require('../netlify/functions/_lib/config');
const zomer = C.PIEK_SEIZOENEN[0], kerst = C.PIEK_SEIZOENEN[1];
assert.strictEqual(SIG.piekSeizoen(new Date(2026, 10, 3)).key, 'kerst', '3 november = kerstseizoen');
assert.strictEqual(SIG.piekSeizoen(new Date(2026, 4, 4)).key, 'zomer');
assert.strictEqual(SIG.piekSeizoen(new Date(2026, 7, 15)), null, 'augustus: geen alert');
const wk = (van, nr) => ({ van, weeknr: nr, label: van });
const d = { weken: [wk('2026-12-07', 50), wk('2026-12-14', 51), wk('2026-12-21', 52), wk('2026-12-28', 53), wk('2027-01-04', 1), wk('2027-01-11', 2)],
  rijen: [{ naam: 'Middenweg', bezetting: 10, cellen: [{ app: 1, pend: 0 }, { app: 1, pend: 0 }, { app: 3, pend: 1, namen: ['A', 'B', 'C', 'D (aangevraagd)'] }, { app: 2, pend: 0, namen: ['A', 'B'] }, { app: 2, pend: 1, namen: [] }, { app: 9, pend: 0 }] },
          { naam: 'Klein', bezetting: 2, cellen: [{ app: 2, pend: 0 }, { app: 2, pend: 0 }, { app: 2, pend: 0 }, { app: 2, pend: 0 }, { app: 2, pend: 0 }, { app: 2, pend: 0 }] }] };
assert.deepStrictEqual(SIG.piekWeken(d, 2026, kerst).map(x => x.w.weeknr), [51, 52, 53, 1], 'kerst: wk 51 t/m wk 1 van volgend jaar');
const r = SIG.bepaalZomerpiek(d, 2026, kerst);
assert.strictEqual(r.length, 1, 'kleine winkel (bezetting < minimum) telt niet');
assert.strictEqual(r[0].winkel, 'Middenweg');
assert.deepStrictEqual(r[0].weken.map(w => [w.pct, w.rood]), [[40, true], [20, false], [30, true]]);
assert.strictEqual(SIG.piekWeken(d, 2026, zomer).length, 0);
console.log('vakantiepiek tests OK');

// v0.38.2: loonheffing zonder indiensttredingsformulier gaat niet naar salaris
(async () => {
  const SAL = require('../netlify/functions/_lib/salaris');
  const r = await SAL.stuur('loonheffing', { rij: 5, naam: 'Cecile', docUrl: 'ref:x', docUrl2: '' }, 'test', {});
  assert.strictEqual(r.success, false); assert.ok(r.geenIndienst && /indiensttredingsformulier/.test(r.bericht));
  console.log('salaris indienst-verplicht OK');
})().catch(e => { console.error('✗ salaris indienst-verplicht: ' + e.message); process.exitCode = 1; });

// v0.38.3: formulier op een andere naam
{
  const { naamPast } = require('../netlify/functions/_lib/util');
  assert.strictEqual(naamPast('Boldizar Kovács', 'Maud Glass'), false);
  assert.strictEqual(naamPast('Maud Glass', 'Maud Glass'), true);
  assert.strictEqual(naamPast('Justin van t Noordende', "Justin Sebastiaan van 't Noordende"), true);
  assert.strictEqual(naamPast('Esmée Hendrikse', 'Esmee Hendrikse'), true);
  const IC = require('../netlify/functions/_lib/indienstcontrole');
  const rij = { naam: 'Maud Glass', email: 'maudglass@gmail.com', docUrl2: 'sb:1:indienst' };
  IC.controleerMet([rij], { 'sb:1:indienst': { naam: 'Maud Glass', gegevens: { voornaam: 'Boldizar', achternaam: 'Kovacs' } } }, [], { 'sb:1:indienst': ['andere-naam'] }, new Date());
  const c = rij.indienstControle.find(x => x.soort === 'andere-naam');
  assert.ok(c && c.ernst === 'rood', 'rood signaal, ook na akkoord');
  assert.ok(IC.blokkeert(rij).length, 'blokkeert salaris');
  console.log('andere-naam OK');
}

// v0.38.5: Zuidas uitgesloten van weekendbeschikbaarheid
{
  const W = require('../netlify/functions/_lib/weekend');
  const vandaag = new Date(2026, 10, 3), weken = W.weekendVensters(vandaag, 3);
  const ros = [];
  weken.forEach(v => { ros.push({ user_id: '1', date: W.iso(W.plusDagen(v.vr, -3)) }); ros.push({ user_id: '2', date: W.iso(W.plusDagen(v.vr, -3)) }); });
  const med = [{ id: '1', naam: 'A Zuid', winkelNaam: 'SLA Zuidas' }, { id: '2', naam: 'B Oost', winkelNaam: 'Oost' }];
  let lijst; try { lijst = W.bepaalWeekendOntwijkers(med, ros, [], vandaag, 3, ['HQ', 'Zuidas']); } catch (e) { lijst = null; }
  if (lijst) { assert.ok(!lijst.some(x => /Zuid/.test(x.naam || '')), 'Zuidas niet in de lijst'); console.log('weekend zuidas OK'); }
}

// v0.39.0: herinnering 'indiensttredingsformulier ontbreekt'
{
  const SIG = require('../netlify/functions/_lib/signaleringen');
  const T = require('../netlify/functions/_lib/sjablonen');
  const vandaag = new Date(2026, 10, 3);
  const rij = (x) => Object.assign({ naam: 'Maud Glass', email: 'm@x.nl', ontvangen: 'Ja', docUrl: 'sb:1:loon', docUrl2: '', salaris: '', mahdia: 'Nee', verzenddatum: '29-10-2026 16:45' }, x);
  let k = SIG.indienstOntbreektKandidaten([rij({}), rij({ naam: 'Heeft Beide', docUrl2: 'sb:2:indienst' }), rij({ naam: 'Nog Niets', ontvangen: 'Nee', docUrl: '' }), rij({ naam: 'Oud Dossier', verzenddatum: '01-06-2026 10:00' }), rij({ naam: 'Al Salaris', salaris: 'x' })], {}, vandaag);
  assert.deepStrictEqual(k.map(x => x.r.naam), ['Maud Glass']); assert.ok(k[0].nu);
  k = SIG.indienstOntbreektKandidaten([rij({})], { 'maud glass': { op: new Date(2026, 10, 2).toISOString(), n: 1 } }, vandaag);
  assert.ok(!k[0].nu, 'cooldown 3 dagen');
  k = SIG.indienstOntbreektKandidaten([rij({})], { 'maud glass': { op: new Date(2026, 9, 20).toISOString(), n: 3 } }, vandaag);
  assert.ok(k[0].stop && !k[0].nu, 'max 3');
  const html = T.indienstOntbreektHtml('Maud Glass');
  assert.ok(/indienst\.html\?t=/.test(html) && /Hoi Maud/.test(html) && !/xlsx/.test(html));
  console.log('indienst ontbreekt OK');
}

// v0.40.0: toegang beheren
{
  const { controleer } = require('../netlify/functions/toegang');
  const acc = [{ email: 'mischa@ilovesla.com', rol: 'admin', actief: true }, { email: 'jodi@ilovesla.com', rol: 'hr', actief: true }];
  assert.deepStrictEqual(controleer({ email: 'Lisa@ilovesla.com', naam: 'Lisa', rol: 'hr' }, acc, 'mischa@ilovesla.com'), { email: 'lisa@ilovesla.com', naam: 'Lisa', rol: 'hr', actief: true });
  assert.throws(() => controleer({ email: 'lisa@gmail.com', rol: 'hr' }, acc, 'mischa@ilovesla.com'), /ilovesla/);
  assert.throws(() => controleer({ email: 'mischa@ilovesla.com', rol: 'admin', actief: false }, acc, 'mischa@ilovesla.com'), /eigen toegang/);
  assert.throws(() => controleer({ email: 'mischa@ilovesla.com', rol: 'hr' }, acc, 'mischa@ilovesla.com'), /beheerdersrol/);
  assert.throws(() => controleer({ email: 'mischa@ilovesla.com', rol: 'hr' }, acc, 'jodi@ilovesla.com'), /minimaal één/);
  assert.throws(() => controleer({ email: 'x@ilovesla.com', rol: 'baas' }, acc, 'mischa@ilovesla.com'), /rol/);
  console.log('toegang OK');
}
