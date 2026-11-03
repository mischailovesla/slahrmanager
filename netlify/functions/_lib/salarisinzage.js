// ============================================================
// v0.42.0: wie mag salarissen in contracten op maat zien? (Mischa, 03-11-2026: alleen Jop, Ymke en Mischa)
// Instelling hr_instellingen 'salaris_inzage' = [e-mail, ...]; standaard C.SALARIS_INZAGE.
// Voor iedereen anders worden bedragen in het overzicht vervangen door '€ •••', is de contracttekst niet zichtbaar,
// werkt "Opnieuw gebruiken" niet en kan het (ondertekende) contract-PDF niet worden geopend.
// ============================================================
const C = require('./config');
const CATEGORIE = 'Contract op maat';
async function lijst() {
  let v = null; try { v = await require('./instellingen').lees('salaris_inzage', null); } catch (e) { v = null; }
  return (Array.isArray(v) && v.length ? v : C.SALARIS_INZAGE || []).map(x => String(x).trim().toLowerCase()).filter(Boolean);
}
async function mag(email) { return (await lijst()).includes(String(email || '').trim().toLowerCase()); }
const verberg = s => String(s || '').replace(/€\s?[\d.]+(?:,\d{1,2})?(?:\s?(?:\/\s?(?:mnd|uur|maand)|per maand|per uur))?/g, '€ •••');
// Rijen uit hr_brieven: contracten op maat afschermen
function scherm(rijen) {
  return (rijen || []).map(r => r && r.categorie === CATEGORIE ? Object.assign({}, r, { onderwerp: verberg(r.onderwerp), tekst: '(Contract op maat: de inhoud met het salaris is alleen zichtbaar voor de personen met salarisinzage.)', afgeschermd: true }) : r);
}
async function schermVoor(email, rijen) { return (await mag(email)) ? rijen : scherm(rijen); }
async function eis(email, wat) { if (!(await mag(email))) throw new Error((wat || 'Dit') + ' bevat salarisgegevens en is alleen zichtbaar voor de personen met salarisinzage.'); }
module.exports = { lijst, mag, verberg, scherm, schermVoor, eis, CATEGORIE };
