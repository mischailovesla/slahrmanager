// ============================================================
// Fase 4a: training & certificaten uit SLA Academy (apart Supabase-project).
// Leest via één functie in Academy: hr_training_status(p_sleutel) — zie supabase/academy/hr_koppeling.sql.
// Geen schrijfrechten, geen service key van Academy in dit dashboard.
//   haal(ververs)              -> { stand, medewerkers } (gecachet ACADEMY_CACHE_MIN minuten)
//   koppel(acad, sbMed)        -> Academy-rijen met mid/winkel uit Shiftbase (op Shiftbase-id, e-mail, naam)
//   beoordeel(m, vandaagIso)   -> per medewerker: certStatus, welkomTelt/welkomAf, nooitIngelogd, aftekenen
//   signalen(lijst, vandaagIso)-> taken voor de takenlijst (per persoon + per winkel)
//   samenvatting(lijst, ...)   -> dekking per winkel (tab Training en scorekaart)
//   laad(ververs)              -> alles in één keer: { stand, lijst, winkels, signalen, ongekoppeld }
// ============================================================
const C = require('./config');
const { normNaam } = require('./util');

let _cache = { t: 0, v: null };
const vandaagIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const dagenTussen = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const nl = s => s ? String(s).slice(0, 10).split('-').reverse().join('-') : '';

async function haal(ververs) {
  const sleutel = process.env.ACADEMY_HR_SLEUTEL;
  if (!sleutel) throw new Error('Koppeling met Academy staat nog niet aan: ACADEMY_HR_SLEUTEL ontbreekt in Netlify (zie CUTOVER, blok J).');
  if (!ververs && _cache.v && _cache.t > Date.now()) return _cache.v;
  const r = await module.exports._fetch(C.ACADEMY_URL + '/rest/v1/rpc/hr_training_status', {
    method: 'POST', headers: { apikey: C.ACADEMY_KEY, Authorization: 'Bearer ' + C.ACADEMY_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_sleutel: sleutel })
  });
  const tekst = await r.text();
  if (!r.ok) {
    let msg = tekst; try { msg = JSON.parse(tekst).message || tekst; } catch (e) { /* tekst */ }
    if (/geen toegang/.test(msg) || r.status === 401 || r.status === 403) throw new Error('Academy weigert de sleutel (ACADEMY_HR_SLEUTEL klopt niet of is vervangen).');
    if (r.status === 404 || /hr_training_status/.test(msg)) throw new Error('Functie hr_training_status ontbreekt in Academy (supabase/academy/hr_koppeling.sql nog niet gedraaid?).');
    throw new Error('Academy: ' + r.status + ' ' + String(msg).slice(0, 200));
  }
  const v = JSON.parse(tekst) || {};
  v.medewerkers = v.medewerkers || [];
  _cache = { t: Date.now() + C.ACADEMY_CACHE_MIN * 60000, v };
  return v;
}

function koppel(acad, sbMed) {
  const opId = {}, opMail = {}, opNaam = {};
  (sbMed || []).forEach(m => { opId[String(m.id)] = m; if (m.email) opMail[String(m.email).toLowerCase()] = m; if (m.naam) opNaam[normNaam(m.naam)] = m; });
  return (acad || []).map(a => {
    const m = (a.shiftbase_id && opId[String(a.shiftbase_id)]) || (a.email && opMail[a.email]) || (a.naam && opNaam[normNaam(a.naam)]) || null;
    return Object.assign({}, a, { mid: m ? String(m.id) : (a.shiftbase_id ? String(a.shiftbase_id) : ''), hrNaam: m ? m.naam : a.naam, winkel: (m && m.winkelNaam) || a.locatie || '', gekoppeld: !!m });
  });
}

const OK_CERT = ['geldig', 'verloopt_binnenkort'];
function beoordeel(m, vandaag) {
  vandaag = vandaag || vandaagIso();
  const certs = m.certificaten || [];
  const verlopen = certs.filter(c => c.status === 'verlopen'), binnenkort = certs.filter(c => c.status === 'verloopt_binnenkort'), nooit = certs.filter(c => !OK_CERT.includes(c.status) && c.status !== 'verlopen');
  const dagenInDienst = m.start ? dagenTussen(m.start, vandaag) : null;
  const nieuwInAcademy = !!(m.academy_live && m.start && m.live_sinds && m.start >= m.live_sinds);
  const w = m.welkom || { totaal: 0, af: 0, open: [] };
  const welkomTelt = nieuwInAcademy && w.totaal > 0 && dagenInDienst !== null && dagenInDienst >= C.ACADEMY_WELKOM_DAGEN;
  const welkomDagenOver = welkomTelt ? dagenInDienst - C.ACADEMY_WELKOM_DAGEN : 0;
  const nooitIngelogd = !m.laatst_ingelogd && !!m.welkom_mail && dagenTussen(m.welkom_mail, vandaag) >= C.ACADEMY_NOOIT_INGELOGD_DAGEN;
  const aftekenProbleem = (m.aftekenen || []).filter(a => ['te_laat', 'niet_geslaagd', 'verlopen'].includes(a.status));
  return {
    certTelt: certs.length > 0, certOk: certs.length > 0 && certs.every(c => OK_CERT.includes(c.status)),
    verlopen, binnenkort, zonderCert: nooit, nieuwInAcademy, dagenInDienst,
    welkomTelt, welkomAf: w.totaal > 0 && w.af >= w.totaal, welkomOpen: w.open || [], welkomDagenOver,
    nooitIngelogd, ingelogd: !!m.laatst_ingelogd, aftekenProbleem,
    aftekenOpen: (m.aftekenen || []).filter(a => a.status === 'open').length
  };
}

