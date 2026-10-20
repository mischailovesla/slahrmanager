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
// Onbepaalde tijd = geen einddatum, of een type dat dat expliciet zegt. LET OP: "Vaste uren" betekent een vast aantal
// uren per week (tegenover nul uren), níet een vast contract — daarom matchen we niet op het losse woord "vast".
const isOnbepaald = c => !c.eind || /onbepaald|indefinite|permanent|vast\s*contract|vaste\s*aanstelling|vast\s*dienstverband/i.test(c.type || '');

// ---- Shiftbase-records → arbeidsovereenkomsten (v0.19.1) ----
// Shiftbase knipt een contract op bij elke loon-/urenwijziging (vrijwel altijd op 01-01 en 01-07, soms op een verjaardag
// of een andere datum). Zo'n knip is géén nieuwe arbeidsovereenkomst en telt niet mee voor de ketenregeling.
// Regel (Mischa, 20-10-2026: "elke aansluitende knip"): records die zonder gat aansluiten horen bij dezelfde overeenkomst,
// tenzij het vorige deel eindigt op een "afgesproken einde" (hele maanden na de start van de overeenkomst, ±2 dagen),
// of het nieuwe deel zelf een nieuwe looptijd van hele maanden heeft (en niet op 01-01/01-07 begint).
// Bij twijfel telt het als nieuw contract (veilige kant); HR kan het aantal per medewerker corrigeren.
const TOLERANTIE = 2;
function heleMaanden(startIso, eindIso) {
  const s = dag(startIso), e = dag(eindIso); if (!s || !e || e <= s) return 0;
  for (let k = 1; k <= 60; k++) { const t = plusMaanden(s, k), d = dagen(t, e); if (Math.abs(d) <= TOLERANTIE) return k; if (d < -TOLERANTIE) break; }
  return 0;
}
const loondatum = iso => /-(01-01|07-01)$/.test(String(iso || ''));
function overeenkomsten(contracten) {
  const lijst = (contracten || []).filter(c => dag(c.start)).slice().sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const uit = [];
  lijst.forEach((c, i) => {
    const g = uit[uit.length - 1];
    if (g && !isOnbepaald(g) && !isOnbepaald(c) && g.eind) {
      const gat = dagen(dag(g.eind), dag(c.start));
      let knip = false;
      if (gat <= 1) {
        if (gat < -1) knip = true;                                   // begint ruim vóór het einde: wijziging binnen het contract
        else if (heleMaanden(g.start, g.eind)) {                      // vorige eindigde op een afgesproken einde → verlenging,
          // behalve bij een loonknip op 01-01/01-07 waarna het contract doorloopt tot een (later) afgesproken einde vanaf dezelfde start
          knip = false;
          if (loondatum(c.start)) {
            for (let j = i; j < lijst.length; j++) {
              const x = lijst[j]; if (!x.eind) break;
              if (j > i && dagen(dag(lijst[j - 1].eind), dag(x.start)) > 1) break;
              const na = lijst[j + 1], volgtLoonknip = na && dagen(dag(x.eind), dag(na.start)) <= 1 && loondatum(na.start);
              if (heleMaanden(g.start, x.eind) && !volgtLoonknip) { knip = true; break; }
            }
          }
        }
        else {
          // kijk vooruit: heeft dit deel (met de knips erna) een eigen looptijd van hele maanden? Een "hele maanden"-einde
          // waar direct een deel op 01-01/01-07 op aansluit is zelf een loonknip en telt niet als afgesproken einde.
          let eigen = false;
          for (let j = i; j < lijst.length; j++) {
            const x = lijst[j]; if (!x.eind) break;
            if (j > i && dagen(dag(lijst[j - 1].eind), dag(x.start)) > 1) break;
            const na = lijst[j + 1], volgtLoonknip = na && dagen(dag(x.eind), dag(na.start)) <= 1 && loondatum(na.start);
            if (heleMaanden(c.start, x.eind) && !volgtLoonknip) { eigen = true; break; }
          }
          knip = !eigen;
        }
      }
      if (knip) { g.delen.push(c); if (!c.eind || (g.eind && c.eind > g.eind)) g.eind = c.eind; g.type = c.type || g.type; g.functie = c.functie || g.functie; return; }
    }
    uit.push({ start: c.start, eind: c.eind, type: c.type, functie: c.functie, delen: [c] });
  });
  return uit;
}

