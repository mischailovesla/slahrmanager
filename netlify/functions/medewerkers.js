// Shiftbase-medewerkerslijst voor het zoekveld (10 min cache; ?ververs=1 forceert)
const { beveiligd } = require('./_lib/auth');
const SB = require('./_lib/shiftbase');
exports.handler = beveiligd('medewerkers', async (event) => {
  const forceer = !!(event.queryStringParameters && event.queryStringParameters.ververs);
  const medewerkers = await SB.getMedewerkers(forceer);
  return { medewerkers, aantal: medewerkers.length };
});
