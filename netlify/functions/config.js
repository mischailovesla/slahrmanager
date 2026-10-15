// Publieke config voor de browser (anon key is per definitie publiek;
// RLS staat aan, dus de browser kan er niets mee behalve inloggen).
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  body: JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    domein: process.env.TOEGANG_DOMEIN || 'ilovesla.com'
  })
});
