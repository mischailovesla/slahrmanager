// ============================================================
// Fase 2a: ketenregeling (art. 7:668a BW) en proeftijd (art. 7:652 BW) uit de Shiftbase-contracten.
// Pure functies (testbaar); de check in signaleringen.js haalt de data op en mailt.
//
// Keten: opeenvolgende contracten voor bepaalde tijd; een tussenpoos > KETEN_ONDERBREKING_MAANDEN breekt de keten.
// Na KETEN_MAX_CONTRACTEN contracten óf KETEN_MAX_MAANDEN (gerekend vanaf de start van het eerste contract in de keten,
// tussenpozen tellen mee) ontstaat bij het volgende contract een arbeidsovereenkomst voor onbepaalde tijd.
// Let op: de CAO Horeca kan afwijken (bijv. seizoensarbeid); de grenzen staan daarom in config.js.
// ============================================================
const C = require('./config');

const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const ddmm = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || ''); };
const dagen = (a, b) => Math.round((b - a) / 864e5);
function plusMaanden(d, n) { const x = new Date(d.getTime()); x.setMonth(x.getMonth() + n); return x; }
const isOnbepaald = c => !c.eind || /onbepaald|indefinite|permanent|vast/i.test(c.type || '');

// Keten bepalen voor één medewerker. contracten = [{start, eind, type}] gesorteerd op start.
// Geeft { keten: [...], aantal, maanden, vol: boolean, reden, huidig, volgendeIsVast }
function bepaalKeten(contracten, vandaag) {
  vandaag = vandaag || new Date();
  const lijst = (contracten || []).filter(c => dag(c.start)).sort((a, b) => a.start < b.start ? -1 : 1);
  if (!lijst.length) return null;
  const huidig = lijst.filter(c => dag(c.start) <= vandaag && (!c.eind || dag(c.eind) >= vandaag)).pop() || lijst[lijst.length - 1];
  if (isOnbepaald(huidig)) return { huidig, keten: [], aantal: 0, maanden: 0, vol: false, onbepaald: true };
  // keten opbouwen: terug vanaf het huidige contract zolang de tussenpoos ≤ onderbreking
  const idx = lijst.indexOf(huidig);
  const keten = [huidig];
  for (let i = idx - 1; i >= 0; i--) {
    const vorige = lijst[i], volgende = keten[0];
    const eindVorige = dag(vorige.eind) || dag(volgende.start);
    const gat = dagen(eindVorige, dag(volgende.start));
    if (gat > C.KETEN_ONDERBREKING_MAANDEN * 30.5) break;
    if (isOnbepaald(vorige)) break; // een vast contract ervoor telt niet mee in de keten van tijdelijke
    keten.unshift(vorige);
  }
  const start = dag(keten[0].start), eind = dag(huidig.eind) || vandaag;
  const maanden = Math.round(dagen(start, eind) / 30.4375 * 10) / 10;
  const aantal = keten.length;
  // "vol" = een volgend tijdelijk contract is niet meer mogelijk zonder dat het van rechtswege vast wordt
  const volAantal = aantal >= C.KETEN_MAX_CONTRACTEN;
  const volDuur = dagen(start, plusMaanden(eind, 1)) > C.KETEN_MAX_MAANDEN * 30.4375; // zelfs 1 maand verlenging gaat over de grens
  const vol = volAantal || volDuur;
  const reden = volAantal ? aantal + 'e tijdelijke contract (max. ' + C.KETEN_MAX_CONTRACTEN + ')' : volDuur ? 'keten loopt tegen ' + C.KETEN_MAX_MAANDEN + ' maanden (nu ' + maanden + ')' : '';
  return { huidig, keten, aantal, maanden, vol, reden, onbepaald: false };
}

// Proeftijd: alleen bij het eerste contract van een medewerker (of na een duidelijk andere functie — niet detecteerbaar; we beperken ons tot het eerste).
// Duur: contract ≤ 6 mnd → geen; > 6 mnd en < 24 mnd → 1 maand; ≥ 24 mnd of onbepaald → 2 maanden.
function proeftijdEinde(contract) {
  const s = dag(contract.start); if (!s) return null;
  if (isOnbepaald(contract)) return plusMaanden(s, 2);
  const e = dag(contract.eind); if (!e) return plusMaanden(s, 2);
  const duurMnd = dagen(s, e) / 30.4375;
  if (duurMnd <= 6.05) return null;
  return plusMaanden(s, duurMnd < 24 ? 1 : 2);
}

// Signalen over alle medewerkers. med = Shiftbase-medewerkerslijst, perUser = contracten per user-id.
function contractSignalen(med, perUser, vandaag) {
  vandaag = vandaag || new Date();
  const uit = [];
  for (const m of med || []) {
    const cons = perUser[String(m.id)] || [];
    if (!cons.length) continue;
    const k = bepaalKeten(cons, vandaag);
    if (k && !k.onbepaald && k.huidig.eind) {
      const totEinde = dagen(vandaag, dag(k.huidig.eind));
      if (totEinde >= 0 && totEinde <= C.KETEN_VENSTER_DAGEN && (k.vol || k.aantal >= C.KETEN_MAX_CONTRACTEN - 1)) {
        uit.push({ soort: 'keten', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', einddatum: ddmm(k.huidig.eind), dagenTotEinde: totEinde, aantal: k.aantal, maanden: k.maanden, vol: k.vol, reden: k.reden || (k.aantal + 'e contract; het volgende is het laatste tijdelijke'), type: k.huidig.type || '' });
      }
    }
    // proeftijd: eerste contract ooit, gestart ≤ 70 dagen geleden
    const eerste = cons[0];
    if (dagen(dag(eerste.start), vandaag) <= 70 && dagen(dag(eerste.start), vandaag) >= 0) {
      const pe = proeftijdEinde(eerste);
      if (pe) {
        const tot = dagen(vandaag, pe);
        if (tot >= -2 && tot <= C.PROEFTIJD_SIGNAAL_DAGEN) uit.push({ soort: 'proeftijd', naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', start: ddmm(eerste.start), proeftijdEinde: pe.toLocaleDateString('sv-SE').split('-').reverse().join('-'), dagenTotEinde: tot, type: eerste.type || '' });
      }
    }
  }
  return uit.sort((a, b) => a.dagenTotEinde - b.dagenTotEinde);
}

module.exports = { bepaalKeten, proeftijdEinde, contractSignalen };
