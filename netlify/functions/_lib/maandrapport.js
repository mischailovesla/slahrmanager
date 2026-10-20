// ============================================================
// Fase 4b: HR-maandrapport — SLA totaal (deze maand vs vorige maand vs 12 maanden) + één regel per winkel.
// Bedoeld om met cijfers te laten zien hoe het gaat (en wat HR doet). Automatisch op de 1e van de maand
// als PDF naar Mischa, Jodi en Ymke (check 'maandrapport' in signaleringen.js), en altijd op te halen in
// het dashboard (Scorekaart → Maandrapport).
//
//   rapportMaand(str, nu)  'JJJJ-MM' → Date (1e van die maand); leeg = vorige maand
//   bereken(inp)           puur: bronnen (scorekaart.laadBronnen), maand, vandaag, activiteit, redenen
//   laad(maandStr)         haalt alles op en roept bereken aan
//   mailHtml/mailPlain     samenvatting in de mail; PDF als bijlage (maandrapport-pdf.js)
//
// Per winkel kijken we naar 3 maanden t/m de rapportmaand: per maand zijn de aantallen per winkel te klein
// om iets over te zeggen. Training (Academy) is altijd de stand van nu (niet historisch).
// Alleen geaggregeerde cijfers; check-in en exit pas vanaf MIN_N reacties (zelfde regel als de scorekaart).
// ============================================================
const SK = require('./scorekaart');
const VR = require('./verloop');
const C = require('./config');

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const WINKEL_MAANDEN = 3;
const TRAINING = ['welkomAf', 'certGeldig'];          // stand van nu → apart blok, niet maand-op-maand
const PRIVE = ['checkinScore', 'checkinLaagPct', 'enps'];
const DECIMAAL = ['checkinScore', 'meldingsfreq', 'verzuimPct'];
const r1 = x => Math.round(x * 10) / 10;
const pad = n => String(n).padStart(2, '0');
const sleutelVan = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);

function rapportMaand(str, nu) {
  nu = nu || SK.nuNL();
  const m = String(str || '').match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
  const d = new Date(+m[1], +m[2] - 1, 1);
  if (+m[2] < 1 || +m[2] > 12) throw new Error('Ongeldige maand: ' + str);
  if (d > new Date(nu.getFullYear(), nu.getMonth(), 1)) throw new Error('Deze maand ligt in de toekomst.');
  return d;
}
const labelVan = d => MAAND[d.getMonth()] + ' ' + d.getFullYear();

// verschil t.o.v. vorige maand: { d, tekst, oordeel: 'beter' | 'slechter' | 'gelijk' | null }
function verschil(k, nu, vorig) {
  if (nu === null || nu === undefined || vorig === null || vorig === undefined) return { d: null, tekst: '', oordeel: null };
  const d = nu - vorig, dec = DECIMAAL.includes(k.key);
  const afgerond = dec ? r1(d) : Math.round(d);
  if (afgerond === 0) return { d: 0, tekst: '=', oordeel: 'gelijk' };
  const pp = k.eenheid === '%' || k.eenheid.indexOf('%') === 0 ? ' pp' : '';
  const tekst = (afgerond > 0 ? '+' : '') + (dec ? afgerond.toFixed(1) : String(afgerond)).replace('.', ',') + pp;
  const beter = k.richting === 'laag' ? d < 0 : d > 0;
  return { d: afgerond, tekst, oordeel: beter ? 'beter' : 'slechter' };
}
// opvallende verandering (voor de samenvatting): genoeg gegevens én ≥ 20% relatief (eNPS: ≥ 10 punten)
function opvallend(k, a, b) {
  if (!a || !b || a.v === null || b.v === null || a.v === undefined || b.v === undefined || a.klein || b.klein || (a.n || 0) < SK.MIN_N || (b.n || 0) < SK.MIN_N) return false;
  if (k.vergelijk === 'verschil') return Math.abs(a.v - b.v) >= 10;
  if (b.v === 0) return a.v > 0 && k.richting === 'laag' && a.v >= 1;
  return Math.abs(a.v - b.v) / Math.abs(b.v) >= 0.2;
}

// te weinig gegevens aan één van beide kanten (< MIN_N): verschil wel tonen, maar niet als beter/slechter kleuren
function kleinGrijs(v, a, b) {
  if (v.oordeel && v.oordeel !== 'gelijk' && (a.klein || b.klein || (a.n || 0) < SK.MIN_N || (b.n || 0) < SK.MIN_N)) return Object.assign({}, v, { oordeel: 'klein' });
  return v;
}

