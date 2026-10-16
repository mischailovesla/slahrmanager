#!/usr/bin/env node
// ============================================================
// Maakt van een Google service-account-JSON de twee compacte env vars
// die de Netlify Functions gebruiken (AWS Lambda staat max. 4 KB aan
// env vars toe; de volledige JSON als base64 is te groot).
//
// Gebruik:
//   node scripts/sa-compact.js pad/naar/service-account.json
//   node scripts/sa-compact.js "<base64 van GOOGLE_SA_JSON_B64>"
//
// Uitvoer: GOOGLE_SA_EMAIL en GOOGLE_SA_KEY, klaar om in Netlify te
// plakken (Site configuration → Environment variables). Daarna
// GOOGLE_SA_JSON_B64 in Netlify verwijderen en opnieuw deployen.
// De JSON zelf wordt nergens opgeslagen of verstuurd.
// ============================================================
const fs = require('fs');

const arg = process.argv[2];
if (!arg) {
  console.error('Gebruik: node scripts/sa-compact.js <service-account.json | base64-string>');
  process.exit(1);
}

let txt;
if (fs.existsSync(arg)) txt = fs.readFileSync(arg, 'utf8');
else if (arg.trim().startsWith('{')) txt = arg;
else txt = Buffer.from(arg.replace(/\s+/g, ''), 'base64').toString('utf8');

let creds;
try { creds = JSON.parse(txt); }
catch (e) { console.error('Geen geldige JSON/base64.'); process.exit(1); }
if (!creds.client_email || !creds.private_key) {
  console.error('JSON mist client_email of private_key.');
  process.exit(1);
}

const body = String(creds.private_key)
  .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
  .replace(/\\n/g, '')
  .replace(/\s+/g, '');

console.log('GOOGLE_SA_EMAIL=' + creds.client_email);
console.log('GOOGLE_SA_KEY=' + body);
console.error('\nGrootte: email ' + creds.client_email.length + ' tekens, key ' + body.length + ' tekens (was ' + Buffer.from(JSON.stringify(creds)).toString('base64').length + ' als GOOGLE_SA_JSON_B64).');
