// ============================================================
// Fase 4c: contractverlenging als proces.
// Voor elk tijdelijk contract dat binnen VERLENG_VENSTER_DAGEN afloopt (Shiftbase, knips samengevoegd via contracten.js):
//   besluit nodig → besluit vastgelegd (hr_verlenging) → uitvoering gecontroleerd → afgerond.
// Besluiten: verlengen-tijdelijk | verlengen-vast | niet-verlengen | zelf-opgezegd.
// Uitvoering:
//   verlengen-*    → aansluitend vervolgcontract in Shiftbase (vast/tijdelijk moet kloppen met het besluit)
//   niet-verlengen → aanzegging verstuurd (hr_ontslag, ook gearchiveerd) ná de start van het huidige contract
//   zelf-opgezegd  → ontslagbevestiging verstuurd (idem)
// Aanzegplicht (art. 7:668 BW): contract ≥ 6 maanden → uiterlijk 1 maand vóór het einde schriftelijk laten weten óf en
// onder welke voorwaarden er verlengd wordt. Dashboard-deadline: VERLENG_BESLUIT_DAGEN (35) vóór het einde (5 dagen marge).
// Pure functies; de check (signaleringen.js) en /api/verlenging halen de data op.
// ============================================================
const C = require('./config');
const KT = require('./contracten');
const { normNaam, parseNLDatum } = require('./util');

const VENSTER = C.VERLENG_VENSTER_DAGEN || 60;
const DEADLINE = C.VERLENG_BESLUIT_DAGEN || 35;
const SHIFTBASE_WACHT = C.VERLENG_SHIFTBASE_DAGEN || 7;
const BESLUITEN = {
  'verlengen-tijdelijk': 'Verlengen (tijdelijk)',
  'verlengen-vast': 'Verlengen (vast contract)',
  'niet-verlengen': 'Niet verlengen',
  'zelf-opgezegd': 'Medewerker stopt zelf'
};
const ADVIES = { verlengen: 'Verlengen', niet: 'Niet verlengen', twijfel: 'Twijfel', '': 'Niet gevraagd' };

const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nl = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const dagen = (a, b) => Math.round((b - a) / 864e5);
const isOnbepaald = c => !c.eind || /onbepaald|indefinite|permanent|vast/i.test(c.type || '');
const sleutel = (mid, eindIso) => String(mid) + '|' + eindIso;

// Is er een aanzegging/ontslagbevestiging verstuurd voor dit contract? (ná de start van het huidige contract)
function verstuurdeBrief(ontslag, m, startIso) {
  const em = String(m.email || '').toLowerCase(), nn = normNaam(m.naam);
  const start = dag(startIso);
  let beste = null;
  for (const r of ontslag || []) {
    if (String(r.status || '').indexOf('Verzonden') !== 0) continue;
    const zelfde = (r.mid && String(r.mid) === String(m.id)) || (em && String(r.email || '').toLowerCase() === em) || (nn && normNaam(r.naam) === nn);
    if (!zelfde) continue;
    const vz = parseNLDatum(r.verzenddatum); if (!vz || (start && vz < start)) continue;
    if (!beste || vz > beste.vz) beste = { vz, type: r.type, verzonden: String(r.verzenddatum || '').split(' ')[0], gearchiveerd: !!r.gearchiveerd };
  }
  return beste;
}

