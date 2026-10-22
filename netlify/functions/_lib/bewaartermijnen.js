// ============================================================
// v0.27.0 — AVG-bewaartermijnen (vervangt de oude bhrScan op 4 sheet-tabs).
//
// Wat is er anders dan voorheen:
//  1. ALLE plekken met persoonsgegevens doen mee: dossiertabellen, uploads (incl. kopie-ID),
//     ondertekende PDF's, mails, gesprekken, checklists, verlengingen, check-ins, exit-surveys,
//     oude Google-Forms-reacties en de logboeken.
//  2. Het ankerpunt is de UIT-DIENSTDATUM uit Shiftbase (niet de verzenddatum van een brief).
//     Wie nog in dienst is, komt nooit op de lijst.
//       - dossier:  2 jaar na uit dienst                      (BHR_JAREN_DOSSIER)
//       - fiscaal:  5 jaar na het einde van het kalenderjaar  (BHR_JAREN_LOON; loonheffing, korting,
//                   kopie-ID — art. 52 AWR / Wet op de loonbelasting)
//     Niet in Shiftbase te vinden? Dan telt de laatste HR-activiteit als anker en wordt de persoon
//     apart gemarkeerd ("controleer of iemand nog in dienst is") en niet vooraf aangevinkt.
//  3. Verwijderen kan, maar alleen na een klik van een beheerder (Beheer → Bewaartermijnen).
//     De server rekent bij het verwijderen alles opnieuw uit en verwijdert alleen wat echt over
//     de termijn is. Bestanden in Supabase Storage gaan mee. Check-ins en exit-surveys worden
//     geanonimiseerd (cijfers blijven voor de analyses, naam/e-mail/vrije tekst gaan weg).
//  4. Het logboek van een verwijdering bevat GEEN naam (dat zou het doel ondermijnen), alleen
//     het Shiftbase-id of een korte referentie en de aantallen.
//
// Pure functies (bovenaan) zijn zonder database te testen; IO zit in laad/verwijder.
// ============================================================
const C = require('./config');
const { normNaam } = require('./util');

const JAREN_DOSSIER = C.BHR_JAREN_DOSSIER || 2;
const JAREN_FISCAAL = C.BHR_JAREN_LOON || 5;
const JAREN_LOG = C.BHR_JAREN_LOG || 2;
const MAANDEN_SIGNALERING = C.BHR_MAANDEN_SIGNALERING || 12;
const BUCKET = 'hr-documenten';

const TERMIJN_LABEL = {
  dossier: JAREN_DOSSIER + ' jaar na uit dienst',
  fiscaal: JAREN_FISCAAL + ' jaar na het jaar van uit dienst (fiscaal)'
};

// ---- Datums -------------------------------------------------------------------
// Vindt de eerste datum in een tekst: dd-mm-jjjj (ook in 'Verzonden op 12-03-2025 10:15') of jjjj-mm-dd (ISO/timestamp).
function datumUit(s) {
  if (s == null || s === '') return null;
  if (s instanceof Date) return isNaN(s) ? null : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const t = String(s);
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m && +m[1] > 1990) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m && +m[3] > 1990) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const iso = d => d ? d.toLocaleDateString('sv-SE') : '';
const nl = d => d ? iso(d).split('-').reverse().join('-') : '';
const maxDatum = lijst => lijst.reduce((a, d) => (d && (!a || d > a) ? d : a), null);
const plusJaren = (d, j) => new Date(d.getFullYear() + j, d.getMonth(), d.getDate());
// Vervaldatum per termijnsoort, gegeven het anker (uit dienst)
function vervalt(anker, termijn) {
  if (!anker) return null;
  if (termijn === 'fiscaal') return new Date(anker.getFullYear() + JAREN_FISCAAL + 1, 0, 1); // 1 jan na 31-12 van (jaar + 5)
  return plusJaren(anker, JAREN_DOSSIER);
}

