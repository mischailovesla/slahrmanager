// ============================================================
// v0.35.2: controle van ingeleverde indiensttredingsformulieren voor HR (de medewerker ziet dit niet).
// Vergelijkt het online formulier met Shiftbase en met eerdere formulieren, en signaleert wat extra aandacht vraagt.
//   controleerMet(rijen, formulieren, med, akkoord, nu)  puur → zet r.indienstControle = [signaal]
//   controleer(rijen)                                    laadt alles en roept controleerMet aan
//   signaal = { soort, ernst: 'rood'|'oranje'|'blauw', label, tekst, veld?, reden? }   (veld+reden = voorstel voor ↩ retour)
// rood/oranje houden het automatisch versturen naar salaris tegen, tot HR ✓ Akkoord geeft of het formulier retour stuurt.
// ============================================================
const { normNaam } = require('./util');
const AKKOORD_SLEUTEL = 'indienst_controle_ok';

const iso = nlDatum => { const m = String(nlDatum || '').match(/^(\d{2})-(\d{2})-(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
const dagenVerschil = (a, b) => Math.round(Math.abs(new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5);
function leeftijdOp(gebIso, nu) { const g = new Date(gebIso + 'T12:00:00'); let l = nu.getFullYear() - g.getFullYear(); if (nu.getMonth() < g.getMonth() || (nu.getMonth() === g.getMonth() && nu.getDate() < g.getDate())) l--; return l; }

function controleerMet(rijen, formulieren, med, akkoord, nu) {
  nu = nu || new Date(); akkoord = akkoord || {};
  const perEmail = {}, perNaam = {};
  for (const m of med || []) { if (m.email) perEmail[String(m.email).toLowerCase()] = m; perNaam[normNaam(m.naam)] = m; }
  const bsnBij = {}; // bsnHash → set van namen
  for (const ref of Object.keys(formulieren || {})) { const f = formulieren[ref]; if (f.gegevens && f.gegevens.bsnHash) (bsnBij[f.gegevens.bsnHash] = bsnBij[f.gegevens.bsnHash] || new Set()).add(normNaam(f.naam)); }
  for (const r of rijen || []) {
    if (!r.docUrl2 || r.salaris) continue;
    const s = [], p = (soort, ernst, label, tekst, veld, reden) => s.push({ soort, ernst, label, tekst, veld: veld || '', reden: reden || '' });
    const f = formulieren[r.docUrl2], g = f && f.gegevens;
    if (!g) {
      p('handmatig', 'blauw', 'Bestand, geen online formulier', 'Ingeleverd als bestand (bijv. Excel of foto). De automatische controle kan dit niet lezen: controleer zelf vestiging, startdatum en uren.', 'vestiging', 'We hebben je formulier als bestand ontvangen. Wil je het online formulier invullen? Dan weten we zeker dat vestiging, startdatum en uren goed in ons systeem komen.');
    } else {
      const m = (g.email && perEmail[g.email]) || (r.email && perEmail[String(r.email).toLowerCase()]) || perNaam[normNaam(r.naam)] || null;
      if (m) {
        if (m.winkelCode && g.vestiging && m.winkelCode !== g.vestiging)
          p('vestiging', 'oranje', 'Vestiging wijkt af van Shiftbase', 'Formulier: ' + (g.vestigingNaam || g.vestiging) + ' · Shiftbase: ' + (m.winkelNaam || m.winkelCode) + '. Welke klopt?', 'vestiging', 'Je hebt ' + (g.vestigingNaam || g.vestiging) + ' ingevuld als vestiging, maar in ons rooster sta je bij ' + (m.winkelNaam || m.winkelCode) + '. Kies de winkel waar je gaat werken.');
        const sbStart = iso(m.indienst), fStart = iso(g.datumIndienst);
        if (sbStart && fStart && dagenVerschil(sbStart, fStart) > 3)
          p('startdatum', 'oranje', 'Startdatum wijkt af van Shiftbase', 'Formulier: ' + g.datumIndienst + ' · Shiftbase: ' + m.indienst + '.', 'datumIndienst', 'Je startdatum (' + g.datumIndienst + ') klopt niet met ons rooster (' + m.indienst + '). Vul de datum van je eerste werkdag in.');
        if (m.contractUren != null && g.uren !== '' && Math.abs(Number(g.uren) - Number(m.contractUren)) >= 1)
          p('uren', 'oranje', 'Uren wijken af van het contract', 'Formulier: ' + g.uren + ' u/week · contract in Shiftbase: ' + m.contractUren + ' u/week.', 'uren', 'Het aantal uren per week (' + g.uren + ') klopt niet met je contract (' + m.contractUren + '). Vul het aantal uren in dat je met je Store Manager hebt afgesproken.');
        const fGeb = iso(g.geboortedatum);
        if (fGeb && m.verjaardag && m.verjaardag.slice(5) !== fGeb.slice(5))
          p('geboortedatum', 'oranje', 'Geboortedatum wijkt af van Shiftbase', 'Formulier: ' + g.geboortedatum + ' · Shiftbase: andere verjaardag (' + m.verjaardag.slice(8) + '-' + m.verjaardag.slice(5, 7) + ').', 'geboortedatum', 'Je geboortedatum (' + g.geboortedatum + ') klopt niet met wat bij ons bekend is. Controleer hem even.');
        else if (fGeb && m.leeftijd != null && leeftijdOp(fGeb, nu) !== m.leeftijd)
          p('geboortedatum', 'oranje', 'Geboortejaar wijkt af van Shiftbase', 'Formulier: ' + g.geboortedatum + ' (' + leeftijdOp(fGeb, nu) + ' jaar) · Shiftbase: ' + m.leeftijd + ' jaar.', 'geboortedatum', 'Je geboortedatum (' + g.geboortedatum + ') klopt niet met wat bij ons bekend is. Controleer het jaar even.');
        if (g.email && m.email && g.email !== String(m.email).toLowerCase())
          p('email', 'blauw', 'E-mail wijkt af van Shiftbase', 'Formulier: ' + g.email + ' · Shiftbase: ' + m.email + '. Pas Shiftbase aan als het nieuwe adres klopt.');
      } else p('niet-in-shiftbase', 'blauw', 'Nog niet in Shiftbase', 'Geen medewerker met deze naam of e-mail in Shiftbase: vestiging, startdatum en uren konden niet worden vergeleken.');
      const fGeb = iso(g.geboortedatum);
      if (fGeb) { const l = leeftijdOp(fGeb, nu); if (l < 18) p('jeugd', 'blauw', 'Jonger dan 18 (' + l + ' jaar)', 'Minimumjeugdloon en de Arbeidstijdenwet voor jongeren gelden (werktijden, geen nachtwerk). Controleer het rooster.'); }
      if (g.nationaliteit && g.euer === false)
        p('wav', 'rood', 'Nationaliteit buiten EU/EER', (g.nationaliteitNaam || g.nationaliteit) + ': controleer vóór de eerste werkdag het verblijfsdocument en of werken is toegestaan (Wet arbeid vreemdelingen). Bewaar een kopie in het dossier.');
      if (g.bsnHash && bsnBij[g.bsnHash] && [...bsnBij[g.bsnHash]].some(n => n !== normNaam(r.naam)))
        p('bsn-dubbel', 'rood', 'BSN ook bekend bij een andere medewerker', 'Hetzelfde BSN staat op het formulier van: ' + [...bsnBij[g.bsnHash]].filter(n => n !== normNaam(r.naam)).join(', ') + '. Controleer het ID-bewijs.', 'bsn', 'Het BSN dat je hebt ingevuld lijkt niet te kloppen. Controleer het met je paspoort of ID-kaart.');
      if (g.ibanLand && g.ibanLand !== 'NL') p('iban-buitenland', 'blauw', 'Buitenlands IBAN (' + g.ibanLand + ')', 'Kan, maar geef het door aan de salarisadministratie (mogelijk BIC nodig).');
      if (g.postcode && !/^\d{4} [A-Z]{2}$/.test(g.postcode)) p('adres-buitenland', 'blauw', 'Buitenlands adres', 'Woont niet in Nederland: geef dit door aan de salarisadministratie.');
    }
    const ok = akkoord[r.docUrl2] || [];
    r.indienstControle = s.filter(x => !ok.includes(x.soort));
  }
  return rijen;
}
// Alle online formulieren (soort loon, key indienst) → { ref: { naam, gegevens } }
async function laadFormulieren() {
  const { data, error } = await require('./auth').admin().from('hr_uploads').select('id,naam,bestanden').eq('soort', 'loon').order('created_at', { ascending: false }).limit(3000);
  if (error) throw new Error(error.message);
  const uit = {};
  for (const u of data || []) for (const b of u.bestanden || []) if (b.key === 'indienst') uit['sb:' + u.id + ':indienst'] = { naam: u.naam, gegevens: b.gegevens || null };
  return uit;
}
async function controleer(rijen) {
  const open = (rijen || []).filter(r => r.docUrl2 && !r.salaris); if (!open.length) return rijen;
  try {
    const [form, med, ok] = await Promise.all([laadFormulieren(), require('./shiftbase').getMedewerkers(false).catch(() => []), require('./instellingen').lees(AKKOORD_SLEUTEL, {})]);
    controleerMet(open, form, med, ok || {}, new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })));
  } catch (e) { console.warn('indienstcontrole:', e.message); }
  return rijen;
}
const blokkeert = r => (r.indienstControle || []).filter(c => c.ernst !== 'blauw');
async function geefAkkoord(r, soort, door) {
  const I = require('./instellingen'); I.vergeet(AKKOORD_SLEUTEL);
  const lijst = Object.assign({}, (await I.lees(AKKOORD_SLEUTEL, {})) || {});
  lijst[r.docUrl2] = [...new Set((lijst[r.docUrl2] || []).concat(soort))];
  await I.schrijf(AKKOORD_SLEUTEL, lijst, door);
  await require('./auth').logActie({ door, actie: 'wijzig', bron: 'loonheffing', veld: 'indienst-controle', rij: r.rij, naam: r.naam, nieuw: 'akkoord: ' + soort, details: 'Controle indiensttredingsformulier goedgekeurd: ' + soort });
  return { bericht: 'Akkoord vastgelegd voor ' + r.naam + '.' };
}
module.exports = { controleerMet, controleer, laadFormulieren, blokkeert, geefAkkoord };
