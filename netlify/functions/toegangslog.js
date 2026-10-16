// GET /api/toegangslog[?max=300]  (getToegangslog, Toegang.gs) — AVG-verantwoording: wie keek wanneer wat in, exports, geweigerde logins
// Bron: Supabase hr_toegangslog (elke opvraag) + hr_acties (schrijfacties/exports). Samenvatting over 30 dagen.
const { beveiligd, admin } = require('./_lib/auth');
const D = require('./_lib/datum');
exports.handler = beveiligd('toegangslog', async (event) => {
  const max = Math.min(parseInt((event.queryStringParameters || {}).max, 10) || 300, 1000);
  const grens = new Date(Date.now() - 30 * 864e5).toISOString();
  const [log, acties, log30, acties30] = await Promise.all([
    admin().from('hr_toegangslog').select('tijdstip,email,actie,details,ip').order('tijdstip', { ascending: false }).limit(max),
    admin().from('hr_acties').select('tijdstip,door,actie,bron,veld,naam,details').order('tijdstip', { ascending: false }).limit(max),
    admin().from('hr_toegangslog').select('email,actie').gte('tijdstip', grens).limit(20000),
    admin().from('hr_acties').select('door,actie').gte('tijdstip', grens).limit(20000)
  ]);
  for (const r of [log, acties, log30, acties30]) if (r.error) throw new Error('Supabase: ' + r.error.message);
  const f = t => D.stempel(new Date(t));
  const regels = (log.data || []).map(r => ({ tijd: f(r.tijdstip), account: r.email, resultaat: r.actie, details: r.details || '', ip: r.ip || '' }));
  const mutaties = (acties.data || []).map(r => ({ tijd: f(r.tijdstip), account: r.door, actie: r.actie, bron: r.bron, veld: r.veld || '', naam: r.naam || '', details: r.details || '' }));
  const accounts = {}; let inzagen = 0, geweigerd = 0, logins = 0;
  for (const r of log30.data || []) { accounts[r.email] = (accounts[r.email] || 0) + 1; if (r.actie === 'dossier') inzagen++; else if (r.actie === 'geweigerd') geweigerd++; else if (r.actie === 'login') logins++; }
  let exports = 0, schrijf = 0;
  for (const r of acties30.data || []) { if (r.actie === 'export' || r.actie === 'document') exports++; else schrijf++; }
  const accLijst = Object.keys(accounts).map(k => ({ account: k, aantal: accounts[k] })).sort((a, b) => b.aantal - a.aantal);
  return { regels, mutaties, samenvatting: { dagen: 30, opvragen: (log30.data || []).length, inzagen, exports, schrijfacties: schrijf, geweigerd, logins, accounts: accLijst } };
});