// ---- puur rekenwerk ----
function bereken(inp) {
  const { bron, maand, vandaag } = inp;
  const vorige = new Date(maand.getFullYear(), maand.getMonth() - 1, 1);
  const sk = (eind, n) => SK.bereken(Object.assign({}, bron, { verloop: VR.berekenVerloop(bron.med, eind, n, vandaag), vandaag }));
  const skM = sk(maand, 1), skV = sk(vorige, 1), sk12 = sk(maand, 12), skW = sk(maand, WINKEL_MAANDEN);
  const T = skM.totaal, TV = skV.totaal, TJ = sk12.totaal;
  const lopend = sleutelVan(maand) === sleutelVan(vandaag);

  const kpis = SK.KPIS.filter(k => !TRAINING.includes(k.key)).map(k => {
    const a = T.waarden[k.key], b = TV.waarden[k.key], j = TJ.waarden[k.key];
    const verborgen = x => PRIVE.includes(k.key) && x && x.n < SK.MIN_N;
    return { key: k.key, label: k.label, groep: k.groep, eenheid: k.eenheid, richting: k.richting, uitleg: k.uitleg,
      nu: { v: a.v, f: verborgen(a) ? '-' : a.f, n: a.n, klein: a.klein }, vorig: { v: b.v, f: verborgen(b) ? '-' : b.f, n: b.n }, jaar: { v: j.v, f: verborgen(j) ? '-' : j.f, n: j.n },
      verschil: verborgen(a) || verborgen(b) ? { d: null, tekst: '', oordeel: null } : kleinGrijs(verschil(k, a.v, b.v), a, b), opvallend: !verborgen(a) && !verborgen(b) && opvallend(k, a, b) };
  });
  const training = bron.academy ? SK.KPIS.filter(k => TRAINING.includes(k.key)).map(k => ({ key: k.key, label: k.label, uitleg: k.uitleg, f: T.waarden[k.key].f, v: T.waarden[k.key].v, n: T.waarden[k.key].n })) : null;

  // winkels: 3 maanden t/m de rapportmaand, t.o.v. SLA over dezelfde 3 maanden
  const perMaand = {}; skM.winkels.forEach(w => { perMaand[w.naam] = w; });
  const winkels = skW.winkels.map(w => ({
    naam: w.naam, bestand: w.bestandEind, instroom: w.instroom, uitstroom: w.uitstroom, lopendVerzuim: w.lopendVerzuim,
    maand: perMaand[w.naam] ? { instroom: perMaand[w.naam].instroom, uitstroom: perMaand[w.naam].uitstroom } : { instroom: 0, uitstroom: 0 },
    verloop: w.waarden.verloop.f, verzuim: w.waarden.verzuimPct.f, checkin: w.waarden.checkinScore.n >= SK.MIN_N ? w.waarden.checkinScore.f : '-',
    status: { verloop: w.waarden.verloop.status, verzuim: w.waarden.verzuimPct.status, checkin: w.waarden.checkinScore.status },
    rood: w.rood, oranje: w.oranje, aandacht: w.aandacht.map(a => a.tekst), goed: w.goed.map(g => g.tekst)
  }));

  // samenvatting in gewone zinnen (cijfers eerst)
  const zinnen = [];
  const netto = T.instroom - T.uitstroom;
  const mw = n => n === 1 ? '1 medewerker' : n + ' medewerkers';
  zinnen.push('In ' + labelVan(maand) + (lopend ? ' (t/m vandaag)' : '') + (T.instroom === 1 ? ' kwam ' : ' kwamen ') + mw(T.instroom) + ' in dienst en ' + (T.uitstroom === 1 ? 'vertrok er 1' : 'vertrokken er ' + T.uitstroom) + ' (vorige maand ' + TV.instroom + ' in, ' + TV.uitstroom + ' uit); netto ' + (netto > 0 ? '+' : '') + netto + '. Eind van de maand ' + T.bestandEind + ' medewerkers in dienst.');
  if (TJ.waarden.verloop.v !== null) zinnen.push('Verloop over de laatste 12 maanden: ' + TJ.waarden.verloop.f + ' van het gemiddelde bestand' + (TJ.waarden.vroegPct.v !== null ? '; ' + TJ.waarden.vroegPct.f + ' van de vertrekkers was korter dan 90 dagen in dienst.' : '.'));
  kpis.filter(k => k.opvallend && k.key !== 'verloop').forEach(k => {
    zinnen.push(k.label + ' ' + (k.verschil.oordeel === 'beter' ? 'verbeterde' : 'verslechterde') + ': ' + k.nu.f + ' (vorige maand ' + k.vorig.f + ').');
  });
  const rodeWinkels = winkels.filter(w => w.rood > 0);
  if (rodeWinkels.length) zinnen.push('Winkels met de meeste aandachtspunten (laatste ' + WINKEL_MAANDEN + ' maanden): ' + rodeWinkels.slice(0, 3).map(w => w.naam + ' (' + w.rood + ')').join(', ') + '.');
  else if (winkels.length) zinnen.push('Geen winkel wijkt de laatste ' + WINKEL_MAANDEN + ' maanden duidelijk negatief af van het SLA-gemiddelde.');
  const red = inp.redenen;
  if (red && red.totaal && red.zonder) zinnen.push(red.zonder + ' van de ' + red.totaal + ' uitstroomdossiers met einddatum deze maand hebben geen uitstroomreden — vul die aan, anders weten we niet waarom mensen gaan.');
  if (training) {
    const ct = training.find(t => t.key === 'certGeldig');
    if (ct && ct.v !== null) zinnen.push('Training: ' + ct.f + ' van de medewerkers heeft een geldig certificaat voedselveiligheid in Academy (stand nu).');
  }

  return {
    sleutel: sleutelVan(maand), label: labelVan(maand), labelVorig: labelVan(vorige), lopend,
    vanIso: skM.vanIso, totIso: skM.totIso, periodeJaar: sk12.periode, periodeWinkels: skW.periode, winkelMaanden: WINKEL_MAANDEN,
    kern: { bestand: T.bestandEind, instroom: T.instroom, uitstroom: T.uitstroom, netto, verloop12: TJ.waarden.verloop.f, nuZiek: T.lopendVerzuim,
      vorig: { bestand: TV.bestandEind, instroom: TV.instroom, uitstroom: TV.uitstroom } },
    kpis, training, winkels, zinnen,
    trend: { maanden: sk12.maanden, in: TJ.trend.in, uit: TJ.trend.uit, checkin: TJ.trend.checkin, meldingen: TJ.trend.meldingen },
    redenen: red || null, activiteit: inp.activiteit || null, minN: SK.MIN_N
  };
}

