// ============================================================
// v0.50.0 GET /api/haccp?van=YYYY-MM-DD&tot=YYYY-MM-DD[&lijst=...][&ververs=1]
//   HACCP-naleving (Academy) naast het Shiftbase-rooster: per winkel verwacht/gemist/te laat, gemiste lijsten met de ploeg
//   die in het tijdvak geroosterd stond, en per medewerker hoe vaak een lijst niet is afgerond tijdens zijn/haar dienst.
//   De waarschuwing zelf loopt via de bestaande module (/api/waarschuwing-mail), voorgevuld door de browser.
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const HB = require('./_lib/haccpbrief');
const E = require('./_lib/eindtijd');
const D = require('./_lib/datum');
const SB = require('./_lib/shiftbase');
const S = require('./_lib/sheets');
const C = require('./_lib/config');
const H = require('./_lib/haccp');
const { normNaam } = require('./_lib/util');

const _cache = {};
async function laadRooster(van, tot, ververs) {
  const k = van + '|' + tot;
  if (!ververs && _cache[k] && _cache[k].t > Date.now()) return _cache[k].v;
  const q = 'min_date=' + van + '&max_date=' + tot, deps = Object.keys(C.SB_DEPT_CODE);
  const [users, ...rosters] = await Promise.all([SB.sbGet('users').catch(() => [])]
    .concat(deps.map(d => SB.sbGet('rosters?' + q + '&department_id=' + d).catch(e => { console.warn('haccp rooster ' + d + ':', e.message); return []; }))));
  const lijst = x => ((x && x.data) || x || []);
  const v = H.rooster([].concat(...rosters.map(lijst)), users);
  _cache[k] = { t: Date.now() + 10 * 60000, v };
  return v;
}

// v0.53.0: algemene HACCP-brief aan het team (zoals de teambrief Eindtijd & afsluiten)
//   POST { actie:'sjablonen' }                                   -> { sjablonen, afzender }
//   POST { actie:'team', winkel, onderwerp, tekst, ontvanger:{naam,email,voornaam}, taal:'NL'|'EN'|'NL+EN', preview? }
//        -> één mail per ontvanger (de browser loopt de lijst af), gelogd als brief (categorie "HACCP") in het dossier
async function teamPost(p, g) {
  if (p.actie === 'sjablonen') return { sjablonen: HB.SJABLONEN, afzender: { naam: g.naam || '' } };
  if (p.actie !== 'team') throw new Error('Onbekende actie');
  const o = p.ontvanger || {};
  const naam = String(o.naam || '').trim(), email = String(o.email || '').trim();
  const voornaam = String(o.voornaam || '').trim() || naam.split(' ')[0];
  const onderwerp = String(p.onderwerp || '').trim();
  if (!onderwerp) throw new Error('Vul het onderwerp in.');
  const tekst = E.vul(String(p.tekst || ''), { voornaam }, {});
  const open = E.openVariabelen(tekst + ' ' + onderwerp);
  if (open.length) throw new Error('Nog niet ingevuld in de tekst: ' + open.map(v => '{' + v + '}').join(', '));
  const taal = ['NL', 'EN', 'NL+EN'].includes(String(p.taal || '').toUpperCase()) ? String(p.taal).toUpperCase() : 'NL';
  const T = require('./_lib/sjablonen');
  const kop = taal === 'EN' ? 'SLA HR &middot; Food safety' : taal === 'NL+EN' ? 'SLA HR &middot; Voedselveiligheid / Food safety' : 'SLA HR &middot; Voedselveiligheid';
  const html = T.slaWrap(T.slaHead('#009f4b', kop) + '<tr><td style="padding:32px 36px 28px">' + E.naarHtml(tekst) + '</td></tr>' + T.slaFoot());
  const text = tekst.replace(/\*\*([^*]+)\*\*/g, '$1');
  if (p.preview) return { subject: onderwerp, html, text };
  if (!naam) throw new Error('Ontvanger zonder naam.');
  if (!email || email.indexOf('@') === -1) throw new Error('Geen geldig e-mailadres voor ' + naam + '.');
  const w = C.WINKEL_BV_MAP[p.winkel] || {};
  const M = require('./_lib/mail');
  const resendId = await M.verstuur({ to: email, subject: onderwerp, text, html, tags: [{ name: 'bron', value: 'haccp' }, { name: 'type', value: 'teambrief' }, { name: 'taal', value: taal.replace('+', '_') }] });
  let rij = 0;
  try { rij = await S.logBrief({ naam, email, bv: w.bv || '', categorie: HB.CATEGORIE, onderwerp, tekst, metPdf: false }, D.stempel()); }
  catch (e) { console.warn('haccp logBrief:', e.message); }
  await M.logMail({ door: g.email, bron: 'haccp', type: 'teambrief', naar: email, naam, onderwerp, taal, rij, resend_id: resendId });
  await logActie({ door: g.email, actie: 'mail', bron: 'haccp', veld: 'teambrief ' + (w.naam || p.winkel || 'alle winkels'), rij, naam, nieuw: email, details: onderwerp });
  return { bericht: 'Verstuurd naar ' + naam, rij };
}

exports.handler = beveiligd('haccp', async (event, g) => {
  if (event.httpMethod === 'POST') return await teamPost(body(event), g);
  const q = event.queryStringParameters || {};
  const iso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null;
  const acad = await H.haal(iso(q.van), iso(q.tot));
  const van = acad.van, tot = acad.tot;
  const [diensten, med, wrs, loon] = await Promise.all([
    laadRooster(van, tot, q.ververs === '1'), SB.getMedewerkers(false).catch(() => []), S.getWaarschuwingen().catch(() => []), S.getLoonheffing().catch(() => [])
  ]);
  const a = H.analyseer(acad.lijsten || [], diensten, { lijst: q.lijst || '', winkels: acad.winkels || [] });
  // gegevens voor de waarschuwing: e-mail, adres, taal, eerdere HACCP-waarschuwingen
  const opId = {}; med.forEach(m => { opId[String(m.id)] = m; });
  const zelfde = (r, p) => (p.email && String(r.email || '').toLowerCase() === p.email.toLowerCase()) || normNaam(r.naam) === normNaam(p.naam);
  a.medewerkers.forEach(m => {
    const s = opId[m.uid];
    const p = s ? { naam: s.naam, email: s.email, adres: s.adres, winkelCode: s.winkelCode || m.code, inDienst: true } : { naam: m.naam, email: '', adres: '', winkelCode: m.code, inDienst: false };
    p.winkelNaam = (C.WINKEL_BV_MAP[p.winkelCode] || C.WINKEL_BV_MAP[m.code] || {}).naam || '';
    const lh = loon.filter(r => zelfde(r, p)).pop(); p.taal = lh && String(lh.taal || '').toUpperCase() === 'EN' ? 'EN' : 'NL';
    p.eerdereHaccp = wrs.filter(r => zelfde(r, p) && /HACCP/i.test(r.regels || '')).map(r => String(r.verzenddatum || r.datumOvertreding || '').slice(0, 10)).filter(Boolean);
    m.persoon = p;
    m.toelichting = H.toelichting(m, p.taal === 'EN');
    m.datumOvertreding = m.voorvallen.map(v => H.nlDatum(v.datum)).filter((x, i, l) => l.indexOf(x) === i).join(', ');
  });
  return Object.assign({ regelTeksten: require('./_lib/sjablonen').regelsById(['HR50', 'HR57']), periode: { van, tot }, stand: acad.stand, minOverlap: H.MIN_OVERLAP, roosterDiensten: diensten.length }, a);
});
