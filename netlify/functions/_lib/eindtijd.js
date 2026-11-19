// ============================================================
// v0.48.0: Eindtijd & afsluiten — op tijd klaar zijn na een sluitdienst.
// Bron: Shiftbase-timesheets + rooster (API), of de Shiftbase-export "Urenregistratie" (xlsx).
// Beide bronnen worden eerst omgezet naar dezelfde "dienst"-regels; daarna rekent analyseer() alles uit.
//
// Definities (overdracht 13-11-2026, Mischa):
//  - sluitdienst      = geroosterde eindtijd >= 20:00 (ook een rooster dat na middernacht eindigt)
//  - werkelijk einde  = uitklok; geen uitklok -> eindtijd van de timesheet (gemarkeerd "zonder uitklok")
//  - minuten te laat  = werkelijk einde - geroosterde eindtijd (over middernacht doorgeteld)
//  - afgekeurde timesheets tellen niet mee
//  - voordragen voor waarschuwing: >= 3 sluitdiensten > 30 min te laat EN >= 50% van zijn/haar sluitdiensten
// Alles hier is puur (geen netwerk/database), zodat het met tests/eindtijd.test.js te controleren is.
// ============================================================

const INSTELLINGEN = { sluitVanaf: 20 * 60, drempel: 30, grens: 22 * 60, minLaat: 3, minPct: 50, lasten: 0.35 };
const CATEGORIE_TEAMBRIEF = 'Eindtijd & afsluiten';
const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
// v0.48.1: Engelse brieven
const WEEKDAG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAAND_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- kleine helpers ----------
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
// "21:30", "21:30:00" of een Excel-tijdfractie -> minuten na middernacht
function tijdMin(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const f = v - Math.floor(v); return Math.round(f * 1440 * 60) / 60; }
  const m = String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? (+m[1]) * 60 + (+m[2]) + (m[3] ? (+m[3]) / 60 : 0) : null;
}
// Excel-serienummer -> 'jjjj-mm-dd'
function serieDatum(s) { const d = new Date(Math.round((Math.floor(s) - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
function isoDatum(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return serieDatum(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/); if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  return '';
}
const dagVerschil = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const weekdag = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
function hhmm(min) { if (min == null) return ''; const m = Math.round(((min % 1440) + 1440) % 1440); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function nlDatum(iso) { return iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) : ''; }
const isEn = taal => String(taal || '').toUpperCase() === 'EN';
function langeDatum(iso, metDag, taal) {
  if (!iso) return ''; const d = new Date(iso + 'T12:00:00Z'), en = isEn(taal);
  return (metDag ? (en ? WEEKDAG_EN : WEEKDAG)[d.getUTCDay()] + ' ' : '') + d.getUTCDate() + ' ' + (en ? MAAND_EN : MAAND)[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}
function periodeTekst(van, tot, taal) {
  if (!van || !tot) return '';
  const a = new Date(van + 'T12:00:00Z'), b = new Date(tot + 'T12:00:00Z'), en = isEn(taal);
  const links = a.getUTCDate() + ' ' + (en ? MAAND_EN : MAAND)[a.getUTCMonth()] + (a.getUTCFullYear() !== b.getUTCFullYear() ? ' ' + a.getUTCFullYear() : '');
  return links + (en ? ' to ' : ' t/m ') + langeDatum(tot, false, taal);
}
function opsomming(lijst, taal) { return lijst.length <= 1 ? (lijst[0] || '') : lijst.slice(0, -1).join(', ') + (isEn(taal) ? ' and ' : ' en ') + lijst[lijst.length - 1]; }
const winkelLabel = team => String(team || '').replace(/^SLA\s+/i, '').trim();
function statusVan(s) {
  const t = String(s || '').toLowerCase();
  if (/afgekeurd|declin|reject|afgewez/.test(t)) return 'afgekeurd';
  if (/goedgekeurd|approv/.test(t)) return 'goedgekeurd';
  return 'onbeslist';
}
// Werkelijk einde t.o.v. het geroosterde einde: een uitklok "kort na middernacht" hoort bij dezelfde avond
function naRooster(eind, rEind) { if (eind == null || rEind == null) return eind; let e = eind; while (e < rEind - 720) e += 1440; return e; }

// ---------- Bron 1: Shiftbase-export "Urenregistratie" (xlsx) ----------
const KOLOMMEN = ['Gebruikers-id', 'Naam', 'Datum', 'Team', 'Status', 'Rooster eindtijd', 'Eindtijd', 'Uitgeklokt om'];
function vanExport(blad) {
  const kop = (blad && blad.kop) || [];
  const i = n => kop.indexOf(n);
  const mist = KOLOMMEN.filter(k => i(k) < 0);
  if (mist.length) throw new Error('Dit lijkt geen Shiftbase-export "Urenregistratie": kolom(men) ' + mist.join(', ') + ' ontbreken. Exporteer in Shiftbase via Urenregistratie → Exporteren (xlsx).');
  const k = {}; ['Gebruikers-id', 'Naam', 'Datum', 'Team', 'Team-id', 'Afdeling-id', 'Status', 'Rooster starttijd', 'Rooster eindtijd', 'Eindtijd', 'Uitgeklokt om', 'Gewerkt', 'Rooster totaal', 'Uurloon', 'Contracttype', 'Gekeurd door'].forEach(n => { k[n] = i(n); });
  const v = (r, n) => (k[n] >= 0 ? r[k[n]] : null);
  const uit = [];
  for (const r of blad.rijen || []) {
    const datum = isoDatum(v(r, 'Datum')); if (!datum) continue;
    const rStart = tijdMin(v(r, 'Rooster starttijd'));
    let rEind = tijdMin(v(r, 'Rooster eindtijd'));
    if (rEind != null && rStart != null && rEind <= rStart) rEind += 1440;
    const uk = v(r, 'Uitgeklokt om');
    let eind = null, zonder = false;
    if (typeof uk === 'number' && uk > 0) eind = dagVerschil(datum, serieDatum(uk)) * 1440 + tijdMin(uk);
    else if (uk && isoDatum(uk)) eind = dagVerschil(datum, isoDatum(uk)) * 1440 + tijdMin(String(uk).slice(10));
    if (eind == null) { eind = tijdMin(v(r, 'Eindtijd')); zonder = true; }
    uit.push({
      uid: String(v(r, 'Gebruikers-id') == null ? '' : v(r, 'Gebruikers-id')).replace(/\.0$/, ''),
      naam: String(v(r, 'Naam') || '').trim(), datum,
      deptId: String(v(r, 'Afdeling-id') == null ? '' : v(r, 'Afdeling-id')).replace(/\.0$/, ''),
      team: String(v(r, 'Team') || '').trim(), status: statusVan(v(r, 'Status')),
      rEind, eind: naRooster(eind, rEind), zonderUitklok: zonder,
      gewerkt: num(v(r, 'Gewerkt')), rTotaal: num(v(r, 'Rooster totaal')), uurloon: num(v(r, 'Uurloon')),
      contracttype: String(v(r, 'Contracttype') || '').trim(), gekeurdDoor: String(v(r, 'Gekeurd door') || '').trim()
    });
  }
  return uit;
}

// ---------- Bron 2: Shiftbase-API (timesheets + rosters + users + teams) ----------
// Veldnamen gecontroleerd op echte API-antwoorden (16-11-2026): Timesheet.roster_id/clocked_out/endtime/total/wage/status/reviewed_by,
// Roster.id/date/starttime/endtime/total/department_id/Department.name. Een timesheet zonder roster_id heeft geen rooster (net als in de export).
function vanApi(o) {
  const lijst = x => ((x && x.data) || x || []);
  const naamVan = {}, teamInfo = {}, rooster = {}, deptNaam = {};
  for (const rec of lijst(o.users)) { const u = (rec && rec.User) || rec || {}; if (u.id != null) naamVan[String(u.id)] = ((u.first_name || '') + ' ' + (u.prefix ? u.prefix + ' ' : '') + (u.last_name || '')).replace(/\s+/g, ' ').trim(); }
  for (const rec of lijst(o.teams)) { const t = (rec && rec.Team) || rec || {}; if (t.id != null) teamInfo[String(t.id)] = { dept: String(t.department_id || ''), naam: String(t.name || '') }; }
  for (const rec of lijst(o.rosters)) {
    const r = (rec && rec.Roster) || rec || {}; if (r.id == null) continue;
    if (r.deleted === true || r.deleted === '1' || r.deleted === 1) continue;
    const d = (rec && rec.Department) || r.Department; if (d && d.id != null) deptNaam[String(d.id)] = String(d.name || '');
    const s = tijdMin(r.starttime); let e = tijdMin(r.endtime); if (e != null && s != null && e <= s) e += 1440;
    const w = { rEind: e, rTotaal: num(r.total), dept: String(r.department_id || '') };
    rooster[String(r.id) + '|' + String(r.date || '').slice(0, 10)] = w;
    if (!rooster[String(r.id)]) rooster[String(r.id)] = w;
  }
  const uit = [];
  for (const rec of lijst(o.timesheets)) {
    const t = (rec && rec.Timesheet) || rec || {};
    if (t.deleted === true || t.deleted === '1' || t.deleted === 1) continue;
    if (t.active_clock === true || t.active_clock === '1') continue; // nog ingeklokt
    const datum = String(t.date || '').slice(0, 10); if (!datum) continue;
    const ro = t.roster_id ? (rooster[String(t.roster_id) + '|' + datum] || rooster[String(t.roster_id)]) : null;
    const rEind = ro ? ro.rEind : null;
    let eind = null, zonder = false;
    if (t.clocked_out && isoDatum(t.clocked_out)) eind = dagVerschil(datum, isoDatum(t.clocked_out)) * 1440 + tijdMin(String(t.clocked_out).slice(10));
    if (eind == null) { eind = tijdMin(t.endtime); zonder = true; }
    const ti = teamInfo[String(t.team_id || '')] || {};
    const dept = String(t.department_id || ti.dept || (ro && ro.dept) || '');
    const u = (rec && rec.User) || {};
    uit.push({
      uid: String(t.user_id || ''), naam: naamVan[String(t.user_id)] || ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || ('Medewerker #' + t.user_id),
      datum, deptId: dept, team: deptNaam[dept] || ti.naam || '', status: statusVan(t.status),
      rEind, eind: naRooster(eind, rEind), zonderUitklok: zonder,
      gewerkt: num(t.total), rTotaal: ro ? ro.rTotaal : null, uurloon: num(t.wage), contracttype: '',
      gekeurdDoor: t.reviewed_by ? (naamVan[String(t.reviewed_by)] || ('#' + t.reviewed_by)) : ''
    });
  }
  return uit;
}

// ---------- Rekenen ----------
// diensten: uit vanExport/vanApi. o: { van, tot, winkels: { deptId: { code, naam } } }
//   -> { periode, overzicht: [per winkel], winkels: { code: detail } }
function analyseer(diensten, o) {
  o = o || {};
  const I = Object.assign({}, INSTELLINGEN, o.instellingen || {});
  const data = diensten.filter(d => d.datum && (!o.van || d.datum >= o.van) && (!o.tot || d.datum <= o.tot));
  const van = o.van || data.reduce((m, d) => (!m || d.datum < m ? d.datum : m), ''), tot = o.tot || data.reduce((m, d) => (d.datum > m ? d.datum : m), '');
  const perWinkel = {};
  for (const d of data) {
    if (d.status === 'afgekeurd') continue;
    const w = (o.winkels || {})[d.deptId]; if (!w) continue; // keuken, HQ, franchise: niet in deze analyse
    (perWinkel[w.code] || (perWinkel[w.code] = { code: w.code, naam: winkelLabel(d.team) || w.naam, diensten: [] })).diensten.push(d);
  }
  const winkels = {};
  for (const code of Object.keys(perWinkel)) winkels[code] = winkelDetail(perWinkel[code], I);
  const overzicht = Object.values(winkels).map(w => ({ code: w.code, naam: w.naam, sluitdiensten: w.team.sluitdiensten, avonden: w.team.avonden, gemMin: w.team.gemMin, pctAvonden30: w.team.pctAvonden30, maxMin: w.team.maxMin, extraUren: w.kosten.extraUren, kostenInclLasten: w.kosten.inclLasten, voorgedragen: w.medewerkers.filter(m => m.voorgedragen).length }))
    .sort((a, b) => b.pctAvonden30 - a.pctAvonden30 || b.sluitdiensten - a.sluitdiensten);
  return { periode: { van, tot, tekst: periodeTekst(van, tot), tekstEn: periodeTekst(van, tot, 'EN') }, instellingen: I, overzicht, winkels };
}

function winkelDetail(w, I) {
  const sluit = [];
  for (const d of w.diensten) {
    if (d.rEind == null || d.rEind < I.sluitVanaf || d.eind == null) continue;
    sluit.push(Object.assign({}, d, { laat: d.eind - d.rEind }));
  }
  sluit.sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam));
  // Per medewerker
  const perMw = {};
  for (const d of sluit) (perMw[d.uid || d.naam] || (perMw[d.uid || d.naam] = [])).push(d);
  const medewerkers = Object.keys(perMw).map(k => {
    const l = perMw[k];
    const laat = l.filter(d => d.laat > I.drempel).length;
    const metUitklok = l.filter(d => !d.zonderUitklok);
    const ergste = (metUitklok.length ? metUitklok : l).reduce((a, b) => (b.laat > a.laat ? b : a));
    const extra = l.reduce((s, d) => s + Math.max(0, (d.gewerkt || 0) - (d.rTotaal || 0)), 0);
    const kosten = l.reduce((s, d) => s + Math.max(0, (d.gewerkt || 0) - (d.rTotaal || 0)) * (d.uurloon || 0), 0);
    const pct = l.length ? Math.round(laat / l.length * 100) : 0;
    return {
      uid: l[0].uid, naam: l[0].naam, contracttype: l.map(d => d.contracttype).filter(Boolean).pop() || '',
      aantalTotaal: l.length, aantalLaat: laat, pctLaat: pct,
      aantalNa22: l.filter(d => d.eind >= I.grens).length,
      gemMin: Math.round(l.reduce((s, d) => s + d.laat, 0) / l.length),
      zonderUitklok: l.filter(d => d.zonderUitklok).length,
      ergste: { datum: ergste.datum, roosterEind: hhmm(ergste.rEind), uitklok: hhmm(ergste.eind), laat: Math.round(ergste.laat), zonderUitklok: !!ergste.zonderUitklok },
      extraUren: r1(extra), kosten: r2(kosten),
      voorgedragen: laat >= I.minLaat && pct >= I.minPct,
      diensten: l.map(d => ({ datum: d.datum, roosterEind: hhmm(d.rEind), eind: hhmm(d.eind), laat: Math.round(d.laat), zonderUitklok: !!d.zonderUitklok, status: d.status, gekeurdDoor: d.gekeurdDoor }))
    };
  }).sort((a, b) => (b.voorgedragen - a.voorgedragen) || b.aantalLaat - a.aantalLaat || b.gemMin - a.gemMin || a.naam.localeCompare(b.naam));
  // Per avond: laatste geroosterde eindtijd tegenover de laatste uitklok
  const avond = {};
  for (const d of sluit) { const a = avond[d.datum] || (avond[d.datum] = { rEind: -1e9, eind: -1e9 }); a.rEind = Math.max(a.rEind, d.rEind); a.eind = Math.max(a.eind, d.eind); }
  const avonden = Object.keys(avond).sort().map(dt => ({ datum: dt, uitloop: avond[dt].eind - avond[dt].rEind }));
  const perWd = {};
  avonden.forEach(a => { const wd = weekdag(a.datum); (perWd[wd] || (perWd[wd] = [])).push(a.uitloop); });
  const weekdagen = [1, 2, 3, 4, 5, 6, 0].filter(wd => perWd[wd]).map(wd => ({ dag: WEEKDAG[wd], dagEn: WEEKDAG_EN[wd], avonden: perWd[wd].length, gemMin: Math.round(perWd[wd].reduce((s, x) => s + x, 0) / perWd[wd].length) }));
  const beste = weekdagen.filter(x => x.avonden >= 2 && x.gemMin <= I.drempel).sort((a, b) => a.gemMin - b.gemMin);
  // Goedkeuring
  const gk = {};
  sluit.forEach(d => { if (d.status !== 'goedgekeurd') return; const n = d.gekeurdDoor || 'onbekend'; const x = gk[n] || (gk[n] = { naam: n, aantal: 0, laat: 0 }); x.aantal++; if (d.laat > I.drempel) x.laat++; });
  const extraVan = d => Math.max(0, (d.gewerkt || 0) - (d.rTotaal || 0));
  const extra = sluit.reduce((s, d) => s + extraVan(d), 0), kosten = sluit.reduce((s, d) => s + extraVan(d) * (d.uurloon || 0), 0);
  return {
    code: w.code, naam: w.naam,
    team: {
      sluitdiensten: sluit.length, avonden: avonden.length,
      gemMin: sluit.length ? Math.round(sluit.reduce((s, d) => s + d.laat, 0) / sluit.length) : 0,
      pctAvonden30: avonden.length ? Math.round(avonden.filter(a => a.uitloop > I.drempel).length / avonden.length * 100) : 0,
      maxMin: avonden.length ? Math.round(Math.max.apply(null, avonden.map(a => a.uitloop))) : 0,
      besteDagen: opsomming(beste.map(x => x.dag)), besteDagenEn: opsomming(beste.map(x => x.dagEn), 'EN'), weekdagen,
      zonderUitklok: sluit.filter(d => d.zonderUitklok).length,
      onbeslist: sluit.filter(d => d.status === 'onbeslist').length
    },
    kosten: { extraUren: r1(extra), loon: Math.round(kosten), inclLasten: Math.round(kosten * (1 + I.lasten)) },
    goedkeuring: Object.values(gk).sort((a, b) => b.aantal - a.aantal),
    medewerkers
  };
}

// ---------- Sjablonen ----------
// {variabele} wordt ingevuld; [[naam]]…[[/naam]] is een optioneel blok (aan/uit), [[!naam]]…[[/!naam]] staat er alleen als het blok UIT staat.
// Opmaak: **vet**, "- " opsomming, "1. " genummerd, lege regel = nieuwe alinea.
const TEAMBRIEF = {
  onderwerp: 'Afspraken over je eindtijd en afsluiten bij SLA {winkel}',
  tekst: `Beste {voornaam},

In de afgelopen weken zijn we in {winkel} vaak ruim na de geroosterde eindtijd klaar. Uit de klokdata over {periode} blijkt dat het team gemiddeld {team_gem_min} minuten later uitklokte dan gepland, op {team_pct_dagen_30}% van de dagen meer dan een half uur, en soms tot {team_max_min} minuten.[[beste]] Op {beste_dagen} lukt het wel om op tijd klaar te zijn. Het kan dus.[[/beste]]

Daarom zetten we de afspraken nog één keer duidelijk op een rij:

1. **Je geroosterde eindtijd is je eindtijd.** Het afsluiten (schoonmaak, sluitlijst, kassa) past binnen je dienst. Begin op tijd met het sluitwerk.
2. **Lukt het niet? Overleg vooraf.** Zie je aankomen dat je later klaar bent, door drukte, een storing of een levering? Meld dat dan vóór je geroosterde eindtijd bij je storemanager of de dienstdoende leidinggevende.
3. **Langer werken alleen met toestemming.** Uren na je eindtijd zonder toestemming worden niet automatisch goedgekeurd. We bespreken ze met je, en je leidinggevende beoordeelt of ze terecht waren.
4. **Na 22:00 uur werken we niet zonder toestemming.**
5. **Klok uit zodra je klaar bent.**

Vanaf {ingangsdatum} tellen uren na je geroosterde eindtijd zonder toestemming niet mee voor de fooiverdeling. Dit geldt voor iedereen, zodat de fooi eerlijk wordt verdeeld over de geroosterde uren. Het is geen oordeel over waarom iemand later klaar is.

**Wat gebeurt er als deze afspraken niet worden nagekomen?**

- De eerste keer bespreekt je storemanager het met je.
- Gebeurt het daarna opnieuw zonder toestemming, dan krijg je een schriftelijke waarschuwing in je personeelsdossier.
- Blijft het gebeuren, dan kunnen verdere arbeidsrechtelijke maatregelen volgen.

We vragen dit niet om lastig te doen. Te lang doorwerken is slecht voor je rust en je reistijd naar huis. Het is ook niet eerlijk tegenover collega's die wel op tijd afronden. En het maakt de planning en de loonkosten onvoorspelbaar.

Past het sluitwerk volgens jou niet binnen de tijd? Laat het ons weten. Dan kijken we samen naar de taakverdeling, de volgorde van het sluiten of het rooster.

Met vriendelijke groet,
{afzender_naam}
{afzender_functie}, SLA`
};

const WAARSCHUWING = {
  onderwerp: 'Waarschuwing: herhaald te laat afsluiten zonder toestemming',
  tekst: `Beste {voornaam},

[[eerder]]Op {datum_eerder_bericht} hebben we het team van SLA {winkel} laten weten dat je niet zonder toestemming na je geroosterde eindtijd hoort door te werken, en dat werken na 22:00 uur alleen mag met vooraf gegeven toestemming. Ondanks dat bericht zien we in de klokdata dat jij regelmatig ruim na je geroosterde eindtijd uitklokt, zonder dat je daar toestemming voor hebt gevraagd.[[/eerder]][[!eerder]]In de klokdata zien we dat jij regelmatig ruim na je geroosterde eindtijd uitklokt, zonder dat je daar toestemming voor hebt gevraagd.[[/!eerder]]

**Jouw gegevens van {periode}:**

- Sluitdiensten later dan 30 minuten na je eindtijd: **{aantal_laat} van {aantal_totaal}**
- Gemiddeld later dan je rooster: **{gem_min} minuten**
- Diensten met uitklokken na 22:00 uur: **{aantal_na_22}**
- Grootste overschrijding: **{ergste_datum}**: geroosterd tot {rooster_eind}, uitgeklokt om {uitklok}

Dit is niet acceptabel. Je kunt niet zomaar een of twee uur na je geroosterde tijd klaar zijn zonder overleg. Dat heeft gevolgen voor de planning en de loonkosten. Het is ook niet eerlijk tegenover je collega's die hun sluitwerk wel binnen de geroosterde tijd afronden.

**Wat we vanaf nu van je verwachten:**

1. Je bent klaar op je geroosterde eindtijd. Het sluitwerk past binnen je dienst.
2. Zie je aankomen dat het niet lukt? Dan meld je dat vóór je eindtijd bij je storemanager of de dienstdoende leidinggevende. Alleen met diens toestemming blijf je langer.
3. Na 22:00 uur werk je niet zonder vooraf gegeven toestemming.
4. Je klokt uit zodra je klaar bent.

**Wat er verandert vanaf {ingangsdatum}:**

- Uren na je geroosterde eindtijd zonder toestemming worden niet automatisch goedgekeurd. Je leidinggevende bespreekt ze met je en beoordeelt ze.
- Deze uren tellen niet mee voor de fooiverdeling. Dit geldt voor iedereen, zodat de fooi eerlijk wordt verdeeld over de geroosterde uren. Het is geen oordeel over waarom iemand later klaar is.

**Gevolgen:** deze brief is een schriftelijke waarschuwing en wordt opgenomen in je personeelsdossier. Blijf je na deze waarschuwing zonder toestemming na je eindtijd doorwerken, dan volgen verdere arbeidsrechtelijke maatregelen.[[contract]] Bij herhaling kan dat ook gevolgen hebben voor de verlenging van je contract.[[/contract]]

We willen dit graag samen oplossen. Past het sluitwerk volgens jou echt niet binnen de tijd? Bespreek dat dan deze week met je storemanager.

Wil je deze brief voor gezien tekenen via de link in de e-mail? Daarmee bevestig je alleen dat je hem hebt ontvangen, niet dat je het met de inhoud eens bent.

Met vriendelijke groet,
{afzender_naam}
{afzender_functie}, SLA`
};

const TEAMBRIEF_EN = {
  onderwerp: 'Agreements about your finishing time and closing at SLA {winkel}',
  tekst: `Dear {voornaam},

Over the past few weeks, we have often finished well after the scheduled end time at SLA {winkel}. The clock data for {periode} shows that the team clocked out on average {team_gem_min} minutes later than planned, more than half an hour late on {team_pct_dagen_30}% of the days, and sometimes up to {team_max_min} minutes later.[[beste]] On {beste_dagen} we do manage to finish on time. So it can be done.[[/beste]]

That is why we are setting out the agreements clearly one more time:

1. **Your scheduled end time is your end time.** Closing (cleaning, closing checklist, till) fits within your shift. Start the closing tasks in time.
2. **Can't make it? Discuss it in advance.** Can you see that you will finish later, because it is busy, something breaks down or a delivery comes in? Report this before your scheduled end time to your store manager or the manager on duty.
3. **Working longer only with permission.** Hours after your end time without permission are not approved automatically. We will discuss them with you, and your manager will decide whether they were justified.
4. **We do not work after 22:00 without permission.**
5. **Clock out as soon as you are done.**

From {ingangsdatum}, hours worked after your scheduled end time without permission will not count towards the tip distribution. This applies to everyone, so that tips are shared fairly based on scheduled hours. It is not a judgement on why someone finishes later.

**What happens if these agreements are not followed?**

- The first time, your store manager will discuss it with you.
- If it happens again without permission, you will receive a written warning in your personnel file.
- If it keeps happening, further employment measures may follow.

We are not asking this to be difficult. Working too long is bad for your rest and your journey home. It is also unfair to colleagues who do finish on time. And it makes the schedule and labour costs unpredictable.

Do you think the closing work does not fit within the time? Let us know. Then we will look together at the division of tasks, the order of closing or the schedule.

Kind regards,
{afzender_naam}
{afzender_functie}, SLA`
};

const WAARSCHUWING_EN = {
  onderwerp: 'Warning: repeatedly finishing late without permission',
  tekst: `Dear {voornaam},

[[eerder]]On {datum_eerder_bericht} we informed the team of SLA {winkel} that you should not keep working after your scheduled end time without permission, and that working after 22:00 is only allowed with permission given in advance. Despite that message, the clock data shows that you regularly clock out well after your scheduled end time, without having asked for permission.[[/eerder]][[!eerder]]The clock data shows that you regularly clock out well after your scheduled end time, without having asked for permission.[[/!eerder]]

**Your figures for {periode}:**

- Closing shifts more than 30 minutes past your end time: **{aantal_laat} of {aantal_totaal}**
- On average later than scheduled: **{gem_min} minutes**
- Shifts clocked out after 22:00: **{aantal_na_22}**
- Largest overrun: **{ergste_datum}**: scheduled until {rooster_eind}, clocked out at {uitklok}

This is not acceptable. You cannot simply finish one or two hours after your scheduled time without discussing it first. This affects the schedule and labour costs. It is also unfair to your colleagues who do finish their closing tasks within the scheduled time.

**What we expect from you from now on:**

1. You finish at your scheduled end time. The closing work fits within your shift.
2. Can you see that you won't make it? Then report it before your end time to your store manager or the manager on duty. You only stay longer with their permission.
3. You do not work after 22:00 without permission given in advance.
4. You clock out as soon as you are done.

**What changes from {ingangsdatum}:**

- Hours after your scheduled end time without permission are not approved automatically. Your manager will discuss and assess them with you.
- These hours do not count towards the tip distribution. This applies to everyone, so that tips are shared fairly based on scheduled hours. It is not a judgement on why someone finishes later.

**Consequences:** this letter is a written warning and will be added to your personnel file. If you continue to work past your end time without permission after this warning, further employment measures will follow.[[contract]] If it happens again, this may also affect the renewal of your contract.[[/contract]]

We would like to solve this together. Do you really think the closing work does not fit within the time? Then discuss it with your store manager this week.

Please sign this letter as seen via the link in the email. This only confirms that you have received it, not that you agree with its content.

Kind regards,
{afzender_naam}
{afzender_functie}, SLA`
};
const SJABLONEN = { team: { NL: null, EN: TEAMBRIEF_EN }, waarschuwing: { NL: null, EN: WAARSCHUWING_EN } };

function vul(tekst, vars, opties) {
  opties = opties || {};
  let t = String(tekst || '');
  t = t.replace(/\[\[(!?)(\w+)\]\]([\s\S]*?)\[\[\/\1\2\]\]/g, (m, neg, naam, binnen) => ((neg ? !opties[naam] : !!opties[naam]) ? binnen : ''));
  t = t.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Welke {variabelen} staan er nog in (niet ingevuld)?
function openVariabelen(tekst, behalve) { const s = new Set(); String(tekst || '').replace(/\{(\w+)\}/g, (m, k) => { if (!(behalve || []).includes(k)) s.add(k); }); return Array.from(s); }

SJABLONEN.team.NL = TEAMBRIEF; SJABLONEN.waarschuwing.NL = WAARSCHUWING;
function teamVars(w, periode, taal) {
  const en = isEn(taal);
  return { winkel: w.naam, periode: en ? periode.tekstEn : periode.tekst, team_gem_min: w.team.gemMin, team_pct_dagen_30: w.team.pctAvonden30, team_max_min: w.team.maxMin, beste_dagen: en ? w.team.besteDagenEn : w.team.besteDagen };
}
function medewerkerVars(m, w, periode, taal) {
  const en = isEn(taal);
  return { winkel: w.naam, periode: en ? periode.tekstEn : periode.tekst, aantal_laat: m.aantalLaat, aantal_totaal: m.aantalTotaal, gem_min: m.gemMin, aantal_na_22: m.aantalNa22, ergste_datum: langeDatum(m.ergste.datum, true, taal), rooster_eind: m.ergste.roosterEind, uitklok: m.ergste.uitklok };
}

// ---------- Opmaak: tekst -> HTML (mail) en -> pdf-tekst (maakOpgemaakteBrief) ----------
const F = "font-family:'Helvetica Neue',Arial,sans-serif;";
function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const vet = s => escH(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
function naarHtml(tekst) {
  const p = F + 'font-size:14px;color:#333d3a;line-height:1.7;margin:0 0 14px';
  return String(tekst || '').replace(/\r/g, '').split(/\n{2,}/).map(b => {
    const regels = b.split('\n').filter(r => r.trim());
    if (!regels.length) return '';
    if (regels.every(r => /^\s*-\s+/.test(r))) return '<ul style="margin:0 0 14px;padding-left:20px">' + regels.map(r => '<li style="' + p + ';margin:0 0 6px">' + vet(r.replace(/^\s*-\s+/, '')) + '</li>').join('') + '</ul>';
    if (regels.every(r => /^\s*\d+\.\s+/.test(r))) return '<ol style="margin:0 0 14px;padding-left:22px">' + regels.map(r => '<li style="' + p + ';margin:0 0 6px">' + vet(r.replace(/^\s*\d+\.\s+/, '')) + '</li>').join('') + '</ol>';
    return '<p style="' + p + '">' + regels.map(vet).join('<br>') + '</p>';
  }).join('');
}
function naarPdfTekst(tekst) { return String(tekst || '').replace(/^(\s*)-\s+/gm, '$1• '); }

module.exports = { INSTELLINGEN, CATEGORIE_TEAMBRIEF, TEAMBRIEF, WAARSCHUWING, TEAMBRIEF_EN, WAARSCHUWING_EN, SJABLONEN, vanExport, vanApi, analyseer, vul, openVariabelen, teamVars, medewerkerVars, naarHtml, naarPdfTekst, tijdMin, isoDatum, hhmm, nlDatum, langeDatum, periodeTekst, opsomming };