// ---- HR-activiteit in de maand (wat deed HR) ----
const BRON_LABEL = { loonheffing: 'Loonheffing (uitnodiging/herinnering)', ontslag: 'Ontslag & aanzegging', sommatie: 'Sommaties', overplaatsing: 'Overplaatsingen', korting: 'Loonheffingskorting',
  waarschuwing: 'Waarschuwingen', proeftijd: 'Proeftijd', oosv: 'Ontslag op staande voet', brief: 'Vrije brieven', beschikbaarheid: 'Beschikbaarheid', oproep: 'Oproepaanbod',
  oproepaanbod: 'Oproepaanbod', checkin: 'Check-in 30/60', exit: 'Exit-survey', salaris: 'Documenten naar salaris', signalering: 'Signaleringen aan HR', maandrapport: 'Maandrapport' };
function telActiviteit(mails, gesprekken) {
  const perBron = {};
  (mails || []).forEach(m => { if (m.status && m.status !== 'verstuurd') return; perBron[m.bron] = (perBron[m.bron] || 0) + 1; });
  const mailsLijst = Object.keys(perBron).filter(b => b !== 'maandrapport').map(b => ({ bron: b, label: BRON_LABEL[b] || b, aantal: perBron[b] })).sort((a, b) => b.aantal - a.aantal);
  const soorten = {}; (C.GESPREK_SOORTEN || []).forEach(s => { soorten[s.key] = s.label; });
  const perSoort = {}; (gesprekken || []).forEach(g => { perSoort[g.soort] = (perSoort[g.soort] || 0) + 1; });
  return { mails: mailsLijst, mailsTotaal: mailsLijst.reduce((s, x) => s + x.aantal, 0),
    gesprekken: Object.keys(perSoort).map(k => ({ soort: k, label: soorten[k] || k, aantal: perSoort[k] })).sort((a, b) => b.aantal - a.aantal),
    gesprekkenTotaal: (gesprekken || []).length };
}

