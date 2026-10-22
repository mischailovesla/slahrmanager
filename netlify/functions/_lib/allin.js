// ============================================================
// All-in (0-uren) vs. managers: medewerkers hebben een all-in contract (vakantie-uren en vakantiegeld zitten
// in het uurloon). Junior/Senior/Store managers NIET: bij hen worden die bij de eindafrekening uitbetaald.
// Alle brieven bevatten standaard de all-in-zinnen; voorManager() wisselt ze om voor managers.
// Functie komt uit Shiftbase (laatste contract, veld "function").
// ============================================================
const { normNaam } = require('./util');

// v0.27.2 (Mischa, 22-10-2026): ook OPS (operations) is leidinggevend. MTO-groep blijft alleen 'manager' (mto.js).
const IS_MANAGER = f => /manager|\bops\b/i.test(String(f || ''));
// Geen all-in-contract: leidinggevenden én de keuken (normaal contract met vakantiedagen)
const GEEN_ALLIN = m => !!m && (IS_MANAGER(m.functie) || /keuken/i.test(String(m.winkelNaam || '')));

// [all-in tekst, manager-tekst] — exact zoals in brieftemplates.js / uitdienst.js / sjablonen.js
const PAREN = [
  [' Omdat je een all-in contract hebt, zijn vakantie-uren en vakantiegeld al in je uurloon inbegrepen; die worden niet apart uitbetaald.', ' Daarin zitten ook je niet-opgenomen vakantie-uren en het opgebouwde vakantiegeld.'],
  [' Because you have an all-in contract, holiday hours and holiday allowance are already included in your hourly wage and are not paid out separately.', ' This includes your unused holiday hours and accrued holiday allowance.'],
  ['• Vakantie-uren en vakantiegeld zijn bij jouw all-in contract al in je uurloon inbegrepen en worden niet apart uitbetaald.', '• Eventuele resterende vakantie-uren stem je tijdig af met jouw leidinggevende; niet opgenomen uren worden bij de eindafrekening uitbetaald.'],
  ['• With your all-in contract, holiday hours and holiday allowance are already included in your hourly wage and are not paid out separately.', '• Any remaining holiday hours should be discussed in advance with your supervisor; unused hours will be paid out in the final settlement.'],
  ['Na jouw laatste werkdag ontvang je een eindafrekening met daarin het loon over de laatste periode.', 'Na jouw laatste werkdag ontvang je een eindafrekening met daarin het loon over de laatste periode, de uitbetaling van niet-opgenomen vakantie-uren en het opgebouwde vakantiegeld.'],
  ['After your last working day you will receive a final settlement covering the wages for the final period.', 'After your last working day you will receive a final settlement covering the salary for the final period, payment of unused holiday hours and accrued holiday allowance.'],
  [' Vakantie-uren en vakantietoeslag zijn bij uw all-in contract al in het uurloon inbegrepen.', ' Daarin zijn ook uw opgebouwde vakantie-uren en vakantietoeslag opgenomen.'],
  [' Vakantie-uren en vakantiegeld zitten bij je all-in contract al in je uurloon.', ' Daarin zitten ook je vakantiegeld en openstaande vakantie-uren.']
];

function voorManager(tekst) {
  let s = String(tekst || '');
  for (const [a, b] of PAREN) s = s.split(a).join(b);
  return s;
}

// Zoek de medewerker in Shiftbase (e-mail, anders naam) en geef true als de functie een managerfunctie is.
async function isManager({ email, naam } = {}) {
  try {
    const SB = require('./shiftbase');
    const med = await SB.getMedewerkers();
    const e = String(email || '').trim().toLowerCase(), n = normNaam(naam || '');
    const m = (e && med.find(x => String(x.email || '').toLowerCase() === e)) || (n && med.find(x => normNaam(x.naam) === n)) || null;
    return GEEN_ALLIN(m);
  } catch (err) { console.warn('allin.isManager:', err.message); return false; }
}

// Tekst aanpassen als het een manager is
async function pasAan(tekst, wie) { return (await isManager(wie)) ? voorManager(tekst) : tekst; }

module.exports = { GEEN_ALLIN, IS_MANAGER, voorManager, isManager, pasAan, PAREN };
