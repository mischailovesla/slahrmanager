// ============================================================
// v0.48.0: Eindtijd & afsluiten (tab "Eindtijd & afsluiten")
// GET  /api/eindtijd                     -> sjablonen, instellingen, winkels, afzender (ingelogde gebruiker)
// POST /api/eindtijd { actie: 'analyse', bron: 'shiftbase'|'xlsx', xlsx?: base64, van?, tot?, ververs? }
//        -> per winkel: sluitdiensten, uitloop, kosten, medewerkers (met e-mail/contract/eerder bericht) en ontvangers teambrief
// POST /api/eindtijd { actie: 'team', winkel, onderwerp, tekst, ontvanger: {naam,email,voornaam}, preview? }
//        -> teambrief naar één medewerker (de browser loopt de ontvangers af), gelogd als vrije brief (categorie "Eindtijd & afsluiten")
// POST /api/eindtijd { actie: 'waarschuwing', winkel, mw: {naam,email,adres,voornaam}, onderwerp, tekst, periode, cijfers, afzender, preview?, alleenPdf? }
//        -> schriftelijke waarschuwing als PDF + mail, in het dossier (Waarschuwingen) en klaar om voor gezien te tekenen
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const S = require('./_lib/sheets');
const SB = require('./_lib/shiftbase');
const C = require('./_lib/config');
const D = require('./_lib/datum');
const E = require('./_lib/eindtijd');
const { normNaam } = require('./_lib/util');

const WINKELS = {}; // department_id -> { code, naam }
Object.keys(C.SB_DEPT_CODE).forEach(dep => { const code = C.SB_DEPT_CODE[dep]; WINKELS[dep] = { code, naam: C.WINKEL_BV_MAP[code].naam }; });
const REGEL_WAARSCHUWING = 'Herhaald te laat afsluiten zonder toestemming (eindtijd sluitdienst)';

const _cache = {};
async function laadShiftbase(van, tot, ververs) {
  const k = van + '|' + tot;
  if (!ververs && _cache[k] && _cache[k].t > Date.now()) return _cache[k].v;
  const q = 'min_date=' + van + '&max_date=' + tot;
  const deps = Object.keys(WINKELS);
  const [ts, users, teams, ...rosters] = await Promise.all([
    SB.sbGet('timesheets?' + q),
    SB.sbGet('users').catch(e => { console.warn('eindtijd users:', e.message); return []; }),
    SB.sbGet('teams').catch(e => { console.warn('eindtijd teams:', e.message); return []; })
  ].concat(deps.map(d => SB.sbGet('rosters?' + q + '&department_id=' + d).catch(e => { console.warn('eindtijd rooster ' + d + ':', e.message); return []; }))));
  const lijst = x => ((x && x.data) || x || []);
  const v = E.vanApi({ timesheets: ts, users, teams, rosters: [].concat(...rosters.map(lijst)) });
  _cache[k] = { t: Date.now() + 10 * 60000, v };
  return v;
}