// ---- ophalen ----
async function laad(maandStr, ververs) {
  const vandaag = SK.nuNL(), maand = rapportMaand(maandStr, vandaag);
  const van12 = new Date(maand.getFullYear(), maand.getMonth() - 11, 1), eind = new Date(maand.getFullYear(), maand.getMonth() + 1, 0);
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const vanM = iso(maand), totM = iso(eind);
  const { admin } = require('./auth'), db = admin();
  const [bron, mails, gesprekken, redenen] = await Promise.all([
    SK.laadBronnen(iso(van12), totM, ververs),
    db.from('hr_mails').select('bron,type,status,tijdstip').gte('tijdstip', vanM + 'T00:00:00').lte('tijdstip', totM + 'T23:59:59').limit(5000).then(r => { if (r.error) throw new Error(r.error.message); return r.data || []; }).catch(e => ({ fout: 'mails: ' + e.message })),
    db.from('hr_gesprekken').select('soort,datum,winkel').gte('datum', vanM).lte('datum', totM).then(r => { if (r.error) throw new Error(r.error.message); return r.data || []; }).catch(e => ({ fout: 'gesprekken: ' + e.message })),
    VR.uitstroomredenen(vanM, totM)
  ]);
  const fouten = bron.fouten.slice();
  [mails, gesprekken].forEach(x => { if (x && x.fout) fouten.push(x.fout); });
  const activiteit = telActiviteit(Array.isArray(mails) ? mails : [], Array.isArray(gesprekken) ? gesprekken : []);
  const c = bron.checkins.filter(r => String(r.verstuurd_op || '').slice(0, 10) >= vanM && String(r.verstuurd_op || '').slice(0, 10) <= totM);
  activiteit.checkinVerstuurd = c.length; activiteit.checkinIngevuld = c.filter(r => r.ingevuld_op).length;
  activiteit.exitIngevuld = bron.exits.filter(r => String(r.ingevuld_op || '').slice(0, 10) >= vanM && String(r.ingevuld_op || '').slice(0, 10) <= totM).length;
  const r = bereken({ bron, maand, vandaag, activiteit, redenen });
  r.fouten = fouten; r.bijgewerkt = require('./datum').stempel();
  return r;
}

// Al verstuurd (automatisch)? Voorkomt een dubbele mail als de check handmatig 'echt' gedraaid wordt.
async function alVerstuurd(sleutel) {
  try {
    const { data } = await require('./auth').admin().from('hr_mails').select('id').eq('bron', 'maandrapport').eq('type', sleutel).limit(1);
    return !!(data && data.length);
  } catch (e) { return false; }
}

