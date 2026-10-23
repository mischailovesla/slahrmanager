// ============================================================
// v0.28.0: Beheer → Winkelmail (wekelijks overzicht aan de store managers)
// GET                                         -> { instelling, winkels: [{ winkel, adres, standaard, uit }] }
// POST { actie:'opslaan', aan, proef, adressen, uit }   (alleen beheerder)
// POST { actie:'voorbeeld', winkel }          -> { html, leeg, aantallen }
// POST { actie:'proef', winkel? }             -> proefmail(s) naar C.WINKELMAIL_PROEF (alleen beheerder)
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const WM = require('./_lib/winkelmail');
const C = require('./_lib/config');

exports.handler = beveiligd('winkelmail', async (event, g) => {
  if (event.httpMethod !== 'POST') {
    const inst = await WM.instelling(), med = await require('./_lib/shiftbase').getMedewerkers(false);
    const winkels = Array.from(new Set(med.map(m => m.winkelNaam).filter(Boolean))).filter(w => !C.FRANCHISE_NAAM.test(w)).sort((a, b) => a.localeCompare(b, 'nl'));
    return { instelling: inst, proefAan: C.WINKELMAIL_PROEF || 'mischa@ilovesla.com', winkels: winkels.map(w => ({ winkel: w, adres: inst.adressen[w] || '', standaard: /keuken/i.test(w) ? C.KEUKEN_EMAIL || '' : '', uit: inst.uit.includes(w) })) };
  }
  const p = body(event);
  if (p.actie === 'voorbeeld') {
    const data = await WM.laad(), w = String(p.winkel || '');
    if (!data.winkels.includes(w)) throw new Error('Onbekende winkel: ' + w);
    const b = WM.bouw(data, w);
    return { html: WM.html(w, b, { links: false }), leeg: b.leeg, aantallen: { wacht: b.wacht.length, contracten: b.contracten.length, proeftijd: b.proeftijd.length, nieuw: b.nieuw.length, vertrek: b.vertrek.length, jubilea: b.jubilea.length, jarig: b.jarig.length }, fouten: data.fouten };
  }
  if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de winkelmail instellen of versturen.');
  if (p.actie === 'opslaan') {
    const adressen = {};
    Object.keys(p.adressen || {}).forEach(w => { const a = String(p.adressen[w] || '').trim(); if (!a) return; if (!a.split(',').every(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim()))) throw new Error('Ongeldig mailadres bij ' + w + ': ' + a); adressen[w] = a; });
    const waarde = { aan: !!p.aan, proef: p.proef !== false, adressen, uit: (p.uit || []).map(String) };
    await require('./_lib/instellingen').schrijf('winkelmail', waarde, g.email);
    await logActie({ door: g.email, actie: 'instelling', bron: 'winkelmail', nieuw: (waarde.aan ? 'aan' : 'uit') + (waarde.proef ? ' (proef)' : ''), details: Object.keys(adressen).length + ' adressen' });
    return { bericht: 'Opgeslagen. ' + (!waarde.aan ? 'De winkelmail staat uit.' : waarde.proef ? 'Proef: maandag krijg jij alle winkelmails.' : 'Maandag gaan de winkelmails naar de store managers.'), instelling: waarde };
  }
  if (p.actie === 'proef') {
    const r = await WM.verstuurAlles({ proef: true, alleenWinkel: p.winkel || '', door: g.email });
    return { bericht: r.verstuurd.length + ' proefmail(s) naar ' + (C.WINKELMAIL_PROEF || 'mischa@ilovesla.com') + (r.overgeslagen.length ? ' · ' + r.overgeslagen.length + ' overgeslagen (niets te melden of uitgezet)' : '') + (r.fouten.length ? ' · fouten: ' + r.fouten.join('; ') : ''), rap: r };
  }
  throw new Error('Onbekende actie.');
});
