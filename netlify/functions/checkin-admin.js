// ============================================================
// HR-kant van de check-in 30/60 (fase 3a, ingelogd).
//   GET  /api/checkin-admin?maanden=6  -> { actief, vragenConfig, standaard, types, momenten, rijen, kpi, komende (14 dgn), nu (zou vandaag uitgenodigd worden) }
//   POST { actie:'opgevolgd', id, notitie }       -> lage check-in afvinken (verdwijnt uit de takenlijst)
//   POST { actie:'versturen', medewerker_id | (naam, email), moment } -> handmatige uitnodiging (alleen als de check-in aan staat)
//   POST { actie:'actief', actief }  /  { actie:'vragen', vragen | herstel }  (alleen admin)  /  { actie:'voorbeeld', taal }
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const CI = require('./_lib/checkin');
const V = require('./_lib/vragenlijst');
const I = require('./_lib/instellingen');
const U = require('./_lib/uploads');
const C = require('./_lib/config');
const SB = require('./_lib/shiftbase');

exports.handler = beveiligd('checkin-admin', async (event, g) => {
  const db = admin();
  if (event.httpMethod === 'POST') {
    const p = body(event);
    if (p.actie === 'actief') {
      if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de check-in aan- of uitzetten.');
      const aan = p.actief === true || p.actief === 'true';
      await I.schrijf('checkin_actief', aan, g.email);
      await logActie({ door: g.email, actie: 'instelling', bron: 'checkin', veld: 'checkin_actief', nieuw: aan ? 'aan' : 'uit', details: aan ? 'Check-in aangezet' : 'Check-in gepauzeerd' });
      return { actief: aan, bericht: aan ? 'Check-in staat aan: vanaf de volgende dagelijkse run (±10:40) krijgen nieuwe medewerkers op dag 30 en 60 een uitnodiging.' : 'Check-in gepauzeerd: geen uitnodigingen, pagina gesloten.' };
    }
    if (p.actie === 'vragen') {
      if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de vragen aanpassen.');
      if (p.herstel) { await I.schrijf('checkin_vragen', [], g.email); await logActie({ door: g.email, actie: 'instelling', bron: 'checkin', veld: 'checkin_vragen', nieuw: 'standaard' }); return { bericht: 'Vragen teruggezet naar de standaardlijst.', vragen: C.CHECKIN_VRAGEN }; }
      const lijst = V.normaliseer(p.vragen);
      await I.schrijf('checkin_vragen', lijst, g.email);
      await logActie({ door: g.email, actie: 'instelling', bron: 'checkin', veld: 'checkin_vragen', nieuw: lijst.length + ' vragen', details: lijst.map(v => v.key).join(', ') });
      return { bericht: lijst.length + ' vragen opgeslagen. Eerder ingevulde check-ins houden hun eigen antwoorden.', vragen: lijst };
    }
    if (p.actie === 'voorbeeld') return { link: U.site() + '/checkin.html?t=' + U.tekenToken({ s: 'checkin', i: 'voorbeeld', d: new Date().toLocaleDateString('sv-SE') }) + (String(p.taal).toUpperCase() === 'EN' ? '&taal=en' : '') };
    if (p.actie === 'opgevolgd') {
      if (!p.id) throw new Error('Geen check-in opgegeven.');
      const { data, error } = await db.from('hr_checkin').update({ opgevolgd_op: new Date().toISOString(), opgevolgd_door: g.email, opvolg_notitie: String(p.notitie || '').slice(0, 1000) }).eq('id', p.id).select('naam,moment');
      if (error) throw new Error(error.message);
      const r = (data || [])[0] || {};
      await logActie({ door: g.email, actie: 'checkin-opgevolgd', bron: 'checkin', naam: r.naam || null, veld: 'dag' + (r.moment || ''), details: String(p.notitie || '') });
      return { bericht: 'Opgevolgd' + (r.naam ? ': ' + r.naam : '') + '.' };
    }
    if (p.actie === 'versturen') {
      if (!(await CI.actief())) throw new Error('De check-in is gepauzeerd. Zet hem eerst aan (Instellingen onderaan) voordat je uitnodigingen verstuurt.');
      const moment = C.CHECKIN_MOMENTEN.includes(+p.moment) ? +p.moment : C.CHECKIN_MOMENTEN[0];
      let k;
      if (p.medewerker_id) {
        const m = (await SB.getMedewerkers()).find(x => String(x.id) === String(p.medewerker_id)); if (!m) throw new Error('Medewerker niet gevonden in Shiftbase.');
        k = { medewerker_id: String(m.id), naam: m.naam, email: String(p.email || m.email || '').trim().toLowerCase(), winkel: m.winkelNaam || '', bv: m.winkelBv || '', indienst: m.indienst || '', moment };
      } else {
        if (!p.naam) throw new Error('Vul de naam in.');
        k = { medewerker_id: null, naam: String(p.naam).trim(), email: String(p.email || '').trim().toLowerCase(), winkel: String(p.winkel || ''), moment };
      }
      if (k.medewerker_id) {
        const { data: al } = await db.from('hr_checkin').select('id').eq('medewerker_id', k.medewerker_id).eq('moment', moment).limit(1);
        if (al && al.length) throw new Error(k.naam + ' heeft de check-in van dag ' + moment + ' al gekregen.');
      }
      await CI.uitnodigen(k, g.email, 'handmatig');
      await logActie({ door: g.email, actie: 'mail', bron: 'checkin', veld: 'dag' + moment, naam: k.naam, nieuw: k.email, details: 'Check-in handmatig verstuurd' });
      return { bericht: 'Check-in (dag ' + moment + ') verstuurd naar ' + k.email };
    }
    throw new Error('Onbekende actie');
  }
  const q = event.queryStringParameters || {};
  const maanden = Math.min(Math.max(parseInt(q.maanden, 10) || 6, 1), 24);
  const van = new Date(); van.setMonth(van.getMonth() - maanden);
  const { data, error } = await db.from('hr_checkin').select('*').gte('verstuurd_op', van.toISOString()).order('verstuurd_op', { ascending: false });
  if (error) throw new Error(error.message + ' (migratie 0011 gedraaid?)');
  const lijst = await CI.vragenConfig(), eigen = await I.lees('checkin_vragen', null);
  const fmt = s => s ? new Date(s).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const rijen = (data || []).map(r => ({ id: r.id, naam: r.naam, email: r.email, winkel: r.winkel, moment: r.moment, indienst: r.indienst, bron: r.bron,
    verstuurd: fmt(r.verstuurd_op), herinnerd: fmt(r.herinnerd_op), ingevuld: fmt(r.ingevuld_op), taal: r.taal, score: r.score == null ? null : Number(r.score), laag: !!r.laag, laagReden: r.laag_reden, opmerking: r.opmerking,
    antwoorden: r.antwoorden || {}, labels: V.labels(lijst, r.antwoorden), opgevolgd: fmt(r.opgevolgd_op), opgevolgdDoor: r.opgevolgd_door, opvolgNotitie: r.opvolg_notitie,
    status: r.ingevuld_op ? (r.laag ? (r.opgevolgd_op ? 'opgevolgd' : 'laag') : 'ingevuld') : 'wacht' }));
  const ingevuld = rijen.filter(r => r.ingevuld), scores = ingevuld.map(r => r.score).filter(x => x != null);
  const kpi = { verstuurd: rijen.length, ingevuld: ingevuld.length, respons: rijen.length ? Math.round(ingevuld.length / rijen.length * 100) : null,
    gemScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null, laag: ingevuld.filter(r => r.laag).length, laagOpen: rijen.filter(r => r.status === 'laag').length };
  // per vraag het gemiddelde (schaal) en per winkel de gemiddelde score
  kpi.perVraag = lijst.filter(v => v.type === 'schaal').map(v => { const w = ingevuld.map(r => r.antwoorden[v.key]).filter(x => typeof x === 'number'); return { key: v.key, vraag: v.nl, n: w.length, gem: w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length * 10) / 10 : null }; });
  const pw = {}; ingevuld.forEach(r => { if (r.score == null) return; const k = r.winkel || '-'; (pw[k] = pw[k] || []).push(r.score); });
  kpi.perWinkel = Object.keys(pw).map(w => ({ winkel: w, n: pw[w].length, gem: Math.round(pw[w].reduce((a, b) => a + b, 0) / pw[w].length * 10) / 10 })).sort((a, b) => a.gem - b.gem);
  let komende = [], nu = [], medewerkers = [];
  try {
    const [med, set] = await Promise.all([SB.getMedewerkers(), CI.bestaande()]);
    komende = CI.komende(med, set, CI.vandaag0(), 14); nu = CI.kandidaten(med, set, CI.vandaag0());
    medewerkers = med.map(m => ({ id: String(m.id), naam: m.naam, email: m.email || '', winkel: m.winkelNaam || '', indienst: m.indienst || '' }));
  } catch (e) { console.warn('checkin komende:', e.message); }
  return { maanden, actief: await CI.actief(), vragenConfig: lijst, standaard: !(Array.isArray(eigen) && eigen.length), types: V.TYPES, momenten: C.CHECKIN_MOMENTEN, laagGrens: C.CHECKIN_LAAG_SCHAAL, rijen, kpi, komende, nu, medewerkers };
});