// Keten bepalen voor één medewerker. contracten = Shiftbase-records [{start, eind, type}].
// correctie (optioneel) = { aantal, huidigStart } door HR vastgelegd: geldt zolang de huidige overeenkomst dezelfde start heeft.
// Geeft { keten, aantal, maanden, vol, reden, huidig, volgende, overeenkomsten, gecorrigeerd }
function bepaalKeten(contracten, vandaag, correctie) {
  vandaag = vandaag || new Date();
  const lijst = overeenkomsten(contracten);
  if (!lijst.length) return null;
  const huidig = lijst.filter(c => dag(c.start) <= vandaag && (!c.eind || dag(c.eind) >= vandaag)).pop() || lijst.filter(c => dag(c.start) <= vandaag).pop() || lijst[0];
  const idx = lijst.indexOf(huidig), volgende = lijst[idx + 1] || null;
  if (isOnbepaald(huidig)) return { huidig, volgende, keten: [], aantal: 0, maanden: 0, vol: false, onbepaald: true, overeenkomsten: lijst };
  const r = ketenTot(lijst, idx, vandaag, correctie);
  return Object.assign(r, { huidig, volgende, overeenkomsten: lijst, onbepaald: false });
}
// keten t/m overeenkomst idx (terug zolang de tussenpoos ≤ onderbreking en er geen vast contract tussen zit)
function ketenTot(lijst, idx, vandaag, correctie) {
  const huidig = lijst[idx], keten = [huidig];
  for (let i = idx - 1; i >= 0; i--) {
    const vorige = lijst[i], volgende = keten[0];
    const eindVorige = dag(vorige.eind) || dag(volgende.start);
    if (dagen(eindVorige, dag(volgende.start)) > C.KETEN_ONDERBREKING_MAANDEN * 30.5) break;
    if (isOnbepaald(vorige)) break;
    keten.unshift(vorige);
  }
  const start = dag(keten[0].start), eind = dag(huidig.eind) || vandaag;
  const maanden = Math.round(dagen(start, eind) / 30.4375 * 10) / 10;
  const gecorrigeerd = !!(correctie && correctie.aantal && correctie.huidigStart === huidig.start);
  const aantal = gecorrigeerd ? Number(correctie.aantal) : keten.length;
  const volAantal = aantal >= C.KETEN_MAX_CONTRACTEN;
  const volDuur = dagen(start, plusMaanden(eind, 1)) > C.KETEN_MAX_MAANDEN * 30.4375; // zelfs 1 maand verlenging gaat over de grens
  const overDuur = dagen(start, eind) > C.KETEN_MAX_MAANDEN * 30.4375 + 1;           // al over de grens
  const vol = volAantal || volDuur;
  const reden = volAantal ? aantal + 'e tijdelijke contract (max. ' + C.KETEN_MAX_CONTRACTEN + ')' : volDuur ? 'keten loopt tegen ' + C.KETEN_MAX_MAANDEN + ' maanden (nu ' + maanden + ')' : '';
  return { keten, aantal, maanden, vol, reden, gecorrigeerd, overGrens: aantal > C.KETEN_MAX_CONTRACTEN || overDuur, startKeten: keten[0].start };
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

// Signalen over alle medewerkers. med = Shiftbase-medewerkerslijst, perUser = contracten per user-id,
// correcties = { [user-id]: { aantal, huidigStart } } (HR, hr_instellingen 'keten_correcties').
// - Loopt het huidige contract binnen het venster af en is er nog géén vervolgcontract → signaal 'keten' (zoals voorheen).
// - Is er al een vervolgcontract: onbepaald → geen signaal; tijdelijk en de keten gaat daarmee over de grens →
//   signaal 'vast' (rood): van rechtswege onbepaalde tijd, Shiftbase/contract aanpassen. Anders geen signaal.
// - Contract voorbij → geen signaal meer (de check draait dagelijks opnieuw).
function contractSignalen(med, perUser, vandaag, correcties) {
  vandaag = vandaag || new Date(); correcties = correcties || {};
  const uit = [];
  for (const m of med || []) {
    const cons = perUser[String(m.id)] || [];
    if (!cons.length) continue;
    const corr = correcties[String(m.id)];
    const k = bepaalKeten(cons, vandaag, corr);
    const basis = { naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '-', mid: String(m.id) };
    if (k && !k.onbepaald && k.huidig.eind) {
      const totEinde = dagen(vandaag, dag(k.huidig.eind));
      if (totEinde >= 0 && totEinde <= C.KETEN_VENSTER_DAGEN) {
        const contractenTekst = k.keten.map(o => ddmm(o.start)).join(', ');
        if (k.volgende && dagen(dag(k.huidig.eind), dag(k.volgende.start)) <= 1) {
          if (!isOnbepaald(k.volgende)) {
            const na = ketenTot(k.overeenkomsten, k.overeenkomsten.indexOf(k.volgende), vandaag, null);
            if (corr && corr.aantal && corr.huidigStart === k.huidig.start) na.aantal = Number(corr.aantal) + 1;
            const over = na.aantal > C.KETEN_MAX_CONTRACTEN || dagen(dag(na.startKeten), dag(k.volgende.eind) || vandaag) > C.KETEN_MAX_MAANDEN * 30.4375 + 1;
            if (over) uit.push(Object.assign({ soort: 'vast', einddatum: ddmm(k.huidig.eind), dagenTotEinde: totEinde, verlengdTot: ddmm(k.volgende.eind), aantal: na.aantal, maanden: Math.round(dagen(dag(na.startKeten), dag(k.volgende.eind) || vandaag) / 30.4375 * 10) / 10, contracten: contractenTekst + ', ' + ddmm(k.volgende.start), vol: true, reden: 'tijdelijk verlengd t/m ' + ddmm(k.volgende.eind) + ' terwijl de keten vol is', type: k.volgende.type || '' }, basis));
          }
          continue; // verlengd (vast, of tijdelijk binnen de keten): geen taak meer
        }
        if (k.vol || k.aantal >= C.KETEN_MAX_CONTRACTEN - 1) {
          uit.push(Object.assign({ soort: 'keten', einddatum: ddmm(k.huidig.eind), dagenTotEinde: totEinde, aantal: k.aantal, maanden: k.maanden, vol: k.vol, gecorrigeerd: k.gecorrigeerd, contracten: contractenTekst, huidigStart: k.huidig.start, reden: k.reden || (k.aantal + 'e contract; het volgende is het laatste tijdelijke'), type: k.huidig.type || '' }, basis));
        }
      }
    }
    // proeftijd: eerste arbeidsovereenkomst ooit (knips samengevoegd), gestart ≤ 70 dagen geleden
    const eerste = overeenkomsten(cons)[0];
    if (eerste && dagen(dag(eerste.start), vandaag) <= 70 && dagen(dag(eerste.start), vandaag) >= 0) {
      const pe = proeftijdEinde(eerste);
      if (pe) {
        const tot = dagen(vandaag, pe);
        if (tot >= -2 && tot <= C.PROEFTIJD_SIGNAAL_DAGEN) uit.push(Object.assign({ soort: 'proeftijd', start: ddmm(eerste.start), proeftijdEinde: pe.toLocaleDateString('sv-SE').split('-').reverse().join('-'), dagenTotEinde: tot, type: eerste.type || '' }, basis));
      }
    }
  }
  return uit.sort((a, b) => a.dagenTotEinde - b.dagenTotEinde);
}

module.exports = { bepaalKeten, overeenkomsten, heleMaanden, proeftijdEinde, contractSignalen };
