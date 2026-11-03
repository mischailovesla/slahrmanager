// ============================================================
// v0.40.0: Beheer → Toegang — wie mag het HR Dashboard in (tabel hr_toegang).
// GET                                        -> { accounts:[{email,naam,rol,actief,aangemaakt,door,laatsteLogin}], rollen, ik, magBewerken }
// POST { actie:'opslaan', email, naam, rol, actief } -> toevoegen of wijzigen (alleen beheerder)
// Veiligheid: alleen @ilovesla.com; je kunt jezelf niet uitzetten of je beheerdersrol afnemen;
// er blijft altijd minimaal één actieve beheerder. Elke wijziging komt in hr_acties (logboek).
// ============================================================
const { beveiligd, body, admin, logActie } = require('./_lib/auth');
const D = require('./_lib/datum');
const DOMEIN = (process.env.TOEGANG_DOMEIN || 'ilovesla.com').toLowerCase();
const ROLLEN = {
  admin: 'Beheerder: alles, plus instellingen (ontvangers, winkelmail, automatisch naar salaris, toegang)',
  hr: 'HR: alle dossiers inzien en afhandelen, geen instellingen',
  keuken: 'Keuken: alleen de takenlijst met keukenmedewerkers'
};

function controleer(nieuw, accounts, ik) {
  const email = String(nieuw.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Vul een geldig e-mailadres in.');
  if (!email.endsWith('@' + DOMEIN)) throw new Error('Alleen ' + DOMEIN + '-accounts kunnen inloggen (Google-login van SLA).');
  if (!ROLLEN[nieuw.rol]) throw new Error('Kies een rol: ' + Object.keys(ROLLEN).join(', ') + '.');
  const actief = nieuw.actief !== false;
  if (email === String(ik || '').toLowerCase()) {
    if (!actief) throw new Error('Je kunt je eigen toegang niet uitzetten.');
    if (nieuw.rol !== 'admin') throw new Error('Je kunt je eigen beheerdersrol niet afnemen. Laat een andere beheerder dit doen.');
  }
  const beheerders = (accounts || []).filter(a => a.actief && a.rol === 'admin' && a.email !== email).length + (actief && nieuw.rol === 'admin' ? 1 : 0);
  if (beheerders < 1) throw new Error('Er moet minimaal één actieve beheerder overblijven.');
  return { email, naam: String(nieuw.naam || '').trim() || email.split('@')[0], rol: nieuw.rol, actief };
}

exports.handler = beveiligd('toegang', async (event, g) => {
  const db = admin();
  const { data: acc, error } = await db.from('hr_toegang').select('email,naam,rol,actief,aangemaakt,aangemaakt_door').order('email');
  if (error) throw new Error('Supabase: ' + error.message);
  if (event.httpMethod === 'POST') {
    if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan toegang geven of wijzigen.');
    const p = body(event);
    if (p.actie !== 'opslaan') throw new Error('Onbekende actie.');
    const n = controleer(p, acc, g.email), oud = (acc || []).find(a => a.email === n.email);
    const rij = Object.assign({}, n, oud ? {} : { aangemaakt_door: g.email });
    const { error: e2 } = await db.from('hr_toegang').upsert(rij, { onConflict: 'email' });
    if (e2) throw new Error('Opslaan mislukt: ' + e2.message);
    await logActie({ door: g.email, actie: 'toegang', bron: 'toegang', veld: n.email, naam: n.naam, oud: oud ? oud.rol + (oud.actief ? '' : ' (uit)') : '', nieuw: n.rol + (n.actief ? '' : ' (uit)'), details: oud ? 'gewijzigd' : 'toegevoegd' });
    return { bericht: oud ? n.naam + ' bijgewerkt.' : n.naam + ' heeft nu toegang (' + n.rol + '). Inloggen kan direct op het dashboard met het Google-account ' + n.email + '.' };
  }
  const { data: log } = await db.from('hr_toegangslog').select('email,tijdstip').eq('actie', 'login').order('tijdstip', { ascending: false }).limit(2000);
  const laatste = {}; (log || []).forEach(r => { if (!laatste[r.email]) laatste[r.email] = r.tijdstip; });
  const accounts = (acc || []).map(a => ({ email: a.email, naam: a.naam || '', rol: a.rol || 'hr', actief: !!a.actief, aangemaakt: a.aangemaakt ? D.stempel(new Date(a.aangemaakt)) : '', door: a.aangemaakt_door || '', laatsteLogin: laatste[a.email] ? D.stempel(new Date(laatste[a.email])) : '' }));
  return { accounts, rollen: ROLLEN, ik: g.email, magBewerken: g.rol === 'admin', domein: DOMEIN };
});
exports.controleer = controleer;