// ---- Categorieën: waar staan persoonsgegevens? -----------------------------------
// tabel, sleutel (primaire sleutel), kolommen (select), persoon(r) -> {mid, email, naam},
// datums(r) -> [..] (alles wat iets over de leeftijd van de rij zegt; laatste = vangnet),
// termijn: 'dossier' | 'fiscaal' | (r) => ..., actie: 'verwijder' | 'anonimiseer',
// bestanden(r) -> [storage-paden], drive(r) -> [Drive-links die HR zelf moet verwijderen]
const P = (naam, email, mid) => ({ naam: String(naam || '').trim(), email: String(email || '').trim().toLowerCase(), mid: mid ? String(mid) : '' });
const STD = 'rij,naam,email,medewerker_id,created_at';
// Mails aan HR zelf of aan de salarisadministratie horen niet bij de medewerker als 'e-mailadres'
const extern = a => { const e = String(a || '').trim().toLowerCase(); return !e || /@ilovesla\.com$/.test(e) || e === String(C.SALARIS_EMAIL || '').toLowerCase() ? '' : e; };
const GEEN_PERSOON = new Set(['hr team', 'sla hr team', 'hr', 'team']);
const CATEGORIEEN = [
  { tabel: 'hr_loonheffing', label: 'Loonheffingsverklaring (dossier)', sleutel: 'rij', kolommen: STD + ',verzenddatum,deadline,status', termijn: 'fiscaal', datums: r => [r.verzenddatum, r.status, r.deadline, r.created_at] },
  { tabel: 'hr_korting', label: 'Loonheffingskorting', sleutel: 'rij', kolommen: STD + ',verzenddatum,ingangsdatum,status', termijn: 'fiscaal', datums: r => [r.verzenddatum, r.status, r.ingangsdatum, r.created_at] },
  { tabel: 'hr_ontslag', label: 'Ontslag & aanzegging', sleutel: 'rij', kolommen: STD + ',einddatum,verzenddatum,opzegging', termijn: 'dossier', datums: r => [r.einddatum, r.verzenddatum, r.opzegging, r.created_at] },
  { tabel: 'hr_sommatie', label: 'Sommaties', sleutel: 'rij', kolommen: STD + ',verzenddatum,status,datum_afwezig', termijn: 'dossier', datums: r => [r.verzenddatum, r.status, r.datum_afwezig, r.created_at] },
  { tabel: 'hr_waarschuwingen', label: 'Waarschuwingen', sleutel: 'rij', kolommen: STD + ',verzenddatum,datum_overtreding', termijn: 'dossier', datums: r => [r.verzenddatum, r.datum_overtreding, r.created_at] },
  { tabel: 'hr_brieven', label: 'Vrije brieven', sleutel: 'rij', kolommen: STD + ',verzenddatum,status', termijn: 'dossier', datums: r => [r.verzenddatum, r.status, r.created_at] },
  { tabel: 'hr_overplaatsing', label: 'Overplaatsing', sleutel: 'rij', kolommen: STD + ',verzenddatum,ingangsdatum', termijn: 'dossier', datums: r => [r.verzenddatum, r.ingangsdatum, r.created_at] },
  { tabel: 'hr_beschikbaarheid', label: 'Beschikbaarheid', sleutel: 'rij', kolommen: STD + ',verzenddatum,ingangsdatum', termijn: 'dossier', datums: r => [r.verzenddatum, r.ingangsdatum, r.created_at] },
  { tabel: 'hr_oproepaanbod', label: 'Oproepaanbod', sleutel: 'rij', kolommen: STD + ',verzenddatum,reactie_datum', termijn: 'dossier', datums: r => [r.reactie_datum, r.verzenddatum, r.created_at] },
  { tabel: 'hr_notities', label: 'Dossiernotities', sleutel: 'rij', kolommen: STD + ',datum', termijn: 'dossier', datums: r => [r.datum, r.created_at] },
  { tabel: 'hr_onboarding', label: 'Onboarding (oud)', sleutel: 'rij', kolommen: 'rij,voornaam,achternaam,email,medewerker_id,created_at,verzenddatum', termijn: 'dossier', persoon: r => P([r.voornaam, r.achternaam].filter(Boolean).join(' '), r.email, r.medewerker_id), datums: r => [r.verzenddatum, r.created_at] },
  { tabel: 'hr_checklists', label: 'On-/offboarding-checklists', sleutel: 'id', kolommen: 'id,naam,email,medewerker_id,gestart_op,afgerond_op', termijn: 'dossier', datums: r => [r.afgerond_op, r.gestart_op] },
  { tabel: 'hr_gesprekken', label: 'Gesprekken', sleutel: 'id', kolommen: 'id,naam,email,medewerker_id,datum,aangemaakt_op', termijn: 'dossier', datums: r => [r.datum, r.aangemaakt_op] },
  { tabel: 'hr_verlenging', label: 'Contractverlenging (besluiten)', sleutel: 'id', kolommen: 'id,naam,email,medewerker_id,contract_eind,besloten_op', termijn: 'dossier', datums: r => [r.besloten_op, r.contract_eind] },
  { tabel: 'hr_mails', label: 'Verstuurde mails (log)', sleutel: 'id', kolommen: 'id,naam,naar,tijdstip', termijn: 'dossier', persoon: r => P(r.naam, extern(r.naar), ''), datums: r => [r.tijdstip] },
  { tabel: 'hr_ondertekening', label: 'Te ondertekenen / ondertekende brieven (PDF)', sleutel: 'id', kolommen: 'id,naam,email,aangemaakt_op,getekend_op,origineel_pad,getekend_pad', termijn: 'dossier', persoon: r => P(r.naam, r.email, ''), datums: r => [r.getekend_op, r.aangemaakt_op], bestanden: r => [r.origineel_pad, r.getekend_pad].filter(Boolean) },
  { tabel: 'hr_uploads', label: 'Geüploade documenten (o.a. loonheffing, kopie-ID)', sleutel: 'id', kolommen: 'id,soort,naam,email,created_at,bestanden', termijn: r => (r.soort === 'loon' || r.soort === 'korting') ? 'fiscaal' : 'dossier', persoon: r => P(r.naam, r.email, ''), datums: r => [r.created_at], bestanden: r => (Array.isArray(r.bestanden) ? r.bestanden : []).map(b => b && b.pad).filter(Boolean) },
  { tabel: 'hr_formulier_reacties', label: 'Oude Google-Forms-uploads (Drive)', sleutel: 'id', kolommen: 'id,soort,naam,email,tijdstempel,created_at,loon_url,indienst_url,doc_url', termijn: r => r.soort === 'loon' ? 'fiscaal' : 'dossier', persoon: r => P(r.naam, r.email, ''), datums: r => [r.tijdstempel, r.created_at], drive: r => [r.loon_url, r.indienst_url, r.doc_url].filter(Boolean) },
  { tabel: 'hr_checkin', label: 'Check-in 30/60 (wordt geanonimiseerd)', sleutel: 'id', kolommen: 'id,naam,email,medewerker_id,verstuurd_op,ingevuld_op', termijn: 'dossier', actie: 'anonimiseer', datums: r => [r.ingevuld_op, r.verstuurd_op] },
  { tabel: 'hr_exit', label: 'Exit-survey (wordt geanonimiseerd)', sleutel: 'id', kolommen: 'id,naam,email,medewerker_id,ip,ingevuld_op', termijn: 'dossier', actie: 'anonimiseer', datums: r => [r.ingevuld_op] }
];

