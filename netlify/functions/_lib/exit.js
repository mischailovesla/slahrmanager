// ============================================================
// Fase 2f: exit-survey (vervangt het exitgesprek dat SLA niet doet).
// - actief(): schakelaar (hr_instellingen 'exit_actief', standaard uit tot HR hem aanzet) — uit = geen link in brieven/mails, survey-pagina dicht, geen uitnodigingen
// - vragenConfig(): de vragenlijst (hr_instellingen 'exit_vragen', anders config.EXIT_VRAGEN) — HR bewerkt die in Uitstroom → Exit-surveys
// - exitLink(naam, taal, bron): persoonlijke link /exit.html?t=<token> voor in brief + mail
// - leesExitToken(t): controleert handtekening en geldigheid (EXIT_GELDIG_DAGEN)
// - vragen(taal): de vragenlijst in de gevraagde taal (async)
// - opslaan(tok, antwoorden, meta): valideert en bewaart in hr_exit (één keer per link)
// - samenvatting(vanIso, totIso): cijfers voor de Verloopanalyse
// Geen login voor de medewerker; de naam komt uit het token, niet uit het formulier.
// ============================================================
const C = require('./config');
const U = require('./uploads');
const I = require('./instellingen');
const V = require('./vragenlijst');
const { admin } = require('./auth');

const vandaagIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const dag = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const TYPES = V.TYPES;

async function actief() { return (await I.lees('exit_actief', false)) === true; }
async function vragenConfig() {
  const v = await I.lees('exit_vragen', null);
  return Array.isArray(v) && v.length ? v : C.EXIT_VRAGEN;
}
// Vragenlijst uit de editor controleren en normaliseren → opslaanbare vorm (gedeeld met de check-in, _lib/vragenlijst.js)
const normaliseerVragen = V.normaliseer;

function exitLink(naam, taal, bron) {
  return U.site() + '/exit.html?t=' + U.tekenToken({ s: 'exit', n: String(naam || '').trim(), t: String(taal || 'NL').toUpperCase() === 'EN' ? 'EN' : 'NL', b: String(bron || ''), d: vandaagIso() });
}
function leesExitToken(t) {
  const d = U.leesGetekend(t, 'Ongeldige link.');
  if (d.s !== 'exit') throw new Error('Ongeldige link.');
  const verstuurd = dag(d.d); if (!verstuurd) throw new Error('Ongeldige link.');
  if ((Date.now() - verstuurd.getTime()) / 864e5 > C.EXIT_GELDIG_DAGEN) throw new Error(d.t === 'EN' ? 'This link has expired.' : 'Deze link is verlopen.');
  return d;
}
// Nam de medewerker zelf ontslag? Uit de bron in de link: 'ontslag' / 'proeftijd-wn' = ja; 'aanzegging' / 'proeftijd-wg' = nee;
// handmatig/voorbeeld/oude proeftijd-links = onbekend (dan beslist de pagina op de gekozen vertrekreden).
function eigenOntslag(bron) {
  const b = String(bron || '');
  if (b === 'ontslag' || b === 'proeftijd-wn') return true;
  if (b === 'aanzegging' || b === 'proeftijd-wg') return false;
  return null;
}
async function vragen(taal, bron) { return V.vertaal(await vragenConfig(), taal, { eigenOntslag: eigenOntslag(bron) }); }
const valideer = (antwoorden, lijst, ctx) => V.valideer(antwoorden, lijst, ctx);
async function opslaan(tok, antwoorden, meta) {
  const { uit, nps, opmerking } = valideer(antwoorden, await vragenConfig(), { eigenOntslag: eigenOntslag(tok.b) });
  const anoniem = !!(meta && meta.anoniem);
  const db = admin();
  if (!anoniem) {
    const { data: al } = await db.from('hr_exit').select('id').eq('naam', tok.n).eq('token_datum', tok.d).limit(1);
    if (al && al.length) throw new Error(tok.t === 'EN' ? 'This survey has already been submitted. Thank you!' : 'Deze survey is al ingevuld. Bedankt!');
  }
  const rij = { naam: anoniem ? '' : tok.n, email: anoniem ? '' : String((meta && meta.email) || '').toLowerCase().slice(0, 200), winkel: String((meta && meta.winkel) || '').slice(0, 100), bv: String((meta && meta.bv) || '').slice(0, 100),
    taal: tok.t || 'NL', bron: tok.b || '', token_datum: anoniem ? '' : tok.d, anoniem, antwoorden: uit, nps, opmerking, medewerker_id: anoniem ? null : ((meta && meta.medewerker_id) || null), ip: (meta && meta.ip) || null };
  const { data, error } = await db.from('hr_exit').insert(rij).select('id');
  if (error) throw new Error('Opslaan mislukt: ' + error.message);
  return { id: data && data[0] ? data[0].id : null, aantal: Object.keys(uit).length };
}
// Cijfers voor de Verloopanalyse: respons, gemiddelde per schaalvraag, eNPS, keuzevragen, laatste opmerkingen
async function samenvatting(vanIso, totIso, uitstroom) {
  const { data, error } = await admin().from('hr_exit').select('*').gte('ingevuld_op', vanIso + 'T00:00:00').lte('ingevuld_op', totIso + 'T23:59:59').order('ingevuld_op', { ascending: false });
  if (error) throw new Error(error.message);
  const rijen = data || [];
  const n = rijen.length;
  const lijst = await vragenConfig();
  const schaal = {}, keuze = {};
  for (const v of lijst) {
    if (v.type === 'schaal') { const ws = rijen.map(r => r.antwoorden && r.antwoorden[v.key]).filter(x => typeof x === 'number'); schaal[v.key] = { vraag: v.nl, n: ws.length, gem: ws.length ? Math.round(ws.reduce((a, b) => a + b, 0) / ws.length * 10) / 10 : null, laag: ws.filter(x => x <= 2).length }; }
    if (v.type === 'keuze') { const t = {}; rijen.forEach(r => { const a = r.antwoorden && r.antwoorden[v.key]; if (a) t[a] = (t[a] || 0) + 1; }); keuze[v.key] = { vraag: v.nl, opties: v.opties.map(o => ({ key: o[0], label: o[1], aantal: t[o[0]] || 0 })).filter(x => x.aantal) }; }
  }
  const npsW = rijen.map(r => r.nps).filter(x => typeof x === 'number');
  const prom = npsW.filter(x => x >= 9).length, det = npsW.filter(x => x <= 6).length;
  const redenKey = (lijst.find(v => v.type === 'keuze') || {}).key;
  return {
    aantal: n, uitstroom: uitstroom == null ? null : uitstroom, respons: uitstroom ? Math.round(n / uitstroom * 100) : null,
    enps: npsW.length ? Math.round((prom - det) / npsW.length * 100) : null, npsGem: npsW.length ? Math.round(npsW.reduce((a, b) => a + b, 0) / npsW.length * 10) / 10 : null, npsN: npsW.length,
    schaal, keuze,
    opmerkingen: rijen.filter(r => r.opmerking).slice(0, 15).map(r => ({ op: String(r.ingevuld_op).slice(0, 10).split('-').reverse().join('-'), winkel: r.winkel, naam: r.anoniem ? '' : r.naam, tekst: r.opmerking, nps: r.nps, reden: redenKey ? (r.antwoorden && r.antwoorden[redenKey]) : '' }))
  };
}
module.exports = { TYPES, actief, vragenConfig, normaliseerVragen, exitLink, leesExitToken, vragen, valideer, opslaan, samenvatting, eigenOntslag };