// Dossiergegevens erbij: e-mail, contract, eerder ontvangen teambrief, eerdere eindtijd-waarschuwingen
async function verrijk(a) {
  const [med, brieven, wrs] = await Promise.all([
    SB.getMedewerkers(false).catch(() => []), S.getBrieven().catch(() => []), S.getWaarschuwingen().catch(() => [])
  ]);
  const opId = {}, opNaam = {};
  med.forEach(m => { opId[m.id] = m; opNaam[normNaam(m.naam)] = m; });
  const zelfde = (r, p) => (p.email && String(r.email || '').toLowerCase() === p.email.toLowerCase()) || normNaam(r.naam) === normNaam(p.naam);
  const eerder = p => {
    const l = brieven.filter(b => b.categorie === E.CATEGORIE_TEAMBRIEF && zelfde(b, p));
    if (!l.length) return null;
    const dmy = s => { const m = String(s || '').match(/(\d{2})-(\d{2})-(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
    const laatste = l.map(b => dmy(b.verzenddatum)).filter(Boolean).sort().pop();
    return laatste ? { iso: laatste, tekst: E.langeDatum(laatste) } : null;
  };
  const eerdereWrs = p => wrs.filter(r => zelfde(r, p) && /eindtijd/i.test(r.regels || '')).map(r => String(r.verzenddatum || '').slice(0, 10)).filter(Boolean);
  const persoon = (uid, naam) => {
    const m = opId[uid] || opNaam[normNaam(naam)];
    const p = m ? { naam: m.naam, voornaam: m.voornaam || String(m.naam).split(' ')[0], email: m.email, adres: m.adres, winkelCode: m.winkelCode, winkelNaam: m.winkelNaam, bv: m.winkelBv, functie: m.functie, contractType: m.contractType, contractEinde: m.contractEinde, vast: !m.contractEinde, inDienst: true }
      : { naam, voornaam: String(naam || '').split(' ')[0], email: '', adres: '', inDienst: false, vast: false };
    p.eerderBericht = eerder(p); p.eerdereWaarschuwingen = eerdereWrs(p);
    return p;
  };
  Object.values(a.winkels).forEach(w => {
    w.medewerkers.forEach(m => { m.persoon = persoon(m.uid, m.naam); });
    // Ontvangers teambrief: iedereen met deze vaste winkel + wie hier een sluitdienst draaide (flex/uitgeleend)
    const lijst = med.filter(m => m.winkelCode === w.code).map(m => persoon(m.id, m.naam));
    w.medewerkers.forEach(m => { if (m.persoon.inDienst && !lijst.some(x => x.email && x.email === m.persoon.email)) lijst.push(Object.assign({}, m.persoon, { andereWinkel: true })); });
    w.ontvangers = lijst.sort((x, y) => x.naam.localeCompare(y.naam, 'nl'));
  });
  return a;
}

function mailHtml(tekst, kop, kleur) {
  const T = require('./_lib/sjablonen');
  return T.slaWrap(T.slaHead(kleur || '#333d3a', kop) + '<tr><td style="padding:32px 36px 28px">' + E.naarHtml(tekst) + '</td></tr>' + T.slaFoot());
}
const platteTekst = t => String(t || '').replace(/\*\*([^*]+)\*\*/g, '$1');
function winkelVan(code) { const w = C.WINKEL_BV_MAP[code]; if (!w) throw new Error('Onbekende winkel.'); return w; }
function controleer(tekst, behalve) {
  const open = E.openVariabelen(tekst, behalve);
  if (open.length) throw new Error('Nog niet ingevuld in de tekst: ' + open.map(v => '{' + v + '}').join(', '));
}

exports.handler = beveiligd('eindtijd', async (event, g) => {
  if (event.httpMethod === 'GET') {
    const winkels = Object.values(WINKELS).sort((a, b) => a.naam.localeCompare(b.naam));
    return { sjablonen: { team: E.TEAMBRIEF, waarschuwing: E.WAARSCHUWING }, instellingen: E.INSTELLINGEN, winkels, afzender: { naam: g.naam || '' } };
  }
  const p = body(event);

  if (p.actie === 'analyse') {
    let diensten, bron;
    if (p.bron === 'xlsx') {
      if (!p.xlsx) throw new Error('Kies eerst het Excel-bestand (Shiftbase → Urenregistratie → Exporteren).');
      diensten = E.vanExport(require('./_lib/xlsx').lees(Buffer.from(String(p.xlsx), 'base64')));
      bron = 'Shiftbase-export' + (p.bestandsnaam ? ' (' + String(p.bestandsnaam).slice(0, 80) + ')' : '');
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.van || '') || !/^\d{4}-\d{2}-\d{2}$/.test(p.tot || '')) throw new Error('Kies een periode (van en tot).');
      if (p.tot < p.van) throw new Error('De einddatum ligt voor de begindatum.');
      if ((Date.parse(p.tot) - Date.parse(p.van)) / 864e5 > 92) throw new Error('Kies een periode van maximaal 3 maanden (anders duurt het ophalen uit Shiftbase te lang).');
      diensten = await laadShiftbase(p.van, p.tot, !!p.ververs);
      bron = 'Shiftbase (timesheets en rooster)';
    }
    const a = E.analyseer(diensten, { van: p.van || '', tot: p.tot || '', winkels: WINKELS });
    if (!a.overzicht.length) throw new Error('Geen diensten van SLA-winkels gevonden' + (p.van ? ' tussen ' + E.nlDatum(p.van) + ' en ' + E.nlDatum(p.tot) : '') + '.');
    await verrijk(a);
    a.bron = bron; a.opgehaald = D.stempel();
    return a;
  }

  if (p.actie === 'team') {
    const w = winkelVan(p.winkel);
    const o = p.ontvanger || {};
    const naam = String(o.naam || '').trim(), email = String(o.email || '').trim();
    const voornaam = String(o.voornaam || '').trim() || naam.split(' ')[0];
    const onderwerp = String(p.onderwerp || '').trim();
    if (!onderwerp) throw new Error('Vul het onderwerp in.');
    const tekst = E.vul(String(p.tekst || ''), { voornaam }, {});
    controleer(tekst); controleer(onderwerp);
    const html = mailHtml(tekst, 'SLA HR &middot; Afspraken eindtijd'), text = platteTekst(tekst);
    if (p.preview) return { subject: onderwerp, html, text };
    if (!naam) throw new Error('Ontvanger zonder naam.');
    if (!email || email.indexOf('@') === -1) throw new Error('Geen geldig e-mailadres voor ' + naam + '.');
    const resendId = await require('./_lib/mail').verstuur({ to: email, subject: onderwerp, text, html, tags: [{ name: 'bron', value: 'eindtijd' }, { name: 'type', value: 'teambrief' }] });
    let rij = 0;
    try { rij = await S.logBrief({ naam, email, bv: w.bv, categorie: E.CATEGORIE_TEAMBRIEF, onderwerp, tekst, metPdf: false }, D.stempel()); }
    catch (e) { console.warn('eindtijd logBrief:', e.message); }
    await require('./_lib/mail').logMail({ door: g.email, bron: 'eindtijd', type: 'teambrief', naar: email, naam, onderwerp, taal: 'NL', rij, resend_id: resendId });
    await logActie({ door: g.email, actie: 'mail', bron: 'eindtijd', veld: 'teambrief ' + w.naam, rij, naam, nieuw: email, details: onderwerp });
    return { bericht: 'Verstuurd naar ' + naam, rij };
  }

  if (p.actie === 'waarschuwing') {
    const w = winkelVan(p.winkel);
    const mw = p.mw || {};
    const naam = String(mw.naam || '').trim(), to = String(mw.email || '').trim(), adres = String(mw.adres || '').trim();
    const onderwerp = String(p.onderwerp || '').trim() || E.WAARSCHUWING.onderwerp;
    const tekst = String(p.tekst || '').trim();
    if (!naam) throw new Error('Geen medewerker gekozen.');
    if (!tekst) throw new Error('De brief is leeg.');
    controleer(tekst); controleer(onderwerp);
    const kop = '**' + w.bv + '**\n\n' + naam + (adres ? '\n' + adres : '') + '\n\nAmsterdam, ' + D.briefDatum(false) + '\n\n**Betreft: ' + onderwerp + '**\n\n';
    const voet = '\n\n\n**Voor gezien**\n' + naam + '\n\n................................................\nDatum:';
    const pdf = await require('./_lib/pdf').maakOpgemaakteBrief(kop + E.naarPdfTekst(tekst) + voet, { titel: 'Schriftelijke waarschuwing - ' + naam });
    const bestandsnaam = 'Waarschuwing_eindtijd_' + D.veiligeNaam(naam) + '.pdf';
    if (p.alleenPdf) return { pdf: pdf.toString('base64'), bestandsnaam };
    const T = require('./_lib/sjablonen');
    const link = require('./_lib/uploads').uploadLink('waarschuwing', naam);
    const html = T.metGezienKnop(mailHtml(tekst, 'SLA HR &middot; Schriftelijke waarschuwing', '#c0392b'), link, false);
    const text = platteTekst(tekst) + T.gezienPlain(link, false);
    if (p.preview) return { subject: onderwerp, html, text };
    if (!to || to.indexOf('@') === -1) throw new Error('Geen geldig e-mailadres voor ' + naam + '.');
    const resendId = await require('./_lib/mail').verstuur({ to, subject: onderwerp, text, html, attachments: [{ filename: bestandsnaam, content: pdf.toString('base64') }], tags: [{ name: 'bron', value: 'eindtijd' }, { name: 'type', value: 'waarschuwing' }] });
    // Dossier: tab Waarschuwingen (datum, sjabloon, cijfers, afzender) + digitaal voor gezien tekenen
    const c = p.cijfers || {}, af = p.afzender || {};
    const toelichting = 'Sjabloon: eindtijd-waarschuwing · Periode: ' + String(p.periode || '') + ' · Cijfers: ' + c.aantal_laat + ' van ' + c.aantal_totaal + ' sluitdiensten > 30 min te laat, gemiddeld ' + c.gem_min + ' min, ' + c.aantal_na_22 + '× na 22:00, grootste: ' + c.ergste_datum + ' (rooster ' + c.rooster_eind + ', uitklok ' + c.uitklok + ')' + (c.zonder_uitklok ? ', ' + c.zonder_uitklok + ' dienst(en) zonder uitklok' : '') + ' · Afzender: ' + String(af.naam || g.naam || g.email) + (af.functie ? ' (' + af.functie + ')' : '') + ' · Verstuurd door: ' + g.email;
    const nu = D.stempel();
    const rij = await S.logWaarschuwing({ naam, to, adres, datumOvertreding: String(p.periode || ''), toelichting, taal: 'NL' }, { naam: w.naam, bv: w.bv }, [REGEL_WAARSCHUWING], nu);
    try { await require('./_lib/ondertekening').aanmaken({ soort: 'waarschuwing', type: 'waarschuwing', titel: 'Waarschuwing eindtijd - ' + naam, naam, email: to, rij, taal: 'NL', pdf, door: g.email }); } catch (e) { console.warn('eindtijd ondertekening:', e.message); }
    await require('./_lib/mail').logMail({ door: g.email, bron: 'eindtijd', type: 'waarschuwing-pdf', naar: to, naam, onderwerp, taal: 'NL', rij, resend_id: resendId });
    await logActie({ door: g.email, actie: 'mail', bron: 'eindtijd', veld: 'waarschuwing', rij, naam, nieuw: to, details: onderwerp + ' (+PDF)' });
    return { bericht: 'Waarschuwing + PDF verstuurd naar ' + to + '. Staat in het dossier en wacht op "voor gezien".', rij };
  }
  throw new Error('Onbekende actie.');
});