// Logboeken: geen persoonsdossier, maar wel namen/e-mails. Vaste (rollende) termijn vanaf het tijdstip.
const LOGBOEKEN = [
  { tabel: 'hr_acties', label: 'Actielog (wie deed wat)', kolom: 'tijdstip', maanden: JAREN_LOG * 12 },
  { tabel: 'hr_toegangslog', label: 'Toegangslog (logins, inzage)', kolom: 'tijdstip', maanden: JAREN_LOG * 12 },
  { tabel: 'hr_signaleringen', label: 'Runs van de automatische checks', kolom: 'tijdstip', maanden: MAANDEN_SIGNALERING },
  { tabel: 'hr_taken_afgehandeld', label: 'Afgehandelde taken', kolom: 'tot', maanden: 12 }
];

const persoonVan = (cat, r) => cat.persoon ? cat.persoon(r) : P(r.naam, r.email, r.medewerker_id);
const termijnVan = (cat, r) => typeof cat.termijn === 'function' ? cat.termijn(r) : cat.termijn;

// ---- Shiftbase-index ------------------------------------------------------------
function shiftbaseIndex(users, vandaag) {
  const vIso = iso(vandaag || new Date());
  const byId = {}, byEmail = {}, byNaam = {}, dubbel = new Set();
  for (const rec of users || []) {
    const u = (rec && rec.User) || rec || {};
    if (!u.id) continue;
    const eind = String(u.enddate || '').trim();
    const e = eind && eind !== '0000-00-00' ? eind.slice(0, 10) : '';
    const naam = [u.first_name, u.prefix, u.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const anon = u.anonymized === true || u.anonymized === 1 || u.anonymized === '1';
    const p = { id: String(u.id), naam, eind: e, actief: !e || e >= vIso, anon };
    byId[p.id] = p;
    const em = String(u.email || '').trim().toLowerCase();
    if (em && !anon) byEmail[em] = byEmail[em] && byEmail[em].actief ? byEmail[em] : p; // actieve account wint bij dubbele e-mail
    const n = normNaam(naam);
    if (n && !anon) { if (byNaam[n] && byNaam[n].id !== p.id) dubbel.add(n); else byNaam[n] = p; }
  }
  for (const n of dubbel) delete byNaam[n]; // dubbele namen: niet op naam koppelen
  return { byId, byEmail, byNaam };
}

// ---- Kern: wie is over de termijn? ---------------------------------------------------
// data: { tabel: [rijen] } ; sb: shiftbaseIndex ; vandaag: Date
// -> { personen: [...], nietGekoppeld: n, inDienst: n, binnenkort: n }
// Rijen verzamelen, aan Shiftbase koppelen en per persoon groeperen (gedeeld door bereken en verwijderen)
function groepeer(data, sb) {
  const rijen = [];
  for (const cat of CATEGORIEEN) {
    for (const r of (data[cat.tabel] || [])) {
      const p = persoonVan(cat, r);
      if (GEEN_PERSOON.has(normNaam(p.naam))) p.naam = '';
      if (!p.naam && !p.email && !p.mid) continue; // al anoniem of geen persoon
      rijen.push({ cat, r, p });
    }
  }
  const aliasNaam = {}; // naam -> e-mailsleutel (voor niet-gekoppelde rijen zonder e-mail)
  for (const x of rijen) {
    const s = (x.p.mid && sb.byId[x.p.mid]) || (x.p.email && sb.byEmail[x.p.email]) || (x.p.naam && sb.byNaam[normNaam(x.p.naam)]) || null;
    x.sb = s;
    if (!s && x.p.email && x.p.naam) aliasNaam[normNaam(x.p.naam)] = 'em:' + x.p.email;
  }
  const per = {};
  for (const x of rijen) {
    const n = normNaam(x.p.naam);
    const key = x.sb ? 'sb:' + x.sb.id : x.p.email ? 'em:' + x.p.email : (aliasNaam[n] || 'nm:' + n);
    const g = per[key] = per[key] || { key, sb: x.sb, namen: {}, rijen: [] };
    if (x.p.naam) g.namen[x.p.naam] = (g.namen[x.p.naam] || 0) + 1;
    g.rijen.push(x);
  }
  return per;
}
function ankerVan(g) {
  if (g.sb && g.sb.eind) return { anker: datumUit(g.sb.eind), ankerBron: 'shiftbase' };
  return { anker: maxDatum(g.rijen.map(x => maxDatum(x.cat.datums(x.r).map(datumUit)))), ankerBron: 'laatste-activiteit' };
}

// ---- Kern: wie is over de termijn? ---------------------------------------------------
// data: { tabel: [rijen] } ; sb: shiftbaseIndex ; vandaag: Date
function bereken(data, sb, vandaag) {
  vandaag = vandaag || new Date();
  const v0 = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
  const over90 = new Date(v0.getTime() + 90 * 864e5);
  const per = groepeer(data, sb);
  // 3) anker en vervaldatum per rij
  const personen = []; let inDienst = 0, binnenkort = 0;
  for (const g of Object.values(per)) {
    const naam = (g.sb && !g.sb.anon && g.sb.naam) || Object.entries(g.namen).sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || '(onbekend)';
    if (g.sb && g.sb.actief) { inDienst++; continue; }
    const { anker, ankerBron } = ankerVan(g);
    if (!anker) continue;
    const items = {}; let teVerwijderen = 0, bestanden = 0, drive = 0, eerst = null, aantalBinnenkort = 0;
    for (const x of g.rijen) {
      const t = termijnVan(x.cat, x.r);
      const vv = vervalt(anker, t);
      if (!vv) continue;
      if (vv > v0) { if (vv <= over90) aantalBinnenkort++; continue; }
      const it = items[x.cat.tabel] = items[x.cat.tabel] || { tabel: x.cat.tabel, label: x.cat.label, termijn: TERMIJN_LABEL[t], actie: x.cat.actie || 'verwijder', aantal: 0, vervaltOp: iso(vv) };
      it.aantal++; teVerwijderen++;
      bestanden += x.cat.bestanden ? x.cat.bestanden(x.r).length : 0;
      drive += x.cat.drive ? x.cat.drive(x.r).length : 0;
      if (!eerst || vv < eerst) eerst = vv;
    }
    if (aantalBinnenkort) binnenkort++;
    if (!teVerwijderen) continue;
    personen.push({
      key: g.key, naam, shiftbaseId: g.sb ? g.sb.id : '', gekoppeld: !!g.sb, anker: iso(anker), ankerNL: nl(anker), ankerBron,
      vervaltOp: iso(eerst), aantal: teVerwijderen, bestanden, drive, items: Object.values(items)
    });
  }
  personen.sort((a, b) => (a.gekoppeld === b.gekoppeld ? 0 : a.gekoppeld ? -1 : 1) || a.vervaltOp.localeCompare(b.vervaltOp));
  return { personen, inDienst, binnenkort, nietGekoppeld: personen.filter(p => !p.gekoppeld).length };
}

// Vrije tekst uit antwoorden halen: getallen en keuze-sleutels blijven (voor de analyses), de rest gaat weg.
function stripAntwoorden(a) {
  const uit = {};
  for (const [k, v] of Object.entries(a || {})) {
    if (/__toelichting$/.test(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') uit[k] = v;
    else if (typeof v === 'string' && /^[\w-]{1,40}$/.test(v)) uit[k] = v;
  }
  return uit;
}

// ======================================================================
// IO
// ======================================================================
const db = () => require('./auth').admin();

async function leesTabel(cat) {
  const uit = [];
  for (let van = 0; ; van += 1000) {
    const { data, error } = await db().from(cat.tabel).select(cat.kolommen).order(cat.sleutel, { ascending: true }).range(van, van + 999);
    if (error) {
      if (/does not exist|schema cache|Could not find/i.test(error.message)) return { rijen: [], ontbreekt: true }; // migratie (nog) niet gedraaid
      throw new Error(cat.tabel + ': ' + error.message);
    }
    uit.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { rijen: uit };
}
async function laadAlles() {
  const data = {}, ontbreekt = [];
  const res = await Promise.all(CATEGORIEEN.map(c => leesTabel(c).then(r => [c.tabel, r])));
  for (const [t, r] of res) { data[t] = r.rijen; if (r.ontbreekt) ontbreekt.push(t); }
  return { data, ontbreekt };
}
async function shiftbase(vandaag) {
  const SB = require('./shiftbase');
  return shiftbaseIndex(await SB.sbGet('users'), vandaag);
}
function grensIso(maanden, vandaag) { const d = new Date(vandaag || new Date()); d.setMonth(d.getMonth() - maanden); return d.toISOString(); }
async function logboekStand(vandaag) {
  const uit = [];
  for (const l of LOGBOEKEN) {
    const grens = grensIso(l.maanden, vandaag);
    const { count, error } = await db().from(l.tabel).select('*', { count: 'exact', head: true }).lt(l.kolom, grens);
    uit.push({ tabel: l.tabel, label: l.label, termijn: l.maanden % 12 ? l.maanden + ' maanden' : (l.maanden / 12) + ' jaar', ouderDan: grens.slice(0, 10), aantal: error ? null : (count || 0), fout: error ? error.message : '' });
  }
  return uit;
}

// Overzicht voor het dashboard en de maandcheck
async function overzicht(vandaag) {
  vandaag = vandaag || new Date();
  const [{ data, ontbreekt }, sb, logs] = await Promise.all([laadAlles(), shiftbase(vandaag), logboekStand(vandaag)]);
  const r = bereken(data, sb, vandaag);
  return Object.assign(r, { logboeken: logs, ontbreekt, termijnen: { dossier: TERMIJN_LABEL.dossier, fiscaal: TERMIJN_LABEL.fiscaal, logboek: JAREN_LOG + ' jaar (signaleringen ' + MAANDEN_SIGNALERING + ' mnd)' }, categorieen: CATEGORIEEN.map(c => ({ tabel: c.tabel, label: c.label })) });
}

// Verwijderen voor een selectie personen. Rekent zelf opnieuw uit (vertrouwt de browser niet).
async function verwijderPersonen(keys, door, vandaag) {
  vandaag = vandaag || new Date();
  const gekozen = new Set((keys || []).map(String));
  if (!gekozen.size) throw new Error('Geen personen gekozen.');
  if (gekozen.size > 50) throw new Error('Maximaal 50 personen per keer.');
  const [{ data }, sb] = await Promise.all([laadAlles(), shiftbase(vandaag)]);
  const res = bereken(data, sb, vandaag);
  const v0 = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
  // Rijen per persoon opnieuw opzoeken (bereken() geeft alleen aantallen terug)
  const doel = res.personen.filter(p => gekozen.has(p.key));
  const resultaat = { personen: 0, rijen: 0, geanonimiseerd: 0, bestanden: 0, driveLinks: [], fouten: [] };
  for (const p of doel) {
    try {
      const sel = selecteerRijen(data, sb, p, v0);
      // 1) bestanden uit Storage
      const paden = sel.flatMap(x => x.cat.bestanden ? x.cat.bestanden(x.r) : []);
      for (let i = 0; i < paden.length; i += 100) {
        const { error } = await db().storage.from(BUCKET).remove(paden.slice(i, i + 100));
        if (error) throw new Error('bestanden verwijderen: ' + error.message);
      }
      resultaat.bestanden += paden.length;
      sel.forEach(x => { if (x.cat.drive) x.cat.drive(x.r).forEach(u => resultaat.driveLinks.push(u)); });
      // 2) rijen verwijderen / anonimiseren, per tabel
      const perTabel = {};
      sel.forEach(x => { (perTabel[x.cat.tabel] = perTabel[x.cat.tabel] || { cat: x.cat, ids: [], rijen: [] }); perTabel[x.cat.tabel].ids.push(x.r[x.cat.sleutel]); perTabel[x.cat.tabel].rijen.push(x.r); });
      const telling = [];
      for (const { cat, ids } of Object.values(perTabel)) {
        if (cat.actie === 'anonimiseer') {
          for (const id of ids) {
            const { data: rij } = await db().from(cat.tabel).select('antwoorden').eq('id', id).maybeSingle();
            const upd = cat.tabel === 'hr_exit'
              ? { naam: '', email: '', medewerker_id: null, ip: null, opmerking: '', token_datum: '', anoniem: true, antwoorden: stripAntwoorden(rij && rij.antwoorden) }
              : { naam: '', email: '', medewerker_id: null, opmerking: '', opvolg_notitie: '', opgevolgd_door: '', verstuurd_door: '', antwoorden: stripAntwoorden(rij && rij.antwoorden) };
            const { error } = await db().from(cat.tabel).update(upd).eq('id', id);
            if (error) throw new Error(cat.tabel + ': ' + error.message);
          }
          resultaat.geanonimiseerd += ids.length;
        } else {
          for (let i = 0; i < ids.length; i += 200) {
            const { error } = await db().from(cat.tabel).delete().in(cat.sleutel, ids.slice(i, i + 200));
            if (error) throw new Error(cat.tabel + ': ' + error.message);
          }
          resultaat.rijen += ids.length;
        }
        telling.push(cat.tabel.replace(/^hr_/, '') + ' ' + ids.length);
      }
      resultaat.personen++;
      // 3) log zonder naam
      const ref = p.shiftbaseId ? 'Shiftbase-id ' + p.shiftbaseId : 'niet-gekoppeld #' + require('crypto').createHash('sha256').update(p.key).digest('hex').slice(0, 8);
      await db().from('hr_acties').insert({ door, actie: 'bewaartermijn', bron: 'avg', veld: null, rij: null, naam: '', details: ref + ' · uit dienst ' + p.ankerNL + ' (' + (p.ankerBron === 'shiftbase' ? 'Shiftbase' : 'laatste activiteit') + ') · ' + telling.join(', ') + (paden.length ? ' · ' + paden.length + ' bestand(en)' : '') });
    } catch (e) { resultaat.fouten.push((p.shiftbaseId ? 'Shiftbase-id ' + p.shiftbaseId : p.naam) + ': ' + e.message); }
  }
  return resultaat;
}
// Rijen van één persoon die over de termijn zijn (zelfde groepering en anker als bereken())
function selecteerRijen(data, sb, persoon, v0) {
  const g = groepeer(data, sb)[persoon.key];
  if (!g || (g.sb && g.sb.actief)) return [];
  const { anker } = ankerVan(g);
  if (!anker) return [];
  return g.rijen.filter(x => { const vv = vervalt(anker, termijnVan(x.cat, x.r)); return vv && vv <= v0; });
}

async function logboekenOpschonen(door, vandaag) {
  const uit = [];
  for (const l of LOGBOEKEN) {
    const grens = grensIso(l.maanden, vandaag);
    const { count, error } = await db().from(l.tabel).delete({ count: 'exact' }).lt(l.kolom, grens);
    uit.push({ tabel: l.tabel, verwijderd: error ? 0 : (count || 0), fout: error ? error.message : '' });
  }
  await db().from('hr_acties').insert({ door, actie: 'bewaartermijn', bron: 'avg-logboek', naam: '', details: uit.map(x => x.tabel + ' ' + x.verwijderd + (x.fout ? ' (fout)' : '')).join(', ') });
  return uit;
}

module.exports = { CATEGORIEEN, LOGBOEKEN, TERMIJN_LABEL, datumUit, vervalt, shiftbaseIndex, bereken, stripAntwoorden, overzicht, verwijderPersonen, logboekenOpschonen, selecteerRijen };