// ---- mail ----
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const onderwerp = r => 'HR-maandrapport ' + r.label;
function mailHtml(r, url) {
  const F = 'font-family:Arial,sans-serif;';
  const kleur = o => o === 'beter' ? '#009f4b' : o === 'slechter' ? '#c0392b' : '#888078';
  const tegel = (w, l) => '<td style="' + F + 'background:#f8f3f0;padding:10px 14px;border-radius:6px"><div style="font-size:20px;font-weight:bold;color:#333d3a">' + esc(w) + '</div><div style="font-size:11px;color:#888078">' + esc(l) + '</div></td>';
  const kpiRij = k => '<tr><td style="' + F + 'font-size:13px;padding:4px 10px 4px 0;color:#333d3a">' + esc(k.label) + '</td><td style="' + F + 'font-size:13px;font-weight:bold;padding:4px 10px">' + esc(k.nu.f) + '</td><td style="' + F + 'font-size:12px;color:#888078;padding:4px 10px">' + esc(k.vorig.f) + '</td><td style="' + F + 'font-size:12px;font-weight:bold;padding:4px 10px;color:' + kleur(k.verschil.oordeel) + '">' + esc(k.verschil.tekst) + '</td></tr>';
  const winkelRij = w => '<li style="margin:2px 0">' + esc(w.naam) + ': ' + esc(w.aandacht.join('; ')) + '</li>';
  return '<div style="' + F + 'color:#333d3a;max-width:640px">'
    + '<div style="font-size:22px;font-weight:bold;color:#009f4b">SLA</div><h2 style="' + F + 'margin:4px 0 2px">HR-maandrapport ' + esc(r.label) + '</h2>'
    + '<div style="font-size:12px;color:#888078;margin-bottom:14px">Automatisch gemaakt ' + esc(r.bijgewerkt || '') + ' · volledige rapport als PDF in de bijlage</div>'
    + '<table cellspacing="6" style="margin:0 -6px 10px"><tr>' + tegel(r.kern.bestand, 'in dienst (eind maand)') + tegel(r.kern.instroom, 'instroom') + tegel(r.kern.uitstroom, 'uitstroom') + tegel(r.kern.verloop12, 'verloop 12 mnd') + '</tr></table>'
    + '<h3 style="' + F + 'font-size:15px;margin:14px 0 6px">In het kort</h3><ul style="' + F + 'font-size:13px;padding-left:18px;margin:0">' + r.zinnen.map(z => '<li style="margin:3px 0">' + esc(z) + '</li>').join('') + '</ul>'
    + '<h3 style="' + F + 'font-size:15px;margin:16px 0 6px">SLA totaal</h3><table style="border-collapse:collapse"><tr><th style="' + F + 'font-size:11px;color:#888078;text-align:left;padding:2px 10px 2px 0">Indicator</th><th style="' + F + 'font-size:11px;color:#888078;text-align:left;padding:2px 10px">' + esc(r.label) + '</th><th style="' + F + 'font-size:11px;color:#888078;text-align:left;padding:2px 10px">' + esc(r.labelVorig) + '</th><th style="' + F + 'font-size:11px;color:#888078;text-align:left;padding:2px 10px">verschil</th></tr>' + r.kpis.map(kpiRij).join('') + '</table>'
    + (r.winkels.some(w => w.rood) ? '<h3 style="' + F + 'font-size:15px;margin:16px 0 6px">Aandachtspunten per winkel (laatste ' + r.winkelMaanden + ' maanden)</h3><ul style="' + F + 'font-size:13px;padding-left:18px;margin:0">' + r.winkels.filter(w => w.rood).map(winkelRij).join('') + '</ul>' : '')
    + (url ? '<p style="' + F + 'font-size:13px;margin-top:16px"><a href="' + esc(url) + '" style="color:#009f4b">Open het HR Dashboard (Scorekaart)</a></p>' : '')
    + '<p style="' + F + 'font-size:11px;color:#888078;margin-top:16px">Alleen geaggregeerde cijfers. Vertrouwelijk — niet doorsturen buiten HR en directie.</p></div>';
}
function mailPlain(r, url) {
  return 'HR-maandrapport ' + r.label + '\n\n'
    + 'In dienst eind maand: ' + r.kern.bestand + ' · instroom ' + r.kern.instroom + ' · uitstroom ' + r.kern.uitstroom + ' · verloop 12 mnd ' + r.kern.verloop12 + '\n\n'
    + r.zinnen.map(z => '- ' + z).join('\n') + '\n\n'
    + r.kpis.map(k => k.label + ': ' + k.nu.f + ' (' + r.labelVorig + ': ' + k.vorig.f + (k.verschil.tekst ? ', ' + k.verschil.tekst : '') + ')').join('\n')
    + '\n\nHet volledige rapport staat als PDF in de bijlage.' + (url ? '\nHR Dashboard: ' + url : '') + '\n';
}
async function mail(r, naar, door) {
  const M = require('./mail');
  const pdf = await require('./maandrapport-pdf').maakMaandrapportPdf(r, door === 'signalering' ? '' : door);
  const url = require('./uploads').site ? require('./uploads').site() : '';
  const ontv = (Array.isArray(naar) ? naar : String(naar || '').split(',')).map(s => s.trim()).filter(Boolean);
  const id = await M.verstuur({ to: ontv, subject: onderwerp(r), text: mailPlain(r, url), html: mailHtml(r, url),
    attachments: [{ filename: bestandsnaam(r), content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'maandrapport' }, { name: 'type', value: r.sleutel }] });
  await M.logMail({ door: door || 'signalering', bron: 'maandrapport', type: r.sleutel, naar: ontv.join(','), naam: '', onderwerp: onderwerp(r), taal: 'NL', rij: 0, resend_id: id });
  return id;
}
const bestandsnaam = r => 'HR-maandrapport_' + r.sleutel + '.pdf';

module.exports = { rapportMaand, bereken, laad, verschil, opvallend, telActiviteit, alVerstuurd, mail, mailHtml, mailPlain, onderwerp, bestandsnaam, WINKEL_MAANDEN };
