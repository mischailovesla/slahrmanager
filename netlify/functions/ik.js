// Wie ben ik + mag ik erin? Wordt direct na login aangeroepen (logt 'login').
const { beveiligd } = require('./_lib/auth');
exports.handler = beveiligd('login', async (event, g) => ({ email: g.email, naam: g.naam, rol: g.rol }));