const AFT_LABEL = { te_laat: 'te laat', niet_geslaagd: 'niet geslaagd', verlopen: 'verlopen', open: 'open', afgetekend: 'afgetekend' };
function signalen(lijst, vandaag) {
  vandaag = vandaag || vandaagIso();
  const uit = [], nooitPerWinkel = {}, zonderPerWinkel = {};
  for (const m of lijst || []) {
    const b = beoordeel(m, vandaag), basis = { bron: 'academy', naam: m.hrNaam || m.naam, email: m.email || '', winkel: m.winkel || '', mid: m.mid || '' };
    if (b.verlopen.length || b.binnenkort.length) {
      const rood = b.verlopen.length > 0;
      uit.push(Object.assign({}, basis, { soort: 'cert', urgentie: rood ? 'rood' : 'oranje', sleutel: 'academy|cert|' + (m.mid || m.id),
        titel: rood ? 'Certificaat verlopen: ' + b.verlopen.map(c => c.titel).join(', ') : 'Certificaat verloopt binnenkort: ' + b.binnenkort.map(c => c.titel).join(', '),
        sub: basis.naam + ' · ' + (basis.winkel || '-') + ' · ' + b.verlopen.concat(b.binnenkort).map(c => c.titel + ' geldig t/m ' + nl(c.geldig_tot)).join(' · ') + ' · opnieuw doen in Academy' }));
    }
    if (b.welkomTelt && !b.welkomAf) {
      const w = m.welkom;
      uit.push(Object.assign({}, basis, { soort: 'welkom', urgentie: b.welkomDagenOver >= C.ACADEMY_WELKOM_DAGEN ? 'rood' : 'oranje', sleutel: 'academy|welkom|' + (m.mid || m.id),
        titel: 'Welkomstcollectie Academy niet af na ' + b.dagenInDienst + ' dagen (' + w.af + '/' + w.totaal + ')',
        sub: basis.naam + ' · ' + (basis.winkel || '-') + ' · in dienst ' + nl(m.start) + (b.welkomOpen.length ? ' · open: ' + b.welkomOpen.slice(0, 4).join(', ') + (b.welkomOpen.length > 4 ? ' …' : '') : '') + (b.ingelogd ? '' : ' · nog nooit ingelogd') }));
    }
    if (b.aftekenProbleem.length) {
      uit.push(Object.assign({}, basis, { soort: 'aftekenen', urgentie: 'oranje', sleutel: 'academy|aftekenen|' + (m.mid || m.id),
        titel: 'Aftekenen: ' + b.aftekenProbleem.map(a => a.observatie + ' ' + AFT_LABEL[a.status]).join(', '),
        sub: basis.naam + ' · ' + (basis.winkel || '-') + ' · in dienst ' + nl(m.start) + ' · ' + b.aftekenProbleem.map(a => a.deadline ? 'deadline ' + nl(a.deadline) : a.op ? 'laatst ' + nl(a.op) : '').filter(Boolean).join(' · ') + ' · observatie in Academy door Store Manager/trainer' }));
    }
    if (b.nooitIngelogd && !(b.welkomTelt && !b.welkomAf)) (nooitPerWinkel[basis.winkel || '-'] = nooitPerWinkel[basis.winkel || '-'] || []).push(basis.naam);
    if (b.zonderCert.length && !b.nieuwInAcademy) (zonderPerWinkel[basis.winkel || '-'] = zonderPerWinkel[basis.winkel || '-'] || []).push(basis.naam);
  }
  Object.keys(nooitPerWinkel).sort().forEach(w => { const n = nooitPerWinkel[w];
    uit.push({ bron: 'academy', soort: 'nooit', urgentie: 'oranje', sleutel: 'academy|nooit|' + w, winkel: w === '-' ? '' : w, naam: '', email: '',
      titel: w + ': ' + n.length + ' medewerker' + (n.length === 1 ? '' : 's') + ' nooit ingelogd in Academy', sub: n.slice(0, 8).join(', ') + (n.length > 8 ? ' en ' + (n.length - 8) + ' anderen' : '') + ' · welkomstmail ≥ ' + C.ACADEMY_NOOIT_INGELOGD_DAGEN + ' dagen geleden · even bellen of via de Store Manager', namen: n }); });
  Object.keys(zonderPerWinkel).sort().forEach(w => { const n = zonderPerWinkel[w];
    uit.push({ bron: 'academy', soort: 'zonder-cert', urgentie: 'grijs', sleutel: 'academy|zonder|' + w, winkel: w === '-' ? '' : w, naam: '', email: '',
      titel: w + ': ' + n.length + ' medewerker' + (n.length === 1 ? '' : 's') + ' zonder geldig certificaat voedselveiligheid/HACCP in Academy', sub: n.slice(0, 8).join(', ') + (n.length > 8 ? ' en ' + (n.length - 8) + ' anderen' : '') + ' · toewijzen in Kas → Toewijzingen', namen: n }); });
  return uit;
}

