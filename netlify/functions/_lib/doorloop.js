// ============================================================
// v0.27.2: doorlooptijden van dossiers — hoe lang duurt het van verstuurd → binnen/getekend → naar salaris?
//   Loonheffing:  uitnodiging verstuurd → formulier binnen (upload of oud Google-formulier) → naar salaris
//   Ontslag / aanzegging: brief verstuurd → getekend (digitaal of upload) → naar salaris
// tijdlijn(inp)  puur: maakt per dossier { soort, mid, naam, winkel?, verzonden, binnen, salaris } (Date of null)
// stats(lijst)   puur: mediaan/aantallen per soort
// laad()         haalt uploads, formulierreacties en digitale ondertekeningen op
// ============================================================
const { normNaam } = require('./util');

// Stempels in de dossiers zijn Nederlandse tijd; de server draait in UTC → omrekenen (zomer-/wintertijd)
function ams(j, mo, d, h, mi) {
  const gok = Date.UTC(j, mo, d, h, mi);
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(gok));
  const g = t => +p.find(x => x.type === t).value;
  const alsAms = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return new Date(gok - (alsAms - gok));
}
// 'dd-mm-jjjj uu:mm' of 'dd-mm-jjjj' (Nederlandse tijd) → Date; anders null
function stempelDatum(s) {
  const m = String(s || '').match(/(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  return m ? ams(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
}
// Forms-tijdstempel (dd-mm-jjjj uu:mm, m/d/jjjj uu:mm of ISO) → Date
function formDatum(s) {
  const t = String(s || '').trim(); let m;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) && !isNaN(Date.parse(t))) return new Date(t);
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/))) return ams(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/))) return ams(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]);
  return stempelDatum(t);
}
const dagen = (a, b) => (b - a) / 864e5;
const r1 = x => Math.round(x * 10) / 10;
function mediaan(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }

// events: [{ naam, email, rij?, tijd: Date }] → index per e-mail / naam
function index(events) {
  const e = {}, n = {}, rij = {};
  for (const x of events || []) {
    if (!x || !x.tijd || isNaN(x.tijd)) continue;
    const em = String(x.email || '').trim().toLowerCase(), nn = normNaam(x.naam);
    if (em) (e[em] = e[em] || []).push(x.tijd);
    if (nn) (n[nn] = n[nn] || []).push(x.tijd);
    if (x.rij) (rij[x.rij] = rij[x.rij] || []).push(x.tijd);
  }
  return { e, n, rij };
}
// eerste moment ná het versturen (5 min speling); bij rij-match eerst die (digitale ondertekening hoort bij precies die regel)
function eersteNa(idx, r, vanaf) {
  const grens = new Date(vanaf.getTime() - 5 * 6e4);
  const kies = l => (l || []).filter(t => t >= grens).sort((a, b) => a - b)[0] || null;
  if (idx.rij && r.rij && idx.rij[r.rij]) { const t = kies(idx.rij[r.rij]); if (t) return t; }
  const em = String(r.email || '').trim().toLowerCase();
  return kies([].concat(em ? idx.e[em] || [] : [], idx.n[normNaam(r.naam)] || []));
}