// Overzicht van alle aflopende tijdelijke contracten met hun status.
// med = Shiftbase-medewerkers, perUser = contracten per user-id, besluiten = { 'mid|eindIso': rij hr_verlenging }, ontslag = getOntslag(true)
function overzicht(med, perUser, besluiten, ontslag, vandaag, correcties) {
  vandaag = vandaag || new Date(); besluiten = besluiten || {}; correcties = correcties || {};
  const uit = [];
  for (const m of med || []) {
    const cons = perUser[String(m.id)] || []; if (!cons.length) continue;
    const k = KT.bepaalKeten(cons, vandaag, correcties[String(m.id)]);
    if (!k || k.onbepaald || !k.huidig.eind) continue;
    const eind = dag(k.huidig.eind), totEinde = dagen(vandaag, eind);
    if (totEinde < 0 || totEinde > VENSTER) continue;
    const startIso = k.huidig.start, duurMnd = dagen(dag(startIso), eind) / 30.4375;
    const aanzegplichtig = duurMnd >= 5.95;                          // contract van 6 maanden of langer
    const deadline = new Date(eind.getTime()); deadline.setDate(deadline.getDate() - DEADLINE);
    const wettelijk = new Date(eind.getTime()); wettelijk.setMonth(wettelijk.getMonth() - 1);
    const b = besluiten[sleutel(m.id, k.huidig.eind)] || null;
    const volgende = k.volgende && dagen(eind, dag(k.volgende.start)) <= 1 ? k.volgende : null;
    const brief = verstuurdeBrief(ontslag, m, startIso);
    const item = {
      naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', mid: String(m.id),
      startIso, start: nl(startIso), eindIso: k.huidig.eind, einddatum: nl(k.huidig.eind), dagenTotEinde: totEinde,
      deadline: nl(iso(deadline)), dagenTotDeadline: dagen(vandaag, deadline), wettelijkeDeadline: nl(iso(wettelijk)), dagenTotWettelijk: dagen(vandaag, wettelijk),
      aanzegplichtig, duurMnd: Math.round(duurMnd * 10) / 10, type: k.huidig.type || '',
      keten: { aantal: k.aantal, maanden: k.maanden, vol: k.vol, laatste: !k.vol && k.aantal >= C.KETEN_MAX_CONTRACTEN - 1, gecorrigeerd: !!k.gecorrigeerd },
      besluit: b ? { besluit: b.besluit, label: BESLUITEN[b.besluit] || b.besluit, nieuweEind: b.nieuwe_eind || '', advies: b.advies_sm || '', adviesLabel: ADVIES[b.advies_sm || ''] || '', adviesOpmerking: b.advies_opmerking || '', notitie: b.notitie || '', door: b.besloten_door || '', op: b.besloten_op || '' } : null,
      vervolg: volgende ? { start: nl(volgende.start), eind: volgende.eind ? nl(volgende.eind) : '', vast: isOnbepaald(volgende), type: volgende.type || '' } : null,
      brief
    };
    // status + urgentie
    let status, urgentie, titel, uitleg = '';
    const dagenSindsBesluit = b && b.besloten_op ? dagen(new Date(b.besloten_op), vandaag) : 0;
    if (volgende) {
      if (b && b.besluit === 'verlengen-vast' && !isOnbepaald(volgende)) { status = 'type-klopt-niet'; urgentie = 'rood'; titel = 'Besloten: vast contract — maar in Shiftbase staat een tijdelijk vervolg'; uitleg = 'Zet het vervolgcontract in Shiftbase op onbepaalde tijd.'; }
      else if (b && (b.besluit === 'niet-verlengen' || b.besluit === 'zelf-opgezegd')) { status = 'tegenstrijdig'; urgentie = 'rood'; titel = 'Besloten: niet verlengen — maar in Shiftbase staat een vervolgcontract'; uitleg = 'Controleer het besluit of verwijder het vervolgcontract in Shiftbase.'; }
      else if (!isOnbepaald(volgende) && k.vol) { status = 'van-rechtswege-vast'; urgentie = 'rood'; titel = 'Tijdelijk verlengd terwijl de keten vol is — van rechtswege vast'; uitleg = 'Het vervolgcontract geldt als onbepaalde tijd; pas het contract aan.'; }
      else { status = 'afgerond'; urgentie = 'grijs'; titel = 'Verlengd' + (isOnbepaald(volgende) ? ' (vast)' : ' t/m ' + nl(volgende.eind)); }
    } else if (brief && (brief.type === 'aanzegging' || brief.type === 'ontslag')) {
      if (b && /^verlengen/.test(b.besluit)) { status = 'tegenstrijdig'; urgentie = 'rood'; titel = 'Besloten: verlengen — maar er is een ' + (brief.type === 'aanzegging' ? 'aanzegging' : 'ontslagbevestiging') + ' verstuurd'; uitleg = 'Controleer wat de bedoeling is.'; }
      else { status = 'afgerond'; urgentie = 'grijs'; titel = (brief.type === 'aanzegging' ? 'Aanzegging' : 'Ontslagbevestiging') + ' verstuurd op ' + brief.verzonden; }
    } else if (!b) {
      status = 'besluit-nodig';
      const laat = aanzegplichtig && item.dagenTotWettelijk < 0;
      urgentie = laat || (aanzegplichtig && item.dagenTotDeadline <= 5) ? 'rood' : aanzegplichtig || totEinde <= 21 ? 'oranje' : 'grijs';
      titel = laat ? 'Aanzegtermijn verstreken — besluit + brief nu (vergoeding loopt op)' : 'Contract loopt af — besluit nodig' + (aanzegplichtig ? ' vóór ' + item.deadline : '');
      uitleg = k.vol ? 'Keten vol: verlengen kan alleen nog met een vast contract.' : item.keten.laatste ? 'Het volgende contract is het laatste tijdelijke.' : '';
    } else if (/^verlengen/.test(b.besluit)) {
      status = 'wacht-shiftbase';
      urgentie = (aanzegplichtig && item.dagenTotDeadline <= 0) || dagenSindsBesluit > SHIFTBASE_WACHT || totEinde <= 14 ? 'rood' : 'oranje';
      titel = 'Besloten: ' + BESLUITEN[b.besluit].toLowerCase() + ' — nieuw contract nog niet in Shiftbase';
      uitleg = 'Maak het ' + (b.besluit === 'verlengen-vast' ? 'vaste ' : '') + 'contract in Shiftbase aan en laat het tekenen' + (aanzegplichtig ? ' (uiterlijk ' + item.wettelijkeDeadline + ' bij de medewerker, aanzegtermijn)' : '') + '.';
    } else if (b.besluit === 'niet-verlengen') {
      status = 'wacht-aanzegging'; urgentie = aanzegplichtig || totEinde <= 14 ? 'rood' : 'oranje';
      titel = 'Besloten: niet verlengen — aanzegging nog versturen' + (aanzegplichtig ? ' (uiterlijk ' + item.wettelijkeDeadline + ')' : '');
    } else {
      status = 'wacht-bevestiging'; urgentie = 'oranje';
      titel = 'Medewerker stopt zelf — ontslagbevestiging nog versturen';
    }
    uit.push(Object.assign(item, { status, urgentie, titel, uitleg, open: status !== 'afgerond' }));
  }
  const rang = { rood: 0, oranje: 1, grijs: 2 };
  return uit.sort((a, b) => (a.open === b.open ? 0 : a.open ? -1 : 1) || rang[a.urgentie] - rang[b.urgentie] || a.dagenTotEinde - b.dagenTotEinde);
}

// Validatie van een besluit (server-side): tijdelijk verlengen bij een volle keten mag alleen met expliciete bevestiging
function controleer(p, item) {
  if (!BESLUITEN[p.besluit]) throw new Error('Kies een besluit.');
  if (p.besluit === 'verlengen-tijdelijk') {
    const ne = String(p.nieuweEind || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ne)) throw new Error('Vul de nieuwe einddatum in.');
    if (item && ne <= item.eindIso) throw new Error('De nieuwe einddatum moet na ' + item.einddatum + ' liggen.');
    if (item && item.keten.vol && !p.bevestigVol) { const e = new Error('Keten vol: een nieuw tijdelijk contract wordt van rechtswege een vast contract. Kies "vast" of bevestig dat je dit weet.'); e.ketenVol = true; throw e; }
  }
  if (p.advies && !ADVIES[p.advies]) throw new Error('Onbekend advies.');
}

module.exports = { overzicht, controleer, verstuurdeBrief, sleutel, BESLUITEN, ADVIES, VENSTER, DEADLINE };
