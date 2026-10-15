// ============================================================
// Toegangscontrole - tegenhanger van Toegang.gs
// 1. Supabase-JWT uit de Authorization-header verifiëren
// 2. E-mail moet van TOEGANG_DOMEIN zijn
// 3. E-mail moet actief in hr_toegang staan
// 4. Elke opvraag wordt gelogd in hr_toegangslog
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const DOMEIN = (process.env.TOEGANG_DOMEIN || 'ilovesla.com').toLowerCase();

let _admin = null;
function admin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY ontbreekt');
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

async function log(email, actie, details, event) {
  try {
    const h = (event && event.headers) || {};
    await admin().from('hr_toegangslog').insert({
      email: email || '(onbekend)',
      actie,
      details: details ? String(details).slice(0, 500) : null,
      ip: h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || null,
      user_agent: h['user-agent'] ? String(h['user-agent']).slice(0, 300) : null
    });
  } catch (e) {
    console.warn('toegangslog mislukt:', e.message);
  }
}

// Geeft {ok:true, email, naam, rol} of {ok:false, status, bericht}
async function controleerToegang(event, actie) {
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, bericht: 'Niet ingelogd.' };

  const { data, error } = await admin().auth.getUser(token);
  if (error || !data || !data.user) {
    return { ok: false, status: 401, bericht: 'Sessie ongeldig of verlopen.' };
  }
  const email = String(data.user.email || '').toLowerCase();
  if (!email.endsWith('@' + DOMEIN)) {
    await log(email, 'geweigerd', 'verkeerd domein', event);
    return { ok: false, status: 403, bericht: 'Alleen ' + DOMEIN + '-accounts hebben toegang.' };
  }
  const { data: rij } = await admin().from('hr_toegang').select('naam,rol,actief').eq('email', email).maybeSingle();
  if (!rij || !rij.actief) {
    await log(email, 'geweigerd', 'niet op allowlist', event);
    return { ok: false, status: 403, bericht: 'Je account staat niet op de toegangslijst. Vraag Mischa om toegang.' };
  }
  await log(email, actie || 'opvraag', null, event);
  return { ok: true, email, naam: rij.naam || email, rol: rij.rol || 'hr' };
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

// Wrapper: handler(event, gebruiker) draait alleen na geslaagde toegangscheck
function beveiligd(actie, handler) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
    try {
      const t = await controleerToegang(event, actie);
      if (!t.ok) return json(t.status, { success: false, bericht: t.bericht });
      const result = await handler(event, t);
      return json(200, Object.assign({ success: true }, result));
    } catch (e) {
      console.error(actie, e);
      return json(500, { success: false, bericht: e.message || String(e) });
    }
  };
}

module.exports = { controleerToegang, beveiligd, json, log, admin };
