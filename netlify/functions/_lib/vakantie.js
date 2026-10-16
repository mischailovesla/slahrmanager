// ============================================================
// Vakantieplanner (port van Shiftbase.gs v6): heatmap winkel × week met het
// maximum aantal medewerkers dat tegelijk met vakantie is (goedgekeurd +
// aangevraagd apart), afgezet tegen de bezetting; stille afwezigen als extra
// laag vanaf de huidige week; piek-signalering (wekelijks).
// Privacy: alleen aantallen en namen, geen loondata.
// ============================================================
const SB = require('./shiftbase');
const C = require('./config');
const D = require('./datum');
const W = require('./weekend');

const MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const { iso, plusDagen, isoWeek, vandaag0 } = W;

// Pure rekenfunctie: per winkel per week het MAX aantal tegelijk afwezig (op 1 dag)
function berekenVakantieMatrix(med, absLijst, maandag, wekenAantal) {
  const kort = d => d.getDate() + '/' + (d.getMonth() + 1);
  const medById = {}, perWinkel = {};
  (med || []).forEach(m => { const w = m.winkelNaam || '(geen winkel)'; medById[String(m.id)] = { naam: m.naam, winkel: w }; perWinkel[w] = (perWinkel[w] || 0) + 1; });
  const items = [];
  (absLijst || []).forEach(a0 => {
    const a = (a0 && a0.Absentee) || a0 || {};
    if (String(a.absentee_option_id) !== C.VAKANTIE_OPTION_ID) return;
    const st = String(a.status || ''); if (st !== 'Approved' && st !== 'Pending') return;
    const mm = medById[String(a.user_id || '')]; if (!mm) return;
    items.push({ winkel: mm.winkel, naam: mm.naam, pending: st === 'Pending', sd: String(a.startdate || ''), ed: String(a.enddate || a.startdate || '') });
  });
  const weken = [];
  for (let w = 0; w < wekenAantal; w++) { const ws = plusDagen(maandag, w * 7), we = plusDagen(maandag, w * 7 + 6); weken.push({ label: kort(ws) + ' - ' + kort(we), weeknr: isoWeek(ws), maand: MAAND_KORT[ws.getMonth()], van: iso(ws) }); }
  const rijen = Object.keys(perWinkel).sort().map(wn => {
    const cellen = [];
    for (let w = 0; w < wekenAantal; w++) {
      let maxApp = 0, maxTot = 0; const celNamen = {};
      for (let d = 0; d < 7; d++) {
        const dag = iso(plusDagen(maandag, w * 7 + d)); let cApp = 0, cPend = 0;
        for (const x of items) { if (x.winkel !== wn || !(x.sd <= dag && dag <= x.ed)) continue; if (x.pending) { cPend++; celNamen[x.naam + ' (aangevraagd)'] = 1; } else { cApp++; celNamen[x.naam] = 1; } }
        if (cApp > maxApp) maxApp = cApp; if (cApp + cPend > maxTot) maxTot = cApp + cPend;
      }
      const cel = { app: maxApp, pend: Math.max(0, maxTot - maxApp) }; const ns = Object.keys(celNamen).sort(); if (ns.length) cel.namen = ns;
      cellen.push(cel);
    }
    return { naam: wn, bezetting: perWinkel[wn], cellen };
  });
  return { weken, rijen };
}
// Stille afwezigen (momentopname vandaag) — zelfde logica als de signalering
async function getStilleAfwezigen(med) {
  const SIG = require('./signaleringen');
  const vandaag = vandaag0();
  const [ros, abs] = await Promise.all([
    SB.sbGet('rosters?min_date=' + iso(plusDagen(vandaag, -C.STIL_LOOKBACK_DAGEN)) + '&max_date=' + iso(plusDagen(vandaag, C.STIL_TOEKOMST_DAGEN))),
    SB.sbGet('absentees?min_date=' + iso(plusDagen(vandaag, -C.STIL_VENSTER_DAGEN)) + '&max_date=' + iso(vandaag))
  ]);
  return { lijst: SIG.bepaalStilleAfwezigen(med, ros || [], abs || [], vandaag, C.STIL_VENSTER_DAGEN, C.STIL_UITGESLOTEN_WINKELS), vensterDagen: C.STIL_VENSTER_DAGEN, lookback: C.STIL_LOOKBACK_DAGEN, bijgewerkt: D.stempel() };
}
async function getVakantiePlannerData(jaar) {
  const med = await SB.getMedewerkers(false);
  const vandaag = vandaag0();
  const j = parseInt(jaar, 10) || vandaag.getFullYear();
  const eerste = new Date(j, 0, 1), maandag = plusDagen(eerste, -((eerste.getDay() + 6) % 7)), laatste = new Date(j, 11, 31);
  const wekenAantal = Math.ceil((Math.round((laatste - maandag) / 864e5) + 1) / 7);
  const abs = await SB.sbGet('absentees?min_date=' + iso(maandag) + '&max_date=' + iso(plusDagen(maandag, wekenAantal * 7)));
  const matrix = berekenVakantieMatrix(med, abs || [], maandag, wekenAantal);
  matrix.jaar = j; matrix.huidigeWeek = -1;
  const dagIdx = Math.round((vandaag - maandag) / 864e5);
  if (dagIdx >= 0) { const wIdx = Math.floor(dagIdx / 7); if (wIdx < wekenAantal) matrix.huidigeWeek = wIdx; }
  matrix.drempelOranje = C.VAKANTIE_DREMPEL_ORANJE; matrix.drempelRood = C.VAKANTIE_DREMPEL_ROOD; matrix.bijgewerkt = D.stempel();
  if (matrix.huidigeWeek >= 0) {
    try {
      const stil = await getStilleAfwezigen(med);
      const perWinkel = {};
      stil.lijst.forEach(s => { (perWinkel[s.winkel] = perWinkel[s.winkel] || { aantal: 0, namen: [] }).aantal++; perWinkel[s.winkel].namen.push(s.naam); });
      matrix.rijen.forEach(rij => { const st = perWinkel[rij.naam]; if (!st) return; for (let wi = matrix.huidigeWeek; wi < rij.cellen.length; wi++) { rij.cellen[wi].stil = st.aantal; rij.cellen[wi].stilNamen = st.namen; } });
    } catch (e) { console.warn('Stil-laag overgeslagen:', e.message); }
  }
  return matrix;
}
// Pieken in de komende VAKANTIE_PIEK_WEKEN weken (checkVakantiepieken)
function bepaalPieken(d) {
  const pieken = [], startW = d.huidigeWeek >= 0 ? d.huidigeWeek : 0;
  for (const rij of d.rijen) {
    if (rij.bezetting < C.VAKANTIE_PIEK_MIN_BEZETTING) continue;
    for (let w = startW; w < Math.min(startW + C.VAKANTIE_PIEK_WEKEN, rij.cellen.length); w++) {
      const c = rij.cellen[w], stil = c.stil || 0, vast = c.app + stil, ratio = vast / rij.bezetting, ratioTot = (vast + c.pend) / rij.bezetting;
      if (ratio >= C.VAKANTIE_DREMPEL_ROOD || ratioTot >= C.VAKANTIE_DREMPEL_ROOD) pieken.push({ winkel: rij.naam, bezetting: rij.bezetting, week: d.weken[w].label, weeknr: d.weken[w].weeknr, app: c.app, pend: c.pend, stil, namen: c.namen || [], stilNamen: c.stilNamen || [], alRood: ratio >= C.VAKANTIE_DREMPEL_ROOD });
    }
  }
  return pieken;
}
module.exports = { berekenVakantieMatrix, getVakantiePlannerData, getStilleAfwezigen, bepaalPieken };
