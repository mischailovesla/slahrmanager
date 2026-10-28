// ============================================================
// v0.34.0: Instroom → Shiftbase-templates (per winkel downloaden, huisregels centraal beheren)
// GET                                              -> { soorten, winkels, huisregels, standaardHuisregels, instelling }
// POST { actie:'docx', soort, winkel }             -> { base64, bestandsnaam }
// POST { actie:'zip', soorten?:[], winkels?:[] }   -> { base64, bestandsnaam }   (leeg = alle)
// POST { actie:'opslaan', huisregels:[], vertegenwoordiger }   (alleen beheerder; geldt ook voor Contract op maat)
// Logica: _lib/shiftbasetemplates.js
// ============================================================
const { beveiligd, body, logActie } = require('./_lib/auth');
const SB = require('./_lib/shiftbasetemplates');

exports.handler = beveiligd('shiftbase-templates', async (event, g) => {
  if (event.httpMethod !== 'POST') {
    return { soorten: SB.SOORTEN, winkels: SB.winkels(), huisregels: await SB.huisregels(), standaardHuisregels: require('./_lib/contractmaatwerk').HUISREGELS, instelling: await SB.instelling() };
  }
  const p = body(event), actie = String(p.actie || '');
  if (actie === 'docx' || actie === 'zip') {
    const opts = Object.assign({}, await SB.instelling(), { huisregels: await SB.huisregels() });
    if (actie === 'docx') {
      const r = SB.maak(String(p.soort || ''), String(p.winkel || ''), opts);
      await logActie({ door: g.email, actie: 'document', bron: 'shiftbase-templates', veld: p.soort, details: r.bestandsnaam });
      return { base64: r.data.toString('base64'), bestandsnaam: r.bestandsnaam };
    }
    const keys = (Array.isArray(p.soorten) && p.soorten.length ? p.soorten : SB.SOORTEN.map(s => s.key)).map(String);
    const codes = (Array.isArray(p.winkels) && p.winkels.length ? p.winkels : SB.winkels().map(w => w.code)).map(String);
    keys.forEach(SB.soort); codes.forEach(SB.winkel);
    const buf = SB.bundel(keys, codes, opts);
    const naam = 'Shiftbase-templates' + (codes.length === 1 ? ' - ' + SB.winkel(codes[0]).naam : '') + (keys.length === 1 ? ' - ' + SB.soort(keys[0]).titel : '') + '.zip';
    await logActie({ door: g.email, actie: 'document', bron: 'shiftbase-templates', veld: 'zip', details: keys.length + ' soort(en) × ' + codes.length + ' winkel(s)' });
    return { base64: buf.toString('base64'), bestandsnaam: naam.replace(/[\\/:*?"<>|]+/g, '-') };
  }
  if (actie === 'opslaan') {
    if (g.rol !== 'admin') throw new Error('Alleen een beheerder kan de huisregels wijzigen.');
    const regels = (Array.isArray(p.huisregels) ? p.huisregels : String(p.huisregels || '').split('\n')).map(s => String(s).replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean);
    if (regels.length < 5) throw new Error('Er staan maar ' + regels.length + ' huisregels in de lijst. Klopt dat? Minimaal 5.');
    const vert = String(p.vertegenwoordiger || '').trim() || SB.STANDAARD.vertegenwoordiger;
    const I = require('./_lib/instellingen');
    const oud = await SB.huisregels();
    await I.schrijf('huisregels', regels, g.email);
    await I.schrijf('shiftbase_templates', Object.assign({}, await SB.instelling(), { vertegenwoordiger: vert }), g.email);
    const erbij = regels.filter(r => !oud.includes(r)).length, eraf = oud.filter(r => !regels.includes(r)).length;
    await logActie({ door: g.email, actie: 'instelling', bron: 'shiftbase-templates', veld: 'huisregels', nieuw: regels.length + ' regels', details: erbij + ' nieuw/gewijzigd, ' + eraf + ' weg · vertegenwoordiger ' + vert });
    return { bericht: 'Opgeslagen (' + regels.length + ' huisregels). Download de templates opnieuw en zet ze in Shiftbase.', huisregels: regels, instelling: { vertegenwoordiger: vert } };
  }
  throw new Error('Onbekende actie: ' + actie);
});