const pct = (a, b) => b ? Math.round(a / b * 100) : null;
function samenvatting(lijst, vandaag) {
  vandaag = vandaag || vandaagIso();
  const per = {}, leeg = naam => ({ winkel: naam, medewerkers: 0, ingelogd: 0, certTelt: 0, certOk: 0, verlopen: 0, welkomTelt: 0, welkomAf: 0, aftekenOpen: 0, aftekenProbleem: 0, nooitIngelogd: 0 });
  const tot = leeg('SLA totaal');
  for (const m of lijst || []) {
    const w = m.winkel || '(geen winkel)', b = beoordeel(m, vandaag), x = per[w] = per[w] || leeg(w);
    [x, tot].forEach(y => { y.medewerkers++; if (b.ingelogd) y.ingelogd++; if (b.certTelt) { y.certTelt++; if (b.certOk) y.certOk++; } if (b.verlopen.length) y.verlopen++; if (b.welkomTelt) { y.welkomTelt++; if (b.welkomAf) y.welkomAf++; } y.aftekenOpen += b.aftekenOpen; if (b.aftekenProbleem.length) y.aftekenProbleem++; if (b.nooitIngelogd) y.nooitIngelogd++; });
  }
  const af = x => Object.assign(x, { ingelogdPct: pct(x.ingelogd, x.medewerkers), certPct: pct(x.certOk, x.certTelt), welkomPct: pct(x.welkomAf, x.welkomTelt) });
  return { winkels: Object.values(per).map(af).sort((a, b) => a.winkel.localeCompare(b.winkel, 'nl')), totaal: af(tot) };
}

function compact(m, vandaag) {
  const b = beoordeel(m, vandaag);
  return { naam: m.hrNaam || m.naam, email: m.email, mid: m.mid, winkel: m.winkel, rol: m.rol, start: m.start, startNL: nl(m.start), laatstIngelogd: nl(m.laatst_ingelogd), welkomMail: nl(m.welkom_mail),
    certificaten: (m.certificaten || []).map(c => ({ titel: c.titel, status: c.status, geldigTot: nl(c.geldig_tot), dagen: c.dagen })),
    welkom: m.welkom, welkomTelt: b.welkomTelt, welkomAf: b.welkomAf, aftekenen: (m.aftekenen || []).map(a => ({ observatie: a.observatie, status: a.status, statusLabel: AFT_LABEL[a.status] || a.status, deadline: nl(a.deadline), op: nl(a.op) })),
    trainingen: m.trainingen, certOk: b.certOk, certTelt: b.certTelt, nooitIngelogd: b.nooitIngelogd, gekoppeld: m.gekoppeld };
}

async function laad(ververs) {
  const SB = require('./shiftbase');
  const [a, sb] = await Promise.all([haal(ververs), SB.getMedewerkers()]);
  const vandaag = vandaagIso(), lijst = koppel(a.medewerkers, sb);
  const s = samenvatting(lijst, vandaag);
  return { stand: a.stand, lijst, vandaag, winkels: s.winkels, totaal: s.totaal, signalen: signalen(lijst, vandaag), ongekoppeld: lijst.filter(m => !m.gekoppeld).map(m => m.naam) };
}

async function voorPersoon(q) {
  const r = await laad(false);
  const nn = normNaam(q.naam || ''), em = String(q.email || '').toLowerCase();
  const m = r.lijst.find(x => (q.mid && x.mid && String(x.mid) === String(q.mid))) || r.lijst.find(x => em && x.email === em) || r.lijst.find(x => nn && (normNaam(x.naam) === nn || normNaam(x.hrNaam || '') === nn));
  return m ? Object.assign(compact(m, r.vandaag), { stand: r.stand }) : null;
}

module.exports = { haal, koppel, beoordeel, signalen, samenvatting, compact, laad, voorPersoon, _fetch: (...a) => fetch(...a), _reset: () => { _cache = { t: 0, v: null }; } };