// inp: { loon, ontslag, uploadsLoon, uploadsOntslag, formsLoon, formsOntslag, ondertekend }
//   loon/ontslag = rijen uit getLoonheffing(true) / getOntslag(true)
//   uploads* = [{ naam, email, created_at }], forms* = [{ naam, email, tijdstempel }], ondertekend = [{ naam, email, rij, getekend_op }] (soort ontslag)
function tijdlijn(inp) {
  const iLoon = index([].concat(
    (inp.uploadsLoon || []).map(u => ({ naam: u.naam, email: u.email, tijd: new Date(u.created_at) })),
    (inp.formsLoon || []).map(f => ({ naam: f.naam, email: f.email, tijd: formDatum(f.tijdstempel) }))));
  const iOnt = index([].concat(
    (inp.uploadsOntslag || []).map(u => ({ naam: u.naam, email: u.email, tijd: new Date(u.created_at) })),
    (inp.formsOntslag || []).map(f => ({ naam: f.naam, email: f.email, tijd: formDatum(f.tijdstempel) })),
    (inp.ondertekend || []).map(o => ({ naam: o.naam, email: o.email, rij: o.rij, tijd: o.getekend_op ? new Date(o.getekend_op) : null }))));
  const uit = [];
  const isVerz = s => /^(Verzonden|Verstuurd)/.test(String(s || ''));
  for (const r of inp.loon || []) {
    const v = stempelDatum(r.verzenddatum); if (!v || !isVerz(r.status)) continue;
    const binnen = eersteNa(iLoon, r, v);
    uit.push({ soort: 'loonheffing', mid: r.mid || '', naam: r.naam, verzonden: v, binnen: binnen || null, binnenJa: r.ontvangen === 'Ja', salaris: stempelDatum(r.salaris) });
  }
  for (const r of inp.ontslag || []) {
    const v = stempelDatum(r.verzenddatum); if (!v || !isVerz(r.status)) continue;
    const binnen = eersteNa(Object.assign({}, iOnt), r, v);
    uit.push({ soort: r.type === 'aanzegging' ? 'aanzegging' : 'ontslag', mid: r.mid || '', naam: r.naam, verzonden: v, binnen: binnen || null, binnenJa: r.ondertekend === 'Ja', salaris: stempelDatum(r.salaris) });
  }
  return uit;
}

// Per soort: mediaan dagen verstuurd→binnen, binnen→salaris, aantal, nog open, open > 14 dagen
const SOORTEN = { loonheffing: 'Loonheffing (formulier binnen)', ontslag: 'Ontslagbevestiging (getekend)', aanzegging: 'Aanzegging (getekend)' };
function stats(lijst, vandaag, vanIso, totIso) {
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return Object.keys(SOORTEN).map(soort => {
    const l = lijst.filter(x => x.soort === soort && iso(x.verzonden) >= vanIso && iso(x.verzonden) <= totIso);
    const tb = l.filter(x => x.binnen).map(x => dagen(x.verzonden, x.binnen));
    const ts = l.filter(x => x.binnen && x.salaris && x.salaris >= x.binnen).map(x => dagen(x.binnen, x.salaris));
    const open = l.filter(x => !x.binnen && !x.binnenJa);
    const binnen7 = l.filter(x => dagen(x.verzonden, vandaag) >= 7);
    return { soort, label: SOORTEN[soort], verstuurd: l.length, binnen: tb.length, mediaanBinnen: tb.length ? r1(mediaan(tb)) : null,
      binnen7Pct: binnen7.length ? Math.round(binnen7.filter(x => x.binnen && dagen(x.verzonden, x.binnen) <= 7).length / binnen7.length * 100) : null, binnen7N: binnen7.length,
      naarSalaris: ts.length, mediaanSalaris: ts.length ? r1(mediaan(ts)) : null,
      open: open.length, openLang: open.filter(x => dagen(x.verzonden, vandaag) > 14).length,
      zonderTijd: l.filter(x => !x.binnen && x.binnenJa).length };
  });
}

async function laad() {
  const { admin } = require('./auth'), db = admin();
  const lijst = async q => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data || []; };
  const veilig = async p => { try { return await p; } catch (e) { console.warn('doorloop:', e.message); return []; } };
  const [up, forms, ond] = await Promise.all([
    veilig(lijst(db.from('hr_uploads').select('soort,naam,email,created_at').in('soort', ['loon', 'ontslag']).order('created_at', { ascending: true }).limit(5000))),
    veilig(lijst(db.from('hr_formulier_reacties').select('soort,naam,email,tijdstempel').limit(5000))),
    veilig(lijst(db.from('hr_ondertekening').select('soort,naam,email,rij,getekend_op,status').eq('soort', 'ontslag').eq('status', 'getekend').limit(5000)))
  ]);
  return {
    uploadsLoon: up.filter(u => u.soort === 'loon'), uploadsOntslag: up.filter(u => u.soort === 'ontslag'),
    formsLoon: forms.filter(f => f.soort === 'loon'), formsOntslag: forms.filter(f => f.soort === 'ontslag'),
    ondertekend: ond
  };
}

module.exports = { tijdlijn, stats, laad, stempelDatum, formDatum, mediaan, SOORTEN };
